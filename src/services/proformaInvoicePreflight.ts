import { AppDatabase } from './db';
import { Booking, User } from '../types';
import { resolveAuthoritativeProformaAmount } from './bookingOperationsSyncService';
import { isInternalStaff, isMasterAdmin } from './permissionEngine';

export type ProformaErrorCode =
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_INVALID'
  | 'BOOKING_REFERENCE_MISSING'
  | 'FINANCIAL_SNAPSHOT_MISSING'
  | 'CUSTOMER_DETAILS_MISSING'
  | 'BILLABLE_SERVICE_MISSING'
  | 'PRICE_MISSING'
  | 'CURRENCY_MISSING'
  | 'INVOICE_CONFIGURATION_MISSING'
  | 'INVOICE_NUMBER_GENERATION_FAILED'
  | 'PDF_GENERATION_FAILED'
  | 'STORAGE_UPLOAD_FAILED'
  | 'PERMISSION_DENIED'
  | 'AUTHENTICATION_REQUIRED'
  | 'SERVICE_UNAVAILABLE'
  | 'TAX_REGISTRATION_MISSING'
  | 'TAX_SERIES_MISSING'
  | 'TAX_APPROVAL_REQUIRED'
  | 'UNKNOWN_ERROR';

export interface ProformaPreflightError {
  code: ProformaErrorCode;
  title: string;
  message: string;
  missingRequirements: string[];
  actionableInstruction: string;
  actionType?: 'GO_TO_BOOKING' | 'EDIT_PRICING' | 'UPDATE_CUSTOMER' | 'SET_CURRENCY' | 'CONTACT_ADMIN';
  bookingId?: string;
  leadId?: string;
  referenceId?: string;
}

export interface ProformaPreflightResult {
  valid: boolean;
  booking?: Booking;
  resolvedCurrency?: string;
  resolvedFinalBookingAmount?: number;
  resolvedSnapshotId?: string;
  error?: ProformaPreflightError;
}

export interface TaxInvoicePreflightOptions {
  taxInvoiceSeriesConfigured?: boolean;
  taxInvoiceApproved?: boolean;
  requireCustomerGstin?: boolean;
}

function canUserGenerateProformaInvoice(user: User, booking: Booking): boolean {
  if (isMasterAdmin(user) || isInternalStaff(user)) return true;
  if ((user.role as string) === 'BUYER' || (user.userType as string) === 'BUYER') return false;
  // Owning / assigned B2B Agent may view/request proforma for their own booking
  const uid = user.id;
  return (
    booking.assignedAgentId === uid ||
    booking.submittingAgentId === uid ||
    booking.submittedByUserId === uid ||
    booking.agentId === uid
  );
}

function resolveBookingCurrencyForProforma(booking: Booking): string {
  const snapshots = Array.isArray(booking.pricingSnapshotHistory) ? booking.pricingSnapshotHistory : [];
  const latestSnapshot = snapshots.length > 0 ? snapshots[snapshots.length - 1] : null;
  const candidate =
    latestSnapshot?.currency ||
    booking.currency ||
    (booking as any).pricing?.currency ||
    booking.items?.find(it => it.currency)?.currency ||
    '';
  return String(candidate).trim().toUpperCase();
}

/**
 * Authoritative preflight validation for PROFORMA INVOICES (preliminary commercial documents).
 *
 * STRICT SEPARATION FROM TAX INVOICE COMPLIANCE:
 * Proforma Invoices MUST NOT be blocked by statutory Tax Invoice requirements:
 * - Missing customer or company GST / VAT / Tax registration number -> ALLOWED
 * - Missing tax invoice series / fiscal numbering -> ALLOWED
 * - Missing tax invoice issuance approval -> ALLOWED
 * - Missing optional secondary tax fields or customer billing email -> ALLOWED (falls back to agency/booking profile)
 *
 * ESSENTIAL CONTROLS RETAINED:
 * 1. Authenticated & authorized user permission
 * 2. Booking exists with valid booking reference
 * 3. Booking status is not CANCELLED / ARCHIVED
 * 4. Valid currency is known
 * 5. Authoritative committed financial snapshot / Final Booking Amount > 0 is available (never invented)
 */
