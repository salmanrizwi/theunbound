import { jsPDF } from 'jspdf';
import {
  Booking,
  BookingInvoice,
  BookingItem,
  BookingVoucher,
  CentralCompanyProfile,
  CurrencyCode
} from '../types';
import {
  formatPassengerBreakdown,
  formatReadableDate,
  groupBookingItemsByDay,
  hydrateBookingServiceItem,
  HydratedBookingServiceItem,
  resolveAuthoritativeProformaAmount,
  sanitizeVerifiedGoogleMapsUrl,
  sortBookingItemsChronologically
} from './bookingOperationsSyncService';

// ============================================================================
// PRODUCTION VECTOR PDF GENERATION ENGINE (jsPDF)
// Generates real, selectable-text, multi-page, professionally paginated PDFs:
//   1. Activity Voucher PDF
//   2. Complete Booking Voucher PDF
//   3. Proforma Invoice PDF (Final Booking Amount Only — No TAX / Service Fee)
// ============================================================================

export interface PdfLayoutBlockRecord {
  page: number;
  yStart: number;
  yEnd: number;
  label: string;
}

export interface PdfLayoutAudit {
  pageCount: number;
  hasOverlap: boolean;
  hasClipping: boolean;
  blankPages: number[];
  blocksRecorded: number;
}

export interface GeneratedPdfResult {
  pdf: jsPDF;
  filename: string;
  pageCount: number;
  layoutAudit: PdfLayoutAudit;
  toArrayBuffer: () => ArrayBuffer;
  toUint8Array: () => Uint8Array;
  download: () => void;
}

// Brand Palette (TheUnbound DMC)
const COLOR_OBSIDIAN: [number, number, number] = [11, 31, 42]; // #0B1F2A
const COLOR_TEAL: [number, number, number] = [0, 137, 114]; // #008972
const COLOR_TEAL_DARK: [number, number, number] = [0, 102, 85];
const COLOR_TEAL_SOFT: [number, number, number] = [236, 250, 247];
const COLOR_SLATE_900: [number, number, number] = [15, 23, 42];
const COLOR_SLATE_700: [number, number, number] = [51, 65, 85];
const COLOR_SLATE_500: [number, number, number] = [100, 116, 139];
const COLOR_SLATE_200: [number, number, number] = [226, 232, 240];
const COLOR_SLATE_100: [number, number, number] = [241, 245, 249];
const COLOR_SLATE_50: [number, number, number] = [248, 250, 252];
const COLOR_AMBER_BG: [number, number, number] = [255, 251, 235];
const COLOR_AMBER_BORDER: [number, number, number] = [245, 158, 11];
const COLOR_AMBER_TEXT: [number, number, number] = [146, 64, 14];
const COLOR_WHITE: [number, number, number] = [255, 255, 255];

const PAGE_W = 210; // A4 mm
const PAGE_H = 297; // A4 mm
const MARGIN_X = 14;
const CONTENT_W = PAGE_W - MARGIN_X * 2; // 182mm
const TOP_HEADER_H = 22; // Continuation header clearance
const FOOTER_RESERVE = 18;
const MAX_Y = PAGE_H - FOOTER_RESERVE; // 279mm

// ----------------------------------------------------------------------------
// UNICODE-SAFE PDF TEXT SANITIZER (Standard Helvetica WinAnsi Safe)
// Preserves Latin-1 accented characters (é, ñ, ü, ô, etc.) & clean ASCII
// Prevents garbled multi-byte glyphs in standard PDF fonts
// ----------------------------------------------------------------------------
export function sanitizePdfText(raw: unknown): string {
  if (raw === null || raw === undefined) return '';
  let text = String(raw);
  text = text
    .replace(/\u2014/g, ' -- ') // em dash
    .replace(/\u2013/g, '-') // en dash
    .replace(/\u2022/g, '-') // bullet
    .replace(/\u2018|\u2019/g, "'") // curly single quotes
    .replace(/\u201C|\u201D/g, '"') // curly double quotes
    .replace(/\u2026/g, '...') // ellipsis
    .replace(/\u2192/g, '->') // right arrow
    .replace(/\u2190/g, '<-') // left arrow
    .replace(/\u00A0/g, ' ') // non-breaking space
    .replace(/\u20B9/g, 'INR ') // Rupee
    .replace(/\u00A5/g, 'JPY ') // Yen
    .replace(/\u20AC/g, 'EUR ') // Euro
    .replace(/\u00A3/g, 'GBP ') // Pound
    .replace(/\u2713|\u2714/g, '[OK]')
    .replace(/\u00D7/g, 'x')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n');

  // Preserve printable ASCII (32-126), newline (10), tab (9), and Latin-1 Supplement (160-255)
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (
      code === 10 ||
      code === 9 ||
      (code >= 32 && code <= 126) ||
      (code >= 160 && code <= 255)
    ) {
      out += text[i];
    }
  }
  return out.replace(/[ \t]+$/gm, '').trim();
}

export function formatPdfMoney(amount: number, currency: CurrencyCode | string = 'USD'): string {
  const safeCurrency = sanitizePdfText(currency || 'USD').toUpperCase();
  const numeric = Number.isFinite(amount) ? amount : 0;
  const zeroDecimals = safeCurrency === 'JPY' || safeCurrency === 'IDR' || safeCurrency === 'KRW' || safeCurrency === 'VND';
  const formatted = numeric.toLocaleString('en-US', {
    minimumFractionDigits: zeroDecimals ? 0 : 2,
    maximumFractionDigits: zeroDecimals ? 0 : 2
  });
  return `${safeCurrency} ${formatted}`;
}

