/**
 * ============================================================================
 * THEUNBOUND — RICH-TEXT FORMATTER & SANITIZATION UTILITIES
 * Canonical Content Formatter for Travel Descriptions
 * ============================================================================
 *
 * Rules:
 * - Safe sanitization allowing strictly travel-safe semantic tags:
 *   <p>, <h2>, <h3>, <h4>, <strong>, <b>, <em>, <i>, <ul>, <ol>, <li>, <a>, <br>, <span>.
 * - Disallow all executable scripts, iframes, objects, embeds, and event handlers.
 * - Graceful backward compatibility: Plain-text input is automatically parsed into
 *   clean semantic paragraphs, headings, and lists.
 * - Support exports to Plain-Text, WhatsApp formatted text, and PDF format.
 */

const ALLOWED_TAGS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 'u', 's', 'del', 'strike',
  'ul', 'ol', 'li', 'a', 'br', 'span', 'hr', 'blockquote', 'div', 'font'
]);

/**
 * Checks if a string contains HTML tags
 */
export function isHtmlContent(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return /<[a-z][\s\S]*>/i.test(text);
}

/**
 * Converts plain text into clean semantic HTML with paragraphs, headings, and lists.
 */
export function convertPlainTextToSemanticHtml(plainText: string): string {
  if (!plainText || typeof plainText !== 'string') return '';
  const trimmed = plainText.trim();
  if (!trimmed) return '';

  // If already HTML, return sanitized version
  if (isHtmlContent(trimmed)) {
    return sanitizeRichText(trimmed);
  }

  // Split lines
  const lines = trimmed.split(/\r?\n/);
  const resultBlocks: string[] = [];
  let currentList: { type: 'ul' | 'ol'; items: string[] } | null = null;
  let currentParagraphLines: string[] = [];

  const flushParagraph = () => {
    if (currentParagraphLines.length > 0) {
      const pText = currentParagraphLines.join(' ').trim();
      if (pText) {
        resultBlocks.push(`<p>${formatInlineMarkdown(pText)}</p>`);
      }
      currentParagraphLines = [];
    }
  };

  const flushList = () => {
    if (currentList && currentList.items.length > 0) {
      const itemsHtml = currentList.items
        .map(item => `<li>${formatInlineMarkdown(item)}</li>`)
        .join('');
      resultBlocks.push(`<${currentList.type}>${itemsHtml}</${currentList.type}>`);
      currentList = null;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const line = rawLine.trim();

    // Blank line -> Paragraph break
    if (!line) {
      flushParagraph();
      flushList();
      continue;
    }

    // Markdown Heading 2: ## Heading
    // Horizontal rule: --- or ***
    if (/^(?:---|\*\*\*|___)$/.test(line)) {
      flushParagraph();
      flushList();
      resultBlocks.push('<hr/>');
      continue;
    }

    // Blockquote: > text
    if (/^>\s+(.+)$/.test(line)) {
      flushParagraph();
      flushList();
      const quoteMatch = line.match(/^>\s+(.+)$/);
      if (quoteMatch) {
        resultBlocks.push(`<blockquote><p>${formatInlineMarkdown(quoteMatch[1])}</p></blockquote>`);
      }
      continue;
    }

    // Markdown Heading 1: # Heading
    if (/^#\s+(.+)$/.test(line)) {
      flushParagraph();
      flushList();
      const match = line.match(/^#\s+(.+)$/);
      if (match) {
        resultBlocks.push(`<h1>${formatInlineMarkdown(match[1])}</h1>`);
      }
      continue;
    }

    // Markdown Heading 2: ## Heading
    if (/^##\s+(.+)$/.test(line)) {
      flushParagraph();
      flushList();
      const match = line.match(/^##\s+(.+)$/);
      if (match) {
        resultBlocks.push(`<h2>${formatInlineMarkdown(match[1])}</h2>`);
      }
      continue;
    }

    // Markdown Heading 3: ### Heading
    if (/^###\s+(.+)$/.test(line)) {
      flushParagraph();
      flushList();
      const match = line.match(/^###\s+(.+)$/);
      if (match) {
        resultBlocks.push(`<h3>${formatInlineMarkdown(match[1])}</h3>`);
      }
      continue;
    }

    // Markdown Heading 4: #### Heading
    if (/^####\s+(.+)$/.test(line)) {
      flushParagraph();
      flushList();
      const match = line.match(/^####\s+(.+)$/);
      if (match) {
        resultBlocks.push(`<h4>${formatInlineMarkdown(match[1])}</h4>`);
      }
      continue;
    }

    // Unordered List item: - Item, * Item, • Item
    const bulletMatch = line.match(/^[-*•]\s+(.+)$/);
    if (bulletMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ul') {
        flushList();
        currentList = { type: 'ul', items: [] };
      }
      currentList.items.push(bulletMatch[1]);
      continue;
    }

    // Ordered List item: 1. Item, 2) Item
    const orderedMatch = line.match(/^(\d+)[.)]\s+(.+)$/);
    if (orderedMatch) {
      flushParagraph();
      if (!currentList || currentList.type !== 'ol') {
        flushList();
        currentList = { type: 'ol', items: [] };
      }
      currentList.items.push(orderedMatch[2]);
      continue;
    }

    // Regular line -> Accumulate into current paragraph
    flushList();
    currentParagraphLines.push(line);
  }

  flushParagraph();
  flushList();

  return resultBlocks.length > 0 ? resultBlocks.join('') : `<p>${formatInlineMarkdown(trimmed)}</p>`;
}

/**
 * Formats inline bold (**text**), italic (*text*), strikethrough (~~text~~), and links [text](url)
 */
function formatInlineMarkdown(text: string): string {
  if (!text) return '';
  return text
    // Strikethrough: ~~text~~
    .replace(/~~(.*?)~~/g, '<del>$1</del>')
    // Bold: **text** or __text__
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/__(.*?)__/g, '<strong>$1</strong>')
    // Italic: *text* or _text_
    .replace(/(?<!\*)\*(?!\*)(.*?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    .replace(/(?<!_)_(?!_)(.*?)(?<!_)_(?!_)/g, '<em>$1</em>')
    // Markdown link: [text](url)
    .replace(/\[(.*?)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
}

/**
 * Sanitizes rich HTML string, stripping unsafe tags and attributes.
 */
export function sanitizeRichText(inputHtml: string): string {
  if (!inputHtml || typeof inputHtml !== 'string') return '';
  const trimmed = inputHtml.trim();
  if (!trimmed) return '';

  // If plain text without tags, convert to semantic HTML
  if (!isHtmlContent(trimmed)) {
    return convertPlainTextToSemanticHtml(trimmed);
  }

  // Browser-safe DOM sanitization
  if (typeof window !== 'undefined' && typeof DOMParser !== 'undefined') {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(`<div>${trimmed}</div>`, 'text/html');
      const container = doc.body.firstElementChild || doc.body;

      sanitizeDomNode(container);

      // Clean empty paragraphs or invalid empty containers
      const cleanHtml = container.innerHTML.trim();
      return cleanHtml;
    } catch (e) {
      console.warn('DOMParser failed to sanitize HTML, using regex fallback:', e);
    }
  }

  // Fallback regex-based sanitizer for server/testing environments
  return fallbackRegexSanitize(trimmed);
}

/**
 * Recursively cleans a DOM element and its children
 */
function sanitizeDomNode(node: Node): void {
  const children = Array.from(node.childNodes);

  for (const child of children) {
    if (child.nodeType === Node.ELEMENT_NODE) {
      const elem = child as HTMLElement;
      const tagName = elem.tagName.toLowerCase();

      // If tag is not allowed, replace with its text content or unwrap
      if (!ALLOWED_TAGS.has(tagName)) {
        if (tagName === 'script' || tagName === 'style' || tagName === 'iframe' || tagName === 'object') {
          elem.remove();
        } else {
          // Unwrap allowed children or replace with text
          const fragment = document.createDocumentFragment();
          while (elem.firstChild) {
            fragment.appendChild(elem.firstChild);
          }
          elem.parentNode?.replaceChild(fragment, elem);
        }
        continue;
      }

      // Clean attributes on allowed elements
      const attrNames = Array.from(elem.attributes).map(a => a.name);
      for (const attr of attrNames) {
        if (tagName === 'a' && attr === 'href') {
          const href = elem.getAttribute('href') || '';
          // Only allow safe protocols
          if (!/^(https?:\/\/|mailto:|tel:|\/|#)/i.test(href.trim())) {
            elem.removeAttribute('href');
          } else {
            elem.setAttribute('target', '_blank');
            elem.setAttribute('rel', 'noopener noreferrer');
          }
        } else if (attr === 'style') {
          // Allow only safe CSS declarations (text-align, color, font-size, font-weight, font-style, text-decoration)
          const styleVal = elem.getAttribute('style') || '';
          const safeRules: string[] = [];
          const declarations = styleVal.split(';');
          for (const decl of declarations) {
            const [prop, val] = decl.split(':').map(s => s?.trim());
            if (!prop || !val) continue;
            const pLower = prop.toLowerCase();
            if (pLower === 'text-align' && /^(left|right|center|justify)$/i.test(val)) {
              safeRules.push(`text-align: ${val}`);
            } else if (pLower === 'color' && /^#[0-9a-f]{3,8}$|^rgb\([^)]+\)$|^[a-z]+$/i.test(val)) {
              safeRules.push(`color: ${val}`);
            } else if (pLower === 'font-size' && /^[0-9.]+(?:px|em|rem|pt|%)?$/i.test(val)) {
              safeRules.push(`font-size: ${val}`);
            } else if (pLower === 'font-weight' && /^(normal|bold|bolder|[1-9]00)$/i.test(val)) {
              safeRules.push(`font-weight: ${val}`);
            } else if (pLower === 'font-style' && /^(normal|italic)$/i.test(val)) {
              safeRules.push(`font-style: ${val}`);
            } else if (pLower === 'text-decoration' && /^(none|underline|line-through)$/i.test(val)) {
              safeRules.push(`text-decoration: ${val}`);
            }
          }
          if (safeRules.length > 0) {
            elem.setAttribute('style', safeRules.join('; '));
          } else {
            elem.removeAttribute('style');
          }
        } else if (attr === 'align' && /^(left|center|right|justify)$/i.test(elem.getAttribute('align') || '')) {
          // Keep standard alignment
          elem.setAttribute('align', elem.getAttribute('align')!.toLowerCase());
        } else if (tagName === 'font' && (attr === 'color' || attr === 'size')) {
          // Keep font color and size
        } else if (attr === 'class') {
          // Only allow safe CSS classes (e.g., text alignment)
          const cls = elem.getAttribute('class') || '';
          if (/^(?:text-(?:left|center|right|justify)|theunbound-rich-text)\b/.test(cls)) {
            // keep
          } else {
            elem.removeAttribute('class');
          }
        } else {
          // Strip all other attributes (onclick, onerror, script, etc.)
          elem.removeAttribute(attr);
        }
      }

      // Recurse into valid child elements
      sanitizeDomNode(elem);
    } else if (child.nodeType === Node.COMMENT_NODE) {
      child.remove();
    }
  }
}

/**
 * Fallback regex sanitizer
 */
function fallbackRegexSanitize(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*(['"]).*?\1/gi, '')
    .replace(/\son\w+\s*=\s*[^>\s]+/gi, '')
    .replace(/javascript:[^"']*/gi, '#');
}

/**
 * Converts rich text / HTML into clean, human-readable plain text.
 */
export function richTextToPlainText(htmlOrText: string): string {
  if (!htmlOrText || typeof htmlOrText !== 'string') return '';
  const trimmed = htmlOrText.trim();
  if (!trimmed) return '';

  if (!isHtmlContent(trimmed)) {
    return trimmed;
  }

  // Replace block tags with newline breaks
  let processed = trimmed
    .replace(/<\/h[1-6]>/gi, '\n\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<[^>]+>/g, '');

  // Decode common HTML entities
  processed = processed
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return processed;
}

/**
 * Converts rich text / HTML or plain-text into clean WhatsApp-compatible formatted message
 * using native WhatsApp Markdown (*bold*, _italic_, ~strike~, ```monospace```, bullet lists)
 * and guaranteed zero literal HTML tags.
 */
export function richTextToWhatsApp(htmlOrText: string): string {
  if (!htmlOrText || typeof htmlOrText !== 'string') return '';
  let text = htmlOrText.trim();
  if (!text) return '';

  // 0. Pre-normalize: unescape any encoded HTML tags (&lt;p&gt; -> <p>, &lt;br/&gt; -> <br/>) and normalize malformed tags
  text = text.replace(/&lt;(\/?(?:p|br|div|h[1-6]|strong|b|em|i|u|s|del|strike|ul|ol|li|table|tr|td|th|tbody|thead|span|a|hr|pre|code)(?:\s+[^&>]*)?\/?)\s*&gt;/gi, '<$1>');
  text = text.replace(/<\s*\/\s*br\s*>/gi, '<br/>');
  text = text.replace(/<br\s*\/?>/gi, '<br/>');
  text = text.replace(/&nbsp;/gi, ' ');

  // 1. Monospace preformatted code
  text = text.replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, '```$1```\n\n');
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, '```$1```');

  // 2. Headings to bold lines with spacing
  text = text.replace(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/gi, (_m, content) => {
    const clean = content.replace(/<[^>]+>/g, '').trim();
    return clean ? `*${clean}*\n\n` : '\n\n';
  });

  // 3. Bold: <strong>, <b>
  text = text.replace(/<(?:strong|b)[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, (_m, content) => {
    const clean = content.trim();
    return clean ? `*${clean}*` : '';
  });

  // 4. Italic: <em>, <i>
  text = text.replace(/<(?:em|i)[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, (_m, content) => {
    const clean = content.trim();
    return clean ? `_${clean}_` : '';
  });

  // 5. Strikethrough: <del>, <s>, <strike>
  text = text.replace(/<(?:del|s|strike)[^>]*>([\s\S]*?)<\/(?:del|s|strike)>/gi, (_m, content) => {
    const clean = content.trim();
    return clean ? `~${clean}~` : '';
  });

  // 6. Lists: <li>
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, (_m, content) => {
    const clean = content.trim();
    return clean ? `• ${clean}\n` : '';
  });
  text = text.replace(/<\/(?:ul|ol)>/gi, '\n');
  text = text.replace(/<(?:ul|ol)[^>]*>/gi, '');

  // 7. Paragraphs and line breaks
  text = text.replace(/<\/p>/gi, '\n\n');
  text = text.replace(/<p[^>]*>/gi, '');
  text = text.replace(/<\/div>/gi, '\n');
  text = text.replace(/<div[^>]*>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/br>/gi, '\n');
  text = text.replace(/<hr\s*\/?>/gi, '\n━━━━━━━━━━━━━━━━━━━━\n');

  // 8. Strip all remaining HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // 9. Entity decoding
  text = text
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));

  // 10. Post-decoding sanity sweep to guarantee zero literal HTML tags (e.g. from nested/double-escaped entities)
  text = text.replace(/<[^>]+>/g, '');

  // 11. Clean excessive whitespace and newlines
  text = text
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}

/**
 * Gracefully splits a long WhatsApp message at paragraph boundaries (\n\n) or line boundaries
 * so that long narrative or full quote messages don't exceed the WhatsApp API limit (~4096 chars).
 */
export function splitWhatsAppMessage(message: string, maxChunkLength: number = 3800): string[] {
  if (!message || message.length <= maxChunkLength) return [message || ''];

  const chunks: string[] = [];
  let remaining = message.trim();

  while (remaining.length > maxChunkLength) {
    let splitIndex = remaining.lastIndexOf('\n\n', maxChunkLength);
    if (splitIndex < maxChunkLength * 0.45) {
      splitIndex = remaining.lastIndexOf('\n', maxChunkLength);
    }
    if (splitIndex < maxChunkLength * 0.45) {
      splitIndex = remaining.lastIndexOf('. ', maxChunkLength);
      if (splitIndex > 0) splitIndex += 1;
    }
    if (splitIndex < maxChunkLength * 0.3) {
      splitIndex = maxChunkLength;
    }

    const chunk = remaining.slice(0, splitIndex).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.slice(splitIndex).trim();
  }

  if (remaining) {
    chunks.push(remaining);
  }

  if (chunks.length > 1) {
    return chunks.map((chunk, idx) => `[Part ${idx + 1}/${chunks.length}]\n\n${chunk}`);
  }

  return chunks;
}