export function validateProformaInvoicePreflight(
  bookingId: string | undefined,
  user: User | null,
  bookingOverride?: Booking | null
): ProformaPreflightResult {
  const referenceId = `PINV-CHK-${Date.now().toString(36).toUpperCase()}`;

  // 1. Authentication Check
  if (!user) {
    return {
      valid: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        title: 'Authentication Required',
        message: 'Your active session has expired or is unauthenticated.',
        missingRequirements: ['Active authenticated user session'],
        actionableInstruction: 'Please sign in again to continue with Proforma Invoice generation.',
        referenceId
      }
    };
  }

  // 2. Booking ID Check
  if (!bookingId || !bookingId.trim()) {
    return {
      valid: false,
      error: {
        code: 'BOOKING_NOT_FOUND',
        title: 'Booking Not Specified',
        message: 'No operational booking ID was provided for Proforma Invoice generation.',
        missingRequirements: ['Valid Booking ID'],
        actionableInstruction: 'Please select an active operational booking from the Booking Pipeline.',
        referenceId
      }
    };
  }

  const db = AppDatabase.getInstance();
  const booking = bookingOverride || db.getBookingById(bookingId, user) || db.getAllBookings().find(b => b.id === bookingId || b.bookingReference === bookingId);

  // 3. Booking Existence Check
  if (!booking) {
    return {
      valid: false,
      error: {
        code: 'BOOKING_NOT_FOUND',
        title: 'Booking Record Not Found',
        message: `The requested booking record #${bookingId} could not be located.`,
        missingRequirements: [`Active booking record matching ID ${bookingId}`],
        actionableInstruction: 'Verify the booking record exists and refresh the Booking Pipeline.',
        referenceId
      }
    };
  }

  // 4. Permission Check
  if (!canUserGenerateProformaInvoice(user, booking)) {
    return {
      valid: false,
      booking,
      error: {
        code: 'PERMISSION_DENIED',
        title: 'Insufficient Permissions',
        message: `Your account (${user.role || 'External'}) is not authorized to issue Proforma Invoices for Booking #${booking.bookingReference || booking.id}.`,
        missingRequirements: ['Authorized Admin, Finance, Operations, or owning B2B Partner role'],
        actionableInstruction: 'Contact an Admin or Finance user to issue the Proforma Invoice.',
        bookingId: booking.id,
        actionType: 'CONTACT_ADMIN',
        referenceId
      }
    };
  }

  // 5. Valid Booking Reference Check
  if (!booking.bookingReference || !String(booking.bookingReference).trim()) {
    return {
      valid: false,
      booking,
      error: {
        code: 'BOOKING_REFERENCE_MISSING',
        title: 'Booking Reference Missing',
        message: `Booking record (${booking.id}) does not have an assigned booking reference number.`,
        missingRequirements: ['Valid Booking Reference Number'],
        actionableInstruction: 'Open Booking Overview and assign or save a valid booking reference before generating a Proforma Invoice.',
        bookingId: booking.id,
        actionType: 'GO_TO_BOOKING',
        referenceId
      }
    };
  }

  // 6. Booking Status Validity (Cancelled / Archived cannot be billed)
  if (booking.status === 'CANCELLED' || (booking.status as string) === 'ARCHIVED') {
    return {
      valid: false,
      booking,
      error: {
        code: 'BOOKING_INVALID',
        title: 'Booking Status Invalid for Proforma Billing',
        message: `Booking #${booking.bookingReference} is currently marked as ${booking.status}.`,
        missingRequirements: ['Active or Confirmed booking status'],
        actionableInstruction: 'Proforma Invoices cannot be issued for cancelled or archived bookings.',
        bookingId: booking.id,
        actionType: 'GO_TO_BOOKING',
        referenceId
      }
    };
  }

  // 7. Known Currency Check (resolves from committed snapshot, booking, pricing, or service items)
  const resolvedCurrency = resolveBookingCurrencyForProforma(booking);
  if (!resolvedCurrency) {
    return {
      valid: false,
      booking,
      error: {
        code: 'CURRENCY_MISSING',
        title: 'Booking Currency Missing',
        message: `Booking #${booking.bookingReference} does not have a valid billing currency configured.`,
        missingRequirements: ['Authorized booking currency (e.g. INR, USD, EUR, JPY, GBP)'],
        actionableInstruction: 'Open Pricing, Discounts & Financials for this booking and configure the booking currency.',
        bookingId: booking.id,
        actionType: 'SET_CURRENCY',
        referenceId
      }
    };
  }

  // 8. Authoritative Committed Financial Snapshot / Final Booking Amount Check
  // Never invent or fabricate a booking amount if financial snapshot & selling prices are genuinely missing.
  const authoritative = resolveAuthoritativeProformaAmount(booking);
  const serviceItems = db.normalizeServiceItems(booking.items || [], booking);
  const summedItemSelling = serviceItems
    .filter(it => !it.isCancelled && it.operationalStatus !== 'Cancelled')
    .reduce((sum, it) => sum + Number(it.totalPrice || (it as any).sellingPrice || 0), 0);

  const effectiveFinalAmount =
    authoritative.finalBookingAmount > 0
      ? authoritative.finalBookingAmount
      : summedItemSelling > 0
      ? Math.round(summedItemSelling * 100) / 100
      : 0;

  if (!Number.isFinite(effectiveFinalAmount) || effectiveFinalAmount <= 0) {
    return {
      valid: false,
      booking,
      error: {
        code: 'FINANCIAL_SNAPSHOT_MISSING',
        title: 'Authoritative Booking Financial Amount Missing',
        message: `Booking #${booking.bookingReference} does not have a valid committed Final Booking Amount in its financial snapshot or service items.`,
        missingRequirements: [
          'Valid committed booking financial snapshot or non-zero customer selling price'
        ],
        actionableInstruction:
          'Open Pricing, Discounts & Financials or Service Items to verify and commit the booking selling price. Proforma Invoices never fabricate missing amounts.',
        bookingId: booking.id,
        actionType: 'EDIT_PRICING',
        referenceId
      }
    };
  }

  // Notice: Tax/GST registration, Tax Invoice numbering series, Tax Invoice approval,
  // and optional customer tax fields are INTENTIONALLY NOT checked for Proforma Invoices.
  return {
    valid: true,
    booking,
    resolvedCurrency,
    resolvedFinalBookingAmount: effectiveFinalAmount,
    resolvedSnapshotId: authoritative.sourcePricingSnapshotId
  };
}