function safeFileSegment(str?: string): string {
  return (str || 'DOCUMENT')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

// ----------------------------------------------------------------------------
// PAGINATED LAYOUT ENGINE WITH REAL BOUNDING-BOX AUDIT TRACKING
// ----------------------------------------------------------------------------
class PdfLayoutEngine {
  public readonly pdf: jsPDF;
  public cursorY: number = 14;
  private readonly docTitle: string;
  private readonly docRef: string;
  private readonly bookingRef: string;
  private readonly blocks: PdfLayoutBlockRecord[] = [];
  private readonly pageHasContent: Map<number, boolean> = new Map();

  constructor(docTitle: string, docRef: string, bookingRef: string) {
    this.pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4', compress: true });
    this.docTitle = sanitizePdfText(docTitle);
    this.docRef = sanitizePdfText(docRef);
    this.bookingRef = sanitizePdfText(bookingRef);
    this.pageHasContent.set(1, false);
  }

  public getCurrentPage(): number {
    return this.pdf.getNumberOfPages();
  }

  public recordBlock(yStart: number, yEnd: number, label: string): void {
    const page = this.getCurrentPage();
    this.blocks.push({ page, yStart, yEnd, label });
    this.pageHasContent.set(page, true);
  }

  public ensureSpace(neededMm: number): void {
    if (this.cursorY + neededMm > MAX_Y) {
      this.addContinuationPage();
    }
  }

  public addContinuationPage(): void {
    this.pdf.addPage();
    const page = this.getCurrentPage();
    this.pageHasContent.set(page, false);

    // Subtle continuation header bar
    this.pdf.setFillColor(...COLOR_OBSIDIAN);
    this.pdf.rect(0, 0, PAGE_W, 13, 'F');
    this.pdf.setFillColor(...COLOR_TEAL);
    this.pdf.rect(0, 13, PAGE_W, 1.2, 'F');

    this.pdf.setTextColor(...COLOR_WHITE);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(8.5);
    this.pdf.text('THEUNBOUND', MARGIN_X, 8.3);

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8);
    this.pdf.text(`${this.docTitle}  |  Ref: ${this.docRef}`, PAGE_W - MARGIN_X, 8.3, { align: 'right' });

    this.cursorY = TOP_HEADER_H;
  }

  public drawPrimaryHeader(opts: {
    brandTitle: string;
    brandSubtitle: string;
    documentTypeBadge: string;
    documentNumber: string;
    versionLabel: string;
    statusLabel: string;
    bookingRef: string;
    issueDate: string;
  }): void {
    const startY = 0;
    const headerH = 34;

    // Obsidian banner + Teal accent strip
    this.pdf.setFillColor(...COLOR_OBSIDIAN);
    this.pdf.rect(0, startY, PAGE_W, headerH, 'F');
    this.pdf.setFillColor(...COLOR_TEAL);
    this.pdf.rect(0, headerH, PAGE_W, 1.8, 'F');

    // Left: Brand identity
    this.pdf.setTextColor(...COLOR_WHITE);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(17);
    this.pdf.text(sanitizePdfText(opts.brandTitle), MARGIN_X, 13.5);

    this.pdf.setTextColor(180, 224, 216);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8);
    this.pdf.text(sanitizePdfText(opts.brandSubtitle), MARGIN_X, 19.5);

    this.pdf.setTextColor(210, 225, 232);
    this.pdf.setFontSize(7.5);
    this.pdf.text(`Booking Ref: ${sanitizePdfText(opts.bookingRef)}   |   Issued: ${sanitizePdfText(opts.issueDate)}`, MARGIN_X, 27.5);

    // Right: Document Badge + Ref
    this.pdf.setTextColor(0, 198, 166);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(11);
    this.pdf.text(sanitizePdfText(opts.documentTypeBadge).toUpperCase(), PAGE_W - MARGIN_X, 13, { align: 'right' });

    this.pdf.setTextColor(...COLOR_WHITE);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(9.5);
    this.pdf.text(`${sanitizePdfText(opts.documentNumber)} (${sanitizePdfText(opts.versionLabel)})`, PAGE_W - MARGIN_X, 20, { align: 'right' });

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(7.8);
    this.pdf.setTextColor(220, 235, 240);
    this.pdf.text(`Status: ${sanitizePdfText(opts.statusLabel).toUpperCase()}`, PAGE_W - MARGIN_X, 27.5, { align: 'right' });

    this.recordBlock(0, headerH + 1.8, 'PrimaryHeader');
    this.cursorY = headerH + 7;
  }

  public drawSectionTitle(title: string, rightNote?: string): void {
    this.ensureSpace(12);
    const yStart = this.cursorY;

    this.pdf.setFillColor(...COLOR_TEAL);
    this.pdf.rect(MARGIN_X, yStart, 2.5, 5.2, 'F');

    this.pdf.setTextColor(...COLOR_OBSIDIAN);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(10);
    this.pdf.text(sanitizePdfText(title).toUpperCase(), MARGIN_X + 5, yStart + 4.1);

    if (rightNote) {
      this.pdf.setTextColor(...COLOR_SLATE_500);
      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(7.8);
      this.pdf.text(sanitizePdfText(rightNote), PAGE_W - MARGIN_X, yStart + 4.1, { align: 'right' });
    }

    this.pdf.setDrawColor(...COLOR_SLATE_200);
    this.pdf.setLineWidth(0.3);
    this.pdf.line(MARGIN_X, yStart + 6.8, PAGE_W - MARGIN_X, yStart + 6.8);

    this.recordBlock(yStart, yStart + 7.2, `Section:${title}`);
    this.cursorY = yStart + 10;
  }

  public drawKeyValueGrid(
    pairs: { label: string; value: string; accent?: boolean }[],
    columns: 2 | 3 | 4 = 2,
    opts?: { fillColor?: [number, number, number]; borderColor?: [number, number, number] }
  ): void {
    const valid = pairs.filter(p => p.value && p.value.trim().length > 0);
    if (valid.length === 0) return;

    const gap = 3;
    const colW = (CONTENT_W - gap * (columns - 1)) / columns;
    const fill = opts?.fillColor || COLOR_SLATE_50;
    const border = opts?.borderColor || COLOR_SLATE_200;

    for (let i = 0; i < valid.length; i += columns) {
      const row = valid.slice(i, i + columns);
      // Measure max height of row
      let maxH = 12;
      const wrappedRows = row.map(cell => {
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setFontSize(8.8);
        const lines = this.pdf.splitTextToSize(sanitizePdfText(cell.value), colW - 6);
        const h = Math.max(12, 6.2 + lines.length * 4.1 + 2.5);
        if (h > maxH) maxH = h;
        return { cell, lines };
      });

      this.ensureSpace(maxH + 3);
      const yStart = this.cursorY;

      wrappedRows.forEach(({ cell, lines }, idx) => {
        const x = MARGIN_X + idx * (colW + gap);
        this.pdf.setFillColor(...(cell.accent ? COLOR_TEAL_SOFT : fill));
        this.pdf.setDrawColor(...(cell.accent ? COLOR_TEAL : border));
        this.pdf.setLineWidth(0.28);
        this.pdf.roundedRect(x, yStart, colW, maxH, 1.8, 1.8, 'FD');

        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setFontSize(6.8);
        this.pdf.setTextColor(...(cell.accent ? COLOR_TEAL_DARK : COLOR_SLATE_500));
        this.pdf.text(sanitizePdfText(cell.label).toUpperCase(), x + 3, yStart + 4.3);

        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setFontSize(8.8);
        this.pdf.setTextColor(...COLOR_SLATE_900);
        lines.forEach((ln: string, lIdx: number) => {
          this.pdf.text(ln, x + 3, yStart + 9.1 + lIdx * 4.1);
        });
      });

      this.recordBlock(yStart, yStart + maxH, 'KVGridRow');
      this.cursorY = yStart + maxH + 3;
    }
  }

  public drawParagraphBlock(label: string, text: string, opts?: { highlight?: boolean }): void {
    const clean = sanitizePdfText(text);
    if (!clean) return;

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8.8);
    const wrapped: string[] = this.pdf.splitTextToSize(clean, CONTENT_W - 8);
    const lineH = 4.3;

    // Paginate cleanly line-by-line if paragraph is very long
    let lineIdx = 0;
    let isFirstChunk = true;

    while (lineIdx < wrapped.length) {
      const labelH = isFirstChunk && label ? 5.5 : 0;
      const availableMm = MAX_Y - this.cursorY - 5;
      const maxLinesHere = Math.floor((availableMm - labelH - 4) / lineH);

      if (maxLinesHere < 2) {
        this.addContinuationPage();
        continue;
      }

      const chunk = wrapped.slice(lineIdx, lineIdx + maxLinesHere);
      const boxH = labelH + chunk.length * lineH + 5;
      const yStart = this.cursorY;

      this.pdf.setFillColor(...(opts?.highlight ? COLOR_TEAL_SOFT : COLOR_SLATE_50));
      this.pdf.setDrawColor(...(opts?.highlight ? COLOR_TEAL : COLOR_SLATE_200));
      this.pdf.setLineWidth(0.25);
      this.pdf.roundedRect(MARGIN_X, yStart, CONTENT_W, boxH, 1.8, 1.8, 'FD');

      let textY = yStart + 4.8;
      if (isFirstChunk && label) {
        this.pdf.setFont('helvetica', 'bold');
        this.pdf.setFontSize(7.2);
        this.pdf.setTextColor(...(opts?.highlight ? COLOR_TEAL_DARK : COLOR_SLATE_500));
        this.pdf.text(sanitizePdfText(label).toUpperCase(), MARGIN_X + 4, textY);
        textY += 5.0;
      }

      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(8.8);
      this.pdf.setTextColor(...COLOR_SLATE_700);
      for (const ln of chunk) {
        this.pdf.text(ln, MARGIN_X + 4, textY);
        textY += lineH;
      }

      this.recordBlock(yStart, yStart + boxH, `Paragraph:${label || 'Text'}`);
      this.cursorY = yStart + boxH + 3.2;

      lineIdx += chunk.length;
      isFirstChunk = false;
    }
  }

  public drawBulletListBlock(label: string, items: string[], bulletSymbol: string = '-'): void {
    const cleanItems = items.map(sanitizePdfText).filter(Boolean);
    if (cleanItems.length === 0) return;

    this.ensureSpace(14);
    const yHeading = this.cursorY;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(7.6);
    this.pdf.setTextColor(...COLOR_TEAL_DARK);
    this.pdf.text(sanitizePdfText(label).toUpperCase(), MARGIN_X, yHeading + 3.5);
    this.recordBlock(yHeading, yHeading + 5, `ListHeader:${label}`);
    this.cursorY = yHeading + 6;

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8.5);
    this.pdf.setTextColor(...COLOR_SLATE_700);

    for (const item of cleanItems) {
      const lines: string[] = this.pdf.splitTextToSize(item, CONTENT_W - 8);
      const needed = lines.length * 4.1 + 1.4;
      this.ensureSpace(needed);
      const yStart = this.cursorY;

      this.pdf.setFont('helvetica', 'bold');
      this.pdf.setTextColor(...COLOR_TEAL);
      this.pdf.text(bulletSymbol, MARGIN_X + 2, yStart + 3.2);

      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setTextColor(...COLOR_SLATE_700);
      lines.forEach((ln, idx) => {
        this.pdf.text(ln, MARGIN_X + 6, yStart + 3.2 + idx * 4.1);
      });

      this.recordBlock(yStart, yStart + needed, `ListItem:${label}`);
      this.cursorY = yStart + needed;
    }
    this.cursorY += 2.5;
  }

  public drawLinkRow(label: string, displayText: string, url: string): void {
    const safeUrl = sanitizeVerifiedGoogleMapsUrl(url);
    if (!safeUrl) return;
    this.ensureSpace(11);
    const yStart = this.cursorY;

    this.pdf.setFillColor(...COLOR_TEAL_SOFT);
    this.pdf.setDrawColor(...COLOR_TEAL);
    this.pdf.setLineWidth(0.25);
    this.pdf.roundedRect(MARGIN_X, yStart, CONTENT_W, 9.5, 1.5, 1.5, 'FD');

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(7.5);
    this.pdf.setTextColor(...COLOR_TEAL_DARK);
    this.pdf.text(`${sanitizePdfText(label).toUpperCase()}:`, MARGIN_X + 3.5, yStart + 6);

    const linkX = MARGIN_X + 40;
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(8.0);
    this.pdf.setTextColor(0, 96, 168);
    const rawShown = sanitizePdfText(displayText || safeUrl);
    const maxLinkW = CONTENT_W - 44;
    let shownText = rawShown;
    while (shownText.length > 16 && this.pdf.getTextWidth(shownText) > maxLinkW) {
      shownText = `${shownText.slice(0, -4)}...`;
    }
    this.pdf.textWithLink(shownText, linkX, yStart + 6, { url: safeUrl });

    this.recordBlock(yStart, yStart + 9.5, `Link:${label}`);
    this.cursorY = yStart + 12.5;
  }

  public drawAlertBanner(title: string, message: string, tone: 'amber' | 'teal' = 'amber'): void {
    const cleanMsg = sanitizePdfText(message);
    if (!cleanMsg) return;
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8.2);
    const lines: string[] = this.pdf.splitTextToSize(cleanMsg, CONTENT_W - 10);
    const boxH = 8 + lines.length * 4.1 + 3;

    this.ensureSpace(boxH + 3);
    const yStart = this.cursorY;

    this.pdf.setFillColor(...(tone === 'amber' ? COLOR_AMBER_BG : COLOR_TEAL_SOFT));
    this.pdf.setDrawColor(...(tone === 'amber' ? COLOR_AMBER_BORDER : COLOR_TEAL));
    this.pdf.setLineWidth(0.35);
    this.pdf.roundedRect(MARGIN_X, yStart, CONTENT_W, boxH, 1.8, 1.8, 'FD');

    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(8.2);
    this.pdf.setTextColor(...(tone === 'amber' ? COLOR_AMBER_TEXT : COLOR_TEAL_DARK));
    this.pdf.text(sanitizePdfText(title).toUpperCase(), MARGIN_X + 4, yStart + 5.5);

    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8.2);
    this.pdf.setTextColor(...COLOR_SLATE_700);
    lines.forEach((ln, idx) => {
      this.pdf.text(ln, MARGIN_X + 4, yStart + 10 + idx * 4.1);
    });

    this.recordBlock(yStart, yStart + boxH, `Alert:${title}`);
    this.cursorY = yStart + boxH + 3.5;
  }

  public drawDayBanner(dayLabel: string, dateLabel: string): void {
    this.ensureSpace(24); // Ensure at least day banner + start of first service card fit together
    const yStart = this.cursorY;

    this.pdf.setFillColor(...COLOR_OBSIDIAN);
    this.pdf.roundedRect(MARGIN_X, yStart, CONTENT_W, 9, 1.8, 1.8, 'F');

    this.pdf.setTextColor(0, 198, 166);
    this.pdf.setFont('helvetica', 'bold');
    this.pdf.setFontSize(9);
    this.pdf.text(sanitizePdfText(dayLabel).toUpperCase(), MARGIN_X + 4, yStart + 6);

    this.pdf.setTextColor(...COLOR_WHITE);
    this.pdf.setFont('helvetica', 'normal');
    this.pdf.setFontSize(8.5);
    this.pdf.text(sanitizePdfText(dateLabel), PAGE_W - MARGIN_X - 4, yStart + 6, { align: 'right' });

    this.recordBlock(yStart, yStart + 9, `DayBanner:${dayLabel}`);
    this.cursorY = yStart + 12;
  }

  public finalizeFooters(footerRightNote?: string): PdfLayoutAudit {
    const totalPages = this.pdf.getNumberOfPages();
    const blankPages: number[] = [];

    for (let p = 1; p <= totalPages; p++) {
      if (!this.pageHasContent.get(p)) {
        blankPages.push(p);
      }
      this.pdf.setPage(p);
      this.pdf.setDrawColor(...COLOR_SLATE_200);
      this.pdf.setLineWidth(0.25);
      this.pdf.line(MARGIN_X, PAGE_H - 13, PAGE_W - MARGIN_X, PAGE_H - 13);

      this.pdf.setFont('helvetica', 'normal');
      this.pdf.setFontSize(7.2);
      this.pdf.setTextColor(...COLOR_SLATE_500);
      this.pdf.text(
        `TheUnbound DMC  |  ${this.docTitle}  |  Booking: ${this.bookingRef}  |  Doc: ${this.docRef}`,
        MARGIN_X,
        PAGE_H - 8.5
      );
      this.pdf.setFont('helvetica', 'bold');
      this.pdf.text(
        `${footerRightNote ? `${sanitizePdfText(footerRightNote)}  |  ` : ''}Page ${p} of ${totalPages}`,
        PAGE_W - MARGIN_X,
        PAGE_H - 8.5,
        { align: 'right' }
      );
    }

    // Audit bounding boxes per page for overlap or clipping past MAX_Y
    let hasOverlap = false;
    let hasClipping = false;
    const byPage = new Map<number, PdfLayoutBlockRecord[]>();
    for (const blk of this.blocks) {
      if (blk.yEnd > PAGE_H - 13.2 && blk.label !== 'PrimaryHeader') {
        hasClipping = true;
      }
      const arr = byPage.get(blk.page) || [];
      arr.push(blk);
      byPage.set(blk.page, arr);
    }

    for (const [, list] of byPage) {
      for (let i = 1; i < list.length; i++) {
        const prev = list[i - 1];
        const curr = list[i];
        // Allow tiny floating point tolerance (0.2mm)
        if (curr.yStart < prev.yEnd - 0.2) {
          hasOverlap = true;
        }
      }
    }

    return {
      pageCount: totalPages,
      hasOverlap,
      hasClipping,
      blankPages,
      blocksRecorded: this.blocks.length
    };
  }

  public buildResult(filename: string, footerRightNote?: string): GeneratedPdfResult {
    const layoutAudit = this.finalizeFooters(footerRightNote);
    const pdf = this.pdf;
    return {
      pdf,
      filename,
      pageCount: layoutAudit.pageCount,
      layoutAudit,
      toArrayBuffer: () => pdf.output('arraybuffer'),
      toUint8Array: () => new Uint8Array(pdf.output('arraybuffer')),
      download: () => {
        pdf.save(filename);
      }
    };
  }
}

