import type { jsPDF as JsPDFType } from 'jspdf';
import { Quotation } from '../types';
import { AppDatabase } from './db';
import { buildQuotePresentationModel, QuotePresentationModel } from './quotePresentationModel';
import {
  paginateQuotePresentationModel,
  getPageContentBounds,
  validatePdfLayoutBounds,
  RenderedPage,
  A4_DIMENSIONS
} from './pdfPaginationEngine';
import { backgroundJobService, yieldToMainThread } from './backgroundJobService';
import { withBoundedTimeout } from './quotationOperationsService';

export interface PDFExportOptions {
  quote: Quotation;
  agentName?: string;
  agentAgency?: string;
  agentEmail?: string;
  agentPhone?: string;
  agentRole?: string;
  agentLogoUrl?: string;
  agentAddress?: string;
  agentRegisteredAddress?: string;
  agentCurrentAddress?: string;
  agentWebsite?: string;
  footerText?: string;
  disclaimer?: string;
  brandingMode?: string;
  selectedOptionIndexOrId?: number | string;
  snapshotHash?: string;
  leadId?: string;
  onComplete?: (model: QuotePresentationModel) => void;
  onError?: (err: Error) => void;
}

/**
 * Wait for all <img> elements inside a container to settle before rasterization.
 */
async function waitForImagesLoaded(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll('img'));
  if (imgs.length === 0) return;

  await Promise.all(
    imgs.map((img) => {
      if (img.complete) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const timeout = setTimeout(() => resolve(), 3500);
        const done = () => {
          clearTimeout(timeout);
          resolve();
        };
        img.addEventListener('load', done, { once: true });
        img.addEventListener('error', done, { once: true });
      });
    })
  );
}

/**
 * Creates discrete A4 page elements with three completely independent regions:
 *   A. Header Region (fixed top margin band on continuation pages)
 *   B. Body Region (strictly bounded between contentTop and contentBottom)
 *   C. Footer Region (fixed bottom margin band, separated by footerGap)
 */
export function createPageContainerElements(pages: RenderedPage[]): HTMLElement {
  const rootWrapper = document.createElement('div');
  rootWrapper.className = 'proposal-pdf-export-wrapper';
  rootWrapper.style.position = 'fixed';
  rootWrapper.style.left = '-9999px';
  rootWrapper.style.top = '0';
  rootWrapper.style.zIndex = '-9999';
  rootWrapper.style.display = 'flex';
  rootWrapper.style.flexDirection = 'column';
  rootWrapper.style.gap = '20px';

  pages.forEach((page) => {
    const bounds = page.bounds || getPageContentBounds(page.pageNumber);
    const pageEl = document.createElement('div');
    pageEl.className = `proposal-pdf-page proposal-pdf-page-${page.pageNumber}`;
    pageEl.style.width = `${bounds.width}px`;
    pageEl.style.height = `${bounds.height}px`;
    pageEl.style.minHeight = `${bounds.height}px`;
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.backgroundColor = '#ffffff';
    pageEl.style.color = '#0f172a';
    pageEl.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    pageEl.style.position = 'relative';

    // Region A: Independent Fixed Header Zone (Page 2+)
    if (page.headerHtml) {
      const headerZone = document.createElement('div');
      headerZone.className = 'proposal-pdf-header-zone';
      headerZone.style.position = 'absolute';
      headerZone.style.top = `${bounds.topMargin}px`;
      headerZone.style.left = `${bounds.leftMargin}px`;
      headerZone.style.right = `${bounds.rightMargin}px`;
      headerZone.style.minHeight = `${bounds.headerHeight}px`;
      headerZone.style.boxSizing = 'border-box';
      headerZone.innerHTML = page.headerHtml;
      pageEl.appendChild(headerZone);
    }

    // Region B: Independent Body Content Zone bounded inside [contentTop, contentBottom]
    const bodyZone = document.createElement('div');
    bodyZone.className = 'proposal-pdf-blocks-zone proposal-pdf-content-zone';
    bodyZone.style.position = 'absolute';
    bodyZone.style.top = `${bounds.contentTop}px`;
    bodyZone.style.left = `${bounds.leftMargin}px`;
    bodyZone.style.right = `${bounds.rightMargin}px`;
    bodyZone.style.display = 'flex';
    bodyZone.style.flexDirection = 'column';
    bodyZone.style.justifyContent = 'flex-start';
    bodyZone.style.boxSizing = 'border-box';
    bodyZone.innerHTML = page.blocks.map((b) => b.html).join('');
    pageEl.appendChild(bodyZone);

    // Region C: Independent Fixed Footer Zone separated by footerGap
    const footerZone = document.createElement('div');
    footerZone.className = 'proposal-pdf-footer-zone';
    footerZone.style.position = 'absolute';
    footerZone.style.left = `${bounds.leftMargin}px`;
    footerZone.style.right = `${bounds.rightMargin}px`;
    footerZone.style.bottom = `${bounds.bottomMargin}px`;
    footerZone.style.minHeight = `${bounds.footerHeight}px`;
    footerZone.style.boxSizing = 'border-box';
    footerZone.innerHTML = page.footerHtml;
    pageEl.appendChild(footerZone);

    rootWrapper.appendChild(pageEl);
  });

  return rootWrapper;
}