/**
 * Separate, strict preflight validation for formal STATUTORY TAX INVOICES.
 * Preserves all tax compliance, GST registration, tax invoice numbering series,
 * issuance approval, and statutory customer billing checks without affecting Proforma Invoices.
 */
export function validateTaxInvoicePreflight(
  bookingId: string | undefined,
  user: User | null,
  options: TaxInvoicePreflightOptions = {},
  bookingOverride?: Booking | null
): ProformaPreflightResult {
  const referenceId = `TINV-CHK-${Date.now().toString(36).toUpperCase()}`;

  // Base checks (auth, booking existence, reference, status, currency, authoritative amount)
  const baseCheck = validateProformaInvoicePreflight(bookingId, user, bookingOverride);
  if (!baseCheck.valid || !baseCheck.booking || !user) {
    return baseCheck;
  }
  const booking = baseCheck.booking;

  // 1. Strict Finance / Admin Role Required for Statutory Tax Invoices
  const hasFinanceAuthority =
    isMasterAdmin(user) ||
    user.role === 'ADMIN' ||
    (user.role as string) === 'FINANCE' ||
    user.permissions?.canAccessFinancials === true ||
    user.permissions?.cmsFinance?.enabled === true;

  if (!hasFinanceAuthority) {
    return {
      valid: false,
      booking,
      error: {
        code: 'PERMISSION_DENIED',
        title: 'Finance Authorization Required for Tax Invoice',
        message: 'Issuing a formal statutory Tax Invoice requires Admin or Finance authorization.',
        missingRequirements: ['Admin or Finance billing permission'],
        actionableInstruction: 'Request Finance team approval to issue the formal Tax Invoice.',
        bookingId: booking.id,
        actionType: 'CONTACT_ADMIN',
        referenceId
      }
    };
  }

  // 2. Issuing Company Statutory GST / Tax Registration Check
  const db = AppDatabase.getInstance();
  const companyProfile = db.getCentralCompanyProfile();
  if (!companyProfile?.gstin || !companyProfile.gstin.trim()) {
    return {
      valid: false,
      booking,
      error: {
        code: 'TAX_REGISTRATION_MISSING',
        title: 'Company GST / Tax Registration Missing',
        message: 'A formal Tax Invoice cannot be issued without the issuing company GSTIN / Tax Registration configured in Central Company Profile.',
        missingRequirements: ['Issuing Company GSTIN / Tax Registration Number'],
        actionableInstruction: 'Configure the company GSTIN in Admin CMS → Company Profile before issuing a Tax Invoice.',
        bookingId: booking.id,
        actionType: 'CONTACT_ADMIN',
        referenceId
      }
    };
  }

  // 3. Statutory Tax Invoice Series Configuration Check
  if (options.taxInvoiceSeriesConfigured === false) {
    return {
      valid: false,
      booking,
      error: {
        code: 'TAX_SERIES_MISSING',
        title: 'Tax Invoice Numbering Series Not Configured',
        message: 'Statutory fiscal Tax Invoice numbering series must be configured before issuing Tax Invoices.',
        missingRequirements: ['Active Fiscal Year Tax Invoice Numbering Series'],
        actionableInstruction: 'Configure the statutory Tax Invoice series in Finance Settings.',
        bookingId: booking.id,
        actionType: 'CONTACT_ADMIN',
        referenceId
      }
    };
  }

  // 4. Tax Invoice Issuance Approval Gate
  if (options.taxInvoiceApproved === false) {
    return {
      valid: false,
      booking,
      error: {
        code: 'TAX_APPROVAL_REQUIRED',
        title: 'Tax Invoice Issuance Approval Required',
        message: `Formal Tax Invoice issuance for Booking #${booking.bookingReference} requires Finance approval.`,
        missingRequirements: ['Finance Tax Invoice Issuance Approval'],
        actionableInstruction: 'Obtain Finance sign-off prior to generating the statutory Tax Invoice.',
        bookingId: booking.id,
        actionType: 'CONTACT_ADMIN',
        referenceId
      }
    };
  }

  // 5. Mandatory Statutory Customer Billing Details (Name, Email, and optional Customer GSTIN)
  const missingTaxCustomerFields: string[] = [];
  const customerName =
    booking.customer?.leadTravelerName ||
    booking.customer?.bookerName ||
    booking.customer?.name ||
    (booking as any).guestName;
  const customerEmail = booking.customer?.email || (booking as any).guestEmail;
  const customerGstin = (booking.customer as any)?.gstin || (booking as any).gstin;

  if (!customerName || !customerName.trim() || customerName === 'Valued Client') {
    missingTaxCustomerFields.push('Customer / Entity Legal Name');
  }
  if (!customerEmail || !customerEmail.trim() || customerEmail === 'client@theunbound.com') {
    missingTaxCustomerFields.push('Customer Billing Email Address');
  }
  if (options.requireCustomerGstin && (!customerGstin || !String(customerGstin).trim())) {
    missingTaxCustomerFields.push('Customer GSTIN / Tax Registration Number');
  }

  if (missingTaxCustomerFields.length > 0) {
    return {
      valid: false,
      booking,
      error: {
        code: 'CUSTOMER_DETAILS_MISSING',
        title: 'Missing Mandatory Tax Invoice Customer Details',
        message: `Statutory Tax Invoice for Booking #${booking.bookingReference} requires complete customer billing fields.`,
        missingRequirements: missingTaxCustomerFields,
        actionableInstruction: 'Complete the customer legal billing profile before issuing a Tax Invoice.',
        bookingId: booking.id,
        leadId: booking.leadId,
        actionType: 'UPDATE_CUSTOMER',
        referenceId
      }
    };
  }

  return baseCheck;
}
