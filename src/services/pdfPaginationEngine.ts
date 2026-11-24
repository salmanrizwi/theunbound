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
  | 'ITINERARY_OVERVIEW_BLOCK'
  | 'DAY_HEADER'
  | 'DAY_CONTINUATION_HEADER'
  | 'DAY_OVERVIEW_BLOCK'
  | 'DAY_OVERVIEW_FRAGMENT'
  | 'DAY_SERVICE_CARD'
  | 'DAY_SERVICE_CONTINUATION'
  | 'DAY_LEISURE_CARD'
  | 'DAY_NOTES_BLOCK'
  | 'DAY_NOTES_FRAGMENT'
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
  inclusionsSlice?: string[];
  exclusionsSlice?: string[];
  includeSpecialInstructions?: boolean;
  specialInstructionsSlice?: string;
  isSplitPart?: 'FIRST' | 'MIDDLE' | 'REMAINING';
  splitPartIndex?: number;
  splitPartTotal?: number;
  splitParts?: SplitBlockParts;
  splitRef?: string;
  breakDecision?: string;
  dayMeta?: {
    dayNumber: number;
    hubName: string;
    prevHubName?: string;
    formattedDate: string;
    dayOfWeek: string;
    customTheme?: string;
  };
}

export interface BlockLayoutDiagnostic {
  id: string;
  type: PaginationBlockType;
  height: number;
  startY: number;
  endY: number;
  dayNumber?: number;
  splitRole?: string;
  splitRef?: string;
  breakDecision: string;
}

export interface PageLayoutDiagnostics {
  pageNumber: number;
  pageHeight: number;
  topMargin: number;
  bottomMargin: number;
  headerHeight: number;
  headerGap: number;
  bodyStartY: number;
  bodyEndY: number;
  footerStartY: number;
  footerHeight: number;
  footerGap: number;
  availableContentHeight: number;
  actualBodyHeight: number;
  overflowPx: number;
  rebalanceActions: string[];
  blocks: BlockLayoutDiagnostic[];
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
  diagnostics?: PageLayoutDiagnostics;
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
    overflowPx: number;
    headerHeight: number;
    footerHeight: number;
    blockCount: number;
  }>;
  diagnostics?: PageLayoutDiagnostics[];
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

const HTML_NAMED_ENTITY_MAP: Record<string, string> = {
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  ndash: '–',
  mdash: '—',
  lsquo: '‘',
  rsquo: '’',
  sbquo: '‚',
  ldquo: '“',
  rdquo: '”',
  bdquo: '„',
  hellip: '…',
  bull: '•',
  middot: '·',
  copy: '©',
  reg: '®',
  trade: '™',
  euro: '€',
  pound: '£',
  yen: '¥',
  cent: '¢',
  deg: '°',
  times: '×',
  divide: '÷',
  plusmn: '±',
  rarr: '→',
  larr: '←',
  uarr: '↑',
  darr: '↓',
  harr: '↔',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  agrave: 'à',
  aacute: 'á',
  uuml: 'ü',
  ouml: 'ö',
  auml: 'ä',
  ccedil: 'ç',
  ntilde: 'ñ',
  szlig: 'ß',
  frac12: '½',
  frac14: '¼',
  frac34: '¾'
};

export function decodeHtmlEntities(input?: string): string {
  return String(input || '').replace(/&(#x?[0-9a-f]+|[a-z0-9]+);/gi, (full, entity: string) => {
    const lower = entity.toLowerCase();
    if (lower.startsWith('#x')) {
      const cp = parseInt(lower.slice(2), 16);
      if (Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff) {
        try {
          return String.fromCodePoint(cp);
        } catch {
          return full;
        }
      }
      return full;
    }
    if (lower.startsWith('#')) {
      const cp = parseInt(lower.slice(1), 10);
      if (Number.isFinite(cp) && cp > 0 && cp <= 0x10ffff) {
        try {
          return String.fromCodePoint(cp);
        } catch {
          return full;
        }
      }
      return full;
    }
    return HTML_NAMED_ENTITY_MAP[lower] ?? full;
  });
}

