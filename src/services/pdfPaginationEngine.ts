import { QuotePresentationModel, ServicePresentationItem, DayPresentationData } from './quotePresentationModel';
import { THEUNBOUND_REGISTERED_ADDRESS, THEUNBOUND_CURRENT_ADDRESS } from './db';

export interface PageBounds {
  pageNumber: number;
  width: number;
  height: number;
  topMargin: number;
  bottomMargin: number;
  leftMargin: number;
  rightMargin: number;
  headerHeight: number;
  headerGap: number;
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
  keepWithNext?: boolean;
  dayId?: string;
  dayNumber?: number;
  serviceId?: string;
  serviceIndex?: number;
  serviceData?: ServicePresentationItem;
  overviewSegments?: string[];
  overviewIsContinued?: boolean;
  includeSecondaryOnRemainder?: boolean;
  isSplitPart?: 'FIRST' | 'MIDDLE' | 'REMAINING';
  splitPartIndex?: number;
  splitPartTotal?: number;
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
  bounds: PageBounds;
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

export interface PdfLayoutBoundsValidation {
  valid: boolean;
  errors: string[];
  pageSummaries: Array<{
    pageNumber: number;
    usedContentHeight: number;
    availableContentHeight: number;
    headerHeight: number;
    footerHeight: number;
    blockCount: number;
  }>;
}

// Minimum height required to start a new Day section (Day Header + initial associated content)
export const MIN_DAY_START_HEIGHT = 180;

// Minimum height required to start an Activity/Service card so its header is never orphaned
export const MIN_ACTIVITY_START_HEIGHT = 120;

// Canonical A4 Dimensions at 820px width rendering context (matches 210mm x 297mm proportion)
export const A4_DIMENSIONS = {
  width: 820,
  height: 1160,
  topMargin: 38,
  bottomMargin: 36,
  leftMargin: 40,
  rightMargin: 40,
  headerHeightPage1: 0, // Page 1 includes Hero directly in body flow
  headerHeightContinuation: 36, // Default continuation header height (measured dynamically when DOM available)
  headerGap: 14, // Clear breathing room between continuation header and body
  footerHeight: 62, // Default multi-line footer height (measured dynamically from actual footer content)
  footerGap: 28, // Protected clearance gap above footer (no body content may enter)
  safetyBuffer: 14, // Safety headroom inside body container
  minMeaningfulContentHeight: 140,
  minDayStartHeight: MIN_DAY_START_HEIGHT
};

const CONTENT_WIDTH_PX = A4_DIMENSIONS.width - A4_DIMENSIONS.leftMargin - A4_DIMENSIONS.rightMargin; // 740px

export function escapePdfText(val: string): string {
  return String(val || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function stripHtmlTagsAndEntities(htmlOrText?: string): string {
  return String(htmlOrText || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function hasMeaningfulHtmlContent(htmlOrText?: string): boolean {
  return stripHtmlTagsAndEntities(htmlOrText).length > 0;
}

/**
 * Calculate the exact boundaries and safe areas for any A4 page using actual header & footer heights.
 * Formula: Available Body Height = Page Height - Top Margin - Bottom Margin - Header Height - Header Gap - Footer Height - Footer Gap
 */
export function getPageContentBounds(
  pageNumber: number,
  overrides?: {
    headerHeight?: number;
    footerHeight?: number;
    headerGap?: number;
    footerGap?: number;
  }
): PageBounds {
  const isPage1 = pageNumber === 1;
  const headerHeight = isPage1
    ? A4_DIMENSIONS.headerHeightPage1
    : (overrides?.headerHeight ?? A4_DIMENSIONS.headerHeightContinuation);
  const headerGap = isPage1 ? 0 : (overrides?.headerGap ?? A4_DIMENSIONS.headerGap);
  const footerHeight = overrides?.footerHeight ?? A4_DIMENSIONS.footerHeight;
  const footerGap = overrides?.footerGap ?? A4_DIMENSIONS.footerGap;

  const contentTop = A4_DIMENSIONS.topMargin + headerHeight + headerGap;
  const contentBottom = A4_DIMENSIONS.height - A4_DIMENSIONS.bottomMargin - footerHeight - footerGap;
  const availableContentHeight = Math.max(200, contentBottom - contentTop);

  return {
    pageNumber,
    width: A4_DIMENSIONS.width,
    height: A4_DIMENSIONS.height,
    topMargin: A4_DIMENSIONS.topMargin,
    bottomMargin: A4_DIMENSIONS.bottomMargin,
    leftMargin: A4_DIMENSIONS.leftMargin,
    rightMargin: A4_DIMENSIONS.rightMargin,
    headerHeight,
    headerGap,
    footerHeight,
    footerGap,
    contentTop,
    contentBottom,
    availableContentHeight
  };
}

/**
 * Canonical Page Header Builder (for continuation pages >= 2; Page 1 uses Hero Banner directly).
 * Zero bottom margin inside inner div because spacing is enforced independently via PageBounds.headerGap.
 */
export function buildPageHeaderHtml(model: QuotePresentationModel, pageNumber: number): string {
  if (pageNumber === 1) return '';
  const primaryBrandHex = model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617';
  return `
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; margin: 0; font-size: 10.5px; line-height: 1.3; box-sizing: border-box;">
      <div style="display: flex; align-items: center; gap: 8px; min-width: 0;">
        <span style="font-weight: 900; color: ${primaryBrandHex}; ${model.isWhiteLabel ? '' : 'text-transform: lowercase;'} font-size: 13px; white-space: nowrap;">${escapePdfText(model.agencyName)}</span>
        <span style="color: #94a3b8;">•</span>
        <span style="color: #64748b; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapePdfText(model.documentBadgeTitle)}</span>
      </div>
      <div style="font-family: monospace; color: #0f172a; font-weight: 700; font-size: 10px; white-space: nowrap; flex-shrink: 0;">
        ${escapePdfText(model.quoteNumber)} (v${model.version})
      </div>
    </div>
  `;
}

/**
 * Canonical Page Footer Builder (fixed bottom region on every page).
 * Wraps long registered/current addresses cleanly onto multiple lines without ever truncating or entering body.
 */
export function buildPageFooterHtml(
  model: QuotePresentationModel,
  pageNumber: number,
  totalPages: number
): string {
  const brandLabel = model.isWhiteLabel
    ? (model.agencyName || 'Partner Travel Agency').toUpperCase()
    : `${(model.agencyName || 'theunbound').toUpperCase()} DMC`;

  const contactBits = [
    model.agentEmail ? escapePdfText(model.agentEmail) : '',
    model.agentPhone ? escapePdfText(model.agentPhone) : '',
    model.isWhiteLabel && model.agencyWebsite ? escapePdfText(model.agencyWebsite) : '',
    escapePdfText(model.footerRightTitle || 'Official DMC Electronic Proposal')
  ].filter(Boolean);

  let addressRowsHtml = '';
  if (!model.isWhiteLabel) {
    const regAddr = (model.agencyRegisteredAddress || THEUNBOUND_REGISTERED_ADDRESS).replace(/\r?\n/g, ', ');
    const curAddr = (model.agencyCurrentAddress || THEUNBOUND_CURRENT_ADDRESS).replace(/\r?\n/g, ', ');
    addressRowsHtml = `
      <div style="font-size: 8.2px; color: #475569; line-height: 1.38; margin-top: 3px; word-break: break-word;">
        <div><strong style="color: #334155;">Registered Address:</strong> ${escapePdfText(regAddr)}</div>
        <div><strong style="color: #334155;">Current Address:</strong> ${escapePdfText(curAddr)}</div>
      </div>
    `;
  } else {
    const wlLines: string[] = [];
    if (model.customFooterText) {
      wlLines.push(escapePdfText(model.customFooterText.replace(/\r?\n/g, ' • ')));
    } else {
      if (model.agencyRegisteredAddress) {
        wlLines.push(`<strong style="color: #334155;">Registered Address:</strong> ${escapePdfText(model.agencyRegisteredAddress.replace(/\r?\n/g, ', '))}`);
      }
      if (model.agencyCurrentAddress) {
        wlLines.push(`<strong style="color: #334155;">Current Address:</strong> ${escapePdfText(model.agencyCurrentAddress.replace(/\r?\n/g, ', '))}`);
      } else if (model.agencyAddress && model.agencyAddress !== model.agencyRegisteredAddress) {
        wlLines.push(`<strong style="color: #334155;">Office Address:</strong> ${escapePdfText(model.agencyAddress.replace(/\r?\n/g, ', '))}`);
      }
    }
    if (wlLines.length > 0) {
      addressRowsHtml = `
        <div style="font-size: 8.2px; color: #475569; line-height: 1.38; margin-top: 3px; word-break: break-word;">
          ${wlLines.map(l => `<div>${l}</div>`).join('')}
        </div>
      `;
    }
  }

  return `
    <div data-pdf-footer="true" style="border-top: 1px solid #cbd5e1; padding-top: 7px; margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #475569; box-sizing: border-box;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; gap: 12px; font-size: 9px; line-height: 1.35;">
        <div style="min-width: 0; font-family: monospace; color: #64748b; word-break: break-word;">
          <strong style="color: #0f172a;">${escapePdfText(brandLabel)}</strong>
          <span> • </span>
          <span style="color: #334155; font-weight: 700;">${escapePdfText(model.quoteNumber)} (v${model.version})</span>
          ${contactBits.length > 0 ? `<span> • ${contactBits.join(' • ')}</span>` : ''}
        </div>
        <div style="font-family: monospace; font-weight: 800; color: #0f172a; white-space: nowrap; flex-shrink: 0; font-size: 9.5px;">
          Page ${pageNumber} of ${totalPages}
        </div>
      </div>
      ${addressRowsHtml}
    </div>
  `;
}

/**
 * Measure exact Header and Footer heights in real browser DOM, or compute accurate line-wrapped estimates in Node.
 */
export function measureHeaderAndFooterHeights(model: QuotePresentationModel): {
  headerHeightContinuation: number;
  footerHeight: number;
} {
  const sampleHeaderHtml = buildPageHeaderHtml(model, 2);
  const sampleFooterHtml = buildPageFooterHtml(model, 99, 99);

  if (typeof document !== 'undefined' && document.body) {
    const container = document.createElement('div');
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = `${CONTENT_WIDTH_PX}px`;
    container.style.visibility = 'hidden';
    container.style.pointerEvents = 'none';
    container.style.boxSizing = 'border-box';
    container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    document.body.appendChild(container);
    try {
      container.innerHTML = sampleHeaderHtml;
      const measuredHeader = Math.ceil(container.getBoundingClientRect().height);
      container.innerHTML = sampleFooterHtml;
      const measuredFooter = Math.ceil(container.getBoundingClientRect().height);
      return {
        headerHeightContinuation: Math.max(30, measuredHeader),
        footerHeight: Math.max(36, measuredFooter)
      };
    } finally {
      container.parentNode?.removeChild(container);
    }
  }

  // Deterministic multi-line fallback estimation for non-DOM environments
  const charsPerLineFooterMeta = 102;
  const topLineLen = [
    model.agencyName,
    model.quoteNumber,
    model.agentEmail,
    model.agentPhone,
    model.footerRightTitle
  ]
    .filter(Boolean)
    .join(' • ').length + 14;
  const topLines = Math.max(1, Math.ceil(topLineLen / charsPerLineFooterMeta));

  let addressLines = 0;
  if (!model.isWhiteLabel) {
    const reg = (model.agencyRegisteredAddress || THEUNBOUND_REGISTERED_ADDRESS).replace(/\r?\n/g, ', ');
    const cur = (model.agencyCurrentAddress || THEUNBOUND_CURRENT_ADDRESS).replace(/\r?\n/g, ', ');
    addressLines += Math.max(1, Math.ceil((`Registered Address: ${reg}`).length / 118));
    addressLines += Math.max(1, Math.ceil((`Current Address: ${cur}`).length / 118));
  } else {
    if (model.customFooterText) {
      addressLines += Math.max(1, Math.ceil(model.customFooterText.length / 118));
    } else {
      if (model.agencyRegisteredAddress) {
        addressLines += Math.max(1, Math.ceil((`Registered Address: ${model.agencyRegisteredAddress}`).length / 118));
      }
      if (model.agencyCurrentAddress || model.agencyAddress) {
        addressLines += Math.max(1, Math.ceil((`Current Address: ${model.agencyCurrentAddress || model.agencyAddress}`).length / 118));
      }
    }
  }

  const estFooterHeight = 14 + topLines * 14 + (addressLines > 0 ? 4 + addressLines * 13 : 0);
  return {
    headerHeightContinuation: 34,
    footerHeight: Math.max(36, estFooterHeight)
  };
}

/**
 * Split long text at a natural paragraph, line, sentence, or word boundary so neither part is truncated.
 */
export function splitTextNaturally(text: string, targetFirstPartChars: number = 170): [string, string] {
  const trimmed = (text || '').trim();
  if (trimmed.length <= targetFirstPartChars) {
    return [trimmed, ''];
  }

  const safeTarget = Math.max(60, Math.min(targetFirstPartChars, trimmed.length - 25));
  const minIdx = Math.max(30, Math.floor(safeTarget * 0.6));
  const maxIdx = Math.min(trimmed.length - 15, Math.floor(safeTarget * 1.15));

  let splitIdx = -1;
  const slice = trimmed.slice(minIdx, maxIdx);

  const dblNewlinePos = slice.lastIndexOf('\n\n');
  if (dblNewlinePos !== -1) {
    splitIdx = minIdx + dblNewlinePos;
  } else {
    const newlinePos = slice.lastIndexOf('\n');
    if (newlinePos !== -1) {
      splitIdx = minIdx + newlinePos;
    } else {
      const periodPos = slice.lastIndexOf('. ');
      if (periodPos !== -1) {
        splitIdx = minIdx + periodPos + 1;
      } else {
        const spacePos = trimmed.lastIndexOf(' ', maxIdx);
        splitIdx = spacePos >= minIdx ? spacePos : safeTarget;
      }
    }
  }

  const first = trimmed.slice(0, splitIdx).trim();
  const second = trimmed.slice(splitIdx).trim();
  return [first, second];
}

/**
 * Split overview content into natural paragraph/line segments without discarding any text or breaking HTML tags.
 */
function extractOverviewSegments(rawOverview: string): string[] {
  const raw = (rawOverview || '').trim();
  if (!raw || !hasMeaningfulHtmlContent(raw)) return [];

  const isHtml = /<[a-z][\s\S]*>/i.test(raw);
  if (isHtml) {
    // Extract top-level paragraph/list/div/heading/break-delimited pieces
    const normalized = raw
      .replace(/<\s*br\s*\/?>\s*<\s*br\s*\/?>/gi, '</p><p>')
      .replace(/(<\/(?:p|div|h[1-6]|ul|ol|blockquote|table)>)/gi, '$1\n__SEG__');
    const rawSegs = normalized
      .split('\n__SEG__')
      .map(s => s.trim())
      .filter(s => hasMeaningfulHtmlContent(s));

    if (rawSegs.length > 1) {
      return rawSegs;
    }

    // Fallback: split on <br> if it's a single large block with <br> breaks
    const brParts = raw
      .split(/<\s*br\s*\/?>/gi)
      .map(s => s.trim())
      .filter(s => hasMeaningfulHtmlContent(s));
    if (brParts.length > 1) {
      return brParts;
    }
    return [raw];
  }

  // Plain text with line breaks
  const lines = raw.split(/\r?\n/);
  const segments: string[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length > 0) {
      const joined = buffer.join('<br/>');
      if (hasMeaningfulHtmlContent(joined)) {
        segments.push(joined);
      }
      buffer = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      flush();
      continue;
    }
    if (buffer.length >= 2 || trimmed.length > 180) {
      flush();
    }
    buffer.push(escapePdfText(trimmed));
  }
  flush();

  // Further split very long single plain segments cleanly at sentence boundaries
  const finalSegments: string[] = [];
  for (const seg of segments) {
    const plainLen = stripHtmlTagsAndEntities(seg).length;
    if (plainLen <= 360 || /<(?:ul|ol|table|p)\b/i.test(seg)) {
      finalSegments.push(seg);
    } else {
      let rem = seg;
      while (stripHtmlTagsAndEntities(rem).length > 360) {
        const [first, rest] = splitTextNaturally(rem, 300);
        if (!first || !rest) break;
        finalSegments.push(first);
        rem = rest;
      }
      if (rem) finalSegments.push(rem);
    }
  }

  return finalSegments.length > 0 ? finalSegments : [escapePdfText(raw)];
}

/**
 * Format overview HTML safely so plain newlines render with line breaks instead of collapsing.
 */
function formatOverviewSegmentsHtml(segments: string[]): string {
  return segments
    .map(seg => {
      if (/^\s*<(?:p|div|ul|ol|h[1-6]|table|blockquote)\b/i.test(seg)) {
        return seg;
      }
      return `<div style="margin-bottom: 4px;">${seg}</div>`;
    })
    .join('');
}

/**
 * Estimate accurate rendering height of a Service card based on real characters/line wraps.
 */
export function estimateServiceCardHeight(s: ServicePresentationItem): number {
  let height = 92; // Card padding + title + badges + margin-bottom
  if (s.configurationSummary && !s.isRail) height += 20;
  if (s.meetingPoint || s.pickupPoint || s.dropoffPoint) height += 28;
  if (s.isRail && s.railDetails) height += 66;
  if (s.overview && hasMeaningfulHtmlContent(s.overview)) {
    const segments = extractOverviewSegments(s.overview);
    let overviewH = 22;
    for (const seg of segments) {
      const plainLen = stripHtmlTagsAndEntities(seg).length;
      const brCount = (seg.match(/<br\s*\/?>/gi) || []).length;
      const lines = Math.max(1 + brCount, Math.ceil(plainLen / 78) + brCount);
      overviewH += lines * 15.5 + 4;
    }
    height += overviewH;
  }
  if (s.inclusions && s.inclusions.length > 0) {
    const totalChars = s.inclusions.reduce((sum, x) => sum + x.length + 6, 0);
    const incRows = Math.max(1, Math.ceil(totalChars / 82));
    height += 22 + incRows * 24;
  }
  if (s.exclusions && s.exclusions.length > 0) {
    const totalChars = s.exclusions.reduce((sum, x) => sum + x.length + 6, 0);
    const excRows = Math.max(1, Math.ceil(totalChars / 82));
    height += 22 + excRows * 24;
  }
  if (s.specialInstructions) {
    const instLines = Math.max(1, Math.ceil(stripHtmlTagsAndEntities(s.specialInstructions).length / 76));
    height += 24 + instLines * 16;
  }
  return Math.max(height, 125);
}

/**
 * Compute the minimum height required to start a Day section (`MIN_DAY_START_HEIGHT`).
 * Guarantees Day Header + Day Overview + at least the start of the first service stay on the same page.
 */
export function computeMinimumDayStartHeight(
  dayHeaderBlock: PaginationBlock,
  firstContentBlock?: PaginationBlock,
  secondContentBlock?: PaginationBlock
): number {
  if (!firstContentBlock) {
    return Math.max(MIN_DAY_START_HEIGHT, dayHeaderBlock.estimatedHeight + 85);
  }

  if (firstContentBlock.type === 'DAY_OVERVIEW_BLOCK' && secondContentBlock) {
    const secondMinHeight = secondContentBlock.splittable
      ? secondContentBlock.minMeaningfulHeight
      : secondContentBlock.estimatedHeight;
    return Math.max(
      MIN_DAY_START_HEIGHT,
      dayHeaderBlock.estimatedHeight + firstContentBlock.estimatedHeight + secondMinHeight
    );
  }

  const firstMinHeight = firstContentBlock.splittable
    ? firstContentBlock.minMeaningfulHeight
    : firstContentBlock.estimatedHeight;

  return Math.max(MIN_DAY_START_HEIGHT, dayHeaderBlock.estimatedHeight + firstMinHeight);
}

/**
 * Create a canonical Day Continuation Header block (`CONTINUE DAY X`).
 */
export function createContinueDayHeaderBlock(
  day: DayPresentationData,
  continuationSeq: number = 1
): PaginationBlock {
  return {
    id: `block-day-${day.dayNumber}-continuation-${continuationSeq}`,
    type: 'DAY_CONTINUATION_HEADER',
    html: `
      <div data-day-id="${day.dayId}" data-day-continuation="${day.dayNumber}" style="background: #1e293b; color: #ffffff; padding: 7px 14px; border-radius: 10px; display: flex; justify-content: space-between; align-items: center; margin-top: 2px; margin-bottom: 10px; font-size: 10.5px; border-left: 4px solid #00E5C0;">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span style="font-weight: 900; color: #00E5C0; letter-spacing: 0.04em;">CONTINUE DAY ${day.dayNumber}</span>
          <span style="color: #94a3b8;">•</span>
          <span style="color: #cbd5e1; font-weight: 600;">${escapePdfText(day.dayOfWeek)}, ${escapePdfText(day.formattedDate)} (${escapePdfText(day.hubName)} Base)</span>
        </div>
        <span style="font-family: monospace; color: #94a3b8; font-size: 9.5px;">DAY ${String(day.dayNumber).padStart(2, '0')} · CONTINUED</span>
      </div>
    `,
    estimatedHeight: 42,
    splittable: false,
    minMeaningfulHeight: 42,
    keepWithNext: true,
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

function renderServiceSecondaryHtml(s: ServicePresentationItem): {
  operationalPointsHtml: string;
  railBoxHtml: string;
  inclusionsHtml: string;
  exclusionsHtml: string;
  specialInstructionsHtml: string;
} {
  const operationalPointsHtml = (s.meetingPoint || s.pickupPoint || s.dropoffPoint) ? `
    <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 5px 0; font-size: 9.5px; color: #334155;">
      ${s.meetingPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;"><strong>Meeting Point:</strong> ${escapePdfText(s.meetingPoint)}</span>` : ''}
      ${s.pickupPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;"><strong>Pickup:</strong> ${escapePdfText(s.pickupPoint)}</span>` : ''}
      ${s.dropoffPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1;"><strong>Drop-off:</strong> ${escapePdfText(s.dropoffPoint)}</span>` : ''}
    </div>
  ` : '';

  const railBoxHtml = (s.isRail && s.railDetails) ? `
    <div style="margin: 6px 0; padding: 8px 10px; border-radius: 8px; background: #eef2ff; border: 1px solid #c7d2fe; font-size: 10.5px; color: #312e81;">
      <div style="font-weight: 700; margin-bottom: 2px;">
        🚄 Bullet Train: ${escapePdfText(s.railDetails.origin)} → ${escapePdfText(s.railDetails.destination)} • ${escapePdfText(s.railDetails.carType)} (${escapePdfText(s.railDetails.seatType)})
      </div>
      <div style="font-size: 9.5px; color: #4338ca; display: flex; gap: 10px;">
        ${s.railDetails.seatPreference ? `<span>Seat: <strong>${escapePdfText(s.railDetails.seatPreference)}</strong></span>` : ''}
        ${s.railDetails.pnrReference ? `<span>SmartEX PNR: <strong style="font-family: monospace;">${escapePdfText(s.railDetails.pnrReference)}</strong></span>` : ''}
      </div>
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

  return { operationalPointsHtml, railBoxHtml, inclusionsHtml, exclusionsHtml, specialInstructionsHtml };
}

function renderServiceChunkHtml(
  s: ServicePresentationItem,
  day: DayPresentationData,
  segments: string[],
  options: {
    mode: 'FULL' | 'FIRST' | 'MIDDLE' | 'REMAINING';
    overviewContinuedHeader: boolean;
    includeDetailsFooter: boolean;
  }
): string {
  const { operationalPointsHtml, railBoxHtml, inclusionsHtml, exclusionsHtml, specialInstructionsHtml } =
    renderServiceSecondaryHtml(s);

  const overviewBlockHtml = segments.length > 0 ? `
    <div style="margin-top: 5px;">
      <span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">
        ${options.overviewContinuedHeader ? 'Overview (Continued)' : 'Overview'}
      </span>
      <div style="font-size: 10.5px; color: #334155; line-height: 1.42; word-break: break-word;">${formatOverviewSegmentsHtml(segments)}</div>
    </div>
  ` : '';

  const splitAttr = options.mode === 'FULL' ? '' : ` data-split-part="${options.mode.toLowerCase()}"`;

  if (options.mode === 'FULL' || options.mode === 'FIRST') {
    return `
      <div data-day-id="${day.dayId}" data-service-id="${s.id}"${splitAttr} style="padding: 12px 14px; border-radius: 12px; background: ${s.badgeBg}18; border: 1px solid ${s.badgeBg}; display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; box-sizing: border-box;">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
            <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${s.badgeBg}; color: ${s.badgeText};">
              ${escapePdfText(s.categoryLabel)}
            </span>
            ${s.duration ? `<span style="font-size: 10px; color: #475569;">⏱️ ${escapePdfText(s.duration)}</span>` : ''}
            ${s.serviceTime ? `<span style="font-size: 10px; font-family: monospace; font-weight: 600; color: #334155; background: #ffffff; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">${escapePdfText(s.serviceTime)}</span>` : ''}
          </div>
          <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 0 0 4px 0;">${s.listingName}</h4>
          ${s.configurationSummary && !s.isRail ? `<p style="font-size: 10.5px; color: #475569; margin: 0 0 5px 0; font-weight: 500;">${escapePdfText(s.configurationSummary)}</p>` : ''}
          ${operationalPointsHtml}
          ${railBoxHtml}
          ${overviewBlockHtml}
          ${options.includeDetailsFooter ? `${inclusionsHtml}${exclusionsHtml}${specialInstructionsHtml}` : ''}
        </div>
        <div style="text-align: right; min-width: 90px; flex-shrink: 0;">
          <span style="display: inline-block; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #047857; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Confirmed</span>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 4px;">${escapePdfText(s.paxText)}</div>
        </div>
      </div>
    `;
  }

  return `
    <div data-day-id="${day.dayId}" data-service-id="${s.id}"${splitAttr} style="padding: 12px 14px; border-radius: 12px; background: ${s.badgeBg}18; border: 1px solid ${s.badgeBg}; margin-bottom: 10px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed ${s.badgeBg};">
        <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
          <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${s.badgeBg}; color: ${s.badgeText}; flex-shrink: 0;">
            ${escapePdfText(s.categoryLabel)}
          </span>
          <h4 style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 0;">${s.listingName} — continued</h4>
        </div>
        <span style="font-size: 9px; font-family: monospace; color: #64748b; font-weight: 600; flex-shrink: 0;">Activity Details Continued</span>
      </div>
      ${overviewBlockHtml}
      ${options.includeDetailsFooter ? `${inclusionsHtml}${exclusionsHtml}${specialInstructionsHtml}` : ''}
    </div>
  `;
}

function measureSingleBlockHtmlHeight(html: string, fallbackEstimate: number): number {
  if (typeof document === 'undefined' || !document.body) {
    return fallbackEstimate;
  }
  const box = document.createElement('div');
  box.style.position = 'fixed';
  box.style.left = '-9999px';
  box.style.top = '0';
  box.style.width = `${CONTENT_WIDTH_PX}px`;
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.visibility = 'hidden';
  box.style.pointerEvents = 'none';
  box.style.boxSizing = 'border-box';
  box.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  box.innerHTML = html;
  document.body.appendChild(box);
  try {
    const h = Math.ceil(box.getBoundingClientRect().height);
    return h > 0 ? h + 4 : fallbackEstimate;
  } finally {
    box.parentNode?.removeChild(box);
  }
}

function estimatePartialServiceHeight(
  s: ServicePresentationItem,
  segments: string[],
  isFirstHeader: boolean,
  includeDetailsFooter: boolean
): number {
  let height = isFirstHeader ? 86 : 56;
  if (isFirstHeader) {
    if (s.configurationSummary && !s.isRail) height += 20;
    if (s.meetingPoint || s.pickupPoint || s.dropoffPoint) height += 28;
    if (s.isRail && s.railDetails) height += 66;
  }
  if (segments.length > 0) {
    height += 20;
    for (const seg of segments) {
      const plainLen = stripHtmlTagsAndEntities(seg).length;
      const brCount = (seg.match(/<br\s*\/?>/gi) || []).length;
      const lines = Math.max(1 + brCount, Math.ceil(plainLen / 78) + brCount);
      height += lines * 15.5 + 4;
    }
  }
  if (includeDetailsFooter) {
    if (s.inclusions.length > 0) {
      const totalChars = s.inclusions.reduce((sum, x) => sum + x.length + 6, 0);
      height += 22 + Math.max(1, Math.ceil(totalChars / 82)) * 24;
    }
    if (s.exclusions.length > 0) {
      const totalChars = s.exclusions.reduce((sum, x) => sum + x.length + 6, 0);
      height += 22 + Math.max(1, Math.ceil(totalChars / 82)) * 24;
    }
    if (s.specialInstructions) {
      const instLines = Math.max(1, Math.ceil(stripHtmlTagsAndEntities(s.specialInstructions).length / 76));
      height += 24 + instLines * 16;
    }
  }
  return Math.max(height, isFirstHeader ? MIN_ACTIVITY_START_HEIGHT : 75);
}

/**
 * Dynamically split an oversized Service Block (or its remainder) to fit inside `targetMaxHeightPx`.
 * Returns `null` if even the smallest meaningful first slice exceeds `targetMaxHeightPx`.
 */
function splitServiceBlockToFitHeight(
  block: PaginationBlock,
  day: DayPresentationData,
  targetMaxHeightPx: number
): { fitBlock: PaginationBlock; remainderBlock: PaginationBlock } | null {
  const s = block.serviceData;
  if (!s) return null;

  const isFirstHeader = block.isSplitPart !== 'MIDDLE' && block.isSplitPart !== 'REMAINING';
  const segments = block.overviewSegments ?? extractOverviewSegments(s.overview);
  const hasSecondaryDetails = s.inclusions.length > 0 || s.exclusions.length > 0 || Boolean(s.specialInstructions);

  // Try progressively fewer overview segments until the card chunk fits inside targetMaxHeightPx
  let bestCut = -1;

  for (let cut = segments.length; cut >= 0; cut--) {
    // Must leave something for the remainder chunk!
    if (cut === segments.length && !hasSecondaryDetails) continue;
    // If there are no secondary details, require at least 1 segment in first slice
    if (cut === 0 && !isFirstHeader) continue;
    if (cut === 0 && isFirstHeader && !s.isRail && !(s.meetingPoint || s.pickupPoint || s.dropoffPoint)) {
      continue;
    }

    const firstSegments = segments.slice(0, cut);
    const candidateHtml = renderServiceChunkHtml(s, day, firstSegments, {
      mode: isFirstHeader ? 'FIRST' : 'MIDDLE',
      overviewContinuedHeader: !isFirstHeader && Boolean(block.overviewIsContinued),
      includeDetailsFooter: false
    });
    const estH = estimatePartialServiceHeight(s, firstSegments, isFirstHeader, false);
    const realH = measureSingleBlockHtmlHeight(candidateHtml, estH);

    if (realH <= targetMaxHeightPx) {
      bestCut = cut;
      break;
    }
  }

  if (bestCut === -1) {
    return null;
  }

  const fitSegments = segments.slice(0, bestCut);
  const remSegments = segments.slice(bestCut);

  const fitHtml = renderServiceChunkHtml(s, day, fitSegments, {
    mode: isFirstHeader ? 'FIRST' : 'MIDDLE',
    overviewContinuedHeader: !isFirstHeader && Boolean(block.overviewIsContinued),
    includeDetailsFooter: false
  });
  const fitHeight = measureSingleBlockHtmlHeight(
    fitHtml,
    estimatePartialServiceHeight(s, fitSegments, isFirstHeader, false)
  );

  const remHasOverviewBefore = fitSegments.length > 0 || Boolean(block.overviewIsContinued);
  const remHtml = renderServiceChunkHtml(s, day, remSegments, {
    mode: 'REMAINING',
    overviewContinuedHeader: remHasOverviewBefore && remSegments.length > 0,
    includeDetailsFooter: hasSecondaryDetails
  });
  const remHeight = measureSingleBlockHtmlHeight(
    remHtml,
    estimatePartialServiceHeight(s, remSegments, false, hasSecondaryDetails)
  );

  const sIdx = block.serviceIndex ?? 0;

  const fitBlock: PaginationBlock = {
    ...block,
    id: `${block.id}-fit`,
    type: isFirstHeader ? 'DAY_SERVICE_CARD' : 'DAY_SERVICE_CONTINUATION',
    html: fitHtml,
    estimatedHeight: fitHeight,
    splittable: false,
    minMeaningfulHeight: fitHeight,
    serviceData: s,
    overviewSegments: fitSegments,
    isSplitPart: isFirstHeader ? 'FIRST' : 'MIDDLE'
  };

  const remainderBlock: PaginationBlock = {
    ...block,
    id: `block-day-${day.dayNumber}-service-${sIdx}-rem-${fitSegments.length}`,
    type: 'DAY_SERVICE_CONTINUATION',
    html: remHtml,
    estimatedHeight: remHeight,
    splittable: remSegments.length > 1,
    minMeaningfulHeight: 90,
    serviceData: s,
    overviewSegments: remSegments,
    overviewIsContinued: remHasOverviewBefore,
    includeSecondaryOnRemainder: hasSecondaryDetails,
    isSplitPart: 'REMAINING'
  };

  return { fitBlock, remainderBlock };
}

/**
 * Build a Day Service Card block (along with baseline `splitParts` and `overviewSegments` for dynamic splitting).
 */
function buildDayServiceCardBlock(
  s: ServicePresentationItem,
  day: DayPresentationData,
  sIdx: number
): PaginationBlock {
  const overviewSegments = extractOverviewSegments(s.overview);
  const fullCardHtml = renderServiceChunkHtml(s, day, overviewSegments, {
    mode: 'FULL',
    overviewContinuedHeader: false,
    includeDetailsFooter: true
  });
  const fullHeight = estimateServiceCardHeight(s);

  const hasSecondaryDetails = s.inclusions.length > 0 || s.exclusions.length > 0 || Boolean(s.specialInstructions);
  const hasRailAndOverview = Boolean(s.isRail && s.railDetails && overviewSegments.length > 0);
  const hasLongOverview = overviewSegments.length > 1 || stripHtmlTagsAndEntities(s.overview).length > 160;
  const canSplit = hasSecondaryDetails || hasRailAndOverview || hasLongOverview;

  let splitParts: SplitBlockParts | undefined;
  let minMeaningfulHeight = fullHeight;

  if (canSplit) {
    const firstCut = overviewSegments.length > 1 ? Math.max(1, Math.min(2, Math.floor(overviewSegments.length / 2))) : (hasSecondaryDetails ? overviewSegments.length : 1);
    const firstSegs = overviewSegments.slice(0, hasSecondaryDetails && overviewSegments.length <= 2 ? overviewSegments.length : firstCut);
    const remSegs = overviewSegments.slice(firstSegs.length);

    const firstPartHtml = renderServiceChunkHtml(s, day, firstSegs, {
      mode: 'FIRST',
      overviewContinuedHeader: false,
      includeDetailsFooter: false
    });
    const remainingPartHtml = renderServiceChunkHtml(s, day, remSegs, {
      mode: 'REMAINING',
      overviewContinuedHeader: firstSegs.length > 0 && remSegs.length > 0,
      includeDetailsFooter: hasSecondaryDetails
    });

    const firstEst = estimatePartialServiceHeight(s, firstSegs, true, false);
    const remEst = estimatePartialServiceHeight(s, remSegs, false, hasSecondaryDetails);

    // Minimum meaningful start = header + up to 1 segment
    const minSegs = overviewSegments.slice(0, 1);
    minMeaningfulHeight = Math.max(
      MIN_ACTIVITY_START_HEIGHT,
      Math.min(firstEst, estimatePartialServiceHeight(s, minSegs, true, false))
    );

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
        serviceData: s,
        overviewSegments: firstSegs,
        isSplitPart: 'FIRST'
      },
      remainingPart: {
        id: `block-day-${day.dayNumber}-service-${sIdx}-part-2`,
        type: 'DAY_SERVICE_CONTINUATION',
        html: remainingPartHtml,
        estimatedHeight: remEst,
        splittable: remSegs.length > 1,
        minMeaningfulHeight: remEst,
        dayId: day.dayId,
        dayNumber: day.dayNumber,
        serviceId: s.id,
        serviceIndex: sIdx,
        serviceData: s,
        overviewSegments: remSegs,
        overviewIsContinued: firstSegs.length > 0,
        includeSecondaryOnRemainder: hasSecondaryDetails,
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
    serviceData: s,
    overviewSegments,
    splitParts
  };
}

// ============================================================================
// COMMERCIAL QUOTATION TERMS RICH-HTML DECOMPOSER (FIX FOR PAGE 16 OVERLAP)
// ============================================================================

const normalizePdfTermsStyles = (html: string): string => {
  return String(html || '')
    .replace(/<table(\s|>)/gi, '<table style="width: 100%; border-collapse: collapse; margin: 4px 0 6px 0; font-size: 9.5px; border: 1px solid #cbd5e1;"$1')
    .replace(/<th(\s|>)/gi, '<th style="border: 1px solid #cbd5e1; background: #f1f5f9; padding: 5px 7px; text-align: left; font-weight: 700; color: #0f172a; vertical-align: top;"$1')
    .replace(/<td(\s|>)/gi, '<td style="border: 1px solid #cbd5e1; padding: 5px 7px; color: #334155; vertical-align: top; word-break: break-word;"$1')
    .replace(/<ul(\s|>)/gi, '<ul style="margin: 2px 0 4px 0; padding-left: 18px; list-style-type: disc;"$1')
    .replace(/<ol(\s|>)/gi, '<ol style="margin: 2px 0 4px 0; padding-left: 18px; list-style-type: decimal;"$1')
    .replace(/<li(\s|>)/gi, '<li style="margin-bottom: 2px; line-height: 1.42;"$1')
    .replace(/<a(\s|>)/gi, '<a style="color: #0284c7; text-decoration: underline;"$1');
};

function isLikelyTermHeadingText(plain: string, isHeadingTag: boolean, hadStrongWrapper: boolean): boolean {
  if (!plain || plain.length > 140) return false;
  if (isHeadingTag) return true;
  // Numbered or lettered term subheadings e.g. "1. Payment Policy", "14. Tours", "15. Shinkansen Luggage Policy", "A. Small to Medium Bags..."
  if (/^(?:\d{1,2}\.|[A-Z]\.)\s+\S/.test(plain) && plain.length <= 115 && !/[.!?]$/.test(plain.replace(/\([^)]*\)$/, '').trim())) {
    return true;
  }
  if (hadStrongWrapper && plain.length <= 85) {
    return true;
  }
  return false;
}

function estimateHtmlUnitHeight(html: string): number {
  const plainLen = stripHtmlTagsAndEntities(html).length;
  const tableRows = (html.match(/<tr\b/gi) || []).length;
  const listItems = (html.match(/<li\b/gi) || []).length;
  const brCount = (html.match(/<br\s*\/?>/gi) || []).length;
  const lines = Math.max(1 + brCount, Math.ceil(plainLen / 95) + brCount);
  return Math.max(18, 6 + lines * 14 + tableRows * 24 + listItems * 4);
}

interface TermFragment {
  html: string;
  keepWithNext: boolean;
  estimatedHeight: number;
}

/**
 * Splits an HTML table at row (`<tr>`) boundaries, repeating its header rows (`<thead>` or leading `<th>` rows)
 * on every chunk so long tables span pages cleanly without breaking inside any row.
 */
function splitHtmlTableIntoRowChunks(tableHtml: string, rowsPerChunk: number = 6): TermFragment[] {
  const allRows = tableHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  if (allRows.length <= rowsPerChunk + 1) {
    const styled = normalizePdfTermsStyles(tableHtml);
    return [{
      html: styled,
      keepWithNext: false,
      estimatedHeight: estimateHtmlTableHeight(styled, allRows.length)
    }];
  }

  // Separate header row(s)
  let headerRows: string[] = [];
  let bodyRows: string[] = [];
  const theadMatch = tableHtml.match(/<thead\b[^>]*>([\s\S]*?)<\/thead>/i);
  if (theadMatch) {
    headerRows = theadMatch[1].match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
    const withoutThead = tableHtml.replace(/<thead\b[^>]*>[\s\S]*?<\/thead>/i, '');
    bodyRows = withoutThead.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];
  } else {
    allRows.forEach((r, idx) => {
      if (idx === 0 && /<th\b/i.test(r)) {
        headerRows.push(r);
      } else {
        bodyRows.push(r);
      }
    });
  }

  if (bodyRows.length <= rowsPerChunk) {
    const styled = normalizePdfTermsStyles(tableHtml);
    return [{
      html: styled,
      keepWithNext: false,
      estimatedHeight: estimateHtmlTableHeight(styled, allRows.length)
    }];
  }

  const chunks: TermFragment[] = [];
  const theadHtml = headerRows.length > 0 ? `<thead>${headerRows.join('')}</thead>` : '';

  for (let i = 0; i < bodyRows.length; i += rowsPerChunk) {
    const slice = bodyRows.slice(i, i + rowsPerChunk);
    const chunkTable = normalizePdfTermsStyles(
      `<table>${theadHtml}<tbody>${slice.join('')}</tbody></table>`
    );
    chunks.push({
      html: chunkTable,
      keepWithNext: false,
      estimatedHeight: estimateHtmlTableHeight(chunkTable, headerRows.length + slice.length)
    });
  }
  return chunks;
}

function estimateHtmlTableHeight(styledTableHtml: string, rowCount: number): number {
  const plainLen = stripHtmlTagsAndEntities(styledTableHtml).length;
  const avgCharsPerRow = rowCount > 0 ? plainLen / rowCount : plainLen;
  const extraLinesPerRow = Math.max(0, Math.ceil(avgCharsPerRow / 65) - 1);
  return Math.max(46, 16 + rowCount * (24 + extraLinesPerRow * 12));
}

/**
 * Splits a long <ul> or <ol> list into smaller <li> chunks preserving indentation and numbering.
 */
function splitHtmlListIntoChunks(listHtml: string, itemsPerChunk: number = 5): TermFragment[] {
  const isOrdered = /^\s*<ol\b/i.test(listHtml);
  const tag = isOrdered ? 'ol' : 'ul';
  const items = listHtml.match(/<li\b[\s\S]*?<\/li>/gi) || [];
  if (items.length <= itemsPerChunk) {
    const styled = normalizePdfTermsStyles(listHtml);
    return [{
      html: styled,
      keepWithNext: false,
      estimatedHeight: estimateHtmlUnitHeight(styled)
    }];
  }

  const chunks: TermFragment[] = [];
  for (let i = 0; i < items.length; i += itemsPerChunk) {
    const slice = items.slice(i, i + itemsPerChunk);
    const startAttr = isOrdered ? ` start="${i + 1}"` : '';
    const chunkList = normalizePdfTermsStyles(`<${tag}${startAttr}>${slice.join('')}</${tag}>`);
    chunks.push({
      html: chunkList,
      keepWithNext: false,
      estimatedHeight: estimateHtmlUnitHeight(chunkList)
    });
  }
  return chunks;
}

/**
 * Extracts granular block elements from arbitrary HTML (supporting nested wrappers and <br>-delimited subheadings).
 */
function extractTopLevelHtmlFragments(rawHtml: string): string[] {
  const input = String(rawHtml || '').trim();
  if (!input) return [];

  if (!/<[a-z][\s\S]*>/i.test(input)) {
    return input
      .split(/\r?\n\s*\r?\n/)
      .map(p => `<p style="margin: 0 0 4px 0;">${escapePdfText(p.trim()).replace(/\r?\n/g, '<br/>')}</p>`)
      .filter(p => hasMeaningfulHtmlContent(p));
  }

  if (typeof document !== 'undefined' && typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${input}</div>`, 'text/html');
    const root = doc.body.firstElementChild || doc.body;
    const fragments: string[] = [];

    const collectFromNode = (node: Node) => {
      node.childNodes.forEach((child) => {
        if (child.nodeType === 3) {
          const text = (child.textContent || '').trim();
          if (text) {
            fragments.push(`<p style="margin: 0 0 4px 0;">${escapePdfText(text)}</p>`);
          }
          return;
        }
        if (child.nodeType !== 1) return;
        const el = child as HTMLElement;
        const tag = el.tagName.toLowerCase();
        if (tag === 'br') return;

        if (tag === 'div' || tag === 'section' || tag === 'article') {
          const hasBlockChildren = Array.from(el.children).some(c =>
            ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote', 'section'].includes(
              c.tagName.toLowerCase()
            )
          );
          if (hasBlockChildren) {
            collectFromNode(el);
            return;
          }
        }
        if (hasMeaningfulHtmlContent(el.outerHTML)) {
          fragments.push(el.outerHTML);
        }
      });
    };

    collectFromNode(root);
    return fragments.length > 0 ? fragments : [input];
  }

  // Deterministic Node/SSR HTML block token extractor (balanced tag scanning)
  const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote', 'section', 'article', 'hr']);
  const fragments: string[] = [];

  const scanTopBlocks = (htmlStr: string): string[] => {
    const out: string[] = [];
    let cursor = 0;
    const len = htmlStr.length;

    while (cursor < len) {
      const nextTagIdx = htmlStr.indexOf('<', cursor);
      if (nextTagIdx === -1) {
        const tailText = htmlStr.slice(cursor).trim();
        if (tailText) out.push(`<p style="margin: 0 0 4px 0;">${tailText}</p>`);
        break;
      }

      if (nextTagIdx > cursor) {
        const leadingText = htmlStr.slice(cursor, nextTagIdx).trim();
        if (leadingText) out.push(`<p style="margin: 0 0 4px 0;">${leadingText}</p>`);
      }

      const tagEndIdx = htmlStr.indexOf('>', nextTagIdx);
      if (tagEndIdx === -1) break;
      const openTagRaw = htmlStr.slice(nextTagIdx, tagEndIdx + 1);
      const tagMatch = openTagRaw.match(/^<\s*(\/?)([a-zA-Z0-9]+)/);
      if (!tagMatch) {
        cursor = tagEndIdx + 1;
        continue;
      }

      const isClosing = tagMatch[1] === '/';
      const tagName = tagMatch[2].toLowerCase();
      const isSelfClosing = /\/\s*>$/.test(openTagRaw) || tagName === 'br' || tagName === 'hr';

      if (isClosing || isSelfClosing || !blockTags.has(tagName)) {
        // Consume non-block inline chunk until next top-level block tag if needed
        if (!isClosing && !isSelfClosing && !blockTags.has(tagName)) {
          const closeMatchIdx = findMatchingCloseTag(htmlStr, tagName, tagEndIdx + 1);
          const inlineEnd = closeMatchIdx !== -1 ? closeMatchIdx : tagEndIdx + 1;
          const inlineChunk = htmlStr.slice(nextTagIdx, inlineEnd).trim();
          if (hasMeaningfulHtmlContent(inlineChunk)) {
            out.push(`<p style="margin: 0 0 4px 0;">${inlineChunk}</p>`);
          }
          cursor = inlineEnd;
          continue;
        }
        cursor = tagEndIdx + 1;
        continue;
      }

      const closeIdx = findMatchingCloseTag(htmlStr, tagName, tagEndIdx + 1);
      const endPos = closeIdx !== -1 ? closeIdx : len;
      const fullElement = htmlStr.slice(nextTagIdx, endPos);

      if ((tagName === 'div' || tagName === 'section' || tagName === 'article')) {
        const inner = fullElement.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>\s*$/, '');
        if (/<\s*(?:p|div|h[1-6]|ul|ol|table|blockquote|section)\b/i.test(inner)) {
          out.push(...scanTopBlocks(inner));
          cursor = endPos;
          continue;
        }
      }

      if (hasMeaningfulHtmlContent(fullElement)) {
        out.push(fullElement);
      }
      cursor = endPos;
    }

    return out;
  };

  const scanned = scanTopBlocks(input);
  fragments.push(...scanned);
  return fragments.length > 0 ? fragments : [input];
}

function findMatchingCloseTag(html: string, tagName: string, searchFrom: number): number {
  const regex = new RegExp(`<(\/?)${tagName}\\b[^>]*>`, 'gi');
  regex.lastIndex = searchFrom;
  let depth = 1;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(html)) !== null) {
    const raw = match[0];
    if (match[1] === '/') {
      depth--;
      if (depth === 0) {
        return match.index + raw.length;
      }
    } else if (!/\/\s*>$/.test(raw)) {
      depth++;
    }
  }
  return -1;
}

/**
 * Decomposes a Commercial Quotation Terms HTML section into page-breakable sub-blocks:
 * - Preserves numbered headings (keepWithNext: true) attached to their following paragraph/list/table.
 * - Splits tables cleanly at <tr> boundaries with repeated <thead>.
 * - Splits long lists between <li> items and long paragraphs at sentence boundaries.
 */
function decomposeRichTermsHtmlIntoBlocks(rawHtml: string): TermFragment[] {
  const topBlocks = extractTopLevelHtmlFragments(rawHtml);
  const results: TermFragment[] = [];

  for (const frag of topBlocks) {
    const trimmed = frag.trim();
    if (!hasMeaningfulHtmlContent(trimmed)) continue;

    // 1. Table block (never split inside a row; repeat header if multi-page)
    if (/^<table\b/i.test(trimmed)) {
      results.push(...splitHtmlTableIntoRowChunks(trimmed, 5));
      continue;
    }

    // 2. List block (<ul> / <ol>)
    if (/^<(?:ul|ol)\b/i.test(trimmed)) {
      results.push(...splitHtmlListIntoChunks(trimmed, 5));
      continue;
    }

    // 3. Explicit heading block (<h1>..<h6>)
    if (/^<h[1-6]\b/i.test(trimmed)) {
      const styledHeading = normalizePdfTermsStyles(trimmed).replace(
        /^<h([1-6])([^>]*)>/i,
        '<h$1$2 style="margin: 6px 0 3px 0; font-size: 10.2px; font-weight: 800; color: #0f172a; page-break-after: avoid; break-after: avoid;">'
      );
      results.push({
        html: styledHeading,
        keepWithNext: true,
        estimatedHeight: estimateHtmlUnitHeight(styledHeading)
      });
      continue;
    }

    // 4. Paragraph or single div: check if <br> breaks separate numbered sub-headings inside the same block!
    const innerContent = trimmed.replace(/^<(?:p|div)\b[^>]*>/i, '').replace(/<\/(?:p|div)>\s*$/i, '');
    const brSegments = /<br\s*\/?>/i.test(innerContent)
      ? innerContent.split(/<br\s*\/?>/gi).map(s => s.trim()).filter(s => hasMeaningfulHtmlContent(s))
      : [innerContent];

    for (const seg of brSegments) {
      const plain = stripHtmlTagsAndEntities(seg);
      const hadStrong = /^\s*<(?:strong|b)\b[\s\S]*<\/(?:strong|b)>\s*$/i.test(seg);
      const isHeading = isLikelyTermHeadingText(plain, false, hadStrong);

      if (isHeading) {
        const headingHtml = `<div style="font-weight: 800; color: #0f172a; font-size: 10px; margin: 5px 0 2px 0; line-height: 1.38; page-break-after: avoid; break-after: avoid;">${normalizePdfTermsStyles(seg)}</div>`;
        results.push({
          html: headingHtml,
          keepWithNext: true,
          estimatedHeight: estimateHtmlUnitHeight(headingHtml)
        });
      } else if (plain.length > 520 && !/<(?:a|table|ul|ol)\b/i.test(seg)) {
        // Long plain paragraph -> split into readable chunks cleanly at sentence boundary
        let remText = seg;
        while (stripHtmlTagsAndEntities(remText).length > 520) {
          const [p1, p2] = splitTextNaturally(remText, 380);
          if (!p1 || !p2) break;
          const pHtml = `<p style="margin: 0 0 4px 0; color: #475569; line-height: 1.45;">${normalizePdfTermsStyles(p1)}</p>`;
          results.push({
            html: pHtml,
            keepWithNext: false,
            estimatedHeight: estimateHtmlUnitHeight(pHtml)
          });
          remText = p2;
        }
        if (remText) {
          const pHtml = `<p style="margin: 0 0 4px 0; color: #475569; line-height: 1.45;">${normalizePdfTermsStyles(remText)}</p>`;
          results.push({
            html: pHtml,
            keepWithNext: false,
            estimatedHeight: estimateHtmlUnitHeight(pHtml)
          });
        }
      } else {
        const pHtml = `<div style="margin: 0 0 4px 0; color: #475569; line-height: 1.45; word-break: break-word;">${normalizePdfTermsStyles(seg)}</div>`;
        results.push({
          html: pHtml,
          keepWithNext: false,
          estimatedHeight: estimateHtmlUnitHeight(pHtml)
        });
      }
    }
  }

  return results;
}

/**
 * Deconstruct a QuotePresentationModel into discrete semantic pagination blocks.
 * Strictly keeps footer contact/company addresses out of the body block sequence.
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
            <span style="font-weight: 700; color: #ffffff;">${escapePdfText(h.hubName)}</span>
            <span style="color: #00E5C0; font-family: monospace; font-weight: 600;">(${h.nights} ${h.nights === 1 ? 'Night' : 'Nights'})</span>
          </div>
          ${i < model.routeHubs.length - 1 ? `<span style="color: #64748b; font-weight: bold; font-size: 11px;">→</span>` : ''}
        `).join('')}
      </div>
    </div>
  ` : '';

  const primaryBrandHex = model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617';
  const accentBrandHex = model.isWhiteLabel && model.brandAccentColor ? model.brandAccentColor : '#00E5C0';

  const heroAndDossierHtml = `
    <!-- Top Header -->
    <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid ${primaryBrandHex}; padding-bottom: 14px; margin-bottom: 16px;">
      <div style="display: flex; align-items: center; gap: 12px;">
        ${model.agentLogoUrl ? `<img src="${model.agentLogoUrl}" alt="${escapePdfText(model.agencyName)}" crossorigin="anonymous" style="max-height: 44px; max-width: 140px; object-fit: contain; border-radius: 6px;" />` : ''}
        <div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 24px; font-weight: 900; ${model.isWhiteLabel ? '' : 'text-transform: lowercase;'} color: ${primaryBrandHex}; letter-spacing: -0.02em;">${escapePdfText(model.agencyName)}</span>
            <span style="font-size: 9px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 4px; background: ${primaryBrandHex}; color: ${model.isWhiteLabel ? '#ffffff' : accentBrandHex};">${escapePdfText(model.documentBadgeTitle)}</span>
          </div>
          <p style="font-size: 10.5px; color: #64748b; margin: 4px 0 0 0;">${escapePdfText(model.agentAgencySubtitle)}</p>
          ${!model.isWhiteLabel ? `
            <div style="font-size: 9px; color: #64748b; margin-top: 4px; line-height: 1.35;">
              <div><strong>Registered Address:</strong> ${escapePdfText((model.agencyRegisteredAddress || THEUNBOUND_REGISTERED_ADDRESS).replace(/\r?\n/g, ', '))}</div>
              <div><strong>Current Address:</strong> ${escapePdfText((model.agencyCurrentAddress || THEUNBOUND_CURRENT_ADDRESS).replace(/\r?\n/g, ', '))}</div>
            </div>
          ` : (model.agencyAddress ? `
            <div style="font-size: 9px; color: #64748b; margin-top: 4px;">
              <strong>Agency Address:</strong> ${escapePdfText(model.agencyAddress)}
            </div>
          ` : '')}
        </div>
      </div>
      <div style="text-align: right; font-family: monospace; font-size: 10.5px;">
        <div style="font-size: 14px; font-weight: 900; color: ${primaryBrandHex};">${escapePdfText(model.quoteNumber)} (v${model.version})</div>
        <div style="color: #64748b;">Date: ${escapePdfText(model.createdDateFormatted)}</div>
        <div style="color: #64748b;">Valid Until: ${escapePdfText(model.validUntilFormatted)}</div>
        <div style="color: #0d9488; font-weight: 700;">Status: ${escapePdfText(model.status)}</div>
      </div>
    </div>

    <!-- Curated Journey Overview Banner -->
    <div style="background: linear-gradient(135deg, ${primaryBrandHex}, #0f172a, ${primaryBrandHex}); color: #ffffff; padding: 18px 20px; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.06);">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
        <div>
          <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #00E5C0; font-weight: 800; display: block;">Curated Journey Overview</span>
          <h1 style="font-size: 19px; font-weight: 900; color: #ffffff; margin: 2px 0 4px 0;">${escapePdfText(model.destination)} Bespoke Travel Itinerary</h1>
          <p style="font-size: 11px; color: #cbd5e1; margin: 0; display: flex; flex-wrap: wrap; gap: 6px;">
            <span>${model.totalDays} Days / ${model.totalNights} Nights</span>
            <span>•</span>
            <span style="font-weight: 700; color: #00E5C0;">${escapePdfText(model.paxDetailsText)}</span>
            ${model.nationality ? `<span>•</span><span>Nationality: <strong style="color: #ffffff;">${escapePdfText(model.nationality)}</strong></span>` : ''}
            ${model.travelStyle ? `<span>•</span><span>Style: <strong style="color: #ffffff;">${escapePdfText(model.travelStyle)}</strong></span>` : ''}
            ${model.dateSpanText ? `<span>•</span><span style="font-family: monospace; color: #00E5C0;">${escapePdfText(model.dateSpanText)}</span>` : ''}
          </p>
        </div>
        <div style="text-align: right; min-width: 140px;">
          <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #00E5C0; font-weight: 700; display: block;">Official Proposal</span>
          <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 2px;">${model.totalDays} Days / ${model.totalNights} Nights</div>
          <span style="font-size: 9.5px; color: #94a3b8;">Exclusive Ground Itinerary</span>
        </div>
      </div>
      ${routeHubsHtml}
    </div>

    <!-- Client & Specialist Dossier -->
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; background: #f8fafc; padding: 14px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 11px; margin-bottom: 16px;">
      <div>
        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: block; margin-bottom: 2px;">👥 Valued Guest / Client</span>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${escapePdfText(model.clientName)}</div>
        ${model.clientCompany ? `<div style="color: #475569; font-weight: 600;">${escapePdfText(model.clientCompany)}</div>` : ''}
        ${model.clientEmail ? `<div style="color: #64748b; font-family: monospace;">${escapePdfText(model.clientEmail)}</div>` : ''}
        ${model.clientPhone ? `<div style="color: #64748b; font-family: monospace;">${escapePdfText(model.clientPhone)}</div>` : ''}
      </div>
      <div>
        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: block; margin-bottom: 2px;">🎖️ Prepared By Specialist</span>
        <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${escapePdfText(model.agentName)}</div>
        <div style="color: #334155; font-weight: 600;">${escapePdfText(model.agencyName)}</div>
        ${model.agentEmail ? `<div style="color: #64748b; font-family: monospace;">${escapePdfText(model.agentEmail)}</div>` : ''}
        ${model.agentPhone ? `<div style="color: #64748b; font-family: monospace;">${escapePdfText(model.agentPhone)}</div>` : ''}
        ${model.agencyWebsite ? `<div style="color: #64748b; font-size: 10px;">${escapePdfText(model.agencyWebsite)}</div>` : ''}
        ${!model.isWhiteLabel ? `
          <div style="color: #64748b; font-size: 9px; line-height: 1.35; margin-top: 3px;">
            <div><strong>Registered Address:</strong> ${escapePdfText((model.agencyRegisteredAddress || THEUNBOUND_REGISTERED_ADDRESS).replace(/\r?\n/g, ', '))}</div>
            <div style="margin-top: 2px;"><strong>Current Address:</strong> ${escapePdfText((model.agencyCurrentAddress || THEUNBOUND_CURRENT_ADDRESS).replace(/\r?\n/g, ', '))}</div>
          </div>
        ` : (model.agencyAddress ? `<div style="color: #64748b; font-size: 9.5px;">${escapePdfText(model.agencyAddress)}</div>` : '')}
        <div style="color: #0d9488; font-size: 10px; font-weight: 700; margin-top: 3px;">🛡️ 24/7 On-Ground Concierge Assistance</div>
      </div>
    </div>
  `;

  const heroEstimatedHeight = 520 + (model.routeHubs.length > 3 ? 42 : 0);

  blocks.push({
    id: 'block-hero-dossier',
    type: 'HERO_AND_DOSSIER',
    html: heroAndDossierHtml,
    estimatedHeight: heroEstimatedHeight,
    splittable: false,
    minMeaningfulHeight: heroEstimatedHeight
  });

  // 2. VISA & ANCILLARY SERVICES
  if (model.visaServices && model.visaServices.length > 0) {
    blocks.push({
      id: 'block-visa-header',
      type: 'VISA_SECTION_HEADER',
      html: `
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #065f46; padding-bottom: 6px; margin-top: 10px; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 15px;">🌐</span>
            <h2 style="font-size: 13.5px; font-weight: 900; color: #020617; text-transform: uppercase; margin: 0;">Visa & Ancillary Services</h2>
          </div>
          <span style="font-size: 10.5px; color: #065f46; font-family: monospace; font-weight: 700;">${model.visaServices.length} Services Included</span>
        </div>
      `,
      estimatedHeight: 48,
      splittable: false,
      minMeaningfulHeight: 48,
      keepWithNext: true
    });

    model.visaServices.forEach((v, idx) => {
      const vHeight = estimateServiceCardHeight(v);
      blocks.push({
        id: `block-visa-service-${idx}`,
        type: 'VISA_SERVICE_CARD',
        html: `
          <div style="padding: 14px; border-radius: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; display: flex; justify-content: space-between; gap: 14px; margin-bottom: 10px;">
            <div style="flex: 1;">
              <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: #a7f3d0; color: #064e3b;">VISA & ANCILLARY</span>
                ${v.duration ? `<span style="font-size: 10px; color: #475569;">⏱️ ${escapePdfText(v.duration)}</span>` : ''}
              </div>
              <h4 style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${v.listingName}</h4>
              ${v.configurationSummary ? `<p style="font-size: 11px; color: #047857; margin: 0 0 5px 0; font-weight: 600;">${escapePdfText(v.configurationSummary)}</p>` : ''}
              ${v.overview && hasMeaningfulHtmlContent(v.overview) ? `
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
            <div style="text-align: right; min-width: 90px;">
              <span style="display: inline-block; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #065f46; background: #d1fae5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Included</span>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 4px;">${escapePdfText(v.paxText)}</div>
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

  // 2.5 JOURNEY NARRATIVE & OVERVIEW BLOCK (Only when meaningful content exists)
  if (model.itineraryOverview && hasMeaningfulHtmlContent(model.itineraryOverview)) {
    const rawLen = stripHtmlTagsAndEntities(model.itineraryOverview).length;
    const estLines = Math.max(2, Math.ceil(rawLen / 76));
    const estHeight = 56 + estLines * 16;
    blocks.push({
      id: 'block-itinerary-overview',
      type: 'ITINERARY_OVERVIEW_BLOCK' as any,
      html: `
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00C6A6; border-radius: 12px; padding: 12px 16px; margin-top: 10px; margin-bottom: 10px;">
          <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #008972; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
            <span>✨ Journey Narrative &amp; Overview</span>
          </div>
          <div class="theunbound-rich-text" style="font-size: 11px; color: #334155; line-height: 1.5;">
            ${model.itineraryOverview}
          </div>
        </div>
      `,
      estimatedHeight: estHeight,
      splittable: false,
      minMeaningfulHeight: estHeight
    });
  }

  // 3. DAY-BY-DAY ITINERARY BLOCKS
  model.days.forEach((day) => {
    const dayId = day.dayId || `day-${day.dayNumber}`;
    const dayHeaderHtml = `
      <div data-day-id="${dayId}" data-day-header="${day.dayNumber}" style="background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; margin-top: 10px; margin-bottom: 10px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <div style="width: 26px; height: 26px; border-radius: 6px; background: #00E5C0; color: #0f172a; font-weight: 900; display: flex; align-items: center; justify-content: center; font-size: 11px; font-family: monospace;">
            ${String(day.dayNumber).padStart(2, '0')}
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="font-weight: 800; font-size: 13px;">Day ${day.dayNumber}: ${escapePdfText(day.dayOfWeek)}, ${escapePdfText(day.formattedDate)}</span>
              ${day.isTransitionDay && day.prevHubName ? `
                <span style="padding: 1px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.2); color: #fcd34d; font-size: 9px; font-weight: 700; border: 1px solid rgba(245, 158, 11, 0.3);">
                  Transfer: ${escapePdfText(day.prevHubName)} → ${escapePdfText(day.hubName)}
                </span>
              ` : ''}
            </div>
            <div style="font-size: 10.5px; color: #cbd5e1; margin-top: 2px; display: flex; align-items: center; gap: 4px;">
              <span style="color: #00E5C0;">📍</span>
              <span style="font-weight: 600;">${escapePdfText(day.hubName)} Base</span>
              ${day.customTheme ? `<span style="color: #64748b;">•</span><span style="color: #00E5C0; font-weight: 600;">${escapePdfText(day.customTheme)}</span>` : ''}
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
      estimatedHeight: 62,
      splittable: false,
      minMeaningfulHeight: 62,
      keepWithNext: true,
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

    if (day.dayOverview && hasMeaningfulHtmlContent(day.dayOverview)) {
      const ovLines = Math.max(1, Math.ceil(stripHtmlTagsAndEntities(day.dayOverview).length / 78));
      const ovHeight = 40 + ovLines * 17;
      blocks.push({
        id: `block-day-${day.dayNumber}-overview`,
        type: 'DAY_OVERVIEW_BLOCK',
        html: `
          <div data-day-id="${dayId}" style="padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 10px; font-size: 10.5px; color: #334155; line-height: 1.45;">
            <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #0d9488; display: block; margin-bottom: 2px;">Day ${day.dayNumber} Overview</span>
            <div class="theunbound-rich-text">${day.dayOverview}</div>
          </div>
        `,
        estimatedHeight: ovHeight,
        splittable: false,
        minMeaningfulHeight: ovHeight,
        keepWithNext: day.services.length > 0,
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
              <span style="font-weight: 700; color: #1e293b;">• Day at Leisure in ${escapePdfText(day.hubName)}</span>
              <p style="font-size: 10px; color: #64748b; margin: 3px 0 0 0;">Free time for personal exploration, neighborhood shopping, and local dining discoveries.</p>
            </div>
            <span style="font-style: italic; color: #94a3b8; font-size: 10px;">Self-Paced</span>
          </div>
        `,
        estimatedHeight: 82,
        splittable: false,
        minMeaningfulHeight: 82,
        dayId,
        dayNumber: day.dayNumber
      });
    } else {
      day.services.forEach((s, sIdx) => {
        blocks.push(buildDayServiceCardBlock(s, { ...day, dayId }, sIdx));
      });
    }

    if (day.dayNotes && hasMeaningfulHtmlContent(day.dayNotes)) {
      const noteLines = Math.max(1, Math.ceil(stripHtmlTagsAndEntities(day.dayNotes).length / 78));
      const noteHeight = 40 + noteLines * 17;
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

  // 4. ADDITIONAL SERVICES
  if (model.additionalServices && model.additionalServices.length > 0) {
    const addHeight = 95 + Math.ceil(model.additionalServices.length / 2) * 32;
    blocks.push({
      id: 'block-additional-services',
      type: 'ADDITIONAL_SERVICES',
      html: `
        <div style="margin-top: 12px; margin-bottom: 12px;">
          <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; font-size: 11.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            ✨ Additional Package Privileges & Services
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            ${model.additionalServices.map(a => `
              <div style="padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; font-size: 10.5px;">
                <div>
                  <div style="font-weight: 700; color: #0f172a;">${escapePdfText(a.name)}</div>
                  <div style="font-size: 9.5px; color: #64748b;">${escapePdfText(a.summary)}</div>
                </div>
                <span style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #065f46; background: #d1fae5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Included</span>
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
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; margin-top: 12px; margin-bottom: 12px;">
        <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
          <span>🛡️</span>
          <span>${escapePdfText(model.operationalStandardsTitle)}</span>
        </div>
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
          ${model.operationalStandards.map(op => `
            <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0;">
              <span style="font-weight: 800; font-size: 10px; color: #0f172a; display: block; margin-bottom: 2px;">${escapePdfText(op.title)}</span>
              <p style="font-size: 9px; color: #64748b; margin: 0; line-height: 1.35;">${escapePdfText(op.desc)}</p>
            </div>
          `).join('')}
        </div>
      </div>
    `,
    estimatedHeight: 155,
    splittable: false,
    minMeaningfulHeight: 155
  });

  // 6. FINANCIAL TARIFF CONTAINER
  blocks.push({
    id: 'block-tariff',
    type: 'TARIFF_CONTAINER',
    html: `
      <div style="background: #020617; color: #ffffff; padding: 18px 20px; border-radius: 16px; margin-top: 10px; margin-bottom: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 9px; font-weight: 800; color: #00E5C0; text-transform: uppercase; letter-spacing: 0.1em; display: block;">QUOTATION PRICING SUMMARY</span>
          ${model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? `
            <div style="font-size: 13px; font-weight: 800; color: #ffffff; margin: 4px 0 3px 0;">
              <strong>Hotel Accommodation Total:</strong> <span style="color: #00E5C0; font-family: monospace;">${escapePdfText(model.hotelAccommodationTotalFormatted)}</span>
            </div>
          ` : ''}
          <h3 style="font-size: 15px; font-weight: 900; color: #ffffff; margin: 3px 0 3px 0;"><strong>Land Part Total:</strong> <span style="color: #00E5C0; font-family: monospace;">${escapePdfText(model.landPartTotalFormatted)}</span></h3>
          <div style="font-size: 16px; font-weight: 900; color: #ffffff; margin: 3px 0 4px 0;">
            <strong>Final Selling Price:</strong> <span style="color: #00E5C0; font-family: monospace;">${escapePdfText(model.finalCustomerSellingPriceFormatted)}</span>
          </div>
          <p style="font-size: 10px; color: #cbd5e1; margin: 0; max-width: 420px;">Land Part Total covers all included non-accommodation travel services (private transport, tours, activities, rail, and ancillary ground services) and applicable taxes.</p>
        </div>
        <div style="text-align: right;">
          ${model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? `
            <div style="font-size: 10px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Hotel Total: <span style="color: #00E5C0; font-family: monospace;">${escapePdfText(model.hotelAccommodationTotalFormatted)}</span></div>
            <div style="font-size: 10px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Land Total: <span style="color: #00E5C0; font-family: monospace;">${escapePdfText(model.landPartTotalFormatted)}</span></div>
          ` : ''}
          <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Final Selling Price</div>
          <div style="font-size: 22px; font-weight: 900; font-family: monospace; color: #00E5C0;">${escapePdfText(model.finalCustomerSellingPriceFormatted)}</div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${escapePdfText(model.guaranteedCurrencyLine)}</div>
        </div>
      </div>
    `,
    estimatedHeight: model.hasHotelAccommodation ? 175 : 150,
    splittable: false,
    minMeaningfulHeight: model.hasHotelAccommodation ? 175 : 150
  });

  // 6B. PACKAGE INCLUSIONS, EXCLUSIONS & POLICY NOTES
  if (
    model.inclusions.length > 0 ||
    model.exclusions.length > 0 ||
    model.importantInformation ||
    model.cancellationPolicy
  ) {
    const lineCount =
      model.inclusions.length +
      model.exclusions.length +
      (model.importantInformation ? 3 : 0) +
      (model.cancellationPolicy ? 3 : 0);
    const pkgNotesHeight = Math.min(480, 72 + lineCount * 16);
    blocks.push({
      id: 'block-package-inclusions-notes',
      type: 'POLICIES_CONTAINER',
      html: `
        <div style="margin-top: 8px; margin-bottom: 10px; font-size: 10px; display: flex; flex-direction: column; gap: 8px;">
          ${model.inclusions.length > 0 || model.exclusions.length > 0 ? `
            <div style="display: grid; grid-template-columns: ${model.inclusions.length > 0 && model.exclusions.length > 0 ? '1fr 1fr' : '1fr'}; gap: 10px;">
              ${model.inclusions.length > 0 ? `
                <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 10px 12px;">
                  <div style="font-weight: 900; color: #064e3b; text-transform: uppercase; font-size: 9.5px; margin-bottom: 4px;">✓ Package Inclusions</div>
                  <ul style="margin: 0; padding-left: 16px; color: #065f46; line-height: 1.4;">
                    ${model.inclusions.map((inc) => `<li style="margin-bottom: 2px;">${escapePdfText(inc)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
              ${model.exclusions.length > 0 ? `
                <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 10px 12px;">
                  <div style="font-weight: 900; color: #881337; text-transform: uppercase; font-size: 9.5px; margin-bottom: 4px;">✕ Package Exclusions</div>
                  <ul style="margin: 0; padding-left: 16px; color: #9f1239; line-height: 1.4;">
                    ${model.exclusions.map((exc) => `<li style="margin-bottom: 2px;">${escapePdfText(exc)}</li>`).join('')}
                  </ul>
                </div>
              ` : ''}
            </div>
          ` : ''}
          ${model.importantInformation ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px;">
              <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; font-size: 9.5px; margin-bottom: 3px;">Important Information</div>
              <div style="color: #475569; line-height: 1.45;">${escapePdfText(model.importantInformation)}</div>
            </div>
          ` : ''}
          ${model.cancellationPolicy ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px;">
              <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; font-size: 9.5px; margin-bottom: 3px;">Cancellation Policy</div>
              <div style="color: #475569; line-height: 1.45;">${escapePdfText(model.cancellationPolicy)}</div>
            </div>
          ` : ''}
        </div>
      `,
      estimatedHeight: pkgNotesHeight,
      splittable: false,
      minMeaningfulHeight: pkgNotesHeight
    });
  }

  // 7. OPERATIONAL GUIDELINES & POLICIES
  const policiesHeight = 90 + model.childAndAttractionPolicies.length * 18;
  blocks.push({
    id: 'block-policies',
    type: 'POLICIES_CONTAINER',
    html: `
      <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-top: 8px; margin-bottom: 12px; font-size: 10px;">
        <div style="font-weight: 900; color: #78350f; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">
          ℹ️ Operational Guidelines & Child / Attraction Policy
        </div>
        <ul style="margin: 0; padding-left: 18px; color: #92400e; line-height: 1.45;">
          ${model.childAndAttractionPolicies.map(p => `<li style="margin-bottom: 3px;">${escapePdfText(p)}</li>`).join('')}
        </ul>
      </div>
    `,
    estimatedHeight: policiesHeight,
    splittable: false,
    minMeaningfulHeight: policiesHeight
  });

  // 8. COMMERCIAL QUOTATION TERMS (GRANULAR, PAGE-BREAK SAFE, ZERO FOOTER ADDRESSES IN BODY)
  const termsHeadingBannerHtml = `
    <div data-terms-banner="true" style="border-top: 1.5px solid #cbd5e1; padding-top: 10px; margin-top: 8px; font-size: 10.5px; color: #0f172a; font-weight: 900; text-transform: uppercase; letter-spacing: 0.03em; margin-bottom: 6px;">
      ${escapePdfText(model.commercialTermsHeading || 'Commercial Quotation Terms')}
    </div>
  `;

  if (model.isDestinationWiseCommercialTerms && model.commercialTermsSnapshot?.entries?.length) {
    const entries = model.commercialTermsSnapshot.entries;
    let addedBanner = false;

    entries.forEach((entry, entryIdx) => {
      const activeSections = (entry.sections || [])
        .filter((s) => s.isActive !== false)
        .sort((a, b) => a.displayOrder - b.displayOrder);

      if (activeSections.length === 0) return;

      if (!addedBanner) {
        addedBanner = true;
        blocks.push({
          id: 'block-terms-banner',
          type: 'TERMS_AND_SIGNATURE',
          html: termsHeadingBannerHtml,
          estimatedHeight: 34,
          splittable: false,
          minMeaningfulHeight: 34,
          keepWithNext: true
        });
      }

      blocks.push({
        id: `block-terms-entry-${entryIdx}-header`,
        type: 'TERMS_AND_SIGNATURE',
        html: `
          <div style="display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 6px 10px; margin-bottom: 6px; border-radius: 6px; background: #f1f5f9; border: 1px solid #cbd5e1;">
            <span style="font-size: 10px; font-weight: 800; color: #0f172a; text-transform: uppercase;">${escapePdfText(entry.targetName)} — Commercial Quotation Terms</span>
            <span style="font-size: 9px; font-family: monospace; color: #475569; white-space: nowrap; flex-shrink: 0;">v${entry.version}${entry.inheritedFromParentName ? ` • Inherited from ${escapePdfText(entry.inheritedFromParentName)}` : ''}</span>
          </div>
        `,
        estimatedHeight: 38,
        splittable: false,
        minMeaningfulHeight: 38,
        keepWithNext: true
      });

      activeSections.forEach((sec, secIdx) => {
        const fragments = decomposeRichTermsHtmlIntoBlocks(sec.htmlContent || '');

        if (sec.heading && hasMeaningfulHtmlContent(sec.heading)) {
          blocks.push({
            id: `block-terms-entry-${entryIdx}-sec-${secIdx}-title`,
            type: 'TERMS_AND_SIGNATURE',
            html: `<div style="font-weight: 800; color: #0f172a; font-size: 10.5px; margin: 6px 0 3px 0; line-height: 1.35;">${escapePdfText(sec.heading)}</div>`,
            estimatedHeight: 24,
            splittable: false,
            minMeaningfulHeight: 24,
            keepWithNext: fragments.length > 0
          });
        }

        fragments.forEach((frag, fIdx) => {
          blocks.push({
            id: `block-terms-entry-${entryIdx}-sec-${secIdx}-frag-${fIdx}`,
            type: 'TERMS_AND_SIGNATURE',
            html: `<div style="font-size: 9.8px; color: #475569; line-height: 1.45;">${frag.html}</div>`,
            estimatedHeight: frag.estimatedHeight,
            splittable: false,
            minMeaningfulHeight: frag.estimatedHeight,
            keepWithNext: frag.keepWithNext
          });
        });
      });
    });
  } else {
    blocks.push({
      id: 'block-terms-banner',
      type: 'TERMS_AND_SIGNATURE',
      html: termsHeadingBannerHtml,
      estimatedHeight: 34,
      splittable: false,
      minMeaningfulHeight: 34,
      keepWithNext: true
    });

    const fallbackHtml = model.commercialTermsHtml || `<p>${escapePdfText(model.commercialTerms)}</p>`;
    const fragments = decomposeRichTermsHtmlIntoBlocks(fallbackHtml);
    fragments.forEach((frag, fIdx) => {
      blocks.push({
        id: `block-terms-default-frag-${fIdx}`,
        type: 'TERMS_AND_SIGNATURE',
        html: `<div style="font-size: 9.8px; color: #475569; line-height: 1.45;">${frag.html}</div>`,
        estimatedHeight: frag.estimatedHeight,
        splittable: false,
        minMeaningfulHeight: frag.estimatedHeight,
        keepWithNext: frag.keepWithNext
      });
    });
  }

  return blocks;
}

/**
 * Accurately measure block heights (and split-part heights) in the real browser DOM if document is available.
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
  measureContainer.style.width = `${CONTENT_WIDTH_PX}px`; // 740px
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
        block.estimatedHeight = Math.max(measuredHeight + 3, 20);
      }

      if (block.splitParts) {
        const firstMeasured = measureSingleHtml(block.splitParts.firstPart.html);
        if (firstMeasured > 0) {
          block.splitParts.firstPart.estimatedHeight = Math.max(firstMeasured + 3, MIN_ACTIVITY_START_HEIGHT);
          block.minMeaningfulHeight = Math.min(block.minMeaningfulHeight, block.splitParts.firstPart.estimatedHeight);
        }

        const remMeasured = measureSingleHtml(block.splitParts.remainingPart.html);
        if (remMeasured > 0) {
          block.splitParts.remainingPart.estimatedHeight = Math.max(remMeasured + 3, 60);
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
 * Measures combined vertical height of an array of blocks in real browser DOM inside the 740px body shell.
 */
function measureBlocksCombinedHeightInDOM(blocks: PaginationBlock[]): number | null {
  if (typeof document === 'undefined' || !document.body || blocks.length === 0) {
    return null;
  }
  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.left = '-9999px';
  container.style.top = '0';
  container.style.width = `${CONTENT_WIDTH_PX}px`;
  container.style.display = 'flex';
  container.style.flexDirection = 'column';
  container.style.visibility = 'hidden';
  container.style.pointerEvents = 'none';
  container.style.boxSizing = 'border-box';
  container.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  container.innerHTML = blocks.map(b => b.html).join('');
  document.body.appendChild(container);
  try {
    return Math.ceil(container.getBoundingClientRect().height);
  } finally {
    container.parentNode?.removeChild(container);
  }
}

/**
 * Validate strict physical layout invariants across all paginated pages (zero footer/header overlaps,
 * no orphaned headings, sequential page numbers, no footer address leakage in body).
 */
export function validatePdfLayoutBounds(pages: RenderedPage[]): PdfLayoutBoundsValidation {
  const errors: string[] = [];
  const pageSummaries: PdfLayoutBoundsValidation['pageSummaries'] = [];

  pages.forEach((page, idx) => {
    const expectedPageNum = idx + 1;
    if (page.pageNumber !== expectedPageNum) {
      errors.push(`Page index ${idx} has mismatched pageNumber=${page.pageNumber} (expected ${expectedPageNum}).`);
    }
    if (!page.footerHtml.includes(`Page ${page.pageNumber} of ${pages.length}`)) {
      errors.push(`Page ${page.pageNumber} footer is missing accurate "Page ${page.pageNumber} of ${pages.length}" indicator.`);
    }
    if (page.blocks.length === 0) {
      errors.push(`Page ${page.pageNumber} is unexpectedly blank (0 blocks).`);
    }
    if (page.usedContentHeight > page.availableContentHeight + 2) {
      errors.push(
        `Page ${page.pageNumber} body height (${page.usedContentHeight}px) exceeds availableContentHeight (${page.availableContentHeight}px) and would collide with footer.`
      );
    }
    if (page.bounds.contentBottom > page.bounds.height - page.bounds.bottomMargin - page.bounds.footerHeight) {
      errors.push(`Page ${page.pageNumber} contentBottom overlaps footer zone.`);
    }

    const lastBlock = page.blocks[page.blocks.length - 1];
    if (lastBlock && lastBlock.keepWithNext) {
      errors.push(
        `Page ${page.pageNumber} ends with an orphaned keepWithNext block (${lastBlock.id}).`
      );
    }

    page.blocks.forEach((b) => {
      if (b.id === 'block-terms-signature') {
        errors.push(`Page ${page.pageNumber} contains legacy footer-in-body block (${b.id}).`);
      }
    });

    pageSummaries.push({
      pageNumber: page.pageNumber,
      usedContentHeight: page.usedContentHeight,
      availableContentHeight: page.availableContentHeight,
      headerHeight: page.bounds.headerHeight,
      footerHeight: page.bounds.footerHeight,
      blockCount: page.blocks.length
    });
  });

  return {
    valid: errors.length === 0,
    errors,
    pageSummaries
  };
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

    if (day.dayOverview && hasMeaningfulHtmlContent(day.dayOverview) && !combinedDayHtml.includes(day.dayOverview)) {
      allOverviewsPresent = false;
      errors.push(`Day ${day.dayNumber} overview text is missing from rendered PDF.`);
    }

    if (day.dayNotes && hasMeaningfulHtmlContent(day.dayNotes) && !combinedDayHtml.includes(day.dayNotes)) {
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

        if (blocksForService.length === 1) {
          if (blocksForService[0].isSplitPart) {
            errors.push(
              `Day ${day.dayNumber} service "${s.listingName}" rendered only 1 split part (${blocksForService[0].isSplitPart}) — remaining part was lost.`
            );
          }
        } else {
          // Multi-part split validation (FIRST -> optional MIDDLE... -> REMAINING)
          const first = blocksForService[0];
          const last = blocksForService[blocksForService.length - 1];
          if (first.isSplitPart !== 'FIRST' || last.isSplitPart !== 'REMAINING') {
            errors.push(
              `Day ${day.dayNumber} service "${s.listingName}" split parts out of order.`
            );
          }
          for (let mid = 1; mid < blocksForService.length - 1; mid++) {
            if (blocksForService[mid].isSplitPart !== 'MIDDLE') {
              errors.push(
                `Day ${day.dayNumber} service "${s.listingName}" unexpected split part marker (${blocksForService[mid].isSplitPart}).`
              );
            }
          }
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
 * Core Pagination Algorithm: Bins semantic blocks into discrete A4 pages using dynamic
 * measured header/footer heights, height-aware activity splitting, keep-with-next heading grouping,
 * and real DOM overflow rebalancing.
 */
export function paginateQuotePresentationModel(model: QuotePresentationModel): RenderedPage[] {
  const blocks = buildSemanticBlocks(model);

  // 1. Measure real header & footer region heights (or multi-line fallback in Node)
  const regionMetrics = measureHeaderAndFooterHeights(model);
  const boundsOverrides = {
    headerHeight: regionMetrics.headerHeightContinuation,
    footerHeight: regionMetrics.footerHeight
  };

  // 2. Measure exact real DOM heights of every block when browser DOM is available
  measureBlockHeightsInDOM(blocks);

  const rawPages: Array<{ pageNumber: number; blocks: PaginationBlock[]; usedHeight: number; bounds: PageBounds }> = [];

  let currentPageNum = 1;
  let currentBounds = getPageContentBounds(currentPageNum, boundsOverrides);
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
        usedHeight: currentUsedHeight,
        bounds: currentBounds
      });
      currentPageNum++;
      currentBounds = getPageContentBounds(currentPageNum, boundsOverrides);
      currentPageBlocks = [];
      currentUsedHeight = 0;
    }
  };

  const appendBlock = (block: PaginationBlock): void => {
    currentPageBlocks.push(block);
    currentUsedHeight += block.estimatedHeight;
  };

  // Helper: computes combined height of a keepWithNext chain starting at index `startIdx`
  const computeKeepWithNextChainHeight = (list: PaginationBlock[], startIdx: number): number => {
    let total = 0;
    let cursor = startIdx;
    while (cursor < list.length) {
      const b = list[cursor];
      const contrib = (cursor > startIdx && b.splittable) ? b.minMeaningfulHeight : b.estimatedHeight;
      total += contrib;
      if (!b.keepWithNext) break;
      cursor++;
    }
    return total;
  };

  // Dedicated DaySection renderer preserving Day Header + associated content grouping & strict bounds
  const renderDaySection = (
    day: DayPresentationData,
    dayHeaderBlock: PaginationBlock,
    dayContentBlocks: PaginationBlock[]
  ): void => {
    let continuationSeq = 1;

    // 1. Check minimum start height before rendering Day Header so Day Header is NEVER orphaned
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

    let hasRenderedServiceOnCurrentPageForDay = false;

    // Queue allows multi-chunk remainders to be evaluated identically to upcoming blocks
    const queue: PaginationBlock[] = [...dayContentBlocks];

    while (queue.length > 0) {
      const item = queue.shift()!;
      const rem = getSafeRemainingHeight();

      // Day Overview stays attached under Day Header
      if (item.type === 'DAY_OVERVIEW_BLOCK') {
        appendBlock(item);
        continue;
      }

      // Case A: Full item fits cleanly inside safe remaining height on current page
      if (item.estimatedHeight <= rem) {
        appendBlock(item);
        hasRenderedServiceOnCurrentPageForDay = true;
        continue;
      }

      // Case B: Item does not fit completely, and is splittable (Day Service Card or Continuation)
      if (item.splittable && item.serviceData) {
        // Compute height-aware split fitting the exact remaining height on this page!
        const adaptiveSplit = splitServiceBlockToFitHeight(item, day, rem);

        if (adaptiveSplit) {
          appendBlock(adaptiveSplit.fitBlock);
          hasRenderedServiceOnCurrentPageForDay = true;

          // Push remaining part to top of next page under CONTINUE DAY X
          createNextPage();
          appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));
          hasRenderedServiceOnCurrentPageForDay = false;
          queue.unshift(adaptiveSplit.remainderBlock);
          continue;
        }

        // Cannot fit even minimal slice in remaining space on current page
        if (hasRenderedServiceOnCurrentPageForDay) {
          // Move entire item onto next page under CONTINUE DAY X
          createNextPage();
          appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));
          hasRenderedServiceOnCurrentPageForDay = false;
          queue.unshift(item);
          continue;
        } else {
          // Day Header / Overview or CONTINUE DAY X is already at the top of this page with NO service yet!
          // If on a non-empty page (e.g. previous day/block before this Day Header), push Day Header + item together to fresh page
          const startIdxOfDayOnPage = currentPageBlocks.findIndex(b => b.dayNumber === day.dayNumber);
          if (startIdxOfDayOnPage > 0) {
            const movedDayBlocks = currentPageBlocks.splice(startIdxOfDayOnPage);
            const movedHeight = movedDayBlocks.reduce((s, b) => s + b.estimatedHeight, 0);
            currentUsedHeight = Math.max(0, currentUsedHeight - movedHeight);
            createNextPage();
            movedDayBlocks.forEach(b => appendBlock(b));
            queue.unshift(item);
            continue;
          }

          // Already on fresh page: force height-aware fit strictly within full available space below Day/Continue Header!
          const fallbackFit = splitServiceBlockToFitHeight(item, day, Math.max(MIN_ACTIVITY_START_HEIGHT, rem));
          if (fallbackFit) {
            appendBlock(fallbackFit.fitBlock);
            createNextPage();
            appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));
            queue.unshift(fallbackFit.remainderBlock);
            continue;
          }

          if (item.splitParts && item.splitParts.firstPart.estimatedHeight <= rem) {
            appendBlock(item.splitParts.firstPart);
            createNextPage();
            appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));
            queue.unshift(item.splitParts.remainingPart);
            continue;
          }
        }
      }

      // Case C: Unsplittable item does not fit in remaining space
      if (hasRenderedServiceOnCurrentPageForDay) {
        createNextPage();
        appendBlock(createContinueDayHeaderBlock(day, continuationSeq++));
        hasRenderedServiceOnCurrentPageForDay = false;
        appendBlock(item);
        hasRenderedServiceOnCurrentPageForDay = true;
      } else {
        const startIdxOfDayOnPage = currentPageBlocks.findIndex(b => b.dayNumber === day.dayNumber);
        if (startIdxOfDayOnPage > 0) {
          const movedDayBlocks = currentPageBlocks.splice(startIdxOfDayOnPage);
          const movedHeight = movedDayBlocks.reduce((s, b) => s + b.estimatedHeight, 0);
          currentUsedHeight = Math.max(0, currentUsedHeight - movedHeight);
          createNextPage();
          movedDayBlocks.forEach(b => appendBlock(b));
        }
        appendBlock(item);
        hasRenderedServiceOnCurrentPageForDay = true;
      }
    }
  };

  // Process all semantic blocks
  let i = 0;
  while (i < blocks.length) {
    const block = blocks[i];

    // Group and render each Day section cleanly
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

    // Keep-with-next headings (Commercial Terms Banner, Destination Terms Header, Section Titles, Visa Section Header)
    if (block.keepWithNext && currentPageBlocks.length > 0) {
      const chainHeight = computeKeepWithNextChainHeight(blocks, i);
      if (chainHeight > getSafeRemainingHeight()) {
        createNextPage();
      }
    } else if (
      block.estimatedHeight > getSafeRemainingHeight() &&
      currentPageBlocks.length > 0
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
      usedHeight: currentUsedHeight,
      bounds: currentBounds
    });
  }