// ----------------------------------------------------------------------------
// 1. ACTIVITY VOUCHER PDF GENERATOR
// Requirement Section 4:
//   - Complete service name, description, operational overview
//   - Service date, ticket date, ticket entry time, reporting time, timezone
//   - Meeting point, venue address, verified clickable Google Maps link
//   - Passenger breakdown (adults/children/infants/total) & names
//   - Inclusions & exclusions
//   - Important instructions, booking ref, voucher ref, supplier confirmation ref
//   - Verified emergency contact
//   - STRICTLY NO vehicle block on non-transport activities, NO nett cost/margin
// ----------------------------------------------------------------------------
export function generateActivityVoucherPDF(
  voucher: BookingVoucher,
  booking?: Booking | null,
  companyProfile?: CentralCompanyProfile | null
): GeneratedPdfResult {
  // Resolve authoritative service item if booking provided
  const matchingRawItem: BookingItem | undefined = booking?.items?.find(
    it => it.id === voucher.serviceItemId
  );
  const hydrated: HydratedBookingServiceItem | null = matchingRawItem
    ? hydrateBookingServiceItem(matchingRawItem, booking)
    : null;

  const isTransport = hydrated
    ? hydrated.isTransportService
    : Boolean(voucher.isTransportService);

  const versionNum = voucher.version || 1;
  const bookingRef = voucher.bookingReference || booking?.bookingReference || 'BOOKING';
  const voucherRef = voucher.voucherNumber || voucher.id;
  const issueDate = formatReadableDate((voucher.issuedAt || new Date().toISOString()).slice(0, 10));
  const statusLabel = voucher.isOutdated
    ? 'OUTDATED - SUPERSEDED'
    : hydrated
    ? hydrated.resolvedCanonicalAllocationStatus
    : voucher.status || 'ISSUED';

  const engine = new PdfLayoutEngine('Activity Voucher', voucherRef, bookingRef);

  engine.drawPrimaryHeader({
    brandTitle: companyProfile?.companyName || 'TheUnbound',
    brandSubtitle: 'Official Activity & Experience Operational Voucher',
    documentTypeBadge: 'ACTIVITY VOUCHER',
    documentNumber: voucherRef,
    versionLabel: `v${versionNum}`,
    statusLabel,
    bookingRef,
    issueDate
  });

  if (voucher.isOutdated) {
    engine.drawAlertBanner(
      'Voucher Outdated Notice',
      voucher.outdatedReason || 'Underlying booking service details were modified after this voucher was issued. Please use the latest reissued version.',
      'amber'
    );
  }

  // Highlighted Schedule & Ticket Timing Banner
  const serviceDate = hydrated?.resolvedServiceDate || voucher.serviceDate || '';
  const ticketDate = hydrated?.resolvedTicketDate || voucher.ticketDate || '';
  const entryTime = hydrated?.resolvedTicketEntryTime || voucher.ticketEntryTime || hydrated?.resolvedStartTime || voucher.startTime || voucher.serviceTime || '';
  const reportingTime = hydrated?.resolvedReportingTime || voucher.reportingTime || '';
  const endTime = hydrated?.resolvedEndTime || voucher.endTime || '';
  const timeZone = hydrated?.resolvedTimeZone || voucher.timeZone || '';

  engine.drawSectionTitle('Service Schedule & Timing', timeZone ? `Local Timezone: ${timeZone}` : undefined);
  engine.drawKeyValueGrid(
    [
      { label: 'Service Date', value: serviceDate ? formatReadableDate(serviceDate) : 'Pending Confirmation', accent: true },
      { label: 'Ticket Date', value: ticketDate && ticketDate !== serviceDate ? formatReadableDate(ticketDate) : (ticketDate ? formatReadableDate(ticketDate) : ''), accent: true },
      { label: hydrated?.isTicketedActivity || voucher.isTicketedActivity ? 'Ticket Entry Time' : 'Service Start Time', value: entryTime || 'To Be Confirmed', accent: true },
      { label: 'Reporting Time', value: reportingTime },
      { label: 'End Time', value: endTime },
      { label: 'Time Zone', value: timeZone }
    ],
    3
  );

  // Service Identity & Full Description / Overview
  const serviceName = hydrated?.productName || voucher.serviceName || 'Activity Service';
  const category = hydrated?.category || voucher.category || 'Activity';
  const destination = hydrated?.destination || voucher.destination || booking?.destination || '';
  const hub = hydrated?.hub || voucher.hub || voucher.city || '';
  const description = hydrated?.resolvedDescription || voucher.serviceDescription || voucher.activityDescription || '';
  const narrative = hydrated?.resolvedNarrative || voucher.serviceNarrative || '';
  const overview = hydrated?.resolvedOverview || voucher.serviceOverview || '';

  engine.drawSectionTitle('Activity & Service Overview', category);
  engine.drawKeyValueGrid(
    [
      { label: 'Service / Activity Name', value: serviceName, accent: true },
      { label: 'Category', value: category },
      { label: 'Destination / Hub', value: [destination, hub].filter(Boolean).join(' - ') },
      { label: 'Supplier Confirmation Ref', value: hydrated?.supplierConfirmationRef || voucher.supplierConfirmationRef || 'Pending Supplier Confirmation' }
    ],
    2
  );

  if (description) {
    engine.drawParagraphBlock('Service Description', description);
  }
  if (narrative && narrative !== description) {
    engine.drawParagraphBlock('Itinerary Narrative', narrative);
  }
  if (overview && overview !== description && overview !== narrative) {
    engine.drawParagraphBlock('Operational Overview', overview);
  }

  // Venue, Meeting Point & Clickable Google Maps Link
  const meetingPoint = hydrated?.resolvedMeetingPoint || voucher.meetingPoint || '';
  const address = hydrated?.resolvedAddress || voucher.address || voucher.hotelAddress || '';
  const googleMapsUrl = hydrated?.resolvedGoogleMapsUrl || sanitizeVerifiedGoogleMapsUrl(voucher.googleMapsUrl);
  const pickupInfo = isTransport ? (hydrated?.resolvedPickupLocation || voucher.pickupInfo || '') : '';
  const dropoffInfo = isTransport ? (hydrated?.resolvedDropoffLocation || voucher.dropoffInfo || '') : '';

  if (meetingPoint || address || googleMapsUrl || pickupInfo || dropoffInfo) {
    engine.drawSectionTitle(isTransport ? 'Pickup, Drop-off & Venue Details' : 'Meeting Point & Venue Details');
    engine.drawKeyValueGrid(
      [
        { label: 'Meeting Point', value: meetingPoint },
        { label: 'Venue / Location Address', value: address },
        { label: 'Pickup Location', value: pickupInfo },
        { label: 'Drop-off Location', value: dropoffInfo }
      ],
      2
    );
    if (googleMapsUrl) {
      engine.drawLinkRow('Google Maps Link', googleMapsUrl, googleMapsUrl);
    }
  }

  // Transport Block — STRICTLY ONLY IF TRANSPORT SERVICE (NEVER ON TICKETED ACTIVITIES)
  if (isTransport && hydrated) {
    const vehicleRows = [
      { label: 'Vehicle Type', value: hydrated.vehicleType || '' },
      { label: 'Vehicle Category', value: hydrated.vehicleCategory || '' },
      { label: 'Seater / Pax Capacity', value: hydrated.vehicleSeaterCapacity ? `${hydrated.vehicleSeaterCapacity} Seats` : '' },
      { label: 'Vehicle Count', value: hydrated.vehicleCount ? `${hydrated.vehicleCount} Vehicle(s)` : '' },
      { label: 'Luggage Capacity', value: hydrated.luggageCapacity || '' },
      { label: 'Route Details', value: hydrated.routeDetails || '' }
    ].filter(r => r.value);

    if (vehicleRows.length > 0) {
      engine.drawSectionTitle('Vehicle & Transfer Configuration');
      engine.drawKeyValueGrid(vehicleRows, 3);
    }
  }

  // Passenger Configuration
  const adults = hydrated?.adults ?? voucher.adults ?? 0;
  const children = hydrated?.children ?? voucher.children ?? 0;
  const infants = hydrated?.infants ?? voucher.infants ?? 0;
  const totalPax = hydrated?.totalPax ?? voucher.totalPax ?? (adults + children + infants);
  const paxBreakdown = hydrated?.resolvedPassengerBreakdown || voucher.passengerBreakdown || formatPassengerBreakdown(adults, children, infants);
  const leadPax = voucher.leadPaxName || booking?.customer?.leadTravelerName || booking?.customer?.name || '';
  const paxNames = voucher.passengerNames?.filter(Boolean) || [];

  engine.drawSectionTitle('Passenger Details', `Total Guests: ${totalPax}`);
  engine.drawKeyValueGrid(
    [
      { label: 'Lead Traveller', value: leadPax || 'As Per Booking Manifest' },
      { label: 'Passenger Breakdown', value: paxBreakdown },
      { label: 'Total Passengers', value: `${totalPax} Guest${totalPax === 1 ? '' : 's'}` },
      { label: 'Ticket / Age Categories', value: hydrated?.ageTicketCategories || voucher.ticketType || '' }
    ],
    2
  );
  if (paxNames.length > 0) {
    engine.drawParagraphBlock('Named Travellers', paxNames.join(', '));
  }

  // Inclusions & Exclusions
  const inclusions = (hydrated?.resolvedInclusions?.length ? hydrated.resolvedInclusions : voucher.inclusions) || [];
  const exclusions = (hydrated?.resolvedExclusions?.length ? hydrated.resolvedExclusions : voucher.exclusions) || [];

  if (inclusions.length > 0 || exclusions.length > 0) {
    engine.drawSectionTitle('Inclusions & Exclusions');
    if (inclusions.length > 0) {
      engine.drawBulletListBlock('Included in This Service', inclusions, '+');
    }
    if (exclusions.length > 0) {
      engine.drawBulletListBlock('Not Included (Exclusions)', exclusions, '-');
    }
  }

  // Important Guest Instructions
  const importantInstructions = hydrated?.resolvedImportantInstructions || voucher.importantInstructions || voucher.importantInformation || voucher.specialInstructions || '';
  if (importantInstructions) {
    engine.drawSectionTitle('Important Instructions & Redemption Guidance');
    engine.drawParagraphBlock('Operational & Guest Guidance', importantInstructions, { highlight: true });
  }

  // Operational Support & Supplier Dispatch Reference (Strictly Customer-Facing — NO nett cost or margin!)
  const emergencyContact =
    voucher.emergencyContact ||
    companyProfile?.phone ||
    companyProfile?.email ||
    'TheUnbound 24/7 Operations Desk';

  engine.drawSectionTitle('Confirmation & Operational Support');
  engine.drawKeyValueGrid(
    [
      { label: 'Booking Reference', value: bookingRef },
      { label: 'Voucher Reference', value: `${voucherRef} (v${versionNum})` },
      { label: 'Service Partner', value: hydrated?.supplierName || voucher.supplierName || 'TheUnbound Ground Operations' },
      { label: 'Supplier Confirmation Ref', value: hydrated?.supplierConfirmationRef || voucher.supplierConfirmationRef || 'Pending Confirmation' },
      { label: '24/7 Emergency Support', value: emergencyContact },
      { label: 'Operations Desk Email', value: companyProfile?.email || '' }
    ],
    2
  );

  if (voucher.termsAndConditions) {
    engine.drawParagraphBlock('Voucher Terms & Conditions', voucher.termsAndConditions);
  }

  const filename = `Activity_Voucher_${safeFileSegment(bookingRef)}_${safeFileSegment(serviceName)}_v${versionNum}.pdf`;
  return engine.buildResult(filename, 'Activity Voucher');
}

