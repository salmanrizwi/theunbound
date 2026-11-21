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

import type { DestinationTermsSection, QuotationCommercialTermsSnapshot } from '../types';
import { richTextToPlainText, richTextToWhatsApp } from '../utils/richTextFormatter';

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
 * Full 16-Section Commercial Quotation Terms Initial Reusable Template
 * Used when configuring or cloning destination-specific terms in Admin CMS.
 * Each destination receives an independent copy that Admin can freely edit, reorder, activate/deactivate, or delete.
 */
export interface InitialCommercialTermsTemplateSection {
  sectionNumber: number;
  sectionId: string;
  heading: string;
  description: string;
  htmlContent: string;
  displayOrder: number;
  isActive: boolean;
}

export const COMMERCIAL_QUOTATION_TERMS_16_TEMPLATE_SECTIONS: readonly InitialCommercialTermsTemplateSection[] = [
  {
    sectionNumber: 1,
    sectionId: 'sec-01-booking-status',
    heading: '1. Booking Status & Availability',
    description: 'Tentative quotation status prior to confirmed reservations.',
    htmlContent:
      '<p>No services, hotel rooms, rail tickets, or ground arrangements are currently on hold or confirmed under this quotation. All arrangements remain strictly subject to real-time supplier availability at the time of written booking confirmation and deposit receipt.</p>',
    displayOrder: 1,
    isActive: true
  },
  {
    sectionNumber: 2,
    sectionId: 'sec-02-hotel-pricing',
    heading: '2. Hotel Pricing & Dynamic Availability',
    description: 'Dynamic room inventory pricing and reconfirmation prior to booking.',
    htmlContent:
      '<p>Hotel room tariffs, promotional allocations, and bed-type availability are dynamic and subject to fluctuation without prior notice. Final hotel pricing and room category allocations will be reconfirmed at the time of firm booking confirmation and supplier ticketing.</p>',
    displayOrder: 2,
    isActive: true
  },
  {
    sectionNumber: 3,
    sectionId: 'sec-03-land-validity',
    heading: '3. Land Package & Excursion Validity',
    description: 'Validity of quoted ground services, guides, and attraction entrances.',
    htmlContent:
      '<p>The quoted land package price remains valid for the specified travel dates and passenger count, subject to any revisions in entrance tickets, local guides, transport fuel surcharges, or third-party excursion tariffs imposed by the respective local suppliers.</p>',
    displayOrder: 3,
    isActive: true
  },
  {
    sectionNumber: 4,
    sectionId: 'sec-04-booking-deposit',
    heading: '4. Booking Deposit & Payment Schedule',
    description: 'Advance deposit requirement and payment milestones.',
    htmlContent:
      '<p>An advance payment of <strong>30% of the total package cost</strong> (or 100% for non-refundable rail passes, special event tickets, and peak-season hotel blocks) is required to initiate and secure the reservation. Confirmation is strictly subject to receipt of cleared funds and supplier availability.</p>',
    displayOrder: 4,
    isActive: true
  },
  {
    sectionNumber: 5,
    sectionId: 'sec-05-balance-payment',
    heading: '5. Balance Settlement & Cut-Off Deadlines',
    description: 'Final balance remittance timelines prior to arrival.',
    htmlContent:
      '<p>Full balance payment must be remitted at least <strong>30 calendar days prior to passenger arrival</strong> (or 45 days prior during peak cherry blossom, autumn foliage, festive, or major exhibition periods). Failure to remit balance payment by the due date may result in automatic release of held rooms and services with applicable cancellation charges.</p>',
    displayOrder: 5,
    isActive: true
  },
  {
    sectionNumber: 6,
    sectionId: 'sec-06-cancellation-amendment',
    heading: '6. Cancellation & Amendment Policy',
    description: 'Standard tiered cancellation schedule and revision fees.',
    htmlContent:
      '<ul><li><strong>More than 35 days prior to arrival:</strong> Deposit non-refundable where non-refundable rail/tickets apply; supplier cancellation charges at actuals.</li><li><strong>34 to 15 days prior to arrival:</strong> 50% of total ground &amp; hotel value or actual supplier penalty, whichever is higher.</li><li><strong>14 days or less prior to arrival / No-Show:</strong> 100% cancellation charge applies.</li></ul><p>Post-confirmation date or name changes are treated as amendments and are subject to supplier approval and re-pricing.</p>',
    displayOrder: 6,
    isActive: true
  },
  {
    sectionNumber: 7,
    sectionId: 'sec-07-no-show-early-departure',
    heading: '7. No-Show & Early Departure Policy',
    description: 'Non-utilization of confirmed services or unutilized nights.',
    htmlContent:
      '<p>No refunds or credits shall be issued for unutilized hotel nights, missed transfers, skipped sightseeing tours, rail segments, or early check-outs once travel has commenced.</p>',
    displayOrder: 7,
    isActive: true
  },
  {
    sectionNumber: 8,
    sectionId: 'sec-08-child-extra-bed',
    heading: '8. Child, Infant & Extra Bed Policy',
    description: 'Age brackets, CNB/CWB definitions, and attraction gate charges.',
    htmlContent:
      '<p>Infants below 2 years travel free unless charged directly by transport or hotel suppliers. Children aged 2 to below 5 years are booked as Child No Bed (CNB); children aged 5 to below 11 years as Child With Bed (CWB); and guests aged 11 years and above at adult rates. Attraction gate rules based on height or age remain payable on-site if applicable.</p>',
    displayOrder: 8,
    isActive: true
  },
  {
    sectionNumber: 9,
    sectionId: 'sec-09-checkin-city-tax',
    heading: '9. Check-In / Check-Out & Local Accommodation Taxes',
    description: 'Standard hotel check-in timings and mandatory municipal/city taxes.',
    htmlContent:
      '<p>Standard hotel check-in is from 15:00 hrs and check-out is before 11:00 hrs. Early check-in and late check-out are subject to room availability and supplemental charges. Local municipal accommodation taxes, hot spring (onsen) bathing taxes, or resort fees where mandated locally must be settled directly unless explicitly marked as included.</p>',
    displayOrder: 9,
    isActive: true
  },
  {
    sectionNumber: 10,
    sectionId: 'sec-10-transfers-luggage',
    heading: '10. Private Transfers, Luggage & Waiting Time',
    description: 'Airport/station waiting grace periods and vehicle luggage limits.',
    htmlContent:
      '<p>Airport arrival transfers include <strong>60 minutes</strong> of complimentary waiting time post-flight landing; point-to-point city transfers and hotel pickups include <strong>15 minutes</strong>. Vehicles are strictly allocated per passenger and standard suitcase allowance; oversized luggage (ski bags, golf bags, extra trunks) must be declared prior to confirmation.</p>',
    displayOrder: 10,
    isActive: true
  },
  {
    sectionNumber: 11,
    sectionId: 'sec-11-rail-ferry-domestic',
    heading: '11. Rail, Ferry & Domestic Transport Conditions',
    description: 'Ticketing issuance, seat reservations, and baggage rules.',
    htmlContent:
      '<p>High-speed rail tickets, regional passes, and ferry crossings are non-transferable and subject to carrier luggage dimension rules. Oversized baggage seat reservations, when required by the rail operator, are subject to seat availability at ticketing.</p>',
    displayOrder: 11,
    isActive: true
  },
  {
    sectionNumber: 12,
    sectionId: 'sec-12-force-majeure',
    heading: '12. Force Majeure & Schedule Disruptions',
    description: 'Weather events, strikes, closures, and itinerary adjustments.',
    htmlContent:
      '<p>Neither the destination operator nor its partner suppliers shall be liable for delays, cancellations, or itinerary adjustments caused by weather events, natural disasters, volcanic activity, civil unrest, transport strikes, or government advisories. Alternative routing costs will be borne by the traveler at actuals.</p>',
    displayOrder: 12,
    isActive: true
  },
  {
    sectionNumber: 13,
    sectionId: 'sec-13-visa-insurance',
    heading: '13. Visas, Passports & Travel Insurance',
    description: 'Entry documentation validity and comprehensive coverage recommendation.',
    htmlContent:
      '<p>All travelers must hold a passport valid for at least <strong>6 months beyond the return travel date</strong> with sufficient blank pages and valid entry visas prior to departure. Comprehensive medical, evacuation, and trip-cancellation insurance is strongly recommended for every booking.</p>',
    displayOrder: 13,
    isActive: true
  },
  {
    sectionNumber: 14,
    sectionId: 'sec-14-pricing-fx-taxes',
    heading: '14. Pricing, Taxes & Foreign Exchange Fluctuations',
    description: 'Currency conversion lock-in and statutory tax adjustments.',
    htmlContent:
      '<p>Quoted rates reflect prevailing supplier net tariffs, statutory VAT/GST/consumption taxes, and contracted exchange rates at quotation issuance. Any statutory tax revision or extreme currency fluctuation (&gt;3%) prior to full payment receipt may require re-calculation of unpaid balances.</p>',
    displayOrder: 14,
    isActive: true
  },
  {
    sectionNumber: 15,
    sectionId: 'sec-15-supplier-substitution',
    heading: '15. Service Quality & Equivalent Supplier Substitution',
    description: 'Right to provide equivalent-standard hotels or vehicles.',
    htmlContent:
      '<p>In the rare event of unforeseen operational closures or supplier maintenance, comparable alternatives of equivalent standard and location category will be arranged in consultation with the travel partner to preserve itinerary continuity.</p>',
    displayOrder: 15,
    isActive: true
  },
  {
    sectionNumber: 16,
    sectionId: 'sec-16-confidentiality-law',
    heading: '16. Commercial Confidentiality & Governing Terms',
    description: 'Protection of B2B wholesale rates and dispute resolution.',
    htmlContent:
      '<p>All B2B wholesale cost structures and supplier rate cards remain strictly confidential between the issuing agency and its destination partner. Upon deposit payment or written instruction to proceed, the booking party acknowledges acceptance of these destination commercial quotation terms.</p>',
    displayOrder: 16,
    isActive: true
  }
] as const;