  // Real DOM overflow self-check & rebalance pass (catches any sub-pixel/margin-collapse discrepancy in browser)
  if (typeof document !== 'undefined' && document.body) {
    let pIdx = 0;
    while (pIdx < rawPages.length) {
      const rp = rawPages[pIdx];
      const maxAllowed = rp.bounds.availableContentHeight;
      const realH = measureBlocksCombinedHeightInDOM(rp.blocks);
      if (realH !== null) {
        rp.usedHeight = realH;
      }

      if (realH !== null && realH > maxAllowed && rp.blocks.length > 1) {
        // Move trailing block(s) while also avoiding leaving an orphaned keepWithNext / DAY_HEADER / CONTINUE_DAY at page end
        let popCount = 1;
        while (rp.blocks.length - popCount > 1) {
          const newLast = rp.blocks[rp.blocks.length - 1 - popCount];
          if (
            newLast.keepWithNext ||
            newLast.type === 'DAY_HEADER' ||
            newLast.type === 'DAY_CONTINUATION_HEADER' ||
            newLast.type === 'DAY_OVERVIEW_BLOCK' ||
            newLast.type === 'VISA_SECTION_HEADER'
          ) {
            popCount++;
          } else {
            break;
          }
        }
        const overflowBlocks = rp.blocks.splice(rp.blocks.length - popCount);
        const recalculatedH = measureBlocksCombinedHeightInDOM(rp.blocks);
        if (recalculatedH !== null) {
          rp.usedHeight = recalculatedH;
        }

        // If a Day content block overflowed onto the next page, ensure next page begins with CONTINUE DAY X if needed
        const firstOverflow = overflowBlocks[0];
        let prependBlocks: PaginationBlock[] = overflowBlocks;
        if (
          firstOverflow.dayNumber !== undefined &&
          firstOverflow.type !== 'DAY_HEADER' &&
          firstOverflow.type !== 'DAY_CONTINUATION_HEADER'
        ) {
          const dayData = model.days.find(d => d.dayNumber === firstOverflow.dayNumber);
          if (dayData) {
            prependBlocks = [createContinueDayHeaderBlock(dayData, 900 + pIdx), ...overflowBlocks];
          }
        }

        if (pIdx + 1 < rawPages.length) {
          rawPages[pIdx + 1].blocks.unshift(...prependBlocks);
          const nextH = measureBlocksCombinedHeightInDOM(rawPages[pIdx + 1].blocks);
          if (nextH !== null) rawPages[pIdx + 1].usedHeight = nextH;
        } else {
          const nextBounds = getPageContentBounds(rawPages.length + 1, boundsOverrides);
          rawPages.push({
            pageNumber: rawPages.length + 1,
            blocks: prependBlocks,
            usedHeight: measureBlocksCombinedHeightInDOM(prependBlocks) ?? prependBlocks.reduce((s, b) => s + b.estimatedHeight, 0),
            bounds: nextBounds
          });
        }
        // Re-check same page in case another block still needs to shift
        continue;
      }
      pIdx++;
    }
  }

