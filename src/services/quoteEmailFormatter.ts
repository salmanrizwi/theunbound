/**
 * THEUNBOUND — B2B QUOTE BUILDER
 * Dedicated Email Formatting Layer with Two Distinct Modes:
 * 
 * Mode 1 (Option 1): Rich HTML Quotation Preview
 * - Faithfully reproduces Proposal View's visual identity, typography, cards, dark headers, and #00E5C0/#00C6A6 accents
 * - Fully responsive, fluid container (max-width: 680px, width: 100%) adapted for email clients
 * - Confidential pricing: strictly single consolidated final package total
 * - Renders all stored descriptions, overviews, and notes as proper email-safe styled HTML (zero literal <p>, <br/> tags)
 * 
 * Mode 2 (Option 2): Complete Plain-Text Quotation
 * - Simple, clean, properly formatted email without a designed layout
 * - No colored backgrounds, no decorative banners, no cards, no complex tables, no marketing graphics, no badges
 * - Minimal semantic HTML using standard <p>, <strong>, <b>, <h1>, <h2>, <h3>, <ul>, <ol>, <li>
 * - Robust handling and conversion of markup: <br>, <br/>, </br>, <p>, <div>, <strong>, <b>, <ul>, <ol>, <li>, <table>, entities, and Markdown **
 * - Zero literal HTML tags displayed in the email
 */

import { QuotePresentationModel, ServicePresentationItem, HotelPresentationItem } from './quotePresentationModel';
import { THEUNBOUND_REGISTERED_ADDRESS, THEUNBOUND_CURRENT_ADDRESS } from './db';
import { formatCurrency } from './pricingEngine';

/**
 * Safely decodes common HTML entities
 */
export function decodeHtmlEntities(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

/**
 * Escapes HTML characters safely while preserving readable text
 */
export function escapeHtml(str: string): string {
  if (!str || typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Normalizes stored quotation content before conversion:
 * 1. Unescapes encoded HTML tags (e.g. &lt;p&gt; -> <p>, &lt;br/&gt; -> <br/>)
 * 2. Normalizes malformed legacy tags (</br> -> <br/>, <br > -> <br/>)
 * 3. Decodes non-breaking spaces and common entities
 * 4. Normalizes carriage returns and consecutive line breaks
 */
export function normalizeStoredContent(content: string): string {
  if (!content || typeof content !== 'string') return '';
  let res = content.trim();
  if (!res) return '';

  // Decode escaped HTML tags (e.g. &lt;p&gt; -> <p>, &lt;br/&gt; -> <br/>, &lt;h2&gt; -> <h2>)
  res = res.replace(/&lt;(\/?(?:p|br|div|h[1-6]|strong|b|em|i|ul|ol|li|table|tr|td|th|tbody|thead|span|a|hr)(?:\s+[^&>]*)?\/?)\s*&gt;/gi, '<$1>');

  // Fix legacy malformed tags: </br> -> <br/>
  res = res.replace(/<\s*\/\s*br\s*>/gi, '<br/>');
  res = res.replace(/<br\s*\/?>/gi, '<br/>');

  // Decode non-breaking spaces
  res = res.replace(/&nbsp;/gi, ' ');

  // Normalize Windows newlines
  res = res.replace(/\r\n/g, '\n');

  // Collapse 3 or more consecutive <br/> tags to 2
  res = res.replace(/(?:<br\s*\/?>\s*){3,}/gi, '<br/><br/>');

  return res;
}

/**
 * Normalizes inline formatting markers for legacy compatibility
 */
export function normalizeFormattingMarkers(text: string): string {
  return normalizeStoredContent(text);
}

/**
 * Converts rich text / HTML into clean, human-readable plain text without any HTML tags.
 * Preserves paragraph breaks, list markers, and section titles.
 * Used for MIME text/plain multipart alternatives, WhatsApp, and the plain-text editing textarea.
 */
export function convertHtmlToCleanPlainText(htmlOrText: string): string {
  if (!htmlOrText || typeof htmlOrText !== 'string') return '';
  let text = normalizeStoredContent(htmlOrText);

  // Convert headings to clear uppercase headings with newlines
  text = text.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, '\n\n$1\n');

  // Convert table rows to formatted lines
  text = text.replace(/<tr[^>]*>(.*?)<\/tr>/gi, '$1\n');
  text = text.replace(/<t[dh][^>]*>(.*?)<\/t[dh]>/gi, '$1 | ');

  // Convert block boundaries
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<\/div>/gi, '\n');

  // Convert line breaks
  text = text.replace(/<br\s*\/?>/gi, '\n');

  // Convert list items to bullet points
  text = text.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n• $1');
  text = text.replace(/<\/[uo]l>/gi, '\n');

  // Convert bold tags to Markdown **
  text = text.replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**');

  // Convert italic tags to Markdown *
  text = text.replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '*$1*');

  // Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  text = decodeHtmlEntities(text);

  // Clean trailing pipes from table conversions
  text = text.replace(/\s+\|\s*$/gm, '');

  // Normalize whitespace and newlines
  text = text.replace(/[ \t]+/g, ' ');
  text = text.replace(/\n{3,}/g, '\n\n');

  return text.trim();
}

/**
 * Renders inline formatted text safely:
 * Converts Markdown **bold** to <strong>, *italic* to <em>,
 * decodes entities, and escapes plain text safely.
 */
export function cleanInlineFormattedText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let normalized = normalizeStoredContent(text);

  // If text has <strong> or <b> tags, normalize them to Markdown **
  normalized = normalized.replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**');
  normalized = normalized.replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '*$1*');
  normalized = normalized.replace(/<br\s*\/?>/gi, ' ');
  normalized = normalized.replace(/<[^>]+>/g, '');

  // Decode entities first to avoid double-escaping
  normalized = decodeHtmlEntities(normalized);

  // Escape HTML characters
  let safe = escapeHtml(normalized);

  // Convert Markdown **bold**
  safe = safe.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Convert Markdown *italic*
  safe = safe.replace(/(^|[^*])\*([^*]+)\*([^*]|$)/g, '$1<em>$2</em>$3');

  return safe;
}

/**
 * Converts rich-text content (or mixed Markdown/HTML) into email-safe styled HTML elements.
 * Critical: Never displays literal <p>, <br/>, </br>, <div> tags.
 * Applies email client inline styles for consistent typography and spacing.
 */
export function renderRichTextForEmail(
  content: string,
  options?: {
    fontSize?: string;
    lineHeight?: string;
    color?: string;
    darkHeadingColor?: string;
  }
): string {
  if (!content || typeof content !== 'string') return '';
  const normalized = normalizeStoredContent(content);
  if (!normalized) return '';

  const fontSize = options?.fontSize || '12px';
  const lineHeight = options?.lineHeight || '1.55';
  const color = options?.color || '#334155';
  const darkHeadingColor = options?.darkHeadingColor || '#0f172a';

  const hasHtml = /<\/?(?:p|br|div|h[1-6]|strong|b|em|i|ul|ol|li|table|tr|td|th|span|a)\b/i.test(normalized);

  if (!hasHtml) {
    // Pure plain text or Markdown
    const paragraphs = normalized.split(/\n\s*\n/);
    const pElements = paragraphs.map(p => {
      const trimmed = p.trim();
      if (!trimmed) return '';
      // Check for bullet list
      const lines = trimmed.split('\n');
      const isList = lines.every(l => /^[-*•]\s+/.test(l.trim()));
      if (isList) {
        const items = lines.map(l => l.replace(/^[-*•]\s+/, '').trim()).filter(Boolean);
        return `
          <ul style="margin: 4px 0 8px 0; padding-left: 18px; list-style-type: disc; color: ${color};">
            ${items.map(it => `<li style="margin-bottom: 3px; font-size: ${fontSize}; line-height: ${lineHeight};">${cleanInlineFormattedText(it)}</li>`).join('')}
          </ul>
        `;
      }
      const withLineBreaks = lines.map(l => cleanInlineFormattedText(l.trim())).join('<br/>');
      return `<p style="margin: 0 0 8px 0; font-size: ${fontSize}; line-height: ${lineHeight}; color: ${color};">${withLineBreaks}</p>`;
    }).filter(Boolean);

    return pElements.join('');
  }

  // Content has HTML tags: sanitize and convert to email-safe styled HTML
  let safeHtml = normalized;

  // 1. Remove dangerous elements
  safeHtml = safeHtml.replace(/<(?:script|style|iframe|object|embed|form|input|button|svg|canvas)\b[^<]*(?:(?!<\/(?:script|style|iframe|object|embed|form|input|button|svg|canvas)>)<[^<]*)*<\/(?:script|style|iframe|object|embed|form|input|button|svg|canvas)>/gi, '');
  safeHtml = safeHtml.replace(/<(?:script|style|iframe|object|embed|form|input|button|svg|canvas)\b[^>]*\/?>/gi, '');

  // 2. Strip event handlers and invalid protocols
  safeHtml = safeHtml.replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '');
  safeHtml = safeHtml.replace(/javascript:[^"']*/gi, '#');

  // 3. Transform headings to email-styled headings
  safeHtml = safeHtml.replace(/<h[1-6][^>]*>(.*?)<\/h[1-6]>/gi, `<h4 style="margin: 10px 0 4px 0; font-size: 13px; font-weight: 800; color: ${darkHeadingColor};">$1</h4>`);

  // 4. Transform paragraph tags with inline styles
  safeHtml = safeHtml.replace(/<p[^>]*>/gi, `<p style="margin: 0 0 8px 0; font-size: ${fontSize}; line-height: ${lineHeight}; color: ${color};">`);

  // 5. Transform bold and strong
  safeHtml = safeHtml.replace(/<(?:strong|b)[^>]*>/gi, `<strong style="font-weight: 700; color: ${darkHeadingColor};">`);
  safeHtml = safeHtml.replace(/<\/(?:strong|b)>/gi, `</strong>`);

  // 6. Transform italic and emphasis
  safeHtml = safeHtml.replace(/<(?:em|i)[^>]*>/gi, `<em>`);
  safeHtml = safeHtml.replace(/<\/(?:em|i)>/gi, `</em>`);

  // 7. Transform lists
  safeHtml = safeHtml.replace(/<ul[^>]*>/gi, `<ul style="margin: 4px 0 8px 0; padding-left: 18px; list-style-type: disc; color: ${color};">`);
  safeHtml = safeHtml.replace(/<ol[^>]*>/gi, `<ol style="margin: 4px 0 8px 0; padding-left: 18px; color: ${color};">`);
  safeHtml = safeHtml.replace(/<li[^>]*>/gi, `<li style="margin-bottom: 3px; font-size: ${fontSize}; line-height: ${lineHeight}; color: ${color};">`);

  // 8. Transform tables
  safeHtml = safeHtml.replace(/<table[^>]*>/gi, `<table style="width: 100%; border-collapse: collapse; margin: 8px 0; font-size: ${fontSize};">`);
  safeHtml = safeHtml.replace(/<th[^>]*>/gi, `<th style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: ${fontSize}; font-weight: 700; color: ${darkHeadingColor}; background: #f8fafc; text-align: left;">`);
  safeHtml = safeHtml.replace(/<td[^>]*>/gi, `<td style="padding: 6px 8px; border: 1px solid #e2e8f0; font-size: ${fontSize}; color: ${color};">`);

  // 9. Transform links
  safeHtml = safeHtml.replace(/<a\s+[^>]*href=["']([^"']*)["'][^>]*>/gi, `<a href="$1" style="color: #008972; text-decoration: underline;" target="_blank" rel="noopener noreferrer">`);

  // 10. Transform divs
  safeHtml = safeHtml.replace(/<div[^>]*>/gi, `<div style="margin: 4px 0;">`);

  // 11. Normalize remaining line-breaks
  safeHtml = safeHtml.replace(/<br\s*\/?>/gi, '<br/>');

  // 12. Strip any unknown remaining tags
  safeHtml = safeHtml.replace(/<\/?(?:span|section|article|header|footer|aside|nav)[^>]*>/gi, '');

  // 13. Convert Markdown **bold** inside text nodes
  safeHtml = safeHtml.replace(/\*\*([^*<]+)\*\*/g, `<strong style="font-weight: 700; color: ${darkHeadingColor};">$1</strong>`);

  // 14. Clean empty paragraphs
  safeHtml = safeHtml.replace(/<p[^>]*>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '');

  return safeHtml.trim();
}

// ============================================================================
// OPTION 1: RICH HTML QUOTATION PREVIEW (FOLLOWS PROPOSAL VIEW EXACTLY)
// ============================================================================

const PROPOSAL_STYLES = {
  fontFamily: `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`,
  tealAccent: `#00E5C0`,
  tealBrand: `#00C6A6`,
  tealDark: `#008972`,
  tealLight: `#e6fcf8`,
  darkSlate: `#020617`,
  headerSlate: `#0f172a`,
  textDark: `#0f172a`,
  textBody: `#334155`,
  textMuted: `#64748b`,
  bgCard: `#f8fafc`,
  borderColor: `#e2e8f0`,
  borderAmber: `#fef08a`,
  bgAmber: `#fffdf5`,
  borderEmerald: `#bbf7d0`,
  bgEmerald: `#f0fdf4`,
  borderIndigo: `#c7d2fe`,
  bgIndigo: `#eef2ff`
};

export function renderBulletListHtml(items: string[], type: 'INCLUSION' | 'EXCLUSION' | 'STANDARD' = 'STANDARD'): string {
  if (!items || items.length === 0) return '';
  let bulletColor = PROPOSAL_STYLES.tealDark;
  if (type === 'EXCLUSION') bulletColor = `#e11d48`;
  else if (type === 'STANDARD') bulletColor = `#475569`;

  return `
    <ul style="margin: 4px 0 10px 0; padding-left: 18px; list-style-type: disc; color: ${bulletColor};">
      ${items.map(item => `
        <li style="margin-bottom: 4px; font-size: 12px; line-height: 1.5; color: ${PROPOSAL_STYLES.textBody};">
          <span style="color: ${PROPOSAL_STYLES.textDark}; font-weight: 500;">${cleanInlineFormattedText(item)}</span>
        </li>
      `).join('')}
    </ul>
  `;
}

/**
 * Builds the canonical rich HTML quotation email following Proposal View's visual hierarchy,
 * adapted for responsive fluid rendering across desktop, tablet, and mobile email clients.
 * Formats all descriptions, overviews, and itinerary details as email-safe styled HTML.
 * Strictly guarantees confidentiality: only final consolidated total package price.
 */
/**
 * ============================================================================
 * OPTION 1 — RICH HTML QUOTATION PREVIEW (EXACT PDF FIDELITY)
 * ============================================================================
 * 
 * Translates the authoritative generated quotation PDF presentation into
 * email-safe responsive HTML that reproduces the PDF with exact visual fidelity:
 * - Exact PDF header, typography, agency branding, status & quote number
 * - Exact Curated Journey Overview Banner, destination title, pax details, route hubs
 * - Exact Client & Specialist Dossier
 * - Exact Day headers with teal day badge, transfer indicator & hub base
 * - Exact Activity / Service cards with category badges, duration, listing name,
 *   bullet train box, operational points, overview, inclusions, exclusions, and confirmed badge
 * - Exact Operational Standards (4 cards)
 * - Exact Total Package Investment (dark container, consolidated price only)
 * - Exact Child & Attraction Policies
 * - Exact Commercial Terms and Running Document Footer
 * 
 * Description formatting rules:
 * - Preserves original paragraph structure, line breaks, bulleted/numbered lists, bold text.
 * - Decodes escaped HTML entities (&lt;p&gt;, &lt;br/&gt;) so zero literal tags appear.
 * - Zero item-level pricing exposed (strictly consolidated total package price).
 */
export function formatPdfOrEmailDescription(rawText: string): string {
  if (!rawText || typeof rawText !== 'string') return '';
  const trimmed = rawText.trim();
  if (!trimmed) return '';

  // 1. Unescape escaped HTML tags (e.g., &lt;p&gt; -> <p>, &lt;br/&gt; -> <br/>, &lt;strong&gt; -> <strong>, &lt;ul&gt; -> <ul>, &lt;li&gt; -> <li>)
  let unescaped = trimmed.replace(/&lt;(\/?[a-z0-9]+[^&gt;]*)&gt;/gi, '<$1>');
  unescaped = unescaped.replace(/&amp;lt;(\/?[a-z0-9]+[^&gt;]*)&amp;gt;/gi, '<$1>');

  // Normalize all variations of break tags to standard <br/>
  unescaped = unescaped.replace(/<br\s*\/?>/gi, '<br/>').replace(/<\/br>/gi, '<br/>');

  // Decode non-breaking spaces and basic safe entities
  unescaped = unescaped.replace(/&amp;nbsp;/gi, '&nbsp;').replace(/&amp;amp;/gi, '&amp;');

  // If the content now contains HTML markup
  if (/<[a-z][\s\S]*>/i.test(unescaped)) {
    let clean = unescaped
      // Clean up empty paragraphs
      .replace(/<p>\s*(?:<br\s*\/?>)?\s*<\/p>/gi, '')
      // Ensure <p> tags have clean spacing matching the PDF
      .replace(/<p>/gi, '<p style="margin: 0 0 6px 0; line-height: 1.45;">')
      .replace(/<ul>/gi, '<ul style="margin: 4px 0 6px 0; padding-left: 18px; line-height: 1.45;">')
      .replace(/<ol>/gi, '<ol style="margin: 4px 0 6px 0; padding-left: 18px; line-height: 1.45;">')
      .replace(/<li>/gi, '<li style="margin-bottom: 2px;">');

    // Strip any dangerous script/iframe tags
    clean = clean.replace(/<(script|iframe|object|embed)[^>]*>[\s\S]*?<\/\1>/gi, '');

    // Final check: decode any lone &lt;p&gt; or &lt;br/&gt; that might still remain
    clean = clean
      .replace(/&lt;br\s*\/?&gt;/gi, '<br/>')
      .replace(/&lt;\/?p&gt;/gi, '')
      .replace(/&lt;\/?div&gt;/gi, '')
      .replace(/&lt;\/?strong&gt;/gi, '')
      .replace(/&lt;\/?b&gt;/gi, '')
      .replace(/&lt;\/?em&gt;/gi, '')
      .replace(/&lt;\/?i&gt;/gi, '')
      .replace(/&lt;\/?ul&gt;/gi, '')
      .replace(/&lt;\/?ol&gt;/gi, '')
      .replace(/&lt;\/?li&gt;/gi, '');

    return clean;
  }

  // Otherwise, it's plain text or markdown: convert to clean semantic HTML
  const lines = unescaped.split(/\r?\n/);
  const blocks: string[] = [];
  let currentParagraph: string[] = [];
  let currentList: string[] = [];

  const flushP = () => {
    if (currentParagraph.length > 0) {
      const text = currentParagraph.join('<br/>').trim();
      if (text) {
        const formatted = text
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        blocks.push(`<p style="margin: 0 0 6px 0; line-height: 1.45;">${formatted}</p>`);
      }
      currentParagraph = [];
    }
  };

  const flushL = () => {
    if (currentList.length > 0) {
      const items = currentList.map(li => {
        const formatted = li
          .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
          .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>');
        return `<li style="margin-bottom: 2px;">${formatted}</li>`;
      }).join('');
      blocks.push(`<ul style="margin: 4px 0 6px 0; padding-left: 18px; line-height: 1.45;">${items}</ul>`);
      currentList = [];
    }
  };

  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) {
      flushP();
      flushL();
      continue;
    }
    const bulletMatch = trimmedLine.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      flushP();
      currentList.push(bulletMatch[1]);
      continue;
    }
    flushL();
    currentParagraph.push(trimmedLine);
  }
  flushP();
  flushL();

  return blocks.length > 0 ? blocks.join('') : `<p style="margin: 0 0 6px 0; line-height: 1.45;">${unescaped}</p>`;
}

