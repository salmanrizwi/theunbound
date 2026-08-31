import React, { useMemo } from 'react';
import { Quotation, QuoteItem, TripRouteHub } from '../types';
import { formatCurrency } from '../services/pricingEngine';
import { 
  MapPin, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle2, 
  FileText, 
  ShieldCheck, 
  Printer, 
  Download, 
  Mail, 
  Phone,
  Compass,
  ArrowRight,
  Send,
  Car,
  Building2,
  Sparkles,
  Utensils,
  Share2,
  Info,
  Check,
  PlaneTakeoff,
  Award,
  Globe
} from 'lucide-react';

interface ProposalDocumentViewProps {
  quote: Quotation;
  agentUser?: any;
  onClose?: () => void;
  onBookNow?: (quote: Quotation) => void;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  onShareLink?: () => void;
}

export const ProposalDocumentView: React.FC<ProposalDocumentViewProps> = ({
  quote,
  agentUser,
  onClose,
  onBookNow,
  onPrint,
  onDownloadPdf,
  onShareLink
}) => {
  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  // ----------------------------------------------------
  // DAY-WISE CHRONOLOGICAL ITINERARY COMPUTATION
  // ----------------------------------------------------
  const itineraryDays = useMemo(() => {
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

    // Map each day to active hub, transition status, and matched items
    return calDays.map((calDay) => {
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

      // Filter items for this day
      const dayItems = items.filter(it => it.travelDate === calDay.dateString);
      
      // Look up custom theme for this day (from quote.dayThemes or auto-generated)
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
  }, [quote]);

  // Unscheduled or General Inclusions (items not matching any day's date)
  const generalInclusionItems = useMemo(() => {
    const dayDates = new Set(itineraryDays.map(d => d.dateString));
    return (quote.items || []).filter(it => !it.travelDate || !dayDates.has(it.travelDate));
  }, [quote.items, itineraryDays]);

  const totalNights = useMemo(() => {
    if (quote.routeHubs && quote.routeHubs.length > 0) {
      return quote.routeHubs.reduce((sum, h) => sum + (h.nights || 0), 0);
    }
    return Math.max(1, itineraryDays.length - 1);
  }, [quote.routeHubs, itineraryDays]);

  const effectivePax = quote.totalPax || (quote.adultsCount || 2) + (quote.childrenCount || 0);

  // Helper for category styling & icons
  const getCategoryMeta = (category?: string, productType?: string) => {
    const cat = (category || productType || '').toLowerCase();
    if (cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan')) {
      return {
        icon: Building2,
        label: 'Luxury Accommodation',
        color: 'bg-amber-50 text-amber-800 border-amber-200',
        badgeColor: 'bg-amber-100 text-amber-900'
      };
    }
    if (cat.includes('transfer') || cat.includes('transport') || cat.includes('vehicle') || cat.includes('rail') || cat.includes('train')) {
      return {
        icon: Car,
        label: 'Private Ground Transfer',
        color: 'bg-blue-50 text-blue-800 border-blue-200',
        badgeColor: 'bg-blue-100 text-blue-900'
      };
    }
    if (cat.includes('dining') || cat.includes('food') || cat.includes('culinary') || cat.includes('meal')) {
      return {
        icon: Utensils,
        label: 'Curated Dining Experience',
        color: 'bg-rose-50 text-rose-800 border-rose-200',
        badgeColor: 'bg-rose-100 text-rose-900'
      };
    }
    return {
      icon: Sparkles,
      label: 'Guided Tour & Sightseeing',
      color: 'bg-teal-50 text-teal-800 border-teal-200',
      badgeColor: 'bg-teal-100 text-teal-900'
    };
  };

  return (
    <div className="bg-white text-slate-900 font-sans p-6 sm:p-10 space-y-8 rounded-3xl border border-slate-200 print:border-none print:p-0 print:shadow-none shadow-2xl max-w-5xl mx-auto">
      
      {/* ---------------------------------------------------- */}
      {/* TOP ACTION BAR (Hidden during Print / PDF generation) */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-5 print:hidden">
        <div className="flex items-center space-x-2.5">
          <span className="text-xs font-mono font-bold px-3 py-1.5 rounded-lg bg-slate-950 text-[#00E5C0] shadow-xs">
            {quote.quoteNumber} (v{quote.version || 1})
          </span>
          <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
            {quote.status}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {onShareLink && (
            <button
              onClick={onShareLink}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
              title="Copy link to clipboard"
            >
              <Share2 className="w-3.5 h-3.5 text-slate-500" />
              <span>Share</span>
            </button>
          )}

          {onDownloadPdf ? (
            <button
              onClick={onDownloadPdf}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>Download PDF</span>
            </button>
          ) : (
            <button
              onClick={handlePrint}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Print / PDF</span>
            </button>
          )}
          
          {onBookNow && quote.status !== 'BOOKING_REQUESTED' && quote.status !== 'CONFIRMED' && (
            <button
              onClick={() => onBookNow(quote)}
              className="flex items-center space-x-1.5 px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors cursor-pointer shadow-sm"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Accept & Request Booking</span>
            </button>
          )}

          {onClose && (
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-bold text-slate-700 transition-colors cursor-pointer"
            >
              Close
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 1. DOCUMENT HEADER & BRAND IDENTITY */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-950 pb-6 gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <span className="text-3xl font-black lowercase tracking-tight font-sans text-slate-950">
              {quote.agentAgency ? quote.agentAgency : 'theunbound'}
            </span>
            <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-slate-950 text-[#00E5C0]">
              Official Itinerary Proposal
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1.5">
            {quote.agentAgency 
              ? `Authorized Travel Partner • In Association with TheUnbound Wholesale DMC Network`
              : `Destination Management Operations • Direct Ground Logistics & Wholesale Tour Hub`}
          </p>
        </div>

        <div className="text-left sm:text-right space-y-0.5 font-mono text-xs">
          <div className="text-base font-black text-slate-950">{quote.quoteNumber}</div>
          <div className="text-slate-500">Date: {quote.createdAt ? new Date(quote.createdAt).toLocaleDateString() : 'Active'}</div>
          <div className="text-slate-500">Valid Until: {quote.validUntil ? new Date(quote.validUntil).toLocaleDateString() : '14 Days'}</div>
          <div className="text-teal-700 font-bold">Status: {quote.status}</div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. TRIP HEADLINE & ROUTE FLOW SUMMARY BAR */}
      {/* ---------------------------------------------------- */}
      <div className="bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-6 rounded-3xl space-y-4 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#00E5C0] font-bold block">
              Curated Journey Overview
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {quote.destination || 'Japan'} Bespoke Travel Itinerary
            </h1>
            <p className="text-xs text-slate-300 mt-1 flex items-center space-x-2">
              <span>{itineraryDays.length} Days / {totalNights} Nights</span>
              <span>•</span>
              <span>{effectivePax} Guests ({quote.adultsCount || 2} Adults{quote.childrenCount ? `, ${quote.childrenCount} Children` : ''})</span>
              {quote.travelStartDate && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[#00E5C0]">{quote.travelStartDate} → {quote.travelEndDate || 'Open'}</span>
                </>
              )}
            </p>
          </div>

          <div className="text-left md:text-right shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold block">
              Package Rate per Person
            </span>
            <div className="text-2xl font-black font-mono text-[#00E5C0]">
              {formatCurrency(quote.totalSellingPrice / Math.max(1, effectivePax), quote.currency)}
            </div>
            <span className="text-[10px] text-slate-400">Inclusive of all ground taxes</span>
          </div>
        </div>

        {/* Route Hubs Visual Timeline */}
        {quote.routeHubs && quote.routeHubs.length > 0 && (
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 mb-2">
              <Compass className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>Route & Destination Hubs:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {quote.routeHubs.map((hub, idx) => (
                <React.Fragment key={hub.id || idx}>
                  <div className="bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 text-xs flex items-center space-x-2 shadow-xs">
                    <MapPin className="w-3 h-3 text-[#00E5C0]" />
                    <span className="font-bold text-white">{hub.hubName}</span>
                    <span className="text-[11px] text-[#00E5C0] font-mono font-semibold">({hub.nights} {hub.nights === 1 ? 'Night' : 'Nights'})</span>
                  </div>
                  {idx < (quote.routeHubs?.length || 0) - 1 && (
                    <ArrowRight className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3. CLIENT & CONSULTANT PROFILE DOSSIER */}
      {/* ---------------------------------------------------- */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 bg-slate-50 p-5 rounded-2xl border border-slate-200 text-xs">
        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center space-x-1">
            <Users className="w-3 h-3 text-slate-400" />
            <span>Valued Guest / Client</span>
          </span>
          <div className="font-bold text-slate-900 text-sm">{quote.clientName || 'Private Traveler'}</div>
          {quote.clientCompany && <div className="text-slate-600 font-medium">{quote.clientCompany}</div>}
          {quote.clientEmail && <div className="text-slate-500 font-mono">{quote.clientEmail}</div>}
          {quote.clientPhone && <div className="text-slate-500 font-mono">{quote.clientPhone}</div>}
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center space-x-1">
            <Award className="w-3 h-3 text-slate-400" />
            <span>Prepared By Destination Specialist</span>
          </span>
          <div className="font-bold text-slate-900 text-sm">{quote.agentName || 'Bespoke Travel Specialist'}</div>
          <div className="text-slate-700 font-medium">{quote.agentAgency || 'TheUnbound DMC Global Ground Desk'}</div>
          {quote.agentEmail && <div className="text-slate-500 font-mono">{quote.agentEmail}</div>}
          <div className="text-[11px] text-teal-700 font-semibold flex items-center space-x-1 mt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>24/7 On-Ground Concierge & Multilingual Dispatch</span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 4. THE DAY-BY-DAY ITINERARY FLOW */}
      {/* ---------------------------------------------------- */}
      <div className="space-y-6 pt-2">
        <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
          <div className="flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#00A88F]" />
            <h2 className="text-base font-black text-slate-950 uppercase tracking-wide">
              Day-by-Day Itinerary & Scheduled Services
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-mono font-semibold">
            {itineraryDays.length} Days • {quote.items?.length || 0} Total Services
          </span>
        </div>

        <div className="space-y-5">
          {itineraryDays.map((day) => {
            const hasItems = day.items && day.items.length > 0;
            const dayCity = day.hub?.hubName || quote.destination || 'Japan';

            return (
              <div 
                key={day.dayNumber}
                className="rounded-2xl border border-slate-200/90 overflow-hidden bg-white shadow-xs break-inside-avoid transition-all"
              >
                {/* Day Header Banner */}
                <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-[#00E5C0] text-slate-950 font-black flex items-center justify-center text-xs font-mono shadow-xs">
                      {String(day.dayNumber).padStart(2, '0')}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-sm text-white">Day {day.dayNumber}: {day.dayOfWeek}, {day.formattedDate}</span>
                        {day.isTransitionDay && day.prevHub && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                            Transfer: {day.prevHub.hubName} → {dayCity}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-300 flex items-center space-x-1.5 mt-0.5">
                        <MapPin className="w-3 h-3 text-[#00E5C0]" />
                        <span className="font-medium">{dayCity} Base</span>
                        {day.customTheme && (
                          <>
                            <span>•</span>
                            <span className="text-[#00E5C0] font-semibold">{day.customTheme}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right text-xs text-slate-400 font-mono">
                    {hasItems ? `${day.items.length} ${day.items.length === 1 ? 'Service' : 'Services'}` : 'Leisure / Free Exploration'}
                  </div>
                </div>

                {/* Day Content: Services List */}
                <div className="p-4 sm:p-5 space-y-3">
                  {hasItems ? (
                    <div className="space-y-3">
                      {day.items.map((item, itemIdx) => {
                        const meta = getCategoryMeta(item.product.category, item.product.productType);
                        const IconComponent = meta.icon;
                        const itemPrice = item.calculation?.finalTotalSellingPrice || item.calculation?.totalSellingPrice || 0;

                        return (
                          <div 
                            key={item.id || itemIdx}
                            className={`p-4 rounded-xl border ${meta.color} flex flex-col sm:flex-row sm:items-start justify-between gap-4`}
                          >
                            <div className="flex items-start space-x-3 max-w-2xl">
                              <div className={`p-2 rounded-lg ${meta.badgeColor} shrink-0 mt-0.5`}>
                                <IconComponent className="w-4 h-4" />
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex flex-wrap items-center gap-2">
                                  <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${meta.badgeColor}`}>
                                    {meta.label}
                                  </span>
                                  {item.product.duration && (
                                    <span className="text-[11px] font-medium text-slate-600 flex items-center space-x-1">
                                      <Clock className="w-3 h-3 text-slate-400" />
                                      <span>{item.product.duration}</span>
                                    </span>
                                  )}
                                  {item.serviceTime && (
                                    <span className="text-[11px] font-mono font-semibold text-slate-700 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                                      {item.serviceTime}
                                    </span>
                                  )}
                                </div>

                                <h4 className="text-sm font-bold text-slate-900">
                                  {item.product.name}
                                </h4>

                                {item.product.shortDescription && (
                                  <p className="text-xs text-slate-600 leading-relaxed">
                                    {item.product.shortDescription}
                                  </p>
                                )}

                                {/* Key Inclusions Checklist */}
                                {item.product.inclusions && item.product.inclusions.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 pt-1">
                                    {item.product.inclusions.slice(0, 3).map((inc, iIdx) => (
                                      <span key={iIdx} className="text-[10px] bg-white/90 text-slate-700 px-2 py-0.5 rounded border border-slate-200/80 flex items-center space-x-1">
                                        <Check className="w-2.5 h-2.5 text-emerald-600" />
                                        <span>{inc}</span>
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {item.notes && (
                                  <div className="text-[11px] text-slate-700 bg-white/90 p-2 rounded-lg border border-slate-200 mt-1">
                                    <span className="font-semibold text-slate-900">Special Instructions: </span>
                                    {item.notes}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Service Status / Item Price */}
                            <div className="text-left sm:text-right shrink-0 font-mono self-end sm:self-start pt-2 sm:pt-0">
                              <div className="text-sm font-bold text-slate-900">
                                {formatCurrency(itemPrice, quote.currency)}
                              </div>
                              <div className="text-[10px] text-slate-500 font-sans">
                                {item.pax?.adults || 2} Adults{item.pax?.children ? `, ${item.pax.children} Ch` : ''}
                              </div>
                              <span className="inline-block mt-1 text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                Confirmed Allotment
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    /* Day at Leisure Placeholder */
                    <div className="p-4 rounded-xl bg-slate-50 border border-dashed border-slate-200 flex items-center justify-between text-xs text-slate-500">
                      <div className="flex items-center space-x-3">
                        <Compass className="w-4 h-4 text-[#00A88F]" />
                        <div>
                          <span className="font-semibold text-slate-800">Day at Leisure in {dayCity}</span>
                          <p className="text-[11px] text-slate-500 mt-0.5">
                            Free time for personal exploration, neighborhood shopping, and culinary discoveries. 24/7 concierge assistance available.
                          </p>
                        </div>
                      </div>
                      <span className="text-[11px] font-medium text-slate-400 italic">Self-Paced</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* General Inclusions (if any items had no specific date) */}
      {generalInclusionItems.length > 0 && (
        <div className="space-y-3 pt-2">
          <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
            <Sparkles className="w-4 h-4 text-[#00A88F]" />
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
              Additional Package Services & Privileges
            </h3>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {generalInclusionItems.map((item, idx) => (
              <div key={item.id || idx} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-900">{item.product.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{item.product.category} • {item.product.city || quote.destination}</div>
                </div>
                <div className="font-mono font-bold text-slate-900 text-xs">
                  {formatCurrency(item.calculation?.finalTotalSellingPrice || 0, quote.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 5. VERIFIED DMC GROUND OPERATIONAL GUARANTEES */}
      {/* ---------------------------------------------------- */}
      <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-5 space-y-3">
        <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center space-x-1.5">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>TheUnbound Ground Operations Standards & Inclusions</span>
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
            <span className="font-bold text-slate-900 block text-[11px]">🚗 Private Chauffeur Fleet</span>
            <p className="text-[10px] text-slate-500 leading-normal">
              Pristine air-conditioned vehicles with commercial licensed drivers and door-to-door luggage handling.
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
            <span className="font-bold text-slate-900 block text-[11px]">⛩️ Licensed Local Guides</span>
            <p className="text-[10px] text-slate-500 leading-normal">
              Government-certified bilingual specialists delivering insightful cultural and historical immersion.
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
            <span className="font-bold text-slate-900 block text-[11px]">🏨 Confirmed Allocations</span>
            <p className="text-[10px] text-slate-500 leading-normal">
              Direct supplier contracted allotments with daily breakfast and verified luxury standards.
            </p>
          </div>
          <div className="bg-white p-3 rounded-xl border border-slate-200/80 space-y-1">
            <span className="font-bold text-slate-900 block text-[11px]">🛡️ 24/7 Operations Desk</span>
            <p className="text-[10px] text-slate-500 leading-normal">
              Live flight tracking, real-time dispatch monitoring, and 24/7 emergency WhatsApp concierge support.
            </p>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 6. TRANSPARENT INVESTMENT TOTAL & FINANCIAL SUMMARY */}
      {/* ---------------------------------------------------- */}
      <div className="bg-slate-950 text-white p-6 sm:p-8 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-6 shadow-xl">
        <div className="space-y-1">
          <span className="text-[10px] font-bold text-[#00E5C0] uppercase tracking-widest block">
            Official Proposal Tariff
          </span>
          <h3 className="text-xl font-black text-white">
            Guaranteed Total Itinerary Value
          </h3>
          <p className="text-xs text-slate-300 max-w-md">
            All private transportation, accommodations, guided experiences, entrance tickets, and applicable government taxes are fully included.
          </p>
        </div>

        <div className="text-right shrink-0 space-y-1">
          <div className="text-3xl sm:text-4xl font-black font-mono text-[#00E5C0]">
            {formatCurrency(quote.totalSellingPrice, quote.currency)}
          </div>
          <div className="text-xs text-slate-300 font-mono">
            {formatCurrency(quote.totalSellingPrice / Math.max(1, effectivePax), quote.currency)} / Traveler ({effectivePax} Guests)
          </div>
          <div className="text-[10px] text-slate-400 font-sans">
            Guaranteed in {quote.currency} • No Hidden Surcharges
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 7. TERMS, CONDITIONS & SIGNATURE FOOTER */}
      {/* ---------------------------------------------------- */}
      <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-3">
        <div className="space-y-1.5">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">Commercial Quotation Terms:</h4>
          <p className="leading-relaxed text-slate-600">
            {quote.termsAndConditions || 'This quotation is issued by TheUnbound Wholesale DMC Network. Rates are valid for 14 calendar days from generation date. All reservations subject to live inventory confirmation upon deposit.'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-slate-400 pt-3 border-t border-slate-100 font-mono">
          <span>TheUnbound DMC Global Ground Logistics • sales@theunbound.in</span>
          <span>Official Contracted Wholesale Quotation Document</span>
        </div>
      </div>
    </div>
  );
};

