import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Heading2, 
  Heading3, 
  Heading4, 
  List, 
  ListOrdered, 
  Link as LinkIcon, 
  Unlink, 
  Undo, 
  Redo, 
  RemoveFormatting, 
  Eye, 
  Edit3,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { sanitizeRichText, isHtmlContent, convertPlainTextToSemanticHtml } from '../../utils/richTextFormatter';
import { RichTextRenderer } from './RichTextRenderer';

export interface RichTextEditorProps {
  value?: string;
  onChange: (htmlValue: string) => void;
  placeholder?: string;
  minHeight?: string;
  disabled?: boolean;
  label?: string;
  helperText?: string;
}

interface ActiveFormatState {
  isBold: boolean;
  isItalic: boolean;
  isBulletList: boolean;
  isNumberedList: boolean;
  blockType: 'p' | 'h2' | 'h3' | 'h4' | 'div';
}

/**
 * ============================================================================
 * THEUNBOUND — WYSIWYG RICH TEXT EDITOR
 * Professional Travel Product Content Editor
 * ============================================================================
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = 'Write a structured description with headings, paragraphs, and lists...',
  minHeight = '180px',
  disabled = false,
  label,
  helperText
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'EDIT' | 'PREVIEW'>('EDIT');
  const [isFocused, setIsFocused] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const savedSelectionRangeRef = useRef<Range | null>(null);

  const [formatState, setFormatState] = useState<ActiveFormatState>({
    isBold: false,
    isItalic: false,
    isBulletList: false,
    isNumberedList: false,
    blockType: 'p'
  });

  // Track the last emitted HTML to avoid cursor jumping loops
  const lastHtmlEmittedRef = useRef<string>('');

  // Format initial or externally changed value into semantic HTML
  const formatInputToHtml = useCallback((raw: string): string => {
    if (!raw) return '';
    const trimmed = raw.trim();
    if (!trimmed) return '';
    if (!isHtmlContent(trimmed)) {
      return convertPlainTextToSemanticHtml(trimmed);
    }
    return sanitizeRichText(trimmed);
  }, []);

  // Update innerHTML when external value changes and differs from current content
  useEffect(() => {
    if (editorRef.current) {
      const normalizedProp = formatInputToHtml(value || '');
      const currentHtml = editorRef.current.innerHTML;

      // Only update DOM if the content has meaningfully changed
      if (normalizedProp !== lastHtmlEmittedRef.current && normalizedProp !== currentHtml) {
        editorRef.current.innerHTML = normalizedProp;
        lastHtmlEmittedRef.current = normalizedProp;
      }
    }
  }, [value, formatInputToHtml]);

  // Update active formatting states from document selection
  const checkActiveFormats = useCallback(() => {
    if (!editorRef.current || typeof document === 'undefined') return;

    try {
      const isBold = document.queryCommandState('bold');
      const isItalic = document.queryCommandState('italic');
      const isBulletList = document.queryCommandState('insertUnorderedList');
      const isNumberedList = document.queryCommandState('insertOrderedList');
      const formatBlock = (document.queryCommandValue('formatBlock') || '').toLowerCase();

      let blockType: 'p' | 'h2' | 'h3' | 'h4' | 'div' = 'p';
      if (formatBlock.includes('h2')) blockType = 'h2';
      else if (formatBlock.includes('h3')) blockType = 'h3';
      else if (formatBlock.includes('h4')) blockType = 'h4';
      else if (formatBlock.includes('p')) blockType = 'p';

      setFormatState({
        isBold,
        isItalic,
        isBulletList,
        isNumberedList,
        blockType
      });
    } catch {
      // Ignore queryCommand errors in unusual selection states
    }
  }, []);

  const handleInput = () => {
    if (!editorRef.current) return;
    const rawHtml = editorRef.current.innerHTML;
    const cleanHtml = sanitizeRichText(rawHtml);
    lastHtmlEmittedRef.current = cleanHtml;
    onChange(cleanHtml);
    checkActiveFormats();
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (!editorRef.current) return;
    const rawHtml = editorRef.current.innerHTML;
    const cleanHtml = sanitizeRichText(rawHtml);
    lastHtmlEmittedRef.current = cleanHtml;
    onChange(cleanHtml);
  };

  const executeCommand = (command: string, value: string | undefined = undefined) => {
    if (disabled || activeTab !== 'EDIT') return;

    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  // Block Formatting (Paragraph, H2, H3, H4)
  const setBlockFormat = (tag: 'p' | 'h2' | 'h3' | 'h4') => {
    if (disabled || activeTab !== 'EDIT') return;
    editorRef.current?.focus();

    if (formatState.blockType === tag) {
      // Toggle back to normal paragraph
      document.execCommand('formatBlock', false, '<p>');
    } else {
      document.execCommand('formatBlock', false, `<${tag}>`);
    }
    handleInput();
  };

  // Link Insertion
  const handleOpenLinkModal = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      savedSelectionRangeRef.current = sel.getRangeAt(0).cloneRange();
      const selectedText = sel.toString();
      setLinkText(selectedText);
    } else {
      savedSelectionRangeRef.current = null;
      setLinkText('');
    }
    setLinkUrl('https://');
    setIsLinkModalOpen(true);
  };

  const handleConfirmLink = () => {
    setIsLinkModalOpen(false);
    editorRef.current?.focus();

    if (savedSelectionRangeRef.current) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(savedSelectionRangeRef.current);
    }

    if (linkUrl.trim() && linkUrl !== 'https://') {
      const safeUrl = linkUrl.trim();
      if (linkText.trim()) {
        const linkHtml = `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${linkText.trim()}</a>`;
        document.execCommand('insertHTML', false, linkHtml);
      } else {
        document.execCommand('createLink', false, safeUrl);
      }
      handleInput();
    }
  };

  // Clean pasted content to avoid messy styles from Word/Web
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    if (text) {
      const formatted = text.includes('\n\n') || text.startsWith('#') || text.startsWith('-')
        ? convertPlainTextToSemanticHtml(text)
        : text.replace(/\n/g, '<br/>');
      document.execCommand('insertHTML', false, formatted);
      handleInput();
    }
  };

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <div className="flex items-center justify-between">
          <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            {label}
          </label>
          <span className="text-[10px] text-slate-400 font-medium">
            WYSIWYG Rich Text
          </span>
        </div>
      )}

      {/* Editor Container Card */}
      <div 
        className={`w-full bg-white border rounded-xl shadow-xs transition-all overflow-hidden flex flex-col ${
          isFocused 
            ? 'border-[#00C6A6] ring-2 ring-[#00C6A6]/20' 
            : 'border-slate-200 hover:border-slate-300'
        } ${disabled ? 'opacity-60 pointer-events-none' : ''}`}
      >
        {/* Top Formatting Toolbar */}
        <div className="bg-slate-50/90 border-b border-slate-200/80 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1 select-none">
          {/* Main Formatting Actions */}
          <div className="flex flex-wrap items-center gap-1">
            {/* Heading 2 */}
            <button
              type="button"
              onClick={() => setBlockFormat('h2')}
              title="Heading 2 (Main Section)"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                formatState.blockType === 'h2'
                  ? 'bg-[#00C6A6]/20 text-[#008972] border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Heading2 className="w-3.5 h-3.5" />
              <span className="text-[11px]">H2</span>
            </button>

            {/* Heading 3 */}
            <button
              type="button"
              onClick={() => setBlockFormat('h3')}
              title="Heading 3 (Subsection)"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                formatState.blockType === 'h3'
                  ? 'bg-[#00C6A6]/20 text-[#008972] border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Heading3 className="w-3.5 h-3.5" />
              <span className="text-[11px]">H3</span>
            </button>

            {/* Heading 4 */}
            <button
              type="button"
              onClick={() => setBlockFormat('h4')}
              title="Heading 4 (Minor Heading)"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer ${
                formatState.blockType === 'h4'
                  ? 'bg-[#00C6A6]/20 text-[#008972] border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Heading4 className="w-3.5 h-3.5" />
              <span className="text-[11px]">H4</span>
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Bold */}
            <button
              type="button"
              onClick={() => executeCommand('bold')}
              title="Bold (Ctrl+B)"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                formatState.isBold
                  ? 'bg-[#00C6A6]/20 text-[#008972] font-bold border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Bold className="w-3.5 h-3.5" />
            </button>

            {/* Italic */}
            <button
              type="button"
              onClick={() => executeCommand('italic')}
              title="Italic (Ctrl+I)"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                formatState.isItalic
                  ? 'bg-[#00C6A6]/20 text-[#008972] font-bold border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Italic className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Bullet List */}
            <button
              type="button"
              onClick={() => executeCommand('insertUnorderedList')}
              title="Bullet List"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                formatState.isBulletList
                  ? 'bg-[#00C6A6]/20 text-[#008972] font-bold border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <List className="w-3.5 h-3.5" />
            </button>

            {/* Numbered List */}
            <button
              type="button"
              onClick={() => executeCommand('insertOrderedList')}
              title="Numbered List"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                formatState.isNumberedList
                  ? 'bg-[#00C6A6]/20 text-[#008972] font-bold border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <ListOrdered className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Link */}
            <button
              type="button"
              onClick={handleOpenLinkModal}
              title="Insert Link"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>

            {/* Remove Format */}
            <button
              type="button"
              onClick={() => executeCommand('removeFormat')}
              title="Clear Formatting"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <RemoveFormatting className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Undo / Redo */}
            <button
              type="button"
              onClick={() => executeCommand('undo')}
              title="Undo (Ctrl+Z)"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <Undo className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('redo')}
              title="Redo (Ctrl+Y)"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <Redo className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Mode Switcher: Visual Editor / Live Preview */}
          <div className="flex items-center bg-slate-200/70 p-0.5 rounded-lg text-[11px] font-bold">
            <button
              type="button"
              onClick={() => setActiveTab('EDIT')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'EDIT'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Edit3 className="w-3 h-3" />
              <span>Editor</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('PREVIEW')}
              className={`flex items-center space-x-1 px-2 py-1 rounded-md transition-all cursor-pointer ${
                activeTab === 'PREVIEW'
                  ? 'bg-white text-slate-900 shadow-2xs font-extrabold'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3 h-3" />
              <span>Live Preview</span>
            </button>
          </div>
        </div>

        {/* Content Area */}
        {activeTab === 'EDIT' ? (
          <div
            ref={editorRef}
            contentEditable={!disabled}
            onInput={handleInput}
            onFocus={() => {
              setIsFocused(true);
              checkActiveFormats();
            }}
            onBlur={handleBlur}
            onKeyUp={checkActiveFormats}
            onMouseUp={checkActiveFormats}
            onPaste={handlePaste}
            style={{ minHeight }}
            data-placeholder={placeholder}
            className="theunbound-rich-text p-3.5 text-xs sm:text-sm text-slate-800 focus:outline-none overflow-y-auto leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none"
          />
        ) : (
          <div 
            style={{ minHeight }} 
            className="p-3.5 bg-slate-50/50 overflow-y-auto border-t border-slate-100"
          >
            {value ? (
              <RichTextRenderer content={value} />
            ) : (
              <p className="text-xs text-slate-400 italic">
                No description entered yet. Switch to Editor to create structured content.
              </p>
            )}
          </div>
        )}
      </div>

      {helperText && (
        <p className="text-[10px] text-slate-500">
          {helperText}
        </p>
      )}

      {/* Hyperlink Dialog Modal */}
      {isLinkModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/40 backdrop-blur-2xs flex items-center justify-center p-3">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full border border-slate-200 shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center space-x-2">
                <LinkIcon className="w-4 h-4 text-[#00C6A6]" />
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Insert Hyperlink
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Destination URL *
                </label>
                <input
                  type="url"
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://example.com"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#00C6A6] focus:outline-none font-mono"
                  autoFocus
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">
                  Display Text (optional)
                </label>
                <input
                  type="text"
                  value={linkText}
                  onChange={e => setLinkText(e.target.value)}
                  placeholder="e.g. Official Sightseeing Website"
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:bg-white focus:border-[#00C6A6] focus:outline-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsLinkModalOpen(false)}
                className="px-3 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmLink}
                className="px-4 py-1.5 text-xs font-bold bg-[#00C6A6] hover:bg-[#00a88c] text-slate-950 rounded-xl transition-all shadow-xs cursor-pointer flex items-center space-x-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Link</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