// ----------------------------------------------------------------------------
// 2. COMPLETE BOOKING VOUCHER PDF GENERATOR
// Requirement Section 5:
//   - Consolidates all applicable confirmed booking services
//   - Strict chronological order by actual service date & time (day-wise grouping)
//   - Category-appropriate operational blocks (Vehicle ONLY for transport;
//     Ticket entry time ONLY for ticketed activities; Room/Meal ONLY for hotels)
//   - Clearly separates pending/unconfirmed services without fabricating confirmation
//   - ZERO supplier nett cost or internal margins
// ----------------------------------------------------------------------------
export function generateCompleteVoucherPDF(
  voucher: BookingVoucher,
  booking: Booking,
  companyProfile?: CentralCompanyProfile | null
): GeneratedPdfResult {
  const versionNum = voucher.version || 1;
  const bookingRef = voucher.bookingReference || booking.bookingReference || 'BOOKING';
  const voucherRef = voucher.voucherNumber || voucher.id;
  const issueDate = formatReadableDate((voucher.issuedAt || new Date().toISOString()).slice(0, 10));

  // Hydrate all active (non-cancelled) booking service items from authoritative booking record
  const rawItems: BookingItem[] =
    booking.items && booking.items.length > 0
      ? booking.items
      : ((voucher.serviceItemsSnapshot || []) as BookingItem[]);

  const hydratedAll = rawItems
    .filter(it => !it.isCancelled && it.operationalStatus !== 'Cancelled')
    .map(it => hydrateBookingServiceItem(it, booking));

  const confirmedItems = sortBookingItemsChronologically(
    hydratedAll.filter(it => it.isConfirmedForVoucher)
  );
  const pendingItems = sortBookingItemsChronologically(
    hydratedAll.filter(it => !it.isConfirmedForVoucher)
  );

  const engine = new PdfLayoutEngine('Complete Booking Voucher', voucherRef, bookingRef);

  engine.drawPrimaryHeader({
    brandTitle: companyProfile?.companyName || 'TheUnbound',
    brandSubtitle: 'Consolidated Multi-Service Travel Operations Voucher',
    documentTypeBadge: 'COMPLETE BOOKING VOUCHER',
    documentNumber: voucherRef,
    versionLabel: `v${versionNum}`,
    statusLabel: voucher.isOutdated ? 'OUTDATED' : (booking.status || 'CONFIRMED'),
    bookingRef,
    issueDate
  });

  if (voucher.isOutdated) {
    engine.drawAlertBanner(
      'Voucher Superseded / Outdated',
      voucher.outdatedReason || 'One or more booking services were modified after this voucher was generated. Please reissue before dispatch.',
      'amber'
    );
  }

  // Booking Overview
  const leadTraveler =
    voucher.leadPaxName ||
    booking.customer?.leadTravelerName ||
    booking.customer?.name ||
    booking.customer?.bookerName ||
    'Lead Traveller';
  const bookingTravelers = (booking as any).travelers;
  const adults = bookingTravelers?.adults ?? booking.customer?.totalAdults ?? voucher.adults ?? 0;
  const children = bookingTravelers?.children ?? booking.customer?.totalChildren ?? voucher.children ?? 0;
  const infants = bookingTravelers?.infants ?? booking.customer?.totalInfants ?? voucher.infants ?? 0;
  const totalPax = adults + children + infants || voucher.totalPax || 0;

  const destinationList =
    booking.destination?.trim() ||
    Array.from(new Set(hydratedAll.map(it => it.destination).filter(Boolean))).join(', ');

  engine.drawSectionTitle('Booking Overview', `${confirmedItems.length} Confirmed Service${confirmedItems.length === 1 ? '' : 's'}`);
  engine.drawKeyValueGrid(
    [
      { label: 'Booking Reference', value: bookingRef, accent: true },
      { label: 'Lead Traveller', value: leadTraveler, accent: true },
      { label: 'Destination(s)', value: destinationList || voucher.destination || 'As Per Itinerary' },
      {
        label: 'Travel Dates',
        value:
          booking.travelStartDate && booking.travelEndDate
            ? `${formatReadableDate(booking.travelStartDate)} to ${formatReadableDate(booking.travelEndDate)}`
            : booking.travelStartDate
            ? formatReadableDate(booking.travelStartDate)
            : 'Dates Pending'
      },
      { label: 'Passenger Summary', value: `${formatPassengerBreakdown(adults, children, infants)} (Total: ${totalPax})` },
      { label: 'Booking Status', value: String(booking.status || 'CONFIRMED').replace(/_/g, ' ') }
    ],
    2
  );

  const bookingSpecialReq = (booking as any).specialRequests || booking.customer?.specialRequests;
  if (bookingSpecialReq || voucher.specialInstructions) {
    engine.drawParagraphBlock(
      'Important Booking Instructions',
      bookingSpecialReq || voucher.specialInstructions || '',
      { highlight: true }
    );
  }

  if (pendingItems.length > 0) {
    engine.drawAlertBanner(
      `Pending Supplier Confirmation (${pendingItems.length} Service${pendingItems.length === 1 ? '' : 's'})`,
      `This booking includes ${confirmedItems.length} confirmed service(s) shown in the Confirmed Chronological Itinerary below, and ${pendingItems.length} service(s) still pending supplier confirmation listed separately at the end of this voucher.`,
      'amber'
    );
  }

  // Helper to render a single structured service card cleanly across pages
  const renderServiceCard = (item: HydratedBookingServiceItem, indexLabel: string, isPendingSection: boolean) => {
    engine.ensureSpace(26);
    const cardHeaderY = engine.cursorY;

    // Service Sub-Header Strip
    engine.pdf.setFillColor(...(isPendingSection ? COLOR_AMBER_BG : COLOR_SLATE_100));
    engine.pdf.setDrawColor(...(isPendingSection ? COLOR_AMBER_BORDER : COLOR_TEAL));
    engine.pdf.setLineWidth(0.3);
    engine.pdf.roundedRect(MARGIN_X, cardHeaderY, CONTENT_W, 10.5, 1.6, 1.6, 'FD');

    engine.pdf.setFont('helvetica', 'bold');
    engine.pdf.setFontSize(9.5);
    engine.pdf.setTextColor(...COLOR_OBSIDIAN);
    const titleStr = sanitizePdfText(`${indexLabel}. ${item.productName}`);
    engine.pdf.text(titleStr.slice(0, 74), MARGIN_X + 3.5, cardHeaderY + 5.2);

    engine.pdf.setFont('helvetica', 'normal');
    engine.pdf.setFontSize(7.4);
    engine.pdf.setTextColor(...COLOR_SLATE_500);
    const subMeta = [item.category, item.destination, item.hub].filter(Boolean).join('  |  ');
    engine.pdf.text(sanitizePdfText(subMeta), MARGIN_X + 3.5, cardHeaderY + 9);

    // Status & Confirmation Ref on right
    const badgeText = isPendingSection
      ? `STATUS: ${item.resolvedCanonicalAllocationStatus.toUpperCase()}`
      : item.supplierConfirmationRef
      ? `CONFIRMED  |  REF: ${item.supplierConfirmationRef}`
      : 'SUPPLIER CONFIRMED';
    engine.pdf.setFont('helvetica', 'bold');
    engine.pdf.setFontSize(7.4);
    engine.pdf.setTextColor(...(isPendingSection ? COLOR_AMBER_TEXT : COLOR_TEAL_DARK));
    engine.pdf.text(sanitizePdfText(badgeText), PAGE_W - MARGIN_X - 3.5, cardHeaderY + 6.4, { align: 'right' });

    engine.recordBlock(cardHeaderY, cardHeaderY + 10.5, `ServiceHeader:${item.productName}`);
    engine.cursorY = cardHeaderY + 13;

    // Timing & Passenger Grid
    const timingPairs: { label: string; value: string; accent?: boolean }[] = [
      { label: 'Service Date', value: item.resolvedServiceDate ? formatReadableDate(item.resolvedServiceDate) : 'Date Pending' },
      { label: 'Passengers', value: `${item.resolvedPassengerBreakdown} (${item.totalPax} Pax)` }
    ];

    const hasExplicitTicketEntry = Boolean(
      item.ticketEntryTime ||
        (item.configuration_snapshot && (item.configuration_snapshot.ticketEntryTime || item.configuration_snapshot.entryTime))
    );

    if (item.isTicketedActivity && hasExplicitTicketEntry) {
      if (item.resolvedTicketDate && item.resolvedTicketDate !== item.resolvedServiceDate) {
        timingPairs.push({ label: 'Ticket Date', value: formatReadableDate(item.resolvedTicketDate), accent: true });
      }
      if (item.resolvedTicketEntryTime) {
        timingPairs.push({ label: 'Ticket Entry Time', value: `${item.resolvedTicketEntryTime}${item.resolvedTimeZone ? ` (${item.resolvedTimeZone})` : ''}`, accent: true });
      }
      if (item.resolvedReportingTime) {
        timingPairs.push({ label: 'Reporting Time', value: item.resolvedReportingTime });
      }
    } else if (item.isTransportService) {
      if (item.resolvedPickupTime) {
        timingPairs.push({ label: 'Pickup Time', value: `${item.resolvedPickupTime}${item.resolvedTimeZone ? ` (${item.resolvedTimeZone})` : ''}`, accent: true });
      }
      if (item.resolvedReturnTime) {
        timingPairs.push({ label: 'Return Time', value: item.resolvedReturnTime });
      }
    } else {
      if (item.resolvedStartTime) {
        timingPairs.push({ label: 'Start Time', value: `${item.resolvedStartTime}${item.resolvedTimeZone ? ` (${item.resolvedTimeZone})` : ''}`, accent: true });
      }
      if (item.resolvedReportingTime) {
        timingPairs.push({ label: 'Reporting Time', value: item.resolvedReportingTime });
      }
      if (item.resolvedEndTime) {
        timingPairs.push({ label: 'End Time', value: item.resolvedEndTime });
      }
    }

    if (item.supplierName) {
      timingPairs.push({ label: 'Operating Partner', value: item.supplierName });
    }
    if (!isPendingSection && item.supplierConfirmationRef) {
      timingPairs.push({ label: 'Confirmation Ref', value: item.supplierConfirmationRef });
    }

    engine.drawKeyValueGrid(timingPairs, 3);

    // Description, Narrative & Overview (display strictly populated fields, never placeholders)
    if (item.resolvedDescription) {
      engine.drawParagraphBlock('Service Description', item.resolvedDescription);
    }
    if (item.resolvedNarrative && item.resolvedNarrative !== item.resolvedDescription) {
      engine.drawParagraphBlock('Itinerary Narrative', item.resolvedNarrative);
    }
    if (item.resolvedOverview && item.resolvedOverview !== item.resolvedDescription && item.resolvedOverview !== item.resolvedNarrative) {
      engine.drawParagraphBlock('Operational Overview', item.resolvedOverview);
    }

    // Category-Specific Block: TRANSPORT ONLY
    if (item.isTransportService) {
      const transportPairs = [
        { label: 'Vehicle Type', value: item.vehicleType || '', accent: true },
        { label: 'Vehicle Category', value: item.vehicleCategory || '' },
        { label: 'Seater Capacity', value: item.vehicleSeaterCapacity ? `${item.vehicleSeaterCapacity} Seats` : '' },
        { label: 'Vehicle Count', value: item.vehicleCount ? `${item.vehicleCount} Vehicle(s)` : '' },
        { label: 'Luggage Capacity', value: item.luggageCapacity || '' },
        { label: 'Pickup Location', value: item.resolvedPickupLocation || '' },
        { label: 'Drop-off Location', value: item.resolvedDropoffLocation || '' },
        { label: 'Route Details', value: item.routeDetails || '' }
      ].filter(p => p.value);

      if (transportPairs.length > 0) {
        engine.drawKeyValueGrid(transportPairs, 2);
      }
    }

    // Category-Specific Block: ACCOMMODATION ONLY
    if (item.isAccommodationService && item.serviceHotelDetails) {
      const hd = item.serviceHotelDetails;
      const hotelPairs = [
        { label: 'Property Name', value: hd.hotelName || item.productName },
        { label: 'Room Category', value: hd.roomType || '' },
        { label: 'Meal Plan', value: hd.mealPlan || '' },
        { label: 'Check-In Date', value: hd.checkInDate ? formatReadableDate(hd.checkInDate) : '' },
        { label: 'Check-Out Date', value: hd.checkOutDate ? formatReadableDate(hd.checkOutDate) : '' },
        { label: 'Hotel Confirmation', value: hd.confirmationNumber || '' }
      ].filter(p => p.value);
      if (hotelPairs.length > 0) {
        engine.drawKeyValueGrid(hotelPairs, 3);
      }
    }

    // Meeting Point / Venue Address / Google Maps (for non-transport or when explicitly provided)
    if (!item.isTransportService && (item.resolvedMeetingPoint || item.resolvedAddress)) {
      engine.drawKeyValueGrid(
        [
          { label: 'Meeting Point', value: item.resolvedMeetingPoint },
          { label: 'Venue / Address', value: item.resolvedAddress }
        ],
        2
      );
    }
    if (item.resolvedGoogleMapsUrl) {
      engine.drawLinkRow('Venue Google Maps', item.resolvedGoogleMapsUrl, item.resolvedGoogleMapsUrl);
    }

    // Inclusions / Exclusions / Important Instructions
    if (item.resolvedInclusions.length > 0) {
      engine.drawBulletListBlock('Inclusions', item.resolvedInclusions, '+');
    }
    if (item.resolvedExclusions.length > 0) {
      engine.drawBulletListBlock('Exclusions', item.resolvedExclusions, '-');
    }
    if (item.resolvedImportantInstructions) {
      engine.drawParagraphBlock('Important Instructions', item.resolvedImportantInstructions, { highlight: true });
    }

    engine.cursorY += 2;
  };

  // Chronological Day-Wise Confirmed Services
  if (confirmedItems.length > 0) {
    engine.drawSectionTitle('Confirmed Services -- Chronological Day-Wise Itinerary');
    const dayGroups = groupBookingItemsByDay(confirmedItems, booking.travelStartDate);
    let globalIdx = 1;

    for (const grp of dayGroups) {
      const dayTitle = grp.dayNumber !== null ? `DAY ${grp.dayNumber}` : 'UNSCHEDULED DATE';
      engine.drawDayBanner(dayTitle, grp.displayDateLabel);
      for (const item of grp.items) {
        renderServiceCard(item, String(globalIdx++), false);
      }
    }
  } else {
    engine.drawAlertBanner(
      'No Confirmed Services Yet',
      'No service items on this booking have reached Supplier Confirmed status yet. Pending services are listed below for operational reference.',
      'amber'
    );
  }

  // Separate Pending / Unconfirmed Services Section (if any exist — never fabricated as confirmed)
  if (pendingItems.length > 0) {
    engine.drawSectionTitle('Services Pending Supplier Confirmation', 'NOT YET CONFIRMED');
    pendingItems.forEach((item, idx) => {
      renderServiceCard(item, `P${idx + 1}`, true);
    });
  }

  // Emergency Contacts & Terms
  engine.drawSectionTitle('24/7 Emergency Support & Voucher Terms');
  engine.drawKeyValueGrid(
    [
      { label: '24/7 Operations Hotline', value: voucher.emergencyContact || companyProfile?.phone || 'TheUnbound Operations Desk' },
      { label: 'Operations Support Email', value: companyProfile?.email || 'operations@theunbound.in' },
      { label: 'Issuing Company', value: companyProfile?.companyName || 'TheUnbound DMC' },
      { label: 'Voucher Reference', value: `${voucherRef} (v${versionNum})` }
    ],
    2
  );
  if (voucher.termsAndConditions) {
    engine.drawParagraphBlock('Terms & Operational Conditions', voucher.termsAndConditions);
  }

  const filename = `Complete_Booking_Voucher_${safeFileSegment(bookingRef)}_v${versionNum}.pdf`;
  return engine.buildResult(filename, 'Complete Booking Voucher');
}

