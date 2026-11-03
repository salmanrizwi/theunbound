/**
 * ============================================================================
 * AUTHORITATIVE COMMERCIAL QUOTATION TERMS — SINGLE SOURCE OF TRUTH
 * ============================================================================
 *
 * Used across all 9 quotation outputs:
 * 1. B2B Quote Builder
 * 2. Quote Preview
 * 3. Final generated quotation
 * 4. Standard Quote PDF
 * 5. Standard Quote Email (HTML & Plain Text)
 * 6. WhatsApp quotation message
 * 7. White-Label PDF
 * 8. White-Label Email (HTML & Plain Text)
 * 9. White-Label WhatsApp message
 */

export interface CommercialQuotationTermItem {
  number: number;
  /** Exact numbered heading, e.g. "1. Booking Status:" */
  heading: string;
  /** Body text following the numbered heading */
  body: string;
  /** Combined plain text: "1. Booking Status: No services..." */
  plainText: string;
  /** Combined markdown text: "**1. Booking Status:** No services..." */
  markdownText: string;
  /** Combined WhatsApp text: "*1. Booking Status:* No services..." */
  whatsAppText: string;
  /** Combined HTML paragraph with bold heading and page-break protection */
  htmlText: string;
}

export const COMMERCIAL_QUOTATION_TERMS_HEADING = 'Commercial Quotation Terms';

export const COMMERCIAL_QUOTATION_TERMS_ITEMS: readonly CommercialQuotationTermItem[] = [
  {
    number: 1,
    heading: '1. Booking Status:',
    body: 'No services or reservations are currently on hold or confirmed. All arrangements are subject to availability at the time of booking.',
    plainText:
      '1. Booking Status: No services or reservations are currently on hold or confirmed. All arrangements are subject to availability at the time of booking.',
    markdownText:
      '**1. Booking Status:** No services or reservations are currently on hold or confirmed. All arrangements are subject to availability at the time of booking.',
    whatsAppText:
      '*1. Booking Status:* No services or reservations are currently on hold or confirmed. All arrangements are subject to availability at the time of booking.',
    htmlText:
      '<p style="margin: 0 0 6px 0; line-height: 1.45; color: #475569; page-break-inside: avoid; break-inside: avoid;"><strong style="color: #0f172a; font-weight: 800;">1. Booking Status:</strong> No services or reservations are currently on hold or confirmed. All arrangements are subject to availability at the time of booking.</p>'
  },
  {
    number: 2,
    heading: '2. Hotel Pricing & Availability:',
    body: 'Hotel rates and availability are dynamic and may change without prior notice. The final hotel price will be reconfirmed at the time of booking confirmation.',
    plainText:
      '2. Hotel Pricing & Availability: Hotel rates and availability are dynamic and may change without prior notice. The final hotel price will be reconfirmed at the time of booking confirmation.',
    markdownText:
      '**2. Hotel Pricing & Availability:** Hotel rates and availability are dynamic and may change without prior notice. The final hotel price will be reconfirmed at the time of booking confirmation.',
    whatsAppText:
      '*2. Hotel Pricing & Availability:* Hotel rates and availability are dynamic and may change without prior notice. The final hotel price will be reconfirmed at the time of booking confirmation.',
    htmlText:
      '<p style="margin: 0 0 6px 0; line-height: 1.45; color: #475569; page-break-inside: avoid; break-inside: avoid;"><strong style="color: #0f172a; font-weight: 800;">2. Hotel Pricing &amp; Availability:</strong> Hotel rates and availability are dynamic and may change without prior notice. The final hotel price will be reconfirmed at the time of booking confirmation.</p>'
  },
  {
    number: 3,
    heading: '3. Land Package Validity:',
    body: 'The quoted land package price remains valid, subject to any revisions in activity or service prices by the respective suppliers.',
    plainText:
      '3. Land Package Validity: The quoted land package price remains valid, subject to any revisions in activity or service prices by the respective suppliers.',
    markdownText:
      '**3. Land Package Validity:** The quoted land package price remains valid, subject to any revisions in activity or service prices by the respective suppliers.',
    whatsAppText:
      '*3. Land Package Validity:* The quoted land package price remains valid, subject to any revisions in activity or service prices by the respective suppliers.',
    htmlText:
      '<p style="margin: 0 0 6px 0; line-height: 1.45; color: #475569; page-break-inside: avoid; break-inside: avoid;"><strong style="color: #0f172a; font-weight: 800;">3. Land Package Validity:</strong> The quoted land package price remains valid, subject to any revisions in activity or service prices by the respective suppliers.</p>'
  },
  {
    number: 4,
    heading: '4. Booking Deposit:',
    body: 'An advance payment of 30% of the total package cost is required to initiate and secure the reservation. Confirmation is subject to receipt of the deposit and supplier availability.',
    plainText:
      '4. Booking Deposit: An advance payment of 30% of the total package cost is required to initiate and secure the reservation. Confirmation is subject to receipt of the deposit and supplier availability.',
    markdownText:
      '**4. Booking Deposit:** An advance payment of 30% of the total package cost is required to initiate and secure the reservation. Confirmation is subject to receipt of the deposit and supplier availability.',
    whatsAppText:
      '*4. Booking Deposit:* An advance payment of 30% of the total package cost is required to initiate and secure the reservation. Confirmation is subject to receipt of the deposit and supplier availability.',
    htmlText:
      '<p style="margin: 0; line-height: 1.45; color: #475569; page-break-inside: avoid; break-inside: avoid;"><strong style="color: #0f172a; font-weight: 800;">4. Booking Deposit:</strong> An advance payment of 30% of the total package cost is required to initiate and secure the reservation. Confirmation is subject to receipt of the deposit and supplier availability.</p>'
  }
] as const;