export function renderProposalViewHtmlEmail(
  model: QuotePresentationModel,
  customNote?: string
): string {
  // Service card renderer that mirrors buildDayServiceCardBlock from pdfPaginationEngine.ts
  const renderDayServiceCard = (s: ServicePresentationItem) => {
    const operationalPointsHtml = (s.meetingPoint || s.pickupPoint || s.dropoffPoint) ? `
      <div style="display: flex; flex-wrap: wrap; gap: 6px; margin: 5px 0; font-size: 9.5px; color: #334155;">
        ${s.meetingPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block; margin-right: 4px; margin-bottom: 4px;"><strong>Meeting Point:</strong> ${cleanInlineFormattedText(s.meetingPoint)}</span>` : ''}
        ${s.pickupPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block; margin-right: 4px; margin-bottom: 4px;"><strong>Pickup:</strong> ${cleanInlineFormattedText(s.pickupPoint)}</span>` : ''}
        ${s.dropoffPoint ? `<span style="background: #ffffff; padding: 2px 6px; border-radius: 4px; border: 1px solid #cbd5e1; display: inline-block; margin-right: 4px; margin-bottom: 4px;"><strong>Drop-off:</strong> ${cleanInlineFormattedText(s.dropoffPoint)}</span>` : ''}
      </div>
    ` : '';

    const railBoxHtml = (s.isRail && s.railDetails) ? `
      <div style="margin: 6px 0; padding: 8px 10px; border-radius: 8px; background: #eef2ff; border: 1px solid #c7d2fe; font-size: 10.5px; color: #312e81;">
        <div style="font-weight: 700; margin-bottom: 2px;">
          🚄 Bullet Train: ${cleanInlineFormattedText(s.railDetails.origin)} → ${cleanInlineFormattedText(s.railDetails.destination)} • ${cleanInlineFormattedText(s.railDetails.carType)} (${cleanInlineFormattedText(s.railDetails.seatType)})
        </div>
        <div style="font-size: 9.5px; color: #4338ca;">
          ${s.railDetails.seatPreference ? `<span style="margin-right: 10px;">Seat: <strong>${cleanInlineFormattedText(s.railDetails.seatPreference)}</strong></span>` : ''}
          ${s.railDetails.pnrReference ? `<span>SmartEX PNR: <strong style="font-family: monospace;">${cleanInlineFormattedText(s.railDetails.pnrReference)}</strong></span>` : ''}
        </div>
      </div>
    ` : '';

    const overviewHtml = s.overview ? `
      <div style="margin-top: 5px;">
        <span style="font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; display: block; margin-bottom: 2px;">Overview</span>
        <div style="font-size: 10.5px; color: #334155; line-height: 1.4;">${formatPdfOrEmailDescription(s.overview)}</div>
      </div>
    ` : '';

    const inclusionsHtml = s.inclusions && s.inclusions.length > 0 ? `
      <div style="margin-top: 5px;">
        <span style="font-size: 9px; font-weight: 700; color: #059669; text-transform: uppercase; display: block; margin-bottom: 2px;">Inclusions</span>
        <div>
          ${s.inclusions.map(inc => `<span style="display: inline-block; font-size: 9px; background: #ffffff; color: #064e3b; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0; margin-right: 4px; margin-bottom: 4px;">✓ ${cleanInlineFormattedText(inc)}</span>`).join('')}
        </div>
      </div>
    ` : '';

    const exclusionsHtml = s.exclusions && s.exclusions.length > 0 ? `
      <div style="margin-top: 5px;">
        <span style="font-size: 9px; font-weight: 700; color: #e11d48; text-transform: uppercase; display: block; margin-bottom: 2px;">Exclusions</span>
        <div>
          ${s.exclusions.map(exc => `<span style="display: inline-block; font-size: 9px; background: #ffffff; color: #881337; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecdd3; margin-right: 4px; margin-bottom: 4px;">✕ ${cleanInlineFormattedText(exc)}</span>`).join('')}
        </div>
      </div>
    ` : '';

    const specialInstructionsHtml = s.specialInstructions ? `
      <div style="font-size: 10px; color: #334155; background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #e2e8f0; margin-top: 5px;">
        <strong>Special Instructions: </strong>${formatPdfOrEmailDescription(s.specialInstructions)}
      </div>
    ` : '';

    return `
      <div style="padding: 12px 14px; border-radius: 12px; background: ${s.badgeBg}18; border: 1px solid ${s.badgeBg}; margin-bottom: 10px;">
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
          <tr>
            <td style="vertical-align: top; padding-right: 12px;">
              <div style="margin-bottom: 4px;">
                <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: ${s.badgeBg}; color: ${s.badgeText}; display: inline-block; margin-right: 6px;">
                  ${cleanInlineFormattedText(s.categoryLabel)}
                </span>
                ${s.duration ? `<span style="font-size: 10px; color: #475569; margin-right: 6px;">⏱️ ${cleanInlineFormattedText(s.duration)}</span>` : ''}
                ${s.serviceTime ? `<span style="font-size: 10px; font-family: monospace; font-weight: 600; color: #334155; background: #ffffff; padding: 1px 6px; border-radius: 4px; border: 1px solid #e2e8f0; display: inline-block;">${cleanInlineFormattedText(s.serviceTime)}</span>` : ''}
              </div>

              <h4 style="font-size: 12.5px; font-weight: 800; color: #0f172a; margin: 4px 0 4px 0;">${cleanInlineFormattedText(s.listingName)}</h4>
              ${s.configurationSummary && !s.isRail ? `<p style="font-size: 10.5px; color: #475569; margin: 0 0 5px 0; font-weight: 500;">${cleanInlineFormattedText(s.configurationSummary)}</p>` : ''}
              ${operationalPointsHtml}
              ${railBoxHtml}
              ${overviewHtml}
              ${inclusionsHtml}
              ${exclusionsHtml}
              ${specialInstructionsHtml}
            </td>
            <td style="vertical-align: top; text-align: right; width: 95px; white-space: nowrap;">
              <span style="display: inline-block; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #047857; background: #ecfdf5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Confirmed</span>
              <div style="font-size: 9.5px; color: #64748b; margin-top: 4px;">${cleanInlineFormattedText(s.paxText)}</div>
            </td>
          </tr>
        </table>
      </div>
    `;
  };

  // Route Hubs Timeline matching PDF exactly
  const routeHubsHtml = model.routeHubs.length > 0 ? `
    <div style="padding-top: 12px; border-top: 1px solid #334155; margin-top: 14px;">
      <div style="display: flex; align-items: center; gap: 6px; font-size: 11px; font-weight: 700; color: #94a3b8; margin-bottom: 8px;">
        <span style="color: #00E5C0;">🧭</span>
        <span>Route & Destination Hubs:</span>
      </div>
      <div>
        ${model.routeHubs.map((h, i) => `
          <div style="background: rgba(30, 41, 59, 0.9); padding: 5px 10px; border-radius: 8px; border: 1px solid #475569; font-size: 11px; display: inline-flex; align-items: center; gap: 6px; margin-right: 6px; margin-bottom: 6px;">
            <span style="color: #00E5C0;">📍</span>
            <span style="font-weight: 700; color: #ffffff;">${cleanInlineFormattedText(h.hubName)}</span>
            <span style="color: #00E5C0; font-family: monospace; font-weight: 600;">(${h.nights} ${h.nights === 1 ? 'Night' : 'Nights'})</span>
          </div>
          ${i < model.routeHubs.length - 1 ? `<span style="color: #64748b; font-weight: bold; font-size: 11px; margin-right: 6px;">→</span>` : ''}
        `).join('')}
      </div>
    </div>
  ` : '';

  return `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #f1f5f9; width: 100%; margin: 0; padding: 20px 0;">
      <tr>
        <td align="center" style="padding: 0 10px;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 680px; width: 100%; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; table-layout: fixed; word-wrap: break-word; font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a;">
            
            <tr>
              <td style="padding: 24px 28px;">

                <!-- 1. TOP HEADER (Exact PDF Header Fidelity) -->
                <div style="border-bottom: 2px solid ${model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617'}; padding-bottom: 14px; margin-bottom: 16px;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <tr>
                      <td style="vertical-align: top;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                          ${model.agentLogoUrl ? `<img src="${model.agentLogoUrl}" alt="${cleanInlineFormattedText(model.agencyName)}" style="max-height: 40px; max-width: 130px; object-fit: contain; border-radius: 6px; margin-right: 8px; vertical-align: middle;" />` : ''}
                          <span style="font-size: 24px; font-weight: 900; ${model.isWhiteLabel ? '' : 'text-transform: lowercase;'} color: ${model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617'}; letter-spacing: -0.02em;">${cleanInlineFormattedText(model.agencyName)}</span>
                          <span style="font-size: 9px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 4px; background: ${model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617'}; color: ${model.isWhiteLabel ? '#ffffff' : '#00E5C0'}; display: inline-block; vertical-align: middle; margin-left: 8px;">${cleanInlineFormattedText(model.documentBadgeTitle)}</span>
                        </div>
                        <p style="font-size: 10.5px; color: #64748b; margin: 4px 0 0 0;">${cleanInlineFormattedText(model.agentAgencySubtitle)}</p>
                        ${!model.isWhiteLabel ? `
                          <div style="font-size: 9px; color: #64748b; margin-top: 4px; line-height: 1.35;">
                            <div><strong>Registered Address:</strong> ${cleanInlineFormattedText(model.agencyRegisteredAddress || THEUNBOUND_REGISTERED_ADDRESS)}</div>
                            <div><strong>Current Address:</strong> ${cleanInlineFormattedText(model.agencyCurrentAddress || THEUNBOUND_CURRENT_ADDRESS.replace(/\n/g, ', '))}</div>
                          </div>
                        ` : (model.agencyAddress ? `
                          <div style="font-size: 9px; color: #64748b; margin-top: 4px;">
                            <strong>Agency Address:</strong> ${cleanInlineFormattedText(model.agencyAddress)}
                          </div>
                        ` : '')}
                      </td>
                      <td style="vertical-align: top; text-align: right; font-family: monospace; font-size: 10.5px; width: 200px;">
                        <div style="font-size: 14px; font-weight: 900; color: ${model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617'};">${cleanInlineFormattedText(model.quoteNumber)} (v${model.version})</div>
                        <div style="color: #64748b;">Date: ${cleanInlineFormattedText(model.createdDateFormatted)}</div>
                        <div style="color: #64748b;">Valid Until: ${cleanInlineFormattedText(model.validUntilFormatted)}</div>
                        <div style="color: #0d9488; font-weight: 700;">Status: ${cleanInlineFormattedText(model.status)}</div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- 2. CURATED JOURNEY OVERVIEW BANNER (Exact PDF Banner Fidelity) -->
                <div style="background: ${model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617'}; background-image: linear-gradient(135deg, ${model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617'}, #0f172a, ${model.isWhiteLabel && model.brandPrimaryColor ? model.brandPrimaryColor : '#020617'}); color: #ffffff; padding: 18px 20px; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.06);">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <tr>
                      <td style="vertical-align: top;">
                        <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; color: #00E5C0; font-weight: 800; display: block;">Curated Journey Overview</span>
                        <h1 style="font-size: 19px; font-weight: 900; color: #ffffff; margin: 2px 0 4px 0; line-height: 1.25;">${cleanInlineFormattedText(model.destination)} Bespoke Travel Itinerary</h1>
                        <p style="font-size: 11px; color: #cbd5e1; margin: 0; line-height: 1.5;">
                          <span>${model.totalDays} Days / ${model.totalNights} Nights</span>
                          <span style="margin: 0 4px;">•</span>
                          <span style="font-weight: 700; color: #00E5C0;">${cleanInlineFormattedText(model.paxDetailsText)}</span>
                          ${model.nationality ? `<span style="margin: 0 4px;">•</span><span>Nationality: <strong style="color: #ffffff;">${cleanInlineFormattedText(model.nationality)}</strong></span>` : ''}
                          ${model.travelStyle ? `<span style="margin: 0 4px;">•</span><span>Style: <strong style="color: #ffffff;">${cleanInlineFormattedText(model.travelStyle)}</strong></span>` : ''}
                          ${model.dateSpanText ? `<span style="margin: 0 4px;">•</span><span style="font-family: monospace; color: #00E5C0;">${cleanInlineFormattedText(model.dateSpanText)}</span>` : ''}
                        </p>
                      </td>
                      <td style="vertical-align: top; text-align: right; width: 140px;">
                        <span style="font-size: 9px; text-transform: uppercase; letter-spacing: 0.08em; color: #00E5C0; font-weight: 700; display: block;">Official Proposal</span>
                        <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin-top: 2px;">${model.totalDays} Days / ${model.totalNights} Nights</div>
                        <span style="font-size: 9.5px; color: #94a3b8;">Exclusive Ground Itinerary</span>
                      </td>
                    </tr>
                  </table>
                  ${routeHubsHtml}
                </div>

                <!-- 3. CLIENT & SPECIALIST DOSSIER (Exact PDF Dossier Fidelity) -->
                <div style="background: #f8fafc; padding: 14px 16px; border-radius: 14px; border: 1px solid #e2e8f0; font-size: 11px; margin-bottom: 18px;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <tr>
                      <td style="width: 50%; vertical-align: top; padding-right: 12px; border-right: 1px solid #e2e8f0;">
                        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: block; margin-bottom: 2px;">👥 Valued Guest / Client</span>
                        <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${cleanInlineFormattedText(model.clientName)}</div>
                        ${model.clientCompany ? `<div style="color: #475569; font-weight: 600;">${cleanInlineFormattedText(model.clientCompany)}</div>` : ''}
                        ${model.clientEmail ? `<div style="color: #64748b; font-family: monospace;">${cleanInlineFormattedText(model.clientEmail)}</div>` : ''}
                        ${model.clientPhone ? `<div style="color: #64748b; font-family: monospace;">${cleanInlineFormattedText(model.clientPhone)}</div>` : ''}
                      </td>
                      <td style="width: 50%; vertical-align: top; padding-left: 16px;">
                        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #94a3b8; display: block; margin-bottom: 2px;">🎖️ Prepared By Destination Specialist</span>
                        <div style="font-weight: 800; font-size: 13px; color: #0f172a;">${cleanInlineFormattedText(model.agentName)}</div>
                        <div style="color: #334155; font-weight: 600;">${cleanInlineFormattedText(model.agencyName)}</div>
                        ${model.agentEmail ? `<div style="color: #64748b; font-family: monospace;">${cleanInlineFormattedText(model.agentEmail)}</div>` : ''}
                        ${model.agentPhone ? `<div style="color: #64748b; font-family: monospace;">${cleanInlineFormattedText(model.agentPhone)}</div>` : ''}
                        ${model.agencyWebsite ? `<div style="color: #64748b; font-size: 10px;">${cleanInlineFormattedText(model.agencyWebsite)}</div>` : ''}
                        ${!model.isWhiteLabel ? `
                          <div style="color: #64748b; font-size: 9px; line-height: 1.35; margin-top: 3px;">
                            <div><strong>Registered Address:</strong> ${cleanInlineFormattedText(model.agencyRegisteredAddress || THEUNBOUND_REGISTERED_ADDRESS)}</div>
                            <div style="margin-top: 2px;"><strong>Current Address:</strong> ${cleanInlineFormattedText(model.agencyCurrentAddress || THEUNBOUND_CURRENT_ADDRESS.replace(/\n/g, ', '))}</div>
                          </div>
                        ` : (model.agencyAddress ? `<div style="color: #64748b; font-size: 9.5px;">${cleanInlineFormattedText(model.agencyAddress)}</div>` : '')}
                        <div style="color: #0d9488; font-size: 10px; font-weight: 700; margin-top: 3px;">🛡️ 24/7 On-Ground Concierge Assistance</div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- OPTIONAL SPECIALIST PERSONAL NOTE -->
                ${customNote && customNote.trim() ? `
                  <div style="background: #ecfdf5; border-left: 4px solid #00E5C0; padding: 12px 16px; border-radius: 0 10px 10px 0; margin-bottom: 16px; font-size: 11px; color: #064e3b; line-height: 1.5;">
                    <strong style="font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #047857; display: block; margin-bottom: 3px;">Personal Specialist Note from ${cleanInlineFormattedText(model.agentName)}:</strong>
                    <div>${formatPdfOrEmailDescription(customNote.trim())}</div>
                  </div>
                ` : ''}

                <!-- 4. VISA & ANCILLARY SERVICES (If present) -->
                ${model.visaServices && model.visaServices.length > 0 ? `
                  <div style="margin-top: 12px; margin-bottom: 14px;">
                    <div style="border-bottom: 2px solid #065f46; padding-bottom: 6px; margin-bottom: 12px;">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                        <tr>
                          <td>
                            <div style="display: flex; align-items: center; gap: 6px;">
                              <span style="font-size: 15px;">🌐</span>
                              <h2 style="font-size: 13.5px; font-weight: 900; color: #020617; text-transform: uppercase; margin: 0; display: inline;">Visa & Ancillary Services</h2>
                            </div>
                          </td>
                          <td style="text-align: right; font-size: 10.5px; color: #065f46; font-family: monospace; font-weight: 700;">
                            ${model.visaServices.length} Services Included
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${model.visaServices.map(v => `
                      <div style="padding: 14px; border-radius: 12px; background: #ecfdf5; border: 1px solid #a7f3d0; margin-bottom: 12px;">
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                          <tr>
                            <td style="vertical-align: top; padding-right: 12px;">
                              <div style="margin-bottom: 4px;">
                                <span style="font-size: 9px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: #a7f3d0; color: #064e3b; display: inline-block;">VISA & ANCILLARY</span>
                                ${v.duration ? `<span style="font-size: 10px; color: #475569; margin-left: 6px;">⏱️ ${cleanInlineFormattedText(v.duration)}</span>` : ''}
                              </div>
                              <h4 style="font-size: 12.5px; font-weight: 700; color: #0f172a; margin: 0 0 4px 0;">${cleanInlineFormattedText(v.listingName)}</h4>
                              ${v.configurationSummary ? `<p style="font-size: 11px; color: #047857; margin: 0 0 5px 0; font-weight: 600;">${cleanInlineFormattedText(v.configurationSummary)}</p>` : ''}
                              ${v.overview ? `
                                <div style="margin-top: 5px;">
                                  <span style="font-size: 9px; font-weight: 700; color: #64748b; text-transform: uppercase; display: block; margin-bottom: 2px;">Overview</span>
                                  <div style="font-size: 10.5px; color: #334155; line-height: 1.4;">${formatPdfOrEmailDescription(v.overview)}</div>
                                </div>
                              ` : ''}
                              ${v.inclusions.length > 0 ? `
                                <div style="margin-top: 5px;">
                                  <span style="font-size: 9px; font-weight: 700; color: #059669; text-transform: uppercase; display: block; margin-bottom: 2px;">Inclusions</span>
                                  <div>
                                    ${v.inclusions.map(inc => `<span style="display: inline-block; font-size: 9px; background: #ffffff; color: #064e3b; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0; margin-right: 4px; margin-bottom: 4px;">✓ ${cleanInlineFormattedText(inc)}</span>`).join('')}
                                  </div>
                                </div>
                              ` : ''}
                              ${v.exclusions.length > 0 ? `
                                <div style="margin-top: 5px;">
                                  <span style="font-size: 9px; font-weight: 700; color: #e11d48; text-transform: uppercase; display: block; margin-bottom: 2px;">Exclusions</span>
                                  <div>
                                    ${v.exclusions.map(exc => `<span style="display: inline-block; font-size: 9px; background: #ffffff; color: #881337; padding: 2px 6px; border-radius: 4px; border: 1px solid #fecdd3; margin-right: 4px; margin-bottom: 4px;">✕ ${cleanInlineFormattedText(exc)}</span>`).join('')}
                                  </div>
                                </div>
                              ` : ''}
                              ${v.specialInstructions ? `
                                <div style="font-size: 10px; color: #065f46; background: #ffffff; padding: 6px 8px; border-radius: 6px; border: 1px solid #a7f3d0; margin-top: 5px;">
                                  <strong>Special Notes: </strong>${formatPdfOrEmailDescription(v.specialInstructions)}
                                </div>
                              ` : ''}
                            </td>
                            <td style="vertical-align: top; text-align: right; width: 95px; white-space: nowrap;">
                              <span style="display: inline-block; font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #065f46; background: #d1fae5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0;">Included</span>
                              <div style="font-size: 9.5px; color: #64748b; margin-top: 4px;">${cleanInlineFormattedText(v.paxText)}</div>
                            </td>
                          </tr>
                        </table>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}

                <!-- OPTIONAL JOURNEY NARRATIVE & OVERVIEW -->
                ${model.itineraryOverview ? `
                  <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-left: 4px solid #00C6A6; padding: 14px 18px; border-radius: 12px; margin-bottom: 18px; font-size: 11px; color: #134e4a; line-height: 1.55;">
                    <strong style="font-size: 9.5px; text-transform: uppercase; letter-spacing: 0.05em; color: #0f766e; display: block; margin-bottom: 5px;">✨ Journey Narrative &amp; Overview</strong>
                    <div>${formatPdfOrEmailDescription(model.itineraryOverview)}</div>
                  </div>
                ` : ''}

                <!-- 5. DAY-BY-DAY CHRONOLOGICAL ITINERARY (Exact PDF Day Structure) -->
                <div style="border-bottom: 2px solid #020617; padding-bottom: 6px; margin-top: 14px; margin-bottom: 12px;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <tr>
                      <td>
                        <h2 style="font-size: 13.5px; font-weight: 900; color: #020617; text-transform: uppercase; margin: 0; display: inline;">Day-by-Day Itinerary & Scheduled Services</h2>
                      </td>
                      <td style="text-align: right; font-size: 10.5px; color: #64748b; font-family: monospace; font-weight: 700;">
                        ${model.days.length} Days Itinerary
                      </td>
                    </tr>
                  </table>
                </div>

                ${model.days.map(day => `
                  <div style="margin-bottom: 14px;">
                    
                    <!-- Day Header (Exact PDF Day Header) -->
                    <div style="background: #0f172a; color: #ffffff; padding: 10px 14px; border-radius: 12px; margin-top: 12px; margin-bottom: 10px;">
                      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                        <tr>
                          <td style="vertical-align: middle;">
                            <div style="display: inline-block; width: 26px; height: 26px; border-radius: 6px; background: #00E5C0; color: #0f172a; font-weight: 900; text-align: center; line-height: 26px; font-size: 11px; font-family: monospace; margin-right: 8px; vertical-align: middle;">
                              ${String(day.dayNumber).padStart(2, '0')}
                            </div>
                            <span style="font-weight: 800; font-size: 13px; color: #ffffff; vertical-align: middle;">Day ${day.dayNumber}: ${cleanInlineFormattedText(day.dayOfWeek)}, ${cleanInlineFormattedText(day.formattedDate)}</span>
                            ${day.isTransitionDay && day.prevHubName ? `
                              <span style="display: inline-block; padding: 1px 6px; border-radius: 4px; background: rgba(245, 158, 11, 0.2); color: #fcd34d; font-size: 9px; font-weight: 700; border: 1px solid rgba(245, 158, 11, 0.3); vertical-align: middle; margin-left: 6px;">
                                Transfer: ${cleanInlineFormattedText(day.prevHubName)} → ${cleanInlineFormattedText(day.hubName)}
                              </span>
                            ` : ''}
                            <div style="font-size: 10.5px; color: #cbd5e1; margin-top: 3px;">
                              <span style="color: #00E5C0;">📍</span>
                              <span style="font-weight: 600;">${cleanInlineFormattedText(day.hubName)} Base</span>
                              <span style="margin: 0 4px; color: #64748b;">•</span>
                              <span>Overnight: <strong style="color: #ffffff;">${cleanInlineFormattedText(day.hubName)} Hub</strong></span>
                              ${day.customTheme ? `<span style="color: #64748b; margin: 0 4px;">•</span><span style="color: #00E5C0; font-weight: 600;">${cleanInlineFormattedText(day.customTheme)}</span>` : ''}
                            </div>
                          </td>
                          <td style="vertical-align: middle; text-align: right; font-size: 10.5px; color: #94a3b8; font-family: monospace; width: 140px;">
                            ${day.services.length > 0 ? `${day.services.length} ${day.services.length === 1 ? 'Service' : 'Services'}` : 'Leisure Exploration'}
                          </td>
                        </tr>
                      </table>
                    </div>

                    <!-- Day Overview (if present) -->
                    ${day.dayOverview ? `
                      <div style="padding: 10px 14px; border-radius: 10px; background: #f8fafc; border: 1px solid #e2e8f0; margin-bottom: 10px; font-size: 10.5px; color: #334155; line-height: 1.45;">
                        <span style="font-size: 9px; font-weight: 800; text-transform: uppercase; color: #0d9488; display: block; margin-bottom: 2px;">Day ${day.dayNumber} Overview</span>
                        <div>${formatPdfOrEmailDescription(day.dayOverview)}</div>
                      </div>
                    ` : ''}

                    <!-- Day Services or Leisure Card -->
                    ${day.services.length === 0 ? `
                      <div style="padding: 12px 14px; border-radius: 10px; background: #f8fafc; border: 1px dashed #cbd5e1; font-size: 11px; color: #64748b; margin-bottom: 10px;">
                        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                          <tr>
                            <td>
                              <span style="font-weight: 700; color: #1e293b;">• Day at Leisure in ${cleanInlineFormattedText(day.hubName)}</span>
                              <p style="font-size: 10px; color: #64748b; margin: 3px 0 0 0;">Free time for personal exploration, neighborhood shopping, and local dining discoveries.</p>
                            </td>
                            <td style="text-align: right; width: 80px; font-style: italic; color: #94a3b8; font-size: 10px;">
                              Self-Paced
                            </td>
                          </tr>
                        </table>
                      </div>
                    ` : `
                      <div style="margin-top: 6px;">
                        <div style="font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 6px;">
                          Activities & Highlights
                        </div>
                        ${day.services.map(s => renderDayServiceCard(s)).join('')}
                      </div>
                    `}

                    <!-- Day Operational Notes (if present) -->
                    ${day.dayNotes ? `
                      <div style="padding: 10px 14px; border-radius: 10px; background: #fffbeb; border: 1px solid #fde68a; margin-bottom: 10px; font-size: 10px; color: #78350f; line-height: 1.4;">
                        <strong>Day ${day.dayNumber} Operational Notes: </strong>${formatPdfOrEmailDescription(day.dayNotes)}
                      </div>
                    ` : ''}

                  </div>
                `).join('')}

                <!-- 6. ADDITIONAL SERVICES (If present) -->
                ${model.additionalServices && model.additionalServices.length > 0 ? `
                  <div style="margin-top: 14px; margin-bottom: 12px;">
                    <div style="border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; margin-bottom: 10px; font-size: 11.5px; font-weight: 800; color: #0f172a; text-transform: uppercase;">
                      ✨ Additional Package Privileges & Services
                    </div>
                    <div>
                      ${model.additionalServices.map(a => `
                        <div style="padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; background: #f8fafc; margin-bottom: 8px;">
                          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                            <tr>
                              <td>
                                <div style="font-weight: 700; color: #0f172a; font-size: 11px;">${cleanInlineFormattedText(a.name)}</div>
                                <div style="font-size: 9.5px; color: #64748b;">${cleanInlineFormattedText(a.summary)}</div>
                              </td>
                              <td style="text-align: right; width: 70px;">
                                <span style="font-size: 8.5px; font-weight: 700; text-transform: uppercase; color: #065f46; background: #d1fae5; padding: 2px 6px; border-radius: 4px; border: 1px solid #a7f3d0; display: inline-block;">Included</span>
                              </td>
                            </tr>
                          </table>
                        </div>
                      `).join('')}
                    </div>
                  </div>
                ` : ''}

                <!-- 7. OPERATIONAL STANDARDS (Exact PDF 4-Card Grid) -->
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 14px; padding: 14px 16px; margin-top: 14px; margin-bottom: 12px;">
                  <div style="font-size: 11px; font-weight: 800; color: #0f172a; text-transform: uppercase; margin-bottom: 10px; display: flex; align-items: center; gap: 6px;">
                    <span>🛡️</span>
                    <span>${cleanInlineFormattedText(model.operationalStandardsTitle)}</span>
                  </div>
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <tr>
                      <td style="width: 50%; vertical-align: top; padding-right: 6px; padding-bottom: 8px;">
                        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 58px;">
                          <span style="font-weight: 800; font-size: 10px; color: #0f172a; display: block; margin-bottom: 2px;">🚗 Private Chauffeur Fleet</span>
                          <p style="font-size: 9px; color: #64748b; margin: 0; line-height: 1.35;">Pristine air-conditioned vehicles with commercial licensed drivers and door-to-door luggage handling.</p>
                        </div>
                      </td>
                      <td style="width: 50%; vertical-align: top; padding-left: 6px; padding-bottom: 8px;">
                        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 58px;">
                          <span style="font-weight: 800; font-size: 10px; color: #0f172a; display: block; margin-bottom: 2px;">⛩️ Licensed Local Guides</span>
                          <p style="font-size: 9px; color: #64748b; margin: 0; line-height: 1.35;">Government-certified bilingual specialists delivering insightful cultural and historical immersion.</p>
                        </div>
                      </td>
                    </tr>
                    <tr>
                      <td style="width: 50%; vertical-align: top; padding-right: 6px;">
                        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 58px;">
                          <span style="font-weight: 800; font-size: 10px; color: #0f172a; display: block; margin-bottom: 2px;">🏨 Confirmed Allocations</span>
                          <p style="font-size: 9px; color: #64748b; margin: 0; line-height: 1.35;">Direct supplier contracted allotments with daily breakfast and verified luxury standards.</p>
                        </div>
                      </td>
                      <td style="width: 50%; vertical-align: top; padding-left: 6px;">
                        <div style="background: #ffffff; padding: 10px; border-radius: 8px; border: 1px solid #e2e8f0; min-height: 58px;">
                          <span style="font-weight: 800; font-size: 10px; color: #0f172a; display: block; margin-bottom: 2px;">🛡️ 24/7 Operations Desk</span>
                          <p style="font-size: 9px; color: #64748b; margin: 0; line-height: 1.35;">Live flight tracking, real-time dispatch monitoring, and emergency WhatsApp concierge support.</p>
                        </div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- 8. FINANCIAL TARIFF CONTAINER -->
                <div style="background: #020617; color: #ffffff; padding: 18px 20px; border-radius: 16px; margin-top: 14px; margin-bottom: 12px;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <tr>
                      <td style="vertical-align: middle;">
                        <span style="font-size: 9px; font-weight: 800; color: #00E5C0; text-transform: uppercase; letter-spacing: 0.1em; display: block;">QUOTATION PRICING SUMMARY</span>
                        ${model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? `
                          <div style="font-size: 13.5px; font-weight: 800; color: #ffffff; margin: 5px 0 3px 0;">
                            <strong>Hotel Accommodation Total:</strong> <span style="color: #00E5C0; font-family: monospace;">${model.hotelAccommodationTotalFormatted}</span>
                          </div>
                        ` : ''}
                        <h3 style="font-size: 15px; font-weight: 900; color: #ffffff; margin: 3px 0 3px 0;"><strong>Land Part Total:</strong> <span style="color: #00E5C0; font-family: monospace;">${model.landPartTotalFormatted}</span></h3>
                        ${model.appliedPromotion ? `
                          <div style="font-size: 12.5px; font-weight: 800; color: #6ee7b7; margin: 3px 0 3px 0;">
                            <strong>Promotional Discount (${cleanInlineFormattedText(model.appliedPromotion.code)}):</strong> <span style="font-family: monospace;">-${model.appliedPromotion.discountAmountFormatted}</span> <span style="font-weight: 600; color: #a7f3d0;">• ${cleanInlineFormattedText(model.appliedPromotion.promotionName)}</span>
                          </div>
                        ` : ''}
                        <div style="font-size: 16px; font-weight: 900; color: #ffffff; margin: 3px 0 4px 0;">
                          <strong>Final Selling Price:</strong> <span style="color: #00E5C0; font-family: monospace;">${model.finalCustomerSellingPriceFormatted}</span>
                        </div>
                        <p style="font-size: 10px; color: #cbd5e1; margin: 0; max-width: 420px; line-height: 1.4;">Land Part Total covers all included non-accommodation travel services (tours, activities, transfers, rail, and ancillary ground services) and applicable taxes.</p>
                      </td>
                      <td style="vertical-align: middle; text-align: right; width: 195px;">
                        ${model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? `
                          <div style="font-size: 10px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 2px;">Hotel Total: <span style="color: #00E5C0; font-family: monospace;">${model.hotelAccommodationTotalFormatted}</span></div>
                          <div style="font-size: 10px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Land Total: <span style="color: #00E5C0; font-family: monospace;">${model.landPartTotalFormatted}</span></div>
                        ` : ''}
                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Final Selling Price</div>
                        <div style="font-size: 22px; font-weight: 900; font-family: monospace; color: #00E5C0;">${model.finalCustomerSellingPriceFormatted}</div>
                        <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${cleanInlineFormattedText(model.guaranteedCurrencyLine)}</div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- 8B. PACKAGE INCLUSIONS, EXCLUSIONS & POLICY NOTES -->
                ${model.inclusions.length > 0 || model.exclusions.length > 0 || model.importantInformation || model.cancellationPolicy ? `
                  <div style="margin-top: 10px; margin-bottom: 10px; font-size: 10px;">
                    ${model.inclusions.length > 0 ? `
                      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px;">
                        <div style="font-weight: 900; color: #064e3b; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">✓ Package Inclusions</div>
                        <ul style="margin: 0; padding-left: 18px; color: #065f46; line-height: 1.45;">
                          ${model.inclusions.map(inc => `<li style="margin-bottom: 2px;">${cleanInlineFormattedText(inc)}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    ${model.exclusions.length > 0 ? `
                      <div style="background: #fff1f2; border: 1px solid #fecdd3; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px;">
                        <div style="font-weight: 900; color: #881337; text-transform: uppercase; font-size: 10px; margin-bottom: 4px;">✕ Package Exclusions</div>
                        <ul style="margin: 0; padding-left: 18px; color: #9f1239; line-height: 1.45;">
                          ${model.exclusions.map(exc => `<li style="margin-bottom: 2px;">${cleanInlineFormattedText(exc)}</li>`).join('')}
                        </ul>
                      </div>
                    ` : ''}
                    ${model.importantInformation ? `
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px; margin-bottom: 8px;">
                        <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; font-size: 10px; margin-bottom: 3px;">Important Information</div>
                        <div style="color: #475569; line-height: 1.45;">${formatPdfOrEmailDescription(model.importantInformation)}</div>
                      </div>
                    ` : ''}
                    ${model.cancellationPolicy ? `
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 10px 14px;">
                        <div style="font-weight: 900; color: #0f172a; text-transform: uppercase; font-size: 10px; margin-bottom: 3px;">Cancellation Policy</div>
                        <div style="color: #475569; line-height: 1.45;">${formatPdfOrEmailDescription(model.cancellationPolicy)}</div>
                      </div>
                    ` : ''}
                  </div>
                ` : ''}

                <!-- 9. POLICIES CONTAINER (Exact PDF Policies Box) -->
                <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 12px; padding: 12px 14px; margin-top: 10px; margin-bottom: 10px; font-size: 10px;">
                  <div style="font-weight: 900; color: #78350f; text-transform: uppercase; font-size: 10px; margin-bottom: 5px;">
                    ℹ️ Operational Guidelines & Child / Attraction Policy
                  </div>
                  <ul style="margin: 0; padding-left: 18px; color: #92400e; line-height: 1.45;">
                    ${model.childAndAttractionPolicies.map(p => `<li style="margin-bottom: 3px;">${cleanInlineFormattedText(p)}</li>`).join('')}
                  </ul>
                </div>

                <!-- 10. TERMS & SIGNATURE (Exact PDF Terms Section) -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 12px; margin-top: 10px; font-size: 10px; color: #64748b;">
                  <div style="font-weight: 800; color: #1e293b; text-transform: uppercase; font-size: 10px; margin-bottom: 6px;">${cleanInlineFormattedText(model.commercialTermsHeading || 'Commercial Quotation Terms')}</div>
                  <div style="margin: 0 0 10px 0; color: #475569; line-height: 1.45;">${model.commercialTermsHtml || formatPdfOrEmailDescription(model.commercialTerms)}</div>
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #f1f5f9; padding-top: 8px; font-size: 9.5px; color: #94a3b8; font-family: monospace;">
                    <tr>
                      <td>${cleanInlineFormattedText(model.footerContactLine)}</td>
                      <td style="text-align: right;">${cleanInlineFormattedText(model.footerRightTitle)}</td>
                    </tr>
                  </table>
                </div>

                <!-- 11. RUNNING FOOTER (Exact PDF Document Footer) -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 12px; font-size: 9.5px; color: #94a3b8; font-family: monospace;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="font-weight: 700; color: #475569;">${model.isWhiteLabel ? cleanInlineFormattedText(model.agencyName.toUpperCase()) : `${cleanInlineFormattedText(model.agencyName.toUpperCase())} DMC`} • ${cleanInlineFormattedText(model.quoteNumber)}</td>
                      <td style="text-align: right; color: #0f172a; font-weight: 700;">Official Quotation Document</td>
                    </tr>
                  </table>
                </div>

              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  `.trim();
}

// Dedicated alias for PDF-fidelity Rich HTML quotation preview
export const renderStructuredQuotationHtmlEmail = renderProposalViewHtmlEmail;
export const renderPdfFidelityQuotationHtmlEmail = renderProposalViewHtmlEmail;

// ============================================================================
// OPTION 2: COMPLETE PLAIN-TEXT QUOTATION (SIMPLE SEMANTIC FORMATTING)
// ============================================================================

/**
 * Parses and converts plain text or mixed HTML quotation content into clean,
 * minimal semantic HTML email content without a designed layout.
 * 
 * Rules:
 * - NO colored cards, NO dark banners, NO decorative backgrounds, NO badges.
 * - Standard semantic HTML: <h1>, <h2>, <h3>, <p>, <strong>, <ul>, <ol>, <li>, <table>.
 * - Correctly transforms <br>, <br/>, </br>, <p>, <div>, <strong>, <b>, <em>, <i>, <ul>, <ol>, <li>, <table>.
 * - Decodes entities &amp;, &nbsp;, &lt;, &gt;.
 * - Handles nested elements and escaped HTML (&lt;p&gt;).
 * - ZERO literal HTML tags displayed.
 */
export function formatPlainTextQuotationToHtml(input: string): string {
  if (!input || typeof input !== 'string') return '';
  let normalized = normalizeStoredContent(input);
  if (!normalized) return '';

  // 1. Convert HTML headings to Markdown lines for unified block parsing
  normalized = normalized.replace(/<h1[^>]*>(.*?)<\/h1>/gi, '\n\n$1\n\n');
  normalized = normalized.replace(/<h2[^>]*>(.*?)<\/h2>/gi, '\n\n## $1\n\n');
  normalized = normalized.replace(/<h3[^>]*>(.*?)<\/h3>/gi, '\n\n### $1\n\n');
  normalized = normalized.replace(/<h[4-6][^>]*>(.*?)<\/h[4-6]>/gi, '\n\n$1\n\n');

  // 2. Convert strong / b tags to Markdown **
  normalized = normalized.replace(/<(?:strong|b)[^>]*>(.*?)<\/(?:strong|b)>/gi, '**$1**');

  // 3. Convert em / i tags to Markdown *
  normalized = normalized.replace(/<(?:em|i)[^>]*>(.*?)<\/(?:em|i)>/gi, '*$1*');

  // 4. Convert list items to bullet markers
  normalized = normalized.replace(/<li[^>]*>(.*?)<\/li>/gi, '\n• $1\n');
  normalized = normalized.replace(/<\/[uo]l>/gi, '\n');
  normalized = normalized.replace(/<[uo]l[^>]*>/gi, '\n');

  // 5. Convert table rows to key-value or formatted lines
  normalized = normalized.replace(/<tr[^>]*>\s*<t[dh][^>]*>(.*?)<\/t[dh]>\s*<t[dh][^>]*>(.*?)<\/t[dh]>\s*<\/tr>/gi, '\n$1 : $2\n');
  normalized = normalized.replace(/<tr[^>]*>(.*?)<\/tr>/gi, '\n$1\n');
  normalized = normalized.replace(/<t[dh][^>]*>(.*?)<\/t[dh]>/gi, '$1 | ');

  // 6. Convert paragraphs and divs to clean block boundaries
  normalized = normalized.replace(/<\/p>/gi, '\n\n');
  normalized = normalized.replace(/<p[^>]*>/gi, '\n');
  normalized = normalized.replace(/<\/div>/gi, '\n');
  normalized = normalized.replace(/<div[^>]*>/gi, '\n');

  // 7. Convert line breaks
  normalized = normalized.replace(/<br\s*\/?>/gi, '\n');

  // 8. Strip any remaining HTML tags safely
  normalized = normalized.replace(/<[^>]+>/g, '');

  // 9. Decode HTML entities
  normalized = decodeHtmlEntities(normalized);

  // 10. Normalize Windows newlines and excess blank lines
  normalized = normalized.replace(/\r\n/g, '\n');
  normalized = normalized.replace(/\n{3,}/g, '\n\n');

  const rawLines = normalized.split('\n');

  interface ParsedNode {
    type: 'TITLE' | 'H2' | 'H3' | 'SUBHEADING' | 'KEY_VALUE' | 'BULLET_LIST' | 'NUMBERED_LIST' | 'PARAGRAPH' | 'COMPACT_DIVIDER';
    content?: string;
    items?: string[];
    keyValues?: { key: string; value: string }[];
  }

  const nodes: ParsedNode[] = [];
  let currentBullets: string[] = [];
  let currentNumbered: string[] = [];
  let currentKeyValues: { key: string; value: string }[] = [];
  let currentParagraphLines: string[] = [];

  const flushBullets = () => {
    if (currentBullets.length > 0) {
      nodes.push({ type: 'BULLET_LIST', items: [...currentBullets] });
      currentBullets = [];
    }
  };

  const flushNumbered = () => {
    if (currentNumbered.length > 0) {
      nodes.push({ type: 'NUMBERED_LIST', items: [...currentNumbered] });
      currentNumbered = [];
    }
  };

  const flushKeyValues = () => {
    if (currentKeyValues.length > 0) {
      nodes.push({ type: 'KEY_VALUE', keyValues: [...currentKeyValues] });
      currentKeyValues = [];
    }
  };

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const combined = currentParagraphLines.join(' ').trim();
      if (combined) {
        nodes.push({ type: 'PARAGRAPH', content: combined });
      }
      currentParagraphLines = [];
    }
  };

  const flushAll = () => {
    flushBullets();
    flushNumbered();
    flushKeyValues();
    flushParagraph();
  };

  const dividerRegex = /^[=\-—_─\s]{3,}$/;
  const dayHeaderRegex = /^(DAY\s+\d+|Day\s+\d+)\s*[:—–-]\s*(.*)$/i;
  const bulletRegex = /^[•*✓✕\-–—]\s*(.*)$/;
  const numberedRegex = /^\d+\.\s+(.*)$/;
  const keyValueRegex = /^([A-Za-z0-9\s/–—&()#]+)\s*[:=]\s+(.*)$/;

  let isFirstLine = true;

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i].trim();

    if (!rawLine) {
      flushAll();
      continue;
    }

    if (dividerRegex.test(rawLine)) {
      flushAll();
      const lastNode = nodes[nodes.length - 1];
      if (lastNode && lastNode.type !== 'H2' && lastNode.type !== 'H3' && lastNode.type !== 'TITLE' && lastNode.type !== 'COMPACT_DIVIDER') {
        nodes.push({ type: 'COMPACT_DIVIDER' });
      }
      continue;
    }

    // Strip wrapping markdown bold if the whole line is **Heading**
    let cleanLine = rawLine;
    const wholeLineBold = cleanLine.match(/^\*\*([^*]+)\*\*$/);
    if (wholeLineBold) {
      cleanLine = wholeLineBold[1].trim();
    }

    // Markdown heading tokens: ## or ###
    if (/^##\s+(.*)$/.test(cleanLine)) {
      flushAll();
      nodes.push({ type: 'H2', content: cleanLine.replace(/^##\s+/, '') });
      continue;
    }
    if (/^###\s+(.*)$/.test(cleanLine)) {
      flushAll();
      nodes.push({ type: 'H3', content: cleanLine.replace(/^###\s+/, '') });
      continue;
    }

    // 1. Check Main Quotation Title
    if (
      isFirstLine &&
      (/^(THEUNBOUND.*QUOTATION|COMPLETE TRAVEL QUOTATION|TRAVEL PROPOSAL|QUOTATION\s*—)/i.test(cleanLine) ||
        (cleanLine.toUpperCase() === cleanLine && cleanLine.length > 10 && !cleanLine.includes(':')))
    ) {
      flushAll();
      nodes.push({ type: 'TITLE', content: cleanLine });
      isFirstLine = false;
      continue;
    }
    isFirstLine = false;

    // 2. Check Major Section Headings
    const isMajorSection =
      ['TRIP OVERVIEW', 'CLIENT & SPECIALIST DOSSIER', 'ACCOMMODATION', 'ACCOMMODATION & HOTEL STAYS', 'HOTEL STAYS',
       'VISA & ANCILLARY SERVICES', 'WHAT\'S INCLUDED', 'WHAT’S INCLUDED', 'INCLUDED SERVICES', 'WHAT\'S EXCLUDED',
       'GROUND OPERATIONS STANDARDS', 'TOTAL PACKAGE INVESTMENT', 'OPERATIONAL GUIDELINES', 'IMPORTANT INFORMATION',
       'TERMS AND CONDITIONS', 'COMMERCIAL QUOTATION TERMS'].some(sec => cleanLine.toUpperCase().startsWith(sec)) ||
      /^\d+\.\s+[A-Z\s&/]{4,}$/.test(cleanLine);

    if (isMajorSection && !cleanLine.includes('Day ')) {
      flushAll();
      const title = cleanLine.replace(/^\d+\.\s*/, '').replace(/:$/, '').trim();
      nodes.push({ type: 'H2', content: title });
      continue;
    }

    // 3. Check Day Itinerary Heading
    const dayMatch = cleanLine.match(dayHeaderRegex);
    if (dayMatch) {
      flushAll();
      nodes.push({ type: 'H3', content: cleanLine });
      continue;
    }

    // 4. Check Subheadings (e.g. Activities and Highlights, Accommodation, Overnight:)
    if (
      /^(Activities\s*(&|and)\s*Highlights|Accommodation|Overnight|Important Notes|Inclusions|Exclusions):?$/i.test(cleanLine) ||
      cleanLine.match(/^\[\d+\]\s+/)
    ) {
      flushAll();
      nodes.push({ type: 'SUBHEADING', content: cleanLine });
      continue;
    }

    // 5. Check Bullet Point
    const bulletMatch = cleanLine.match(bulletRegex);
    if (bulletMatch) {
      flushParagraph();
      flushKeyValues();
      flushNumbered();
      currentBullets.push(bulletMatch[1].trim());
      continue;
    }

    // 5b. Check Numbered Heading with Colon (e.g. "1. Booking Status: No services...")
    const numberedHeadingWithBodyMatch = cleanLine.match(/^(\d+\.\s+[^:]+:)\s+(.+)$/);
    if (numberedHeadingWithBodyMatch) {
      flushAll();
      nodes.push({
        type: 'PARAGRAPH',
        content: `**${numberedHeadingWithBodyMatch[1].trim()}** ${numberedHeadingWithBodyMatch[2].trim()}`
      });
      continue;
    }

    // 6. Check Numbered List item
    const numMatch = cleanLine.match(numberedRegex);
    if (numMatch && !cleanLine.toUpperCase().includes('TOTAL') && !cleanLine.includes('Day')) {
      flushParagraph();
      flushKeyValues();
      flushBullets();
      currentNumbered.push(numMatch[1].trim());
      continue;
    }

    // 7. Check Key-Value Pair
    const kvMatch = cleanLine.match(keyValueRegex);
    if (
      kvMatch &&
      kvMatch[1].trim().length < 35 &&
      !kvMatch[1].toLowerCase().startsWith('day') &&
      !kvMatch[1].toLowerCase().startsWith('overview')
    ) {
      flushParagraph();
      flushBullets();
      flushNumbered();
      currentKeyValues.push({ key: kvMatch[1].trim(), value: kvMatch[2].trim() });
      continue;
    }

    // 8. Plain paragraph line
    flushBullets();
    flushNumbered();
    flushKeyValues();
    currentParagraphLines.push(rawLine);
  }

  flushAll();

  // Render minimal semantic HTML (plain white background, bold text, simple spacing, subtle separators)
  const renderedElements: string[] = [];

  for (const node of nodes) {
    switch (node.type) {
      case 'TITLE':
        renderedElements.push(`
          <h1 style="font-size: 16px; font-weight: bold; margin: 0 0 14px 0; color: #0f172a; text-transform: uppercase;">
            ${cleanInlineFormattedText(node.content || '')}
          </h1>
        `);
        break;

      case 'H2':
        renderedElements.push(`
          <h2 style="font-size: 14px; font-weight: bold; text-transform: uppercase; margin: 22px 0 6px 0; color: #0f172a; letter-spacing: 0.5px;">
            ${cleanInlineFormattedText(node.content || '')}
          </h2>
          <div style="width: 36px; height: 1.5px; background-color: #cbd5e1; margin: 4px 0 12px 0;"></div>
        `);
        break;

      case 'H3':
        renderedElements.push(`
          <h3 style="font-size: 13.5px; font-weight: bold; text-transform: uppercase; margin: 18px 0 6px 0; color: #0f172a;">
            ${cleanInlineFormattedText(node.content || '')}
          </h3>
        `);
        break;

      case 'SUBHEADING':
        renderedElements.push(`
          <p style="font-size: 13px; font-weight: bold; margin: 10px 0 4px 0; color: #0f172a;">
            ${cleanInlineFormattedText(node.content || '')}
          </p>
        `);
        break;

      case 'KEY_VALUE':
        if (node.keyValues && node.keyValues.length > 0) {
          const rows = node.keyValues.map(kv => {
            const isTotal = /hotel accommodation total|land part total|final total|total package/i.test(kv.key);
            return `
              <p style="margin: 0 0 4px 0; font-size: ${isTotal ? '13.5px' : '13px'}; line-height: 1.5; color: #1e293b;">
                <strong>${cleanInlineFormattedText(kv.key)}:</strong> ${cleanInlineFormattedText(kv.value)}
              </p>
            `;
          }).join('');
          renderedElements.push(`<div style="margin: 6px 0 10px 0;">${rows}</div>`);
        }
        break;

      case 'BULLET_LIST':
        if (node.items && node.items.length > 0) {
          renderedElements.push(`
            <ul style="margin: 4px 0 10px 0; padding-left: 20px; list-style-type: disc;">
              ${node.items.map(item => `
                <li style="margin-bottom: 3px; font-size: 13px; line-height: 1.5; color: #334155;">
                  ${cleanInlineFormattedText(item)}
                </li>
              `).join('')}
            </ul>
          `);
        }
        break;

      case 'NUMBERED_LIST':
        if (node.items && node.items.length > 0) {
          renderedElements.push(`
            <ol style="margin: 4px 0 10px 0; padding-left: 20px;">
              ${node.items.map(item => `
                <li style="margin-bottom: 3px; font-size: 13px; line-height: 1.5; color: #334155;">
                  ${cleanInlineFormattedText(item)}
                </li>
              `).join('')}
            </ol>
          `);
        }
        break;

      case 'PARAGRAPH':
        renderedElements.push(`
          <p style="margin: 0 0 8px 0; font-size: 13px; line-height: 1.55; color: #334155;">
            ${cleanInlineFormattedText(node.content || '')}
          </p>
        `);
        break;

      case 'COMPACT_DIVIDER':
        renderedElements.push(`
          <div style="width: 36px; height: 1.5px; background-color: #cbd5e1; margin: 14px 0 12px 0;"></div>
        `);
        break;
    }
  }

  // Wrap in a simple, clean, non-designed white container
  return `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 13px; line-height: 1.6; color: #1e293b; max-width: 680px; margin: 0 auto; padding: 24px 20px; background-color: #ffffff;">
      ${renderedElements.join('')}
    </div>
  `.trim();
}

// Dedicated alias for simple semantic HTML
export const formatPlainTextQuotationToSimpleSemanticHtml = formatPlainTextQuotationToHtml;

/**
 * Generates Option 2 (Complete Plain-Text Quotation) directly from QuotePresentationModel.
 * Produces clean minimal semantic HTML (bold headings, lists, paragraphs) without designed layouts,
 * alongside a clean plain-text body for MIME text/plain delivery.
 * Strictly guarantees confidentiality: only final consolidated total package price.
 */
export function renderSimpleSemanticQuotationEmailFromModel(
  model: QuotePresentationModel,
  customNote?: string
): { htmlBody: string; textBody: string } {
  const lines: string[] = [];

  // Main Title
  const titleBrand = model.isWhiteLabel ? model.agencyName.toUpperCase() : 'THEUNBOUND';
  lines.push(`${titleBrand} — COMPLETE TRAVEL QUOTATION`);
  lines.push('');
  lines.push(`Destination: ${model.destination}`);
  lines.push(`Travel Dates: ${model.dateSpanText || 'As specified in the quotation'}`);
  lines.push(`Passengers: ${model.paxDetailsText}`);
  lines.push(`Quote Reference: ${model.quoteNumber} (v${model.version})`);
  lines.push(`Prepared By: ${model.agentName} (${model.agencyName})`);
  if (model.agentEmail) lines.push(`Contact Email: ${model.agentEmail}`);
  if (model.agentPhone) lines.push(`Contact Phone: ${model.agentPhone}`);
  if (model.agencyWebsite) lines.push(`Website: ${model.agencyWebsite}`);
  if (!model.isWhiteLabel) {
    lines.push(`Registered Address: ${model.agencyRegisteredAddress || THEUNBOUND_REGISTERED_ADDRESS}`);
    lines.push(`Current Address: ${model.agencyCurrentAddress || THEUNBOUND_CURRENT_ADDRESS.replace(/\n/g, ', ')}`);
  } else if (model.agencyAddress) {
    lines.push(`Address: ${model.agencyAddress}`);
  }
  lines.push('');

  if (customNote && customNote.trim()) {
    lines.push(`Note from ${model.agentName}:`);
    lines.push(convertHtmlToCleanPlainText(customNote.trim()));
    lines.push('');
  }

  // Trip Overview
  lines.push(`TRIP OVERVIEW`);
  lines.push(`Bespoke ground travel proposal for ${model.destination} curated for ${model.clientName} (${model.totalDays} Days / ${model.totalNights} Nights).`);
  lines.push('');

  // Day-wise Itinerary
  model.days.forEach(day => {
    lines.push(`DAY ${day.dayNumber} — ${day.hubName.toUpperCase()} (${day.dayOfWeek}, ${day.formattedDate})`);
    if (day.dayOverview) {
      lines.push(convertHtmlToCleanPlainText(day.dayOverview));
    }
    if (day.services.length > 0) {
      lines.push('');
      lines.push(`Activities and Highlights`);
      day.services.forEach(s => {
        lines.push(`• ${s.listingName} (${s.categoryLabel}${s.duration ? ` • ${s.duration}` : ''})`);
        if (s.overview) {
          lines.push(`  ${convertHtmlToCleanPlainText(s.overview)}`);
        }
        if (s.isRail && s.railDetails) {
          lines.push(`  Bullet Train: ${s.railDetails.origin} → ${s.railDetails.destination} (${s.railDetails.carType}, ${s.railDetails.seatType})`);
        }
      });
    } else {
      lines.push(`• Day at Leisure in ${day.hubName} (Self-Paced)`);
    }

    lines.push(`Accommodation`);
    lines.push(`Overnight: ${day.hubName} Hub`);
    if (day.dayNotes) {
      lines.push(`Note: ${convertHtmlToCleanPlainText(day.dayNotes)}`);
    }
    lines.push('');
  });

  // Accommodation Summary
  if (model.accommodations && model.accommodations.length > 0) {
    lines.push(`ACCOMMODATION & HOTEL STAYS`);
    model.accommodations.forEach(acc => {
      lines.push(`• ${acc.hotelName} (${acc.city}) — ${acc.nights} ${acc.nights === 1 ? 'Night' : 'Nights'}${acc.roomSummary ? ` [${acc.roomSummary}]` : ''}`);
    });
    lines.push('');
  }

  // Visa & Ancillary Services
  if (model.visaServices && model.visaServices.length > 0) {
    lines.push(`VISA & ANCILLARY SERVICES`);
    model.visaServices.forEach(v => {
      lines.push(`• ${v.listingName} (${v.categoryLabel}) — Included for ${v.paxText}`);
      if (v.overview) {
        lines.push(`  ${convertHtmlToCleanPlainText(v.overview)}`);
      }
    });
    lines.push('');
  }

  // Inclusions & Exclusions
  lines.push(`WHAT'S INCLUDED`);
  model.operationalStandards.forEach(op => {
    lines.push(`• ${op.title}: ${op.desc}`);
  });
  lines.push('');

  lines.push(`WHAT'S EXCLUDED`);
  lines.push(`• International airfare unless expressly stated`);
  lines.push(`• Personal gratuities, laundry, and hotel incidentals`);
  lines.push(`• Direct gate tickets subject to on-site guest age policies`);
  lines.push('');

  // Total Package Investment
  lines.push(`TOTAL PACKAGE INVESTMENT`);
  if (model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted) {
    lines.push(`Hotel Accommodation Total: ${model.hotelAccommodationTotalFormatted}`);
  }
  lines.push(`Land Part Total: ${model.landPartTotalFormatted}`);
  if (model.appliedPromotion) {
    lines.push(`Promotional Discount (${model.appliedPromotion.code}): -${model.appliedPromotion.discountAmountFormatted} (${model.appliedPromotion.promotionName})`);
  }
  lines.push(`Final Selling Price: ${model.finalCustomerSellingPriceFormatted}`);
  lines.push(`Currency Guarantee: ${model.guaranteedCurrencyLine}`);
  lines.push(`Quotation Validity: Valid until ${model.validUntilFormatted}`);
  lines.push('');

  // Important Information
  lines.push(`IMPORTANT INFORMATION`);
  model.childAndAttractionPolicies.forEach(p => {
    lines.push(`• ${p}`);
  });
  lines.push('');

  // Commercial Quotation Terms
  lines.push((model.commercialTermsHeading || 'Commercial Quotation Terms').toUpperCase());
  lines.push(model.commercialTerms);
  lines.push('');
  lines.push(convertHtmlToCleanPlainText(model.footerContactLine));

  const textBody = lines.join('\n');
  const htmlBody = formatPlainTextQuotationToHtml(textBody);

  return { htmlBody, textBody };
}

// ============================================================================
// OPTION 2: COMPLETE FORMATTED QUOTATION (EXCEL-STYLE SPREADSHEET HTML)
// ============================================================================

const EXCEL_FONT = 'Arial, Helvetica, sans-serif';
const EXCEL_NAVY = '#17365D';
const EXCEL_HEADER_TEXT = '#FFFFFF';
const EXCEL_BLUE_ROW = '#D9E2F3';
const EXCEL_WHITE_ROW = '#FFFFFF';
const EXCEL_BORDER = '#404040';
const EXCEL_TEXT_PRIMARY = '#222222';
const EXCEL_TEXT_SECONDARY = '#555555';
const EXCEL_BRAND_TEAL = '#00C6A6';

/**
 * Formats rich-text / HTML / Markdown into compact, email-client-safe HTML for spreadsheet table cells.
 * Zero literal HTML tags, preserves paragraphs, numbered lists, bullets, and bold headings.
 */
function renderSpreadsheetRichText(
  content?: string | null,
  options?: { fontSize?: string; color?: string; strongColor?: string }
): string {
  if (!content || typeof content !== 'string') return '';
  const fontSize = options?.fontSize || '11px';
  const color = options?.color || EXCEL_TEXT_PRIMARY;
  const strongColor = options?.strongColor || EXCEL_TEXT_PRIMARY;
  return renderRichTextForEmail(content, {
    fontSize,
    lineHeight: '1.42',
    color,
    darkHeadingColor: strongColor
  });
}

function classifyServiceTypeLabel(s: ServicePresentationItem): string {
  const cat = (s.categoryLabel || s.category || '').toLowerCase();
  const name = (s.listingName || '').toLowerCase();
  if (s.isRail || cat.includes('rail') || cat.includes('shinkansen') || cat.includes('train')) {
    return 'Rail';
  }
  if (cat.includes('charter') || name.includes('charter')) {
    return 'Private Charter';
  }
  if (cat.includes('transfer') || cat.includes('transport')) {
    if (name.includes('airport') || name.includes('narita') || name.includes('haneda') || name.includes('kansai')) {
      return 'Airport Transfer';
    }
    if (name.includes('intercity')) {
      return 'Intercity Transfer';
    }
    return 'Private Transfer';
  }
  if (cat.includes('visa') || cat.includes('insurance') || cat.includes('connectivity') || cat.includes('vip')) {
    return 'Visa / Ancillary';
  }
  if (cat.includes('guide')) {
    return 'Guide';
  }
  if (cat.includes('yacht')) {
    return 'Private Yacht';
  }
  if (cat.includes('ferry') || cat.includes('ferries')) {
    return 'Ferry';
  }
  if (cat.includes('restaurant') || cat.includes('dining') || cat.includes('meal')) {
    return 'Restaurant / Dining';
  }
  if (cat.includes('ticket')) {
    return 'Ticket / Pass';
  }
  if (cat.includes('group tour')) {
    return 'Group Tour';
  }
  if (cat.includes('tour') || cat.includes('sightseeing') || cat.includes('experience') || cat.includes('activity')) {
    return 'Tour / Activity';
  }
  return s.categoryLabel || s.category || 'Service';
}

function isHotelPresentationService(s: ServicePresentationItem): boolean {
  const cat = (s.categoryLabel || s.category || '').toLowerCase();
  const pType = String(s.rawItem?.product?.productType || '').toLowerCase();
  const sType = String((s.rawItem as any)?.service_type || '').toLowerCase();
  return (
    cat === 'hotels' ||
    cat === 'accommodation' ||
    cat === 'luxury accommodation' ||
    pType === 'hotel' ||
    sType === 'hotel' ||
    Boolean(s.rawItem?.isManualHotel || s.rawItem?.hotelId) ||
    String(s.id || '').startsWith('synth-hotel-')
  );
}

function resolveServiceUnitText(s: ServicePresentationItem): string {
  const raw: any = s.rawItem || {};
  const vehiclesAllocated = raw?.calculation?.vehicleDetails?.vehiclesAllocated;
  if (typeof vehiclesAllocated === 'number' && vehiclesAllocated > 0) {
    return `${vehiclesAllocated} ${vehiclesAllocated === 1 ? 'Vehicle' : 'Vehicles'}`;
  }
  const qty = Number(raw?.quantity);
  if (Number.isFinite(qty) && qty > 0 && qty !== 1) {
    return `${qty} Units`;
  }
  if (s.paxText) {
    return s.paxText;
  }
  return '1 Unit';
}

function buildOption2ServiceDetailsHtml(s: ServicePresentationItem, dateLabel: string): string {
  const raw: any = s.rawItem || {};
  const prod: any = raw.product || {};
  const configSnap: any = raw.configuration_snapshot || raw.metadata?.configuration_payload || {};
  const selOpts: any = raw.selected_options || {};
  const vehicleCalc: any = raw.calculation?.vehicleDetails || {};

  const parts: string[] = [];
  const lowerCat = (s.categoryLabel || s.category || '').toLowerCase();
  const isTransfer = lowerCat.includes('transfer') || lowerCat.includes('transport') || lowerCat.includes('charter') || (s.listingName || '').toLowerCase().includes('charter');
  const isCharter = lowerCat.includes('charter') || (s.listingName || '').toLowerCase().includes('charter');

  // Primary bold listing title
  parts.push(
    `<div style="font-family: ${EXCEL_FONT}; font-size: 11.5px; font-weight: bold; color: ${EXCEL_TEXT_PRIMARY}; margin: 0 0 4px 0;">${cleanInlineFormattedText(s.listingName)}</div>`
  );

  // Meta badges line (plain text, zero rounded pill CSS)
  const metaItems: string[] = [];
  if (s.categoryLabel) metaItems.push(`<strong>Category:</strong> ${cleanInlineFormattedText(s.categoryLabel)}`);
  if (s.duration) metaItems.push(`<strong>${isCharter ? 'Charter Duration' : 'Duration'}:</strong> ${cleanInlineFormattedText(s.duration)}`);
  const reportingTime = s.serviceTime || raw.metadata?.reportingTime || selOpts.reportingTime || prod.guideConfig?.reportingTime || prod.reportingTime;
  if (reportingTime) metaItems.push(`<strong>Reporting / Time:</strong> ${cleanInlineFormattedText(String(reportingTime))}`);
  if (dateLabel) metaItems.push(`<strong>Service Date:</strong> ${cleanInlineFormattedText(dateLabel)}`);
  if (metaItems.length > 0) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY}; margin: 0 0 4px 0; line-height: 1.4;">${metaItems.join(' &nbsp;|&nbsp; ')}</div>`
    );
  }

  // Rail details
  if (s.isRail && s.railDetails) {
    const rd = s.railDetails;
    const rawRail: any = raw.railJourneyDetails || {};
    const railLines: string[] = [
      `<strong>Stations:</strong> ${cleanInlineFormattedText(rd.origin)} &rarr; ${cleanInlineFormattedText(rd.destination)}`,
      `<strong>Train / Service:</strong> ${cleanInlineFormattedText(rd.serviceGroup)}${rawRail.trainNumber ? ` (#${cleanInlineFormattedText(String(rawRail.trainNumber))})` : ''}`,
      `<strong>Class &amp; Seat:</strong> ${cleanInlineFormattedText(rd.carType)} (${cleanInlineFormattedText(rd.seatType)})${rd.seatPreference ? ` &bull; ${cleanInlineFormattedText(rd.seatPreference)}` : ''}`,
      `<strong>Travel Date &amp; Pax:</strong> ${cleanInlineFormattedText(dateLabel)} &bull; ${cleanInlineFormattedText(s.paxText)}`
    ];
    if (rd.pnrReference) {
      railLines.push(`<strong>PNR / Reference:</strong> ${cleanInlineFormattedText(rd.pnrReference)}`);
    }
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 11px; color: ${EXCEL_TEXT_PRIMARY}; margin: 4px 0; padding: 4px 6px; border-left: 3px solid ${EXCEL_NAVY}; background-color: ${EXCEL_WHITE_ROW}; line-height: 1.45;">${railLines.join('<br/>')}</div>`
    );
  }

  // Vehicle & Transfer / Charter capacity & route specifications
  const vehicleModel =
    vehicleCalc.vehicleModel ||
    vehicleCalc.vehicleName ||
    raw.vehicleNameSnapshot ||
    configSnap.vehicleName ||
    raw.vehicleConfig?.vehicleModel ||
    raw.vehicleConfig?.vehicleName ||
    prod.vehicleConfig?.vehicleModel ||
    prod.vehicleConfig?.vehicleName ||
    prod.vehicleNameSnapshot ||
    raw.vehicleType;
  const vehicleCategory =
    vehicleCalc.vehicleType ||
    raw.vehicleTypeSnapshot ||
    prod.vehicleTypeSnapshot ||
    prod.vehicleConfig?.vehicleType ||
    raw.vehicleConfig?.vehicleType;
  const paxCapacity =
    vehicleCalc.maxSeats ||
    raw.vehicleCapacitySnapshot ||
    configSnap.vehicleCapacity ||
    configSnap.masterCapacity ||
    prod.vehicleConfig?.maxSeats ||
    prod.vehicleConfig?.passengerCapacity ||
    prod.capacitySnapshot ||
    (prod.maxPax ? `${prod.minPax || 1}-${prod.maxPax}` : undefined);
  const luggageCapacity =
    raw.metadata?.luggageCapacity ||
    raw.luggageAllowanceBags ||
    raw.vehicleConfig?.luggageCapacity ||
    prod.vehicleConfig?.luggageCapacity ||
    prod.luggageAllowanceBags;

  const transferLines: string[] = [];
  if (vehicleModel || vehicleCategory) {
    const vText = [
      vehicleCategory ? cleanInlineFormattedText(String(vehicleCategory)) : '',
      vehicleModel && String(vehicleModel).toLowerCase() !== String(vehicleCategory || '').toLowerCase()
        ? cleanInlineFormattedText(String(vehicleModel))
        : ''
    ].filter(Boolean).join(' — ');
    if (vText) transferLines.push(`<strong>Vehicle:</strong> ${vText}`);
  }
  if (paxCapacity || luggageCapacity) {
    const capBits: string[] = [];
    if (paxCapacity) capBits.push(`Up to ${cleanInlineFormattedText(String(paxCapacity))} Passengers`);
    if (luggageCapacity) capBits.push(`${cleanInlineFormattedText(String(luggageCapacity))} Standard Suitcases`);
    transferLines.push(`<strong>Capacity:</strong> ${capBits.join(' &bull; ')}`);
  }

  const pickupLoc = s.pickupPoint || selOpts.pickupLocation || prod.pickupPoint || prod.pickupInformation;
  const dropoffLoc = s.dropoffPoint || selOpts.dropoffLocation || prod.dropoffPoint || prod.dropoffLocation;
  const meetingLoc = s.meetingPoint || raw.metadata?.reportingLocation || selOpts.reportingLocation;
  if (pickupLoc) transferLines.push(`<strong>Pickup Location:</strong> ${cleanInlineFormattedText(String(pickupLoc))}`);
  if (dropoffLoc) transferLines.push(`<strong>Drop-off Location:</strong> ${cleanInlineFormattedText(String(dropoffLoc))}`);
  if (meetingLoc && String(meetingLoc) !== String(pickupLoc || '')) {
    transferLines.push(`<strong>Meeting / Reporting Point:</strong> ${cleanInlineFormattedText(String(meetingLoc))}`);
  }

  const routeSequence = raw.metadata?.routeSequence || selOpts.routeSequence || (isCharter && prod.location ? prod.location : '');
  if (routeSequence) {
    transferLines.push(`<strong>Route / Sequence:</strong> ${cleanInlineFormattedText(String(routeSequence))}`);
  }

  if (transferLines.length > 0) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_PRIMARY}; margin: 3px 0 4px 0; line-height: 1.45;">${transferLines.join('<br/>')}</div>`
    );
  } else if (s.configurationSummary && !s.isRail && !isTransfer) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_PRIMARY}; margin: 2px 0 4px 0; line-height: 1.4;"><strong>Configuration:</strong> ${cleanInlineFormattedText(s.configurationSummary)}</div>`
    );
  } else if (s.configurationSummary && isTransfer) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_PRIMARY}; margin: 2px 0 4px 0; line-height: 1.4;"><strong>Specs:</strong> ${cleanInlineFormattedText(s.configurationSummary)}</div>`
    );
  }

  // Ticket / Pass tier & requirements
  const ticketTier = selOpts.ticketTierName || configSnap.ticketTierName || configSnap.tierName || raw.metadata?.ticketRequirements;
  if (ticketTier) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_PRIMARY}; margin: 2px 0 4px 0;"><strong>Ticket / Tier Requirements:</strong> ${cleanInlineFormattedText(String(ticketTier))}</div>`
    );
  }

  // Overview / Full Service & Attraction Descriptions
  if (s.overview && s.overview.trim()) {
    const renderedOverview = renderSpreadsheetRichText(s.overview, {
      fontSize: '11px',
      color: EXCEL_TEXT_PRIMARY,
      strongColor: EXCEL_NAVY
    });
    if (renderedOverview) {
      parts.push(
        `<div style="margin: 4px 0;">${renderedOverview}</div>`
      );
    }
  }

  // Inclusions
  if (s.inclusions && s.inclusions.length > 0) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_PRIMARY}; margin: 4px 0; line-height: 1.4;"><strong>Inclusions:</strong><ul style="margin: 2px 0 2px 0; padding-left: 16px; list-style-type: disc;">${s.inclusions.map(inc => `<li style="margin-bottom: 1px;">${cleanInlineFormattedText(inc)}</li>`).join('')}</ul></div>`
    );
  }

  // Exclusions
  if (s.exclusions && s.exclusions.length > 0) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY}; margin: 4px 0; line-height: 1.4;"><strong style="color: ${EXCEL_TEXT_PRIMARY};">Exclusions:</strong><ul style="margin: 2px 0 2px 0; padding-left: 16px; list-style-type: disc;">${s.exclusions.map(exc => `<li style="margin-bottom: 1px;">${cleanInlineFormattedText(exc)}</li>`).join('')}</ul></div>`
    );
  }

  // Product important information & operational instructions
  const importantNotes: string[] = Array.isArray(prod.importantInformation)
    ? prod.importantInformation.filter((n: any) => typeof n === 'string' && n.trim())
    : (typeof prod.importantInformation === 'string' && prod.importantInformation.trim() ? [prod.importantInformation.trim()] : []);
  if (importantNotes.length > 0) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY}; margin: 4px 0; line-height: 1.4;"><strong style="color: ${EXCEL_TEXT_PRIMARY};">Important Notes / Ticket Rules:</strong> ${importantNotes.map(n => cleanInlineFormattedText(n)).join(' &bull; ')}</div>`
    );
  }

  if (s.specialInstructions && s.specialInstructions.trim()) {
    parts.push(
      `<div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_PRIMARY}; margin: 4px 0 0 0; line-height: 1.4;"><strong>Operational Instructions:</strong> ${renderSpreadsheetRichText(s.specialInstructions, { fontSize: '10.5px', color: EXCEL_TEXT_PRIMARY })}</div>`
    );
  }

  return parts.join('');
}

