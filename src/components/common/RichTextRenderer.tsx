import React, { useMemo } from 'react';
import { sanitizeRichText, isHtmlContent, convertPlainTextToSemanticHtml } from '../../utils/richTextFormatter';

export interface RichTextRendererProps {
  content?: string | null;
  className?: string;
  fallback?: string;
  lineClamp?: number;
}

/**
 * ============================================================================
 * THEUNBOUND — SHARED RICH TEXT DESCRIPTION RENDERER
 * Formats, sanitizes, and renders travel product descriptions with
 * semantic typography hierarchy.
 * ============================================================================
 */
export const RichTextRenderer: React.FC<RichTextRendererProps> = ({
  content,
  className = '',
  fallback = '',
  lineClamp
}) => {
  const sanitizedHtml = useMemo(() => {
    const raw = content || fallback || '';
    if (!raw.trim()) return '';

    // If it's not HTML yet, convert plain text / markdown to semantic HTML first
    const htmlToSanitize = isHtmlContent(raw) ? raw : convertPlainTextToSemanticHtml(raw);
    return sanitizeRichText(htmlToSanitize);
  }, [content, fallback]);

  if (!sanitizedHtml) {
    return null;
  }

  const clampStyle = lineClamp
    ? {
        display: '-webkit-box',
        WebkitLineClamp: lineClamp,
        WebkitBoxOrient: 'vertical' as const,
        overflow: 'hidden'
      }
    : undefined;

  return (
    <div
      className={`theunbound-rich-text text-slate-700 text-xs sm:text-sm leading-relaxed ${className}`}
      style={clampStyle}
      dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
    />
  );
};
