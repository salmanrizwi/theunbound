import { Quotation, User, TravelLead } from '../types';
import { AppDatabase } from './db';
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
}

// Universal emojis that render reliably across iOS, Android, Windows, Mac, Linux, and WhatsApp Web.
// Avoids variation selectors (\uFE0F) which break or render as  in certain browser engines and monospace fonts.
const E = {
  WAVE: '👋',
  SPARKLE: '✨',
  OVERVIEW: '📋',
  PIN: '📌',
  LOCATION: '📍',
  CALENDAR: '📅',
  DURATION: '⏳',
  PEOPLE: '👥',
  STAR: '⭐',
  HOTEL: '🏨',
  TOUR: '🎯',
  CAR: '🚗',
  FLIGHT: '✈️',
  SERVICES: '💼',
  PRICE: '💰',
  CASH: '💵',
  TIP: '💡',
  NOTES: '📝',
  HANDSHAKE: '🤝',
  USER: '👤',
  AGENCY: '🏢',
  PHONE: '📞'
};

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
 * Builds the dynamically generated WhatsApp message adhering strictly to TheUnbound template.
 * GUARANTEE: Never exposes internal costs, supplier rates, or commercial margins.
 */
export function generateWhatsAppQuoteMessage(options: GenerateWhatsAppMessageOptions): string {
  const sanitized: CustomerSanitizedQuote = sanitizeQuoteForCustomer(
    options.quote,
    options.selectedOptionIndexOrId,
    options.senderBranding
  );

  const DIVIDER = '------------------------';
  const sections: string[] = [];
  const withEmojis = options.useEmojis !== false;

  const e = withEmojis ? E : {
    WAVE: '',
    SPARKLE: '',
    OVERVIEW: '•',
    PIN: '•',
    LOCATION: '•',
    CALENDAR: '•',
    DURATION: '•',
    PEOPLE: '•',
    STAR: '•',
    HOTEL: '•',
    TOUR: '•',
    CAR: '•',
    FLIGHT: '•',
    SERVICES: '•',
    PRICE: '•',
    CASH: '•',
    TIP: '•',
    NOTES: '•',
    HANDSHAKE: '',
    USER: '•',
    AGENCY: '•',
    PHONE: '•'
  };

  // 1. Salutation & Greeting Section
  const senderEntity = sanitized.senderAgency || sanitized.senderName || 'TheUnbound';
  const greetingLines = [
    `${e.WAVE ? e.WAVE + ' ' : ''}*Hello ${sanitized.clientName},*`,
    `Greetings from *${senderEntity}*!${e.SPARKLE ? ' ' + e.SPARKLE : ''}`,
    `We are pleased to present your customized travel quotation below:`
  ];
  sections.push(greetingLines.join('\n\n'));

  // 2. Trip Overview Section
  const overviewLines = [
    `${e.OVERVIEW} *TRIP OVERVIEW*`,
    `${e.PIN} *Quote ID:* ${sanitized.quoteId}`,
    `${e.LOCATION} *Destination:* ${sanitized.destinationSummary}`,
    `${e.CALENDAR} *Travel Dates:* ${sanitized.travelDates}`,
    `${e.DURATION} *Duration:* ${sanitized.tripDuration}`,
    `${e.PEOPLE} *Travellers:* ${sanitized.passengerSummary}`
  ];
  if (sanitized.selectedOptionTitle) {
    overviewLines.push(`${e.STAR} *Package Option:* ${sanitized.selectedOptionTitle}`);
  }
  sections.push(overviewLines.join('\n'));

  // 3. Inclusions & Itinerary Highlights Section
  const inclusionBlocks: string[] = [];

  if (sanitized.hotelsSummary.length > 0) {
    const displayHotels = sanitized.hotelsSummary.slice(0, 4);
    let hotelText = displayHotels.join('\n  • ');
    if (sanitized.hotelsSummary.length > 4) {
      hotelText += `\n  • (+${sanitized.hotelsSummary.length - 4} more curated stay${sanitized.hotelsSummary.length - 4 > 1 ? 's' : ''})`;
    }
    inclusionBlocks.push(`${e.HOTEL} *Accommodation & Stays:*\n  • ${hotelText}`);
  }

  if (sanitized.experiencesSummary.length > 0) {
    const displayExp = sanitized.experiencesSummary.slice(0, 5);
    let expText = displayExp.join('\n  • ');
    if (sanitized.experiencesSummary.length > 5) {
      expText += `\n  • (+${sanitized.experiencesSummary.length - 5} additional tours)`;
    }
    inclusionBlocks.push(`${e.TOUR} *Experiences & Sightseeing:*\n  • ${expText}`);
  }

  if (sanitized.transfersSummary.length > 0) {
    const displayTransfers = sanitized.transfersSummary.slice(0, 4);
    let transText = displayTransfers.join('\n  • ');
    if (sanitized.transfersSummary.length > 4) {
      transText += `\n  • (+${sanitized.transfersSummary.length - 4} more transfers)`;
    }
    inclusionBlocks.push(`${e.CAR} *Transfers & Transport:*\n  • ${transText}`);
  }

  if (sanitized.visaSummary) {
    inclusionBlocks.push(`${e.FLIGHT} *Visa Facilitation:*\n  • ${sanitized.visaSummary}`);
  }

  if (sanitized.otherServicesSummary.length > 0) {
    inclusionBlocks.push(`${e.SERVICES} *Travel Services & Add-ons:*\n  • ${sanitized.otherServicesSummary.slice(0, 4).join('\n  • ')}`);
  }

  if (inclusionBlocks.length > 0) {
    sections.push(`${e.SPARKLE} *PACKAGE HIGHLIGHTS & INCLUSIONS*\n\n${inclusionBlocks.join('\n\n')}`);
  }

  // 4. Total Package Investment / Pricing Section
  const pricingLines: string[] = [
    `${e.PRICE} *PACKAGE INVESTMENT*`,
    `${e.CASH} *Total Price:* *${sanitized.formattedSellingPrice}*`,
    `${e.TIP} _(All taxes, planned activities & stays included)_`
  ];
  if (sanitized.validUntil) {
    pricingLines.push(`${e.DURATION} *Quotation Valid Until:* ${sanitized.validUntil}`);
  }
  sections.push(pricingLines.join('\n'));

  // 5. Special Notes & Remarks (if provided)
  if (options.customNote && options.customNote.trim()) {
    sections.push(`${e.NOTES} *SPECIAL NOTES & REMARKS*\n${options.customNote.trim()}`);
  }

  // 6. Sign-off & Contact Section
  const closingLines = [
    `${e.HANDSHAKE ? e.HANDSHAKE + ' ' : ''}*ASSISTANCE & CUSTOMIZATION*`,
    'We would be delighted to customize any portion of this journey according to your preferences.\n',
    'Warm regards,',
    `${e.USER} *${sanitized.senderName}*`
  ];
  if (sanitized.senderAgency && sanitized.senderAgency !== sanitized.senderName) {
    closingLines.push(`${e.AGENCY} ${sanitized.senderAgency}`);
  }
  if (sanitized.senderContact) {
    closingLines.push(`${e.PHONE} ${sanitized.senderContact}`);
  }
  sections.push(closingLines.join('\n'));

  // Join all sections using the requested divider
  const fullMessage = sections.join(`\n\n${DIVIDER}\n\n`);

  // Double-check security
  const leakCheck = verifyNoCommercialLeak(fullMessage);
  if (!leakCheck.isSafe) {
    console.error('SECURITY WARNING: Leaked commercial terms detected in WhatsApp quote message:', leakCheck.detectedTerms);
    // Remove leaked terms defensively if any slipped through
    return fullMessage.replace(new RegExp(`\\b(${leakCheck.detectedTerms.join('|')})\\b`, 'gi'), '');
  }

  return fullMessage;
}