export interface Option2PricingValidationResult {
  isValid: boolean;
  missingFields: Array<'Land Part Total' | 'Hotel Part Total' | 'Quotation Currency'>;
  landPartDisplay?: string;
  hotelPartDisplay?: string;
  errorMessage?: string;
}

/**
 * Validates that Option 2's Quotation Pricing Summary has authoritative, verified
 * Land Part Total and Hotel Part Total values in a valid quotation currency.
 * Never invents numbers or substitutes zero unless confirmed genuinely zero by
 * the authoritative pricing engine / committed quotation snapshot.
 */
export function validateOption2PricingSummary(
  model: QuotePresentationModel
): Option2PricingValidationResult {
  const missingFields: Array<'Land Part Total' | 'Hotel Part Total' | 'Quotation Currency'> = [];

  const currency = typeof model?.currency === 'string' ? model.currency.trim() : '';
  if (!currency) {
    missingFields.push('Quotation Currency');
  }

  const landTotalValid =
    model?.isLandPartTotalAuthoritative !== false &&
    typeof model?.landPartTotalNumeric === 'number' &&
    Number.isFinite(model.landPartTotalNumeric) &&
    model.landPartTotalNumeric >= 0;

  if (!landTotalValid) {
    missingFields.push('Land Part Total');
  }

  const hotelTotalValid =
    model?.isHotelPartTotalAuthoritative !== false &&
    typeof model?.hotelAccommodationTotalNumeric === 'number' &&
    Number.isFinite(model.hotelAccommodationTotalNumeric) &&
    model.hotelAccommodationTotalNumeric >= 0;

  if (!hotelTotalValid) {
    missingFields.push('Hotel Part Total');
  }

  if (missingFields.length > 0) {
    return {
      isValid: false,
      missingFields,
      landPartDisplay: landTotalValid && currency
        ? (model.landPartTotalFormatted || formatCurrency(model.landPartTotalNumeric, currency))
        : undefined,
      hotelPartDisplay: hotelTotalValid && currency
        ? (model.hotelPartTotalFormatted || formatCurrency(model.hotelAccommodationTotalNumeric, currency))
        : undefined,
      errorMessage: `Cannot dispatch Option 2 Complete Formatted Quotation: authoritative pricing total unavailable for ${missingFields.join(', ')}. Please verify pricing and save the quotation snapshot before sending.`
    };
  }

  const landPartDisplay =
    model.landPartTotalFormatted && model.landPartTotalFormatted.trim()
      ? model.landPartTotalFormatted
      : formatCurrency(model.landPartTotalNumeric, currency);

  const hotelPartDisplay =
    model.hotelPartTotalFormatted && model.hotelPartTotalFormatted.trim()
      ? model.hotelPartTotalFormatted
      : formatCurrency(model.hotelAccommodationTotalNumeric, currency);

  return {
    isValid: true,
    missingFields: [],
    landPartDisplay,
    hotelPartDisplay
  };
}

