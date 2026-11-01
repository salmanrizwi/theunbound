import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bold, 
  Italic, 
  Underline as UnderlineIcon,
  Strikethrough as StrikethroughIcon,
  Heading1,
  Heading2, 
  Heading3, 
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
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Indent,
  Outdent,
  Minus,
  Palette
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
  compact?: boolean;
}

interface ActiveFormatState {
  isBold: boolean;
  isItalic: boolean;
  isUnderline: boolean;
  isStrike: boolean;
  isBulletList: boolean;
  isNumberedList: boolean;
  blockType: 'p' | 'h1' | 'h2' | 'h3' | 'div';
  alignment: 'left' | 'center' | 'right' | 'justify';
}

const COLOR_PALETTE = [
  { label: 'Default Slate', value: '#0f172a' },
  { label: 'Brand Teal', value: '#008972' },
  { label: 'Ocean Navy', value: '#1d4ed8' },
  { label: 'Emerald Green', value: '#047857' },
  { label: 'Amber Gold', value: '#b45309' },
  { label: 'Crimson Red', value: '#dc2626' },
  { label: 'Muted Slate', value: '#64748b' }
];

/**
 * ============================================================================
 * THEUNBOUND — WYSIWYG RICH TEXT EDITOR
 * Professional Travel Product & Quotation Content Editor
 * ============================================================================
 */
