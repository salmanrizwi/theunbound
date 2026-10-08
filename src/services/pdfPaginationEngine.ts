import { QuotePresentationModel, ServicePresentationItem, DayPresentationData } from './quotePresentationModel';

export interface PageBounds {
  pageNumber: number;
  width: number;
  height: number;
  topMargin: number;
  bottomMargin: number;
  leftMargin: number;
  rightMargin: number;
  headerHeight: number;
  footerHeight: number;
  footerGap: number;
  contentTop: number;
  contentBottom: number;
  availableContentHeight: number;
}

export type PaginationBlockType =
  | 'HERO_AND_DOSSIER'
  | 'VISA_SECTION_HEADER'
  | 'VISA_SERVICE_CARD'
  | 'VISA_SERVICE_CONTINUATION'
  | 'DAY_HEADER'
  | 'DAY_CONTINUATION_HEADER'
  | 'DAY_OVERVIEW_BLOCK'
  | 'DAY_SERVICE_CARD'
  | 'DAY_SERVICE_CONTINUATION'
  | 'DAY_LEISURE_CARD'
  | 'DAY_NOTES_BLOCK'
  | 'ADDITIONAL_SERVICES'
  | 'OPERATIONAL_STANDARDS'
  | 'TARIFF_CONTAINER'
  | 'POLICIES_CONTAINER'
  | 'TERMS_AND_SIGNATURE';

export interface SplitBlockParts {
  firstPart: PaginationBlock;
  remainingPart: PaginationBlock;
}

export interface PaginationBlock {
  id: string;
  type: PaginationBlockType;
  html: string;
  estimatedHeight: number;
  splittable: boolean;
  minMeaningfulHeight: number;
  dayId?: string;
  dayNumber?: number;
  serviceId?: string;
  serviceIndex?: number;
  isSplitPart?: 'FIRST' | 'REMAINING';
  splitParts?: SplitBlockParts;
  dayMeta?: {
    dayNumber: number;
    hubName: string;
    prevHubName?: string;
    formattedDate: string;
    dayOfWeek: string;
    customTheme?: string;
  };
}

export interface RenderedPage {
  pageNumber: number;
  totalPages: number;
  headerHtml: string;
  footerHtml: string;
  blocks: PaginationBlock[];
  usedContentHeight: number;
  availableContentHeight: number;
}

export interface DayCompletenessReport {
  dayNumber: number;
  dayId: string;
  headerRendered: boolean;
  continuationCount: number;
  expectedServiceCount: number;
  renderedServiceCount: number;
  allInclusionsPresent: boolean;
  allExclusionsPresent: boolean;
  allOverviewsPresent: boolean;
  allNotesPresent: boolean;
  orderMaintained: boolean;
}

export interface PaginationCompletenessValidation {
  valid: boolean;
  errors: string[];
  dayReports: DayCompletenessReport[];
}

// Minimum height required to start a new Day section (Day Header + initial associated content)
export const MIN_DAY_START_HEIGHT = 180;

// Minimum height required to start an Activity/Service card so its header is never orphaned
export const MIN_ACTIVITY_START_HEIGHT = 120;

// Canonical A4 Dimensions at 820px width rendering context
export const A4_DIMENSIONS = {
  width: 820,
  height: 1160,
  topMargin: 40,
  bottomMargin: 40,
  leftMargin: 40,
  rightMargin: 40,
  headerHeightPage1: 0, // Page 1 includes Hero directly in content flow
  headerHeightContinuation: 46,
  footerHeight: 36,
  footerGap: 36, // Absolute minimum 36px protected clearance gap before footer
  safetyBuffer: 20, // 20px headroom buffer to prevent any content from ever touching footer zone
  minMeaningfulContentHeight: 150,
  minDayStartHeight: MIN_DAY_START_HEIGHT
};

/**
 * Calculate the exact boundaries and safe areas for any A4 page.
 */
export function getPageContentBounds(pageNumber: number): PageBounds {
  const isPage1 = pageNumber === 1;
  const headerHeight = isPage1 ? A4_DIMENSIONS.headerHeightPage1 : A4_DIMENSIONS.headerHeightContinuation;
  const contentTop = A4_DIMENSIONS.topMargin + headerHeight + (isPage1 ? 0 : 16);
  const contentBottom = A4_DIMENSIONS.height - A4_DIMENSIONS.bottomMargin - A4_DIMENSIONS.footerHeight - A4_DIMENSIONS.footerGap;
  const availableContentHeight = contentBottom - contentTop;

  return {
    pageNumber,
    width: A4_DIMENSIONS.width,
    height: A4_DIMENSIONS.height,
    topMargin: A4_DIMENSIONS.topMargin,
    bottomMargin: A4_DIMENSIONS.bottomMargin,
    leftMargin: A4_DIMENSIONS.leftMargin,
    rightMargin: A4_DIMENSIONS.rightMargin,
    headerHeight,
    footerHeight: A4_DIMENSIONS.footerHeight,
    footerGap: A4_DIMENSIONS.footerGap,
    contentTop,
    contentBottom,
    availableContentHeight
  };
}

/**
 * Split long text at a natural sentence or word boundary so that neither part is truncated.
 */
export function splitTextNaturally(text: string, targetFirstPartChars: number = 170): [string, string] {
  const trimmed = (text || '').trim();
  if (trimmed.length <= targetFirstPartChars) {
    return [trimmed, ''];
  }

  const minIdx = Math.max(40, Math.floor(trimmed.length * 0.35));
  const maxIdx = Math.min(trimmed.length - 20, Math.max(targetFirstPartChars + 50, Math.floor(trimmed.length * 0.65)));

  let splitIdx = -1;
  const sliceForSentence = trimmed.slice(minIdx, maxIdx);
  const periodPos = sliceForSentence.lastIndexOf('. ');
  if (periodPos !== -1) {
    splitIdx = minIdx + periodPos + 1;
  } else {
    const spaceSearchLimit = Math.min(trimmed.length - 10, targetFirstPartChars + 35);
    const spacePos = trimmed.lastIndexOf(' ', spaceSearchLimit);
    splitIdx = spacePos >= minIdx ? spacePos : targetFirstPartChars;
  }

  const first = trimmed.slice(0, splitIdx).trim();
  const second = trimmed.slice(splitIdx).trim();
  return [first, second];
}

/**
 * Estimate accurate, comfortable pixel rendering heights based on content length and elements.
 */
export function estimateServiceCardHeight(s: ServicePresentationItem): number {
  let height = 105; // Base card padding + title + category pill + pricing column
  if (s.configurationSummary && !s.isRail) height += 24;
  if (s.meetingPoint || s.pickupPoint || s.dropoffPoint) height += 28;
  if (s.isRail && s.railDetails) height += 70;
  if (s.overview) {
    const overviewLines = Math.max(1, Math.ceil(s.overview.length / 68));
    height += 22 + Math.min(overviewLines, 12) * 18;
  }
  if (s.inclusions && s.inclusions.length > 0) {
    const incRows = Math.max(1, Math.ceil(s.inclusions.length / 2));
    height += 24 + incRows * 26;
  }
  if (s.exclusions && s.exclusions.length > 0) {
    const excRows = Math.max(1, Math.ceil(s.exclusions.length / 2));
    height += 24 + excRows * 26;
  }
  if (s.specialInstructions) {
    const instLines = Math.max(1, Math.ceil(s.specialInstructions.length / 62));
    height += 26 + instLines * 18;
  }
  return Math.max(height, 145);
}

/**
 * Compute the minimum height required to start a Day section (`MIN_DAY_START_HEIGHT`).
 * Guarantees Day Header + beginning of its first associated content stay together on the same page.
 */