export function stripHtmlTagsAndEntities(htmlOrText?: string): string {
  const withoutTags = String(htmlOrText || '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<!DOCTYPE[^>]*>/gi, ' ')
    .replace(/<\/?[a-zA-Z][^>]*>/g, ' ');
  return decodeHtmlEntities(withoutTags)
    .replace(/[\u00a0\u2000-\u200a\u202f\u205f\u3000]/g, ' ')
    .replace(/[\u200b\u200c\u200d\ufeff]/g, '')
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
        headerHeightContinuation: Math.max(30, measuredHeader + 2),
        footerHeight: Math.max(36, measuredFooter + 2)
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

const VOID_HTML_TAGS = new Set(['br', 'hr', 'img', 'input', 'meta', 'link', 'wbr']);
const INLINE_REOPEN_TAGS = new Set(['strong', 'b', 'em', 'i', 'u', 's', 'span', 'a', 'small', 'code', 'font', 'mark', 'sub', 'sup']);

/**
 * Constrain unconstrained <img> tags inside itinerary/terms HTML to printable A4 body bounds
 * so tall or wide images scale proportionally without overflowing body height or width.
 */
function normalizeInlineImagesHtml(html: string): string {
  return String(html || '').replace(/<img\b([^>]*)>/gi, (_full, attrs: string) => {
    const cleanAttrs = attrs
      .replace(/\s+(?:width|height)\s*=\s*(['"]?)[^'"\s>]*\1/gi, '');
    if (/style\s*=/i.test(cleanAttrs)) {
      return `<img${cleanAttrs.replace(/style\s*=\s*(['"])([\s\S]*?)\1/i, (_s, q: string, styleVal: string) => {
        let patched = styleVal.trim();
        if (!/max-width\s*:/i.test(patched)) patched = `max-width: 100%; ${patched}`;
        if (!/max-height\s*:/i.test(patched)) patched = `max-height: 620px; ${patched}`;
        if (!/width\s*:/i.test(patched)) patched = `width: auto; ${patched}`;
        if (!/height\s*:/i.test(patched)) patched = `height: auto; ${patched}`;
        if (!/object-fit\s*:/i.test(patched)) patched = `object-fit: contain; ${patched}`;
        return `style=${q}${patched}${q}`;
      })}>`;
    }
    return `<img${cleanAttrs} style="max-width: 100%; max-height: 620px; width: auto; height: auto; object-fit: contain; display: block; margin: 4px 0;">`;
  });
}

/**
 * Splits a single HTML paragraph/block containing inline formatting tags (<strong>, <b>, <em>, <span>, <a>, etc.)
 * into balanced HTML chunks near natural line/sentence/word boundaries without cutting text or leaving unclosed tags.
 */
function splitHtmlWithInlineTagsAtBoundary(
  rawHtml: string,
  targetPlainChars: number = 280,
  maxLineBreaks: number = 7
): string[] {
  const input = String(rawHtml || '').trim();
  const initialBrCount = (input.match(/<br\s*\/?>/gi) || []).length;
  if (!input || (stripHtmlTagsAndEntities(input).length <= targetPlainChars && initialBrCount < maxLineBreaks)) {
    return input ? [input] : [];
  }

  // Tokenize into HTML tags and plain text segments
  const tokens: Array<{ type: 'tag'; raw: string; tagName: string; isClose: boolean; isSelfClose: boolean } | { type: 'text'; raw: string }> = [];
  const tagRe = /<[^>]+>/g;
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(input)) !== null) {
    if (m.index > lastIdx) {
      tokens.push({ type: 'text', raw: input.slice(lastIdx, m.index) });
    }
    const rawTag = m[0];
    const nameMatch = rawTag.match(/^<\s*(\/?)([a-zA-Z0-9]+)/);
    const isClose = Boolean(nameMatch && nameMatch[1] === '/');
    const tagName = (nameMatch?.[2] || '').toLowerCase();
    const isSelfClose = /\/\s*>$/.test(rawTag) || VOID_HTML_TAGS.has(tagName);
    tokens.push({ type: 'tag', raw: rawTag, tagName, isClose, isSelfClose });
    lastIdx = tagRe.lastIndex;
  }
  if (lastIdx < input.length) {
    tokens.push({ type: 'text', raw: input.slice(lastIdx) });
  }

  const chunks: string[] = [];
  let buf = '';
  let plainLen = 0;
  let brLinesInBuf = 0;
  const openStack: Array<{ tagName: string; openRaw: string }> = [];

  const flushChunk = () => {
    if (plainLen === 0 && !/<img\b/i.test(buf)) {
      brLinesInBuf = 0;
      return;
    }
    let out = buf;
    for (let i = openStack.length - 1; i >= 0; i--) {
      out += `</${openStack[i].tagName}>`;
    }
    const cleaned = out.replace(/(?:<br\s*\/?>\s*)+$/gi, '').trim();
    if (hasMeaningfulHtmlContent(cleaned) || /<img\b/i.test(cleaned)) {
      chunks.push(cleaned);
    }
    buf = openStack.map(t => t.openRaw).join('');
    plainLen = 0;
    brLinesInBuf = 0;
  };

  for (const tok of tokens) {
    if (tok.type === 'tag') {
      if (tok.tagName === 'br') {
        brLinesInBuf++;
        if (brLinesInBuf >= maxLineBreaks || plainLen >= Math.floor(targetPlainChars * 0.55)) {
          flushChunk();
          continue;
        }
      }
      buf += tok.raw;
      if (!tok.isSelfClose && INLINE_REOPEN_TAGS.has(tok.tagName)) {
        if (!tok.isClose) {
          openStack.push({ tagName: tok.tagName, openRaw: tok.raw });
        } else {
          for (let k = openStack.length - 1; k >= 0; k--) {
            if (openStack[k].tagName === tok.tagName) {
              openStack.splice(k, 1);
              break;
            }
          }
        }
      }
      continue;
    }

    let remText = tok.raw;
    let wordGuard = 0;
    while (remText.length > 0 && wordGuard++ < 400) {
      const remainingBudget = targetPlainChars - plainLen;
      if (remText.length <= remainingBudget) {
        buf += remText;
        plainLen += remText.length;
        remText = '';
        break;
      }

      const searchLimit = Math.max(20, Math.min(remText.length, remainingBudget + 40));
      const minCut = Math.max(10, Math.floor(remainingBudget * 0.55));
      const windowStr = remText.slice(0, searchLimit);

      let splitAt = -1;
      const periodCut = windowStr.lastIndexOf('. ');
      if (periodCut >= minCut) {
        splitAt = periodCut + 2;
      } else {
        const spaceCut = windowStr.lastIndexOf(' ');
        if (spaceCut >= minCut) {
          splitAt = spaceCut + 1;
        } else if (plainLen >= Math.floor(targetPlainChars * 0.5)) {
          flushChunk();
          continue;
        } else {
          const fallbackSpace = remText.indexOf(' ', Math.max(1, remainingBudget));
          splitAt = fallbackSpace !== -1 ? fallbackSpace + 1 : remText.length;
        }
      }

      const part = remText.slice(0, splitAt);
      buf += part;
      plainLen += part.length;
      remText = remText.slice(splitAt);
      flushChunk();
    }
    if (remText.length > 0) {
      buf += remText;
      plainLen += remText.length;
      remText = '';
    }
  }

  flushChunk();
  return chunks.length > 0 ? chunks : [input];
}

/**
 * Split overview content into natural paragraph/line/table/list segments without discarding any text, images, or HTML structure.
 */
function extractOverviewSegments(rawOverview: string): string[] {
  const raw = normalizeInlineImagesHtml((rawOverview || '').trim());
  if (!raw || (!hasMeaningfulHtmlContent(raw) && !/<img\b/i.test(raw))) return [];

  const splitPlainChunkList = (inputSegs: string[]): string[] => {
    const out: string[] = [];
    for (const seg of inputSegs) {
      const plainLen = stripHtmlTagsAndEntities(seg).length;
      const brCount = (seg.match(/<\s*br\s*\/?>/gi) || []).length;
      if (/<(?:ul|ol|table)\b/i.test(seg)) {
        out.push(seg);
        continue;
      }
      if (/^<blockquote\b/i.test(seg)) {
        if (plainLen <= 280 && brCount <= 6) {
          out.push(seg);
        } else {
          const innerBq = seg.replace(/^\s*<blockquote\b[^>]*>/i, '').replace(/<\/blockquote>\s*$/i, '').trim();
          const bqParts = splitHtmlWithInlineTagsAtBoundary(innerBq, 240, 6);
          for (const bp of bqParts) {
            out.push(`<blockquote style="margin: 4px 0; padding-left: 10px; border-left: 2px solid #cbd5e1;">${bp}</blockquote>`);
          }
        }
        continue;
      }
      if (/^<pre\b/i.test(seg)) {
        const innerPre = seg.replace(/^\s*<pre\b[^>]*>/i, '').replace(/<\/pre>\s*$/i, '');
        const preLines = innerPre.split(/\r?\n|<(?:br\s*\/?)>/gi);
        if (preLines.length <= 6 && plainLen <= 320) {
          out.push(seg);
        } else {
          for (let li = 0; li < preLines.length; li += 5) {
            const slice = preLines.slice(li, li + 5).join('\n');
            if (slice.trim()) {
              out.push(`<pre style="margin: 4px 0; white-space: pre-wrap; font-size: 9.5px;">${slice}</pre>`);
            }
          }
        }
        continue;
      }
      if (plainLen <= 280 && brCount <= 6) {
        out.push(seg);
        continue;
      }

      const brParts = seg.split(/<\s*br\s*\/?>/gi).map(p => p.trim()).filter(p => hasMeaningfulHtmlContent(p) || /<img\b/i.test(p));
      if (brParts.length > 1 && !/^<(?:p|div)\b/i.test(seg)) {
        for (const bp of brParts) {
          if (stripHtmlTagsAndEntities(bp).length > 280) {
            out.push(...splitHtmlWithInlineTagsAtBoundary(bp, 240, 5));
          } else {
            out.push(`<div style="margin-bottom: 4px;">${bp}</div>`);
          }
        }
        continue;
      }

      const innerOnly = seg.replace(/^\s*<(?:p|div)\b[^>]*>/i, '').replace(/<\/(?:p|div)>\s*$/i, '').trim();
      const splitParts = splitHtmlWithInlineTagsAtBoundary(innerOnly, 240, 6);
      if (splitParts.length > 1) {
        out.push(...splitParts.map(p => `<p style="margin: 0 0 4px 0;">${p}</p>`));
      } else {
        out.push(seg);
      }
    }
    return out;
  };

  const isHtml = /<[a-z][\s\S]*>/i.test(raw);
  if (isHtml) {
    const topFragments = extractTopLevelHtmlFragments(raw);
    const expanded: string[] = [];
    for (const frag of topFragments) {
      const trimmed = frag.trim();
      if (!hasMeaningfulHtmlContent(trimmed) && !/<img\b/i.test(trimmed)) continue;
      if (/^<(?:ul|ol)\b/i.test(trimmed)) {
        const liItems = trimmed.match(/<li\b[\s\S]*?<\/li>/gi) || [];
        const avgLiLen = liItems.length > 0 ? stripHtmlTagsAndEntities(trimmed).length / liItems.length : 0;
        const perChunk = avgLiLen > 160 ? 1 : 2;
        expanded.push(...splitHtmlListIntoChunks(trimmed, perChunk, 220).map(c => c.html));
      } else if (/^<table\b/i.test(trimmed)) {
        expanded.push(...splitHtmlTableIntoRowChunks(trimmed, 3, 220).map(c => c.html));
      } else {
        expanded.push(trimmed);
      }
    }

    const splitExpanded = splitPlainChunkList(expanded);
    if (splitExpanded.length > 0) {
      return splitExpanded;
    }

    const brParts = raw
      .split(/<\s*br\s*\/?>/gi)
      .map(s => s.trim())
      .filter(s => hasMeaningfulHtmlContent(s) || /<img\b/i.test(s));
    if (brParts.length > 1) {
      return splitPlainChunkList(brParts);
    }
    return splitPlainChunkList([raw]);
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
    if (buffer.length >= 2 || trimmed.length > 160) {
      flush();
    }
    buffer.push(escapePdfText(trimmed));
  }
  flush();

  const finalSegments: string[] = [];
  for (const seg of segments) {
    const plainLen = stripHtmlTagsAndEntities(seg).length;
    if (plainLen <= 300 || /<(?:ul|ol|table|p)\b/i.test(seg)) {
      finalSegments.push(seg);
    } else {
      let rem = seg;
      let segSplitGuard = 0;
      while (stripHtmlTagsAndEntities(rem).length > 300 && segSplitGuard++ < 80) {
        const [first, rest] = splitTextNaturally(rem, 240);
        if (!first || !rest || rest.length >= rem.length) break;
        finalSegments.push(first);
        rem = rest;
      }
      if (rem) finalSegments.push(rem);
    }
  }

  return finalSegments.length > 0 ? finalSegments : [escapePdfText(raw)];
}

/**
 * Splits a single still-oversized segment even more finely (1 table row, 1 list item/sub-chunk, 3 line breaks, ~130 chars)
 * when an adaptive page split cannot fit the normal segment onto remaining space.
 */
function finerSplitSingleSegment(seg: string): string[] {
  const trimmed = String(seg || '').trim();
  if (!trimmed) return [];

  if (/^<table\b/i.test(trimmed)) {
    const chunks = splitHtmlTableIntoRowChunks(trimmed, 1, 130).map(c => c.html);
    if (chunks.length > 1) return chunks;
  }
  if (/^<(?:ul|ol)\b/i.test(trimmed)) {
    const chunks = splitHtmlListIntoChunks(trimmed, 1, 130).map(c => c.html);
    if (chunks.length > 1) return chunks;
  }

  const innerStripped = trimmed
    .replace(/^\s*<(?:p|div|blockquote)\b[^>]*>/i, '')
    .replace(/<\/(?:p|div|blockquote)>\s*$/i, '')
    .trim();

  const parts = splitHtmlWithInlineTagsAtBoundary(innerStripped, 140, 3);
  if (parts.length > 1) {
    if (/^<blockquote\b/i.test(trimmed)) {
      return parts.map(p => `<blockquote style="margin: 4px 0; padding-left: 10px; border-left: 2px solid #cbd5e1;">${p}</blockquote>`);
    }
    return parts.map(p => `<p style="margin: 0 0 4px 0;">${p}</p>`);
  }

  const plain = stripHtmlTagsAndEntities(trimmed);
  if (plain.length > 160 && !/<[a-z][\s\S]*>/i.test(trimmed)) {
    const [a, b] = splitTextNaturally(plain, 120);
    if (a && b) return [escapePdfText(a), escapePdfText(b)];
  }
  return [trimmed];
}

/**
 * Format overview HTML safely so plain newlines render with line breaks instead of collapsing.
 */
function formatOverviewSegmentsHtml(segments: string[]): string {
  return segments
    .map(seg => {
      if (/^\s*<(?:p|div|ul|ol|h[1-6]|table|blockquote|pre)\b/i.test(seg)) {
        return seg;
      }
      return `<div style="margin-bottom: 4px;">${seg}</div>`;
    })
    .join('');
}

/**
 * Shared conservative HTML height estimator for non-DOM environments (Node / SSR).
 */
function estimateRichHtmlBlockHeight(html: string, extraPadding: number = 10): number {
  const plainLen = stripHtmlTagsAndEntities(html).length;
  const tableRows = (html.match(/<tr\b/gi) || []).length;
  const listItems = (html.match(/<li\b/gi) || []).length;
  const brCount = (html.match(/<br\s*\/?>/gi) || []).length;
  const pCount = (html.match(/<(?:p|div|blockquote)\b/gi) || []).length;
  const imgCount = (html.match(/<img\b/gi) || []).length;
  const lines = Math.max(1 + brCount, Math.ceil(plainLen / 76) + brCount + Math.floor(pCount * 0.4));
  return Math.max(22, extraPadding + lines * 15.5 + tableRows * 24 + listItems * 4 + imgCount * 220);
}

/**
 * Estimate accurate rendering height of a Service card based on real characters/line wraps.
 */
export function estimateServiceCardHeight(s: ServicePresentationItem): number {
  let height = 92; // Card padding + title + badges + margin-bottom
  if (s.configurationSummary && !s.isRail) height += 20;
  if (s.meetingPoint || s.pickupPoint || s.dropoffPoint) height += 28;
  if (s.isRail && s.railDetails) height += 66;
  if (s.overview && (hasMeaningfulHtmlContent(s.overview) || /<img\b/i.test(s.overview))) {
    const segments = extractOverviewSegments(s.overview);
    let overviewH = 22;
    for (const seg of segments) {
      overviewH += estimateRichHtmlBlockHeight(seg, 4);
    }
    height += overviewH;
  }
  if (s.inclusions && s.inclusions.length > 0) {
    const totalChars = s.inclusions.reduce((sum, x) => sum + x.length + 6, 0);
    const incRows = Math.max(1, Math.ceil(totalChars / 78));
    height += 22 + incRows * 24;
  }
  if (s.exclusions && s.exclusions.length > 0) {
    const totalChars = s.exclusions.reduce((sum, x) => sum + x.length + 6, 0);
    const excRows = Math.max(1, Math.ceil(totalChars / 78));
    height += 22 + excRows * 24;
  }
  if (s.specialInstructions) {
    height += estimateRichHtmlBlockHeight(s.specialInstructions, 22);
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

function splitPlainOrHtmlInstructions(rawInst: string, maxChars: number = 240): string[] {
  const input = String(rawInst || '').trim();
  if (!input) return [];
  if (stripHtmlTagsAndEntities(input).length <= maxChars && (input.match(/<br\s*\/?>/gi) || []).length <= 4) {
    return [input];
  }
  const segs = extractOverviewSegments(input);
  if (segs.length > 1) return segs;
  const fine = finerSplitSingleSegment(segs[0] || input);
  return fine.length > 1 ? fine : [input];
}

function renderServiceSecondaryHtml(
  s: ServicePresentationItem,
  secondaryOpts?: {
    inclusions?: string[];
    exclusions?: string[];
    includeSpecialInstructions?: boolean;
    specialInstructionsSlice?: string;
    inclusionsContinued?: boolean;
    exclusionsContinued?: boolean;
    specialInstructionsContinued?: boolean;
    isVisaCard?: boolean;
  }
): {
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

  const activeInclusions = secondaryOpts?.inclusions ?? s.inclusions;
  const activeExclusions = secondaryOpts?.exclusions ?? s.exclusions;
  const activeSpecialText = secondaryOpts?.specialInstructionsSlice ?? s.specialInstructions;
  const showSpecial = (secondaryOpts?.includeSpecialInstructions ?? Boolean(activeSpecialText)) && Boolean(activeSpecialText);

  const inclusionsHtml = activeInclusions.length > 0 ? `
    <div style="margin-top: 5px;">
      <span style="font-size: 9px; font-weight: 700; color: #059669; text-transform: uppercase; display: block; margin-bottom: 2px;">${secondaryOpts?.inclusionsContinued ? 'Inclusions (Continued)' : 'Inclusions'}</span>
      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
        ${activeInclusions.map(inc => `<span style="font-size: 9px; background: #ffffff; color: #064e3b; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">✓ ${inc}</span>`).join('')}
      </div>
    </div>
  ` : '';

  const exclusionsHtml = activeExclusions.length > 0 ? `
    <div style="margin-top: 5px;">
      <span style="font-size: 9px; font-weight: 700; color: #e11d48; text-transform: uppercase; display: block; margin-bottom: 2px;">${secondaryOpts?.exclusionsContinued ? 'Exclusions (Continued)' : 'Exclusions'}</span>
      <div style="display: flex; flex-wrap: wrap; gap: 4px;">
        ${activeExclusions.map(exc => `<span style="font-size: 9px; background: #ffffff; color: #881337; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecdd3;">✕ ${exc}</span>`).join('')}
      </div>
    </div>
  ` : '';

  const instLabel = secondaryOpts?.isVisaCard
    ? (secondaryOpts?.specialInstructionsContinued ? 'Special Notes (Continued): ' : 'Special Notes: ')
    : (secondaryOpts?.specialInstructionsContinued ? 'Special Instructions (Continued): ' : 'Special Instructions: ');
  const instBorder = secondaryOpts?.isVisaCard ? '#a7f3d0' : '#e2e8f0';
  const instColor = secondaryOpts?.isVisaCard ? '#065f46' : '#334155';

  const specialInstructionsHtml = (showSpecial && activeSpecialText) ? `
    <div style="font-size: 10px; color: ${instColor}; background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid ${instBorder}; margin-top: 5px; word-break: break-word;">
      <strong data-pdf-synthetic-label="true">${instLabel}</strong>${normalizeInlineImagesHtml(activeSpecialText)}
    </div>
  ` : '';

  return { operationalPointsHtml, railBoxHtml, inclusionsHtml, exclusionsHtml, specialInstructionsHtml };
}

function renderServiceChunkHtml(
  s: ServicePresentationItem,
  day: DayPresentationData | undefined,
  segments: string[],
  options: {
    mode: 'FULL' | 'FIRST' | 'MIDDLE' | 'REMAINING';
    overviewContinuedHeader: boolean;
    includeDetailsFooter: boolean;
    inclusionsSlice?: string[];
    exclusionsSlice?: string[];
    includeSpecialInstructions?: boolean;
    specialInstructionsSlice?: string;
    inclusionsContinued?: boolean;
    exclusionsContinued?: boolean;
    specialInstructionsContinued?: boolean;
    isVisaCard?: boolean;
  }
): string {
  const isVisa = Boolean(options.isVisaCard);
  const secondaryConfig = options.includeDetailsFooter
    ? {
        inclusions: options.inclusionsSlice ?? s.inclusions,
        exclusions: options.exclusionsSlice ?? s.exclusions,
        includeSpecialInstructions: options.includeSpecialInstructions ?? Boolean(s.specialInstructions),
        specialInstructionsSlice: options.specialInstructionsSlice,
        inclusionsContinued: options.inclusionsContinued,
        exclusionsContinued: options.exclusionsContinued,
        specialInstructionsContinued: options.specialInstructionsContinued,
        isVisaCard: isVisa
      }
    : {
        inclusions: options.inclusionsSlice ?? [],
        exclusions: options.exclusionsSlice ?? [],
        includeSpecialInstructions: options.includeSpecialInstructions ?? false,
        specialInstructionsSlice: options.specialInstructionsSlice,
        inclusionsContinued: options.inclusionsContinued,
        exclusionsContinued: options.exclusionsContinued,
        specialInstructionsContinued: options.specialInstructionsContinued,
        isVisaCard: isVisa
      };

  const { operationalPointsHtml, railBoxHtml, inclusionsHtml, exclusionsHtml, specialInstructionsHtml } =
    renderServiceSecondaryHtml(s, secondaryConfig);

  const overviewBlockHtml = segments.length > 0 ? `
    <div style="margin-top: 5px;">
      <span data-pdf-synthetic-label="true" style="font-size: 9px; font-weight: 700; color: ${isVisa ? '#64748b' : '#94a3b8'}; text-transform: uppercase; display: block; margin-bottom: 2px;">
        ${options.overviewContinuedHeader ? 'Overview (Continued)' : 'Overview'}
      </span>
      <div style="font-size: 10.5px; color: #334155; line-height: 1.42; word-break: break-word;">${formatOverviewSegmentsHtml(segments)}</div>
    </div>
  ` : '';

  const splitAttr = options.mode === 'FULL' ? '' : ` data-split-part="${options.mode.toLowerCase()}"`;
  const dayAttr = day ? ` data-day-id="${day.dayId}"` : '';
  const cardBg = isVisa ? '#ecfdf5' : `${s.badgeBg}18`;
  const cardBorder = isVisa ? '#a7f3d0' : s.badgeBg;
  const badgeBg = isVisa ? '#a7f3d0' : s.badgeBg;
  const badgeText = isVisa ? '#064e3b' : s.badgeText;
  const catLabel = isVisa ? 'VISA & ANCILLARY' : s.categoryLabel;

  if (options.mode === 'FULL' || options.mode === 'FIRST') {
    return `
      <div${dayAttr} data-service-id="${s.id}"${splitAttr} style="padding: 12px 14px; border-radius: 12px; background: ${cardBg}; border: 1px solid ${cardBorder}; display: flex; justify-content: space-between; gap: 12px; margin-bottom: 10px; box-sizing: border-box;">
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px; flex-wrap: wrap;">
            <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeText};">
              ${escapePdfText(catLabel)}
            </span>
            ${s.duration ? `<span style="font-size: 10px; color: #475569;">⏱️ ${escapePdfText(s.duration)}</span>` : ''}
            ${!isVisa && s.serviceTime ? `<span style="font-size: 10px; font-family: monospace; font-weight: 600; color: #334155; background: #ffffff; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0;">${escapePdfText(s.serviceTime)}</span>` : ''}
          </div>
          <h4 style="font-size: 12.5px; font-weight: ${isVisa ? '700' : '800'}; color: #0f172a; margin: 0 0 4px 0;">${s.listingName}</h4>
          ${s.configurationSummary && !s.isRail ? `<p style="font-size: ${isVisa ? '11px' : '10.5px'}; color: ${isVisa ? '#047857' : '#475569'}; margin: 0 0 5px 0; font-weight: ${isVisa ? '600' : '500'};">${escapePdfText(s.configurationSummary)}</p>` : ''}
          ${operationalPointsHtml}
          ${railBoxHtml}
          ${overviewBlockHtml}
          ${inclusionsHtml}${exclusionsHtml}${specialInstructionsHtml}
        </div>
        <div style="text-align: right; min-width: 90px; flex-shrink: 0;">
          <span style="display: inline-block; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: ${isVisa ? '#065f46' : '#047857'}; background: ${isVisa ? '#d1fae5' : '#ecfdf5'}; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">${isVisa ? 'Included' : 'Confirmed'}</span>
          <div style="font-size: 9.5px; color: #64748b; margin-top: 4px;">${escapePdfText(s.paxText)}</div>
        </div>
      </div>
    `;
  }

  return `
    <div${dayAttr} data-service-id="${s.id}"${splitAttr} style="padding: 12px 14px; border-radius: 12px; background: ${cardBg}; border: 1px solid ${cardBorder}; margin-bottom: 10px; box-sizing: border-box;">
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px; padding-bottom: 4px; border-bottom: 1px dashed ${cardBorder};">
        <div style="display: flex; align-items: center; gap: 6px; min-width: 0;">
          <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${badgeBg}; color: ${badgeText}; flex-shrink: 0;">
            ${escapePdfText(catLabel)}
          </span>
          <h4 style="font-size: 12px; font-weight: 800; color: #0f172a; margin: 0;">${s.listingName} — continued</h4>
        </div>
        <span style="font-size: 9px; font-family: monospace; color: #64748b; font-weight: 600; flex-shrink: 0;">${isVisa ? 'Visa Details Continued' : 'Activity Details Continued'}</span>
      </div>
      ${overviewBlockHtml}
      ${inclusionsHtml}${exclusionsHtml}${specialInstructionsHtml}
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
  includeDetailsFooter: boolean,
  secondarySlices?: {
    inclusions?: string[];
    exclusions?: string[];
    includeSpecialInstructions?: boolean;
    specialInstructionsSlice?: string;
  }
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
      height += estimateRichHtmlBlockHeight(seg, 4);
    }
  }
  const incList = secondarySlices?.inclusions ?? (includeDetailsFooter ? s.inclusions : []);
  const excList = secondarySlices?.exclusions ?? (includeDetailsFooter ? s.exclusions : []);
  const specText = secondarySlices?.specialInstructionsSlice ?? s.specialInstructions;
  const hasSpec = secondarySlices?.includeSpecialInstructions ?? (includeDetailsFooter && Boolean(specText));

  if (incList.length > 0) {
    const totalChars = incList.reduce((sum, x) => sum + x.length + 6, 0);
    height += 22 + Math.max(1, Math.ceil(totalChars / 78)) * 24;
  }
  if (excList.length > 0) {
    const totalChars = excList.reduce((sum, x) => sum + x.length + 6, 0);
    height += 22 + Math.max(1, Math.ceil(totalChars / 78)) * 24;
  }
  if (hasSpec && specText) {
    height += estimateRichHtmlBlockHeight(specText, 22);
  }
  return Math.max(height, isFirstHeader ? MIN_ACTIVITY_START_HEIGHT : 75);
}

/**
 * Dynamically split an oversized Service Block (Day service or Visa service, or any continuation remainder)
 * to fit inside `targetMaxHeightPx`. Supports recursive sub-segment splitting AND splitting of long
 * inclusions, exclusions, and multi-paragraph specialInstructions.
 * Returns `null` if even the smallest meaningful first slice exceeds `targetMaxHeightPx`.
 */
let pdfSplitInstanceCounter = 0;

function splitServiceBlockToFitHeight(
  block: PaginationBlock,
  day: DayPresentationData | undefined,
  targetMaxHeightPx: number
): { fitBlock: PaginationBlock; remainderBlock: PaginationBlock } | null {
  const s = block.serviceData;
  if (!s) return null;

  const isVisa = block.type === 'VISA_SERVICE_CARD' || block.type === 'VISA_SERVICE_CONTINUATION';
  const isFirstHeader = block.isSplitPart !== 'MIDDLE' && block.isSplitPart !== 'REMAINING';
  let segments = [...(block.overviewSegments ?? extractOverviewSegments(s.overview))];
  const hasSecondaryDetails = s.inclusions.length > 0 || s.exclusions.length > 0 || Boolean(s.specialInstructions);
  const ownsSecondaryDetails =
    block.isSplitPart === undefined || block.isSplitPart === 'REMAINING'
      ? hasSecondaryDetails
      : Boolean(block.includeSecondaryOnRemainder);
  const remainderSplitRole: 'MIDDLE' | 'REMAINING' =
    block.isSplitPart === 'FIRST' || block.isSplitPart === 'MIDDLE' ? 'MIDDLE' : 'REMAINING';

  const blockInclusions = ownsSecondaryDetails ? (block.inclusionsSlice ?? s.inclusions) : [];
  const blockExclusions = ownsSecondaryDetails ? (block.exclusionsSlice ?? s.exclusions) : [];
  const blockSpecialText = ownsSecondaryDetails
    ? (block.specialInstructionsSlice ?? (block.includeSpecialInstructions === false ? '' : (s.specialInstructions || '')))
    : '';
  const blockHasSpecial = Boolean(blockSpecialText);
  const hasRemainingSecondary =
    blockInclusions.length > 0 || blockExclusions.length > 0 || blockHasSpecial;

  const findBestOverviewCut = (segList: string[]): number => {
    for (let cut = segList.length; cut >= 0; cut--) {
      if (cut === segList.length && !hasRemainingSecondary) continue;
      if (cut === 0 && !isFirstHeader) continue;
      if (cut === 0 && isFirstHeader && segList.length === 0 && !hasRemainingSecondary) continue;

      const firstSegments = segList.slice(0, cut);
      const candidateHtml = renderServiceChunkHtml(s, day, firstSegments, {
        mode: isFirstHeader ? 'FIRST' : 'MIDDLE',
        overviewContinuedHeader: !isFirstHeader && Boolean(block.overviewIsContinued),
        includeDetailsFooter: false,
        isVisaCard: isVisa
      });
      const estH = estimatePartialServiceHeight(s, firstSegments, isFirstHeader, false);
      const realH = measureSingleBlockHtmlHeight(candidateHtml, estH);

      if (realH <= targetMaxHeightPx) {
        return cut;
      }
    }
    return -1;
  };

  // 1. Try splitting across overview segments
  let bestCut = findBestOverviewCut(segments);

  // 1B. If segments[0] was still too large (or cut=0 on first card left no text), finely split segments[0]!
  if ((bestCut === -1 || (bestCut === 0 && isFirstHeader)) && segments.length > 0) {
    const fineFirst = finerSplitSingleSegment(segments[0]);
    if (fineFirst.length > 1) {
      const expandedSegs = [...fineFirst, ...segments.slice(1)];
      const refinedCut = findBestOverviewCut(expandedSegs);
      if (refinedCut >= 1 || (bestCut === -1 && refinedCut >= 0)) {
        segments = expandedSegs;
        bestCut = refinedCut;
      }
    }
  }

  let fitSegments: string[] = [];
  let remSegments: string[] = [];
  let fitInclusions: string[] = [];
  let remInclusions: string[] = blockInclusions;
  let fitExclusions: string[] = [];
  let remExclusions: string[] = blockExclusions;
  let fitSpecialSlice: string | undefined;
  let remSpecialSlice: string | undefined = blockSpecialText || undefined;
  let fitSpecial = false;
  let remSpecial = blockHasSpecial;
  let fitHeight = 0;

  if (bestCut !== -1 && (bestCut > 0 || !hasRemainingSecondary || segments.length > 0)) {
    fitSegments = segments.slice(0, bestCut);
    remSegments = segments.slice(bestCut);
  } else if (hasRemainingSecondary) {
    // 2. Try fitting partial secondary details (when overview is empty or already consumed)
    const instChunks = blockHasSpecial ? splitPlainOrHtmlInstructions(blockSpecialText, 200) : [];
    const totalSecUnits = blockInclusions.length + blockExclusions.length + instChunks.length;
    const baseSegs = segments.length === 0 ? [] : [];
    let foundSecSplit = false;

    const maxTake = isFirstHeader && segments.length === 0 ? totalSecUnits : Math.max(1, totalSecUnits - 1);
    for (let take = maxTake; take >= 1; take--) {
      if (take >= totalSecUnits && segments.length === 0) continue;
      const incTake = Math.min(take, blockInclusions.length);
      const remAfterInc = take - incTake;
      const excTake = Math.min(remAfterInc, blockExclusions.length);
      const instTakeCount = Math.min(remAfterInc - excTake, instChunks.length);

      const candInc = blockInclusions.slice(0, incTake);
      const candExc = blockExclusions.slice(0, excTake);
      const candSpecSlice = instTakeCount > 0 ? instChunks.slice(0, instTakeCount).join('<br/>') : undefined;
      const specTake = Boolean(candSpecSlice);

      const candHtml = renderServiceChunkHtml(s, day, baseSegs, {
        mode: isFirstHeader ? 'FIRST' : 'MIDDLE',
        overviewContinuedHeader: !isFirstHeader && Boolean(block.overviewIsContinued),
        includeDetailsFooter: false,
        inclusionsSlice: candInc,
        exclusionsSlice: candExc,
        includeSpecialInstructions: specTake,
        specialInstructionsSlice: candSpecSlice,
        isVisaCard: isVisa
      });
      const estH = estimatePartialServiceHeight(s, baseSegs, isFirstHeader, false, {
        inclusions: candInc,
        exclusions: candExc,
        includeSpecialInstructions: specTake,
        specialInstructionsSlice: candSpecSlice
      });
      const realH = measureSingleBlockHtmlHeight(candHtml, estH);
      if (realH <= targetMaxHeightPx) {
        fitSegments = baseSegs;
        remSegments = segments;
        fitInclusions = candInc;
        remInclusions = blockInclusions.slice(incTake);
        fitExclusions = candExc;
        remExclusions = blockExclusions.slice(excTake);
        fitSpecial = specTake;
        fitSpecialSlice = candSpecSlice;
        const remInstChunks = instChunks.slice(instTakeCount);
        remSpecialSlice = remInstChunks.length > 0 ? remInstChunks.join('<br/>') : undefined;
        remSpecial = Boolean(remSpecialSlice);
        fitHeight = realH;
        foundSecSplit = true;
        break;
      }
    }
    if (!foundSecSplit) {
      // Fallback: if segments === 0 and cut=0 (isFirstHeader) couldn't even fit 1 secondary unit, allow header-only slice if it fits
      if (isFirstHeader) {
        const bareHtml = renderServiceChunkHtml(s, day, [], {
          mode: 'FIRST',
          overviewContinuedHeader: false,
          includeDetailsFooter: false,
          isVisaCard: isVisa
        });
        const bareH = measureSingleBlockHtmlHeight(bareHtml, estimatePartialServiceHeight(s, [], true, false));
        if (bareH <= targetMaxHeightPx) {
          fitSegments = [];
          remSegments = segments;
          fitHeight = bareH;
          foundSecSplit = true;
        }
      }
      if (!foundSecSplit) return null;
    }
  } else {
    return null;
  }

  const fitHtml = renderServiceChunkHtml(s, day, fitSegments, {
    mode: isFirstHeader ? 'FIRST' : 'MIDDLE',
    overviewContinuedHeader: !isFirstHeader && Boolean(block.overviewIsContinued),
    includeDetailsFooter: false,
    inclusionsSlice: fitInclusions,
    exclusionsSlice: fitExclusions,
    includeSpecialInstructions: fitSpecial,
    specialInstructionsSlice: fitSpecialSlice,
    isVisaCard: isVisa
  });
  if (fitHeight <= 0) {
    fitHeight = measureSingleBlockHtmlHeight(
      fitHtml,
      estimatePartialServiceHeight(s, fitSegments, isFirstHeader, false, {
        inclusions: fitInclusions,
        exclusions: fitExclusions,
        includeSpecialInstructions: fitSpecial,
        specialInstructionsSlice: fitSpecialSlice
      })
    );
  }

  const remHasOverviewBefore = fitSegments.length > 0 || Boolean(block.overviewIsContinued);
  const remHasSecondary = remInclusions.length > 0 || remExclusions.length > 0 || remSpecial;
  const remHtml = renderServiceChunkHtml(s, day, remSegments, {
    mode: remainderSplitRole,
    overviewContinuedHeader: remHasOverviewBefore && remSegments.length > 0,
    includeDetailsFooter: remHasSecondary,
    inclusionsSlice: remInclusions,
    exclusionsSlice: remExclusions,
    includeSpecialInstructions: remSpecial,
    specialInstructionsSlice: remSpecialSlice,
    inclusionsContinued: fitInclusions.length > 0 && remInclusions.length > 0,
    exclusionsContinued: fitExclusions.length > 0 && remExclusions.length > 0,
    specialInstructionsContinued: fitSpecial && remSpecial,
    isVisaCard: isVisa
  });
  const remHeight = measureSingleBlockHtmlHeight(
    remHtml,
    estimatePartialServiceHeight(s, remSegments, false, remHasSecondary, {
      inclusions: remInclusions,
      exclusions: remExclusions,
      includeSpecialInstructions: remSpecial,
      specialInstructionsSlice: remSpecialSlice
    })
  );

  const sIdx = block.serviceIndex ?? 0;
  const splitSeq = ++pdfSplitInstanceCounter;
  const remSecCount = remInclusions.length + remExclusions.length + (remSpecial ? 1 : 0);
  const splitRef = `split-svc-${day?.dayNumber ?? 'visa'}-${sIdx}-${splitSeq}`;

  const fitBlock: PaginationBlock = {
    ...block,
    id: `${block.id}-fit-${splitSeq}`,
    type: isVisa
      ? (isFirstHeader ? 'VISA_SERVICE_CARD' : 'VISA_SERVICE_CONTINUATION')
      : (isFirstHeader ? 'DAY_SERVICE_CARD' : 'DAY_SERVICE_CONTINUATION'),
    html: fitHtml,
    estimatedHeight: fitHeight,
    splittable:
      fitSegments.length > 1 ||
      (fitSegments.length === 1 && stripHtmlTagsAndEntities(fitSegments[0]).length > 160) ||
      (fitInclusions.length + fitExclusions.length > 1) ||
      Boolean(fitSpecialSlice && stripHtmlTagsAndEntities(fitSpecialSlice).length > 180),
    minMeaningfulHeight: fitHeight,
    serviceData: s,
    overviewSegments: fitSegments,
    inclusionsSlice: fitInclusions,
    exclusionsSlice: fitExclusions,
    includeSpecialInstructions: fitSpecial,
    specialInstructionsSlice: fitSpecialSlice,
    includeSecondaryOnRemainder: false,
    isSplitPart: isFirstHeader ? 'FIRST' : 'MIDDLE',
    splitRef,
    breakDecision: `SPLIT_FIT_${isFirstHeader ? 'FIRST' : 'MIDDLE'}`
  };

  const remPrefix = isVisa ? `block-visa-service-${sIdx}` : `block-day-${day?.dayNumber ?? 0}-service-${sIdx}`;
  const remainderBlock: PaginationBlock = {
    ...block,
    id: `${remPrefix}-rem-${splitSeq}-${fitSegments.length}`,
    type: isVisa ? 'VISA_SERVICE_CONTINUATION' : 'DAY_SERVICE_CONTINUATION',
    html: remHtml,
    estimatedHeight: remHeight,
    splittable:
      remSegments.length > 1 ||
      (remSegments.length === 1 && (remHasSecondary || stripHtmlTagsAndEntities(remSegments[0]).length > 160)) ||
      remSecCount > 1 ||
      Boolean(remSpecialSlice && stripHtmlTagsAndEntities(remSpecialSlice).length > 200),
    minMeaningfulHeight: 90,
    serviceData: s,
    overviewSegments: remSegments,
    overviewIsContinued: remHasOverviewBefore,
    inclusionsSlice: remInclusions,
    exclusionsSlice: remExclusions,
    includeSpecialInstructions: remSpecial,
    specialInstructionsSlice: remSpecialSlice,
    includeSecondaryOnRemainder: remHasSecondary,
    isSplitPart: remainderSplitRole,
    splitRef,
    breakDecision: `SPLIT_REM_${remainderSplitRole}`
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
  const hasLongOverview =
    overviewSegments.length > 1 ||
    stripHtmlTagsAndEntities(s.overview).length > 160 ||
    (s.specialInstructions ? stripHtmlTagsAndEntities(s.specialInstructions).length > 220 : false);
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
        splittable: remSegs.length > 1 || (remSegs.length === 1 && hasSecondaryDetails) || (s.specialInstructions ? stripHtmlTagsAndEntities(s.specialInstructions).length > 220 : false),
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

/**
 * Build a Visa / Ancillary Service Card block supporting clean multi-page splitting.
 */
function buildVisaServiceCardBlock(v: ServicePresentationItem, idx: number): PaginationBlock {
  const overviewSegments = extractOverviewSegments(v.overview);
  const fullHtml = renderServiceChunkHtml(v, undefined, overviewSegments, {
    mode: 'FULL',
    overviewContinuedHeader: false,
    includeDetailsFooter: true,
    isVisaCard: true
  });
  const fullHeight = estimateServiceCardHeight(v);
  const hasSecondaryDetails = v.inclusions.length > 0 || v.exclusions.length > 0 || Boolean(v.specialInstructions);
  const canSplit =
    hasSecondaryDetails ||
    overviewSegments.length > 1 ||
    stripHtmlTagsAndEntities(v.overview).length > 160 ||
    (v.specialInstructions ? stripHtmlTagsAndEntities(v.specialInstructions).length > 220 : false);

  return {
    id: `block-visa-service-${idx}`,
    type: 'VISA_SERVICE_CARD',
    html: fullHtml,
    estimatedHeight: fullHeight,
    splittable: canSplit,
    minMeaningfulHeight: canSplit ? Math.min(fullHeight, MIN_ACTIVITY_START_HEIGHT) : fullHeight,
    serviceId: v.id,
    serviceIndex: idx,
    serviceData: v,
    overviewSegments
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
  const imgCount = (html.match(/<img\b/gi) || []).length;
  const lines = Math.max(1 + brCount, Math.ceil(plainLen / 82) + brCount);
  return Math.max(18, 8 + lines * 14.5 + tableRows * 24 + listItems * 4 + imgCount * 220);
}

interface TermFragment {
  html: string;
  keepWithNext: boolean;
  estimatedHeight: number;
}

/**
 * Splits an HTML table at row (`<tr>`) boundaries, repeating its header rows (`<thead>` or leading `<th>` rows)
 * on every chunk so long or tall-cell tables span pages cleanly without overflowing body height.
 */
function splitHtmlTableIntoRowChunks(
  tableHtml: string,
  rowsPerChunk: number = 6,
  maxChunkHeightPx: number = 320
): TermFragment[] {
  const allRows = tableHtml.match(/<tr\b[\s\S]*?<\/tr>/gi) || [];

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

  if (bodyRows.length <= 1) {
    const styled = normalizePdfTermsStyles(tableHtml);
    return [{
      html: styled,
      keepWithNext: false,
      estimatedHeight: estimateHtmlTableHeight(styled, Math.max(1, allRows.length))
    }];
  }

  const theadHtml = headerRows.length > 0 ? `<thead>${headerRows.join('')}</thead>` : '';
  const headerH = headerRows.length > 0 ? estimateHtmlTableHeight(`<table>${theadHtml}</table>`, headerRows.length) : 16;

  const chunks: TermFragment[] = [];
  let batch: string[] = [];
  let batchH = headerH;

  const flushBatch = () => {
    if (batch.length === 0) return;
    const chunkTable = normalizePdfTermsStyles(
      `<table>${theadHtml}<tbody>${batch.join('')}</tbody></table>`
    );
    chunks.push({
      html: chunkTable,
      keepWithNext: false,
      estimatedHeight: estimateHtmlTableHeight(chunkTable, headerRows.length + batch.length)
    });
    batch = [];
    batchH = headerH;
  };

  for (const row of bodyRows) {
    const rowPlain = stripHtmlTagsAndEntities(row).length;
    const rowBr = (row.match(/<br\s*\/?>/gi) || []).length;
    const rowEst = Math.max(26, 12 + Math.max(1 + rowBr, Math.ceil(rowPlain / 60) + rowBr) * 14);
    if (batch.length > 0 && (batch.length >= rowsPerChunk || batchH + rowEst > maxChunkHeightPx)) {
      flushBatch();
    }
    batch.push(row);
    batchH += rowEst;
  }
  flushBatch();

  return chunks;
}

function estimateHtmlTableHeight(styledTableHtml: string, rowCount: number): number {
  const plainLen = stripHtmlTagsAndEntities(styledTableHtml).length;
  const brCount = (styledTableHtml.match(/<br\s*\/?>/gi) || []).length;
  const avgCharsPerRow = rowCount > 0 ? plainLen / rowCount : plainLen;
  const extraLinesPerRow = Math.max(0, Math.ceil(avgCharsPerRow / 60) - 1);
  return Math.max(46, 18 + rowCount * (24 + extraLinesPerRow * 13) + brCount * 14);
}

/**
 * Splits a long <ul> or <ol> list into height-bounded <li> chunks (even splitting an oversized single <li> if needed)
 * preserving indentation and numbering.
 */
function splitHtmlListIntoChunks(
  listHtml: string,
  itemsPerChunk: number = 5,
  maxChunkHeightPx: number = 280
): TermFragment[] {
  const isOrdered = /^\s*<ol\b/i.test(listHtml);
  const tag = isOrdered ? 'ol' : 'ul';
  const rawItems = listHtml.match(/<li\b[\s\S]*?<\/li>/gi) || [];

  // Normalize / sub-split any monstrous individual <li> (>340 chars or >8 <br> breaks)
  const items: Array<{ html: string; ordStep: number }> = [];
  rawItems.forEach((liHtml) => {
    const liPlain = stripHtmlTagsAndEntities(liHtml).length;
    const liBr = (liHtml.match(/<br\s*\/?>/gi) || []).length;
    if (liPlain <= 340 && liBr <= 8) {
      items.push({ html: liHtml, ordStep: 1 });
      return;
    }
    const inner = liHtml.replace(/^\s*<li\b[^>]*>/i, '').replace(/<\/li>\s*$/i, '').trim();
    const parts = splitHtmlWithInlineTagsAtBoundary(inner, 280, 7);
    if (parts.length <= 1) {
      items.push({ html: liHtml, ordStep: 1 });
    } else {
      parts.forEach((p, idx) => {
        const contStyle = idx > 0 ? ' style="list-style-type: none;"' : '';
        items.push({ html: `<li${contStyle}>${p}</li>`, ordStep: idx === 0 ? 1 : 0 });
      });
    }
  });

  if (items.length <= 1) {
    const styled = normalizePdfTermsStyles(listHtml);
    return [{
      html: styled,
      keepWithNext: false,
      estimatedHeight: estimateHtmlUnitHeight(styled)
    }];
  }

  const chunks: TermFragment[] = [];
  let batch: Array<{ html: string; ordStep: number }> = [];
  let batchH = 12;
  let runningOrderNum = 1;

  const flushBatch = () => {
    if (batch.length === 0) return;
    const isContNoMarker = batch.length === 1 && batch[0].ordStep === 0;
    const startAttr = isOrdered && !isContNoMarker ? ` start="${runningOrderNum}"` : '';
    const extraUlStyle = isContNoMarker ? ' style="list-style-type: none;"' : '';
    const chunkList = normalizePdfTermsStyles(`<${tag}${startAttr}${extraUlStyle}>${batch.map(b => b.html).join('')}</${tag}>`);
    chunks.push({
      html: chunkList,
      keepWithNext: false,
      estimatedHeight: estimateHtmlUnitHeight(chunkList)
    });
    runningOrderNum += batch.reduce((sum, b) => sum + b.ordStep, 0);
    batch = [];
    batchH = 12;
  };

  for (const item of items) {
    const itemEst = estimateHtmlUnitHeight(item.html);
    if (batch.length > 0 && (batch.length >= itemsPerChunk || batchH + itemEst > maxChunkHeightPx)) {
      flushBatch();
    }
    batch.push(item);
    batchH += itemEst;
  }
  flushBatch();

  return chunks;
}

/**
 * Extracts granular block elements from arbitrary HTML (supporting nested wrappers, images, and <br>-delimited subheadings).
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

        if (tag === 'div' || tag === 'section' || tag === 'article' || tag === 'figure') {
          const hasBlockChildren = Array.from(el.children).some(c =>
            ['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote', 'section', 'article', 'pre', 'img'].includes(
              c.tagName.toLowerCase()
            )
          );
          if (hasBlockChildren) {
            collectFromNode(el);
            return;
          }
        }
        if (hasMeaningfulHtmlContent(el.outerHTML) || /<img\b/i.test(el.outerHTML)) {
          fragments.push(el.outerHTML);
        }
      });
    };

    collectFromNode(root);
    return fragments.length > 0 ? fragments : [input];
  }

  // Deterministic Node/SSR HTML block token extractor (balanced tag scanning)
  const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'table', 'blockquote', 'section', 'article', 'pre', 'figure', 'hr']);
  const fragments: string[] = [];

  const scanTopBlocks = (htmlStr: string): string[] => {
    const out: string[] = [];
    let cursor = 0;
    const len = htmlStr.length;
    let scanGuard = 0;
    const maxScanIters = Math.max(500, len + 10);

    while (cursor < len && scanGuard++ < maxScanIters) {
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
      const isSelfClosing = /\/\s*>$/.test(openTagRaw) || VOID_HTML_TAGS.has(tagName);

      if (tagName === 'img') {
        out.push(openTagRaw);
        cursor = tagEndIdx + 1;
        continue;
      }

      if (isClosing || isSelfClosing || !blockTags.has(tagName)) {
        if (!isClosing && !isSelfClosing && !blockTags.has(tagName)) {
          const closeMatchIdx = findMatchingCloseTag(htmlStr, tagName, tagEndIdx + 1);
          const inlineEnd = closeMatchIdx !== -1 ? closeMatchIdx : tagEndIdx + 1;
          const inlineChunk = htmlStr.slice(nextTagIdx, inlineEnd).trim();
          if (hasMeaningfulHtmlContent(inlineChunk) || /<img\b/i.test(inlineChunk)) {
            out.push(`<p style="margin: 0 0 4px 0;">${inlineChunk}</p>`);
          }
          cursor = Math.max(cursor + 1, inlineEnd);
          continue;
        }
        cursor = tagEndIdx + 1;
        continue;
      }

      const closeIdx = findMatchingCloseTag(htmlStr, tagName, tagEndIdx + 1);
      const endPos = closeIdx !== -1 ? closeIdx : len;
      const fullElement = htmlStr.slice(nextTagIdx, endPos);

      if (tagName === 'div' || tagName === 'section' || tagName === 'article' || tagName === 'figure') {
        const inner = fullElement.replace(/^<[^>]+>/, '').replace(/<\/[^>]+>\s*$/, '');
        if (/<\s*(?:p|div|h[1-6]|ul|ol|table|blockquote|section|article|pre|img)\b/i.test(inner) && inner.length < htmlStr.length) {
          out.push(...scanTopBlocks(inner));
          cursor = Math.max(cursor + 1, endPos);
          continue;
        }
      }

      if (hasMeaningfulHtmlContent(fullElement) || /<img\b/i.test(fullElement)) {
        out.push(fullElement);
      }
      cursor = Math.max(cursor + 1, endPos);
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
  let guard = 0;
  while ((match = regex.exec(html)) !== null && guard++ < 5000) {
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
 * Decomposes a Commercial Quotation Terms / Rich HTML section into page-breakable sub-blocks:
 * - Preserves numbered headings (keepWithNext: true) attached to their following paragraph/list/table.
 * - Splits tables cleanly at <tr> boundaries with repeated <thead>.
 * - Splits long lists between <li> items (or oversized single <li>) and long paragraphs at line/sentence boundaries.
 */
function decomposeRichTermsHtmlIntoBlocks(rawHtml: string): TermFragment[] {
  const topBlocks = extractTopLevelHtmlFragments(normalizeInlineImagesHtml(rawHtml));
  const results: TermFragment[] = [];

  for (const frag of topBlocks) {
    const trimmed = frag.trim();
    if (!hasMeaningfulHtmlContent(trimmed) && !/<img\b/i.test(trimmed)) continue;

    // 1. Table block (never split inside a row; repeat header if multi-page)
    if (/^<table\b/i.test(trimmed)) {
      results.push(...splitHtmlTableIntoRowChunks(trimmed, 4, 240));
      continue;
    }

    // 2. List block (<ul> / <ol>)
    if (/^<(?:ul|ol)\b/i.test(trimmed)) {
      results.push(...splitHtmlListIntoChunks(trimmed, 3, 240));
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

    // 4. Paragraph or single div/blockquote: split on <br> or line/sentence budget so no chunk exceeds ~240px
    const isBlockquote = /^<blockquote\b/i.test(trimmed);
    const innerContent = trimmed.replace(/^<(?:p|div|blockquote)\b[^>]*>/i, '').replace(/<\/(?:p|div|blockquote)>\s*$/i, '');
    const brSegments = /<br\s*\/?>/i.test(innerContent)
      ? innerContent.split(/<br\s*\/?>/gi).map(s => s.trim()).filter(s => hasMeaningfulHtmlContent(s) || /<img\b/i.test(s))
      : [innerContent];

    for (const seg of brSegments) {
      const plain = stripHtmlTagsAndEntities(seg);
      const hadStrong = /^\s*<(?:strong|b)\b[\s\S]*<\/(?:strong|b)>\s*$/i.test(seg);
      const isHeading = !isBlockquote && isLikelyTermHeadingText(plain, false, hadStrong);

      if (isHeading) {
        const headingHtml = `<div style="font-weight: 800; color: #0f172a; font-size: 10px; margin: 5px 0 2px 0; line-height: 1.38; page-break-after: avoid; break-after: avoid;">${normalizePdfTermsStyles(seg)}</div>`;
        results.push({
          html: headingHtml,
          keepWithNext: true,
          estimatedHeight: estimateHtmlUnitHeight(headingHtml)
        });
      } else if (plain.length > 340 && !/<(?:table|ul|ol)\b/i.test(seg)) {
        const inlineParts = splitHtmlWithInlineTagsAtBoundary(seg, 300, 7);
        for (const part of inlineParts) {
          const pHtml = isBlockquote
            ? `<blockquote style="margin: 0 0 4px 0; padding-left: 10px; border-left: 2px solid #cbd5e1; color: #475569; line-height: 1.45;">${normalizePdfTermsStyles(part)}</blockquote>`
            : `<p style="margin: 0 0 4px 0; color: #475569; line-height: 1.45; word-break: break-word;">${normalizePdfTermsStyles(part)}</p>`;
          results.push({
            html: pHtml,
            keepWithNext: false,
            estimatedHeight: estimateHtmlUnitHeight(pHtml)
          });
        }
      } else {
        const pHtml = isBlockquote
          ? `<blockquote style="margin: 0 0 4px 0; padding-left: 10px; border-left: 2px solid #cbd5e1; color: #475569; line-height: 1.45;">${normalizePdfTermsStyles(seg)}</blockquote>`
          : `<div style="margin: 0 0 4px 0; color: #475569; line-height: 1.45; word-break: break-word;">${normalizePdfTermsStyles(seg)}</div>`;
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
      blocks.push(buildVisaServiceCardBlock(v, idx));
    });
  }

  // 2.5 JOURNEY NARRATIVE & OVERVIEW BLOCK (Decomposed when long/rich so it never overflows a page)
  if (model.itineraryOverview && (hasMeaningfulHtmlContent(model.itineraryOverview) || /<img\b/i.test(model.itineraryOverview))) {
    const normalizedItinOv = normalizeInlineImagesHtml(model.itineraryOverview);
    const estCompactH = estimateRichHtmlBlockHeight(normalizedItinOv, 48);
    if (estCompactH <= 260 && !/<(?:table|ul|ol|img)\b/i.test(normalizedItinOv)) {
      const compactItinOvHtml = /<[a-z][\s\S]*>/i.test(normalizedItinOv)
        ? normalizedItinOv
        : escapePdfText(normalizedItinOv).replace(/\r?\n/g, '<br/>');
      blocks.push({
        id: 'block-itinerary-overview',
        type: 'ITINERARY_OVERVIEW_BLOCK',
        html: `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00C6A6; border-radius: 12px; padding: 12px 16px; margin-top: 10px; margin-bottom: 10px;">
            <div data-pdf-synthetic-label="true" style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #008972; margin-bottom: 4px; display: flex; align-items: center; gap: 4px;">
              <span>✨ Journey Narrative &amp; Overview</span>
            </div>
            <div class="theunbound-rich-text" style="font-size: 11px; color: #334155; line-height: 1.5; word-break: break-word;">
              ${compactItinOvHtml}
            </div>
          </div>
        `,
        estimatedHeight: estCompactH,
        splittable: false,
        minMeaningfulHeight: estCompactH
      });
    } else {
      const fragments = decomposeRichTermsHtmlIntoBlocks(normalizedItinOv);
      blocks.push({
        id: 'block-itinerary-overview-header',
        type: 'ITINERARY_OVERVIEW_BLOCK',
        html: `
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #00C6A6; border-radius: 10px 10px 0 0; padding: 10px 16px 6px 16px; margin-top: 10px;">
            <div style="font-size: 9.5px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #008972; display: flex; align-items: center; gap: 4px;">
              <span>✨ Journey Narrative &amp; Overview</span>
            </div>
          </div>
        `,
        estimatedHeight: 34,
        splittable: false,
        minMeaningfulHeight: 34,
        keepWithNext: fragments.length > 0
      });
      fragments.forEach((frag, fIdx) => {
        const isLast = fIdx === fragments.length - 1;
        blocks.push({
          id: `block-itinerary-overview-frag-${fIdx}`,
          type: 'ITINERARY_OVERVIEW_BLOCK',
          html: `
            <div style="background: #f8fafc; border-left: 4px solid #00C6A6; border-right: 1px solid #e2e8f0; ${isLast ? 'border-bottom: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; margin-bottom: 10px; padding-bottom: 10px;' : ''} padding: 4px 16px; font-size: 10.5px; color: #334155; line-height: 1.48; word-break: break-word;">
              ${frag.html}
            </div>
          `,
          estimatedHeight: frag.estimatedHeight + 8,
          splittable: false,
          minMeaningfulHeight: frag.estimatedHeight + 8,
          keepWithNext: frag.keepWithNext
        });
      });
    }
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

    const dayMeta = {
      dayNumber: day.dayNumber,
      hubName: day.hubName,
      prevHubName: day.prevHubName,
      formattedDate: day.formattedDate,
      dayOfWeek: day.dayOfWeek,
      customTheme: day.customTheme
    };

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
      dayMeta
    });

    if (day.dayOverview && (hasMeaningfulHtmlContent(day.dayOverview) || /<img\b/i.test(day.dayOverview))) {
      const normalizedDayOv = normalizeInlineImagesHtml(day.dayOverview);
      const ovEst = estimateRichHtmlBlockHeight(normalizedDayOv, 38);
      const ovSegs = extractOverviewSegments(day.dayOverview);
      if (ovSegs.length <= 1 && ovEst <= 240 && !/<(?:table|ul|ol|img)\b/i.test(normalizedDayOv)) {
        const compactDayOvHtml = /<[a-z][\s\S]*>/i.test(normalizedDayOv)
          ? normalizedDayOv
          : (ovSegs.length === 1 ? formatOverviewSegmentsHtml(ovSegs) : escapePdfText(normalizedDayOv).replace(/\r?\n/g, '<br/>'));
        blocks.push({
          id: `block-day-${day.dayNumber}-overview`,
          type: 'DAY_OVERVIEW_BLOCK',
          html: `
            <div data-day-id="${dayId}" style="padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 10px; font-size: 10.5px; color: #334155; line-height: 1.45; word-break: break-word;">
              <span data-pdf-synthetic-label="true" style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #0d9488; display: block; margin-bottom: 2px;">Day ${day.dayNumber} Overview</span>
              <div class="theunbound-rich-text">${compactDayOvHtml}</div>
            </div>
          `,
          estimatedHeight: ovEst,
          splittable: false,
          minMeaningfulHeight: ovEst,
          keepWithNext: day.services.length > 0,
          dayId,
          dayNumber: day.dayNumber,
          dayMeta
        });
      } else {
        const fragList = ovSegs.length > 0 ? ovSegs : [normalizedDayOv];
        fragList.forEach((seg, fIdx) => {
          const isFirst = fIdx === 0;
          const isLast = fIdx === fragList.length - 1;
          const fragEst = estimateRichHtmlBlockHeight(seg, isFirst ? 34 : 26);
          blocks.push({
            id: `block-day-${day.dayNumber}-overview-frag-${fIdx}`,
            type: 'DAY_OVERVIEW_FRAGMENT',
            html: `
              <div data-day-id="${dayId}" style="padding: ${isFirst ? '10px 14px 6px 14px' : '6px 14px'}; border-radius: ${isFirst && isLast ? '10px' : isFirst ? '10px 10px 0 0' : isLast ? '0 0 10px 10px' : '0'}; background: #f8fafc; border: 1px solid #e2e8f0; ${!isFirst ? 'border-top: none;' : ''} ${isLast ? 'margin-bottom: 10px; padding-bottom: 10px;' : 'margin-bottom: 0;'} font-size: 10.5px; color: #334155; line-height: 1.45; word-break: break-word;">
                <span data-pdf-synthetic-label="true" style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #0d9488; display: block; margin-bottom: 2px;">Day ${day.dayNumber} Overview${isFirst ? '' : ' (Continued)'}</span>
                <div class="theunbound-rich-text">${formatOverviewSegmentsHtml([seg])}</div>
              </div>
            `,
            estimatedHeight: fragEst,
            splittable: false,
            minMeaningfulHeight: fragEst,
            keepWithNext: false,
            dayId,
            dayNumber: day.dayNumber,
            dayMeta
          });
        });
      }
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
        dayNumber: day.dayNumber,
        dayMeta
      });
    } else {
      day.services.forEach((s, sIdx) => {
        blocks.push(buildDayServiceCardBlock(s, { ...day, dayId }, sIdx));
      });
    }

    if (day.dayNotes && (hasMeaningfulHtmlContent(day.dayNotes) || /<img\b/i.test(day.dayNotes))) {
      const normalizedNotes = normalizeInlineImagesHtml(day.dayNotes);
      const noteEst = estimateRichHtmlBlockHeight(normalizedNotes, 38);
      const noteSegs = extractOverviewSegments(day.dayNotes);
      if (noteSegs.length <= 1 && noteEst <= 240 && !/<(?:table|ul|ol|img)\b/i.test(normalizedNotes)) {
        const compactNotesHtml = /<[a-z][\s\S]*>/i.test(normalizedNotes)
          ? normalizedNotes
          : (noteSegs.length === 1 ? formatOverviewSegmentsHtml(noteSegs) : escapePdfText(normalizedNotes).replace(/\r?\n/g, '<br/>'));
        blocks.push({
          id: `block-day-${day.dayNumber}-notes`,
          type: 'DAY_NOTES_BLOCK',
          html: `
            <div data-day-id="${dayId}" style="padding: 10px 14px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; margin-bottom: 10px; font-size: 10px; color: #78350f; line-height: 1.4; word-break: break-word;">
              <strong data-pdf-synthetic-label="true">Day ${day.dayNumber} Operational Notes: </strong>${compactNotesHtml}
            </div>
          `,
          estimatedHeight: noteEst,
          splittable: false,
          minMeaningfulHeight: noteEst,
          dayId,
          dayNumber: day.dayNumber,
          dayMeta
        });
      } else {
        const fragList = noteSegs.length > 0 ? noteSegs : [normalizedNotes];
        fragList.forEach((seg, fIdx) => {
          const isFirst = fIdx === 0;
          const isLast = fIdx === fragList.length - 1;
          const fragEst = estimateRichHtmlBlockHeight(seg, 32);
          blocks.push({
            id: `block-day-${day.dayNumber}-notes-frag-${fIdx}`,
            type: 'DAY_NOTES_FRAGMENT',
            html: `
              <div data-day-id="${dayId}" style="padding: 8px 14px; border-radius: ${isFirst && isLast ? '10px' : isFirst ? '10px 10px 0 0' : isLast ? '0 0 10px 10px' : '0'}; background: #fffbeb; border: 1px solid #fde68a; ${!isFirst ? 'border-top: none;' : ''} ${isLast ? 'margin-bottom: 10px;' : 'margin-bottom: 0;'} font-size: 10px; color: #78350f; line-height: 1.4; word-break: break-word;">
                <strong data-pdf-synthetic-label="true">Day ${day.dayNumber} Operational Notes${isFirst ? '' : ' (Continued)'}: </strong>${formatOverviewSegmentsHtml([seg])}
              </div>
            `,
            estimatedHeight: fragEst,
            splittable: false,
            minMeaningfulHeight: fragEst,
            dayId,
            dayNumber: day.dayNumber,
            dayMeta
          });
        });
      }
    }
  });

  // 4. ADDITIONAL SERVICES (Chunked across rows when large so it never overflows)
  if (model.additionalServices && model.additionalServices.length > 0) {
    if (model.additionalServices.length <= 6) {
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
    } else {
      blocks.push({
        id: 'block-additional-services-header',
        type: 'ADDITIONAL_SERVICES',
        html: `
          <div style="margin-top: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 8px; font-size: 11.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
            ✨ Additional Package Privileges & Services
          </div>
        `,
        estimatedHeight: 36,
        splittable: false,
        minMeaningfulHeight: 36,
        keepWithNext: true
      });
      for (let idx = 0; idx < model.additionalServices.length; idx += 6) {
        const chunk = model.additionalServices.slice(idx, idx + 6);
        const chunkH = 24 + Math.ceil(chunk.length / 2) * 34;
        blocks.push({
          id: `block-additional-services-chunk-${idx}`,
          type: 'ADDITIONAL_SERVICES',
          html: `
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 10px;">
              ${chunk.map(a => `
                <div style="padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; display: flex; justify-content: space-between; font-size: 10.5px;">
                  <div>
                    <div style="font-weight: 700; color: #0f172a;">${escapePdfText(a.name)}</div>
                    <div style="font-size: 9.5px; color: #64748b;">${escapePdfText(a.summary)}</div>
                  </div>
                  <span style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #065f46; background: #d1fae5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Included</span>
                </div>
              `).join('')}
            </div>
          `,
          estimatedHeight: chunkH,
          splittable: false,
          minMeaningfulHeight: chunkH
        });
      }
    }
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
          ${model.appliedPromotion ? `
            <div style="font-size: 12px; font-weight: 800; color: #6ee7b7; margin: 3px 0 3px 0;">
              <strong>Promotional Discount (${escapePdfText(model.appliedPromotion.code)}):</strong> <span style="font-family: monospace;">-${escapePdfText(model.appliedPromotion.discountAmountFormatted)}</span>
            </div>
          ` : ''}
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
          ${model.appliedPromotion ? `
            <div style="font-size: 10px; font-weight: 800; color: #6ee7b7; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Promo (${escapePdfText(model.appliedPromotion.code)}): <span style="font-family: monospace;">-${escapePdfText(model.appliedPromotion.discountAmountFormatted)}</span></div>
          ` : ''}
          <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Final Selling Price</div>
          <div style="font-size: 22px; font-weight: 900; font-family: monospace; color: #00E5C0;">${escapePdfText(model.finalCustomerSellingPriceFormatted)}</div>
          <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${escapePdfText(model.guaranteedCurrencyLine)}</div>
        </div>
      </div>
    `,
    estimatedHeight: model.hasHotelAccommodation ? (model.appliedPromotion ? 195 : 175) : (model.appliedPromotion ? 170 : 150),
    splittable: false,
    minMeaningfulHeight: model.hasHotelAccommodation ? (model.appliedPromotion ? 195 : 175) : (model.appliedPromotion ? 170 : 150)
  });

  // 6B. PACKAGE INCLUSIONS, EXCLUSIONS & POLICY NOTES (Granular & Page-Break Safe, zero arbitrary height cap)
  if (
    model.inclusions.length > 0 ||
    model.exclusions.length > 0 ||
    model.importantInformation ||
    model.cancellationPolicy
  ) {
    const isCompactIncExc =
      model.inclusions.length <= 8 &&
      model.exclusions.length <= 8 &&
      (model.inclusions.length + model.exclusions.length) > 0;

    if (isCompactIncExc) {
      const maxColItems = Math.max(model.inclusions.length, model.exclusions.length);
      const gridEstH = 60 + maxColItems * 22;
      blocks.push({
        id: 'block-package-inclusions-notes',
        type: 'POLICIES_CONTAINER',
        html: `
          <div style="margin-top: 8px; margin-bottom: 8px; font-size: 10px; display: grid; grid-template-columns: ${model.inclusions.length > 0 && model.exclusions.length > 0 ? '1fr 1fr' : '1fr'}; gap: 10px;">
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
        `,
        estimatedHeight: gridEstH,
        splittable: false,
        minMeaningfulHeight: gridEstH
      });
    } else {
      for (let i = 0; i < model.inclusions.length; i += 8) {
        const chunk = model.inclusions.slice(i, i + 8);
        const h = 52 + chunk.reduce((acc, s) => acc + Math.max(1, Math.ceil(s.length / 82)) * 18, 0);
        blocks.push({
          id: `block-package-inclusions-${i}`,
          type: 'POLICIES_CONTAINER',
          html: `
            <div style="margin-top: 6px; margin-bottom: 8px; font-size: 10px; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 10px 12px;">
              <div style="font-weight: 900; color: #064e3b; text-transform: uppercase; font-size: 9.5px; margin-bottom: 4px;">✓ Package Inclusions${i > 0 ? ' (Continued)' : ''}</div>
              <ul style="margin: 0; padding-left: 16px; color: #065f46; line-height: 1.4;">
                ${chunk.map((inc) => `<li style="margin-bottom: 2px;">${escapePdfText(inc)}</li>`).join('')}
              </ul>
            </div>
          `,
          estimatedHeight: h,
          splittable: false,
          minMeaningfulHeight: h
        });
      }
      for (let i = 0; i < model.exclusions.length; i += 8) {
        const chunk = model.exclusions.slice(i, i + 8);
        const h = 52 + chunk.reduce((acc, s) => acc + Math.max(1, Math.ceil(s.length / 82)) * 18, 0);
        blocks.push({
          id: `block-package-exclusions-${i}`,
          type: 'POLICIES_CONTAINER',
          html: `
            <div style="margin-top: 6px; margin-bottom: 8px; font-size: 10px; background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 10px 12px;">
              <div style="font-weight: 900; color: #881337; text-transform: uppercase; font-size: 9.5px; margin-bottom: 4px;">✕ Package Exclusions${i > 0 ? ' (Continued)' : ''}</div>
              <ul style="margin: 0; padding-left: 16px; color: #9f1239; line-height: 1.4;">
                ${chunk.map((exc) => `<li style="margin-bottom: 2px;">${escapePdfText(exc)}</li>`).join('')}
              </ul>
            </div>
          `,
          estimatedHeight: h,
          splittable: false,
          minMeaningfulHeight: h
        });
      }
    }

    const pushDecomposedPolicyCard = (idPrefix: string, title: string, rawText: string) => {
      const trimmed = String(rawText || '').trim();
      if (!trimmed) return;
      const lines = Math.max(1, Math.ceil(trimmed.length / 82));
      if (lines <= 12) {
        const h = 44 + lines * 16;
        blocks.push({
          id: idPrefix,
          type: 'POLICIES_CONTAINER',
          html: `
            <div style="margin-top: 4px; margin-bottom: 8px; font-size: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 12px;">
              <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; font-size: 9.5px; margin-bottom: 3px;">${escapePdfText(title)}</div>
              <div style="color: #475569; line-height: 1.45; white-space: pre-line;">${escapePdfText(trimmed)}</div>
            </div>
          `,
          estimatedHeight: h,
          splittable: false,
          minMeaningfulHeight: h
        });
        return;
      }
      // Split oversized Important Information / Cancellation Policy cleanly into paragraphs/sentences
      const parts = decomposeRichTermsHtmlIntoBlocks(escapePdfText(trimmed).replace(/\r?\n/g, '<br/>'));
      blocks.push({
        id: `${idPrefix}-header`,
        type: 'POLICIES_CONTAINER',
        html: `
          <div style="margin-top: 6px; font-size: 10px; background: #f8fafc; border: 1px solid #e2e8f0; border-bottom: none; border-radius: 10px 10px 0 0; padding: 8px 12px 4px 12px;">
            <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; font-size: 9.5px;">${escapePdfText(title)}</div>
          </div>
        `,
        estimatedHeight: 28,
        splittable: false,
        minMeaningfulHeight: 28,
        keepWithNext: parts.length > 0
      });
      parts.forEach((frag, idx) => {
        const isLast = idx === parts.length - 1;
        blocks.push({
          id: `${idPrefix}-frag-${idx}`,
          type: 'POLICIES_CONTAINER',
          html: `
            <div style="font-size: 10px; background: #f8fafc; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0; ${isLast ? 'border-bottom: 1px solid #e2e8f0; border-radius: 0 0 10px 10px; margin-bottom: 8px; padding-bottom: 8px;' : ''} padding: 3px 12px; color: #475569; line-height: 1.45;">
              ${frag.html}
            </div>
          `,
          estimatedHeight: frag.estimatedHeight + 6,
          splittable: false,
          minMeaningfulHeight: frag.estimatedHeight + 6,
          keepWithNext: frag.keepWithNext
        });
      });
    };

    if (model.importantInformation) {
      pushDecomposedPolicyCard('block-important-information', 'Important Information', model.importantInformation);
    }
    if (model.cancellationPolicy) {
      pushDecomposedPolicyCard('block-cancellation-policy', 'Cancellation Policy', model.cancellationPolicy);
    }
  }

  // 7. OPERATIONAL GUIDELINES & POLICIES (Chunked cleanly if list exceeds 8 items)
  if (model.childAndAttractionPolicies.length <= 8) {
    const policiesHeight = 76 + model.childAndAttractionPolicies.reduce((acc, p) => acc + Math.max(1, Math.ceil(p.length / 82)) * 18, 0);
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
  } else {
    for (let i = 0; i < model.childAndAttractionPolicies.length; i += 6) {
      const chunk = model.childAndAttractionPolicies.slice(i, i + 6);
      const chunkH = 54 + chunk.reduce((acc, p) => acc + Math.max(1, Math.ceil(p.length / 82)) * 18, 0);
      blocks.push({
        id: i === 0 ? 'block-policies' : `block-policies-${i}`,
        type: 'POLICIES_CONTAINER',
        html: `
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 10px 14px; margin-top: 6px; margin-bottom: 8px; font-size: 10px;">
            <div style="font-weight: 900; color: #78350f; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">
              ℹ️ Operational Guidelines & Child / Attraction Policy${i > 0 ? ' (Continued)' : ''}
            </div>
            <ul style="margin: 0; padding-left: 18px; color: #92400e; line-height: 1.45;">
              ${chunk.map(p => `<li style="margin-bottom: 3px;">${escapePdfText(p)}</li>`).join('')}
            </ul>
          </div>
        `,
        estimatedHeight: chunkH,
        splittable: false,
        minMeaningfulHeight: chunkH
      });
    }
  }

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
          const firstSegCount = block.splitParts.firstPart.overviewSegments?.length ?? 0;
          if (firstSegCount <= 1) {
            block.minMeaningfulHeight = Math.min(
              block.estimatedHeight,
              block.splitParts.firstPart.estimatedHeight
            );
          } else {
            block.minMeaningfulHeight = Math.max(
              MIN_ACTIVITY_START_HEIGHT,
              Math.min(block.estimatedHeight, Math.ceil(block.splitParts.firstPart.estimatedHeight * 0.72))
            );
          }
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
 * Compare rendered HTML against raw HTML/text without false failures from injected
 * "(Continued)" sub-labels or safe inline-image normalization styles, while enforcing
 * zero dropped text or dropped images.
 */
function stripSyntheticPdfChromeLabels(html: string): string {
  return String(html || '').replace(
    /<([a-z0-9]+)\b[^>]*\bdata-pdf-synthetic-label\s*=\s*(['"])true\2[^>]*>[\s\S]*?<\/\1>/gi,
    ' '
  );
}

function containsAllNormalizedContent(renderedHtml: string, rawSource?: string): boolean {
  if (!rawSource) return true;
  if (renderedHtml.includes(rawSource)) return true;

  // Verify every <img> src referenced in source still exists in renderedHtml (entity-normalized)
  const decodedRendered = decodeHtmlEntities(renderedHtml);
  const imgSrcRe = /<img\b[^>]*\bsrc\s*=\s*(['"])([^'"]+)\1/gi;
  let imgMatch: RegExpExecArray | null;
  while ((imgMatch = imgSrcRe.exec(rawSource)) !== null) {
    const expectedSrc = decodeHtmlEntities(imgMatch[2]);
    if (expectedSrc && !decodedRendered.includes(expectedSrc)) {
      return false;
    }
  }

  const sourceNorm = stripHtmlTagsAndEntities(rawSource).toLowerCase();
  if (!sourceNorm) return true;

  const renderedWithoutChrome = stripSyntheticPdfChromeLabels(renderedHtml);
  const renderedNorm = stripHtmlTagsAndEntities(renderedWithoutChrome).toLowerCase();

  if (renderedNorm.includes(sourceNorm)) return true;

  // Allow fragment wrapper splits within long content while asserting exact token sequence in order
  const sourceWords = sourceNorm.split(/\s+/).filter(Boolean);
  if (sourceWords.length === 0) return true;
  let cursor = 0;
  for (const word of sourceWords) {
    const idx = renderedNorm.indexOf(word, cursor);
    if (idx === -1) return false;
    cursor = idx + word.length;
  }
  return true;
}

/**
 * Validate strict physical layout invariants across all paginated pages (zero footer/header overlaps,
 * no orphaned headings, sequential page numbers, no footer address leakage in body).
 */
export function validatePdfLayoutBounds(pages: RenderedPage[]): PdfLayoutBoundsValidation {
  const errors: string[] = [];
  const pageSummaries: PdfLayoutBoundsValidation['pageSummaries'] = [];
  const diagnostics: PageLayoutDiagnostics[] = [];

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
    const overflowPx = Math.max(0, page.usedContentHeight - page.availableContentHeight);
    if (page.usedContentHeight > page.availableContentHeight + 2) {
      const topBlocksSummary = page.blocks
        .map(b => `${b.id}(${b.type}:${b.estimatedHeight}px)`)
        .join(', ');
      errors.push(
        `Page ${page.pageNumber} body height (${page.usedContentHeight}px) exceeds availableContentHeight (${page.availableContentHeight}px) and would collide with footer. Blocks: [${topBlocksSummary}]`
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
      overflowPx,
      headerHeight: page.bounds.headerHeight,
      footerHeight: page.bounds.footerHeight,
      blockCount: page.blocks.length
    });
    if (page.diagnostics) {
      diagnostics.push(page.diagnostics);
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    pageSummaries,
    diagnostics
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

  // 2.5 Validate Visa Services completeness if present
  if (model.visaServices && model.visaServices.length > 0) {
    const visaBlocks = allBlocksWithPage
      .filter((e) => e.block.type === 'VISA_SERVICE_CARD' || e.block.type === 'VISA_SERVICE_CONTINUATION')
      .map((e) => e.block);

    model.visaServices.forEach((v, vIdx) => {
      const blocksForVisa = visaBlocks.filter((b) => b.serviceIndex === vIdx);
      if (blocksForVisa.length === 0) {
        errors.push(`Visa service "${v.listingName}" is missing from rendered PDF.`);
        return;
      }
      const visaHtml = blocksForVisa.map((b) => b.html).join('\n');
      if (!containsAllNormalizedContent(visaHtml, v.listingName)) {
        errors.push(`Visa service title "${v.listingName}" missing.`);
      }
      for (const inc of v.inclusions) {
        if (!containsAllNormalizedContent(visaHtml, inc)) {
          errors.push(`Visa service "${v.listingName}" missing inclusion "${inc}".`);
        }
      }
      for (const exc of v.exclusions) {
        if (!containsAllNormalizedContent(visaHtml, exc)) {
          errors.push(`Visa service "${v.listingName}" missing exclusion "${exc}".`);
        }
      }
      if (v.specialInstructions && !containsAllNormalizedContent(visaHtml, v.specialInstructions)) {
        errors.push(`Visa service "${v.listingName}" missing special instructions.`);
      }
    });
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

    const overviewBlocksHtml = dayBlocksWithPage
      .filter((e) => e.block.type === 'DAY_OVERVIEW_BLOCK' || e.block.type === 'DAY_OVERVIEW_FRAGMENT')
      .map((e) => e.block.html)
      .join('\n');
    const notesBlocksHtml = dayBlocksWithPage
      .filter((e) => e.block.type === 'DAY_NOTES_BLOCK' || e.block.type === 'DAY_NOTES_FRAGMENT')
      .map((e) => e.block.html)
      .join('\n');

    let allInclusionsPresent = true;
    let allExclusionsPresent = true;
    let allOverviewsPresent = true;
    let allNotesPresent = true;
    let orderMaintained = true;

    if (
      day.dayOverview &&
      (hasMeaningfulHtmlContent(day.dayOverview) || /<img\b/i.test(day.dayOverview)) &&
      (!overviewBlocksHtml || !containsAllNormalizedContent(overviewBlocksHtml, day.dayOverview))
    ) {
      allOverviewsPresent = false;
      errors.push(`Day ${day.dayNumber} overview text is missing from rendered PDF.`);
    }

    if (
      day.dayNotes &&
      (hasMeaningfulHtmlContent(day.dayNotes) || /<img\b/i.test(day.dayNotes)) &&
      (!notesBlocksHtml || !containsAllNormalizedContent(notesBlocksHtml, day.dayNotes))
    ) {
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

        if (!containsAllNormalizedContent(serviceHtml, s.listingName)) {
          errors.push(`Day ${day.dayNumber} service title "${s.listingName}" missing.`);
        }

        for (const inc of s.inclusions) {
          if (!containsAllNormalizedContent(serviceHtml, inc)) {
            allInclusionsPresent = false;
            errors.push(`Day ${day.dayNumber} service "${s.listingName}" missing inclusion "${inc}".`);
          }
        }

        for (const exc of s.exclusions) {
          if (!containsAllNormalizedContent(serviceHtml, exc)) {
            allExclusionsPresent = false;
            errors.push(`Day ${day.dayNumber} service "${s.listingName}" missing exclusion "${exc}".`);
          }
        }

        if (s.specialInstructions && !containsAllNormalizedContent(serviceHtml, s.specialInstructions)) {
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

  const rawPages: Array<{
    pageNumber: number;
    blocks: PaginationBlock[];
    usedHeight: number;
    bounds: PageBounds;
    rebalanceActions: string[];
  }> = [];

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

  const releaseTrailingOverviewAnchorIfBreaking = (): void => {
    const tail = currentPageBlocks[currentPageBlocks.length - 1];
    if (tail && tail.type === 'DAY_OVERVIEW_BLOCK') {
      tail.type = 'DAY_OVERVIEW_FRAGMENT';
      tail.keepWithNext = false;
      if (!tail.breakDecision) {
        tail.breakDecision = 'DAY_OVERVIEW_RENDERED_BEFORE_PAGE_BREAK';
      }
    }
  };

  const createNextPage = (): void => {
    if (currentPageBlocks.length > 0) {
      releaseTrailingOverviewAnchorIfBreaking();
      rawPages.push({
        pageNumber: currentPageNum,
        blocks: currentPageBlocks,
        usedHeight: currentUsedHeight,
        bounds: currentBounds,
        rebalanceActions: []
      });
      currentPageNum++;
      currentBounds = getPageContentBounds(currentPageNum, boundsOverrides);
      currentPageBlocks = [];
      currentUsedHeight = 0;
    }
  };

  const appendBlock = (block: PaginationBlock, decision?: string): void => {
    if (decision && !block.breakDecision) {
      block.breakDecision = decision;
    }
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

  const dayContinuationSeqMap = new Map<number, number>();
  const allocContinueDayHeaderBlock = (day: DayPresentationData): PaginationBlock => {
    const nextSeq = (dayContinuationSeqMap.get(day.dayNumber) ?? 0) + 1;
    dayContinuationSeqMap.set(day.dayNumber, nextSeq);
    return createContinueDayHeaderBlock(day, nextSeq);
  };

  // Dedicated DaySection renderer preserving Day Header + associated content grouping & strict bounds
  const renderDaySection = (
    day: DayPresentationData,
    dayHeaderBlock: PaginationBlock,
    dayContentBlocks: PaginationBlock[]
  ): void => {
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
    appendBlock(dayHeaderBlock, 'DAY_START');

    let hasRenderedContentOnCurrentPageForDay = false;

    const moveCurrentPageDayGroupToNextPage = (): void => {
      const startIdxOfDayOnPage = currentPageBlocks.findIndex(b => b.dayNumber === day.dayNumber);
      if (startIdxOfDayOnPage > 0) {
        const movedDayBlocks = currentPageBlocks.splice(startIdxOfDayOnPage);
        const movedHeight = movedDayBlocks.reduce((s, b) => s + b.estimatedHeight, 0);
        currentUsedHeight = Math.max(0, currentUsedHeight - movedHeight);
        createNextPage();
        movedDayBlocks.forEach(b => appendBlock(b, 'MOVED_DAY_GROUP'));
      }
    };

    // Queue allows multi-chunk remainders to be evaluated identically to upcoming blocks
    const queue: PaginationBlock[] = [...dayContentBlocks];
    const MAX_QUEUE_ITERS = Math.max(800, dayContentBlocks.length * 60);
    let queueIter = 0;

    while (queue.length > 0) {
      if (++queueIter > MAX_QUEUE_ITERS) {
        console.warn(`[PDF-PAGINATION] Queue iteration limit reached for Day ${day.dayNumber}; flushing remaining ${queue.length} blocks.`);
        for (const leftover of queue) {
          appendBlock(leftover, 'QUEUE_CAP_FLUSH');
        }
        break;
      }
      const item = queue.shift()!;
      const rem = getSafeRemainingHeight();

      // Compact single-block Day Overview stays attached under Day Header when another day precedes on this page
      if (item.type === 'DAY_OVERVIEW_BLOCK') {
        if (item.estimatedHeight > rem && currentPageBlocks.some(b => b.dayNumber !== day.dayNumber)) {
          moveCurrentPageDayGroupToNextPage();
        }
        appendBlock(item, 'DAY_OVERVIEW_ATTACHED');
        hasRenderedContentOnCurrentPageForDay = true;
        continue;
      }

      // Fragmented Day Overview / Day Notes flow strictly inside remaining height and break under CONTINUE DAY X
      if (item.type === 'DAY_OVERVIEW_FRAGMENT' || item.type === 'DAY_NOTES_FRAGMENT' || item.type === 'DAY_NOTES_BLOCK') {
        if (item.estimatedHeight <= rem) {
          appendBlock(item, 'FIT_ON_PAGE');
          hasRenderedContentOnCurrentPageForDay = true;
          continue;
        }
        if (hasRenderedContentOnCurrentPageForDay) {
          createNextPage();
          appendBlock(allocContinueDayHeaderBlock(day), 'CONTINUE_DAY_FOR_FRAGMENT');
          appendBlock(item, 'BREAK_TO_NEXT_PAGE');
          hasRenderedContentOnCurrentPageForDay = true;
          continue;
        } else {
          const startIdxOfDayOnPage = currentPageBlocks.findIndex(b => b.dayNumber === day.dayNumber);
          if (startIdxOfDayOnPage > 0) {
            moveCurrentPageDayGroupToNextPage();
            queue.unshift(item);
            continue;
          }
          appendBlock(item, 'FRESH_PAGE_OVERSIZED_DEFER_TO_REBALANCE');
          hasRenderedContentOnCurrentPageForDay = true;
          continue;
        }
      }

      // Case A: Full item fits cleanly inside safe remaining height on current page
      if (item.estimatedHeight <= rem) {
        appendBlock(item, 'FIT_ON_PAGE');
        hasRenderedContentOnCurrentPageForDay = true;
        continue;
      }

      // Case B: Item does not fit completely, and is splittable (Day Service Card or Continuation)
      if (item.splittable && item.serviceData) {
        const adaptiveSplit = rem >= 65 ? splitServiceBlockToFitHeight(item, day, rem) : null;

        if (adaptiveSplit) {
          appendBlock(adaptiveSplit.fitBlock, 'ADAPTIVE_SERVICE_SPLIT_FIT');

          // Push remaining part to top of next page under CONTINUE DAY X
          createNextPage();
          appendBlock(allocContinueDayHeaderBlock(day), 'CONTINUE_DAY_AFTER_SPLIT');
          hasRenderedContentOnCurrentPageForDay = false;
          queue.unshift(adaptiveSplit.remainderBlock);
          continue;
        }

        // Cannot fit even minimal slice in remaining space on current page
        if (hasRenderedContentOnCurrentPageForDay) {
          // Move entire item onto next page under CONTINUE DAY X
          createNextPage();
          appendBlock(allocContinueDayHeaderBlock(day), 'CONTINUE_DAY_MOVED_SERVICE');
          hasRenderedContentOnCurrentPageForDay = false;
          queue.unshift(item);
          continue;
        } else {
          // If another day/section precedes this Day's header on the current page, move the entire Day group cleanly to a fresh page
          const startIdxOfDayOnPage = currentPageBlocks.findIndex(b => b.dayNumber === day.dayNumber);
          if (startIdxOfDayOnPage > 0) {
            moveCurrentPageDayGroupToNextPage();
            queue.unshift(item);
            continue;
          }

          // Already on fresh page: try splitting strictly inside actual remaining height `rem`
          const freshPageFit = rem >= 65 ? splitServiceBlockToFitHeight(item, day, rem) : null;
          if (freshPageFit) {
            appendBlock(freshPageFit.fitBlock, 'FRESH_PAGE_SERVICE_SPLIT_FIT');
            createNextPage();
            appendBlock(allocContinueDayHeaderBlock(day), 'CONTINUE_DAY_AFTER_SPLIT');
            hasRenderedContentOnCurrentPageForDay = false;
            queue.unshift(freshPageFit.remainderBlock);
            continue;
          }

          if (item.splitParts && item.splitParts.firstPart.estimatedHeight <= rem) {
            appendBlock(item.splitParts.firstPart, 'STATIC_SPLIT_FIRST');
            createNextPage();
            appendBlock(allocContinueDayHeaderBlock(day), 'CONTINUE_DAY_AFTER_SPLIT');
            hasRenderedContentOnCurrentPageForDay = false;
            queue.unshift(item.splitParts.remainingPart);
            continue;
          }
        }
      }

      // Case C: Unsplittable item (or oversized single fragment) does not fit in remaining space
      if (hasRenderedContentOnCurrentPageForDay) {
        createNextPage();
        appendBlock(allocContinueDayHeaderBlock(day), 'CONTINUE_DAY_UNSPLITTABLE_MOVE');
        appendBlock(item, 'MOVED_TO_CONTINUATION_PAGE');
        hasRenderedContentOnCurrentPageForDay = true;
      } else {
        const startIdxOfDayOnPage = currentPageBlocks.findIndex(b => b.dayNumber === day.dayNumber);
        if (startIdxOfDayOnPage > 0) {
          moveCurrentPageDayGroupToNextPage();
        }
        appendBlock(item, 'FRESH_PAGE_DEFER_TO_REBALANCE');
        hasRenderedContentOnCurrentPageForDay = true;
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

    const popTrailingKeepWithNextAnchors = (): PaginationBlock[] => {
      const carried: PaginationBlock[] = [];
      while (currentPageBlocks.length > 0 && currentPageBlocks[currentPageBlocks.length - 1].keepWithNext) {
        const popped = currentPageBlocks.pop()!;
        currentUsedHeight = Math.max(0, currentUsedHeight - popped.estimatedHeight);
        carried.unshift(popped);
      }
      return carried;
    };

    // Keep-with-next headings (Commercial Terms Banner, Destination Terms Header, Section Titles, Visa Section Header)
    if (block.keepWithNext && currentPageBlocks.length > 0) {
      const chainHeight = computeKeepWithNextChainHeight(blocks, i);
      if (chainHeight > getSafeRemainingHeight()) {
        const carried = popTrailingKeepWithNextAnchors();
        createNextPage();
        carried.forEach(c => appendBlock(c, 'CARRIED_KEEP_WITH_NEXT'));
      }
      appendBlock(block, 'FLOW_ANCHOR');
      i++;
      continue;
    }

    // Splittable non-Day service cards (e.g. Visa & Ancillary services) split progressively across pages
    if (block.splittable && block.serviceData) {
      let pendingService: PaginationBlock | null = block;
      let svcGuard = 0;
      while (pendingService && svcGuard++ < 40) {
        const rem = getSafeRemainingHeight();
        if (pendingService.estimatedHeight <= rem) {
          appendBlock(pendingService, 'FIT_ON_PAGE');
          pendingService = null;
          break;
        }
        const fitSplit = rem >= 75 ? splitServiceBlockToFitHeight(pendingService, undefined, rem) : null;
        if (fitSplit) {
          appendBlock(fitSplit.fitBlock, 'VISA_SPLIT_FIT');
          createNextPage();
          pendingService = fitSplit.remainderBlock;
          continue;
        }
        if (currentPageBlocks.length > 0) {
          const carried = popTrailingKeepWithNextAnchors();
          if (currentPageBlocks.length > 0) {
            createNextPage();
            carried.forEach(c => appendBlock(c, 'CARRIED_KEEP_WITH_NEXT'));
            continue;
          } else {
            // Current page had ONLY carried keepWithNext anchor(s); restore them and force split/defer to rebalance
            carried.forEach(c => appendBlock(c, 'RESTORED_ANCHOR'));
          }
        }
        appendBlock(pendingService, 'FRESH_PAGE_DEFER_TO_REBALANCE');
        pendingService = null;
      }
      i++;
      continue;
    }

    if (
      block.estimatedHeight > getSafeRemainingHeight() &&
      currentPageBlocks.length > 0
    ) {
      const carried = popTrailingKeepWithNextAnchors();
      if (currentPageBlocks.length > 0) {
        createNextPage();
      }
      carried.forEach(c => appendBlock(c, 'CARRIED_KEEP_WITH_NEXT'));
    }

    appendBlock(block, 'FLOW');
    i++;
  }

  // Push final page
  if (currentPageBlocks.length > 0) {
    rawPages.push({
      pageNumber: currentPageNum,
      blocks: currentPageBlocks,
      usedHeight: currentUsedHeight,
      bounds: currentBounds,
      rebalanceActions: []
    });
  }

  // Helper: safely push overflowed blocks onto rawPages[pIdx + 1] (or new page) while strictly
  // preserving Day header keep-together semantics and ensuring DAY_CONTINUATION_HEADER always sits at index 0.
  const pushOverflowBlocksToNextPage = (fromPageIdx: number, overflowBlocks: PaginationBlock[]): void => {
    if (overflowBlocks.length === 0) return;

    const firstOverflow = overflowBlocks[0];
    const hasNext = fromPageIdx + 1 < rawPages.length;

    let blocksToPrepend: PaginationBlock[] = overflowBlocks;

    if (firstOverflow.type === 'DAY_HEADER' && firstOverflow.dayNumber !== undefined) {
      const dayNum = firstOverflow.dayNumber;
      if (hasNext) {
        const nextBlocks = rawPages[fromPageIdx + 1].blocks;
        // Remove any redundant leading CONTINUE DAY X for the same day since DAY_HEADER now starts nextPage
        if (nextBlocks[0]?.type === 'DAY_CONTINUATION_HEADER' && nextBlocks[0]?.dayNumber === dayNum) {
          nextBlocks.shift();
        }
      }
      blocksToPrepend = overflowBlocks;
    } else if (firstOverflow.type === 'DAY_CONTINUATION_HEADER' && firstOverflow.dayNumber !== undefined) {
      const dayNum = firstOverflow.dayNumber;
      if (hasNext) {
        const nextBlocks = rawPages[fromPageIdx + 1].blocks;
        // Prevent duplicate consecutive continuation headers on nextPage
        if (nextBlocks[0]?.type === 'DAY_CONTINUATION_HEADER' && nextBlocks[0]?.dayNumber === dayNum) {
          nextBlocks.shift();
        }
      }
      blocksToPrepend = overflowBlocks;
    } else if (firstOverflow.dayNumber !== undefined) {
      const dayNum = firstOverflow.dayNumber;
      const nextPageFirst = hasNext ? rawPages[fromPageIdx + 1].blocks[0] : undefined;

      if (nextPageFirst?.type === 'DAY_CONTINUATION_HEADER' && nextPageFirst?.dayNumber === dayNum) {
        // Insert right AFTER existing DAY_CONTINUATION_HEADER at index 0 so index 0 invariant stays intact
        rawPages[fromPageIdx + 1].blocks.splice(1, 0, ...overflowBlocks);
        const nextH = measureBlocksCombinedHeightInDOM(rawPages[fromPageIdx + 1].blocks);
        if (nextH !== null) rawPages[fromPageIdx + 1].usedHeight = nextH;
        return;
      }

      const dayData = model.days.find(d => d.dayNumber === dayNum) || {
        dayId: firstOverflow.dayId || `day-${dayNum}`,
        dayNumber: dayNum,
        dateString: '',
        dayOfWeek: firstOverflow.dayMeta?.dayOfWeek || '',
        formattedDate: firstOverflow.dayMeta?.formattedDate || '',
        hubName: firstOverflow.dayMeta?.hubName || '',
        isTransitionDay: false,
        services: []
      };
      blocksToPrepend = [allocContinueDayHeaderBlock(dayData), ...overflowBlocks];
    }

    if (hasNext) {
      rawPages[fromPageIdx + 1].blocks.unshift(...blocksToPrepend);
      const nextH = measureBlocksCombinedHeightInDOM(rawPages[fromPageIdx + 1].blocks);
      if (nextH !== null) rawPages[fromPageIdx + 1].usedHeight = nextH;
    } else {
      const nextBounds = getPageContentBounds(rawPages.length + 1, boundsOverrides);
      rawPages.push({
        pageNumber: rawPages.length + 1,
        blocks: blocksToPrepend,
        usedHeight: measureBlocksCombinedHeightInDOM(blocksToPrepend) ?? blocksToPrepend.reduce((s, b) => s + b.estimatedHeight, 0),
        bounds: nextBounds,
        rebalanceActions: ['CREATED_BY_OVERFLOW']
      });
    }
  };

  // Universal Page-Bounds Rebalance & Overflow Enforcement Pass (Browser DOM + Node Fallback)
  {
    const hasDom = typeof document !== 'undefined' && Boolean(document.body);
    const measurePageHeight = (pageBlocks: PaginationBlock[]): number => {
      if (hasDom) {
        const measured = measureBlocksCombinedHeightInDOM(pageBlocks);
        if (measured !== null) return measured;
      }
      return pageBlocks.reduce((s, b) => s + b.estimatedHeight, 0);
    };

    const isHeaderAnchor = (b: PaginationBlock): boolean =>
      Boolean(
        b.keepWithNext ||
        b.type === 'DAY_HEADER' ||
        b.type === 'DAY_CONTINUATION_HEADER' ||
        b.type === 'DAY_OVERVIEW_BLOCK' ||
        b.type === 'VISA_SECTION_HEADER'
      );

    // Helper: extracts granular fragments from any generic or day-card HTML container as a fallback split
    const buildGenericSplitFragments = (block: PaginationBlock): {
      prefixWrap: string;
      suffixWrap: string;
      frags: TermFragment[];
      splitType: PaginationBlockType;
    } => {
      // Unwrap outer card border when splitting Day Overview / Day Notes / Itinerary Overview
      if (
        block.type === 'DAY_OVERVIEW_BLOCK' ||
        block.type === 'DAY_OVERVIEW_FRAGMENT' ||
        block.type === 'DAY_NOTES_BLOCK' ||
        block.type === 'DAY_NOTES_FRAGMENT' ||
        block.type === 'ITINERARY_OVERVIEW_BLOCK'
      ) {
        const richMatch = block.html.match(/<div class="theunbound-rich-text"[^>]*>([\s\S]*)<\/div>\s*<\/div>\s*$/i);
        const rawWithoutChrome = stripSyntheticPdfChromeLabels(block.html);
        const innerRaw = richMatch
          ? richMatch[1]
          : rawWithoutChrome.replace(/^\s*<div\b[^>]*>/i, '').replace(/<\/div>\s*$/i, '').trim();
        let frags = decomposeRichTermsHtmlIntoBlocks(innerRaw);
        if (frags.length <= 1) {
          const segs = extractOverviewSegments(innerRaw);
          if (segs.length > 1) {
            frags = segs.map(s => ({
              html: formatOverviewSegmentsHtml([s]),
              keepWithNext: false,
              estimatedHeight: estimateRichHtmlBlockHeight(s, 8)
            }));
          } else {
            const fine = finerSplitSingleSegment(segs[0] || innerRaw);
            if (fine.length > 1) {
              frags = fine.map(s => ({
                html: formatOverviewSegmentsHtml([s]),
                keepWithNext: false,
                estimatedHeight: estimateRichHtmlBlockHeight(s, 8)
              }));
            }
          }
        }
        const dayIdAttr = block.dayId ? ` data-day-id="${block.dayId}"` : '';
        const dayLabel = block.dayNumber !== undefined ? `Day ${block.dayNumber} Overview (Continued)` : 'Journey Overview';
        const isNote = block.type === 'DAY_NOTES_BLOCK' || block.type === 'DAY_NOTES_FRAGMENT';
        return {
          prefixWrap: isNote
            ? `<div${dayIdAttr} style="padding: 8px 14px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; margin-bottom: 8px; font-size: 10px; color: #78350f; line-height: 1.4; word-break: break-word;"><strong data-pdf-synthetic-label="true">Day ${block.dayNumber ?? ''} Operational Notes (Continued): </strong><div class="theunbound-rich-text">`
            : `<div${dayIdAttr} style="padding: 8px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 8px; font-size: 10.5px; color: #334155; line-height: 1.45; word-break: break-word;"><span data-pdf-synthetic-label="true" style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #0d9488; display: block; margin-bottom: 2px;">${dayLabel}</span><div class="theunbound-rich-text">`,
          suffixWrap: '</div></div>',
          frags,
          splitType:
            block.type === 'DAY_OVERVIEW_BLOCK' || block.type === 'DAY_OVERVIEW_FRAGMENT'
              ? 'DAY_OVERVIEW_FRAGMENT'
              : (block.type === 'DAY_NOTES_BLOCK' || block.type === 'DAY_NOTES_FRAGMENT'
                ? 'DAY_NOTES_FRAGMENT'
                : block.type)
        };
      }

      let frags = decomposeRichTermsHtmlIntoBlocks(block.html);
      if (frags.length <= 1) {
        const fine = finerSplitSingleSegment(block.html);
        if (fine.length > 1) {
          frags = fine.map(s => ({
            html: s,
            keepWithNext: false,
            estimatedHeight: estimateHtmlUnitHeight(s)
          }));
        }
      }
      return {
        prefixWrap: '<div style="word-break: break-word;">',
        suffixWrap: '</div>',
        frags,
        splitType: block.type
      };
    };

    let pIdx = 0;
    let rebalanceIter = 0;
    const MAX_REBALANCE_ITERS = Math.max(1200, rawPages.length * 40);

    while (pIdx < rawPages.length) {
      if (++rebalanceIter > MAX_REBALANCE_ITERS) {
        console.warn('[PDF-PAGINATION] Page overflow rebalance iteration cap reached; finalizing current page layout.');
        break;
      }
      const rp = rawPages[pIdx];
      const maxAllowed = rp.bounds.availableContentHeight;
      const realH = measurePageHeight(rp.blocks);
      rp.usedHeight = realH;

      if (realH > maxAllowed && rp.blocks.length >= 1) {
        if (rp.blocks.length > 1) {
          // Compute trailing popCount including any preceding header anchors all the way back to index 0
          // so a DAY_HEADER / DAY_CONTINUATION_HEADER / keepWithNext block is NEVER left orphaned on rp.
          let popCount = 1;
          while (rp.blocks.length - popCount >= 1) {
            const newLast = rp.blocks[rp.blocks.length - 1 - popCount];
            if (!newLast || isHeaderAnchor(newLast)) {
              popCount++;
            } else {
              break;
            }
          }

          if (popCount < rp.blocks.length) {
            const overflowBlocks = rp.blocks.splice(rp.blocks.length - popCount);
            rp.usedHeight = measurePageHeight(rp.blocks);
            rp.rebalanceActions.push(`POP_${popCount}_BLOCKS_FROM_${Math.round(realH)}PX`);
            pushOverflowBlocksToNextPage(pIdx, overflowBlocks);
            continue;
          }

          // If popCount hit index 0 solely because an intermediate DAY_OVERVIEW_BLOCK carried keepWithNext=true,
          // convert that DAY_OVERVIEW_BLOCK into a valid DAY_OVERVIEW_FRAGMENT so trailing blocks can pop cleanly!
          const overviewAnchorIdx = rp.blocks.findIndex(
            (b, bIdx) => bIdx > 0 && bIdx < rp.blocks.length - 1 && b.type === 'DAY_OVERVIEW_BLOCK'
          );
          if (overviewAnchorIdx !== -1) {
            const ovBlock = rp.blocks[overviewAnchorIdx];
            ovBlock.type = 'DAY_OVERVIEW_FRAGMENT';
            ovBlock.keepWithNext = false;
            ovBlock.breakDecision = 'CONVERTED_OVERVIEW_TO_FRAGMENT_FOR_SPLIT';
            rp.rebalanceActions.push(`RELEASE_DAY_OVERVIEW_ANCHOR_${ovBlock.id}`);
            continue;
          }
        }

        // Either rp has ONLY 1 block, or ONLY [headerAnchor(s)..., lastBlock].
        // Split lastBlock in-place so headerAnchor(s) stay attached to a valid fitting slice!
        const lastBlock = rp.blocks[rp.blocks.length - 1];
        if (lastBlock && lastBlock.serviceData) {
          const leadingBlocks = rp.blocks.slice(0, -1);
          const leadingH = leadingBlocks.length > 0 ? measurePageHeight(leadingBlocks) : 0;
          let targetSliceH = Math.max(60, maxAllowed - leadingH - 6);
          const dayData = lastBlock.dayNumber !== undefined
            ? (model.days.find(d => d.dayNumber === lastBlock.dayNumber) || {
                dayId: lastBlock.dayId || `day-${lastBlock.dayNumber}`,
                dayNumber: lastBlock.dayNumber,
                dateString: '',
                dayOfWeek: lastBlock.dayMeta?.dayOfWeek || '',
                formattedDate: lastBlock.dayMeta?.formattedDate || '',
                hubName: lastBlock.dayMeta?.hubName || '',
                isTransitionDay: false,
                prevHubName: lastBlock.dayMeta?.prevHubName,
                customTheme: lastBlock.dayMeta?.customTheme,
                services: []
              })
            : undefined;

          let splitApplied = false;
          for (let attempt = 0; attempt < 8 && targetSliceH >= 55; attempt++) {
            const inPlaceSplit = splitServiceBlockToFitHeight(lastBlock, dayData, targetSliceH);
            if (!inPlaceSplit) break;
            const candidatePageBlocks = [...leadingBlocks, inPlaceSplit.fitBlock];
            const candidateH = measurePageHeight(candidatePageBlocks);
            if (candidateH <= maxAllowed) {
              rp.blocks[rp.blocks.length - 1] = inPlaceSplit.fitBlock;
              rp.usedHeight = candidateH;
              rp.rebalanceActions.push(`SPLIT_SERVICE_IN_PLACE_ATTEMPT_${attempt + 1}`);
              pushOverflowBlocksToNextPage(pIdx, [inPlaceSplit.remainderBlock]);
              splitApplied = true;
              break;
            }
            const combinedDelta = Math.max(18, candidateH - maxAllowed + 8);
            const nextTarget = Math.min(targetSliceH - 18, inPlaceSplit.fitBlock.estimatedHeight - combinedDelta);
            if (nextTarget >= targetSliceH) break;
            targetSliceH = nextTarget;
          }
          if (splitApplied) {
            continue;
          }
        }

        // Generic HTML-fragment fallback split for ANY oversized block (Overview, Notes, Terms, Policies, Tables, Lists, Images)
        if (
          lastBlock &&
          !lastBlock.keepWithNext &&
          lastBlock.type !== 'DAY_HEADER' &&
          lastBlock.type !== 'DAY_CONTINUATION_HEADER' &&
          lastBlock.type !== 'VISA_SECTION_HEADER'
        ) {
          const leadingBlocks = rp.blocks.slice(0, -1);
          const leadingH = leadingBlocks.length > 0 ? measurePageHeight(leadingBlocks) : 0;
          const remainingBudget = maxAllowed - leadingH - 6;
          const { prefixWrap, suffixWrap, frags, splitType } = buildGenericSplitFragments(lastBlock);

          if (frags.length > 1 && remainingBudget >= 55) {
            let takeCount = 0;
            let bestCandidate: PaginationBlock | null = null;
            for (let k = frags.length - 1; k >= 1; k--) {
              const firstHtml = `${prefixWrap}${frags.slice(0, k).map(f => f.html).join('')}${suffixWrap}`;
              const candBlock: PaginationBlock = {
                ...lastBlock,
                type: splitType,
                id: `${lastBlock.id}-part1-${++pdfSplitInstanceCounter}`,
                html: firstHtml,
                estimatedHeight: measureSingleBlockHtmlHeight(firstHtml, frags.slice(0, k).reduce((s, f) => s + f.estimatedHeight, 0) + 16),
                splittable: false,
                minMeaningfulHeight: 55,
                breakDecision: 'REBALANCE_FRAGMENT_SPLIT_PART1'
              };
              const candH = measurePageHeight([...leadingBlocks, candBlock]);
              if (candH <= maxAllowed) {
                takeCount = k;
                bestCandidate = candBlock;
                break;
              }
            }
            if (bestCandidate && takeCount >= 1 && takeCount < frags.length) {
              const remHtml = `${prefixWrap}${frags.slice(takeCount).map(f => f.html).join('')}${suffixWrap}`;
              const remBlock: PaginationBlock = {
                ...lastBlock,
                type: splitType,
                id: `${lastBlock.id}-part2-${++pdfSplitInstanceCounter}`,
                html: remHtml,
                estimatedHeight: measureSingleBlockHtmlHeight(remHtml, frags.slice(takeCount).reduce((s, f) => s + f.estimatedHeight, 0) + 16),
                splittable: frags.length - takeCount > 1,
                minMeaningfulHeight: 55,
                breakDecision: 'REBALANCE_FRAGMENT_SPLIT_PART2'
              };
              rp.blocks[rp.blocks.length - 1] = bestCandidate;
              rp.usedHeight = measurePageHeight(rp.blocks);
              rp.rebalanceActions.push(`GENERIC_SPLIT_${takeCount}_OF_${frags.length}`);
              pushOverflowBlocksToNextPage(pIdx, [remBlock]);
              continue;
            }
          }

          // Defensive image-height clamp if an embedded image inside a single unsplittable block still bursts bounds
          if (/<img\b/i.test(lastBlock.html) && !lastBlock.id.includes('-imgclamped') && remainingBudget >= 140) {
            const safeImgH = Math.max(120, Math.floor(remainingBudget - 95));
            const clampedHtml = lastBlock.html.replace(
              /max-height:\s*\d+px;?/gi,
              `max-height: ${safeImgH}px;`
            );
            if (clampedHtml !== lastBlock.html) {
              lastBlock.id = `${lastBlock.id}-imgclamped`;
              lastBlock.html = clampedHtml;
              lastBlock.estimatedHeight = measureSingleBlockHtmlHeight(clampedHtml, Math.min(lastBlock.estimatedHeight, remainingBudget));
              rp.rebalanceActions.push(`CLAMP_IMAGE_HEIGHT_${safeImgH}PX`);
              continue;
            }
          }
        }
      }
      pIdx++;
    }
  }

  // Normalize pages after rebalancing (strip empty pages, continuation-only shells, or duplicate continuation headers)
  for (let idx = rawPages.length - 1; idx >= 0; idx--) {
    const pageBlocks = rawPages[idx].blocks;
    if (pageBlocks.length === 0) {
      rawPages.splice(idx, 1);
      continue;
    }
    // Remove accidental duplicate consecutive DAY_CONTINUATION_HEADERs for the same day
    for (let bi = pageBlocks.length - 1; bi >= 1; bi--) {
      if (
        pageBlocks[bi].type === 'DAY_CONTINUATION_HEADER' &&
        pageBlocks[bi - 1].type === 'DAY_CONTINUATION_HEADER' &&
        pageBlocks[bi].dayNumber === pageBlocks[bi - 1].dayNumber
      ) {
        pageBlocks.splice(bi, 1);
      }
    }
    // Strip orphaned standalone DAY_CONTINUATION_HEADER page with no following day content
    if (
      pageBlocks.length === 1 &&
      pageBlocks[0].type === 'DAY_CONTINUATION_HEADER'
    ) {
      rawPages.splice(idx, 1);
    }
  }

  // Renumber sequentially and compute final authoritative body heights + full block-level diagnostics
  const totalPages = rawPages.length;
  const renderedPages: RenderedPage[] = rawPages.map((rp, idx) => {
    const pageNumber = idx + 1;
    const bounds = getPageContentBounds(pageNumber, boundsOverrides);
    const headerHtml = buildPageHeaderHtml(model, pageNumber);
    const footerHtml = buildPageFooterHtml(model, pageNumber, totalPages);
    const hasDom = typeof document !== 'undefined' && Boolean(document.body);
    const finalUsedHeight =
      (hasDom ? measureBlocksCombinedHeightInDOM(rp.blocks) : null) ??
      rp.blocks.reduce((s, b) => s + b.estimatedHeight, 0);

    let cursorY = bounds.contentTop;
    const blockDiagnostics: BlockLayoutDiagnostic[] = rp.blocks.map((b, bIdx) => {
      const h = (hasDom ? measureBlocksCombinedHeightInDOM([b]) : null) ?? b.estimatedHeight;
      const startY = cursorY;
      const endY = startY + h;
      cursorY = endY;
      return {
        id: b.id,
        type: b.type,
        height: h,
        startY,
        endY,
        dayNumber: b.dayNumber,
        splitRole: b.isSplitPart,
        splitRef: b.splitRef,
        breakDecision: b.breakDecision || (bIdx === 0 && pageNumber > 1 ? 'PAGE_START' : 'FLOW')
      };
    });

    const footerStartY = bounds.height - bounds.bottomMargin - bounds.footerHeight;
    const diagnostics: PageLayoutDiagnostics = {
      pageNumber,
      pageHeight: bounds.height,
      topMargin: bounds.topMargin,
      bottomMargin: bounds.bottomMargin,
      headerHeight: bounds.headerHeight,
      headerGap: bounds.headerGap,
      bodyStartY: bounds.contentTop,
      bodyEndY: bounds.contentTop + finalUsedHeight,
      footerStartY,
      footerHeight: bounds.footerHeight,
      footerGap: bounds.footerGap,
      availableContentHeight: bounds.availableContentHeight,
      actualBodyHeight: finalUsedHeight,
      overflowPx: Math.max(0, finalUsedHeight - bounds.availableContentHeight),
      rebalanceActions: rp.rebalanceActions,
      blocks: blockDiagnostics
    };

    return {
      pageNumber,
      totalPages,
      headerHtml,
      footerHtml,
      blocks: rp.blocks,
      usedContentHeight: finalUsedHeight,
      availableContentHeight: bounds.availableContentHeight,
      bounds,
      diagnostics
    };
  });

  // Execute fail-safe Day & Content Completeness Validation
  const completenessValidation = validatePaginatedQuoteCompleteness(model, renderedPages);
  if (!completenessValidation.valid) {
    console.error(
      '[PDF-PAGINATION-DIAGNOSTICS] Completeness validation failed:',
      completenessValidation.errors
    );
    throw new Error(
      `PDF Pagination Completeness Validation Failed: ${completenessValidation.errors.join(' | ')}`
    );
  }

  const layoutValidation = validatePdfLayoutBounds(renderedPages);
  if (!layoutValidation.valid) {
    console.error(
      '[PDF-PAGINATION-DIAGNOSTICS] Layout bounds validation failed:',
      renderedPages
        .filter(p => (p.diagnostics?.overflowPx ?? 0) > 0)
        .map(p => p.diagnostics)
    );
    throw new Error(
      `PDF Layout Bounds Validation Failed: ${layoutValidation.errors.join(' | ')}`
    );
  }

  return renderedPages;
}