export const RichTextEditor: React.FC<RichTextEditorProps> = ({
  value = '',
  onChange,
  placeholder = 'Write a structured description with headings, paragraphs, and lists...',
  minHeight = '140px',
  disabled = false,
  label,
  helperText,
  compact = false
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'EDIT' | 'PREVIEW'>('EDIT');
  const [isFocused, setIsFocused] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkText, setLinkText] = useState('');
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const savedSelectionRangeRef = useRef<Range | null>(null);

  const [formatState, setFormatState] = useState<ActiveFormatState>({
    isBold: false,
    isItalic: false,
    isUnderline: false,
    isStrike: false,
    isBulletList: false,
    isNumberedList: false,
    blockType: 'p',
    alignment: 'left'
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
      const isUnderline = document.queryCommandState('underline');
      const isStrike = document.queryCommandState('strikeThrough');
      const isBulletList = document.queryCommandState('insertUnorderedList');
      const isNumberedList = document.queryCommandState('insertOrderedList');
      const formatBlock = (document.queryCommandValue('formatBlock') || '').toLowerCase();

      let blockType: 'p' | 'h1' | 'h2' | 'h3' | 'div' = 'p';
      if (formatBlock.includes('h1')) blockType = 'h1';
      else if (formatBlock.includes('h2')) blockType = 'h2';
      else if (formatBlock.includes('h3')) blockType = 'h3';
      else if (formatBlock.includes('p')) blockType = 'p';

      let alignment: 'left' | 'center' | 'right' | 'justify' = 'left';
      if (document.queryCommandState('justifyCenter')) alignment = 'center';
      else if (document.queryCommandState('justifyRight')) alignment = 'right';
      else if (document.queryCommandState('justifyFull')) alignment = 'justify';

      setFormatState({
        isBold,
        isItalic,
        isUnderline,
        isStrike,
        isBulletList,
        isNumberedList,
        blockType,
        alignment
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

  const executeCommand = (command: string, cmdValue: string | undefined = undefined) => {
    if (disabled || activeTab !== 'EDIT') return;

    editorRef.current?.focus();
    document.execCommand(command, false, cmdValue);
    handleInput();
  };

  // Block Formatting (Paragraph, H1, H2, H3)
  const setBlockFormat = (tag: 'p' | 'h1' | 'h2' | 'h3') => {
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

  // Apply Text Color
  const applyTextColor = (color: string) => {
    executeCommand('foreColor', color);
    setIsColorPickerOpen(false);
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

  // Keyboard Shortcuts (Ctrl+B, Ctrl+I, Ctrl+U, Ctrl+Z, Ctrl+Y)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const modKey = isMac ? e.metaKey : e.ctrlKey;

    if (modKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        executeCommand('bold');
      } else if (key === 'i') {
        e.preventDefault();
        executeCommand('italic');
      } else if (key === 'u') {
        e.preventDefault();
        executeCommand('underline');
      } else if (key === 'z') {
        e.preventDefault();
        if (e.shiftKey) {
          executeCommand('redo');
        } else {
          executeCommand('undo');
        }
      } else if (key === 'y') {
        e.preventDefault();
        executeCommand('redo');
      }
    }
  };

  // Clean pasted content to avoid messy styles from Word/Web
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const htmlData = e.clipboardData.getData('text/html');
    const textData = e.clipboardData.getData('text/plain');

    if (htmlData) {
      const sanitized = sanitizeRichText(htmlData);
      document.execCommand('insertHTML', false, sanitized);
      handleInput();
    } else if (textData) {
      const formatted = textData.includes('\n\n') || textData.startsWith('#') || textData.startsWith('-')
        ? convertPlainTextToSemanticHtml(textData)
        : textData.replace(/\n/g, '<br/>');
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
        <div className="bg-slate-50/95 border-b border-slate-200/80 px-2.5 py-1.5 flex flex-wrap items-center justify-between gap-1.5 select-none">
          {/* Main Formatting Actions */}
          <div className="flex flex-wrap items-center gap-1">
            {/* Heading 1 */}
            <button
              type="button"
              onClick={() => setBlockFormat('h1')}
              title="Heading 1"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-0.5 cursor-pointer ${
                formatState.blockType === 'h1'
                  ? 'bg-[#00C6A6]/20 text-[#008972] border border-[#00C6A6]/40 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Heading1 className="w-3.5 h-3.5" />
              <span className="text-[10px]">H1</span>
            </button>

            {/* Heading 2 */}
            <button
              type="button"
              onClick={() => setBlockFormat('h2')}
              title="Heading 2 (Main Section)"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-0.5 cursor-pointer ${
                formatState.blockType === 'h2'
                  ? 'bg-[#00C6A6]/20 text-[#008972] border border-[#00C6A6]/40 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Heading2 className="w-3.5 h-3.5" />
              <span className="text-[10px]">H2</span>
            </button>

            {/* Heading 3 */}
            <button
              type="button"
              onClick={() => setBlockFormat('h3')}
              title="Heading 3 (Subsection)"
              className={`p-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-0.5 cursor-pointer ${
                formatState.blockType === 'h3'
                  ? 'bg-[#00C6A6]/20 text-[#008972] border border-[#00C6A6]/40 shadow-2xs font-black'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <Heading3 className="w-3.5 h-3.5" />
              <span className="text-[10px]">H3</span>
            </button>

            {/* Normal Paragraph */}
            <button
              type="button"
              onClick={() => setBlockFormat('p')}
              title="Normal Paragraph"
              className={`px-1.5 py-1 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                formatState.blockType === 'p'
                  ? 'bg-slate-200 text-slate-800'
                  : 'text-slate-500 hover:text-slate-800 hover:bg-slate-200/60'
              }`}
            >
              ¶
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

            {/* Underline */}
            <button
              type="button"
              onClick={() => executeCommand('underline')}
              title="Underline (Ctrl+U)"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                formatState.isUnderline
                  ? 'bg-[#00C6A6]/20 text-[#008972] font-bold border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <UnderlineIcon className="w-3.5 h-3.5" />
            </button>

            {/* Strikethrough */}
            <button
              type="button"
              onClick={() => executeCommand('strikeThrough')}
              title="Strikethrough"
              className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                formatState.isStrike
                  ? 'bg-[#00C6A6]/20 text-[#008972] font-bold border border-[#00C6A6]/40 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
              }`}
            >
              <StrikethroughIcon className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Text Alignment */}
            <div className="flex items-center space-x-0.5">
              <button
                type="button"
                onClick={() => executeCommand('justifyLeft')}
                title="Align Left"
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  formatState.alignment === 'left'
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <AlignLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand('justifyCenter')}
                title="Align Center"
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  formatState.alignment === 'center'
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <AlignCenter className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand('justifyRight')}
                title="Align Right"
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  formatState.alignment === 'right'
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <AlignRight className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => executeCommand('justifyFull')}
                title="Justify"
                className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
                  formatState.alignment === 'justify'
                    ? 'bg-slate-200 text-slate-800'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <AlignJustify className="w-3.5 h-3.5" />
              </button>
            </div>

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

            {/* Indent & Outdent */}
            <button
              type="button"
              onClick={() => executeCommand('outdent')}
              title="Decrease Indent"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <Outdent className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('indent')}
              title="Increase Indent"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <Indent className="w-3.5 h-3.5" />
            </button>

            {/* Horizontal Divider Rule */}
            <button
              type="button"
              onClick={() => executeCommand('insertHorizontalRule')}
              title="Insert Horizontal Divider"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <div className="h-4 w-px bg-slate-200 mx-0.5" />

            {/* Text Color Picker */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsColorPickerOpen(prev => !prev)}
                title="Text Color"
                className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer flex items-center space-x-0.5"
              >
                <Palette className="w-3.5 h-3.5 text-teal-700" />
              </button>

              {isColorPickerOpen && (
                <div className="absolute top-full left-0 mt-1 z-30 bg-white border border-slate-200 shadow-xl rounded-xl p-2 flex items-center gap-1.5 animate-in fade-in duration-100">
                  {COLOR_PALETTE.map((c) => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => applyTextColor(c.value)}
                      title={c.label}
                      style={{ backgroundColor: c.value }}
                      className="w-5 h-5 rounded-full border border-slate-300 hover:scale-115 transition-transform cursor-pointer"
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setIsColorPickerOpen(false)}
                    className="text-slate-400 hover:text-slate-700 p-0.5 ml-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              )}
            </div>

            {/* Link */}
            <button
              type="button"
              onClick={handleOpenLinkModal}
              title="Insert Link"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <LinkIcon className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => executeCommand('unlink')}
              title="Remove Link"
              className="p-1.5 rounded-lg text-xs text-slate-600 hover:text-slate-900 hover:bg-slate-200/60 transition-all cursor-pointer"
            >
              <Unlink className="w-3.5 h-3.5" />
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
              <span>Preview</span>
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
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            style={{ minHeight }}
            data-placeholder={placeholder}
            className={`theunbound-rich-text p-3.5 text-xs sm:text-sm text-slate-800 focus:outline-none overflow-y-auto leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 empty:before:pointer-events-none ${
              compact ? 'text-xs leading-normal py-2.5 px-3' : ''
            }`}
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
                No narrative entered yet. Switch to Editor to create structured content.
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