/**
 * Builds the official WhatsApp wa.me deep link URL
 */
export function generateWhatsAppShareUrl(phoneNumber: string, message: string): string {
  const cleanPhone = normalizePhoneNumber(phoneNumber);
  const encodedText = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedText}`;
}

/**
 * Audits, links CRM lead, records activity logs, and synchronizes database upon WhatsApp share
 */
export function recordWhatsAppQuoteShare(
  db: AppDatabase,
  quote: Quotation,
  options: RecordWhatsAppShareOptions
): { updatedQuote: Quotation; lead?: TravelLead } {
  const timestamp = new Date().toISOString();
  const maskedPhone = maskPhoneNumber(options.recipientPhone);
  const userName = options.user?.name || options.quote.agentName || 'Travel Consultant';
  const userRole = options.user?.role || 'B2B_AGENT';

  // 1. Prepare updated Quotation activity record
  const optionDetail = options.selectedOptionTitle ? ` [Option: ${options.selectedOptionTitle}]` : '';
  const shareDetails = `Shared quotation proposal via WhatsApp to ${maskedPhone}${optionDetail}. Total: ${quote.currency} ${quote.totalSellingPrice}. Status: Initiated.`;

  const updatedQuote: Quotation = {
    ...quote,
    clientPhone: options.savePhoneToCustomerProfile ? (options.recipientPhone || quote.clientPhone) : quote.clientPhone,
    updatedAt: timestamp,
    lastActivityAt: timestamp
  };

  // Save the quote with the WHATSAPP_SHARED action type
  const savedQuote = db.saveQuote(updatedQuote, options.user, 'WHATSAPP_SHARED', shareDetails);

  // 2. Audit Trail logging
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
    existingLead = allLeads.find(l => l.email.toLowerCase() === quote.clientEmail!.toLowerCase());
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
    // Automatically create a new CRM lead with unique 6-character ID format (e.g., A7K92P)
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
      destinationId: quote.destination.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      destinationName: quote.destination,
      travelStartDate: quote.travelStartDate,
      travelEndDate: quote.travelEndDate,
      travelDates: quote.travelStartDate && quote.travelEndDate ? `${quote.travelStartDate} to ${quote.travelEndDate}` : 'Flexible',
      paxAdults: quote.adultsCount || 2,
      paxChildren: quote.childrenCount || 0,
      paxInfants: quote.infantsCount || 0,
      totalPassengers: quote.totalPax || 2,
      travelRequirements: quote.agentNotes || quote.title,
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

    // Attach lead ID back to quote if it was missing
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