/**
 * Parses HTML attributes from a tag's attribute string safely without regex ReDoS.
 */
function parseHtmlTagAttributes(attrString: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  if (!attrString) return attrs;
  const attrRegex = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = attrRegex.exec(attrString)) !== null) {
    const name = match[1].toLowerCase();
    // Strictly drop all event handlers and dangerous execution attributes
    if (name.startsWith('on') || name === 'srcdoc' || name === 'formaction') continue;
    const value = match[2] ?? match[3] ?? match[4] ?? '';
    attrs[name] = value;
  }
  return attrs;
}

/**
 * Validates that a hyperlink href uses only safe, email-compatible URL schemes.
 * Blocks javascript:, data:, vbscript:, and obfuscated control-char variants.
 */
function sanitizeSafeEmailHref(rawHref: string | undefined): string | null {
  if (!rawHref) return null;
  const decoded = rawHref
    .replace(/&amp;/gi, '&')
    .replace(/&#(\d+);/g, (_m, c) => String.fromCharCode(parseInt(c, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/[\u0000-\u001F\u007F\s]+/g, '')
    .trim();

  if (!decoded) return null;
  if (/^(?:https?:\/\/|mailto:|tel:|#)/i.test(decoded)) {
    return rawHref.trim();
  }
  return null;
}

/**
 * Parses and allowlists safe CSS declarations from an inline style string.
 * Rejects any CSS injection vectors (url, expression, javascript, data, behavior).
 */
function parseSafeInlineCssMap(rawStyle: string | undefined): Record<string, string> {
  const safeMap: Record<string, string> = {};
  if (!rawStyle) return safeMap;

  const declarations = rawStyle.split(';');
  const SAFE_SPACING_RE = /^(?:0|-?[0-9.]+(?:px|pt|em|rem|%)|auto)(?:\s+(?:0|-?[0-9.]+(?:px|pt|em|rem|%)|auto)){0,3}$/i;
  const SAFE_COLOR_RE = /^(?:#[0-9a-f]{3,8}|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*[0-9.]+\s*\)|[a-z]{3,20})$/i;

  for (const decl of declarations) {
    const colonIdx = decl.indexOf(':');
    if (colonIdx <= 0) continue;
    const prop = decl.slice(0, colonIdx).trim().toLowerCase();
    const val = decl.slice(colonIdx + 1).trim();
    if (!prop || !val) continue;

    // Block dangerous CSS constructs unconditionally
    if (/url\s*\(|expression\s*\(|javascript:|vbscript:|data:|behavior|-moz-binding|@import|[<>"]/i.test(val)) {
      continue;
    }

    if (prop === 'text-align' && /^(left|right|center|justify)$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if (prop === 'vertical-align' && /^(top|middle|bottom|baseline)$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if ((prop === 'color' || prop === 'background-color' || prop === 'border-color') && SAFE_COLOR_RE.test(val)) {
      safeMap[prop] = val;
    } else if (prop === 'font-weight' && /^(normal|bold|bolder|lighter|[1-9]00)$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if (prop === 'font-style' && /^(normal|italic|oblique)$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if (prop === 'text-decoration' && /^(?:none|underline|line-through|overline)(?:\s+(?:underline|line-through|overline))*$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if (prop === 'font-size' && /^[0-9.]+(?:px|pt|em|rem|%)$/i.test(val)) {
      safeMap[prop] = val;
    } else if (prop === 'line-height' && /^(?:normal|[0-9.]+(?:px|pt|em|rem|%)?)$/i.test(val)) {
      safeMap[prop] = val;
    } else if (
      (prop === 'margin' || prop === 'margin-top' || prop === 'margin-bottom' || prop === 'margin-left' || prop === 'margin-right' ||
       prop === 'padding' || prop === 'padding-top' || prop === 'padding-bottom' || prop === 'padding-left' || prop === 'padding-right' ||
       prop === 'text-indent') &&
      SAFE_SPACING_RE.test(val)
    ) {
      safeMap[prop] = val;
    } else if (
      prop === 'list-style-type' &&
      /^(disc|circle|square|decimal|decimal-leading-zero|lower-alpha|upper-alpha|lower-latin|upper-latin|lower-roman|upper-roman|none)$/i.test(val)
    ) {
      safeMap[prop] = val.toLowerCase();
    } else if (prop === 'list-style-position' && /^(inside|outside)$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if (
      (prop === 'border' || prop === 'border-top' || prop === 'border-bottom' || prop === 'border-left' || prop === 'border-right') &&
      /^(?:none|0|[0-9.]+(?:px|pt)\s+(?:solid|dashed|dotted|double)\s+(?:#[0-9a-f]{3,8}|rgb\([^)]+\)|[a-z]{3,20}))$/i.test(val)
    ) {
      safeMap[prop] = val;
    } else if (prop === 'border-collapse' && /^(collapse|separate)$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if (prop === 'width' && /^[0-9.]+(?:px|pt|em|rem|%)$/i.test(val)) {
      safeMap[prop] = val;
    } else if (prop === 'white-space' && /^(normal|pre-wrap|pre-line|nowrap)$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if (prop === 'text-transform' && /^(none|uppercase|lowercase|capitalize)$/i.test(val)) {
      safeMap[prop] = val.toLowerCase();
    } else if (prop === 'letter-spacing' && /^(?:normal|-?[0-9.]+(?:px|em|rem))$/i.test(val)) {
      safeMap[prop] = val;
    }
  }

  return safeMap;
}

function serializeCssMap(cssMap: Record<string, string>): string {
  return Object.entries(cssMap)
    .filter(([, v]) => Boolean(v && v.trim()))
    .map(([k, v]) => `${k}: ${v.trim()}`)
    .join('; ');
}

function escapeHtmlAttrValue(val: string): string {
  return val
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Converts plain-text / Markdown Commercial Terms (when no HTML tags exist)
 * into clean semantic HTML preserving headings, numbered clauses, bullets,
 * nested indentation, paragraph breaks, bold/italic, and safe hyperlinks.
 */
function convertPlainTextCommercialTermsToSemanticHtml(plainText: string): string {
  const lines = plainText.split(/\r?\n/);
  const blocks: string[] = [];

  type ListState = { type: 'ul' | 'ol'; start?: number; items: Array<{ html: string; indentLevel: number }> };
  let activeList: ListState | null = null;
  let paragraphLines: string[] = [];

  const formatInline = (raw: string): string => {
    const escaped = escapeHtml(raw);
    return escaped
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
        const safe = sanitizeSafeEmailHref(url);
        return safe ? `<a href="${escapeHtmlAttrValue(safe)}">${label}</a>` : label;
      })
      .replace(/~~([^~]+)~~/g, '<del>$1</del>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/__([^_]+)__/g, '<strong>$1</strong>')
      .replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, '<em>$1</em>');
  };

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    const html = paragraphLines.map(formatInline).join('<br/>');
    if (html.trim()) {
      blocks.push(`<p>${html}</p>`);
    }
    paragraphLines = [];
  };

  const flushList = () => {
    if (!activeList || activeList.items.length === 0) {
      activeList = null;
      return;
    }
    const startAttr = activeList.type === 'ol' && activeList.start && activeList.start > 1
      ? ` start="${activeList.start}"`
      : '';
    const itemsHtml = activeList.items
      .map((item) => {
        const indentStyle = item.indentLevel > 0 ? ` style="margin-left: ${item.indentLevel * 20}px;"` : '';
        return `<li${indentStyle}>${item.html}</li>`;
      })
      .join('');
    blocks.push(`<${activeList.type}${startAttr}>${itemsHtml}</${activeList.type}>`);
    activeList = null;
  };

  for (const rawLine of lines) {
    const leadingSpaces = (rawLine.match(/^(\s*)/)?.[1] || '').replace(/\t/g, '  ').length;
    const indentLevel = Math.min(4, Math.floor(leadingSpaces / 2));
    const trimmed = rawLine.trim();

    if (!trimmed) {
      flushParagraph();
      flushList();
      continue;
    }

    if (/^(?:---|\*\*\*|___)$/.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push('<hr/>');
      continue;
    }

    const hMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (hMatch) {
      flushParagraph();
      flushList();
      const level = hMatch[1].length;
      blocks.push(`<h${level}>${formatInline(hMatch[2])}</h${level}>`);
      continue;
    }

    const bqMatch = trimmed.match(/^>\s+(.+)$/);
    if (bqMatch) {
      flushParagraph();
      flushList();
      blocks.push(`<blockquote><p>${formatInline(bqMatch[1])}</p></blockquote>`);
      continue;
    }

    const bulletMatch = trimmed.match(/^[-*•▪●◦]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!activeList || activeList.type !== 'ul') {
        flushList();
        activeList = { type: 'ul', items: [] };
      }
      activeList.items.push({ html: formatInline(bulletMatch[1]), indentLevel });
      continue;
    }

    const orderedMatch = trimmed.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      const num = parseInt(orderedMatch[1], 10);
      if (!activeList || activeList.type !== 'ol') {
        flushList();
        activeList = { type: 'ol', start: isNaN(num) ? 1 : num, items: [] };
      }
      activeList.items.push({ html: formatInline(orderedMatch[2]), indentLevel });
      continue;
    }

    flushList();
    paragraphLines.push(trimmed);
  }

  flushParagraph();
  flushList();

  return blocks.join('');
}

/**
 * Renders Commercial Quotation Terms for Option 2 (Complete Formatted Quotation)
 * preserving original rich-text structure and formatting verbatim with
 * email-client-compatible inline CSS (Gmail, Google Workspace, Outlook, and
 * Tailwind-preflight-safe preview).
 *
 * Preserves: headings (h1-h6), bold, italic, underline, strikethrough, sub/sup,
 * inline span/font styles, numbered lists (ol with start/type), bullet lists (ul
 * including nesting), paragraph breaks, line spacing, indentation (padding/margin/
 * ql-indent/blockquote), tables (colspan/rowspan/align/borders), hyperlinks (safe
 * URL allowlist only), and text alignment.
 */
export function renderCommercialTermsRichHtmlForEmail(
  content: string,
  options?: {
    fontFamily?: string;
    fontSize?: string;
    lineHeight?: string;
    color?: string;
    headingColor?: string;
    borderColor?: string;
    linkColor?: string;
  }
): string {
  if (!content || typeof content !== 'string') return '';
  const normalized = normalizeStoredContent(content);
  if (!normalized) return '';

  const fontFamily = options?.fontFamily || EXCEL_FONT;
  const fontSize = options?.fontSize || '11px';
  const lineHeight = options?.lineHeight || '1.5';
  const color = options?.color || EXCEL_TEXT_PRIMARY;
  const headingColor = options?.headingColor || EXCEL_NAVY;
  const borderColor = options?.borderColor || EXCEL_BORDER;
  const linkColor = options?.linkColor || EXCEL_NAVY;

  const hasHtml = /<\/?(?:p|br|div|h[1-6]|strong|b|em|i|u|s|del|strike|sub|sup|ul|ol|li|table|thead|tbody|tfoot|tr|td|th|span|a|blockquote|hr|font)\b/i.test(normalized);

  let sourceHtml = hasHtml
    ? normalized
    : convertPlainTextCommercialTermsToSemanticHtml(normalized);

  // 1. Strip HTML comments and dangerous elements with their inner payloads
  sourceHtml = sourceHtml.replace(/<!--[\s\S]*?-->/g, '');
  const dangerousBlockTags = 'script|style|iframe|object|embed|form|input|textarea|select|button|svg|canvas|math|template|noscript';
  sourceHtml = sourceHtml.replace(
    new RegExp(`<(${dangerousBlockTags})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi'),
    ''
  );
  sourceHtml = sourceHtml.replace(
    new RegExp(`<\\/?(?:${dangerousBlockTags}|meta|link|base)\\b[^>]*\\/?>`, 'gi'),
    ''
  );

  // 2. Token-level HTML serializer preserving original structure + merging safe inline CSS
  const tagRegex = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)(\s+[^>]*?)?(\/?)>/g;
  const output: string[] = [];
  let lastIndex = 0;
  let ulDepth = 0;
  const anchorTagStack: Array<'a' | 'span'> = [];
  const headingFontSizes: Record<string, string> = {
    h1: '15px',
    h2: '13.5px',
    h3: '12px',
    h4: '11.5px',
    h5: '11px',
    h6: '10.5px'
  };
  const olTypeToCss: Record<string, string> = {
    '1': 'decimal',
    'a': 'lower-alpha',
    'A': 'upper-alpha',
    'i': 'lower-roman',
    'I': 'upper-roman'
  };
  const fontSizeAttrMap: Record<string, string> = {
    '1': '9px',
    '2': '10.5px',
    '3': '11px',
    '4': '12.5px',
    '5': '14px',
    '6': '16px',
    '7': '18px'
  };

  let match: RegExpExecArray | null;
  while ((match = tagRegex.exec(sourceHtml)) !== null) {
    // Preserve text node verbatim between tags (with **bold** support if legacy markdown leaked in)
    if (match.index > lastIndex) {
      const textChunk = sourceHtml.slice(lastIndex, match.index);
      output.push(textChunk);
    }
    lastIndex = tagRegex.lastIndex;

    const isClosing = match[1] === '/';
    const rawTag = match[2].toLowerCase();
    const rawAttrStr = match[3] || '';

    if (isClosing) {
      if (rawTag === 'ul') {
        ulDepth = Math.max(0, ulDepth - 1);
        output.push('</ul>');
      } else if (rawTag === 'ol') {
        output.push('</ol>');
      } else if (rawTag === 'b' || rawTag === 'strong') {
        output.push('</strong>');
      } else if (rawTag === 'i' || rawTag === 'em') {
        output.push('</em>');
      } else if (rawTag === 's' || rawTag === 'del' || rawTag === 'strike') {
        output.push('</del>');
      } else if (rawTag === 'font' || rawTag === 'span') {
        output.push('</span>');
      } else if (rawTag === 'a') {
        const closingAnchor = anchorTagStack.pop() || 'a';
        output.push(`</${closingAnchor}>`);
      } else if (
        rawTag === 'p' || rawTag === 'div' || rawTag === 'li' ||
        rawTag === 'h1' || rawTag === 'h2' || rawTag === 'h3' || rawTag === 'h4' || rawTag === 'h5' || rawTag === 'h6' ||
        rawTag === 'u' || rawTag === 'sub' || rawTag === 'sup' || rawTag === 'blockquote' ||
        rawTag === 'table' || rawTag === 'thead' || rawTag === 'tbody' || rawTag === 'tfoot' ||
        rawTag === 'tr' || rawTag === 'th' || rawTag === 'td'
      ) {
        output.push(`</${rawTag}>`);
      }
      continue;
    }

    // Opening or self-closing tag
    if (rawTag === 'br') {
      output.push('<br/>');
      continue;
    }
    if (rawTag === 'hr') {
      output.push(`<hr style="border: 0; border-top: 1px solid #cbd5e1; margin: 8px 0;" />`);
      continue;
    }

    const attrs = parseHtmlTagAttributes(rawAttrStr);
    const sourceCss = parseSafeInlineCssMap(attrs.style);

    // Map legacy HTML align / valign & editor classes (Quill / Tailwind) into inline CSS
    if (attrs.align && /^(left|center|right|justify)$/i.test(attrs.align) && !sourceCss['text-align']) {
      sourceCss['text-align'] = attrs.align.toLowerCase();
    }
    if (attrs.valign && /^(top|middle|bottom|baseline)$/i.test(attrs.valign) && !sourceCss['vertical-align']) {
      sourceCss['vertical-align'] = attrs.valign.toLowerCase();
    }
    if (attrs.class) {
      const cls = attrs.class;
      const alignClassMatch = cls.match(/\b(?:ql-align-|text-)(left|center|right|justify)\b/i);
      if (alignClassMatch && !sourceCss['text-align']) {
        sourceCss['text-align'] = alignClassMatch[1].toLowerCase();
      }
      const indentClassMatch = cls.match(/\bql-indent-([1-8])\b/i);
      if (indentClassMatch && !sourceCss['padding-left'] && !sourceCss['margin-left']) {
        sourceCss['margin-left'] = `${parseInt(indentClassMatch[1], 10) * 24}px`;
      }
    }

    if (rawTag === 'h1' || rawTag === 'h2' || rawTag === 'h3' || rawTag === 'h4' || rawTag === 'h5' || rawTag === 'h6') {
      const merged: Record<string, string> = {
        'margin': rawTag === 'h1' ? '10px 0 5px 0' : rawTag === 'h2' ? '9px 0 4px 0' : '7px 0 3px 0',
        'font-family': fontFamily,
        'font-size': headingFontSizes[rawTag],
        'font-weight': 'bold',
        'line-height': '1.35',
        'color': rawTag === 'h1' || rawTag === 'h2' || rawTag === 'h3' ? headingColor : color,
        ...sourceCss
      };
      output.push(`<${rawTag} style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'p') {
      const merged: Record<string, string> = {
        'margin': '0 0 7px 0',
        'font-family': fontFamily,
        'font-size': fontSize,
        'line-height': lineHeight,
        'color': color,
        ...sourceCss
      };
      output.push(`<p style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'div') {
      const merged: Record<string, string> = {
        'margin': '0 0 4px 0',
        'font-family': fontFamily,
        'font-size': fontSize,
        'line-height': lineHeight,
        'color': color,
        ...sourceCss
      };
      output.push(`<div style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'ul') {
      ulDepth += 1;
      const defaultBullet = ulDepth === 1 ? 'disc' : ulDepth === 2 ? 'circle' : 'square';
      const merged: Record<string, string> = {
        'margin': ulDepth === 1 ? '4px 0 8px 0' : '2px 0 4px 0',
        'padding-left': '22px',
        'list-style-type': defaultBullet,
        'list-style-position': 'outside',
        'font-family': fontFamily,
        'font-size': fontSize,
        'line-height': lineHeight,
        'color': color,
        ...sourceCss
      };
      output.push(`<ul style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'ol') {
      const mappedType = attrs.type && olTypeToCss[attrs.type] ? olTypeToCss[attrs.type] : 'decimal';
      const merged: Record<string, string> = {
        'margin': '4px 0 8px 0',
        'padding-left': '24px',
        'list-style-type': mappedType,
        'list-style-position': 'outside',
        'font-family': fontFamily,
        'font-size': fontSize,
        'line-height': lineHeight,
        'color': color,
        ...sourceCss
      };
      const extraAttrs: string[] = [];
      if (attrs.start && /^\d+$/.test(attrs.start.trim())) {
        extraAttrs.push(`start="${attrs.start.trim()}"`);
      }
      if (attrs.type && olTypeToCss[attrs.type]) {
        extraAttrs.push(`type="${attrs.type}"`);
      }
      const extraStr = extraAttrs.length > 0 ? ` ${extraAttrs.join(' ')}` : '';
      output.push(`<ol${extraStr} style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'li') {
      const merged: Record<string, string> = {
        'display': 'list-item',
        'margin': '0 0 3px 0',
        'font-family': fontFamily,
        'font-size': fontSize,
        'line-height': lineHeight,
        'color': color,
        ...sourceCss
      };
      output.push(`<li style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'strong' || rawTag === 'b') {
      const merged: Record<string, string> = {
        'font-weight': 'bold',
        ...sourceCss
      };
      output.push(`<strong style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'em' || rawTag === 'i') {
      const merged: Record<string, string> = {
        'font-style': 'italic',
        ...sourceCss
      };
      output.push(`<em style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'u') {
      const merged: Record<string, string> = {
        'text-decoration': 'underline',
        ...sourceCss
      };
      output.push(`<u style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 's' || rawTag === 'del' || rawTag === 'strike') {
      const merged: Record<string, string> = {
        'text-decoration': 'line-through',
        ...sourceCss
      };
      output.push(`<del style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'sub' || rawTag === 'sup') {
      const merged: Record<string, string> = {
        'font-size': '80%',
        ...sourceCss
      };
      output.push(`<${rawTag} style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'span') {
      const styleStr = serializeCssMap(sourceCss);
      output.push(styleStr ? `<span style="${escapeHtmlAttrValue(styleStr)}">` : '<span>');
    } else if (rawTag === 'font') {
      const merged: Record<string, string> = { ...sourceCss };
      if (attrs.color && /^(?:#[0-9a-f]{3,8}|rgb\([^)]+\)|[a-z]{3,20})$/i.test(attrs.color.trim()) && !merged.color) {
        merged.color = attrs.color.trim();
      }
      if (attrs.size && fontSizeAttrMap[attrs.size.trim()] && !merged['font-size']) {
        merged['font-size'] = fontSizeAttrMap[attrs.size.trim()];
      }
      const styleStr = serializeCssMap(merged);
      output.push(styleStr ? `<span style="${escapeHtmlAttrValue(styleStr)}">` : '<span>');
    } else if (rawTag === 'blockquote') {
      // Browser execCommand('indent') emits <blockquote style="margin: 0 0 0 40px; border: none; padding: 0px;">
      const isIndentBlock = sourceCss.border === 'none' || sourceCss.border === '0';
      const merged: Record<string, string> = isIndentBlock
        ? {
            'margin': '4px 0 6px 28px',
            'padding': '0',
            'border': 'none',
            'font-family': fontFamily,
            'font-size': fontSize,
            'line-height': lineHeight,
            'color': color,
            ...sourceCss
          }
        : {
            'margin': '6px 0 8px 14px',
            'padding-left': '10px',
            'border-left': `3px solid ${headingColor}`,
            'font-family': fontFamily,
            'font-size': fontSize,
            'line-height': lineHeight,
            'color': EXCEL_TEXT_SECONDARY,
            ...sourceCss
          };
      output.push(`<blockquote style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'a') {
      const safeHref = sanitizeSafeEmailHref(attrs.href);
      if (safeHref) {
        anchorTagStack.push('a');
        const merged: Record<string, string> = {
          'color': linkColor,
          'text-decoration': 'underline',
          ...sourceCss
        };
        output.push(
          `<a href="${escapeHtmlAttrValue(safeHref)}" target="_blank" rel="noopener noreferrer" style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`
        );
      } else {
        anchorTagStack.push('span');
        const styleStr = serializeCssMap(sourceCss);
        output.push(styleStr ? `<span style="${escapeHtmlAttrValue(styleStr)}">` : '<span>');
      }
    } else if (rawTag === 'table') {
      const merged: Record<string, string> = {
        'width': attrs.width && /^[0-9.]+(?:px|%)?$/i.test(attrs.width) ? attrs.width : '100%',
        'border-collapse': 'collapse',
        'mso-table-lspace': '0pt',
        'mso-table-rspace': '0pt',
        'margin': '8px 0',
        'border': `1px solid ${borderColor}`,
        'font-family': fontFamily,
        'font-size': fontSize,
        ...sourceCss
      };
      output.push(`<table border="0" cellspacing="0" cellpadding="0" style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    } else if (rawTag === 'thead' || rawTag === 'tbody' || rawTag === 'tfoot' || rawTag === 'tr') {
      const styleStr = serializeCssMap(sourceCss);
      output.push(styleStr ? `<${rawTag} style="${escapeHtmlAttrValue(styleStr)}">` : `<${rawTag}>`);
    } else if (rawTag === 'th' || rawTag === 'td') {
      const isHeader = rawTag === 'th';
      const merged: Record<string, string> = {
        'border': `1px solid ${borderColor}`,
        'padding': '5px 8px',
        'font-family': fontFamily,
        'font-size': fontSize,
        'line-height': '1.45',
        'text-align': 'left',
        'vertical-align': 'top',
        ...(isHeader
          ? { 'background-color': EXCEL_BLUE_ROW, 'font-weight': 'bold', 'color': headingColor }
          : { 'color': color }),
        ...sourceCss
      };
      if (attrs.width && /^[0-9.]+(?:px|%)?$/i.test(attrs.width) && !sourceCss.width) {
        merged.width = /^\d+$/.test(attrs.width) ? `${attrs.width}px` : attrs.width;
      }
      const cellAttrs: string[] = [];
      if (attrs.colspan && /^\d+$/.test(attrs.colspan)) {
        const n = parseInt(attrs.colspan, 10);
        if (n > 1 && n <= 20) cellAttrs.push(`colspan="${n}"`);
      }
      if (attrs.rowspan && /^\d+$/.test(attrs.rowspan)) {
        const n = parseInt(attrs.rowspan, 10);
        if (n > 1 && n <= 20) cellAttrs.push(`rowspan="${n}"`);
      }
      if (isHeader && attrs.scope && /^(col|row|colgroup|rowgroup)$/i.test(attrs.scope)) {
        cellAttrs.push(`scope="${attrs.scope.toLowerCase()}"`);
      }
      if (merged['text-align'] && /^(left|center|right|justify)$/i.test(merged['text-align'])) {
        cellAttrs.push(`align="${merged['text-align']}"`);
      }
      const extraStr = cellAttrs.length > 0 ? ` ${cellAttrs.join(' ')}` : '';
      output.push(`<${rawTag}${extraStr} style="${escapeHtmlAttrValue(serializeCssMap(merged))}">`);
    }
    // Any other unknown tag is intentionally dropped (keeping its inner text intact)
  }

  if (lastIndex < sourceHtml.length) {
    output.push(sourceHtml.slice(lastIndex));
  }

  return output.join('').trim();
}

/**
 * OPTION 2: COMPLETE FORMATTED QUOTATION (EXCEL-STYLE SPREADSHEET HTML)
 *
 * Email-client-compatible table layout built for Gmail, Google Workspace, and Outlook:
 * - Dark navy headers (#17365D) with white bold text (#FFFFFF)
 * - Pale blue service detail rows (#D9E2F3) alternating with crisp white (#FFFFFF)
 * - Explicit dark grey borders (#404040) on every cell
 * - Arial typography, table-only layout (no Flexbox/Grid/hero banners/CTAs)
 * - Section 3 displays strictly TWO totals: Land Part Total & Hotel Part Total
 * - Section 5 preserves original rich-text Commercial Quotation Terms verbatim
 * - Strict confidentiality: zero supplier nett cost, zero internal margins
 */
export function renderOption2CompleteFormattedHtmlEmail(
  model: QuotePresentationModel,
  customNote?: string
): string {
  const brandBorderColor = model.isWhiteLabel ? (model.brandPrimaryColor || EXCEL_NAVY) : EXCEL_BRAND_TEAL;
  const brandTitle = model.isWhiteLabel ? model.agencyName.toUpperCase() : 'THEUNBOUND';
  const routeString = model.routeHubs.length > 0
    ? model.routeHubs.map(h => `${h.hubName} (${h.nights}N)`).join(' &rarr; ')
    : model.destination;

  const thStyle = `background-color: ${EXCEL_NAVY}; color: ${EXCEL_HEADER_TEXT}; font-family: ${EXCEL_FONT}; font-size: 11px; font-weight: bold; padding: 7px 8px; border: 1px solid ${EXCEL_BORDER}; text-align: left; vertical-align: middle;`;
  const thCenterStyle = `background-color: ${EXCEL_NAVY}; color: ${EXCEL_HEADER_TEXT}; font-family: ${EXCEL_FONT}; font-size: 11px; font-weight: bold; padding: 7px 8px; border: 1px solid ${EXCEL_BORDER}; text-align: center; vertical-align: middle;`;
  const tdBase = `font-family: ${EXCEL_FONT}; font-size: 11px; color: ${EXCEL_TEXT_PRIMARY}; padding: 7px 8px; border: 1px solid ${EXCEL_BORDER}; vertical-align: top; word-wrap: break-word; overflow-wrap: break-word; word-break: break-word; line-height: 1.45;`;

  // --------------------------------------------------------------------------
  // A. COMPACT STRUCTURED QUOTATION HEADING
  // --------------------------------------------------------------------------
  const brandMetaLines: string[] = [];
  if (model.agentEmail) brandMetaLines.push(`Email: ${cleanInlineFormattedText(model.agentEmail)}`);
  if (model.agentPhone) brandMetaLines.push(`Phone: ${cleanInlineFormattedText(model.agentPhone)}`);
  if (model.agencyWebsite) brandMetaLines.push(`Web: ${cleanInlineFormattedText(model.agencyWebsite)}`);
  if (model.isWhiteLabel) {
    if (model.agencyAddress) brandMetaLines.push(`Address: ${cleanInlineFormattedText(model.agencyAddress)}`);
  } else if (model.agencyCurrentAddress) {
    brandMetaLines.push(`Desk: ${cleanInlineFormattedText(model.agencyCurrentAddress.replace(/\r?\n/g, ', '))}`);
  }

  const headingSectionHtml = `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border: 1px solid ${EXCEL_BORDER}; border-top: 3px solid ${brandBorderColor}; margin-bottom: 12px; background-color: ${EXCEL_WHITE_ROW};">
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid ${EXCEL_BORDER}; vertical-align: middle;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="vertical-align: middle;">
                ${model.agentLogoUrl ? `<img src="${escapeHtml(model.agentLogoUrl)}" alt="${cleanInlineFormattedText(model.agencyName)}" style="max-height: 32px; max-width: 120px; vertical-align: middle; margin-right: 10px;" />` : ''}
                <h1 style="margin: 0; display: inline-block; vertical-align: middle; font-family: ${EXCEL_FONT}; font-size: 15px; font-weight: bold; color: ${EXCEL_NAVY}; letter-spacing: 0.3px;">
                  ${cleanInlineFormattedText(brandTitle)} &mdash; COMPLETE TRAVEL QUOTATION
                </h1>
                <div style="font-family: ${EXCEL_FONT}; font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY}; margin-top: 2px;">
                  ${cleanInlineFormattedText(model.agentAgencySubtitle)}
                  ${brandMetaLines.length > 0 ? `<br/>${brandMetaLines.join(' &nbsp;|&nbsp; ')}` : ''}
                </div>
              </td>
              <td style="vertical-align: middle; text-align: right; font-family: ${EXCEL_FONT}; font-size: 11px; color: ${EXCEL_TEXT_PRIMARY}; white-space: nowrap;">
                <div style="font-weight: bold; color: ${EXCEL_NAVY}; font-size: 12px;">${cleanInlineFormattedText(model.quoteNumber)} (v${model.version})</div>
                <div style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY};">Generated: ${cleanInlineFormattedText(model.createdDateFormatted)}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding: 0;">
          <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; table-layout: fixed;">
            <tr>
              <td style="${tdBase} width: 17%; background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Client / Lead Name</td>
              <td style="${tdBase} width: 33%; background-color: ${EXCEL_WHITE_ROW};">
                <strong>${cleanInlineFormattedText(model.clientName)}</strong>
                ${model.clientCompany ? `<br/><span style="color: ${EXCEL_TEXT_SECONDARY}; font-size: 10.5px;">${cleanInlineFormattedText(model.clientCompany)}</span>` : ''}
                ${(model.clientEmail || model.clientPhone) ? `<br/><span style="color: ${EXCEL_TEXT_SECONDARY}; font-size: 10.5px;">${[model.clientEmail, model.clientPhone].filter(Boolean).map(v => cleanInlineFormattedText(String(v))).join(' &bull; ')}</span>` : ''}
              </td>
              <td style="${tdBase} width: 17%; background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Quotation Reference</td>
              <td style="${tdBase} width: 33%; background-color: ${EXCEL_WHITE_ROW};">
                <strong>${cleanInlineFormattedText(model.quoteNumber)} (v${model.version})</strong> &bull; Status: ${cleanInlineFormattedText(model.status)}<br/>
                <span style="color: ${EXCEL_TEXT_SECONDARY}; font-size: 10.5px;">Generated: ${cleanInlineFormattedText(model.createdDateFormatted)} &bull; Valid Until: ${cleanInlineFormattedText(model.validUntilFormatted)}</span>
              </td>
            </tr>
            <tr>
              <td style="${tdBase} background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Destination &amp; Route</td>
              <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW};">
                <strong>${cleanInlineFormattedText(model.destination)}</strong>
                ${routeString ? `<br/><span style="color: ${EXCEL_TEXT_SECONDARY}; font-size: 10.5px;">${routeString}</span>` : ''}
              </td>
              <td style="${tdBase} background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Travel Dates</td>
              <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW};">
                <strong>${cleanInlineFormattedText(model.dateSpanText || 'As specified in quotation')}</strong><br/>
                <span style="color: ${EXCEL_TEXT_SECONDARY}; font-size: 10.5px;">${model.totalDays} Days / ${model.totalNights} Nights</span>
              </td>
            </tr>
            <tr>
              <td style="${tdBase} background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Passengers</td>
              <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW};">
                ${cleanInlineFormattedText(model.paxDetailsText)}
                ${(model.nationality || model.travelStyle) ? `<br/><span style="color: ${EXCEL_TEXT_SECONDARY}; font-size: 10.5px;">${[model.nationality ? `Nationality: ${model.nationality}` : '', model.travelStyle ? `Style: ${model.travelStyle}` : ''].filter(Boolean).map(cleanInlineFormattedText).join(' &bull; ')}</span>` : ''}
              </td>
              <td style="${tdBase} background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Prepared By</td>
              <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW};">
                <strong>${cleanInlineFormattedText(model.agentName)}</strong> (${cleanInlineFormattedText(model.agencyName)})
                ${model.selectedOptionTitle ? `<br/><span style="color: ${EXCEL_TEXT_SECONDARY}; font-size: 10.5px;">Selected Option: ${cleanInlineFormattedText(model.selectedOptionTitle)}</span>` : ''}
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  `;

  const customNoteHtml = customNote && customNote.trim() ? `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; border: 1px solid ${EXCEL_BORDER}; margin-bottom: 12px; background-color: ${EXCEL_WHITE_ROW};">
      <tr>
        <td style="${tdBase} width: 17%; background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Specialist Note</td>
        <td style="${tdBase} width: 83%; background-color: ${EXCEL_WHITE_ROW};">${renderSpreadsheetRichText(customNote.trim(), { fontSize: '11px' })}</td>
      </tr>
    </table>
  ` : '';

  const tripOverviewHtml = model.itineraryOverview && model.itineraryOverview.trim() ? `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; border: 1px solid ${EXCEL_BORDER}; margin-bottom: 12px; background-color: ${EXCEL_WHITE_ROW};">
      <tr>
        <th style="${thStyle}">TRIP OVERVIEW</th>
      </tr>
      <tr>
        <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW};">${renderSpreadsheetRichText(model.itineraryOverview, { fontSize: '11px' })}</td>
      </tr>
    </table>
  ` : '';

  // --------------------------------------------------------------------------
  // B. HOTEL ACCOMMODATION TABLE
  // Columns: Type | Hotel City / Area | Details (Dynamic Hotel Price) | Nights | Dates | No.
  // --------------------------------------------------------------------------
  interface MergedHotelRow {
    typeLabel: string;
    cityArea: string;
    hotelName: string;
    starRating?: string;
    roomType: string;
    mealPlan: string;
    occupancy: string;
    nights: number;
    checkInDate: string;
    checkOutDate: string;
    roomsCount: number;
    overview?: string;
    inclusions: string[];
    exclusions: string[];
    notes?: string;
    isNoAccommodation: boolean;
  }

  const hotelRows: MergedHotelRow[] = [];
  const remainingHotels: HotelPresentationItem[] = [...(model.hotels || [])];

  if (model.accommodations && model.accommodations.length > 0) {
    model.accommodations.forEach((acc) => {
      if (acc.isNoAccommodation) {
        hotelRows.push({
          typeLabel: 'Accommodation',
          cityArea: acc.city,
          hotelName: acc.hotelName || 'No Accommodation (Arranged by Client)',
          roomType: acc.roomSummary || 'Arranged directly by traveler',
          mealPlan: 'N/A',
          occupancy: model.paxDetailsText,
          nights: acc.nights,
          checkInDate: acc.checkInDate || model.travelStartDate || 'TBD',
          checkOutDate: acc.checkOutDate || model.travelEndDate || 'TBD',
          roomsCount: 0,
          inclusions: [],
          exclusions: [],
          isNoAccommodation: true
        });
      } else {
        const matchIdx = remainingHotels.findIndex(
          (h) =>
            (acc.hubId && h.id === acc.hubId) ||
            (h.hotelName.toLowerCase() === acc.hotelName.toLowerCase() && h.cityHub.toLowerCase() === acc.city.toLowerCase())
        );
        const matched = matchIdx >= 0 ? remainingHotels.splice(matchIdx, 1)[0] : remainingHotels.shift();
        hotelRows.push({
          typeLabel: 'Hotel',
          cityArea: matched?.cityHub || acc.city,
          hotelName: matched?.hotelName || acc.hotelName,
          starRating: matched?.starRating,
          roomType: matched?.roomType || acc.roomSummary || 'Standard Room',
          mealPlan: matched?.mealPlan || acc.mealPlan || 'Daily Breakfast Included',
          occupancy: matched?.occupancy || model.paxDetailsText,
          nights: matched?.nightsCount ?? acc.nights,
          checkInDate: matched?.checkInDate || acc.checkInDate || model.travelStartDate || 'TBD',
          checkOutDate: matched?.checkOutDate || acc.checkOutDate || model.travelEndDate || 'TBD',
          roomsCount: matched?.roomsCount ?? 1,
          overview: matched?.overview,
          inclusions: matched?.inclusions || [],
          exclusions: matched?.exclusions || [],
          notes: matched?.notes,
          isNoAccommodation: false
        });
      }
    });
  }
  remainingHotels.forEach((h) => {
    hotelRows.push({
      typeLabel: 'Hotel',
      cityArea: h.cityHub,
      hotelName: h.hotelName,
      starRating: h.starRating,
      roomType: h.roomType,
      mealPlan: h.mealPlan,
      occupancy: h.occupancy,
      nights: h.nightsCount,
      checkInDate: h.checkInDate,
      checkOutDate: h.checkOutDate,
      roomsCount: h.roomsCount,
      overview: h.overview,
      inclusions: h.inclusions || [],
      exclusions: h.exclusions || [],
      notes: h.notes,
      isNoAccommodation: false
    });
  });

  const hotelTableHtml = `
    <div style="font-family: ${EXCEL_FONT}; font-size: 11.5px; font-weight: bold; color: ${EXCEL_NAVY}; text-transform: uppercase; margin: 10px 0 4px 0; page-break-after: avoid;">
      1. Hotel Accommodation
    </div>
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; min-width: 580px; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border: 1px solid ${EXCEL_BORDER}; table-layout: fixed; margin-bottom: 14px;">
      <thead>
        <tr>
          <th style="${thStyle} width: 11%;">Type</th>
          <th style="${thStyle} width: 16%;">Hotel City / Area</th>
          <th style="${thStyle} width: 43%;">Details (Dynamic Hotel Price)</th>
          <th style="${thCenterStyle} width: 8%;">Nights</th>
          <th style="${thStyle} width: 15%;">Dates</th>
          <th style="${thCenterStyle} width: 7%;">No.</th>
        </tr>
      </thead>
      <tbody>
        ${hotelRows.length === 0 ? `
          <tr>
            <td colspan="6" style="${tdBase} background-color: ${EXCEL_WHITE_ROW}; color: ${EXCEL_TEXT_SECONDARY}; text-align: center;">
              Land-Only Quotation &mdash; No Hotel Accommodation Included
            </td>
          </tr>
        ` : hotelRows.map((row, idx) => {
          const rowBg = idx % 2 === 0 ? EXCEL_BLUE_ROW : EXCEL_WHITE_ROW;
          const detailsHtml = row.isNoAccommodation
            ? `
              <div style="font-weight: bold; color: ${EXCEL_TEXT_PRIMARY};">${cleanInlineFormattedText(row.hotelName)}</div>
              <div style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY}; margin-top: 2px;">${cleanInlineFormattedText(row.roomType)}</div>
            `
            : `
              <div style="font-weight: bold; font-size: 11.5px; color: ${EXCEL_TEXT_PRIMARY}; margin-bottom: 3px;">
                ${cleanInlineFormattedText(row.hotelName)}${row.starRating ? ` <span style="font-weight: normal; color: ${EXCEL_TEXT_SECONDARY}; font-size: 10.5px;">(${cleanInlineFormattedText(row.starRating)})</span>` : ''}
              </div>
              <div style="font-size: 10.5px; color: ${EXCEL_TEXT_PRIMARY}; line-height: 1.45;">
                <strong>Room Configuration:</strong> ${cleanInlineFormattedText(row.roomType)}<br/>
                <strong>Meal Plan:</strong> ${cleanInlineFormattedText(row.mealPlan)}<br/>
                <strong>Occupancy:</strong> ${cleanInlineFormattedText(row.occupancy)}
              </div>
              ${row.overview ? `<div style="margin-top: 4px;">${renderSpreadsheetRichText(row.overview, { fontSize: '10.5px' })}</div>` : ''}
              ${row.inclusions.length > 0 ? `<div style="font-size: 10.5px; color: ${EXCEL_TEXT_PRIMARY}; margin-top: 3px;"><strong>Inclusions:</strong> ${row.inclusions.map(cleanInlineFormattedText).join(' &bull; ')}</div>` : ''}
              ${row.exclusions.length > 0 ? `<div style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY}; margin-top: 2px;"><strong>Exclusions:</strong> ${row.exclusions.map(cleanInlineFormattedText).join(' &bull; ')}</div>` : ''}
              ${row.notes ? `<div style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY}; margin-top: 3px;"><strong>Stay Notes:</strong> ${renderSpreadsheetRichText(row.notes, { fontSize: '10.5px', color: EXCEL_TEXT_SECONDARY })}</div>` : ''}
            `;

          return `
            <tr>
              <td style="${tdBase} background-color: ${rowBg}; font-weight: bold;">${cleanInlineFormattedText(row.typeLabel)}</td>
              <td style="${tdBase} background-color: ${rowBg}; font-weight: bold;">${cleanInlineFormattedText(row.cityArea)}</td>
              <td style="${tdBase} background-color: ${rowBg};">${detailsHtml}</td>
              <td style="${tdBase} background-color: ${rowBg}; text-align: center; font-weight: bold;">${row.nights}</td>
              <td style="${tdBase} background-color: ${rowBg}; font-size: 10.5px;">
                <strong>In:</strong> ${cleanInlineFormattedText(row.checkInDate)}<br/>
                <strong>Out:</strong> ${cleanInlineFormattedText(row.checkOutDate)}
              </td>
              <td style="${tdBase} background-color: ${rowBg}; text-align: center; font-weight: bold;">
                ${row.isNoAccommodation ? '&mdash;' : `${row.roomsCount} ${row.roomsCount === 1 ? 'Rm' : 'Rms'}`}
              </td>
            </tr>
          `;
        }).join('')}
      </tbody>
    </table>
  `;

  // --------------------------------------------------------------------------
  // C & D. SERVICES, TRANSFERS AND ACTIVITIES TABLE
  // Columns: Type | Service / Hotel City / Area | Details | Day | Dates | Unit
  // Preserves exact chronological Day 1..N order
  // --------------------------------------------------------------------------
  const serviceRowsHtml: string[] = [];
  let serviceZebraIndex = 0;

  // 1. Pre-Departure Visa & Ancillary Services (if configured)
  if (model.visaServices && model.visaServices.length > 0) {
    model.visaServices.forEach((v) => {
      const bg = serviceZebraIndex % 2 === 0 ? EXCEL_BLUE_ROW : EXCEL_WHITE_ROW;
      serviceZebraIndex++;
      const visaDate = v.rawItem?.travelDate || model.travelStartDate || 'Pre-Departure';
      serviceRowsHtml.push(`
        <tr>
          <td style="${tdBase} background-color: ${bg}; font-weight: bold;">${cleanInlineFormattedText(classifyServiceTypeLabel(v))}</td>
          <td style="${tdBase} background-color: ${bg};">
            <strong>${cleanInlineFormattedText(v.listingName)}</strong><br/>
            <span style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY};">${cleanInlineFormattedText(model.destination)}</span>
          </td>
          <td style="${tdBase} background-color: ${bg};">${buildOption2ServiceDetailsHtml(v, visaDate)}</td>
          <td style="${tdBase} background-color: ${bg}; text-align: center; font-weight: bold;">Pre-Trip</td>
          <td style="${tdBase} background-color: ${bg}; font-size: 10.5px;">${cleanInlineFormattedText(visaDate)}</td>
          <td style="${tdBase} background-color: ${bg}; text-align: center;">${cleanInlineFormattedText(resolveServiceUnitText(v))}</td>
        </tr>
      `);
    });
  }

  // 2. Day 1..N Chronological Itinerary Services
  model.days.forEach((day) => {
    const nonHotelServices = day.services.filter((s) => !isHotelPresentationService(s));
    const dayDateLabel = `${day.dayOfWeek}, ${day.formattedDate}`;

    // Optional Day Transition / Theme / Overview banner row in crisp white
    if (day.dayOverview || day.customTheme || day.isTransitionDay) {
      const transitionTag = day.isTransitionDay && day.prevHubName
        ? ` [Transfer: ${cleanInlineFormattedText(day.prevHubName)} &rarr; ${cleanInlineFormattedText(day.hubName)}]`
        : '';
      const themeTag = day.customTheme ? ` &mdash; ${cleanInlineFormattedText(day.customTheme)}` : '';
      serviceRowsHtml.push(`
        <tr>
          <td colspan="6" style="${tdBase} background-color: ${EXCEL_WHITE_ROW};">
            <strong style="color: ${EXCEL_NAVY};">Day ${day.dayNumber} (${cleanInlineFormattedText(dayDateLabel)}) &mdash; ${cleanInlineFormattedText(day.hubName)}</strong>${transitionTag}${themeTag}
            ${day.dayOverview ? `<div style="margin-top: 3px;">${renderSpreadsheetRichText(day.dayOverview, { fontSize: '10.5px' })}</div>` : ''}
          </td>
        </tr>
      `);
    }

    if (nonHotelServices.length === 0) {
      serviceRowsHtml.push(`
        <tr>
          <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW}; font-weight: bold;">Leisure</td>
          <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW};">
            <strong>Day at Leisure</strong><br/>
            <span style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY};">${cleanInlineFormattedText(day.hubName)}</span>
          </td>
          <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW};">
            <strong>Day at Leisure in ${cleanInlineFormattedText(day.hubName)} (Self-Paced)</strong><br/>
            <span style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY};">Free time for personal exploration, neighborhood shopping, and local dining discoveries.</span>
          </td>
          <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW}; text-align: center; font-weight: bold;">Day ${day.dayNumber}</td>
          <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW}; font-size: 10.5px;">${cleanInlineFormattedText(day.formattedDate)}</td>
          <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW}; text-align: center;">&mdash;</td>
        </tr>
      `);
    } else {
      nonHotelServices.forEach((s) => {
        const bg = serviceZebraIndex % 2 === 0 ? EXCEL_BLUE_ROW : EXCEL_WHITE_ROW;
        serviceZebraIndex++;
        const cityLabel = s.rawItem?.product?.city || day.hubName;
        serviceRowsHtml.push(`
          <tr>
            <td style="${tdBase} background-color: ${bg}; font-weight: bold;">${cleanInlineFormattedText(classifyServiceTypeLabel(s))}</td>
            <td style="${tdBase} background-color: ${bg};">
              <strong>${cleanInlineFormattedText(s.listingName)}</strong><br/>
              <span style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY};">${cleanInlineFormattedText(cityLabel)}</span>
            </td>
            <td style="${tdBase} background-color: ${bg};">${buildOption2ServiceDetailsHtml(s, day.formattedDate)}</td>
            <td style="${tdBase} background-color: ${bg}; text-align: center; font-weight: bold;">Day ${day.dayNumber}</td>
            <td style="${tdBase} background-color: ${bg}; font-size: 10.5px;">
              ${cleanInlineFormattedText(day.formattedDate)}
              ${s.serviceTime ? `<br/><span style="color: ${EXCEL_TEXT_SECONDARY};">${cleanInlineFormattedText(s.serviceTime)}</span>` : ''}
            </td>
            <td style="${tdBase} background-color: ${bg}; text-align: center;">${cleanInlineFormattedText(resolveServiceUnitText(s))}</td>
          </tr>
        `);
      });
    }

    if (day.dayNotes && day.dayNotes.trim()) {
      serviceRowsHtml.push(`
        <tr>
          <td colspan="6" style="${tdBase} background-color: ${EXCEL_WHITE_ROW}; font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY};">
            <strong style="color: ${EXCEL_TEXT_PRIMARY};">Day ${day.dayNumber} Operational Notes:</strong> ${renderSpreadsheetRichText(day.dayNotes, { fontSize: '10.5px', color: EXCEL_TEXT_SECONDARY })}
          </td>
        </tr>
      `);
    }
  });

  // 3. Additional unscheduled / trip-wide services (if any)
  if (model.additionalServices && model.additionalServices.length > 0) {
    model.additionalServices.forEach((a) => {
      const bg = serviceZebraIndex % 2 === 0 ? EXCEL_BLUE_ROW : EXCEL_WHITE_ROW;
      serviceZebraIndex++;
      serviceRowsHtml.push(`
        <tr>
          <td style="${tdBase} background-color: ${bg}; font-weight: bold;">${cleanInlineFormattedText(a.category || 'Package Service')}</td>
          <td style="${tdBase} background-color: ${bg};">
            <strong>${cleanInlineFormattedText(a.name)}</strong><br/>
            <span style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY};">${cleanInlineFormattedText(model.destination)}</span>
          </td>
          <td style="${tdBase} background-color: ${bg};">
            <div style="font-weight: bold; margin-bottom: 3px;">${cleanInlineFormattedText(a.name)}</div>
            ${a.summary ? `<div style="font-size: 10.5px; margin-bottom: 3px;">${cleanInlineFormattedText(a.summary)}</div>` : ''}
            ${a.overview ? `<div>${renderSpreadsheetRichText(a.overview, { fontSize: '10.5px' })}</div>` : ''}
            ${a.inclusions && a.inclusions.length > 0 ? `<div style="font-size: 10.5px; margin-top: 3px;"><strong>Inclusions:</strong> ${a.inclusions.map(cleanInlineFormattedText).join(' &bull; ')}</div>` : ''}
            ${a.exclusions && a.exclusions.length > 0 ? `<div style="font-size: 10.5px; color: ${EXCEL_TEXT_SECONDARY}; margin-top: 2px;"><strong>Exclusions:</strong> ${a.exclusions.map(cleanInlineFormattedText).join(' &bull; ')}</div>` : ''}
            ${a.specialInstructions ? `<div style="font-size: 10.5px; margin-top: 3px;"><strong>Notes:</strong> ${renderSpreadsheetRichText(a.specialInstructions, { fontSize: '10.5px' })}</div>` : ''}
          </td>
          <td style="${tdBase} background-color: ${bg}; text-align: center; font-weight: bold;">Trip-Wide</td>
          <td style="${tdBase} background-color: ${bg}; font-size: 10.5px;">${cleanInlineFormattedText(model.dateSpanText || 'Included')}</td>
          <td style="${tdBase} background-color: ${bg}; text-align: center;">Included</td>
        </tr>
      `);
    });
  }

  const servicesTableHtml = `
    <div style="font-family: ${EXCEL_FONT}; font-size: 11.5px; font-weight: bold; color: ${EXCEL_NAVY}; text-transform: uppercase; margin: 12px 0 4px 0; page-break-after: avoid;">
      2. Services, Transfers &amp; Activities
    </div>
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; min-width: 600px; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border: 1px solid ${EXCEL_BORDER}; table-layout: fixed; margin-bottom: 14px;">
      <thead>
        <tr>
          <th style="${thStyle} width: 13%;">Type</th>
          <th style="${thStyle} width: 17%;">Service / Hotel City / Area</th>
          <th style="${thStyle} width: 44%;">Details</th>
          <th style="${thCenterStyle} width: 8%;">Day</th>
          <th style="${thStyle} width: 11%;">Dates</th>
          <th style="${thCenterStyle} width: 7%;">Unit</th>
        </tr>
      </thead>
      <tbody>
        ${serviceRowsHtml.length > 0 ? serviceRowsHtml.join('') : `
          <tr>
            <td colspan="6" style="${tdBase} background-color: ${EXCEL_WHITE_ROW}; color: ${EXCEL_TEXT_SECONDARY}; text-align: center;">
              No ground services configured for this quotation.
            </td>
          </tr>
        `}
      </tbody>
    </table>
  `;

  // --------------------------------------------------------------------------
  // E. SECTION 3: QUOTATION PRICING SUMMARY (STRICT TWO-ROW DISPLAY)
  // Displays ONLY:
  //   1. Land Part Total
  //   2. Hotel Part Total
  // Both values come exclusively from the authoritative committed quotation
  // snapshot / central pricing engine in the quotation's commercial currency.
  // Never fabricates a value or substitutes zero when unavailable.
  // --------------------------------------------------------------------------
  const pricingValidation = validateOption2PricingSummary(model);
  const pricingCurrencyLabel = model.currency ? cleanInlineFormattedText(model.currency) : 'UNAVAILABLE';

  const landPartCellValue = pricingValidation.landPartDisplay
    ? cleanInlineFormattedText(pricingValidation.landPartDisplay)
    : `<span style="color: #b91c1c; font-weight: bold;">Unavailable (Missing Land Part Total)</span>`;

  const hotelPartCellValue = pricingValidation.hotelPartDisplay
    ? cleanInlineFormattedText(pricingValidation.hotelPartDisplay)
    : `<span style="color: #b91c1c; font-weight: bold;">Unavailable (Missing Hotel Part Total)</span>`;

  const missingPricingWarningHtml = !pricingValidation.isValid
    ? `<div style="font-family: ${EXCEL_FONT}; font-size: 11px; color: #991b1b; background-color: #fef2f2; border: 1px solid #dc2626; padding: 8px 10px; margin-bottom: 10px; font-weight: bold;">${cleanInlineFormattedText(pricingValidation.errorMessage || 'Authoritative quotation pricing totals are unavailable.')}</div>`
    : '';

  const pricingSummaryHtml = `
    <div style="font-family: ${EXCEL_FONT}; font-size: 11.5px; font-weight: bold; color: ${EXCEL_NAVY}; text-transform: uppercase; margin: 12px 0 4px 0; page-break-after: avoid;">
      3. Quotation Pricing Summary
    </div>
    ${missingPricingWarningHtml}
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border: 1px solid ${EXCEL_BORDER}; table-layout: fixed; margin-bottom: 14px;">
      <thead>
        <tr>
          <th style="${thStyle} width: 68%;">Pricing Component</th>
          <th style="${thStyle} width: 32%; text-align: right;">Amount (${pricingCurrencyLabel})</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="${tdBase} width: 68%; background-color: ${EXCEL_WHITE_ROW}; font-size: 11.5px; font-weight: bold; color: ${EXCEL_NAVY};">Land Part Total</td>
          <td style="${tdBase} width: 32%; background-color: ${EXCEL_WHITE_ROW}; text-align: right; font-size: 12px; font-weight: bold; color: ${EXCEL_NAVY};">${landPartCellValue}</td>
        </tr>
        <tr>
          <td style="${tdBase} width: 68%; background-color: ${EXCEL_BLUE_ROW}; font-size: 11.5px; font-weight: bold; color: ${EXCEL_NAVY};">Hotel Part Total</td>
          <td style="${tdBase} width: 32%; background-color: ${EXCEL_BLUE_ROW}; text-align: right; font-size: 12px; font-weight: bold; color: ${EXCEL_NAVY};">${hotelPartCellValue}</td>
        </tr>
        ${model.appliedPromotion ? `
        <tr>
          <td style="${tdBase} width: 68%; background-color: #ecfdf5; font-size: 11px; font-weight: bold; color: #065f46;">Promotional Discount (${cleanInlineFormattedText(model.appliedPromotion.code)} — ${cleanInlineFormattedText(model.appliedPromotion.promotionName)})</td>
          <td style="${tdBase} width: 32%; background-color: #ecfdf5; text-align: right; font-size: 11.5px; font-weight: bold; color: #065f46;">-${cleanInlineFormattedText(model.appliedPromotion.discountAmountFormatted)}</td>
        </tr>
        ` : ''}
      </tbody>
    </table>
  `;

  // Package Inclusions / Exclusions / Policies table (when present)
  const policyRows: string[] = [];
  if (model.inclusions.length > 0) {
    policyRows.push(`
      <tr>
        <td style="${tdBase} width: 24%; background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Package Inclusions</td>
        <td style="${tdBase} width: 76%; background-color: ${EXCEL_WHITE_ROW};">
          <ul style="margin: 0; padding-left: 16px; list-style-type: disc;">${model.inclusions.map(inc => `<li style="margin-bottom: 2px;">${cleanInlineFormattedText(inc)}</li>`).join('')}</ul>
        </td>
      </tr>
    `);
  }
  if (model.exclusions.length > 0) {
    policyRows.push(`
      <tr>
        <td style="${tdBase} width: 24%; background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Package Exclusions</td>
        <td style="${tdBase} width: 76%; background-color: ${EXCEL_WHITE_ROW};">
          <ul style="margin: 0; padding-left: 16px; list-style-type: disc;">${model.exclusions.map(exc => `<li style="margin-bottom: 2px;">${cleanInlineFormattedText(exc)}</li>`).join('')}</ul>
        </td>
      </tr>
    `);
  }
  if (model.importantInformation) {
    policyRows.push(`
      <tr>
        <td style="${tdBase} width: 24%; background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Important Information</td>
        <td style="${tdBase} width: 76%; background-color: ${EXCEL_WHITE_ROW};">${renderSpreadsheetRichText(model.importantInformation, { fontSize: '11px' })}</td>
      </tr>
    `);
  }
  if (model.cancellationPolicy) {
    policyRows.push(`
      <tr>
        <td style="${tdBase} width: 24%; background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Cancellation Policy</td>
        <td style="${tdBase} width: 76%; background-color: ${EXCEL_WHITE_ROW};">${renderSpreadsheetRichText(model.cancellationPolicy, { fontSize: '11px' })}</td>
      </tr>
    `);
  }
  if (model.childAndAttractionPolicies && model.childAndAttractionPolicies.length > 0) {
    policyRows.push(`
      <tr>
        <td style="${tdBase} width: 24%; background-color: ${EXCEL_BLUE_ROW}; font-weight: bold;">Operational &amp; Child Policies</td>
        <td style="${tdBase} width: 76%; background-color: ${EXCEL_WHITE_ROW};">
          <ul style="margin: 0; padding-left: 16px; list-style-type: disc;">${model.childAndAttractionPolicies.map(p => `<li style="margin-bottom: 2px;">${cleanInlineFormattedText(p)}</li>`).join('')}</ul>
        </td>
      </tr>
    `);
  }

  const policiesSectionHtml = policyRows.length > 0 ? `
    <div style="font-family: ${EXCEL_FONT}; font-size: 11.5px; font-weight: bold; color: ${EXCEL_NAVY}; text-transform: uppercase; margin: 12px 0 4px 0; page-break-after: avoid;">
      4. Policies &amp; Operational Notes
    </div>
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border: 1px solid ${EXCEL_BORDER}; table-layout: fixed; margin-bottom: 14px;">
      <tbody>
        ${policyRows.join('')}
      </tbody>
    </table>
  ` : '';

  // --------------------------------------------------------------------------
  // F. COMPLETE DESTINATION-SPECIFIC COMMERCIAL QUOTATION TERMS
  // Preserves original rich-text structure & formatting verbatim: headings,
  // subheadings, bold, italic, underline, numbered clauses, bullets, tables,
  // hyperlinks, indentation, text alignment, paragraph breaks, and multi-
  // destination separation.
  // --------------------------------------------------------------------------
  const termsRenderOpts = {
    fontFamily: EXCEL_FONT,
    fontSize: '11px',
    lineHeight: '1.5',
    color: EXCEL_TEXT_PRIMARY,
    headingColor: EXCEL_NAVY,
    borderColor: EXCEL_BORDER,
    linkColor: EXCEL_NAVY
  };

  let renderedTermsInnerHtml = '';
  const termsEntries = model.commercialTermsSnapshot?.entries;
  if (termsEntries && termsEntries.length > 0) {
    const renderedEntryBlocks = termsEntries
      .map((entry) => {
        const activeSecs = [...(entry.sections || [])]
          .filter((sec) => sec.isActive !== false && (sec.heading?.trim() || sec.htmlContent?.trim()))
          .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

        let entryBodyHtml = '';
        if (activeSecs.length > 0) {
          entryBodyHtml = activeSecs
            .map((sec) => {
              const secHeading = sec.heading && sec.heading.trim()
                ? `<h3 style="margin: 8px 0 4px 0; font-family: ${EXCEL_FONT}; font-size: 12px; font-weight: bold; line-height: 1.4; color: ${EXCEL_NAVY};">${cleanInlineFormattedText(sec.heading)}</h3>`
                : '';
              const secBody = sec.htmlContent && sec.htmlContent.trim()
                ? renderCommercialTermsRichHtmlForEmail(sec.htmlContent, termsRenderOpts)
                : '';
              return `<div style="margin: 0 0 8px 0;">${secHeading}${secBody}</div>`;
            })
            .join('');
        } else if ((entry as any).htmlText && String((entry as any).htmlText).trim()) {
          entryBodyHtml = renderCommercialTermsRichHtmlForEmail(String((entry as any).htmlText), termsRenderOpts);
        } else if ((entry as any).plainText && String((entry as any).plainText).trim()) {
          entryBodyHtml = renderCommercialTermsRichHtmlForEmail(String((entry as any).plainText), termsRenderOpts);
        }

        if (!entryBodyHtml) return '';

        const entryTitle = termsEntries.length > 1 || entry.targetName
          ? `<div style="font-family: ${EXCEL_FONT}; font-size: 12px; font-weight: bold; color: ${EXCEL_NAVY}; border-bottom: 1px solid ${EXCEL_BORDER}; padding-bottom: 4px; margin: 0 0 8px 0; text-transform: uppercase;">${cleanInlineFormattedText(entry.targetName)} &mdash; Commercial Terms</div>`
          : '';

        return `${entryTitle}${entryBodyHtml}`;
      })
      .filter(Boolean);

    renderedTermsInnerHtml = renderedEntryBlocks
      .map((blockHtml, idx) =>
        idx === 0
          ? `<div style="margin: 0;">${blockHtml}</div>`
          : `<div style="margin: 14px 0 0 0; padding-top: 12px; border-top: 2px solid ${EXCEL_NAVY};">${blockHtml}</div>`
      )
      .join('');
  }

  if (!renderedTermsInnerHtml) {
    const fallbackHtmlSource =
      model.commercialTermsSnapshot?.combinedHtml ||
      model.commercialTermsHtml;

    if (fallbackHtmlSource && fallbackHtmlSource.trim()) {
      renderedTermsInnerHtml = renderCommercialTermsRichHtmlForEmail(fallbackHtmlSource, termsRenderOpts);
    } else if (model.commercialTermsItems && model.commercialTermsItems.length > 0) {
      renderedTermsInnerHtml = model.commercialTermsItems
        .map((it) => {
          const itemHeading = it.heading && it.heading.trim()
            ? `<h3 style="margin: 8px 0 4px 0; font-family: ${EXCEL_FONT}; font-size: 12px; font-weight: bold; line-height: 1.4; color: ${EXCEL_NAVY};">${cleanInlineFormattedText(it.heading)}</h3>`
            : '';
          const itemBody = it.body && it.body.trim()
            ? renderCommercialTermsRichHtmlForEmail(it.body, termsRenderOpts)
            : '';
          return `<div style="margin: 0 0 8px 0;">${itemHeading}${itemBody}</div>`;
        })
        .join('');
    } else if (model.commercialTerms && model.commercialTerms.trim()) {
      renderedTermsInnerHtml = renderCommercialTermsRichHtmlForEmail(model.commercialTerms, termsRenderOpts);
    }
  }

  const termsSectionHtml = `
    <div style="font-family: ${EXCEL_FONT}; font-size: 11.5px; font-weight: bold; color: ${EXCEL_NAVY}; text-transform: uppercase; margin: 12px 0 4px 0; page-break-after: avoid;">
      5. ${cleanInlineFormattedText(model.commercialTermsHeading || 'Commercial Quotation Terms')}
    </div>
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; mso-table-lspace: 0pt; mso-table-rspace: 0pt; border: 1px solid ${EXCEL_BORDER}; table-layout: fixed; margin-bottom: 12px;">
      <thead>
        <tr>
          <th style="${thStyle}">${cleanInlineFormattedText(model.commercialTermsHeading || 'Commercial Quotation Terms & Conditions')}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="${tdBase} background-color: ${EXCEL_WHITE_ROW}; padding: 10px 12px;">${renderedTermsInnerHtml}</td>
        </tr>
      </tbody>
    </table>
  `;

  // --------------------------------------------------------------------------
  // G. FOOTER ROW
  // --------------------------------------------------------------------------
  const footerHtml = `
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="width: 100%; border-collapse: collapse; border: 1px solid ${EXCEL_BORDER}; background-color: ${EXCEL_WHITE_ROW};">
      <tr>
        <td style="${tdBase} width: 75%; font-size: 10px; color: ${EXCEL_TEXT_SECONDARY};">
          ${cleanInlineFormattedText(model.footerContactLine)}
        </td>
        <td style="${tdBase} width: 25%; text-align: right; font-size: 10px; font-weight: bold; color: ${EXCEL_NAVY};">
          ${cleanInlineFormattedText(model.footerRightTitle)}
        </td>
      </tr>
    </table>
  `;

  return `
    <div style="width: 100%; background-color: ${EXCEL_WHITE_ROW}; margin: 0; padding: 12px 0; font-family: ${EXCEL_FONT}; color: ${EXCEL_TEXT_PRIMARY};">
      <div style="max-width: 780px; width: 100%; margin: 0 auto; overflow-x: auto; -webkit-overflow-scrolling: touch;">
        ${headingSectionHtml}
        ${customNoteHtml}
        ${tripOverviewHtml}
        ${hotelTableHtml}
        ${servicesTableHtml}
        ${pricingSummaryHtml}
        ${policiesSectionHtml}
        ${termsSectionHtml}
        ${footerHtml}
      </div>
    </div>
  `.trim();
}