// ----------------------------------------------------------------------------
// 3. PROFORMA INVOICE PDF GENERATOR
// Requirement Section 6:
//   - Clearly labelled PROFORMA INVOICE (not a final tax invoice)
//   - Shows ONLY the authoritative Final Booking Amount (from latest committed
//     BookingPricingSnapshot)
//   - STRICTLY NO separate TAX, GST, VAT, Service Fee, Internal Margin,
//     or Supplier Nett Cost lines!
//   - Displays Company Registered + Current Address, Booking Details,
//     Agency/Customer Billing Details, Bank Wire Instructions & Terms
// ----------------------------------------------------------------------------
export function generateProformaInvoicePDF(
  invoice: BookingInvoice,
  booking?: Booking | null,
  companyProfile?: CentralCompanyProfile | null
): GeneratedPdfResult {
  const versionNum = invoice.invoiceVersion || 1;
  const bookingRef = invoice.bookingReference || booking?.bookingReference || 'BOOKING';
  const invoiceNum = invoice.invoiceNumber || invoice.id;
  const issueDate = formatReadableDate((invoice.invoiceDate || invoice.issueDate || new Date().toISOString()).slice(0, 10));
  const dueDate = invoice.dueDate ? formatReadableDate(invoice.dueDate.slice(0, 10)) : 'Prior to Service Cut-off';

  // IMMUTABLE SNAPSHOT RULE:
  // Each issued Proforma Invoice is permanently locked to the committed BookingPricingSnapshot
  // from which it was generated. Never overwrite a historical v1 invoice with a newer booking total.
  const hasLockedInvoiceAmount =
    typeof invoice.proformaFinalBookingAmount === 'number' ||
    (typeof invoice.totalAmount === 'number' && invoice.totalAmount > 0);
  const resolvedFallback = !hasLockedInvoiceAmount && booking ? resolveAuthoritativeProformaAmount(booking) : null;

  const currency: CurrencyCode = (invoice.currency || resolvedFallback?.currency || booking?.currency || 'USD') as CurrencyCode;
  const finalBookingAmount = hasLockedInvoiceAmount
    ? Number(invoice.proformaFinalBookingAmount ?? invoice.totalAmount ?? 0)
    : Number(resolvedFallback?.finalBookingAmount ?? 0);
  const hasLockedPaidAmount =
    typeof invoice.amountPaid === 'number' || typeof invoice.paidAmount === 'number';
  const amountPaid = hasLockedPaidAmount
    ? Math.max(0, Number(invoice.amountPaid ?? invoice.paidAmount ?? 0))
    : Number(resolvedFallback?.amountPaid ?? 0);
  const balanceDue = Math.max(0, Math.round((finalBookingAmount - amountPaid) * 100) / 100);
  const creditBalance = Math.max(0, Math.round((amountPaid - finalBookingAmount) * 100) / 100);
  const snapshotRef =
    invoice.sourcePricingSnapshotId ||
    resolvedFallback?.sourcePricingSnapshotId ||
    `SNAP-v${invoice.sourcePricingSnapshotVersion || resolvedFallback?.sourcePricingSnapshotVersion || 1}`;

  const engine = new PdfLayoutEngine('Proforma Invoice', invoiceNum, bookingRef);

  engine.drawPrimaryHeader({
    brandTitle: companyProfile?.companyName || invoice.companyName || 'TheUnbound',
    brandSubtitle: 'Proforma Invoice -- For Payment & Booking Confirmation (Not a Final Tax Invoice)',
    documentTypeBadge: 'PROFORMA INVOICE',
    documentNumber: invoiceNum,
    versionLabel: `v${versionNum}`,
    statusLabel: String(invoice.paymentStatus || 'UNPAID').replace(/_/g, ' '),
    bookingRef,
    issueDate
  });

  // Explicit Proforma Document Notice
  engine.drawAlertBanner(
    'Proforma Invoice Notice',
    invoice.documentNotice ||
      'This document is a Proforma Invoice issued solely for booking confirmation and payment remittance purposes. It is not a statutory or final fiscal invoice.',
    'teal'
  );

  // Company Profile (Registered & Current Address) & Invoice Metadata
  const regAddress =
    companyProfile?.registeredAddress ||
    invoice.companyRegisteredAddress ||
    invoice.companyAddress ||
    '';
  const curAddress =
    companyProfile?.currentAddress ||
    invoice.companyCurrentAddress ||
    '';

  engine.drawSectionTitle('Issuing Company & Proforma Details');
  engine.drawKeyValueGrid(
    [
      { label: 'Issuing Entity', value: companyProfile?.legalName || companyProfile?.companyName || invoice.companyName || '' },
      { label: 'Proforma Invoice Number', value: `${invoiceNum} (v${versionNum})`, accent: true },
      { label: 'Registered Address', value: regAddress },
      { label: 'Current / Operating Address', value: curAddress && curAddress !== regAddress ? curAddress : '' },
      { label: 'Booking Reference', value: bookingRef },
      { label: 'Issue Date', value: issueDate },
      { label: 'Payment Due Date', value: dueDate },
      { label: 'Pricing Snapshot Reference', value: snapshotRef },
      { label: 'Company Contact', value: [companyProfile?.email || invoice.companyEmail, companyProfile?.phone || invoice.companyPhone].filter(Boolean).join('  |  ') },
      { label: 'Currency', value: currency }
    ],
    2
  );

  // Billed To & Booking Summary
  const agencyName = invoice.agencyName || invoice.billedToAgency || booking?.agencyName || 'Direct Partner';
  const customerName = invoice.customerName || invoice.billedToName || booking?.customer?.leadTravelerName || booking?.customer?.name || '';
  const customerEmail = invoice.customerEmail || invoice.billedToEmail || booking?.customer?.email || '';
  const customerPhone = invoice.customerPhone || booking?.customer?.phone || '';
  const destination = invoice.destination || booking?.destination || '';
  const travelDates =
    booking?.travelStartDate && booking?.travelEndDate
      ? `${formatReadableDate(booking.travelStartDate)} to ${formatReadableDate(booking.travelEndDate)}`
      : booking?.travelStartDate
      ? formatReadableDate(booking.travelStartDate)
      : invoice.travelDates || '';
  const bookingInvTravelers = (booking as any)?.travelers;
  const paxSummary = bookingInvTravelers
    ? `${formatPassengerBreakdown(bookingInvTravelers.adults || 0, bookingInvTravelers.children || 0, bookingInvTravelers.infants || 0)}`
    : booking?.customer?.totalAdults
    ? `${formatPassengerBreakdown(booking.customer.totalAdults || 0, booking.customer.totalChildren || 0, booking.customer.totalInfants || 0)}`
    : invoice.totalPax
    ? `${invoice.totalPax} Passenger(s)`
    : '';

  engine.drawSectionTitle('Billed To & Booking Summary');
  engine.drawKeyValueGrid(
    [
      { label: 'Agency / Partner', value: agencyName },
      { label: 'Lead Traveller / Contact', value: customerName },
      { label: 'Billing Email', value: customerEmail },
      { label: 'Contact Phone', value: customerPhone },
      { label: 'Billing Address', value: invoice.billingAddress || invoice.agencyAddress || '' },
      { label: 'Destination', value: destination },
      { label: 'Travel Dates', value: travelDates },
      { label: 'Passenger Summary', value: paxSummary }
    ],
    2
  );

  if (invoice.bookingDescription) {
    engine.drawParagraphBlock('Booking Description', invoice.bookingDescription);
  }

  // Scope of Booked Services (Descriptive schedule ONLY — NO separate line prices/tax/fee breakdown)
  const activeServices: { name: string; date: string; category: string; pax: string }[] =
    booking?.items && booking.items.length > 0
      ? sortBookingItemsChronologically(
          booking.items
            .filter(it => !it.isCancelled && it.operationalStatus !== 'Cancelled')
            .map(it => hydrateBookingServiceItem(it, booking))
        ).map(it => ({
          name: it.productName,
          date: it.resolvedServiceDate ? formatReadableDate(it.resolvedServiceDate) : 'Scheduled',
          category: it.category || 'Service',
          pax: `${it.totalPax} Pax`
        }))
      : (invoice.services || []).map(s => ({
          name: (s as any).description || s.serviceName || 'Travel Service',
          date: (s as any).serviceDate || 'As Per Booking',
          category: s.category || 'Booked Service',
          pax: `${s.quantity || 1} Unit(s)`
        }));

  if (activeServices.length > 0) {
    const drawScopeTableHeader = () => {
      engine.ensureSpace(16);
      const thY = engine.cursorY;
      engine.pdf.setFillColor(...COLOR_OBSIDIAN);
      engine.pdf.rect(MARGIN_X, thY, CONTENT_W, 7.5, 'F');
      engine.pdf.setTextColor(...COLOR_WHITE);
      engine.pdf.setFont('helvetica', 'bold');
      engine.pdf.setFontSize(7.6);
      engine.pdf.text('#', MARGIN_X + 3, thY + 5);
      engine.pdf.text('SERVICE DESCRIPTION', MARGIN_X + 12, thY + 5);
      engine.pdf.text('CATEGORY', MARGIN_X + 108, thY + 5);
      engine.pdf.text('DATE', MARGIN_X + 142, thY + 5);
      engine.pdf.text('PAX', PAGE_W - MARGIN_X - 3, thY + 5, { align: 'right' });
      engine.recordBlock(thY, thY + 7.5, 'ProformaScopeHeader');
      engine.cursorY = thY + 7.5;
    };

    engine.drawSectionTitle('Booked Services Scope', `${activeServices.length} Service${activeServices.length === 1 ? '' : 's'}`);
    drawScopeTableHeader();

    activeServices.forEach((srv, idx) => {
      engine.pdf.setFont('helvetica', 'normal');
      engine.pdf.setFontSize(8.2);
      const nameLines: string[] = engine.pdf.splitTextToSize(sanitizePdfText(srv.name), 92);
      const rowH = Math.max(7.5, nameLines.length * 4 + 3);
      const pageBefore = engine.getCurrentPage();
      engine.ensureSpace(rowH + 1);
      if (engine.getCurrentPage() > pageBefore) {
        drawScopeTableHeader();
      }
      const ry = engine.cursorY;

      engine.pdf.setFillColor(...(idx % 2 === 0 ? COLOR_WHITE : COLOR_SLATE_50));
      engine.pdf.setDrawColor(...COLOR_SLATE_200);
      engine.pdf.setLineWidth(0.2);
      engine.pdf.rect(MARGIN_X, ry, CONTENT_W, rowH, 'FD');

      engine.pdf.setTextColor(...COLOR_SLATE_500);
      engine.pdf.setFont('helvetica', 'bold');
      engine.pdf.text(String(idx + 1), MARGIN_X + 3, ry + 4.8);

      engine.pdf.setTextColor(...COLOR_SLATE_900);
      engine.pdf.setFont('helvetica', 'bold');
      nameLines.forEach((ln, lIdx) => {
        engine.pdf.text(ln, MARGIN_X + 12, ry + 4.8 + lIdx * 4);
      });

      engine.pdf.setFont('helvetica', 'normal');
      engine.pdf.setTextColor(...COLOR_SLATE_700);
      engine.pdf.text(sanitizePdfText(srv.category).slice(0, 18), MARGIN_X + 108, ry + 4.8);
      engine.pdf.text(sanitizePdfText(srv.date).slice(0, 18), MARGIN_X + 142, ry + 4.8);
      engine.pdf.text(sanitizePdfText(srv.pax), PAGE_W - MARGIN_X - 3, ry + 4.8, { align: 'right' });

      engine.recordBlock(ry, ry + rowH, `ProformaScopeRow:${idx + 1}`);
      engine.cursorY = ry + rowH;
    });

    engine.cursorY += 5;
  }

  // AUTHORITATIVE COMMERCIAL SUMMARY — FINAL BOOKING AMOUNT ONLY
  // STRICT: NO TAX, NO GST, NO SERVICE FEE, NO MARGIN, NO SUPPLIER NETT COST
  const hasPaid = amountPaid > 0;
  const hasCredit = creditBalance > 0;
  const summaryBoxH = hasPaid ? (hasCredit ? 41 : 34) : 21;
  engine.ensureSpace(summaryBoxH + 14);
  engine.drawSectionTitle('Commercial Amount Summary', `Snapshot ${snapshotRef}`);

  const boxY = engine.cursorY;
  engine.pdf.setFillColor(...COLOR_OBSIDIAN);
  engine.pdf.roundedRect(MARGIN_X, boxY, CONTENT_W, summaryBoxH, 2.2, 2.2, 'F');

  // Top primary row: Final Booking Amount
  engine.pdf.setTextColor(180, 224, 216);
  engine.pdf.setFont('helvetica', 'bold');
  engine.pdf.setFontSize(8.5);
  engine.pdf.text('FINAL BOOKING AMOUNT', MARGIN_X + 6, boxY + 8.5);

  engine.pdf.setTextColor(...COLOR_WHITE);
  engine.pdf.setFont('helvetica', 'bold');
  engine.pdf.setFontSize(15);
  engine.pdf.text(formatPdfMoney(finalBookingAmount, currency), PAGE_W - MARGIN_X - 6, boxY + 10.5, { align: 'right' });

  engine.pdf.setTextColor(190, 210, 218);
  engine.pdf.setFont('helvetica', 'normal');
  engine.pdf.setFontSize(7.4);
  engine.pdf.text(
    `Consolidated Final Booking Amount locked to Pricing Snapshot ${snapshotRef}.`,
    MARGIN_X + 6,
    boxY + 14.5
  );

  if (hasPaid) {
    engine.pdf.setDrawColor(40, 75, 92);
    engine.pdf.setLineWidth(0.3);
    engine.pdf.line(MARGIN_X + 6, boxY + 18.5, PAGE_W - MARGIN_X - 6, boxY + 18.5);

    engine.pdf.setFont('helvetica', 'normal');
    engine.pdf.setFontSize(8.5);
    engine.pdf.setTextColor(210, 225, 232);
    engine.pdf.text('Amount Received To Date', MARGIN_X + 6, boxY + 24);
    engine.pdf.text(formatPdfMoney(amountPaid, currency), PAGE_W - MARGIN_X - 6, boxY + 24, { align: 'right' });

    engine.pdf.setFont('helvetica', 'bold');
    engine.pdf.setFontSize(9.5);
    engine.pdf.setTextColor(0, 198, 166);
    engine.pdf.text('BALANCE DUE', MARGIN_X + 6, boxY + 30.5);
    engine.pdf.text(formatPdfMoney(balanceDue, currency), PAGE_W - MARGIN_X - 6, boxY + 30.5, { align: 'right' });

    if (hasCredit) {
      engine.pdf.setFont('helvetica', 'bold');
      engine.pdf.setFontSize(8.5);
      engine.pdf.setTextColor(253, 224, 71);
      engine.pdf.text('CREDIT / OVERPAYMENT BALANCE', MARGIN_X + 6, boxY + 37);
      engine.pdf.text(formatPdfMoney(creditBalance, currency), PAGE_W - MARGIN_X - 6, boxY + 37, { align: 'right' });
    }
  }

  engine.recordBlock(boxY, boxY + summaryBoxH, 'ProformaFinalBookingAmountBox');
  engine.cursorY = boxY + summaryBoxH + 6;

  // Remittance / Bank Wire Instructions
  const bank = invoice.bankAccountDetails;
  if (bank && (bank.bankName || bank.accountNumber || bank.accountName)) {
    engine.drawSectionTitle('Payment & Wire Remittance Details');
    engine.drawKeyValueGrid(
      [
        { label: 'Bank Name', value: bank.bankName || '' },
        { label: 'Account Name', value: bank.accountName || '' },
        { label: 'Account Number', value: bank.accountNumber || '' },
        { label: 'SWIFT / BIC Code', value: bank.swiftBic || '' },
        { label: 'IBAN / Routing', value: bank.iban || '' },
        { label: 'Payment Reference', value: bookingRef }
      ],
      2
    );
  }

  // Notes & Proforma Terms
  if (invoice.notes) {
    engine.drawParagraphBlock('Billing Notes', invoice.notes);
  }
  if (invoice.terms) {
    engine.drawParagraphBlock('Proforma Invoice Terms & Conditions', invoice.terms);
  }

  // Authoritative Company Profile Footer & Non-Tax Disclaimer
  const footerCompanyName = companyProfile?.legalName || companyProfile?.companyName || invoice.companyName || '';
  const footerContact = [
    companyProfile?.email || invoice.companyEmail,
    companyProfile?.phone || invoice.companyPhone,
    companyProfile?.website || invoice.companyWebsite
  ]
    .filter(Boolean)
    .join('  |  ');
  const footerLines = [
    footerCompanyName ? `Issued By: ${footerCompanyName}` : '',
    regAddress ? `Registered Address: ${regAddress}` : '',
    curAddress ? `Current Address: ${curAddress}` : '',
    footerContact ? `Contact: ${footerContact}` : '',
    'Disclaimer: This Proforma Invoice is a preliminary commercial document issued for booking confirmation and remittance guidance only. It is not a final statutory invoice.'
  ]
    .filter(Boolean)
    .join('\n');
  engine.drawParagraphBlock('Company Details & Commercial Disclaimer', footerLines);

  const filename = `Proforma_Invoice_${safeFileSegment(invoiceNum)}_${safeFileSegment(bookingRef)}_v${versionNum}.pdf`;
  return engine.buildResult(filename, 'Proforma Invoice');
}