export function computeMinimumDayStartHeight(
  dayHeaderBlock: PaginationBlock,
  firstContentBlock?: PaginationBlock,
  secondContentBlock?: PaginationBlock
): number {
  if (!firstContentBlock) {
    return Math.max(MIN_DAY_START_HEIGHT, dayHeaderBlock.estimatedHeight + 85);
  }

  // If the first content block is a brief Day Overview banner and there is a following activity block,
  // require room for Day Header + Day Overview + start of first activity so the Day doesn't stop after just an overview line.
  if (firstContentBlock.type === 'DAY_OVERVIEW_BLOCK' && secondContentBlock) {
    const secondMinHeight = secondContentBlock.splittable && secondContentBlock.splitParts
      ? secondContentBlock.splitParts.firstPart.estimatedHeight
      : secondContentBlock.estimatedHeight;
    return Math.max(
      MIN_DAY_START_HEIGHT,
      dayHeaderBlock.estimatedHeight + firstContentBlock.estimatedHeight + secondMinHeight
    );
  }

  const firstMinHeight = firstContentBlock.splittable && firstContentBlock.splitParts
    ? firstContentBlock.splitParts.firstPart.estimatedHeight
    : firstContentBlock.estimatedHeight;

  return Math.max(MIN_DAY_START_HEIGHT, dayHeaderBlock.estimatedHeight + firstMinHeight);
}

/**
 * Create a canonical Day Continuation Header block (`CONTINUE DAY X`).
 * Purely a visual pagination marker preserving the original Day identity (`day.dayNumber` & `day.dayId`).
 */
export function createContinueDayHeaderBlock(
  day: DayPresentationData,
  continuationSeq: number = 1
): PaginationBlock {
  return {
    id: `block-day-${day.dayNumber}-continuation-${continuationSeq}`,
    type: 'DAY_CONTINUATION_HEADER',
    html: `
      <div data-day-id="${day.dayId}" data-day-continuation="${day.dayNumber}" style="background: #1e293b; color: #ffffff; padding: 7px 14px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-top: 4px; margin-bottom: 10px; font-size: 10.5px; border-left: 4px solid #00E5C0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 900; color: #00E5C0; letter-spacing: 0.04em;">CONTINUE DAY ${day.dayNumber}</span>
          <span style="color: #94a3b8;">•</span>
          <span style="color: #cbd5e1; font-weight: 600;">${day.dayOfWeek}, ${day.formattedDate} (${day.hubName} Base)</span>
        </div>
        <span style="font-family: monospace; color: #94a3b8; font-size: 9.5px;">DAY ${String(day.dayNumber).padStart(2, '0')} · CONTINUED</span>
      </div>
    `,
    estimatedHeight: 42,
    splittable: false,
    minMeaningfulHeight: 42,
    dayId: day.dayId,
    dayNumber: day.dayNumber,
    dayMeta: {
      dayNumber: day.dayNumber,
      hubName: day.hubName,
      prevHubName: day.prevHubName,
      formattedDate: day.formattedDate,
      dayOfWeek: day.dayOfWeek,
      customTheme: day.customTheme
    }
  };
}

/**
 * Build a Day Service Card block (along with its semantic `splitParts` if splittable across pages).
 */