/**
 * Authoritative Plain-Text representation of all 4 Commercial Quotation Terms
 */
export const COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT: string = COMMERCIAL_QUOTATION_TERMS_ITEMS
  .map(item => item.plainText)
  .join('\n\n');

/**
 * Authoritative Markdown representation of all 4 Commercial Quotation Terms
 */
export const COMMERCIAL_QUOTATION_TERMS_MARKDOWN: string = COMMERCIAL_QUOTATION_TERMS_ITEMS
  .map(item => item.markdownText)
  .join('\n\n');

/**
 * Authoritative WhatsApp representation of all 4 Commercial Quotation Terms
 */
export const COMMERCIAL_QUOTATION_TERMS_WHATSAPP: string = COMMERCIAL_QUOTATION_TERMS_ITEMS
  .map(item => item.whatsAppText)
  .join('\n\n');

/**
 * Authoritative HTML representation of all 4 Commercial Quotation Terms (for PDF & HTML Email)
 */
export const COMMERCIAL_QUOTATION_TERMS_HTML: string = COMMERCIAL_QUOTATION_TERMS_ITEMS
  .map(item => item.htmlText)
  .join('');

/**
 * Detects whether a string is one of the outdated/legacy hardcoded boilerplate term strings
 * or matches the authoritative 4-term block.
 */
export function isLegacyOrDefaultCommercialTerms(text?: string | null): boolean {
  if (!text || !text.trim()) return true;
  const normalized = text.trim().toLowerCase();

  if (
    normalized.includes('1. booking status:') &&
    normalized.includes('2. hotel pricing & availability:') &&
    normalized.includes('3. land package validity:') &&
    normalized.includes('4. booking deposit:')
  ) {
    return true;
  }

  // Legacy hardcoded boilerplate strings to replace
  if (
    normalized.includes('14 days') ||
    normalized.includes('14 calendar days') ||
    normalized.includes('20% deposit') ||
    normalized.includes('20% refundable deposit') ||
    normalized.includes('all rates are confidential and subject to availability') ||
    normalized.includes('all wholesale rates are confidential and valid for licensed travel partners') ||
    normalized.includes('this quotation is issued by')
  ) {
    return true;
  }

  return false;
}

/**
 * Resolves the Commercial Quotation Terms for a given quotation.
 * - For all new, draft, revised, or active quotations (or any quote carrying legacy boilerplate),
 *   returns the authoritative 4 Commercial Quotation Terms.
 * - If an immutable locked/finalized historical quotation has a custom non-legacy historical snapshot,
 *   preserves that custom snapshot unless it is being revised/regenerated.
 */
export function resolveAuthoritativeCommercialTerms(quote?: {
  termsAndConditions?: string;
  isLocked?: boolean;
  status?: string;
  brandingSnapshot?: { disclaimer?: string };
} | null): {
  heading: string;
  items: readonly CommercialQuotationTermItem[];
  plainText: string;
  markdownText: string;
  whatsAppText: string;
  htmlText: string;
  isCustomHistoricalSnapshot: boolean;
} {
  const rawTerms = quote?.termsAndConditions || quote?.brandingSnapshot?.disclaimer || '';
  const isFinalizedLocked = Boolean(
    quote?.isLocked &&
    (quote?.status === 'ISSUED' || quote?.status === 'ACCEPTED' || quote?.status === 'CONVERTED')
  );

  if (isFinalizedLocked && rawTerms.trim() && !isLegacyOrDefaultCommercialTerms(rawTerms)) {
    const cleanRaw = rawTerms.trim();
    return {
      heading: COMMERCIAL_QUOTATION_TERMS_HEADING,
      items: COMMERCIAL_QUOTATION_TERMS_ITEMS,
      plainText: cleanRaw,
      markdownText: cleanRaw,
      whatsAppText: cleanRaw,
      htmlText: `<p style="margin: 0; line-height: 1.45; color: #475569;">${cleanRaw}</p>`,
      isCustomHistoricalSnapshot: true
    };
  }

  return {
    heading: COMMERCIAL_QUOTATION_TERMS_HEADING,
    items: COMMERCIAL_QUOTATION_TERMS_ITEMS,
    plainText: COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT,
    markdownText: COMMERCIAL_QUOTATION_TERMS_MARKDOWN,
    whatsAppText: COMMERCIAL_QUOTATION_TERMS_WHATSAPP,
    htmlText: COMMERCIAL_QUOTATION_TERMS_HTML,
    isCustomHistoricalSnapshot: false
  };
}