  // Renumber sequentially in case rebalancing inserted pages
  const totalPages = rawPages.length;
  const renderedPages: RenderedPage[] = rawPages.map((rp, idx) => {
    const pageNumber = idx + 1;
    const bounds = getPageContentBounds(pageNumber, boundsOverrides);
    const headerHtml = buildPageHeaderHtml(model, pageNumber);
    const footerHtml = buildPageFooterHtml(model, pageNumber, totalPages);

    return {
      pageNumber,
      totalPages,
      headerHtml,
      footerHtml,
      blocks: rp.blocks,
      usedContentHeight: rp.usedHeight,
      availableContentHeight: bounds.availableContentHeight,
      bounds
    };
  });

  // Execute fail-safe Day & Content Completeness Validation
  const completenessValidation = validatePaginatedQuoteCompleteness(model, renderedPages);
  if (!completenessValidation.valid) {
    throw new Error(
      `PDF Pagination Completeness Validation Failed: ${completenessValidation.errors.join(' | ')}`
    );
  }

  const layoutValidation = validatePdfLayoutBounds(renderedPages);
  if (!layoutValidation.valid) {
    throw new Error(
      `PDF Layout Bounds Validation Failed: ${layoutValidation.errors.join(' | ')}`
    );
  }

  return renderedPages;
}