function buildDayServiceCardBlock(
  s: ServicePresentationItem,
  day: DayPresentationData,
  sIdx: number
): PaginationBlock {
  const fullHeight = estimateServiceCardHeight(s);

  const operationalPointsHtml = (s.meetingPoint || s.pickupPoint || s.dropoffPoint) ? `
    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 5px 0; font-size: 9.5px; color: #334155;">
      ${s.meetingPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;"><strong>Meeting Point:</strong> ${s.meetingPoint}</span>` : ''}
      ${s.pickupPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;"><strong>Pickup:</strong> ${s.pickupPoint}</span>` : ''}
      ${s.dropoffPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;"><strong>Drop-off:</strong> ${s.dropoffPoint}</span>` : ''}
    </div>
  ` : '';

  const railBoxHtml = (s.isRail && s.railDetails) ? `
    <div style="margin: 6px 0; padding: 8px 10px; border-radius: 8px; background: #eef2ff; border: 1px solid #c7d2fe; font-size: 10.5px; color: #312e81;">
      <div style="font-weight: 700; margin-bottom: 2px;">
        🚄 Bullet Train: ${s.railDetails.origin} → ${s.railDetails.destination} • ${s.railDetails.carType} (${s.railDetails.seatType})
      </div>
      <div style="font-size: 9.5px; color: #4338ca; display: flex; gap: 10px;">
        ${s.railDetails.seatPreference ? `<span>Seat: <strong>${s.railDetails.seatPreference}</strong></span>` : ''}
        ${s.railDetails.pnrReference ? `<span>SmartEX PNR: <strong style="font-family: monospace;">${s.railDetails.pnrReference}</strong></span>` : ''}
      </div>
    </div>
  ` : '';

  const renderOverviewSection = (text: string, isContinued: boolean = false) => text ? `
    <div style="margin-top: 5px;">
      <span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">${isContinued ? 'Overview (Continued)' : 'Overview'}</span>
      <div style="font-size: 10.5px; color: #334155; line-height: 1.4;">${text}</div>
    </div>
  ` : '';

  const inclusionsHtml = s.inclusions.length > 0 ? `
    <div style="margin-top: 5px;">
      <span style="font-size: 9px; font-weight: 700; color: #059669; text-transform: uppercase; display: block; margin-bottom: 2px;">Inclusions</span>
      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
        ${s.inclusions.map(inc => `<span style="font-size: 9px; background: #ffffff; color: #064e3b; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">✓ ${inc}</span>`).join('')}
      </div>
    </div>
  ` : '';

  const exclusionsHtml = s.exclusions.length > 0 ? `
    <div style="margin-top: 5px;">
      <span style="font-size: 9px; font-weight: 700; color: #e11d48; text-transform: uppercase; display: block; margin-bottom: 2px;">Exclusions</span>
      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
        ${s.exclusions.map(exc => `<span style="font-size: 9px; background: #ffffff; color: #881337; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecdd3;">✕ ${exc}</span>`).join('')}
      </div>
    </div>
  ` : '';

  const specialInstructionsHtml = s.specialInstructions ? `
    <div style="font-size: 10px; color: #334155; background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 5px;">
      <strong>Special Instructions: </strong>${s.specialInstructions}
    </div>
  ` : '';

  const fullCardHtml = `
    <div data-day-id="${day.dayId}" data-service-id="${s.id}" style="padding: 12px 14px; border-radius: 12px; background: ${s.badgeBg}18; border: 1px solid ${s.badgeBg}; display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px;">
      <div style="flex: 1;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
          <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${s.badgeBg}; color: ${s.badgeText};">
            ${s.categoryLabel}
          </span>
          ${s.duration ? `<span style="font-size: 10px; color: #475569;">⏱️ ${s.duration}</span>` : ''}
          ${s.serviceTime ? `<span style="font-size: 10px; font-family: monospace; font-weight: 600; color: #334155; background: #ffffff; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">${s.serviceTime}</span>` : ''}
        </div>

        <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${s.listingName}</h4>
        ${s.configurationSummary && !s.isRail ? `<p style="font-size: 10.5px; color: #475569; margin: 0 0 5px 0; font-weight: 500;">${s.configurationSummary}</p>` : ''}
        ${operationalPointsHtml}
        ${railBoxHtml}
        ${renderOverviewSection(s.overview, false)}
        ${inclusionsHtml}
        ${exclusionsHtml}
        ${specialInstructionsHtml}
      </div>

      <div style="text-align: right; min-width: 105px;">
        <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">${s.priceFormatted}</div>
        <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">${s.paxText}</div>
        <span style="display: inline-block; margin-top: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #047857; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Confirmed</span>
      </div>
    </div>
  `;

  // Determine whether this activity card has enough sub-elements to split naturally across a page break
  const hasSecondaryDetails = s.inclusions.length > 0 || s.exclusions.length > 0 || Boolean(s.specialInstructions);
  const hasRailAndOverview = Boolean(s.isRail && s.railDetails && s.overview);
  const hasLongOverview = Boolean(s.overview && s.overview.length > 160);
  const canSplit = hasSecondaryDetails || hasRailAndOverview || hasLongOverview;

  let splitParts: SplitBlockParts | undefined;
  let minMeaningfulHeight = fullHeight;

  if (canSplit) {
    let firstPartOverview = s.overview;
    let remainingPartOverview = '';

    if (hasSecondaryDetails && s.overview && s.overview.length > 260) {
      [firstPartOverview, remainingPartOverview] = splitTextNaturally(s.overview, 180);
    } else if (!hasSecondaryDetails && hasRailAndOverview) {
      firstPartOverview = '';
      remainingPartOverview = s.overview;
    } else if (!hasSecondaryDetails && hasLongOverview) {
      [firstPartOverview, remainingPartOverview] = splitTextNaturally(s.overview, 150);
    }

    const firstPartHtml = `
      <div data-day-id="${day.dayId}" data-service-id="${s.id}" data-split-part="first" style="padding: 12px 14px; border-radius: 12px; background: ${s.badgeBg}18; border: 1px solid ${s.badgeBg}; display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px;">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
            <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${s.badgeBg}; color: ${s.badgeText};">
              ${s.categoryLabel}
            </span>
            ${s.duration ? `<span style="font-size: 10px; color: #475569;">⏱️ ${s.duration}</span>` : ''}
            ${s.serviceTime ? `<span style="font-size: 10px; font-family: monospace; font-weight: 600; color: #334155; background: #ffffff; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">${s.serviceTime}</span>` : ''}
          </div>

          <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${s.listingName}</h4>
          ${s.configurationSummary && !s.isRail ? `<p style="font-size: 10.5px; color: #475569; margin: 0 0 5px 0; font-weight: 500;">${s.configurationSummary}</p>` : ''}
          ${operationalPointsHtml}
          ${railBoxHtml}
          ${renderOverviewSection(firstPartOverview, false)}
        </div>

        <div style="text-align: right; min-width: 105px;">
          <div style="font-size: 13px; font-weight: 800; color: #0f172a; font-family: monospace;">${s.priceFormatted}</div>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">${s.paxText}</div>
          <span style="display: inline-block; margin-top: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #047857; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Confirmed</span>
        </div>
      </div>
    `;

    const remainingPartHtml = `
      <div data-day-id="${day.dayId}" data-service-id="${s.id}" data-split-part="remaining" style="padding: 12px 14px; border-radius: 12px; background: ${s.badgeBg}18; border: 1px solid ${s.badgeBg}; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed ${s.badgeBg};">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${s.badgeBg}; color: ${s.badgeText};">
              ${s.categoryLabel}
            </span>
            <h4 style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 0;">${s.listingName} — continued</h4>
          </div>
          <span style="font-size: 9px; font-family: monospace; color: #64748b; font-weight: 600;">Activity Details Continued</span>
        </div>
        ${renderOverviewSection(remainingPartOverview, Boolean(firstPartOverview))}
        ${inclusionsHtml}
        ${exclusionsHtml}
        ${specialInstructionsHtml}
      </div>
    `;

    // Estimate firstPart & remainingPart heights
    let firstEst = 100;
    if (s.configurationSummary && !s.isRail) firstEst += 22;
    if (s.meetingPoint || s.pickupPoint || s.dropoffPoint) firstEst += 26;
    if (s.isRail && s.railDetails) firstEst += 68;
    if (firstPartOverview) {
      const lines = Math.max(1, Math.ceil(firstPartOverview.length / 68));
      firstEst += 20 + Math.min(lines, 8) * 18;
    }
    firstEst = Math.max(MIN_ACTIVITY_START_HEIGHT, firstEst);

    let remEst = 65;
    if (remainingPartOverview) {
      const lines = Math.max(1, Math.ceil(remainingPartOverview.length / 68));
      remEst += 20 + Math.min(lines, 8) * 18;
    }
    if (s.inclusions.length > 0) {
      remEst += 24 + Math.max(1, Math.ceil(s.inclusions.length / 2)) * 26;
    }
    if (s.exclusions.length > 0) {
      remEst += 24 + Math.max(1, Math.ceil(s.exclusions.length / 2)) * 26;
    }
    if (s.specialInstructions) {
      remEst += 26 + Math.max(1, Math.ceil(s.specialInstructions.length / 62)) * 18;
    }
    remEst = Math.max(85, remEst);

    minMeaningfulHeight = firstEst;

    splitParts = {
      firstPart: {
        id: `block-day-${day.dayNumber}-service-${sIdx}-part-1`,
        type: 'DAY_SERVICE_CARD',
        html: firstPartHtml,
        estimatedHeight: firstEst,
        splittable: false,
        minMeaningfulHeight: firstEst,
        dayId: day.dayId,
        dayNumber: day.dayNumber,
        serviceId: s.id,
        serviceIndex: sIdx,
        isSplitPart: 'FIRST'
      },
      remainingPart: {
        id: `block-day-${day.dayNumber}-service-${sIdx}-part-2`,
        type: 'DAY_SERVICE_CONTINUATION',
        html: remainingPartHtml,
        estimatedHeight: remEst,
        splittable: false,
        minMeaningfulHeight: remEst,
        dayId: day.dayId,
        dayNumber: day.dayNumber,
        serviceId: s.id,
        serviceIndex: sIdx,
        isSplitPart: 'REMAINING'
      }
    };
  }

  return {
    id: `block-day-${day.dayNumber}-service-${sIdx}`,
    type: 'DAY_SERVICE_CARD',
    html: fullCardHtml,
    estimatedHeight: fullHeight,
    splittable: canSplit,
    minMeaningfulHeight,
    dayId: day.dayId,
    dayNumber: day.dayNumber,
    serviceId: s.id,
    serviceIndex: sIdx,
    splitParts
  };
}

/**
 * Deconstruct a QuotePresentationModel into discrete semantic pagination blocks.
 */
export function buildSemanticBlocks(model: QuotePresentationModel): PaginationBlock[] {
  const blocks: PaginationBlock[] = [];

  // 1. HERO BANNER & DOSSIER (Page 1 Lead Block)
  const routeHubsHtml = model.routeHubs.length > 0 ? `
    <div style="padding-top: 12px; border-top: 1px solid #334155; margin-top: 14px;">
      <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">
        <span style="color: #00E5C0;">🧭</span>
        <span>Route & Destination Hubs:</span>
      </div>
      <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 8px;">
        ${model.routeHubs.map((h, i) => `
          <div style="background: rgba(30, 41, 59, 0.9); padding: 5px 10px; border-radius: 8px; border: 1px solid #475569; font-size: 11px; display: flex; align-items: center; gap: 6px;">
            <span style="color: #00E5C0;">📍</span>
            <span style="font-weight: 700; color: #ffffff;">${h.hubName}</span>
            <span style="color: #00E5C0; font-family: monospace; font-weight: 600;">(${h.nights} ${h.nights === 1 ? 'Night' : 'Nights'})</span>
          </div>
          ${i < model.routeHubs.length - 1 ? `<span style="color: #64748b; font-weight: bold; font-size: 11px;">→</span>` : ''}
        `).join('')}
      </div>
    </div>
  ` : '';

  const heroAndDossierHtml = `
    <!-- Top Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #020617; padding-bottom: 14px; margin-bottom: 16px;">
      <div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 26px; font-weight: 900; text-transform: lowercase; color: #020617; letter-spacing: -0.02em;">${model.agencyName}</span>
          <span style="font-size: 9px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 4px; background: #020617; color: #00E5C0;">Official Itinerary Proposal</span>
        </div>
        <p style="font-size: 10.5px; color: #64748b; margin: 4px 0 0 0;">${model.agentAgencySubtitle}</p>
      </div>
      <div style="text-align: right; font-family: monospace; font-size: 10.5px;">
        <div style="font-size: 14px; font-weight: 900; color: #020617;">${model.quoteNumber} (v${model.version})</div>
        <div style="color: #64748b;">Date: ${model.createdDateFormatted}</div>
        <div style="color: #64748b;">Valid Until: ${model.validUntilFormatted}</div>
        <div style="color: #0d9488; font-weight: 700;">Status: ${model.status}</div>
      </div>
    </div>

    <!-- Curated Journey Overview Banner -->
    <div style="background: linear-gradient(135deg, #020617, #0f172a, #020617); color: #ffffff; padding: 18px 20px; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.06);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div>
          <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #00E5C0; font-weight: 800; display: block;">Curated Journey Overview</span>
          <h1 style="font-size: 19px; font-weight: 900; color: #ffffff; margin: 2px 0 4px 0;">${model.destination} Bespoke Travel Itinerary</h1>
          <p style="font-size: 11px; color: #cbd5e1; margin: 0; display: flex; flex-wrap: wrap; gap: 6px;">
            <span>${model.totalDays} Days / ${model.totalNights} Nights</span>
            <span>•</span>
            <span style="font-weight: 700; color: #00E5C0;">${model.paxDetailsText}</span>
            ${model.nationality ? `<span>•</span><span>Nationality: <strong style="color: #ffffff;">${model.nationality}</strong></span>` : ''}
            ${model.travelStyle ? `<span>•</span><span>Style: <strong style="color: #ffffff;">${model.travelStyle}</strong></span>` : ''}
            ${model.dateSpanText ? `<span>•</span><span style="font-family: monospace; color: #00E5C0;">${model.dateSpanText}</span>` : ''}
          </p>
        </div>
        <div style="text-align: right; min-width: 140px;">
          <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 700; display: block;">Package Rate per Person</span>
          <div style="font-size: 20px; font-weight: 900; font-family: monospace; color: #00E5C0;">${model.pricePerPersonFormatted}</div>
          <span style="font-size: 9.5px; color: #94a3b8;">Inclusive of all ground taxes</span>
        </div>
      </div>
      ${routeHubsHtml}
    </div>

    <!-- Client & Specialist Dossier -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; padding: 14px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 11px; margin-bottom: 18px;">
      <div>
        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: block; margin-bottom: 2px;">👥 Valued Guest / Client</span>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${model.clientName}</div>
        ${model.clientCompany ? `<div style="color: #475569; font-weight: 600;">${model.clientCompany}</div>` : ''}
        ${model.clientEmail ? `<div style="color: #64748b; font-family: monospace;">${model.clientEmail}</div>` : ''}
        ${model.clientPhone ? `<div style="color: #64748b; font-family: monospace;">${model.clientPhone}</div>` : ''}
      </div>
      <div>
        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: block; margin-bottom: 2px;">🎖️ Prepared By Specialist</span>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${model.agentName}</div>
        <div style="color: #334155; font-weight: 600;">${model.agencyName}</div>
        ${model.agentEmail ? `<div style="color: #64748b; font-family: monospace;">${model.agentEmail}</div>` : ''}
        <div style="color: #0d9488; font-size: 10px; font-weight: 700; margin-top: 3px;">🛡️ 24/7 On-Ground Concierge Assistance</div>
      </div>
    </div>
  `;

  const heroEstimatedHeight = 460 + (model.routeHubs.length > 3 ? 40 : 0);

  blocks.push({
    id: 'block-hero-dossier',
    type: 'HERO_AND_DOSSIER',
    html: heroAndDossierHtml,
    estimatedHeight: heroEstimatedHeight,
    splittable: false,
    minMeaningfulHeight: heroEstimatedHeight
  });

  // 2. VISA & ANCILLARY SERVICES (If present)
  if (model.visaServices && model.visaServices.length > 0) {
    blocks.push({
      id: 'block-visa-header',
      type: 'VISA_SECTION_HEADER',
      html: `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #065f46; padding-bottom: 6px; margin-top: 12px; margin-bottom: 12px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 15px;">🌐</span>
            <h2 style="font-size: 13.5px; font-weight: 900; color: #020617; text-transform: uppercase; margin: 0;">Visa & Ancillary Services</h2>
          </div>
          <span style="font-size: 10.5px; color: #065f46; font-family: monospace; font-weight: 700;">${model.visaServices.length} Services Included</span>
        </div>
      `,
      estimatedHeight: 52,
      splittable: false,
      minMeaningfulHeight: 52
    });

    model.visaServices.forEach((v, idx) => {
      const vHeight = estimateServiceCardHeight(v);
      blocks.push({
        id: `block-visa-service-${idx}`,
        type: 'VISA_SERVICE_CARD',
        html: `
          <div style="padding: 14px; border-radius: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; display: flex; justify-content: space-between; gap: 14px; margin-bottom: 12px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: #a7f3d0; color: #064e3b;">VISA & ANCILLARY</span>
                ${v.duration ? `<span style="font-size: 10px; color: #475569;">⏱️ ${v.duration}</span>` : ''}
              </div>
              <h4 style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${v.listingName}</h4>
              ${v.configurationSummary ? `<p style="font-size: 11px; color: #047857; margin: 0 0 5px 0; font-weight: 600;">${v.configurationSummary}</p>` : ''}
              ${v.overview ? `
                <div style="margin-top: 5px;">
                  <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Overview</span>
                  <div style="font-size: 10.5px; color: #334155; line-height: 1.4;">${v.overview}</div>
                </div>
              ` : ''}
              ${v.inclusions.length > 0 ? `
                <div style="margin-top: 5px;">
                  <span style="font-size: 9px; font-weight: 700; color: #059669; text-transform: uppercase; display: block; margin-bottom: 2px;">Inclusions</span>
                  <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${v.inclusions.map(inc => `<span style="font-size: 9px; background: #ffffff; color: #064e3b; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">✓ ${inc}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
              ${v.exclusions.length > 0 ? `
                <div style="margin-top: 5px;">
                  <span style="font-size: 9px; font-weight: 700; color: #e11d48; text-transform: uppercase; display: block; margin-bottom: 2px;">Exclusions</span>
                  <div style="display: flex; flex-wrap: wrap; gap: 4px;">
                    ${v.exclusions.map(exc => `<span style="font-size: 9px; background: #ffffff; color: #881337; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecdd3;">✕ ${exc}</span>`).join('')}
                  </div>
                </div>
              ` : ''}
              ${v.specialInstructions ? `
                <div style="font-size: 10px; color: #065f46; background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #a7f3d0; margin-top: 5px;">
                  <strong>Special Notes: </strong>${v.specialInstructions}
                </div>
              ` : ''}
            </div>
            <div style="text-align: right; min-width: 110px;">
              <div style="font-size: 13.5px; font-weight: 800; color: #0f172a; font-family: monospace;">${v.priceFormatted}</div>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 2px;">${v.paxText}</div>
              <span style="display: inline-block; margin-top: 4px; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #065f46; background: #d1fae5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Included</span>
            </div>
          </div>
        `,
        estimatedHeight: vHeight,
        splittable: false,
        minMeaningfulHeight: vHeight,
        serviceId: v.id,
        serviceIndex: idx
      });
    });
  }

  // 3. DAY-BY-DAY ITINERARY BLOCKS
  model.days.forEach((day) => {
    const dayId = day.dayId || `day-${day.dayNumber}`;
    // Day Header
    const dayHeaderHtml = `
      <div data-day-id="${dayId}" data-day-header="${day.dayNumber}" style="background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 12px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 26px; height: 26px; border-radius: 6px; background: #00E5C0; color: #0f172a; font-weight: 900; display: flex; align-items: center; justify-content: center; font-size: 11px; font-family: monospace;">
            ${String(day.dayNumber).padStart(2, '0')}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; font-size: 13px;">Day ${day.dayNumber}: ${day.dayOfWeek}, ${day.formattedDate}</span>
              ${day.isTransitionDay && day.prevHubName ? `
                <span style="padding: 1px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.2); color: #fcd34d; font-size: 9px; font-weight: 700; border: 1px solid rgba(245, 158, 11, 0.3);">
                  Transfer: ${day.prevHubName} → ${day.hubName}
                </span>
              ` : ''}
            </div>
            <div style="font-size: 10.5px; color: #cbd5e1; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
              <span style="color: #00E5C0;">📍</span>
              <span style="font-weight: 600;">${day.hubName} Base</span>
              ${day.customTheme ? `<span style="color: #64748b;">•</span><span style="color: #00E5C0; font-weight: 600;">${day.customTheme}</span>` : ''}
            </div>
          </div>
        </div>
        <div style="font-size: 10.5px; color: #94a3b8; font-family: monospace;">
          ${day.services.length > 0 ? `${day.services.length} ${day.services.length === 1 ? 'Service' : 'Services'}` : 'Leisure Exploration'}
        </div>
      </div>
    `;

    blocks.push({
      id: `block-day-${day.dayNumber}-header`,
      type: 'DAY_HEADER',
      html: dayHeaderHtml,
      estimatedHeight: 64,
      splittable: false,
      minMeaningfulHeight: 64,
      dayId,
      dayNumber: day.dayNumber,
      dayMeta: {
        dayNumber: day.dayNumber,
        hubName: day.hubName,
        prevHubName: day.prevHubName,
        formattedDate: day.formattedDate,
        dayOfWeek: day.dayOfWeek,
        customTheme: day.customTheme
      }
    });

    if (day.dayOverview) {
      const ovLines = Math.max(1, Math.ceil(day.dayOverview.length / 72));
      const ovHeight = 44 + ovLines * 18;
      blocks.push({
        id: `block-day-${day.dayNumber}-overview`,
        type: 'DAY_OVERVIEW_BLOCK',
        html: `
          <div data-day-id="${dayId}" style="padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 10px; font-size: 10.5px; color: #334155; line-height: 1.45;">
            <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #0d9488; display: block; margin-bottom: 2px;">Day ${day.dayNumber} Overview</span>
            <div>${day.dayOverview}</div>
          </div>
        `,
        estimatedHeight: ovHeight,
        splittable: false,
        minMeaningfulHeight: ovHeight,
        dayId,
        dayNumber: day.dayNumber
      });
    }

    if (day.services.length === 0) {
      blocks.push({
        id: `block-day-${day.dayNumber}-leisure`,
        type: 'DAY_LEISURE_CARD',
        html: `
          <div data-day-id="${dayId}" style="padding: 12px 14px; border-radius: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; margin-bottom: 10px;">
            <div>
              <span style="font-weight: 700; color: #1e293b;">• Day at Leisure in ${day.hubName}</span>
              <p style="font-size: 10px; color: #64748b; margin: 3px 0 0 0;">Free time for personal exploration, neighborhood shopping, and local dining discoveries.</p>
            </div>
            <span style="font-style: italic; color: #94a3b8; font-size: 10px;">Self-Paced</span>
          </div>
        `,
        estimatedHeight: 85,
        splittable: false,
        minMeaningfulHeight: 85,
        dayId,
        dayNumber: day.dayNumber
      });
    } else {
      day.services.forEach((s, sIdx) => {
        blocks.push(buildDayServiceCardBlock(s, { ...day, dayId }, sIdx));
      });
    }

    if (day.dayNotes) {
      const noteLines = Math.max(1, Math.ceil(day.dayNotes.length / 72));
      const noteHeight = 44 + noteLines * 18;
      blocks.push({
        id: `block-day-${day.dayNumber}-notes`,
        type: 'DAY_NOTES_BLOCK',
        html: `
          <div data-day-id="${dayId}" style="padding: 10px 14px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; margin-bottom: 10px; font-size: 10px; color: #78350f; line-height: 1.4;">
            <strong>Day ${day.dayNumber} Operational Notes: </strong>${day.dayNotes}
          </div>
        `,
        estimatedHeight: noteHeight,
        splittable: false,
        minMeaningfulHeight: noteHeight,
        dayId,
        dayNumber: day.dayNumber
      });
    }
  });

  // 4. ADDITIONAL SERVICES (If present)
  if (model.additionalServices && model.additionalServices.length > 0) {
    const addHeight = 125 + Math.ceil(model.additionalServices.length / 2) * 20;
    blocks.push({
      id: 'block-additional-services',
      type: 'ADDITIONAL_SERVICES',
      html: `
        <div style="margin-top: 14px; margin-bottom: 12px;">
          <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; font-size: 11.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            ✨ Additional Package Privileges & Services
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            ${model.additionalServices.map(a => `
              <div style="padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; font-size: 10.5px;">
                <div>
                  <div style="font-weight: 700; color: #0f172a;">${a.name}</div>
                  <div style="font-size: 9.5px; color: #64748b;">${a.summary}</div>
                </div>
                <div style="font-family: monospace; font-weight: 700; color: #0f172a;">${a.priceFormatted}</div>
              </div>
            `).join('')}
          </div>
        </div>
      `,
      estimatedHeight: addHeight,
      splittable: false,
      minMeaningfulHeight: addHeight
    });
  }

  // 5. OPERATIONAL STANDARDS (4 CARDS)
  blocks.push({
    id: 'block-operational-standards',
    type: 'OPERATIONAL_STANDARDS',
    html: `
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; margin-top: 14px; margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          <span>🛡️</span>
          <span>TheUnbound Ground Operations Standards & Inclusions</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
          ${model.operationalStandards.map(op => `
            <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-weight: 800; font-size: 10px; color: #0f172a; display: block; margin-bottom: 2px;">${op.title}</span>
              <p style="font-size: 9px; color: #64748b; margin: 0; line-height: 1.35;">${op.desc}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `,
    estimatedHeight: 150,
    splittable: false,
    minMeaningfulHeight: 150
  });

  // 6. FINANCIAL TARIFF CONTAINER
  blocks.push({
    id: 'block-tariff',
    type: 'TARIFF_CONTAINER',
    html: `
      <div style="background: #020617; color: #ffffff; padding: 18px 20px; border-radius: 16px; margin-top: 14px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 9px; font-weight: 800; color: #00E5C0; text-transform: uppercase; letter-spacing: 0.1em; display: block;">Official Proposal Tariff</span>
          <h3 style="font-size: 17px; font-weight: 900; color: #ffffff; margin: 2px 0 4px 0;">Guaranteed Total Itinerary Value</h3>
          <p style="font-size: 10px; color: #cbd5e1; margin: 0; max-width: 420px;">All private transport, bullet train fares, entrance tickets, and applicable government taxes are fully included.</p>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 24px; font-weight: 900; font-family: monospace; color: #00E5C0;">${model.totalItineraryValueFormatted}</div>
          <div style="font-size: 10.5px; color: #cbd5e1; font-family: monospace;">${model.pricePerTravelerFormatted}</div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${model.guaranteedCurrencyLine}</div>
        </div>
      </div>
    `,
    estimatedHeight: 140,
    splittable: false,
    minMeaningfulHeight: 140
  });

  // 7. OPERATIONAL GUIDELINES & POLICIES
  const policiesHeight = 120 + model.childAndAttractionPolicies.length * 15;
  blocks.push({
    id: 'block-policies',
    type: 'POLICIES_CONTAINER',
    html: `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-top: 10px; margin-bottom: 10px; font-size: 10px;">
        <div style="font-weight: 900; color: #78350f; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">
          ℹ️ Operational Guidelines & Child / Attraction Policy
        </div>
        <ul style="margin: 0; padding-left: 18px; color: #92400e; line-height: 1.45;">
          ${model.childAndAttractionPolicies.map(p => `<li style="margin-bottom: 3px;">${p}</li>`).join('')}
        </ul>
      </div>
    `,
    estimatedHeight: policiesHeight,
    splittable: false,
    minMeaningfulHeight: policiesHeight
  });

  // 8. TERMS & SIGNATURE FOOTER
  blocks.push({
    id: 'block-terms',
    type: 'TERMS_AND_SIGNATURE',
    html: `
      <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 10px; font-size: 10px; color: #64748b;">
        <div style="font-weight: 800; color: #1e293b; text-transform: uppercase; font-size: 9.5px; margin-bottom: 4px;">Commercial Quotation Terms:</div>
        <p style="margin: 0 0 10px 0; color: #475569; line-height: 1.4;">${model.commercialTerms}</p>
        <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 8px; font-size: 9.5px; color: #94a3b8; font-family: monospace;">
          <span>${model.footerContactLine}</span>
          <span>Official DMC Electronic Proposal</span>
        </div>
      </div>
    `,
    estimatedHeight: 145,
    splittable: false,
    minMeaningfulHeight: 145
  });

  return blocks;
}

/**
 * Accurately measure block heights (and split-part heights) in the real browser DOM if document is available.
 * Uses a flex-column measurement container matching the 740px printable content zone so margins never collapse.
 */
export function measureBlockHeightsInDOM(blocks: PaginationBlock[]): void {
  if (typeof document === 'undefined' || !document.body) {
    return;
  }

  const measureContainer = document.createElement('div');
  measureContainer.id = 'pdf-pagination-measure-container';
  measureContainer.style.position = 'fixed';
  measureContainer.style.left = '-9999px';
  measureContainer.style.top = '0';
  measureContainer.style.width = `${A4_DIMENSIONS.width - A4_DIMENSIONS.leftMargin - A4_DIMENSIONS.rightMargin}px`; // 740px
  measureContainer.style.display = 'flex';
  measureContainer.style.flexDirection = 'column';
  measureContainer.style.visibility = 'hidden';
  measureContainer.style.pointerEvents = 'none';
  measureContainer.style.boxSizing = 'border-box';
  measureContainer.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  document.body.appendChild(measureContainer);

  const measureSingleHtml = (html: string): number => {
    measureContainer.innerHTML = html;
    return Math.ceil(measureContainer.getBoundingClientRect().height);
  };

  try {
    for (const block of blocks) {
      const measuredHeight = measureSingleHtml(block.html);
      if (measuredHeight > 0) {
        block.estimatedHeight = Math.max(measuredHeight + 6, 24);
      }

      if (block.splitParts) {
        const firstMeasured = measureSingleHtml(block.splitParts.firstPart.html);
        if (firstMeasured > 0) {
          block.splitParts.firstPart.estimatedHeight = Math.max(firstMeasured + 6, MIN_ACTIVITY_START_HEIGHT);
          block.minMeaningfulHeight = block.splitParts.firstPart.estimatedHeight;
        }

        const remMeasured = measureSingleHtml(block.splitParts.remainingPart.html);
        if (remMeasured > 0) {
          block.splitParts.remainingPart.estimatedHeight = Math.max(remMeasured + 6, 60);
        }
      } else {
        block.minMeaningfulHeight = block.estimatedHeight;
      }
    }
  } catch (err) {
    console.warn('DOM measurement fallback to estimation:', err);
  } finally {
    if (measureContainer.parentNode) {
      measureContainer.parentNode.removeChild(measureContainer);
    }
  }
}

/**
 * Validate that the paginated output preserves 100% of Day headers, Day content,
 * activities, inclusions, exclusions, operational details, notes, and ordering,
 * with zero orphaned Day headers and proper `CONTINUE DAY X` markers.
 */
export function validatePaginatedQuoteCompleteness(
  model: QuotePresentationModel,
  pages: RenderedPage[]
): PaginationCompletenessValidation {
  const errors: string[] = [];
  const dayReports: DayCompletenessReport[] = [];

  if (pages.length === 0) {
    errors.push('No pages were generated by pagination engine.');
  }

  // 1. Validate page-level invariants (no empty pages, no orphaned headers at page bottom, valid continuation placement)
  pages.forEach((page) => {
    if (page.blocks.length === 0) {
      errors.push(`Page ${page.pageNumber} has 0 content blocks.`);
      return;
    }

    const lastBlock = page.blocks[page.blocks.length - 1];
    if (
      lastBlock.type === 'DAY_HEADER' ||
      lastBlock.type === 'DAY_CONTINUATION_HEADER' ||
      lastBlock.type === 'DAY_OVERVIEW_BLOCK' ||
      lastBlock.type === 'VISA_SECTION_HEADER'
    ) {
      errors.push(
        `Page ${page.pageNumber} ends with an orphaned header block (${lastBlock.type}, id=${lastBlock.id}).`
      );
    }

    page.blocks.forEach((b, idx) => {
      if (b.type === 'DAY_HEADER') {
        const following = page.blocks[idx + 1];
        if (!following || following.dayNumber !== b.dayNumber) {
          errors.push(
            `DAY_HEADER for Day ${b.dayNumber} on Page ${page.pageNumber} is separated from its immediately associated Day ${b.dayNumber} content.`
          );
        }
      }

      if (b.type === 'DAY_CONTINUATION_HEADER') {
        if (idx !== 0) {
          errors.push(
            `DAY_CONTINUATION_HEADER for Day ${b.dayNumber} on Page ${page.pageNumber} must be placed at the top of the usable content area (found at index ${idx}).`
          );
        }
        if (!b.html.includes(`CONTINUE DAY ${b.dayNumber}`)) {
          errors.push(
            `DAY_CONTINUATION_HEADER on Page ${page.pageNumber} is missing canonical label "CONTINUE DAY ${b.dayNumber}".`
          );
        }
        const following = page.blocks[idx + 1];
        if (!following || following.dayNumber !== b.dayNumber) {
          errors.push(
            `DAY_CONTINUATION_HEADER for Day ${b.dayNumber} on Page ${page.pageNumber} is not followed by Day ${b.dayNumber} content.`
          );
        }
      }
    });
  });

  // 2. Verify strict chronological Day ordering across all pages (Day N+1 never starts before Day N is complete)
  const allBlocksWithPage = pages.flatMap((p) =>
    p.blocks.map((b) => ({ block: b, pageNumber: p.pageNumber }))
  );

  let highestDaySeen = 0;
  for (const { block, pageNumber } of allBlocksWithPage) {
    if (block.dayNumber !== undefined) {
      if (block.dayNumber < highestDaySeen) {
        errors.push(
          `Day ordering violation on Page ${pageNumber}: Day ${block.dayNumber} content appeared after Day ${highestDaySeen} had already started.`
        );
      }
      highestDaySeen = Math.max(highestDaySeen, block.dayNumber);
    }
  }

  // 3. Per-Day Completeness & Continuation Audit
  for (const day of model.days) {
    const dayId = day.dayId || `day-${day.dayNumber}`;
    const dayBlocksWithPage = allBlocksWithPage.filter(
      (entry) => entry.block.dayNumber === day.dayNumber
    );

    const headerBlocks = dayBlocksWithPage.filter((e) => e.block.type === 'DAY_HEADER');
    const contBlocks = dayBlocksWithPage.filter((e) => e.block.type === 'DAY_CONTINUATION_HEADER');

    if (headerBlocks.length !== 1) {
      errors.push(
        `Day ${day.dayNumber} expected exactly 1 DAY_HEADER, found ${headerBlocks.length}.`
      );
    }

    // Check multi-page continuation headers for this Day
    const distinctPagesForDay = Array.from(
      new Set(dayBlocksWithPage.map((e) => e.pageNumber))
    ).sort((a, b) => a - b);

    if (distinctPagesForDay.length > 1) {
      for (let pIdx = 1; pIdx < distinctPagesForDay.length; pIdx++) {
        const contPageNum = distinctPagesForDay[pIdx];
        const pageObj = pages.find((p) => p.pageNumber === contPageNum);
        const firstBlockOnContPage = pageObj?.blocks[0];
        if (
          !firstBlockOnContPage ||
          firstBlockOnContPage.type !== 'DAY_CONTINUATION_HEADER' ||
          firstBlockOnContPage.dayNumber !== day.dayNumber
        ) {
          errors.push(
            `Day ${day.dayNumber} continues onto Page ${contPageNum} without starting with "CONTINUE DAY ${day.dayNumber}".`
          );
        }
      }
    }

    const combinedDayHtml = dayBlocksWithPage.map((e) => e.block.html).join('\n');

    let allInclusionsPresent = true;
    let allExclusionsPresent = true;
    let allOverviewsPresent = true;
    let allNotesPresent = true;
    let orderMaintained = true;

    if (day.dayOverview && !combinedDayHtml.includes(day.dayOverview)) {
      allOverviewsPresent = false;
      errors.push(`Day ${day.dayNumber} overview text is missing from rendered PDF.`);
    }

    if (day.dayNotes && !combinedDayHtml.includes(day.dayNotes)) {
      allNotesPresent = false;
      errors.push(`Day ${day.dayNumber} operational notes are missing from rendered PDF.`);
    }

    if (day.services.length === 0) {
      const leisureBlocks = dayBlocksWithPage.filter((e) => e.block.type === 'DAY_LEISURE_CARD');
      if (leisureBlocks.length !== 1) {
        errors.push(`Day ${day.dayNumber} leisure card missing or duplicated (count=${leisureBlocks.length}).`);
      }
    } else {
      let lastServiceIdx = -1;
      const serviceBlocks = dayBlocksWithPage.filter(
        (e) =>
          e.block.type === 'DAY_SERVICE_CARD' || e.block.type === 'DAY_SERVICE_CONTINUATION'
      );

      for (const sb of serviceBlocks) {
        const sIdx = sb.block.serviceIndex ?? 0;
        if (sIdx < lastServiceIdx) {
          orderMaintained = false;
          errors.push(
            `Day ${day.dayNumber} service order violation: service index ${sIdx} appeared after ${lastServiceIdx}.`
          );
        }
        lastServiceIdx = sIdx;
      }

      day.services.forEach((s, sIdx) => {
        const blocksForService = serviceBlocks
          .filter((e) => e.block.serviceIndex === sIdx)
          .map((e) => e.block);

        if (blocksForService.length === 0) {
          errors.push(`Day ${day.dayNumber} service "${s.listingName}" is missing from rendered PDF.`);
          return;
        }

        // Check no duplication of full cards or split parts
        if (blocksForService.length === 1) {
          if (blocksForService[0].isSplitPart) {
            errors.push(
              `Day ${day.dayNumber} service "${s.listingName}" rendered only 1 split part (${blocksForService[0].isSplitPart}) — remaining part was lost.`
            );
          }
        } else if (blocksForService.length === 2) {
          if (
            blocksForService[0].isSplitPart !== 'FIRST' ||
            blocksForService[1].isSplitPart !== 'REMAINING'
          ) {
            errors.push(
              `Day ${day.dayNumber} service "${s.listingName}" split parts out of order.`
            );
          }
        } else {
          errors.push(
            `Day ${day.dayNumber} service "${s.listingName}" rendered ${blocksForService.length} times (duplication detected).`
          );
        }

        const serviceHtml = blocksForService.map((b) => b.html).join('\n');

        if (!serviceHtml.includes(s.listingName)) {
          errors.push(`Day ${day.dayNumber} service title "${s.listingName}" missing.`);
        }

        for (const inc of s.inclusions) {
          if (!serviceHtml.includes(inc)) {
            allInclusionsPresent = false;
            errors.push(`Day ${day.dayNumber} service "${s.listingName}" missing inclusion "${inc}".`);
          }
        }

        for (const exc of s.exclusions) {
          if (!serviceHtml.includes(exc)) {
            allExclusionsPresent = false;
            errors.push(`Day ${day.dayNumber} service "${s.listingName}" missing exclusion "${exc}".`);
          }
        }

        if (s.specialInstructions && !serviceHtml.includes(s.specialInstructions)) {
          allNotesPresent = false;
          errors.push(
            `Day ${day.dayNumber} service "${s.listingName}" missing special instructions.`
          );
        }
      });
    }

    const renderedUniqueServices = new Set(
      dayBlocksWithPage
        .filter(
          (e) =>
            e.block.type === 'DAY_SERVICE_CARD' || e.block.type === 'DAY_SERVICE_CONTINUATION'
        )
        .map((e) => e.block.serviceIndex)
    ).size;

    dayReports.push({
      dayNumber: day.dayNumber,
      dayId,
      headerRendered: headerBlocks.length === 1,
      continuationCount: contBlocks.length,
      expectedServiceCount: day.services.length,
      renderedServiceCount: renderedUniqueServices,
      allInclusionsPresent,
      allExclusionsPresent,
      allOverviewsPresent,
      allNotesPresent,
      orderMaintained
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    dayReports
  };
}

/**
 * Core Pagination Algorithm: Bins semantic blocks into discrete A4 pages with guaranteed bounds.
 * Treats each Day Header + its associated Day content as a cohesive DaySection unit,
 * never orphans Day or Activity headers, splits long activities naturally, and inserts
 * `CONTINUE DAY X` markers whenever a Day spans across page boundaries.
 */
export function paginateQuotePresentationModel(model: QuotePresentationModel): RenderedPage[] {
  const blocks = buildSemanticBlocks(model);

  // Measure exact real DOM heights in browser environment
  measureBlockHeightsInDOM(blocks);

  const rawPages: Array<{ pageNumber: number; blocks: PaginationBlock[]; usedHeight: number }> = [];

  let currentPageNum = 1;
  let currentBounds = getPageContentBounds(currentPageNum);
  let currentPageBlocks: PaginationBlock[] = [];
  let currentUsedHeight = 0;

  const getSafeRemainingHeight = (): number => {
    return Math.max(
      0,
      currentBounds.availableContentHeight - A4_DIMENSIONS.safetyBuffer - currentUsedHeight
    );
  };

  const createNextPage = (): void => {
    if (currentPageBlocks.length > 0) {
      rawPages.push({
        pageNumber: currentPageNum,
        blocks: currentPageBlocks,
        usedHeight: currentUsedHeight
      });
      currentPageNum++;
      currentBounds = getPageContentBounds(currentPageNum);
      currentPageBlocks = [];
      currentUsedHeight = 0;
    }
  };

  const appendBlock = (block: PaginationBlock): void => {
    currentPageBlocks.push(block);
    currentUsedHeight += block.estimatedHeight;
  };

  // Dedicated DaySection renderer that preserves Day Header + associated content grouping
  const renderDaySection = (
    day: DayPresentationData,
    dayHeaderBlock: PaginationBlock,
    dayContentBlocks: PaginationBlock[]
  ): void => {
    let continuationSeq = 1;

    // 1. Check MIN_DAY_START_HEIGHT before rendering Day Header so Day Header is NEVER orphaned
    const minimumDayStartHeight = computeMinimumDayStartHeight(
      dayHeaderBlock,
      dayContentBlocks[0],
      dayContentBlocks[1]
    );

    if (getSafeRemainingHeight() < minimumDayStartHeight && currentPageBlocks.length > 0) {
      createNextPage();
    }

    // 2. Render Day Header on current page
    appendBlock(dayHeaderBlock);

    // Track whether at least one associated service/leisure block has been rendered under the active header on this page
    let hasRenderedServiceOnCurrentPageForDay = false;

    // 3. Render Day content items in strict sequential order using cursor dayContentIndex
    for (let dayContentIndex = 0; dayContentIndex < dayContentBlocks.length; dayContentIndex++) {
      const item = dayContentBlocks[dayContentIndex];
      const rem = getSafeRemainingHeight();

      // Day Overview block immediately after Day Header stays attached to Day Header
      if (item.type === 'DAY_OVERVIEW_BLOCK') {
        appendBlock(item);
        continue;
      }

      // Case A: Full item fits inside safe remaining height on current page
      if (item.estimatedHeight <= rem) {
        appendBlock(item);
        hasRenderedServiceOnCurrentPageForDay = true;
        continue;
      }

      // Case B: Full item does not fit, and item is splittable across pages
      if (item.splittable && item.splitParts) {
        const { firstPart, remainingPart } = item.splitParts;

        // If firstPart (Activity Header + primary details) fits on current page, OR if we MUST keep with Day Header
        if (firstPart.estimatedHeight <= rem || !hasRenderedServiceOnCurrentPageForDay) {
          appendBlock(firstPart);
          hasRenderedServiceOnCurrentPageForDay = true;

          // Continue remainingPart onto the next page with CONTINUE DAY X marker
          createNextPage();
          appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));
          appendBlock(remainingPart);
          hasRenderedServiceOnCurrentPageForDay = true;
          continue;
        } else {
          // firstPart does not fit in remaining space: move entire Activity to next page so Activity Header is not orphaned
          createNextPage();
          appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));

          // On the fresh page, check if the full unsplit item fits
          if (item.estimatedHeight <= getSafeRemainingHeight()) {
            appendBlock(item);
            hasRenderedServiceOnCurrentPageForDay = true;
          } else {
            appendBlock(firstPart);
            createNextPage();
            appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));
            appendBlock(remainingPart);
            hasRenderedServiceOnCurrentPageForDay = true;
          }
          continue;
        }
      }

      // Case C: Unsplittable item does not fit in remaining height
      if (!hasRenderedServiceOnCurrentPageForDay) {
        // Hard invariant: never orphan the preceding Day Header / Continuation Header
        appendBlock(item);
        hasRenderedServiceOnCurrentPageForDay = true;
      } else {
        createNextPage();
        appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));
        appendBlock(item);
        hasRenderedServiceOnCurrentPageForDay = true;
      }
    }
  };

  // Process all blocks, delegating Day sections to renderDaySection
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    // Group and render each Day section as a semantic unit
    if (block.type === 'DAY_HEADER' && block.dayNumber !== undefined) {
      const targetDayNum = block.dayNumber;
      const dayData = model.days.find((d) => d.dayNumber === targetDayNum) || {
        dayId: block.dayId || `day-${targetDayNum}`,
        dayNumber: targetDayNum,
        dateString: '',
        dayOfWeek: block.dayMeta?.dayOfWeek || '',
        formattedDate: block.dayMeta?.formattedDate || '',
        hubName: block.dayMeta?.hubName || '',
        isTransitionDay: false,
        prevHubName: block.dayMeta?.prevHubName,
        customTheme: block.dayMeta?.customTheme,
        services: []
      };

      const dayContentBlocks: PaginationBlock[] = [];
      let j = i + 1;
      while (
        j < blocks.length &&
        blocks[j].dayNumber === targetDayNum &&
        blocks[j].type !== 'DAY_HEADER'
      ) {
        dayContentBlocks.push(blocks[j]);
        j++;
      }

      renderDaySection(dayData, block, dayContentBlocks);
      i = j;
      continue;
    }

    // Visa Section Header must stay with its first Visa Service Card
    if (block.type === 'VISA_SECTION_HEADER') {
      const nextBlock = blocks[i + 1];
      const nextServiceHeight =
        nextBlock && nextBlock.type === 'VISA_SERVICE_CARD'
          ? nextBlock.minMeaningfulHeight
          : 160;
      const combinedMinHeight = block.estimatedHeight + nextServiceHeight;

      if (combinedMinHeight > getSafeRemainingHeight() && currentPageBlocks.length > 0) {
        createNextPage();
      }
      appendBlock(block);
      i++;
      continue;
    }

    // Visa Service Card or general post-itinerary section containers
    const lastBlockOnPage = currentPageBlocks[currentPageBlocks.length - 1];
    const isPrecededByVisaHeader =
      lastBlockOnPage && lastBlockOnPage.type === 'VISA_SECTION_HEADER';

    if (
      block.estimatedHeight > getSafeRemainingHeight() &&
      currentPageBlocks.length > 0 &&
      !isPrecededByVisaHeader
    ) {
      createNextPage();
    }

    appendBlock(block);
    i++;
  }

  // Push final page
  if (currentPageBlocks.length > 0) {
    rawPages.push({
      pageNumber: currentPageNum,
      blocks: currentPageBlocks,
      usedHeight: currentUsedHeight
    });
  }

  const totalPages = rawPages.length;

  // Build finalized RenderedPage structures with exact headers and footers
  const renderedPages: RenderedPage[] = rawPages.map((rp) => {
    const isPage1 = rp.pageNumber === 1;
    const bounds = getPageContentBounds(rp.pageNumber);

    const headerHtml = isPage1 ? '' : `
      <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px; font-size: 10.5px;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 900; color: #020617; text-transform: lowercase; font-size: 13px;">${model.agencyName}</span>
          <span style="color: #94a3b8;">•</span>
          <span style="color: #64748b; font-weight: 600;">Official Itinerary Proposal</span>
        </div>
        <div style="font-family: monospace; color: #0f172a; font-weight: 700; font-size: 10px;">
          ${model.quoteNumber} (v${model.version})
        </div>
      </div>
    `;

    const footerHtml = `
      <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; display: flex; justify-content: space-between; align-items: center; font-size: 9.5px; color: #94a3b8; font-family: monospace;">
        <div style="display: flex; align-items: center; gap: 6px;">
          <span style="font-weight: 700; color: #475569;">${model.agencyName.toUpperCase()} DMC</span>
          <span>•</span>
          <span>${model.quoteNumber}</span>
        </div>
        <div style="font-weight: 700; color: #0f172a;">
          Page ${rp.pageNumber} of ${totalPages}
        </div>
      </div>
    `;

    return {
      pageNumber: rp.pageNumber,
      totalPages,
      headerHtml,
      footerHtml,
      blocks: rp.blocks,
      usedContentHeight: rp.usedHeight,
      availableContentHeight: bounds.availableContentHeight
    };
  });

  // Execute fail-safe Day & Content Completeness Validation (Section 19 Mandate)
  const validation = validatePaginatedQuoteCompleteness(model, renderedPages);
  if (!validation.valid) {
    throw new Error(
      `PDF Pagination Completeness Validation Failed: ${validation.errors.join(' | ')}`
    );
  }

  return renderedPages;
}
