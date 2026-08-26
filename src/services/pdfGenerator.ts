import { jsPDF } from 'jspdf';
import { Quotation, QuoteItem, CurrencyCode } from '../types';
import { formatCurrency } from './pricingEngine';

export interface PDFExportOptions {
  quote: Quotation;
  agentName?: string;
  agentAgency?: string;
  agentEmail?: string;
  agentRole?: string;
}

export function generateQuotationPDF(options: PDFExportOptions): jsPDF {
  const { quote, agentName, agentAgency, agentEmail, agentRole } = options;

  // Initialize jsPDF document (A4 format, millimeters)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2; // 182mm

  let currentY = margin;

  // Helper for page break check
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 20) {
      doc.addPage();
      currentY = margin;
      drawSubsequentHeader();
    }
  };

  const drawSubsequentHeader = () => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, currentY, contentWidth, 8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(0, 198, 166);
    doc.text('THEUNBOUND DMC • OFFICIAL ITINERARY PROPOSAL', margin + 3, currentY + 5.5);
    doc.setTextColor(255, 255, 255);
    doc.text(`REF: ${quote.quoteNumber || 'UBQ-2026'}`, pageWidth - margin - 3, currentY + 5.5, { align: 'right' });
    currentY += 12;
  };

  // ----------------------------------------------------
  // 1. TOP HEADER & BRANDING BAR
  // ----------------------------------------------------
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, currentY, contentWidth, 28, 3, 3, 'F');

  // Left Brand Title
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('THEUNBOUND DMC', margin + 6, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(0, 229, 192); // Teal
  doc.text('Destination Management Company • Ground Logistics & Wholesaler', margin + 6, currentY + 17);

  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text('Official Contact: sales@theunbound.in • +91-9811654959 / 011-41185542', margin + 6, currentY + 23);

  // Right Quotation Info
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`QUOTE REF: ${quote.quoteNumber || 'UBQ-2026'}`, pageWidth - margin - 6, currentY + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(203, 213, 225); // slate-300
  doc.text(`Issue Date: ${new Date(quote.createdAt || Date.now()).toLocaleDateString()}`, pageWidth - margin - 6, currentY + 16, { align: 'right' });
  doc.text(`Valid For: 14 Calendar Days`, pageWidth - margin - 6, currentY + 22, { align: 'right' });

  currentY += 33;

  // ----------------------------------------------------
  // 2. CLIENT & AGENT DETAILS CARD
  // ----------------------------------------------------
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  // Left: Valued Client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text('CLIENT / GUEST PROFILE', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(quote.clientName || 'Private Client Group', margin + 4, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const clientSub = [quote.clientEmail, quote.clientCompany].filter(Boolean).join(' • ');
  doc.text(clientSub || 'Destination Itinerary Inquiry', margin + 4, currentY + 18);

  // Right: Consultant & Destination
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text('CONSULTANT & DESTINATION', pageWidth / 2 + 6, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text(`Destination: ${quote.destination || 'Japan & East Asia'}`, pageWidth / 2 + 6, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  const consultantText = agentAgency 
    ? `${agentName || 'Travel Partner'} (${agentAgency})`
    : `TheUnbound Ground Operations (${agentName || 'Operations Desk'})`;
  doc.text(consultantText, pageWidth / 2 + 6, currentY + 18);

  currentY += 29;

  // ----------------------------------------------------
  // 3. ITINERARY LINE ITEMS TABLE
  // ----------------------------------------------------
  checkPageBreak(30);

  // Table Header
  doc.setFillColor(30, 41, 59); // slate-800
  doc.rect(margin, currentY, contentWidth, 7, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);

  const colX = {
    idx: margin + 2,
    service: margin + 10,
    city: margin + 80,
    date: margin + 112,
    pax: margin + 138,
    total: pageWidth - margin - 3
  };

  doc.text('#', colX.idx, currentY + 5);
  doc.text('SERVICE / EXPERIENCE', colX.service, currentY + 5);
  doc.text('CITY / HUB', colX.city, currentY + 5);
  doc.text('DATE', colX.date, currentY + 5);
  doc.text('PAX', colX.pax, currentY + 5);
  doc.text('RATE (' + quote.currency + ')', colX.total, currentY + 5, { align: 'right' });

  currentY += 7;

  // Table Body Rows
  quote.items.forEach((item, index) => {
    checkPageBreak(14);

    const isEven = index % 2 === 0;
    if (isEven) {
      doc.setFillColor(248, 250, 252);
      doc.rect(margin, currentY, contentWidth, 12, 'F');
    }

    doc.setDrawColor(241, 245, 249);
    doc.line(margin, currentY + 12, margin + contentWidth, currentY + 12);

    // Item Index
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${index + 1}`, colX.idx, currentY + 6);

    // Product Name (truncated if too long)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const serviceName = item.product.name.length > 38 
      ? item.product.name.substring(0, 36) + '...' 
      : item.product.name;
    doc.text(serviceName, colX.service, currentY + 5.5);

    // Product Category / Duration Subtitle
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`${item.product.category} • ${item.product.duration}`, colX.service, currentY + 9.5);

    // City
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(51, 65, 85);
    doc.text(item.product.city || quote.destination, colX.city, currentY + 7);

    // Travel Date
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(item.travelDate || 'Date Open', colX.date, currentY + 7);

    // Pax
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(71, 85, 105);
    const paxText = `${item.pax.adults}A` + (item.pax.children > 0 ? ` ${item.pax.children}C` : '');
    doc.text(paxText, colX.pax, currentY + 7);

    // Price
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    const itemTotal = formatCurrency(item.calculation.finalTotalSellingPrice, quote.currency);
    doc.text(itemTotal, colX.total, currentY + 7, { align: 'right' });

    currentY += 12;
  });

  currentY += 4;

  // ----------------------------------------------------
  // 4. FINANCIAL SUMMARY & TOTALS CARD
  // ----------------------------------------------------
  checkPageBreak(38);

  const summaryWidth = 85;
  const summaryX = pageWidth - margin - summaryWidth;

  doc.setFillColor(241, 245, 249); // slate-100
  doc.setDrawColor(203, 213, 225);
  doc.roundedRect(summaryX, currentY, summaryWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text('Total Itinerary Services:', summaryX + 4, currentY + 6);
  doc.text(`${quote.items.length} Curated Products`, summaryX + summaryWidth - 4, currentY + 6, { align: 'right' });

  const totalPaxCount = Math.max(1, (quote.items[0]?.pax?.adults || 1) + (quote.items[0]?.pax?.children || 0));
  doc.text('Package Rate Per Person:', summaryX + 4, currentY + 12);
  doc.text(formatCurrency(quote.totalSellingPrice / totalPaxCount, quote.currency), summaryX + summaryWidth - 4, currentY + 12, { align: 'right' });

  doc.setDrawColor(148, 163, 184);
  doc.line(summaryX + 4, currentY + 16, summaryX + summaryWidth - 4, currentY + 16);

  // Grand Total Box
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(summaryX + 2, currentY + 18, summaryWidth - 4, 11, 1.5, 1.5, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(0, 229, 192); // Teal
  doc.text('FINAL QUOTATION TOTAL:', summaryX + 5, currentY + 25);

  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(formatCurrency(quote.totalSellingPrice, quote.currency), summaryX + summaryWidth - 5, currentY + 25.5, { align: 'right' });

  // Left Note Box on the same row
  const noteBoxWidth = contentWidth - summaryWidth - 6;
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, noteBoxWidth, 32, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(15, 23, 42);
  doc.text('OPERATIONAL GROUND SERVICE GUARANTEE', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  doc.text('• All services include 24/7 on-ground bilingual dispatch coordination.', margin + 4, currentY + 12);
  doc.text('• Private vehicle transfers guaranteed with pristine late-model fleet.', margin + 4, currentY + 18);
  doc.text('• Direct supplier allotment held provisionally upon voucher release.', margin + 4, currentY + 24);

  currentY += 37;

  // ----------------------------------------------------
  // 5. TERMS & CONDITIONS
  // ----------------------------------------------------
  checkPageBreak(24);

  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 116, 139);
  doc.text('STANDARD TERMS & CONDITIONS:', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('1. Confirmation is subject to operational availability at the time of final confirmation & voucher issuance.', margin + 4, currentY + 9.5);
  doc.text('2. Standard cancellation protocol: full refund up to 72 hours prior to service commencement unless specified otherwise.', margin + 4, currentY + 13.5);
  doc.text('3. Rates are locked in ' + quote.currency + ' and guaranteed against dynamic foreign exchange fluctuations once confirmed.', margin + 4, currentY + 17.5);

  // ----------------------------------------------------
  // 6. EXACT PAGE NUMBERING (PREVENTS DUPLICATES)
  // ----------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184); // slate-400

    // Footer line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

    // Left Footer
    doc.text('TheUnbound DMC • Confidential Client Quotation Document', margin, pageHeight - 6);

    // Right Footer
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 6, { align: 'right' });
  }

  return doc;
}

export function downloadQuotationPDF(options: PDFExportOptions): void {
  const doc = generateQuotationPDF(options);
  const filename = `TheUnbound-Quotation-${options.quote.quoteNumber || 'Proposal'}.pdf`;
  doc.save(filename);
}
