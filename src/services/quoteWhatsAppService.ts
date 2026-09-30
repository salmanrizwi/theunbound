import { Quotation, User, TravelLead, CommunicationAuditLog } from '../types';
import { AppDatabase } from './db';
import {
  buildQuoteCommunicationPayload,
  formatWhatsAppQuoteFromPayload
} from './communicationDataBuilder';
import {
  CustomerSanitizedQuote,
  sanitizeQuoteForCustomer,
  verifyNoCommercialLeak
} from '../utils/customerQuoteSanitizer';

export interface WhatsAppSenderBranding {
  name?: string;
  agency?: string;
  phone?: string;
  email?: string;
}

export interface GenerateWhatsAppMessageOptions {
  quote: Quotation;
  selectedOptionIndexOrId?: number | string;
  senderBranding?: WhatsAppSenderBranding;
  customNote?: string;
  useEmojis?: boolean;
  formatStyle?: 'DETAILED' | 'SUMMARY';
}

export interface RecordWhatsAppShareOptions {
  quote: Quotation;
  recipientPhone: string;
  user: User | null;
  selectedOptionTitle?: string;
  savePhoneToCustomerProfile?: boolean;
}

/**
 * Generate a 6-character uppercase alphanumeric ID (e.g., "A7K92P")
 * for unique, elegant Lead identification according to TheUnbound specification.
 */
export function generate6CharAlphanumericId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // excludes 0/O, 1/I to prevent ambiguity
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Normalize phone number by removing spaces, hyphens, parentheses, and leading plus sign
 * WhatsApp wa.me requires purely numeric format: country code + local number.
 * Example: "+91 98116-54959" -> "919811654959"
 */
export function normalizePhoneNumber(rawPhone?: string): string {
  if (!rawPhone) return '';
  return rawPhone.replace(/[^0-9]/g, '');
}

/**
 * Validates international phone number for WhatsApp
 */
export function validateInternationalPhone(rawPhone?: string): {
  isValid: boolean;
  normalized: string;
  error?: string;
} {
  const normalized = normalizePhoneNumber(rawPhone);
  if (!normalized) {
    return { isValid: false, normalized: '', error: 'Phone number is required.' };
  }
  if (normalized.length < 7) {
    return { isValid: false, normalized, error: 'Phone number is too short. Include country code (e.g. +91 or +1).' };
  }
  if (normalized.length > 15) {
    return { isValid: false, normalized, error: 'Phone number exceeds standard international length (max 15 digits).' };
  }
  return { isValid: true, normalized };
}

/**
 * Masks phone number for privacy in public audit logs and timeline events.
 * Example: "919811654959" -> "+91 •••• ••4959"
 */
export function maskPhoneNumber(phone?: string): string {
  if (!phone) return 'Unknown Number';
  const clean = normalizePhoneNumber(phone);
  if (clean.length < 6) return '••••••';
  
  const last4 = clean.slice(-4);
  const countryPrefix = clean.length > 10 ? `+${clean.slice(0, clean.length - 8)} ` : '';
  return `${countryPrefix}•••• ••${last4}`;
}

/**
 * Builds the dynamically generated WhatsApp message adhering strictly to TheUnbound Standard (Section 16).
 * MANDATE: Contains trip summary, accommodations, AND complete chronological Day-Wise Plan!
 * GUARANTEE: Never exposes internal costs, supplier rates, or commercial margins.
 */
export function generateWhatsAppQuoteMessage(options: GenerateWhatsAppMessageOptions): string {
  // Derive from authoritative QuoteCommunicationPayload
  const payload = buildQuoteCommunicationPayload(options.quote, {
    selectedOptionIndexOrId: options.selectedOptionIndexOrId,
    role: 'BUYER',
    senderBranding: options.senderBranding
  });

  return formatWhatsAppQuoteFromPayload(payload, options.customNote, {
    useEmojis: options.useEmojis !== false,
    formatStyle: options.formatStyle || 'DETAILED'
  });
}