export function buildInitial16SectionsClone(): DestinationTermsSection[] {
  const now = new Date().toISOString();
  return COMMERCIAL_QUOTATION_TERMS_16_TEMPLATE_SECTIONS.map((s) => ({
    sectionId: `${s.sectionId}-${Math.random().toString(36).slice(2, 6)}`,
    heading: s.heading,
    description: s.description,
    htmlContent: s.htmlContent,
    displayOrder: s.displayOrder,
    isActive: s.isActive,
    createdAt: now,
    updatedAt: now
  }));
}

export function renderDestinationSectionsToHtml(sections: DestinationTermsSection[]): string {
  const active = [...sections]
    .filter((s) => s.isActive !== false && (s.heading.trim() || s.htmlContent.trim()))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return active
    .map((s) => {
      const headingHtml = s.heading
        ? `<div style="font-weight: 800; color: #0f172a; margin: 6px 0 3px 0; font-size: 10.5px;">${s.heading}</div>`
        : '';
      const bodyHtml = s.htmlContent || '';
      return `<div style="margin: 0 0 8px 0; page-break-inside: avoid; break-inside: avoid; color: #475569; line-height: 1.45;">${headingHtml}${bodyHtml}</div>`;
    })
    .join('');
}

export function renderDestinationSectionsToPlainText(sections: DestinationTermsSection[]): string {
  const active = [...sections]
    .filter((s) => s.isActive !== false && (s.heading.trim() || s.htmlContent.trim()))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return active
    .map((s) => {
      const body = richTextToPlainText(s.htmlContent || '');
      if (s.heading && body) return `${s.heading}\n${body}`;
      return s.heading || body;
    })
    .filter(Boolean)
    .join('\n\n');
}

