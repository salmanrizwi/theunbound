import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas-pro';
import { Quotation } from '../types';
import { AppDatabase } from './db';
import { buildQuotePresentationModel, QuotePresentationModel } from './quotePresentationModel';
import { paginateQuotePresentationModel, getPageContentBounds, RenderedPage, A4_DIMENSIONS } from './pdfPaginationEngine';

export interface PDFExportOptions {
  quote: Quotation;
  agentName?: string;
  agentAgency?: string;
  agentEmail?: string;
  agentRole?: string;
  agentLogoUrl?: string;
  leadId?: string;
}

/**
 * Creates discrete A4 page elements for high-fidelity, print-accurate PDF generation.
 */
function createPageContainerElements(pages: RenderedPage[]): HTMLElement {
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
    const bounds = getPageContentBounds(page.pageNumber);
    const pageEl = document.createElement('div');
    pageEl.className = `proposal-pdf-page proposal-pdf-page-${page.pageNumber}`;
    pageEl.style.width = `${A4_DIMENSIONS.width}px`;
    pageEl.style.height = `${A4_DIMENSIONS.height}px`;
    pageEl.style.minHeight = `${A4_DIMENSIONS.height}px`;
    pageEl.style.boxSizing = 'border-box';
    pageEl.style.padding = `${A4_DIMENSIONS.topMargin}px ${A4_DIMENSIONS.leftMargin}px ${A4_DIMENSIONS.bottomMargin}px ${A4_DIMENSIONS.rightMargin}px`;
    pageEl.style.backgroundColor = '#ffffff';
    pageEl.style.color = '#0f172a';
    pageEl.style.fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    pageEl.style.position = 'relative';

    // Content Zone (Header + Blocks) - Flows naturally with no overflow clipping
    const contentZone = document.createElement('div');
    contentZone.className = 'proposal-pdf-content-zone';
    contentZone.style.width = '100%';
    contentZone.style.display = 'flex';
    contentZone.style.flexDirection = 'column';
    contentZone.style.justifyContent = 'flex-start';

    if (page.headerHtml) {
      const headerWrapper = document.createElement('div');
      headerWrapper.className = 'proposal-pdf-header-zone';
      headerWrapper.style.marginBottom = '12px';
      headerWrapper.innerHTML = page.headerHtml;
      contentZone.appendChild(headerWrapper);
    }

    const blocksWrapper = document.createElement('div');
    blocksWrapper.className = 'proposal-pdf-blocks-zone';
    blocksWrapper.style.display = 'flex';
    blocksWrapper.style.flexDirection = 'column';
    blocksWrapper.innerHTML = page.blocks.map(b => b.html).join('');
    contentZone.appendChild(blocksWrapper);

    pageEl.appendChild(contentZone);

    // Guaranteed Protected Footer Zone pinned at page bottom
    const footerZone = document.createElement('div');
    footerZone.className = 'proposal-pdf-footer-zone';
    footerZone.style.position = 'absolute';
    footerZone.style.left = `${A4_DIMENSIONS.leftMargin}px`;
    footerZone.style.right = `${A4_DIMENSIONS.rightMargin}px`;
    footerZone.style.bottom = `${A4_DIMENSIONS.bottomMargin}px`;
    footerZone.style.height = `${A4_DIMENSIONS.footerHeight}px`;
    footerZone.innerHTML = page.footerHtml;

    pageEl.appendChild(footerZone);
    rootWrapper.appendChild(pageEl);
  });

  return rootWrapper;
}

/**
 * Generate a multi-page A4 PDF by rendering each discrete semantic page with html2canvas-pro.
 */
export async function generateQuotationPDFFromModel(model: QuotePresentationModel): Promise<jsPDF> {
  const pages = paginateQuotePresentationModel(model);
  const wrapper = createPageContainerElements(pages);
  document.body.appendChild(wrapper);

  try {
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageElements = wrapper.querySelectorAll('.proposal-pdf-page');

    for (let i = 0; i < pageElements.length; i++) {
      const pageEl = pageElements[i] as HTMLElement;

      const canvas = await html2canvas(pageEl, {
        scale: 2, // Retina resolution
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: A4_DIMENSIONS.width,
        height: A4_DIMENSIONS.height,
        windowWidth: A4_DIMENSIONS.width
      });

      const imgData = canvas.toDataURL('image/jpeg', 0.96);

      if (i > 0) {
        pdf.addPage('a4', 'portrait');
      }

      // Add full A4 image with zero stretching
      pdf.addImage(imgData, 'JPEG', 0, 0, 210, 297, undefined, 'FAST');
    }

    return pdf;
  } finally {
    if (wrapper.parentNode) {
      wrapper.parentNode.removeChild(wrapper);
    }
  }
}

/**
 * Download Quotation PDF with print-aware semantic pagination and guaranteed footer safe area.
 */
export async function downloadQuotationPDF(options: PDFExportOptions): Promise<void> {
  try {
    const presentationModel = buildQuotePresentationModel(options.quote, {
      name: options.agentName,
      agencyName: options.agentAgency,
      email: options.agentEmail
    });

    const pdf = await generateQuotationPDFFromModel(presentationModel);
    const filename = `Itinerary-${options.quote.quoteNumber || 'Proposal'}.pdf`;
    pdf.save(filename);

    // Section 32 Mandate: Track QUOTE_PDF_GENERATED communication event
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
    } catch (auditErr) {
      console.error('Failed to log PDF communication audit:', auditErr);
    }
  } catch (error) {
    console.error('Error generating Quotation PDF:', error);
  }
}
