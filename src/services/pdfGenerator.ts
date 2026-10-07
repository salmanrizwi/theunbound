import { jsPDF } from 'jspdf';
import { Quotation, QuoteItem, TripRouteHub } from '../types';
import { formatCurrency } from './pricingEngine';
import { getInventoryDisplayName, getInventoryConfigurationSummary } from '../utils/inventoryDisplayHelpers';
import { isRailQuoteItem } from './rail/JapanRailJourneyDataService';
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

// Clean markdown / HTML formatting and special characters for PDF rendering
function cleanPdfText(str: string | undefined | null): string {
  if (!str) return '';
  return String(str)
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/\*\*|__/g, '') // Strip bold markdown
    .replace(/\*|_/g, '')    // Strip italic markdown
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function generateQuotationPDF(options: PDFExportOptions): jsPDF {
  const { quote, agentName, agentAgency, agentEmail, agentRole, agentLogoUrl, leadId } = options;

  const effectiveLeadId = leadId || quote.leadId;
  const effectiveAgency = agentAgency || quote.agentAgency;
  const effectiveAgentName = agentName || quote.agentName || 'Bespoke Travel Specialist';
  const effectiveAgentEmail = agentEmail || quote.agentEmail;

  // Initialize jsPDF document (A4 format, millimeters)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const pageHeight = doc.internal.pageSize.getHeight(); // 297mm
  const margin = 12; // 12mm margin gives 186mm printable width
  const contentWidth = pageWidth - margin * 2; // 186mm

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
           it.product?.productType === 'Visa Service' || 
           it.product?.productType === 'Travel Protection' ||
           it.product?.productType === '5G Connectivity' ||
           it.product?.subcategory === 'Visa Facilitation' || 
           it.product?.subcategory === 'Travel Insurance' ||
           it.product?.subcategory === 'Ground VIP Services' ||
           it.product?.subcategory === 'eSIM Connectivity' ||
           it.product?.sku?.startsWith('VSA-') ||
           it.product?.sku?.startsWith('VISA-') ||
           it.product?.sku?.startsWith('INS-') ||
           it.product?.sku?.startsWith('VIP-') ||
           it.product?.sku?.startsWith('ESIM-') ||
           (it.product?.category === 'Travel Services' && it.product?.name?.toLowerCase().includes('visa')) ||
           Boolean(it.product?.name?.toLowerCase().includes('visa') && it.product?.name?.toLowerCase().includes('entry'));
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
  const effectivePax = quote.totalPax || (quote.adultsCount || 2) + (quote.childrenCount || 0) + (quote.infantsCount || 0);
  const effectiveSellingPrice = quote.finalCustomerSellingPrice || (quote as any).final_customer_selling_price || quote.totalSellingPrice;
  const pricePerPerson = effectiveSellingPrice / Math.max(1, effectivePax);

  // Helper for page break check
  const checkPageBreak = (neededHeight: number): boolean => {
    if (currentY + neededHeight > pageHeight - 16) {
      doc.addPage();
      currentY = margin;
      drawSubsequentHeader();
      return true;
    }
    return false;
  };

  const drawSubsequentHeader = () => {
    doc.setFillColor(15, 23, 42); // slate-900
    doc.roundedRect(margin, currentY, contentWidth, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(0, 229, 192);
    doc.text('TRAVEL OPERATIONS • BESPOKE ITINERARY PROPOSAL', margin + 3.5, currentY + 4.7);
    doc.setTextColor(255, 255, 255);
    const refText = `REF: ${quote.quoteNumber || 'UBQ-2026'}${effectiveLeadId ? ` • LEAD: ${effectiveLeadId}` : ''}`;
    doc.text(refText, pageWidth - margin - 3.5, currentY + 4.7, { align: 'right' });
    currentY += 10.5;
  };

  // Helper for category styling & colors
  const getCategoryTheme = (category?: string, productType?: string) => {
    const cat = (category || productType || '').toLowerCase();
    if (cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan')) {
      return {
        label: 'LUXURY ACCOMMODATION',
        bg: [255, 251, 235],       // amber-50
        border: [253, 230, 138],   // amber-200
        text: [146, 64, 14],       // amber-800
        badgeBg: [254, 243, 199]   // amber-100
      };
    }
    if (cat.includes('rail') || cat.includes('train') || cat.includes('shinkansen')) {
      return {
        label: 'HIGH-SPEED SHINKANSEN',
        bg: [238, 242, 255],       // indigo-50
        border: [199, 210, 254],   // indigo-200
        text: [55, 48, 163],       // indigo-800
        badgeBg: [224, 231, 255]   // indigo-100
      };
    }
    if (cat.includes('transfer') || cat.includes('transport') || cat.includes('vehicle')) {
      return {
        label: 'PRIVATE GROUND TRANSFER',
        bg: [239, 246, 255],       // blue-50
        border: [219, 234, 254],   // blue-200
        text: [30, 64, 175],       // blue-800
        badgeBg: [219, 234, 254]   // blue-100
      };
    }
    if (cat.includes('dining') || cat.includes('food') || cat.includes('culinary') || cat.includes('meal')) {
      return {
        label: 'CURATED DINING EXPERIENCE',
        bg: [255, 241, 242],       // rose-50
        border: [254, 205, 211],   // rose-200
        text: [159, 18, 57],       // rose-800
        badgeBg: [255, 228, 230]   // rose-100
      };
    }
    if (cat.includes('visa') || cat.includes('insurance') || cat.includes('connectivity') || cat.includes('vip')) {
      return {
        label: 'VISA & ANCILLARY SERVICE',
        bg: [236, 253, 245],       // emerald-50
        border: [167, 243, 208],   // emerald-200
        text: [6, 95, 70],         // emerald-800
        badgeBg: [209, 250, 229]   // emerald-100
      };
    }
    return {
      label: 'GUIDED TOUR & SIGHTSEEING',
      bg: [240, 253, 250],       // teal-50
      border: [204, 251, 241],   // teal-200
      text: [17, 94, 89],         // teal-800
      badgeBg: [204, 251, 241]   // teal-100
    };
  };

  // Helper to draw a rich product card
  const drawQuoteItemCard = (
    item: QuoteItem,
    customBadge?: string,
    _isEven: boolean = false
  ) => {
    const isRail = isRailQuoteItem(item) || (item.category === 'Rail') || Boolean(item.railJourneyDetails);
    const theme = getCategoryTheme(item.product?.category, item.product?.productType);
    const badgeLabel = customBadge || (isRail ? 'HIGH-SPEED SHINKANSEN' : theme.label);
    const title = getInventoryDisplayName(item);
    const configSummary = cleanPdfText(getInventoryConfigurationSummary(item));

    const overviewRaw = item.contentSnapshot?.overviewSpecifications || 
                        item.product?.longDescription || 
                        item.product?.description || 
                        item.product?.shortDescription || '';
    const overview = cleanPdfText(overviewRaw);

    const rawInclusions = item.contentSnapshot?.inclusions || item.product?.inclusions || [];
    const inclusions = Array.isArray(rawInclusions) ? rawInclusions.map(inc => cleanPdfText(String(inc))).filter(Boolean) : [];

    const rawExclusions = item.contentSnapshot?.exclusions || item.product?.exclusions || [];
    const exclusions = Array.isArray(rawExclusions) ? rawExclusions.map(exc => cleanPdfText(String(exc))).filter(Boolean) : [];

    const notes = cleanPdfText(item.notes || '');

    // Card dimensions calculation
    const cardInnerWidth = contentWidth - 10;
    const titleWidth = contentWidth - 52; // Leave room for right price block

    // Typography wrapping calculations
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    const wrappedTitleLines = doc.splitTextToSize(title, titleWidth);
    const titleBlockHeight = wrappedTitleLines.length * 3.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const wrappedConfigLines = configSummary && !isRail ? doc.splitTextToSize(configSummary, cardInnerWidth) : [];
    const configHeight = wrappedConfigLines.length > 0 ? (wrappedConfigLines.length * 3.2 + 2) : 0;

    // Shinkansen specific block height
    const railBlockHeight = (isRail && item.railJourneyDetails) ? 12 : 0;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    const wrappedOverviewLines = overview ? doc.splitTextToSize(overview, cardInnerWidth) : [];
    const overviewHeight = wrappedOverviewLines.length > 0 ? (wrappedOverviewLines.length * 3.2 + 5) : 0;

    const inclusionLines: string[][] = inclusions.map(inc => doc.splitTextToSize(`•  ${inc}`, cardInnerWidth - 4));
    const totalInclusionLines = inclusionLines.reduce((sum, lines) => sum + lines.length, 0);
    const inclusionsHeight = totalInclusionLines > 0 ? (totalInclusionLines * 3.0 + 4) : 0;

    const exclusionLines: string[][] = exclusions.map(exc => doc.splitTextToSize(`•  ${exc}`, cardInnerWidth - 4));
    const totalExclusionLines = exclusionLines.reduce((sum, lines) => sum + lines.length, 0);
    const exclusionsHeight = totalExclusionLines > 0 ? (totalExclusionLines * 3.0 + 4) : 0;

    const wrappedNotesLines = notes ? doc.splitTextToSize(`Special Note: ${notes}`, cardInnerWidth - 4) : [];
    const notesHeight = wrappedNotesLines.length > 0 ? (wrappedNotesLines.length * 3.0 + 4) : 0;

    // Total Card Height
    const totalCardHeight = 9 + titleBlockHeight + configHeight + railBlockHeight + overviewHeight + inclusionsHeight + exclusionsHeight + notesHeight + 4;

    // Perform break check
    checkPageBreak(Math.min(totalCardHeight, 35));

    const cardStartY = currentY;

    // Background container with subtle border
    doc.setFillColor(theme.bg[0], theme.bg[1], theme.bg[2]);
    doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2]);
    doc.setLineWidth(0.25);
    doc.roundedRect(margin, cardStartY, contentWidth, totalCardHeight, 2, 2, 'FD');

    let cardY = cardStartY + 5;

    // 1. Top Badges (Category badge, Duration, Service Time) & Price Header
    const badgeW = Math.min(65, doc.getTextWidth(badgeLabel) + 6);
    doc.setFillColor(theme.badgeBg[0], theme.badgeBg[1], theme.badgeBg[2]);
    doc.roundedRect(margin + 4, cardY - 2.5, badgeW, 4.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(theme.text[0], theme.text[1], theme.text[2]);
    doc.text(badgeLabel.toUpperCase(), margin + 4 + badgeW / 2, cardY + 0.6, { align: 'center' });

    let pillOffset = margin + 4 + badgeW + 2;

    if (item.product?.duration) {
      const durText = cleanPdfText(item.product.duration);
      const durW = doc.getTextWidth(durText) + 5;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2]);
      doc.roundedRect(pillOffset, cardY - 2.5, durW, 4.5, 0.8, 0.8, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(durText, pillOffset + durW / 2, cardY + 0.6, { align: 'center' });
      pillOffset += durW + 2;
    }

    if (item.serviceTime) {
      const timeText = cleanPdfText(item.serviceTime);
      const timeW = doc.getTextWidth(timeText) + 5;
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(theme.border[0], theme.border[1], theme.border[2]);
      doc.roundedRect(pillOffset, cardY - 2.5, timeW, 4.5, 0.8, 0.8, 'FD');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(51, 65, 85);
      doc.text(timeText, pillOffset + timeW / 2, cardY + 0.6, { align: 'center' });
    }

    // Right-aligned Price
    const itemPrice = item.calculation?.finalTotalSellingPrice || item.calculation?.totalSellingPrice || 0;
    const priceFormatted = formatCurrency(itemPrice, quote.currency);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(15, 23, 42);
    doc.text(priceFormatted, pageWidth - margin - 4, cardY + 0.5, { align: 'right' });

    cardY += 4.5;

    // 2. Title & Confirmed Allotment Subline
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(15, 23, 42);
    wrappedTitleLines.forEach(line => {
      doc.text(line, margin + 4, cardY + 0.5);
      cardY += 3.8;
    });

    // Subline Right: Confirmed Allotment badge
    const paxText = `${item.pax?.adults || 2} Adults${item.pax?.children ? `, ${item.pax.children} Ch` : ''}`;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(100, 116, 139);
    doc.text(paxText, pageWidth - margin - 4, cardY - 2.5, { align: 'right' });

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(5.5);
    doc.setTextColor(5, 150, 105);
    doc.text('Confirmed Allotment', pageWidth - margin - 4, cardY + 0.5, { align: 'right' });

    // Configuration Summary line
    if (configSummary && !isRail) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(71, 85, 105);
      wrappedConfigLines.forEach(line => {
        doc.text(line, margin + 4, cardY);
        cardY += 3.2;
      });
      cardY += 1;
    }

    // 3. Shinkansen Specific Details Box
    if (isRail && item.railJourneyDetails) {
      const details = item.railJourneyDetails;
      const origin = `${details.originStationName || 'Origin'} (${details.originStationCode || 'TYO'})`;
      const dest = `${details.destinationStationName || 'Destination'} (${details.destinationStationCode || 'KYO'})`;
      const trainService = details.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi Super Express' : 'Hikari/Kodama Express';
      const carInfo = `${details.carType || 'Ordinary'} Car (${details.seatType || 'Reserved Seat'})`;
      const pnrInfo = details.pnrReference ? `SmartEX PNR: ${details.pnrReference}` : null;
      const seatPref = details.seatPreference ? `Seat: ${details.seatPreference}` : null;

      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(199, 210, 254);
      doc.roundedRect(margin + 4, cardY - 1, contentWidth - 8, 9.5, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6.5);
      doc.setTextColor(49, 46, 129);
      doc.text(`Bullet Train: ${origin} -> ${dest}  •  ${carInfo}  •  ${trainService}`, margin + 6, cardY + 2.5);

      const subRailParts = [pnrInfo, seatPref].filter(Boolean).join('   •   ');
      if (subRailParts) {
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6);
        doc.setTextColor(67, 56, 202);
        doc.text(subRailParts, margin + 6, cardY + 6.5);
      }

      cardY += 11;
    }

    // 4. Overview & Specifications
    if (wrappedOverviewLines.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(148, 163, 184);
      doc.text('OVERVIEW & SPECIFICATIONS', margin + 4, cardY);
      cardY += 2.8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      wrappedOverviewLines.forEach(line => {
        doc.text(line, margin + 4, cardY);
        cardY += 3.2;
      });
      cardY += 1;
    }

    // 5. Inclusions
    if (inclusions.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(5, 150, 105); // emerald-600
      doc.text('INCLUSIONS', margin + 4, cardY);
      cardY += 2.8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      inclusionLines.forEach(lines => {
        lines.forEach(line => {
          doc.text(line, margin + 4, cardY);
          cardY += 3.0;
        });
      });
      cardY += 1;
    }

    // 6. Exclusions
    if (exclusions.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(5.5);
      doc.setTextColor(225, 29, 72); // rose-600
      doc.text('EXCLUSIONS', margin + 4, cardY);
      cardY += 2.8;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(51, 65, 85);
      exclusionLines.forEach(lines => {
        lines.forEach(line => {
          doc.text(line, margin + 4, cardY);
          cardY += 3.0;
        });
      });
      cardY += 1;
    }

    // 7. Special Notes
    if (wrappedNotesLines.length > 0) {
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin + 4, cardY - 1, contentWidth - 8, notesHeight - 1, 0.8, 0.8, 'FD');

      doc.setFont('helvetica', 'italic');
      doc.setFontSize(6);
      doc.setTextColor(71, 85, 105);
      wrappedNotesLines.forEach(line => {
        doc.text(line, margin + 6, cardY + 2);
        cardY += 3.0;
      });
      cardY += 2;
    }

    currentY = cardStartY + totalCardHeight + 3;
  };

  // ----------------------------------------------------
  // 1. TOP HEADER & BRAND IDENTITY
  // ----------------------------------------------------
  const brandTitle = effectiveAgency ? effectiveAgency : 'theunbound';
  
  // Brand Header Container
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, currentY, contentWidth, 20, 'F');

  // Brand Name & Subtitle
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(2, 6, 23); // slate-950
  doc.text(brandTitle, margin, currentY + 6);

  // Official Proposal Badge
  const brandTitleWidth = doc.getTextWidth(brandTitle);
  doc.setFillColor(2, 6, 23); // slate-950
  doc.roundedRect(margin + brandTitleWidth + 3, currentY + 1.5, 34, 5, 0.8, 0.8, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(0, 229, 192); // Teal
  doc.text('OFFICIAL ITINERARY PROPOSAL', margin + brandTitleWidth + 20, currentY + 4.8, { align: 'center' });

  // Subtitle
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  const brandSubtitle = effectiveAgency 
    ? 'Authorized Travel Partner • In Association with TheUnbound Wholesale DMC Network'
    : 'Destination Management Operations • Direct Ground Logistics & Wholesale Tour Hub';
  doc.text(brandSubtitle, margin, currentY + 11);

  // Right Side Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(2, 6, 23);
  doc.text(quote.quoteNumber || 'UBQ-2026', pageWidth - margin, currentY + 5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`Date: ${quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'Active'}`, pageWidth - margin, currentY + 9, { align: 'right' });
  doc.text(`Valid Until: ${quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '14 Days'}`, pageWidth - margin, currentY + 12.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(0, 168, 143);
  doc.text(`Status: ${quote.status || 'DRAFT'}`, pageWidth - margin, currentY + 16, { align: 'right' });

  // Top divider line
  doc.setDrawColor(2, 6, 23);
  doc.setLineWidth(0.6);
  doc.line(margin, currentY + 18, pageWidth - margin, currentY + 18);
  doc.setLineWidth(0.2); // reset line width

  currentY += 22;

  // ----------------------------------------------------
  // 2. CURATED JOURNEY OVERVIEW HERO BANNER
  // ----------------------------------------------------
  const hasRouteHubs = sortedHubs.length > 0;
  const heroHeight = hasRouteHubs ? 36 : 24;

  doc.setFillColor(15, 23, 42); // slate-900 / slate-950
  doc.roundedRect(margin, currentY, contentWidth, heroHeight, 3, 3, 'F');

  // Left: Overview titles
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(0, 229, 192); // Teal
  doc.text('CURATED JOURNEY OVERVIEW', margin + 5, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11.5);
  doc.setTextColor(255, 255, 255);
  doc.text(`${quote.destination || 'Japan'} Bespoke Travel Itinerary`, margin + 5, currentY + 11);

  // Guest & Date stats
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);

  const paxDetails = quote.passengerBreakdown 
    ? `ADT: ${quote.passengerBreakdown.adults}${quote.passengerBreakdown.cwb > 0 ? ` | CWB: ${quote.passengerBreakdown.cwb}` : ''}${quote.passengerBreakdown.cnb > 0 ? ` | CNB: ${quote.passengerBreakdown.cnb}` : ''}${quote.passengerBreakdown.infants > 0 ? ` | INF: ${quote.passengerBreakdown.infants}` : ''}`
    : `${effectivePax} Guests (${quote.adultsCount || 2} Adults${quote.childrenCount ? `, ${quote.childrenCount} Children` : ''})`;

  const dateSpan = (quote.travelStartDate && quote.travelEndDate) ? ` • ${quote.travelStartDate} -> ${quote.travelEndDate}` : '';
  const styleText = quote.travelStyle ? ` • Style: ${quote.travelStyle}` : '';
  const nationText = quote.nationality ? ` • Nationality: ${quote.nationality}` : '';

  doc.text(`${itineraryDays.length} Days / ${totalNights} Nights • ${paxDetails}${nationText}${styleText}${dateSpan}`, margin + 5, currentY + 16.5);

  // Right: Price per person block
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PACKAGE RATE PER PERSON', pageWidth - margin - 5, currentY + 5.5, { align: 'right' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(0, 229, 192);
  doc.text(formatCurrency(pricePerPerson, quote.currency), pageWidth - margin - 5, currentY + 11.5, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Inclusive of all ground taxes', pageWidth - margin - 5, currentY + 16.5, { align: 'right' });

  // Route Hubs Timeline inside Hero Container
  if (hasRouteHubs) {
    doc.setDrawColor(51, 65, 85);
    doc.line(margin + 5, currentY + 20, pageWidth - margin - 5, currentY + 20);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(0, 229, 192);
    doc.text('Route & Destination Hubs:', margin + 5, currentY + 25);

    let hubX = margin + 35;
    sortedHubs.forEach((hub, idx) => {
      const hubLabel = `${hub.hubName} (${hub.nights} ${hub.nights === 1 ? 'Night' : 'Nights'})`;
      const hubW = doc.getTextWidth(hubLabel) + 6;

      doc.setFillColor(30, 41, 59); // slate-800
      doc.setDrawColor(51, 65, 85);
      doc.roundedRect(hubX, currentY + 22, hubW, 5, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(6);
      doc.setTextColor(255, 255, 255);
      doc.text(hub.hubName, hubX + 3, currentY + 25.5);

      const nameW = doc.getTextWidth(hub.hubName);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 229, 192);
      doc.text(` (${hub.nights}N)`, hubX + 3 + nameW, currentY + 25.5);

      hubX += hubW + 2;

      if (idx < sortedHubs.length - 1) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(6.5);
        doc.setTextColor(100, 116, 139);
        doc.text('->', hubX, currentY + 25.5);
        hubX += 5;
      }
    });
  }

  currentY += heroHeight + 4;

  // ----------------------------------------------------
  // 3. CLIENT & CONSULTANT PROFILE DOSSIER
  // ----------------------------------------------------
  checkPageBreak(22);

  doc.setFillColor(248, 250, 252); // slate-50
  doc.setDrawColor(226, 232, 240); // slate-200
  doc.roundedRect(margin, currentY, contentWidth, 18, 2, 2, 'FD');

  // Left: Valued Guest
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('VALUED GUEST / CLIENT', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(quote.clientName || 'Private Traveler', margin + 4, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const clientLine = [quote.clientCompany, quote.clientEmail, quote.clientPhone].filter(Boolean).join(' • ');
  doc.text(clientLine || 'Direct Traveler Account', margin + 4, currentY + 14);

  // Right: Prepared by Specialist
  const specialistStartX = pageWidth / 2 + 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text('PREPARED BY DESTINATION SPECIALIST', specialistStartX, currentY + 4.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.text(effectiveAgentName, specialistStartX, currentY + 9);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(71, 85, 105);
  const agentLine = [effectiveAgency || 'TheUnbound DMC Ground Network', effectiveAgentEmail].filter(Boolean).join(' • ');
  doc.text(agentLine, specialistStartX, currentY + 13);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(5.5);
  doc.setTextColor(13, 148, 136); // teal-600
  doc.text('24/7 On-Ground Concierge & Multilingual Dispatch', specialistStartX, currentY + 16.5);

  currentY += 22;

  // ----------------------------------------------------
  // 3.5. VISA & ANCILLARY SERVICES (IF PRESENT)
  // ----------------------------------------------------
  if (visaItems.length > 0) {
    checkPageBreak(18 + visaItems.length * 20);

    // Section Headline
    doc.setFillColor(6, 78, 59); // emerald-900
    doc.roundedRect(margin, currentY, contentWidth, 7, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    doc.text('VISA & ANCILLARY SERVICES', margin + 4, currentY + 4.8);
    doc.setTextColor(110, 231, 183); // emerald-300
    doc.text(`${visaItems.length} ${visaItems.length === 1 ? 'SERVICE' : 'SERVICES'} INCLUDED`, pageWidth - margin - 4, currentY + 4.8, { align: 'right' });

    currentY += 10;

    visaItems.forEach((vItem, vIdx) => {
      const isEven = vIdx % 2 === 0;
      const serviceBadgeText = vItem.service_type === 'TRAVEL_PROTECTION' || vItem.product?.subcategory === 'Travel Insurance'
        ? 'TRAVEL INSURANCE'
        : vItem.service_type === 'CONNECTIVITY' || vItem.product?.subcategory === 'eSIM Connectivity'
        ? '5G CONNECTIVITY'
        : vItem.service_type === 'VIP_GROUND' || vItem.product?.subcategory === 'Ground VIP Services'
        ? 'VIP GROUND SERVICE'
        : 'VISA FACILITATION';

      drawQuoteItemCard(vItem, serviceBadgeText, isEven);
    });
  }

  // ----------------------------------------------------
  // 4. DAY-BY-DAY CHRONOLOGICAL ITINERARY FLOW
  // ----------------------------------------------------
  checkPageBreak(25);

  // Main Section Headline
  doc.setFillColor(15, 23, 42); // slate-900
  doc.roundedRect(margin, currentY, contentWidth, 7, 1, 1, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(255, 255, 255);
  doc.text('DAY-BY-DAY ITINERARY & SCHEDULED SERVICES', margin + 4, currentY + 4.8);
  doc.setTextColor(0, 229, 192); // Teal
  doc.text(`${itineraryDays.length} DAYS • ${items.length} TOTAL SERVICES`, pageWidth - margin - 4, currentY + 4.8, { align: 'right' });

  currentY += 10;

  // Iterate each day
  itineraryDays.forEach((day) => {
    const hasItems = day.items && day.items.length > 0;
    const dayCity = day.hub?.hubName || quote.destination || 'Japan';

    // Calculate estimated day height
    const estimatedHeight = hasItems ? 15 + day.items.length * 25 : 22;
    checkPageBreak(Math.min(estimatedHeight, 35));

    // Day Header Banner (slate-900)
    doc.setFillColor(15, 23, 42);
    doc.roundedRect(margin, currentY, contentWidth, 8, 1.5, 1.5, 'F');

    // Day Number Badge (Teal)
    doc.setFillColor(0, 229, 192);
    doc.roundedRect(margin + 2, currentY + 1.5, 8, 5, 0.8, 0.8, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6.5);
    doc.setTextColor(15, 23, 42);
    doc.text(String(day.dayNumber).padStart(2, '0'), margin + 6, currentY + 5, { align: 'center' });

    // Day Date & Hub
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(255, 255, 255);
    const dayTitle = `Day ${day.dayNumber}: ${day.dayOfWeek}, ${day.formattedDate}`;
    doc.text(dayTitle, margin + 12, currentY + 5.5);

    const titleW = doc.getTextWidth(dayTitle);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(0, 229, 192);
    const hubText = `  •  ${dayCity} Base${day.isTransitionDay && day.prevHub ? ` (Transfer: ${day.prevHub.hubName} -> ${dayCity})` : ''}${day.customTheme ? `  •  ${day.customTheme}` : ''}`;
    doc.text(hubText, margin + 12 + titleW, currentY + 5.5);

    // Right Count
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(203, 213, 225);
    doc.text(hasItems ? `${day.items.length} ${day.items.length === 1 ? 'Service' : 'Services'}` : 'Leisure / Free Exploration', pageWidth - margin - 4, currentY + 5.5, { align: 'right' });

    currentY += 10;

    // Day Items
    if (hasItems) {
      day.items.forEach((item, itemIdx) => {
        const isEven = itemIdx % 2 === 0;
        drawQuoteItemCard(item, undefined, isEven);
      });
    } else {
      // Day at Leisure Box
      checkPageBreak(14);
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, 11, 1.5, 1.5, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(51, 65, 85);
      doc.text(`• Day at Leisure in ${dayCity}`, margin + 5, currentY + 4.5);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text('Free time for personal exploration, neighborhood shopping, and culinary discoveries. 24/7 concierge assistance available.', margin + 5, currentY + 8.5);

      currentY += 14;
    }

    currentY += 1.5;
  });

  // ----------------------------------------------------
  // 5. ADDITIONAL PACKAGE SERVICES & PRIVILEGES (GENERAL INCLUSIONS)
  // ----------------------------------------------------
  if (generalInclusionItems.length > 0) {
    checkPageBreak(22 + generalInclusionItems.length * 10);

    doc.setFillColor(241, 245, 249);
    doc.roundedRect(margin, currentY, contentWidth, 6.5, 1, 1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(15, 23, 42);
    doc.text('ADDITIONAL PACKAGE SERVICES & PRIVILEGES', margin + 3.5, currentY + 4.5);

    currentY += 8.5;

    generalInclusionItems.forEach((item) => {
      checkPageBreak(9);
      doc.setFillColor(255, 255, 255);
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(margin, currentY, contentWidth, 7.5, 1, 1, 'FD');

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(`• ${getInventoryDisplayName(item)}`, margin + 4, currentY + 5);

      const subline = getInventoryConfigurationSummary(item) || `${item.product?.category || 'Service'} • ${item.product?.city || quote.destination}`;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6);
      doc.setTextColor(100, 116, 139);
      doc.text(subline, margin + 40, currentY + 5);

      const priceStr = formatCurrency(item.calculation?.finalTotalSellingPrice || 0, quote.currency);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(15, 23, 42);
      doc.text(priceStr, pageWidth - margin - 4, currentY + 5, { align: 'right' });

      currentY += 9;
    });

    currentY += 2;
  }

  // ----------------------------------------------------
  // 6. THEUNBOUND GROUND OPERATIONS STANDARDS (4 CARDS)
  // ----------------------------------------------------
  checkPageBreak(28);

  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, currentY, contentWidth, 24, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(15, 23, 42);
  doc.text('THEUNBOUND GROUND OPERATIONS STANDARDS & INCLUSIONS', margin + 4, currentY + 5);

  const cardW = (contentWidth - 14) / 4;
  const guarantees = [
    { title: 'Private Chauffeur Fleet', desc: 'Pristine air-conditioned vehicles with commercial licensed drivers and door-to-door luggage handling.' },
    { title: 'Licensed Local Guides', desc: 'Government-certified bilingual specialists delivering insightful cultural and historical immersion.' },
    { title: 'Confirmed Allocations', desc: 'Direct supplier contracted allotments with daily breakfast and verified luxury standards.' },
    { title: '24/7 Operations Desk', desc: 'Live flight tracking, real-time dispatch monitoring, and 24/7 emergency WhatsApp concierge support.' }
  ];

  guarantees.forEach((g, idx) => {
    const cardX = margin + 3.5 + idx * (cardW + 2.5);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(cardX, currentY + 7.5, cardW, 14, 1, 1, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(6);
    doc.setTextColor(15, 23, 42);
    doc.text(g.title, cardX + 2, currentY + 11);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5);
    doc.setTextColor(100, 116, 139);
    const wrappedDesc = doc.splitTextToSize(g.desc, cardW - 4);
    let descY = currentY + 14;
    wrappedDesc.forEach(line => {
      doc.text(line, cardX + 2, descY);
      descY += 2.5;
    });
  });

  currentY += 27;

  // ----------------------------------------------------
  // 7. TRANSPARENT INVESTMENT TOTAL & FINANCIAL SUMMARY
  // ----------------------------------------------------
  checkPageBreak(28);

  doc.setFillColor(2, 6, 23); // slate-950
  doc.roundedRect(margin, currentY, contentWidth, 22, 3, 3, 'F');

  // Left side: Official Tariff & Value
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(0, 229, 192); // Teal
  doc.text('OFFICIAL PROPOSAL TARIFF', margin + 5, currentY + 5.5);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(255, 255, 255);
  doc.text('Guaranteed Total Itinerary Value', margin + 5, currentY + 11);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.setTextColor(203, 213, 225);
  doc.text('All private transportation, accommodations, guided experiences, entrance tickets, and applicable government taxes are fully included.', margin + 5, currentY + 16.5);

  // Right side: Total figures
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(0, 229, 192);
  doc.text(formatCurrency(effectiveSellingPrice, quote.currency), pageWidth - margin - 5, currentY + 10, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(203, 213, 225);
  doc.text(`${formatCurrency(pricePerPerson, quote.currency)} / Traveler (${effectivePax} Guests)`, pageWidth - margin - 5, currentY + 15, { align: 'right' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(148, 163, 184);
  doc.text(`Guaranteed in ${quote.currency} • No Hidden Surcharges`, pageWidth - margin - 5, currentY + 18.5, { align: 'right' });

  currentY += 25;

  // ----------------------------------------------------
  // 8. OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY
  // ----------------------------------------------------
  checkPageBreak(25);

  doc.setFillColor(255, 251, 235); // amber-50
  doc.setDrawColor(253, 230, 138); // amber-200
  doc.roundedRect(margin, currentY, contentWidth, 20, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6.5);
  doc.setTextColor(120, 53, 15); // amber-900
  doc.text('OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY', margin + 4, currentY + 4.5);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(146, 64, 14); // amber-800
  const policyPoints = [
    '• Infant below 2 years is considered free of charge unless specifically charged by ground supplier or airline.',
    '• Children aged 2 to below 5 years are classified as CNB (Child No Bed). Hotel breakfast & service surcharges apply as per tariff.',
    '• Children aged 5 to below 11 years are classified as CWB (Child With Bed). Extra bed is included in the room allotment.',
    '• Guests aged 11 years and above are classified as Adults.',
    '• Important: If a guest is required to purchase an attraction ticket directly due to age, height, or attraction-specific eligibility rules, the ticket cost will be borne directly by the guest at the gate.'
  ];

  let policyY = currentY + 8;
  policyPoints.forEach(pt => {
    doc.text(pt, margin + 4, policyY);
    policyY += 2.5;
  });

  currentY += 23;

  // ----------------------------------------------------
  // 9. TERMS, CONDITIONS & SIGNATURE FOOTER
  // ----------------------------------------------------
  checkPageBreak(18);

  doc.setDrawColor(226, 232, 240);
  doc.line(margin, currentY, pageWidth - margin, currentY);

  currentY += 3.5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(6);
  doc.setTextColor(51, 65, 85);
  doc.text('Commercial Quotation Terms:', margin, currentY + 1);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);
  doc.setTextColor(100, 116, 139);
  const termsText = quote.termsAndConditions || 'This quotation is issued by TheUnbound Wholesale DMC Network. Rates are valid for 14 calendar days from generation date. All reservations subject to live inventory confirmation upon deposit.';
  const wrappedTerms = doc.splitTextToSize(termsText, contentWidth);
  let termsY = currentY + 4.5;
  wrappedTerms.forEach(line => {
    doc.text(line, margin, termsY);
    termsY += 2.6;
  });

  // ----------------------------------------------------
  // 10. RUNNING FOOTER & PAGE NUMBERING ACROSS ALL PAGES
  // ----------------------------------------------------
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184); // slate-400

    // Footer line
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, pageHeight - 8.5, pageWidth - margin, pageHeight - 8.5);

    // Left Footer
    doc.text('TheUnbound DMC Global Ground Logistics • sales@theunbound.in • Official Contracted Quotation Document', margin, pageHeight - 5);

    // Right Footer
    doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin, pageHeight - 5, { align: 'right' });
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
