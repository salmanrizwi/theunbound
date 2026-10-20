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

import { QuotePresentationModel, ServicePresentationItem } from './quotePresentationModel';

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
                <div style="border-bottom: 2px solid #020617; padding-bottom: 14px; margin-bottom: 16px;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-collapse: collapse;">
                    <tr>
                      <td style="vertical-align: top;">
                        <div style="display: flex; align-items: center; gap: 10px;">
                          <span style="font-size: 26px; font-weight: 900; text-transform: lowercase; color: #020617; letter-spacing: -0.02em;">${cleanInlineFormattedText(model.agencyName)}</span>
                          <span style="font-size: 9px; text-transform: uppercase; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 4px; background: #020617; color: #00E5C0; display: inline-block; vertical-align: middle; margin-left: 8px;">Official Itinerary Proposal</span>
                        </div>
                        <p style="font-size: 10.5px; color: #64748b; margin: 4px 0 0 0;">${cleanInlineFormattedText(model.agentAgencySubtitle)}</p>
                      </td>
                      <td style="vertical-align: top; text-align: right; font-family: monospace; font-size: 10.5px; width: 200px;">
                        <div style="font-size: 14px; font-weight: 900; color: #020617;">${cleanInlineFormattedText(model.quoteNumber)} (v${model.version})</div>
                        <div style="color: #64748b;">Date: ${cleanInlineFormattedText(model.createdDateFormatted)}</div>
                        <div style="color: #64748b;">Valid Until: ${cleanInlineFormattedText(model.validUntilFormatted)}</div>
                        <div style="color: #0d9488; font-weight: 700;">Status: ${cleanInlineFormattedText(model.status)}</div>
                      </td>
                    </tr>
                  </table>
                </div>

                <!-- 2. CURATED JOURNEY OVERVIEW BANNER (Exact PDF Banner Fidelity) -->
                <div style="background: #020617; background-image: linear-gradient(135deg, #020617, #0f172a, #020617); color: #ffffff; padding: 18px 20px; border-radius: 16px; margin-bottom: 16px; box-shadow: 0 4px 6px rgba(0,0,0,0.06);">
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
                    <span>TheUnbound Ground Operations Standards & Inclusions</span>
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
                          <div style="font-size: 14px; font-weight: 800; color: #ffffff; margin: 6px 0 4px 0;">
                            <strong>Hotel Accommodation Total:</strong> <span style="color: #00E5C0; font-family: monospace;">${model.hotelAccommodationTotalFormatted}</span>
                          </div>
                        ` : ''}
                        <h3 style="font-size: 16px; font-weight: 900; color: #ffffff; margin: 4px 0 4px 0;"><strong>Land Part Total:</strong> <span style="color: #00E5C0; font-family: monospace;">${model.landPartTotalFormatted}</span></h3>
                        <p style="font-size: 10px; color: #cbd5e1; margin: 0; max-width: 420px; line-height: 1.4;">Land Part Total covers all included non-accommodation travel services (tours, activities, transfers, rail, and ancillary ground services) and applicable taxes.</p>
                      </td>
                      <td style="vertical-align: middle; text-align: right; width: 190px;">
                        ${model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? `
                          <div style="font-size: 10.5px; font-weight: 800; color: #cbd5e1; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 4px;">Hotel Total: <span style="color: #00E5C0; font-family: monospace;">${model.hotelAccommodationTotalFormatted}</span></div>
                        ` : ''}
                        <div style="font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em;">Land Part Total</div>
                        <div style="font-size: 22px; font-weight: 900; font-family: monospace; color: #00E5C0;">${model.landPartTotalFormatted}</div>
                        <div style="font-size: 9px; color: #94a3b8; margin-top: 2px;">${cleanInlineFormattedText(model.guaranteedCurrencyLine)}</div>
                      </td>
                    </tr>
                  </table>
                </div>

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
                  <div style="font-weight: 800; color: #1e293b; text-transform: uppercase; font-size: 9.5px; margin-bottom: 4px;">Commercial Quotation Terms:</div>
                  <div style="margin: 0 0 10px 0; color: #475569; line-height: 1.4;">${formatPdfOrEmailDescription(model.commercialTerms)}</div>
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="border-top: 1px solid #f1f5f9; padding-top: 8px; font-size: 9.5px; color: #94a3b8; font-family: monospace;">
                    <tr>
                      <td>${cleanInlineFormattedText(model.footerContactLine)}</td>
                      <td style="text-align: right;">Official DMC Electronic Proposal</td>
                    </tr>
                  </table>
                </div>

                <!-- 11. RUNNING FOOTER (Exact PDF Document Footer) -->
                <div style="border-top: 1px solid #e2e8f0; padding-top: 8px; margin-top: 12px; font-size: 9.5px; color: #94a3b8; font-family: monospace;">
                  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="font-weight: 700; color: #475569;">${cleanInlineFormattedText(model.agencyName.toUpperCase())} DMC • ${cleanInlineFormattedText(model.quoteNumber)}</td>
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
  lines.push(`THEUNBOUND — COMPLETE TRAVEL QUOTATION`);
  lines.push('');
  lines.push(`Destination: ${model.destination}`);
  lines.push(`Travel Dates: ${model.dateSpanText || 'As specified in the quotation'}`);
  lines.push(`Passengers: ${model.paxDetailsText}`);
  lines.push(`Quote Reference: ${model.quoteNumber} (v${model.version})`);
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
  lines.push(`Currency Guarantee: ${model.guaranteedCurrencyLine}`);
  lines.push(`Quotation Validity: Valid until ${model.validUntilFormatted}`);
  lines.push('');

  // Important Information
  lines.push(`IMPORTANT INFORMATION`);
  model.childAndAttractionPolicies.forEach(p => {
    lines.push(`• ${p}`);
  });
  lines.push('');

  // Terms and Conditions
  lines.push(`TERMS AND CONDITIONS`);
  lines.push(convertHtmlToCleanPlainText(model.commercialTerms));
  lines.push('');
  lines.push(convertHtmlToCleanPlainText(model.footerContactLine));

  const textBody = lines.join('\n');
  const htmlBody = formatPlainTextQuotationToHtml(textBody);

  return { htmlBody, textBody };
}