/**
 * Generate a multi-page A4 PDF by rendering each discrete semantic page with html2canvas-pro,
 * ensuring fonts & images are ready and verifying zero DOM collisions between Header, Body, and Footer.
 */
export async function generateQuotationPDFFromModel(
  model: QuotePresentationModel,
  onProgress?: (pct: number) => void
): Promise<JsPDFType> {
  const [{ jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas-pro')
  ]);

  if (typeof document !== 'undefined' && document.fonts?.ready) {
    try {
      await withBoundedTimeout(document.fonts.ready, 2000, 'PDF Font Loading');
    } catch {
      // Non-fatal in non-browser/restricted font or slow font contexts
    }
  }

  const pages = paginateQuotePresentationModel(model);
  const boundsValidation = validatePdfLayoutBounds(pages);
  if (!boundsValidation.valid) {
    throw new Error(`PDF Layout Bounds Check Failed: ${boundsValidation.errors.join(' | ')}`);
  }

  const wrapper = createPageContainerElements(pages);
  document.body.appendChild(wrapper);

  try {
    await withBoundedTimeout(waitForImagesLoaded(wrapper), 6000, 'PDF Image Preload').catch(() => {});

    // Verify rendered DOM geometry invariants before rasterizing
    const pageElements = Array.from(wrapper.querySelectorAll('.proposal-pdf-page')) as HTMLElement[];
    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i];
      const headerEl = pageEl.querySelector('.proposal-pdf-header-zone') as HTMLElement | null;
      const bodyEl = pageEl.querySelector('.proposal-pdf-blocks-zone') as HTMLElement | null;
      const footerEl = pageEl.querySelector('.proposal-pdf-footer-zone') as HTMLElement | null;
      if (headerEl && bodyEl) {
        const hRect = headerEl.getBoundingClientRect();
        const bRect = bodyEl.getBoundingClientRect();
        if (hRect.bottom > bRect.top + 1) {
          console.warn(
            `[PDF Geometry Guard] Page ${i + 1} header bottom (${Math.round(hRect.bottom)}) approaches body top (${Math.round(bRect.top)}).`
          );
        }
      }
      if (bodyEl && footerEl) {
        const bRect = bodyEl.getBoundingClientRect();
        const fRect = footerEl.getBoundingClientRect();
        if (bRect.bottom > fRect.top - 2) {
          console.warn(
            `[PDF Geometry Guard] Page ${i + 1} body bottom (${Math.round(bRect.bottom)}) approaches footer top (${Math.round(fRect.top)}).`
          );
        }
      }
    }

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    pdf.setProperties({
      title: `${model.destination} Travel Quotation - ${model.quoteNumber}`,
      subject: `Official Travel Quotation Proposal (${model.quoteNumber})`,
      author: model.agencyName,
      creator: model.agencyName
    });

    const total = Math.max(1, pageElements.length);

    for (let i = 0; i < pageElements.length; i++) {
      await yieldToMainThread();
      const pageEl = pageElements[i];

      const canvas = await withBoundedTimeout(
        html2canvas(pageEl, {
          scale: 2,
          useCORS: true,
          imageTimeout: 3500,
          logging: false,
          backgroundColor: '#ffffff',
          width: A4_DIMENSIONS.width,
          height: A4_DIMENSIONS.height,
          windowWidth: A4_DIMENSIONS.width
        }),
        15000,
        `PDF Page ${i + 1} Rasterization`
      );

      const imgData = canvas.toDataURL('image/jpeg', 0.96);

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
      onProgress?.(Math.round(((i + 1) / total) * 90));
    }

    return pdf;
  } finally {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }
}

