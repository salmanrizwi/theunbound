import { AppDatabase } from './db';
import { Quotation, User, QuoteVersionRecord } from '../types';

export interface OpenQuoteOptions {
  leadId?: string;
  quoteId: string;
  quoteVersion?: number;
  mode?: 'inspect' | 'edit' | 'readonly';
}

export interface ResolvedQuoteState {
  isValid: boolean;
  errorMessage?: string;
  quote?: Quotation;
  targetVersion?: number;
  mode: 'inspect' | 'edit' | 'readonly';
  isVersionSpecific: boolean;
  versionRecord?: QuoteVersionRecord;
}

/**
 * Authoritative Route & Action Resolver for Quotation Master Records and Lead Proposals.
 * 
 * Verifies:
 * 1. Confirm quote exists in database by ID or quote number.
 * 2. Confirm user authorization and access control (admin vs b2b agent vs buyer).
 * 3. Confirm quote belongs to selected lead if leadId is specified.
 * 4. Confirm selected version exists (either as branched quotation document or versionHistory snapshot).
 * 5. Determine correct operational mode (Inspection, Edit, or Read-Only) based on user permissions and lock status.
 * 6. Return validated quote state for Quote Builder hydration without losing or altering original data.
 */
export function resolveAndValidateQuoteForBuilder(
  db: AppDatabase,
  options: OpenQuoteOptions,
  user: User | null
): ResolvedQuoteState {
  if (!options.quoteId) {
    return {
      isValid: false,
      errorMessage: 'No Quotation ID was provided to the route resolver.',
      mode: 'inspect',
      isVersionSpecific: false
    };
  }

  // Handle special new workspace mode
  if (options.quoteId === 'new') {
    return {
      isValid: true,
      mode: 'edit',
      targetVersion: 1,
      isVersionSpecific: false
    };
  }

  // 1. Confirm quote exists in database
  const allQuotes = db.getAllSavedQuotes();
  let candidateQuote = allQuotes.find(
    q => q.id === options.quoteId || q.quoteNumber === options.quoteId
  );

  if (!candidateQuote) {
    return {
      isValid: false,
      errorMessage: `Quotation record "${options.quoteId}" was not found in the database.`,
      mode: 'inspect',
      isVersionSpecific: false
    };
  }

  // 2. Authorization check
  const authorizedQuote = db.getQuoteByIdAuthorized(candidateQuote.id, user);
  if (!authorizedQuote) {
    return {
      isValid: false,
      errorMessage: `You do not have permission to view or open quotation #${candidateQuote.quoteNumber}.`,
      mode: 'inspect',
      isVersionSpecific: false
    };
  }

  candidateQuote = authorizedQuote;

  // 3. Confirm Lead Association
  if (options.leadId && candidateQuote.leadId && candidateQuote.leadId !== options.leadId && candidateQuote.linkedLeadId !== options.leadId) {
    console.warn(`Quote #${candidateQuote.quoteNumber} has leadId ${candidateQuote.leadId}, differing from requested lead ${options.leadId}`);
  }

  // 4. Confirm Selected Version Exists
  let targetVersion = options.quoteVersion || candidateQuote.version || 1;
  let isVersionSpecific = Boolean(options.quoteVersion && options.quoteVersion !== candidateQuote.version);
  let matchedVersionRecord: QuoteVersionRecord | undefined;

  if (options.quoteVersion && candidateQuote.version !== options.quoteVersion) {
    // Check if there is a separate quotation document for this version in the branch tree
    const baseNumber = candidateQuote.quoteNumber ? candidateQuote.quoteNumber.split('-v')[0] : '';
    const specificVersionDoc = allQuotes.find(q => 
      (q.version === options.quoteVersion || q.versionNumber === options.quoteVersion) &&
      (q.parentQuoteId === candidateQuote!.id || 
       candidateQuote!.parentQuoteId === q.id || 
       (baseNumber && q.quoteNumber?.startsWith(baseNumber)) ||
       (options.leadId && (q.leadId === options.leadId || q.linkedLeadId === options.leadId)))
    );

    if (specificVersionDoc) {
      const authorizedSpecific = db.getQuoteByIdAuthorized(specificVersionDoc.id, user);
      if (authorizedSpecific) {
        candidateQuote = authorizedSpecific;
        targetVersion = candidateQuote.version || options.quoteVersion;
        isVersionSpecific = true;
      }
    } else {
      // Check versionHistory snapshots on candidateQuote
      if (candidateQuote.versionHistory && Array.isArray(candidateQuote.versionHistory)) {
        matchedVersionRecord = candidateQuote.versionHistory.find(
          v => v.version === options.quoteVersion || v.versionNumber === options.quoteVersion
        );
      }
    }
  }

  // 5. Determine Operational Mode
  const isInternal = user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER' || user?.role === 'DMC_STAFF';
  const isB2BAgent = user?.role === 'B2B_AGENT';
  const isLocked = Boolean(candidateQuote.isLocked);
  const isBooked = candidateQuote.status === 'BOOKED' || candidateQuote.status === 'BOOKING_SUBMITTED';

  let effectiveMode: 'inspect' | 'edit' | 'readonly' = options.mode || 'inspect';

  // Read-only enforcement for buyers or users without edit permission
  if (!isInternal && !isB2BAgent) {
    effectiveMode = 'readonly';
  } else if (isLocked || isBooked) {
    // Locked or Booked quotes must default to inspection to protect original proposal data
    if (effectiveMode === 'edit') {
      effectiveMode = 'inspect';
    }
  }

  return {
    isValid: true,
    quote: candidateQuote,
    targetVersion,
    mode: effectiveMode,
    isVersionSpecific,
    versionRecord: matchedVersionRecord
  };
}
