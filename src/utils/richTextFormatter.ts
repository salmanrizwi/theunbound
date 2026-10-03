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
  'p', 'h2', 'h3', 'h4', 'strong', 'b', 'em', 'i', 
  'ul', 'ol', 'li', 'a', 'br', 'span'
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

    // Markdown Heading 4: #### Heading or # Heading (treat # as H2 for travel hierarchy)
    if (/^####\s+(.+)$/.test(line) || /^#\s+(.+)$/.test(line)) {
      flushParagraph();
      flushList();
      const match = line.match(/^#{1,4}\s+(.+)$/);
      if (match) {
        const tag = line.startsWith('####') ? 'h4' : 'h2';
        resultBlocks.push(`<${tag}>${formatInlineMarkdown(match[1])}</${tag}>`);
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
 * Formats simple inline bold (**text**), italic (*text*), and links [text](url)
 */
function formatInlineMarkdown(text: string): string {
  if (!text) return '';
  return text
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
        } else {
          // Strip all other attributes (onclick, style, class, etc.)
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
 * Converts rich text / HTML into WhatsApp compatible formatted message.
 */
export function richTextToWhatsApp(htmlOrText: string): string {
  if (!htmlOrText || typeof htmlOrText !== 'string') return '';
  const trimmed = htmlOrText.trim();
  if (!trimmed) return '';

  if (!isHtmlContent(trimmed)) {
    return trimmed;
  }

  let text = trimmed
    // Headings to uppercase bold
    .replace(/<h2[^>]*>(.*?)<\/h2>/gi, '*$1*\n\n')
    .replace(/<h3[^>]*>(.*?)<\/h3>/gi, '*$1*\n\n')
    .replace(/<h4[^>]*>(.*?)<\/h4>/gi, '*$1*\n\n')
    // Bold
    .replace(/<strong[^>]*>(.*?)<\/strong>/gi, '*$1*')
    .replace(/<b[^>]*>(.*?)<\/b>/gi, '*$1*')
    // Italic
    .replace(/<em[^>]*>(.*?)<\/em>/gi, '_$1_')
    .replace(/<i[^>]*>(.*?)<\/i>/gi, '_$1_')
    // Lists
    .replace(/<li[^>]*>(.*?)<\/li>/gi, '• $1\n')
    .replace(/<\/ul>/gi, '\n')
    .replace(/<\/ol>/gi, '\n')
    .replace(/<p[^>]*>(.*?)<\/p>/gi, '$1\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    // Strip remaining tags
    .replace(/<[^>]+>/g, '')
    // Entity decoding
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text;
}
