import { jsPDF } from 'jspdf';
import { Quotation, QuoteItem, CurrencyCode, TripRouteHub } from '../types';
import { formatCurrency } from './pricingEngine';
import { AppDatabase } from './db';

export interface PDFExportOptions {
  quote: Quotation;
  agentName?: string;
  agentAgency?: string;
  agentEmail?: string;
  agentRole?: string;
  agentLogoUrl?: string;
  leadId?: string;
}

interface ItineraryDayData {
  dayNumber: number;
  dateString: string;
  dayOfWeek: string;
  formattedDate: string;
  hub: TripRouteHub | null;
  isTransitionDay: boolean;
  prevHub: TripRouteHub | null;
  customTheme?: string;
  items: QuoteItem[];
}

export function generateQuotationPDF(options: PDFExportOptions): jsPDF {
  const { quote, agentName, agentAgency, agentEmail, agentRole, agentLogoUrl, leadId } = options;

  const effectiveLeadId = leadId || quote.leadId;
  const effectiveAgentLogo = agentLogoUrl || quote.agentLogoUrl;
  const effectiveAgency = agentAgency || quote.agentAgency;
  const effectiveAgentName = agentName || quote.agentName || 'Travel Specialist';

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

  // ----------------------------------------------------
  // DAY-WISE CHRONOLOGICAL ITINERARY COMPUTATION
  // ----------------------------------------------------
  const items = quote.items || [];
  const hubs = quote.routeHubs || [];
  const sortedHubs = [...hubs].sort((a, b) => a.order - b.order);

  const startDateStr = quote.travelStartDate;
  const endDateStr = quote.travelEndDate;

  let calDays: Array<{ dayNumber: number; dateString: string; dayOfWeek: string; formattedDate: string }> = [];

  if (startDateStr && endDateStr) {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    if (!isNaN(start.getTime()) && !isNaN(end.getTime()) && start <= end) {
      const current = new Date(start);
      let dayCount = 1;
      while (current <= end) {
        const iso = current.toISOString().split('T')[0];
        calDays.push({
          dayNumber: dayCount,
          dateString: iso,
          dayOfWeek: current.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: current.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
        current.setDate(current.getDate() + 1);
        dayCount++;
      }
    }
  }

  // Fallback: If no dates or invalid, derive from items travelDates or generate default
  if (calDays.length === 0) {
    const validDates: string[] = items.map(it => it.travelDate).filter((d): d is string => Boolean(d));
    const uniqueDates: string[] = Array.from(new Set<string>(validDates)).sort();
    if (uniqueDates.length > 0) {
      calDays = uniqueDates.map((dateStr, idx) => {
        const d = new Date(dateStr);
        return {
          dayNumber: idx + 1,
          dateString: dateStr,
          dayOfWeek: isNaN(d.getTime()) ? `Day ${idx + 1}` : d.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: isNaN(d.getTime()) ? dateStr : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        };
      });
    } else {
      const totalNights = hubs.reduce((sum, h) => sum + (h.nights || 0), 0) || Math.max(items.length, 3);
      const base = new Date();
      for (let i = 0; i <= totalNights; i++) {
        const d = new Date(base);
        d.setDate(base.getDate() + i);
        calDays.push({
          dayNumber: i + 1,
          dateString: d.toISOString().split('T')[0],
          dayOfWeek: d.toLocaleDateString('en-US', { weekday: 'short' }),
          formattedDate: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
        });
      }
    }
  }

  // Helper predicate for Visa & Ancillary quotation items
  const isVisaQuoteItem = (it: QuoteItem): boolean => {
    return it.service_type === 'VISA' ||
           it.service_type === 'TRAVEL_PROTECTION' ||
           it.service_type === 'VIP_GROUND' ||
           it.service_type === 'CONNECTIVITY' ||
           it.category === 'Visa & Ancillary Services' ||
           it.product.productType === 'Visa Service' || 
           it.product.productType === 'Travel Protection' ||
           it.product.productType === '5G Connectivity' ||
           it.product.subcategory === 'Visa Facilitation' || 
           it.product.subcategory === 'Travel Insurance' ||
           it.product.subcategory === 'Ground VIP Services' ||
           it.product.subcategory === 'eSIM Connectivity' ||
           it.product.sku?.startsWith('VSA-') ||
           it.product.sku?.startsWith('VISA-') ||
           it.product.sku?.startsWith('INS-') ||
           it.product.sku?.startsWith('VIP-') ||
           it.product.sku?.startsWith('ESIM-') ||
           (it.product.category === 'Travel Services' && it.product.name?.toLowerCase().includes('visa')) ||
           Boolean(it.product.name?.toLowerCase().includes('visa') && it.product.name?.toLowerCase().includes('entry'));
  };

  const visaItems = items.filter(isVisaQuoteItem);
  const nonVisaItems = items.filter(it => !isVisaQuoteItem(it));

  // Map each day to active hub and items
  const itineraryDays: ItineraryDayData[] = calDays.map((calDay) => {
    let activeHub: TripRouteHub | null = null;
    let isTransitionDay = false;
    let prevHub: TripRouteHub | null = null;

    if (sortedHubs.length > 0) {
      let runningNightCount = 0;
      for (let i = 0; i < sortedHubs.length; i++) {
        const hub = sortedHubs[i];
        const hubNights = hub.nights || 1;
        const hubStartDay = runningNightCount + 1;
        const hubEndDay = runningNightCount + hubNights;

        if (calDay.dayNumber >= hubStartDay && calDay.dayNumber <= hubEndDay) {
          activeHub = hub;
          if (calDay.dayNumber === hubStartDay && i > 0) {
            isTransitionDay = true;
            prevHub = sortedHubs[i - 1];
          }
          break;
        }
        runningNightCount += hubNights;
      }

      if (!activeHub && sortedHubs.length > 0) {
        activeHub = sortedHubs[sortedHubs.length - 1];
      }
    }

    const dayItems = nonVisaItems.filter(it => it.travelDate === calDay.dateString);
    const customTheme = quote.dayThemes?.[calDay.dayNumber];

    return {
      ...calDay,
      hub: activeHub,
      isTransitionDay,
      prevHub,
      customTheme,
      items: dayItems
    };
  });

  const generalInclusionItems = nonVisaItems.filter(it => !it.travelDate || !calDays.some(d => d.dateString === it.travelDate));
  const totalNights = hubs.reduce((sum, h) => sum + (h.nights || 0), 0) || Math.max(1, itineraryDays.length - 1);
  const totalPax = quote.totalPax || (quote.adultsCount || 2) + (quote.childrenCount || 0);

  // Helper for page break check
  const checkPageBreak = (neededHeight: number) => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      currentY = margin;
      drawSubsequentHeader();
    }
  };

  const drawSubsequentHeader = () => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.rect(margin, currentY, contentWidth, 7.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(0, 229, 192);
    doc.text('TRAVEL OPERATIONS • BESPOKE ITINERARY PROPOSAL', margin + 3, currentY + 5);
    doc.setTextColor(255, 255, 255);
    const refText = `REF: ${quote.quoteNumber || 'UBQ-2026'}${effectiveLeadId ? ` • LEAD: ${effectiveLeadId}` : ''}`;
    doc.text(refText, pageWidth - margin - 3, currentY + 5, { align: 'right' });
    currentY += 11;
  };

  const drawQuoteItemCard = (
    item: QuoteItem,
    title: string,
    badgeLabel: string,
    sublineText: string,
    priceText: string,
    isEven: boolean
  ) => {
    const cleanLine = (str: string) => {
      return str
        .replace(/<[^>]*>/g, '') // strip HTML tags
        .replace(/\*\*|__/g, '') // strip bold markdown
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .trim();
    };

    const overviewRaw = item.contentSnapshot?.overviewSpecifications || 
                        item.product?.longDescription || 
                        item.product?.description || 
                        item.product?.shortDescription || '';
    
    const overview = cleanLine(overviewRaw);

    const rawInclusions = item.contentSnapshot?.inclusions || item.product?.inclusions || [];
    const inclusions = Array.isArray(rawInclusions) ? rawInclusions.map(inc => cleanLine(String(inc))).filter(Boolean) : [];

    const rawExclusions = item.contentSnapshot?.exclusions || item.product?.exclusions || [];
    const exclusions = Array.isArray(rawExclusions) ? rawExclusions.map(exc => cleanLine(String(exc))).filter(Boolean) : [];

    const notes = cleanLine(item.notes || '');

    // Wrap all text lines to estimate height
    const wrappedOverviewLines = overview ? doc.splitTextToSize(overview, contentWidth - 16) : [];
    const overviewHeight = wrappedOverviewLines.length > 0 ? (wrappedOverviewLines.length * 3.5 + 4) : 0;

    const inclusionLines: string[][] = inclusions.map(inc => doc.splitTextToSize(`✓  ${inc}`, contentWidth - 18));
    const totalInclusionLines = inclusionLines.reduce((sum, lines) => sum + lines.length, 0);
    const inclusionsHeight = totalInclusionLines > 0 ? (totalInclusionLines * 3.2 + 4) : 0;

    const exclusionLines: string[][] = exclusions.map(exc => doc.splitTextToSize(`✕  ${exc}`, contentWidth - 18));
    const totalExclusionLines = exclusionLines.reduce((sum, lines) => sum + lines.length, 0);
    const exclusionsHeight = totalExclusionLines > 0 ? (totalExclusionLines * 3.2 + 4) : 0;

    const wrappedNotesLines = notes ? doc.splitTextToSize(`Special Instructions: ${notes}`, contentWidth - 16) : [];
    const notesHeight = wrappedNotesLines.length > 0 ? (wrappedNotesLines.length * 3.2 + 4) : 0;

    // Header, subline + padding = 13mm
    const totalCardHeight = 13 + overviewHeight + inclusionsHeight + exclusionsHeight + notesHeight + 2;

    const checkBreak = (neededHeight: number) => {
      if (currentY + neededHeight > pageHeight - 16) {
        doc.addPage();
        currentY = margin;
        drawSubsequentHeader();
        return true;
      }
      return false;
    };

    // Perform a break check for the total card height (or a minimum of 35mm if the card is huge, so it breaks at header)
    checkBreak(Math.min(totalCardHeight, 35));

    const cardStartY = currentY;

    // Draw background card container FIRST so text lays on top
    doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin + 2, cardStartY, contentWidth - 4, totalCardHeight - 2, 1.5, 1.5, 'FD');

    let cardY = cardStartY + 5;

    // 1. Badge, Title & Price Header
    // Badge background
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin + 4, cardY - 2.5, 24, 4.5, 0.5, 0.5, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(51, 65, 85);
    doc.text(badgeLabel.toUpperCase().substring(0, 16), margin + 16, cardY + 0.5, { align: 'center' });

    // Title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    const truncatedTitle = title.length > 55 ? title.substring(0, 52) + '...' : title;
    doc.text(truncatedTitle, margin + 31, cardY + 1);

    // Price (on the right)
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(15, 23, 42);
    doc.text(priceText, pageWidth - margin - 5, cardY + 1, { align: 'right' });

    cardY += 4.5;

    // 2. Subline Details & Confirmed badge
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(sublineText, margin + 31, cardY + 0.5);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);
    doc.setTextColor(0, 168, 143);
    doc.text('Confirmed Allotment', pageWidth - margin - 5, cardY + 0.5, { align: 'right' });

    cardY += 5;

    // 3. Overview & Specifications
    if (wrappedOverviewLines.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(148, 163, 184);
      doc.text('OVERVIEW & SPECIFICATIONS', margin + 6, cardY);
      cardY += 3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      wrappedOverviewLines.forEach(line => {
        if (checkBreak(4)) {
          // If a page break occurred during text drawing, redraw background rect for continuity
          doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(margin + 2, currentY, contentWidth - 4, pageHeight - 16 - currentY, 1.5, 1.5, 'FD');
          cardY = currentY + 5;
        }
        doc.text(line, margin + 6, cardY);
        cardY += 3.2;
      });
      cardY += 1;
    }

    // 4. Inclusions
    if (inclusions.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text('INCLUSIONS', margin + 6, cardY);
      cardY += 3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      inclusionLines.forEach(lines => {
        lines.forEach(line => {
          if (checkBreak(4)) {
            doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin + 2, currentY, contentWidth - 4, pageHeight - 16 - currentY, 1.5, 1.5, 'FD');
            cardY = currentY + 5;
          }
          doc.text(line, margin + 6, cardY);
          cardY += 3.2;
        });
      });
      cardY += 1;
    }

    // 5. Exclusions
    if (exclusions.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text('EXCLUSIONS', margin + 6, cardY);
      cardY += 3;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      exclusionLines.forEach(lines => {
        lines.forEach(line => {
          if (checkBreak(4)) {
            doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
            doc.setDrawColor(226, 232, 240);
            doc.roundedRect(margin + 2, currentY, contentWidth - 4, pageHeight - 16 - currentY, 1.5, 1.5, 'FD');
            cardY = currentY + 5;
          }
          doc.text(line, margin + 6, cardY);
          cardY += 3.2;
        });
      });
      cardY += 1;
    }

    // 6. Notes
    if (wrappedNotesLines.length > 0) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      wrappedNotesLines.forEach(line => {
        if (checkBreak(4)) {
          doc.setFillColor(isEven ? 248 : 255, isEven ? 250 : 255, isEven ? 252 : 255);
          doc.setDrawColor(226, 232, 240);
          doc.roundedRect(margin + 2, currentY, contentWidth - 4, pageHeight - 16 - currentY, 1.5, 1.5, 'FD');
          cardY = currentY + 5;
        }
        doc.text(line, margin + 6, cardY);
        cardY += 3.2;
      });
      cardY += 1;
    }

    currentY = cardY + 2;
  };


  // ----------------------------------------------------
  // 1. TOP HEADER & BRANDING BAR (With Partner Agency Co-Branding)
  // ----------------------------------------------------
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, currentY, contentWidth, 28, 2.5, 2.5, 'F');

  let textStartX = margin + 5;
  if (effectiveAgentLogo) {
    try {
      doc.setFillColor(255, 255, 255);
      doc.roundedRect(margin + 4, currentY + 3.5, 21, 21, 1.5, 1.5, 'F');
      if (effectiveAgentLogo.startsWith('data:image') || effectiveAgentLogo.startsWith('http')) {
        doc.addImage(effectiveAgentLogo, 'JPEG', margin + 4.5, currentY + 4, 20, 20);
      } else {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(15, 23, 42);
        doc.text('AGENCY', margin + 6, currentY + 15);
      }
      textStartX = margin + 28;
    } catch (e) {
      textStartX = margin + 5;
    }
  }

  // Brand Header Titles
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  const mainHeaderTitle = effectiveAgency ? effectiveAgency.toUpperCase() : 'DESTINATION MANAGEMENT & OPERATIONS';
  doc.text(mainHeaderTitle, textStartX, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 229, 192); // Teal
  const subTitle = effectiveAgency 
    ? `Authorized Travel Partner • In Association with Wholesale Ground Network`
    : `Destination Management Company • Direct Ground Logistics & Wholesale Hub`;
  doc.text(subTitle, textStartX, currentY + 15);

  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184); // slate-400
  const contactLine = agentEmail
    ? `Specialist: ${effectiveAgentName} (${agentEmail}) • Ground Desk: sales@theunbound.in`
    : `Direct Operations Desk: sales@theunbound.in • 24/7 Global Dispatch & Support`;
  doc.text(contactLine, textStartX, currentY + 21);

  // Right Side Quotation Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text(`QUOTE: ${quote.quoteNumber || 'UBQ-2026'}${quote.version ? ` (v${quote.version})` : ''}`, pageWidth - margin - 5, currentY + 8.5, { align: 'right' });

  if (effectiveLeadId) {
    doc.setFontSize(7.5);
    doc.setTextColor(0, 229, 192);
    doc.text(`LEAD REF: ${effectiveLeadId}`, pageWidth - margin - 5, currentY + 14, { align: 'right' });
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`Issue Date: ${new Date(quote.createdAt || Date.now()).toLocaleDateString()}`, pageWidth - margin - 5, currentY + (effectiveLeadId ? 19.5 : 15), { align: 'right' });
  doc.text(`Validity: 14 Days`, pageWidth - margin - 5, currentY + (effectiveLeadId ? 24 : 20.5), { align: 'right' });

  currentY += 31;

  // ----------------------------------------------------
  // 2. HERO JOURNEY OVERVIEW CARD (Destination & Route Hubs)
  // ----------------------------------------------------
  doc.setFillColor(30, 41, 59); // slate-800
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'F');

  // Left: Journey Title & Stats
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 229, 192);
  doc.text('CURATED ITINERARY OVERVIEW', margin + 4, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`${quote.destination || 'Japan'} Bespoke Travel Journey`, margin + 4, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(203, 213, 225);
  const tripStats = `${itineraryDays.length} Days / ${totalNights} Nights • ${totalPax} Guests (${quote.adultsCount || 2} Adults${quote.childrenCount ? `, ${quote.childrenCount} Ch` : ''})${quote.travelStartDate ? ` • ${quote.travelStartDate} → ${quote.travelEndDate || 'Open'}` : ''}`;
  doc.text(tripStats, margin + 4, currentY + 18);

  // Right: Price Per Person Block
  const effectiveSellingPrice = quote.finalCustomerSellingPrice || quote.final_customer_selling_price || quote.totalSellingPrice;
  const pricePerPerson = effectiveSellingPrice / Math.max(1, totalPax);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PACKAGE RATE PER PERSON', pageWidth - margin - 4, currentY + 6, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(0, 229, 192);
  doc.text(formatCurrency(pricePerPerson, quote.currency), pageWidth - margin - 4, currentY + 12.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(148, 163, 184);
  doc.text('All local taxes & fees included', pageWidth - margin - 4, currentY + 18, { align: 'right' });

  currentY += 27;

  // ----------------------------------------------------
  // 3. ROUTE HUBS BAR (If Route Hubs exist)
  // ----------------------------------------------------
  if (sortedHubs.length > 0) {
    checkPageBreak(12);
    doc.setFillColor(241, 245, 249); // slate-100
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(margin, currentY, contentWidth, 10, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(51, 65, 85);
    doc.text('ROUTE FLOW:', margin + 3, currentY + 6.5);

    let hubX = margin + 25;
    sortedHubs.forEach((hub, idx) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(hub.hubName, hubX, currentY + 6.5);
      const nameW = doc.getTextWidth(hub.hubName);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(0, 168, 143);
      const nightStr = ` (${hub.nights}N)`;
      doc.text(nightStr, hubX + nameW, currentY + 6.5);
      const nightW = doc.getTextWidth(nightStr);

      hubX += nameW + nightW;

      if (idx < sortedHubs.length - 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(148, 163, 184);
        doc.text(' -> ', hubX + 1, currentY + 6.5);
        hubX += 8;
      }
    });

    currentY += 13;
  }

  // ----------------------------------------------------
  // 4. CLIENT & SPECIALIST DOSSIER STRIP
  // ----------------------------------------------------
  checkPageBreak(22);
  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 18, 1.5, 1.5, 'FD');

  // Left: Client
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PREPARED FOR VALUED GUEST', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(quote.clientName || 'Private Client Group', margin + 4, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const clientInfo = [quote.clientEmail, quote.clientCompany, quote.clientPhone].filter(Boolean).join(' • ');
  doc.text(clientInfo || 'Direct Traveler Account', margin + 4, currentY + 15);

  // Right: Specialist
  const rightX = pageWidth / 2 + 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('PREPARED BY DESTINATION SPECIALIST', rightX, currentY + 5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(effectiveAgentName, rightX, currentY + 10);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(71, 85, 105);
  const agentInfo = [effectiveAgency, '24/7 Operations Support'].filter(Boolean).join(' • ');
  doc.text(agentInfo, rightX, currentY + 15);

  currentY += 22;

  // ----------------------------------------------------
  // 4.5. VISA & TRAVEL DOCUMENTATION SERVICES (IF PRESENT)
  // ----------------------------------------------------
  if (visaItems.length > 0) {
    checkPageBreak(18 + visaItems.length * 14);

    doc.setFillColor(6, 78, 59); // emerald-900
    doc.rect(margin, currentY, contentWidth, 7, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('VISA & ANCILLARY SERVICES', margin + 3, currentY + 5);
    doc.setTextColor(110, 231, 183); // emerald-300
    doc.text(`${visaItems.length} ${visaItems.length === 1 ? 'SERVICE' : 'SERVICES'} INCLUDED`, pageWidth - margin - 3, currentY + 5, { align: 'right' });

    currentY += 9;

    visaItems.forEach((vItem, vIdx) => {
      const isEven = vIdx % 2 === 0;
      const serviceBadgeText = vItem.service_type === 'TRAVEL_PROTECTION' || vItem.product.subcategory === 'Travel Insurance'
        ? 'INSURANCE'
        : vItem.service_type === 'CONNECTIVITY' || vItem.product.subcategory === 'eSIM Connectivity'
        ? '5G CONNECTIVITY'
        : vItem.service_type === 'VIP_GROUND' || vItem.product.subcategory === 'Ground VIP Services'
        ? 'VIP GROUND'
        : 'VISA SERVICE';
        
      const title = vItem.product.name || 'Visa Application Package';
      const subDetails = [
        `${(vItem.pax?.adults || 0) + (vItem.pax?.children || 0)} Applicant(s)`,
        vItem.product.sku || 'VSA-EXP',
        vItem.product.duration ? `Processing: ${vItem.product.duration}` : 'Official Consular Track'
      ].join(' • ');
      
      const priceText = formatCurrency(vItem.calculation?.finalTotalSellingPrice || 0, quote.currency);

      drawQuoteItemCard(vItem, title, serviceBadgeText, subDetails, priceText, isEven);
    });
  }

  // ----------------------------------------------------
  // 5. DAY-BY-DAY CHRONOLOGICAL ITINERARY FLOW (MAIN)
  // ----------------------------------------------------
  checkPageBreak(25);

  // Main Section Headline
  doc.setFillColor(15, 23, 42);
  doc.rect(margin, currentY, contentWidth, 7, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.text('DAY-BY-DAY ITINERARY & SCHEDULED EXPERIENCES', margin + 3, currentY + 5);
  doc.setTextColor(0, 229, 192);
  doc.text(`${itineraryDays.length} DAYS • ${items.length} ALLOCATED SERVICES`, pageWidth - margin - 3, currentY + 5, { align: 'right' });

  currentY += 10;

  // Iterate each Day
  itineraryDays.forEach((day) => {
    const hasItems = day.items && day.items.length > 0;
    const dayCity = day.hub?.hubName || quote.destination || 'Japan';

    // Calculate approximate height needed for this day block
    let estimatedDayHeight = 12; // header
    if (hasItems) {
      estimatedDayHeight += day.items.length * 15;
    } else {
      estimatedDayHeight += 11; // leisure card
    }

    checkPageBreak(Math.min(estimatedDayHeight, 40));

    // Day Header Bar
    doc.setFillColor(30, 41, 59); // slate-800
    doc.roundedRect(margin, currentY, contentWidth, 8, 1, 1, 'F');

    // Day Badge: [01]
    doc.setFillColor(0, 229, 192);
    doc.roundedRect(margin + 2, currentY + 1.5, 9, 5, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text(String(day.dayNumber).padStart(2, '0'), margin + 6.5, currentY + 5, { align: 'center' });

    // Day Date & Hub
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    const dayTitle = `Day ${day.dayNumber}: ${day.dayOfWeek}, ${day.formattedDate}`;
    doc.text(dayTitle, margin + 14, currentY + 5.5);

    const titleW = doc.getTextWidth(dayTitle);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 229, 192);
    const hubText = ` • ${dayCity} Base${day.isTransitionDay && day.prevHub ? ` (Transfer from ${day.prevHub.hubName})` : ''}${day.customTheme ? ` • ${day.customTheme}` : ''}`;
    doc.text(hubText, margin + 14 + titleW, currentY + 5.5);

    // Right Count
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(203, 213, 225);
    doc.text(hasItems ? `${day.items.length} ${day.items.length === 1 ? 'Service' : 'Services'}` : 'Leisure / Free Exploration', pageWidth - margin - 3, currentY + 5.5, { align: 'right' });

    currentY += 10;

    // Day Items
    if (hasItems) {
      day.items.forEach((item, itemIdx) => {
        const isEven = itemIdx % 2 === 0;
        const cat = (item.product.category || item.product.productType || 'EXPERIENCE').toUpperCase();
        const isRail = item.category === 'Rail' || Boolean(item.railJourneyDetails) || (item.product?.category === 'Rail');
        
        const badgeLabel = isRail ? 'SHINKANSEN' : cat;
        const title = isRail && item.railJourneyDetails
          ? `Shinkansen: ${item.railJourneyDetails.originStationName} to ${item.railJourneyDetails.destinationStationName}`
          : (item.customTitle || item.title || item.product.name || 'Curated Experience');
        
        const subDetails = isRail && item.railJourneyDetails
          ? [
              item.serviceTime ? `Dep: ${item.serviceTime}` : null,
              `${item.railJourneyDetails.carType} Class (${item.railJourneyDetails.seatType})`,
              item.railJourneyDetails.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi Super Express' : 'Hikari/Kodama',
              `Seat: ${item.railJourneyDetails.seatPreference || 'Reserved'}`,
              `${item.pax?.adults || 2} Adults${item.pax?.children ? `, ${item.pax.children} Ch` : ''}`
            ].filter(Boolean).join(' • ')
          : [
              item.serviceTime ? `Time: ${item.serviceTime}` : null,
              item.product.duration ? `Duration: ${item.product.duration}` : null,
              `${item.pax?.adults || 2} Adults${item.pax?.children ? `, ${item.pax.children} Ch` : ''}`,
              item.product.city || dayCity
            ].filter(Boolean).join(' • ');
            
        const priceText = formatCurrency(item.calculation?.finalTotalSellingPrice || 0, quote.currency);

        drawQuoteItemCard(item, title, badgeLabel, subDetails, priceText, isEven);
      });
    } else {
      // Leisure Box
      checkPageBreak(12);
      doc.setFillColor(250, 250, 250);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin + 2, currentY, contentWidth - 4, 10, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(71, 85, 105);
      doc.text(`* Day at Leisure in ${dayCity}`, margin + 6, currentY + 5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(148, 163, 184);
      doc.text('Free time for independent sightseeing, shopping, and dining. 24/7 on-ground concierge support active.', margin + 6, currentY + 8.5);

      currentY += 12;
    }

    currentY += 2;
  });

  // ----------------------------------------------------
  // 6. GENERAL INCLUSIONS (Items without specific travel date)
  // ----------------------------------------------------
  if (generalInclusionItems.length > 0) {
    checkPageBreak(20);
    doc.setFillColor(241, 245, 249);
    doc.rect(margin, currentY, contentWidth, 6, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text('ADDITIONAL PACKAGE INCLUSIONS & PRIVILEGES', margin + 3, currentY + 4.5);

    currentY += 8;

    generalInclusionItems.forEach((item) => {
      checkPageBreak(10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${item.product.name} (${item.product.category || 'Service'})`, margin + 4, currentY + 4);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7);
      doc.text(formatCurrency(item.calculation?.finalTotalSellingPrice || 0, quote.currency), pageWidth - margin - 4, currentY + 4, { align: 'right' });

      currentY += 6;
    });

    currentY += 3;
  }

  // ----------------------------------------------------
  // 7. DMC SERVICE STANDARDS & GUARANTEES
  // ----------------------------------------------------
  checkPageBreak(24);
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 20, 1.5, 1.5, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(15, 23, 42);
  doc.text('GROUND OPERATIONS SERVICE STANDARDS:', margin + 4, currentY + 5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  doc.text('• Chauffeur Fleet: Guaranteed pristine, commercially licensed air-conditioned vehicles with meet & assist.', margin + 4, currentY + 9.5);
  doc.text('• Licensed Guides: Certified English-speaking local experts with priority VIP access and admissions.', margin + 4, currentY + 13.5);
  doc.text('• 24/7 Dispatch Desk: Live flight monitoring, multilingual ground emergency assistance via WhatsApp / Phone.', margin + 4, currentY + 17.5);

  currentY += 24;

  // ----------------------------------------------------
  // 8. INVESTMENT TOTAL & FINANCIAL SUMMARY
  // ----------------------------------------------------
  checkPageBreak(30);
  const summaryBoxWidth = contentWidth;
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, currentY, summaryBoxWidth, 24, 2, 2, 'F');

  // Left Note
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(0, 229, 192);
  doc.text('OFFICIAL PROPOSAL TARIFF', margin + 5, currentY + 6);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Guaranteed Total Package Investment', margin + 5, currentY + 12);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  doc.text('Inclusive of all private transport, hotels, guides, activities & applicable local taxes.', margin + 5, currentY + 18);

  // Right Totals
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 229, 192);
  doc.text(formatCurrency(effectiveSellingPrice, quote.currency), pageWidth - margin - 5, currentY + 12, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(203, 213, 225);
  doc.text(`${formatCurrency(pricePerPerson, quote.currency)} / Traveler (${totalPax} Guests)`, pageWidth - margin - 5, currentY + 18, { align: 'right' });

  currentY += 28;

  // ----------------------------------------------------
  // 9. TERMS & CONDITIONS
  // ----------------------------------------------------
  checkPageBreak(20);
  doc.setFillColor(255, 255, 255);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 16, 1.5, 1.5, 'D');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text('COMMERCIAL QUOTATION TERMS:', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text('1. All allocations held provisionally for 14 calendar days from generation date.', margin + 4, currentY + 8);
  doc.text('2. 20% deposit confirms reservations; balance payable 14 days prior to departure.', margin + 4, currentY + 11.5);
  doc.text('3. Rates are guaranteed in ' + quote.currency + ' with no post-confirmation currency fluctuations.', margin + 4, currentY + 14.5);

  // ----------------------------------------------------
  // 10. EXACT PAGE NUMBERING (Applied across all pages)
  // ----------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.setTextColor(148, 163, 184); // slate-400

    // Footer line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 9, pageWidth - margin, pageHeight - 9);

    // Left Footer
    doc.text('Ground Operations Desk • Confidential Client Itinerary Quotation', margin, pageHeight - 5.5);

    // Right Footer
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5.5, { align: 'right' });
  }

  return doc;
}

export function downloadQuotationPDF(options: PDFExportOptions): void {
  const doc = generateQuotationPDF(options);
  const filename = `Itinerary-${options.quote.quoteNumber || 'Proposal'}.pdf`;
  doc.save(filename);

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
      templateVersion: '1.0.0-standard',
      sentAt: new Date().toISOString(),
      sentByName: options.agentName || options.quote.agentName,
      deliveryStatus: 'SUCCESS'
    });
  } catch (err) {
    console.error('Failed to log PDF communication audit:', err);
  }
}