export function renderDestinationSectionsToWhatsApp(sections: DestinationTermsSection[]): string {
  const active = [...sections]
    .filter((s) => s.isActive !== false && (s.heading.trim() || s.htmlContent.trim()))
    .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

  return active
    .map((s) => {
      const body = richTextToWhatsApp(s.htmlContent || '');
      if (s.heading && body) return `*${s.heading.trim()}*\n${body}`;
      return s.heading ? `*${s.heading.trim()}*` : body;
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Resolves the Commercial Quotation Terms for a given quotation.
 * - If the quotation carries a Destination-Wise `commercialTermsSnapshot` (with resolved entries
 *   or an approved empty/exception state), returns those authoritative destination-specific terms.
 * - For legacy/pre-existing or minimal unit-test quotations without `commercialTermsSnapshot`:
 *   preserves full backward compatibility with `COMMERCIAL_QUOTATION_TERMS_ITEMS` / custom historical snapshot.
 */
export function resolveAuthoritativeCommercialTerms(quote?: {
  termsAndConditions?: string;
  isLocked?: boolean;
  status?: string;
  termsStatus?: string;
  brandingSnapshot?: { disclaimer?: string };
  commercialTermsSnapshot?: QuotationCommercialTermsSnapshot;
} | null): {
  heading: string;
  items: readonly CommercialQuotationTermItem[];
  plainText: string;
  markdownText: string;
  whatsAppText: string;
  htmlText: string;
  isCustomHistoricalSnapshot: boolean;
  isDestinationWiseSnapshot: boolean;
  snapshotEntriesCount: number;
} {
  const snapshot = quote?.commercialTermsSnapshot;
  if (snapshot && (snapshot.entries.length > 0 || Boolean(snapshot.combinedPlainText?.trim()))) {
    const itemsFromSnapshot: CommercialQuotationTermItem[] = [];
    let counter = 1;
    snapshot.entries.forEach((entry) => {
      entry.sections
        .filter((s) => s.isActive !== false)
        .sort((a, b) => a.displayOrder - b.displayOrder)
        .forEach((sec) => {
          const cleanBody = richTextToPlainText(sec.htmlContent || '');
          const cleanWaBody = richTextToWhatsApp(sec.htmlContent || '');
          const prefixHeading =
            snapshot.entries.length > 1
              ? `[${entry.targetName}] ${sec.heading}`
              : sec.heading;
          itemsFromSnapshot.push({
            number: counter++,
            heading: prefixHeading,
            body: cleanBody,
            plainText: cleanBody ? `${prefixHeading}: ${cleanBody}` : prefixHeading,
            markdownText: cleanBody ? `**${prefixHeading}**\n${cleanBody}` : `**${prefixHeading}**`,
            whatsAppText: cleanWaBody ? `*${prefixHeading}*\n${cleanWaBody}` : `*${prefixHeading}*`,
            htmlText: sec.htmlContent
          });
        });
    });

    return {
      heading: snapshot.combinedHeading || COMMERCIAL_QUOTATION_TERMS_HEADING,
      items: itemsFromSnapshot.length > 0 ? itemsFromSnapshot : COMMERCIAL_QUOTATION_TERMS_ITEMS,
      plainText: snapshot.combinedPlainText || '',
      markdownText: snapshot.combinedPlainText || '',
      whatsAppText: snapshot.combinedWhatsAppText || richTextToWhatsApp(snapshot.combinedHtml || snapshot.combinedPlainText || ''),
      htmlText: snapshot.combinedHtml || '',
      isCustomHistoricalSnapshot: false,
      isDestinationWiseSnapshot: true,
      snapshotEntriesCount: snapshot.entries.length
    };
  }

  // Strictly block generic fallback when Destination-level terms are explicitly missing
  if (quote?.termsStatus === 'TERMS_MISSING' || snapshot?.termsStatus === 'TERMS_MISSING') {
    return {
      heading: snapshot?.combinedHeading || COMMERCIAL_QUOTATION_TERMS_HEADING,
      items: [],
      plainText: '',
      markdownText: '',
      whatsAppText: '',
      htmlText: '',
      isCustomHistoricalSnapshot: false,
      isDestinationWiseSnapshot: true,
      snapshotEntriesCount: 0
    };
  }

  const rawTerms = quote?.termsAndConditions || quote?.brandingSnapshot?.disclaimer || '';
  const isFinalizedLocked = Boolean(
    quote?.isLocked &&
    ((quote?.status as string) === 'ISSUED' || quote?.status === 'ACCEPTED' || quote?.status === 'CONVERTED')
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
      isCustomHistoricalSnapshot: true,
      isDestinationWiseSnapshot: false,
      snapshotEntriesCount: 0
    };
  }

  return {
    heading: COMMERCIAL_QUOTATION_TERMS_HEADING,
    items: COMMERCIAL_QUOTATION_TERMS_ITEMS,
    plainText: COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT,
    markdownText: COMMERCIAL_QUOTATION_TERMS_MARKDOWN,
    whatsAppText: COMMERCIAL_QUOTATION_TERMS_WHATSAPP,
    htmlText: COMMERCIAL_QUOTATION_TERMS_HTML,
    isCustomHistoricalSnapshot: false,
    isDestinationWiseSnapshot: false,
    snapshotEntriesCount: 0
  };
}