/**
 * Generates official click-to-chat WhatsApp URL (wa.me)
 */
export function generateWhatsAppShareUrl(phoneNumber: string, messageText: string): string {
  const cleanPhone = normalizePhoneNumber(phoneNumber);
  const encodedText = encodeURIComponent(messageText);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Records WhatsApp share event, updates quote version/history,
 * logs comprehensive CommunicationAuditLog according to Section 32,
 * and seamlessly synchronizes with Lead CRM.
 */
export function recordWhatsAppQuoteShare(
  db: AppDatabase,
  quote: Quotation,
  options: RecordWhatsAppShareOptions
): {
  updatedQuote: Quotation;
  lead?: TravelLead;
} {
  const timestamp = new Date().toISOString();
  const maskedPhone = maskPhoneNumber(options.recipientPhone);
  const userName = options.user?.name || quote.agentName || 'Agent';
  const userRole = options.user?.role || 'B2B_AGENT';
  const optionDetail = options.selectedOptionTitle ? ` (Option: ${options.selectedOptionTitle})` : '';
  const shareDetails = `Proposal shared via WhatsApp to ${maskedPhone}${optionDetail}`;

  // 1. Update quote record
  const updatedQuote: Quotation = {
    ...quote,
    status: quote.status === 'DRAFT' ? 'SENT' : quote.status,
    lastSharedViaWhatsAppAt: timestamp,
    lastSharedRecipientPhone: maskedPhone,
    clientPhone: options.savePhoneToCustomerProfile ? (options.recipientPhone || quote.clientPhone) : quote.clientPhone,
    versionHistory: [
      {
        version: quote.version || 1,
        updatedAt: timestamp,
        updatedBy: userName,
        changesSummary: shareDetails,
        totalSellingPrice: quote.totalSellingPrice
      },
      ...(quote.versionHistory || [])
    ]
  };

  const savedQuote = db.saveQuote(updatedQuote, options.user, 'WHATSAPP_SHARED', shareDetails);

  // 2. Authoritative Communication Audit Log (Section 32 Mandate)
  const commId = `comm-wa-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
  db.saveCommunicationAuditLog({
    id: `audit-${Date.now()}`,
    communicationId: commId,
    quoteId: quote.id,
    leadId: quote.leadId,
    recipientPhone: maskedPhone,
    recipientType: 'BUYER',
    channel: 'WHATSAPP',
    eventType: 'QUOTE_WHATSAPP_SHARED',
    templateVersion: '1.0.0-standard',
    sentAt: timestamp,
    sentBy: options.user?.id,
    sentByName: userName,
    deliveryStatus: 'SUCCESS'
  });

  // General Audit Trail logging
  db.logAudit(
    options.user,
    'QUOTE_SENT',
    'Quotation',
    quote.id,
    `WHATSAPP_QUOTE_SHARE_INITIATED: ${quote.quoteNumber} (v${quote.version || 1}) shared with ${maskedPhone} by ${userName} (${userRole})`
  );

  // 3. Link or update CRM Lead
  let linkedLead: TravelLead | undefined = undefined;
  const allLeads = db.getLeads();

  // Find existing lead by quote.leadId, or quote.id linkage, or client email
  let existingLead = allLeads.find(l => 
    (quote.leadId && l.id === quote.leadId) ||
    (l.quoteId === quote.id) ||
    (l.quoteIds && l.quoteIds.includes(quote.id))
  );

  if (!existingLead && quote.clientEmail && quote.clientEmail !== 'client@example.com') {
    const targetEmail = quote.clientEmail.toLowerCase();
    existingLead = allLeads.find(l => l.email && l.email.toLowerCase() === targetEmail);
  }

  const timelineEvent = {
    id: `tl-wa-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
    type: 'WHATSAPP_QUOTE_SHARED' as const,
    title: `WhatsApp Quote Shared (${quote.quoteNumber})`,
    description: `Quotation proposal summary shared via WhatsApp to ${maskedPhone}. Destination: ${quote.destination}. Total: ${quote.currency} ${quote.totalSellingPrice}.${optionDetail}`,
    timestamp,
    performedBy: userName,
    performedByUserType: userRole,
    quoteId: quote.id,
    quoteNumber: quote.quoteNumber,
    metadata: {
      channel: 'WHATSAPP',
      recipientPhone: maskedPhone,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      version: quote.version || 1,
      selectedOption: options.selectedOptionTitle,
      status: 'INITIATED'
    }
  };

  if (existingLead) {
    const updatedLead: TravelLead = {
      ...existingLead,
      phone: options.savePhoneToCustomerProfile ? (options.recipientPhone || existingLead.phone) : existingLead.phone,
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      quoteIds: Array.from(new Set([...(existingLead.quoteIds || []), quote.id])),
      lastActivityAt: timestamp,
      lastActivitySummary: `WhatsApp Quote Shared: #${quote.quoteNumber} to ${maskedPhone}`,
      timeline: [timelineEvent, ...(existingLead.timeline || [])]
    };
    db.saveLead(updatedLead, options.user);
    linkedLead = updatedLead;
  } else {
    const unique6Char = generate6CharAlphanumericId();
    const newLeadNumber = `LED-${new Date().getFullYear()}-${unique6Char}`;

    const newLead: TravelLead = {
      id: unique6Char,
      leadNumber: newLeadNumber,
      contactName: quote.clientName && quote.clientName !== 'Client Name Pending' ? quote.clientName : 'Valued Traveler',
      email: quote.clientEmail || `${unique6Char.toLowerCase()}@client.theunbound.in`,
      phone: options.recipientPhone || quote.clientPhone || '',
      agencyName: quote.clientCompany || quote.agentAgency,
      companyName: quote.clientCompany,
      userId: quote.clientUserId || options.user?.id,
      userType: options.user?.role === 'B2B_AGENT' ? 'B2B_AGENT' : 'BUYER',
      b2bAgentId: options.user?.role === 'B2B_AGENT' ? options.user.id : quote.b2bAgentId,
      source: 'QUOTATION_SAVED',
      status: 'PROPOSAL_SAVED',
      priority: 'NORMAL',
      destinationId: (quote.destination || 'japan').toLowerCase().replace(/[^a-z0-9]/g, '-'),
      destinationName: quote.destination,
      travelStartDate: quote.travelStartDate,
      travelEndDate: quote.travelEndDate,
      travelDates: quote.travelStartDate && quote.travelEndDate ? `${quote.travelStartDate} to ${quote.travelEndDate}` : 'Flexible',
      paxAdults: quote.adultsCount || 2,
      paxChildren: quote.childrenCount || 0,
      paxInfants: quote.infantsCount || 0,
      totalPassengers: quote.totalPax || 2,
      travelRequirements: (typeof quote.agentNotes === 'string'
        ? quote.agentNotes
        : Array.isArray(quote.agentNotes)
          ? (quote.agentNotes as any[]).map(x => typeof x === 'string' ? x : x?.text || '').filter(Boolean).join('\n')
          : '') || quote.title || 'Custom Travel Itinerary',
      estimatedBudget: quote.totalSellingPrice,
      currency: quote.currency || 'USD',
      quoteId: quote.id,
      quoteNumber: quote.quoteNumber,
      quoteVersion: quote.version || 1,
      quoteIds: [quote.id],
      assignedStaffId: options.user?.id || 'staff-01',
      assignedStaffName: userName,
      assignedDepartment: 'SALES',
      notes: [],
      followUps: [],
      timeline: [timelineEvent],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActivityAt: timestamp,
      lastActivitySummary: `WhatsApp Quote Shared: #${quote.quoteNumber} to ${maskedPhone}`
    };

    db.saveLead(newLead, options.user);
    linkedLead = newLead;

    if (!quote.leadId) {
      savedQuote.leadId = newLead.id;
      db.saveQuote(savedQuote, options.user, 'EDITED');
    }
  }

  return {
    updatedQuote: savedQuote,
    lead: linkedLead
  };
}