/**
 * Download Quotation PDF asynchronously via BackgroundJobService (non-blocking & idempotent).
 */
export async function downloadQuotationPDF(options: PDFExportOptions): Promise<{ success: boolean; error?: string }> {
  const quoteKey = options.quote?.id || options.quote?.quoteNumber || 'quote';
  const versionKey = options.quote?.version || options.quote?.snapshotVersion || 1;
  const brandKey = options.brandingMode || options.quote?.brandingMode || 'STANDARD';
  const optionKey = options.selectedOptionIndexOrId !== undefined
    ? String(options.selectedOptionIndexOrId)
    : (options.quote?.activeOptionId || 'opt-1');
  const hashKey = options.snapshotHash || options.quote?.snapshotHash || options.quote?.authoritativeSnapshot?.snapshotHash || 'live';
  const idempotencyKey = `pdf:${quoteKey}:v${versionKey}:${options.quote?.currency || 'USD'}:${brandKey}:${optionKey}:${hashKey}`;

  try {
    await backgroundJobService.enqueue({
      idempotencyKey,
      jobType: 'PDF_EXPORT',
      label: `Generating PDF (${options.quote?.quoteNumber || quoteKey})`,
      maxRetries: 1,
      timeoutMs: 55000,
      task: async (updateProgress) => {
        updateProgress(5);
        const presentationModel = buildQuotePresentationModel(options.quote, {
          name: options.agentName,
          agencyName: options.agentAgency,
          email: options.agentEmail,
          phone: options.agentPhone,
          logoUrl: options.agentLogoUrl,
          address: options.agentAddress,
          registeredAddress: options.agentRegisteredAddress,
          currentAddress: options.agentCurrentAddress,
          website: options.agentWebsite,
          footerText: options.footerText,
          disclaimer: options.disclaimer,
          brandingMode: (options.brandingMode || options.quote.brandingMode) as any,
          selectedOptionIndexOrId: options.selectedOptionIndexOrId ?? options.quote.activeOptionId
        });

        const pdf = await generateQuotationPDFFromModel(presentationModel, updateProgress);
        const filename = `Itinerary-${options.quote.quoteNumber || 'Proposal'}.pdf`;
        pdf.save(filename);
        updateProgress(100);
        options.onComplete?.(presentationModel);

        try {
          const db = AppDatabase.getInstance();
          const commId = `comm-pdf-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
          db.saveCommunicationAuditLog({
            id: `audit-${Date.now()}`,
            communicationId: commId,
            quoteId: options.quote.id,
            leadId: options.leadId || options.quote.leadId,
            recipientEmail: options.quote.clientEmail,
            recipientType: 'BUYER',
            channel: 'PDF',
            eventType: 'QUOTE_PDF_GENERATED',
            templateVersion: '2.5.0-semantic-pagination',
            sentAt: new Date().toISOString(),
            sentByName: options.agentName || options.quote.agentName,
            deliveryStatus: 'SUCCESS'
          });

          const actorUser = db.getUserByEmail(options.agentEmail || options.quote.agentEmail || '') || null;
          db.notifyQuoteDownloaded(options.quote, actorUser);
        } catch (auditErr) {
          console.error('Failed to log PDF communication audit:', auditErr);
        }
      }
    });
    return { success: true };
  } catch (error: any) {
    console.error('Error generating Quotation PDF:', error);
    const normalizedError = error instanceof Error ? error : new Error(String(error || 'PDF export failed'));
    options.onError?.(normalizedError);
    return { success: false, error: normalizedError.message };
  }
}
