import { AppDatabase } from './db';
import { Booking, User, BookingInvoice } from '../types';

export type ProformaErrorCode =
  | 'BOOKING_NOT_FOUND'
  | 'BOOKING_INVALID'
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
  error?: ProformaPreflightError;
}

/**
 * Performs authoritative preflight validation before attempting Proforma Invoice generation.
 * Guarantees NO SILENT FAILURES.
 */
export function validateProformaInvoicePreflight(
  bookingId: string | undefined,
  user: User | null
): ProformaPreflightResult {
  const referenceId = `INV-ERR-${Date.now().toString(36).toUpperCase()}`;

  // 1. Authentication Check
  if (!user) {
    return {
      valid: false,
      error: {
        code: 'AUTHENTICATION_REQUIRED',
        title: 'Authentication Required',
        message: 'Your active session has expired or is unauthenticated.',
        missingRequirements: ['Active authenticated user session'],
        actionableInstruction: 'Please sign in again to continue with invoice generation.',
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
        message: 'No operational booking reference was provided for invoice generation.',
        missingRequirements: ['Valid Booking Reference / ID'],
        actionableInstruction: 'Please select an active operational booking from the list.',
        referenceId
      }
    };
  }

  const db = AppDatabase.getInstance();
  const booking = db.getBookingById(bookingId);

  // 3. Booking Existence Check
  if (!booking) {
    return {
      valid: false,
      error: {
        code: 'BOOKING_NOT_FOUND',
        title: 'Booking Record Not Found',
        message: `The requested booking record #${bookingId} could not be located in the database.`,
        missingRequirements: [`Active booking document matching ID ${bookingId}`],
        actionableInstruction: 'Please verify the booking ID or create a new booking record.',
        referenceId
      }
    };
  }

  // 4. Booking Status Validity
  if (booking.status === 'CANCELLED' || (booking.status as string) === 'ARCHIVED') {
    return {
      valid: false,
      error: {
        code: 'BOOKING_INVALID',
        title: 'Booking Status Invalid for Billing',
        message: `Booking #${booking.bookingReference} is currently marked as ${booking.status}.`,
        missingRequirements: ['Active or Confirmed booking status'],
        actionableInstruction: 'Invoices cannot be issued for cancelled or archived bookings.',
        bookingId: booking.id,
        actionType: 'GO_TO_BOOKING',
        referenceId
      }
    };
  }

  // 5. Customer & Billing Details Check
  const missingCustomerFields: string[] = [];
  const customerName = booking.customer?.leadTravelerName || booking.customer?.bookerName || booking.customer?.name || (booking as any).guestName;
  const customerEmail = booking.customer?.email || (booking as any).guestEmail;

  if (!customerName || customerName.trim().length === 0 || customerName === 'Valued Client') {
    missingCustomerFields.push('Customer / Traveler Full Name');
  }
  if (!customerEmail || customerEmail.trim().length === 0 || customerEmail === 'client@theunbound.com') {
    missingCustomerFields.push('Customer Billing Email Address');
  }

  if (missingCustomerFields.length > 0) {
    return {
      valid: false,
      booking,
      error: {
        code: 'CUSTOMER_DETAILS_MISSING',
        title: 'Missing Customer Billing Information',
        message: `Proforma Invoice cannot be issued for Booking #${booking.bookingReference} because customer details are incomplete.`,
        missingRequirements: missingCustomerFields,
        actionableInstruction: 'Please update the traveler profile with the full name and billing email address.',
        bookingId: booking.id,
        leadId: booking.leadId,
        actionType: 'UPDATE_CUSTOMER',
        referenceId
      }
    };
  }

  // 6. Currency Check
  if (!booking.currency || !booking.currency.trim()) {
    return {
      valid: false,
      booking,
      error: {
        code: 'CURRENCY_MISSING',
        title: 'Invoice Currency Missing',
        message: `Booking #${booking.bookingReference} does not have an authorized billing currency configured.`,
        missingRequirements: ['Authorized billing currency (e.g. USD, EUR, JPY, GBP, AUD)'],
        actionableInstruction: 'Please edit the booking financial settings and set the active currency.',
        bookingId: booking.id,
        actionType: 'SET_CURRENCY',
        referenceId
      }
    };
  }

  // 7. Billable Service Items Check
  const serviceItems = db.normalizeServiceItems(booking.items || [], booking);
  const totalAmount = booking.totalAmount || (booking as any).pricing?.totalPrice || 0;

  if (serviceItems.length === 0 && totalAmount <= 0) {
    return {
      valid: false,
      booking,
      error: {
        code: 'BILLABLE_SERVICE_MISSING',
        title: 'No Billable Service Items Found',
        message: `Booking #${booking.bookingReference} contains no confirmed billable services or package items.`,
        missingRequirements: ['At least one billable service item or non-zero package pricing'],
        actionableInstruction: 'Please attach products, hotel stays, transfers, or visa services to the booking before generating an invoice.',
        bookingId: booking.id,
        actionType: 'GO_TO_BOOKING',
        referenceId
      }
    };
  }

  // 8. Price Validity Check
  const itemsWithoutPrice = serviceItems.filter(it => !it.totalPrice || it.totalPrice <= 0);
  if (serviceItems.length > 0 && totalAmount <= 0 && itemsWithoutPrice.length === serviceItems.length) {
    return {
      valid: false,
      booking,
      error: {
        code: 'PRICE_MISSING',
        title: 'Invalid or Missing Commercial Pricing',
        message: `One or more service items in Booking #${booking.bookingReference} do not have valid customer-facing selling prices.`,
        missingRequirements: ['Valid non-zero price snapshot for billable services'],
        actionableInstruction: 'Please review and confirm service item pricing before generating the Proforma Invoice.',
        bookingId: booking.id,
        actionType: 'EDIT_PRICING',
        referenceId
      }
    };
  }

  // All preflight checks passed!
  return {
    valid: true,
    booking
  };
}
