import React, { useMemo } from 'react';
import { Quotation } from '../types';
import { 
  MapPin, 
  Calendar, 
  Users, 
  Clock, 
  CheckCircle2, 
  ShieldCheck, 
  Printer, 
  Download, 
  Compass, 
  ArrowRight, 
  Car, 
  Building2, 
  Sparkles, 
  Utensils, 
  Share2, 
  Info, 
  Check, 
  Award, 
  Globe, 
  MessageCircle, 
  Mail,
  Train,
  Ticket,
  Ship,
  Anchor,
  UserCheck,
  Crown
} from 'lucide-react';
import { RichTextRenderer } from './common/RichTextRenderer';
import { buildQuotePresentationModel } from '../services/quotePresentationModel';
import { resolveAuthoritativeCategory } from '../services/configuratorRegistry';
import { COMMERCIAL_QUOTATION_TERMS_ITEMS } from '../constants/commercialQuotationTerms';

interface ProposalDocumentViewProps {
  quote: Quotation;
  agentUser?: any;
  selectedOptionIndexOrId?: number | string;
  onClose?: () => void;
  onBookNow?: (quote: Quotation) => void;
  onPrint?: () => void;
  onDownloadPdf?: () => void;
  onShareLink?: () => void;
  onShareWhatsApp?: () => void;
  onSendEmail?: () => void;
}

// Helper for category styling & icons (module-level stable reference)
const getCategoryMeta = (category?: string, productType?: string, itemOrProduct?: any) => {
  const authoritativeCat = resolveAuthoritativeCategory(itemOrProduct || { category, productType });
  const raw = (category || productType || '').trim();
  const lower = (authoritativeCat || raw).toLowerCase();

  if (authoritativeCat === 'Tickets' || lower === 'tickets' || lower === 'ticket' || lower.includes('ticket')) {
    return {
      icon: Ticket,
      label: raw || 'Tickets',
      color: 'bg-purple-50 text-purple-800 border-purple-200',
      badgeColor: 'bg-purple-100 text-purple-900'
    };
  }
  if (authoritativeCat === 'Private Yacht' || lower.includes('yacht')) {
    return {
      icon: Ship,
      label: raw || 'Private Yacht',
      color: 'bg-cyan-50 text-cyan-800 border-cyan-200',
      badgeColor: 'bg-cyan-100 text-cyan-900'
    };
  }
  if (authoritativeCat === 'Ferries' || lower.includes('ferry') || lower.includes('ferries')) {
    return {
      icon: Anchor,
      label: raw || 'Ferries',
      color: 'bg-teal-50 text-teal-800 border-teal-200',
      badgeColor: 'bg-teal-100 text-teal-900'
    };
  }
  if (authoritativeCat === 'Guides' || lower.includes('guide')) {
    return {
      icon: UserCheck,
      label: raw || 'Guides',
      color: 'bg-orange-50 text-orange-800 border-orange-200',
      badgeColor: 'bg-orange-100 text-orange-900'
    };
  }
  if (authoritativeCat === 'Group Tours' || lower === 'group tours' || lower.includes('group tour')) {
    return {
      icon: Users,
      label: raw || 'Group Tours',
      color: 'bg-blue-50 text-blue-800 border-blue-200',
      badgeColor: 'bg-blue-100 text-blue-900'
    };
  }
  if (authoritativeCat === 'Hotels' || lower.includes('hotel') || lower.includes('accommodation') || lower.includes('resort') || lower.includes('ryokan')) {
    return {
      icon: Building2,
      label: raw || 'Hotels',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-900'
    };
  }
  if (authoritativeCat === 'Rail / Shinkansen' || authoritativeCat === 'Rail' || lower.includes('rail') || lower.includes('train') || lower.includes('shinkansen')) {
    return {
      icon: Train,
      label: raw || 'Rail / Shinkansen',
      color: 'bg-indigo-50 text-indigo-800 border-indigo-200',
      badgeColor: 'bg-indigo-100 text-indigo-900'
    };
  }
  if (authoritativeCat === 'Transfers' || lower.includes('transfer') || lower.includes('transport') || lower.includes('vehicle')) {
    return {
      icon: Car,
      label: raw || 'Transfers',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badgeColor: 'bg-emerald-100 text-emerald-900'
    };
  }
  if (authoritativeCat === 'Lunch / Dinner Restaurant' || lower.includes('dining') || lower.includes('restaurant') || lower.includes('food') || lower.includes('culinary') || lower.includes('meal')) {
    return {
      icon: Utensils,
      label: raw || 'Lunch / Dinner Restaurant',
      color: 'bg-rose-50 text-rose-800 border-rose-200',
      badgeColor: 'bg-rose-100 text-rose-900'
    };
  }
  if (authoritativeCat === 'Visa & Ancillary Services' || lower.includes('visa') || lower.includes('insurance') || lower.includes('connectivity') || lower.includes('vip')) {
    return {
      icon: Globe,
      label: raw || 'Visa & Ancillary Services',
      color: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      badgeColor: 'bg-emerald-100 text-emerald-900'
    };
  }
  if (authoritativeCat === 'Private Tours' || lower.includes('private tour')) {
    return {
      icon: Crown,
      label: raw || 'Private Tours',
      color: 'bg-amber-50 text-amber-800 border-amber-200',
      badgeColor: 'bg-amber-100 text-amber-900'
    };
  }
  return {
    icon: Compass,
    label: raw || authoritativeCat || 'Service',
    color: 'bg-teal-50 text-teal-800 border-teal-200',
    badgeColor: 'bg-teal-100 text-teal-900'
  };
};

interface ProposalDayCardProps {
  day: ReturnType<typeof buildQuotePresentationModel>['days'][number];
  defaultDestination: string;
}

const ProposalDayCard: React.FC<ProposalDayCardProps> = React.memo(({ day, defaultDestination }) => {
  const hasItems = day.services && day.services.length > 0;
  const dayCity = day.hubName || defaultDestination || 'Japan';

  return (
    <div className="proposal-day-card-cv rounded-2xl border border-slate-200/90 overflow-hidden bg-white shadow-xs break-inside-avoid">
      {/* Day Header Banner */}
      <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-xl bg-[#00E5C0] text-slate-950 font-black flex items-center justify-center text-xs font-mono shadow-xs">
            {String(day.dayNumber).padStart(2, '0')}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-bold text-sm text-white">Day {day.dayNumber}: {day.dayOfWeek}, {day.formattedDate}</span>
              {day.isTransitionDay && day.prevHubName && (
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/30">
                  Transfer: {day.prevHubName} → {dayCity}
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
          {hasItems ? `${day.services.length} ${day.services.length === 1 ? 'Service' : 'Services'}` : 'Leisure / Free Exploration'}
        </div>
      </div>

      {/* Day Content: Services List */}
      <div className="p-4 sm:p-5 space-y-3">
        {day.dayOverview && (
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-slate-700 leading-relaxed">
            <RichTextRenderer content={day.dayOverview} className="text-xs text-slate-700 leading-relaxed" />
            {day.dayNotes && (
              <p className="mt-2 pt-2 border-t border-slate-200/70 text-[11px] text-teal-800 font-semibold">
                {day.dayNotes}
              </p>
            )}
          </div>
        )}
        {hasItems ? (
          <div className="space-y-3">
            {day.services.map((item) => {
              const meta = getCategoryMeta(item.category, item.categoryLabel, item.rawItem);
              const IconComponent = meta.icon;

              return (
                <div
                  key={item.id || `${day.dayNumber}-${item.listingName}`}
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
                        {item.duration && (
                          <span className="text-[11px] font-medium text-slate-600 flex items-center space-x-1">
                            <Clock className="w-3 h-3 text-slate-400" />
                            <span>{item.duration}</span>
                          </span>
                        )}
                        {item.serviceTime && (
                          <span className="text-[11px] font-mono font-semibold text-slate-700 bg-white/80 px-2 py-0.5 rounded border border-slate-200">
                            {item.serviceTime}
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">
                        {item.listingName}
                      </h4>
                      {item.configurationSummary && !item.isRail && (
                        <p className="text-xs text-slate-600 font-medium">
                          {item.configurationSummary}
                        </p>
                      )}

                      {/* Shinkansen Bullet Train Route & Allotment Box */}
                      {item.isRail && item.railDetails && (
                        <div className="mt-1.5 p-2.5 rounded-xl bg-indigo-50/80 border border-indigo-200 text-xs text-indigo-950 space-y-1">
                          <div className="flex flex-wrap items-center gap-2 font-bold text-indigo-900">
                            <span className="flex items-center gap-1">
                              <Train className="w-3.5 h-3.5 text-indigo-700" />
                              <span>{item.railDetails.origin} → {item.railDetails.destination}</span>
                            </span>
                            <span>•</span>
                            <span>{item.railDetails.carType} Car ({item.railDetails.seatType})</span>
                            <span>•</span>
                            <span>{item.railDetails.serviceGroup}</span>
                          </div>
                          <div className="flex flex-wrap items-center gap-3 text-[11px] text-indigo-700">
                            {item.railDetails.seatPreference && (
                              <span>Seat Preference: <strong>{item.railDetails.seatPreference}</strong></span>
                            )}
                            {item.railDetails.pnrReference && (
                              <span>SmartEX PNR: <strong className="font-mono">{item.railDetails.pnrReference}</strong></span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Overview & Specifications */}
                      <div className="space-y-1 mt-1.5">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overview & Specifications</span>
                        <RichTextRenderer
                          content={item.overview || ''}
                          className="text-xs text-slate-600 leading-relaxed"
                        />
                      </div>

                      {/* Inclusions */}
                      {item.inclusions.length > 0 && (
                        <div className="space-y-1 pt-1.5">
                          <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Inclusions</span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.inclusions.map((inc: string, pos: number) => (
                              <span key={`${item.id}-inc-${inc}-${pos}`} className="text-[10px] bg-white/90 text-slate-700 px-2 py-0.5 rounded border border-slate-200/80 flex items-center space-x-1">
                                <Check className="w-2.5 h-2.5 text-emerald-600" />
                                <span>{inc}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Exclusions */}
                      {item.exclusions.length > 0 && (
                        <div className="space-y-1 pt-1.5">
                          <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Exclusions</span>
                          <div className="flex flex-wrap gap-1.5">
                            {item.exclusions.map((exc: string, pos: number) => (
                              <span key={`${item.id}-exc-${exc}-${pos}`} className="text-[10px] bg-white/90 text-rose-950 px-2 py-0.5 rounded border border-rose-200 flex items-center space-x-1">
                                <span className="text-rose-500 font-bold">✕</span>
                                <span>{exc}</span>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {item.specialInstructions && (
                        <div className="text-[11px] text-slate-700 bg-white/90 p-2 rounded-lg border border-slate-200 mt-1">
                          <span className="font-semibold text-slate-900">Special Instructions: </span>
                          {item.specialInstructions}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Service Status */}
                  <div className="text-left sm:text-right shrink-0 self-end sm:self-start pt-2 sm:pt-0">
                    <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded border border-emerald-200">
                      {item.statusText}
                    </span>
                    <div className="text-[10px] text-slate-500 font-sans mt-1">
                      {item.paxText}
                    </div>
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
});

const ProposalDocumentViewBase: React.FC<ProposalDocumentViewProps> = ({
  quote,
  agentUser,
  selectedOptionIndexOrId,
  onClose,
  onBookNow,
  onPrint,
  onDownloadPdf,
  onShareLink,
  onShareWhatsApp,
  onSendEmail
}) => {
  const model = useMemo(() => {
    const addressParts = [
      agentUser?.companyAddress || agentUser?.address,
      agentUser?.companyCity || agentUser?.city,
      agentUser?.companyCountry || agentUser?.country
    ].filter(Boolean);
    return buildQuotePresentationModel(quote, {
      name: agentUser?.name,
      agencyName: agentUser?.agencyName || agentUser?.companyName,
      email: agentUser?.companyEmail || agentUser?.email,
      phone: agentUser?.companyPhone || agentUser?.phone || agentUser?.contactNumber,
      logoUrl: agentUser?.brandLogoUrl || agentUser?.logoUrl,
      address: addressParts.length > 0 ? Array.from(new Set(addressParts)).join(', ') : undefined,
      registeredAddress: agentUser?.companyRegisteredAddress,
      currentAddress: agentUser?.companyCurrentAddress,
      website: agentUser?.companyWebsite,
      primaryColor: agentUser?.brandPrimaryColor,
      accentColor: agentUser?.brandAccentColor,
      tagline: agentUser?.quoteTagline,
      footerText: agentUser?.quoteFooterText,
      disclaimer: agentUser?.quoteDisclaimer,
      brandingMode: quote.brandingMode,
      selectedOptionIndexOrId: selectedOptionIndexOrId ?? quote.activeOptionId
    });
  }, [quote, agentUser, selectedOptionIndexOrId]);

  const handleDownload = async () => {
    if (onDownloadPdf) {
      onDownloadPdf();
    } else {
      const { downloadQuotationPDF } = await import('../services/pdfGenerator');
      await downloadQuotationPDF({
        quote,
        agentName: model.agentName,
        agentAgency: model.agencyName,
        agentEmail: model.agentEmail,
        agentPhone: model.agentPhone,
        agentLogoUrl: model.agentLogoUrl,
        agentAddress: model.agencyAddress,
        agentRegisteredAddress: model.agencyRegisteredAddress,
        agentCurrentAddress: model.agencyCurrentAddress,
        agentWebsite: model.agencyWebsite,
        footerText: model.customFooterText,
        brandingMode: model.brandingMode,
        selectedOptionIndexOrId: selectedOptionIndexOrId ?? model.selectedOptionId,
        snapshotHash: model.snapshotHash,
        leadId: quote.leadId
      });
    }
  };

  const handlePrint = () => {
    if (onPrint) {
      onPrint();
    } else {
      window.print();
    }
  };

  const visaItems = model.visaServices;
  const itineraryDays = model.days;
  const generalInclusionItems = model.additionalServices;
  const totalNights = model.totalNights;
  const effectivePax = model.effectivePax;

  return (
    <div className="print-proposal-canvas bg-white text-slate-900 font-sans p-6 sm:p-10 space-y-8 rounded-3xl border border-slate-200 print:border-none print:p-0 print:shadow-none shadow-2xl max-w-5xl mx-auto">
      {/* ---------------------------------------------------- */}
      {/* 1. DOCUMENT HEADER & BRAND IDENTITY */}
      {/* ---------------------------------------------------- */}
      <div className="flex flex-col sm:flex-row justify-between items-start border-b-2 border-slate-950 pb-6 gap-4">
        <div className="flex items-center gap-3.5">
          {model.agentLogoUrl && (
            <img
              src={model.agentLogoUrl}
              alt={model.agencyName}
              width={144}
              height={48}
              decoding="async"
              className="max-h-12 max-w-36 object-contain rounded-lg border border-slate-200 p-1 bg-white"
            />
          )}
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <span className={`text-2xl sm:text-3xl font-black tracking-tight font-sans text-slate-950 ${model.isWhiteLabel ? '' : 'lowercase'}`}>
                {model.agencyName}
              </span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-1 rounded-md bg-slate-950 text-[#00E5C0]">
                {model.documentBadgeTitle}
              </span>
              {model.isWhiteLabel && (
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 print:hidden">
                  White-Label Agency Brand
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-1.5">
              {model.agentAgencySubtitle}
            </p>
            {!model.isWhiteLabel && (
              <div className="text-[11px] text-slate-500 mt-1.5 space-y-0.5">
                <p><strong>Registered Address:</strong> {model.agencyRegisteredAddress}</p>
                <p><strong>Current Address:</strong> {model.agencyCurrentAddress}</p>
              </div>
            )}
            {model.isWhiteLabel && model.agencyAddress && (
              <div className="text-[11px] text-slate-500 mt-1.5 space-y-0.5">
                <p><strong>Agency Address:</strong> {model.agencyAddress}</p>
              </div>
            )}
          </div>
        </div>

        <div className="text-left sm:text-right space-y-0.5 font-mono text-xs">
          <div className="text-base font-black text-slate-950">{model.quoteNumber} (v{model.version})</div>
          <div className="text-slate-500">Date: {model.createdDateFormatted}</div>
          <div className="text-slate-500">Valid Until: {model.validUntilFormatted}</div>
          <div className="text-teal-700 font-bold">Status: {model.status}</div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 2. TRIP HEADLINE & ROUTE FLOW SUMMARY BAR */}
      {/* ---------------------------------------------------- */}
      <div className="bg-linear-to-r from-slate-950 via-slate-900 to-slate-950 text-white p-6 rounded-3xl space-y-4 shadow-md">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] uppercase tracking-widest text-[#00E5C0] font-bold block">
              {model.sourcePackageName ? `Curated Package Proposal • ${model.sourcePackageName}` : 'Curated Journey Overview'}
            </span>
            <h1 className="text-xl sm:text-2xl font-black text-white mt-0.5">
              {model.title}
            </h1>
            <p className="text-xs text-slate-300 mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span>{model.totalDays} Days / {totalNights} Nights</span>
              <span>•</span>
              <span className="font-semibold text-[#00E5C0]">
                {model.paxDetailsText || `${effectivePax} Guests (${model.adultsCount} Adults${model.childrenCount ? `, ${model.childrenCount} Children` : ''}${model.infantsCount ? `, ${model.infantsCount} Infants` : ''})`}
              </span>
              {model.nationality && (
                <>
                  <span>•</span>
                  <span>Nationality: <strong className="text-white">{model.nationality}</strong></span>
                </>
              )}
              {model.travelStyle && (
                <>
                  <span>•</span>
                  <span>Style: <strong className="text-white">{model.travelStyle}</strong></span>
                </>
              )}
              {model.travelStartDate && (
                <>
                  <span>•</span>
                  <span className="font-mono text-[#00E5C0]">{model.travelStartDate} → {model.travelEndDate || 'Open'}</span>
                </>
              )}
            </p>
          </div>

          <div className="text-left md:text-right shrink-0">
            <span className="text-[10px] uppercase tracking-widest text-[#00E5C0] font-bold block">
              Official Proposal
            </span>
            <div className="text-xl font-black text-white">
              {model.totalDays} Days / {model.totalNights} Nights
            </div>
            <span className="text-[10px] text-slate-400">Inclusive of all ground arrangements</span>
          </div>
        </div>

        {/* Route Hubs Visual Timeline */}
        {model.routeHubs && model.routeHubs.length > 0 && (
          <div className="pt-3 border-t border-slate-800">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-400 mb-2">
              <Compass className="w-3.5 h-3.5 text-[#00E5C0]" />
              <span>Route & Destination Hubs:</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {model.routeHubs.map((hub, orderPos) => (
                <React.Fragment key={`${hub.hubName}-${hub.nights}-${orderPos}`}>
                  <div className="bg-slate-800/90 px-3 py-1.5 rounded-xl border border-slate-700 text-xs flex items-center space-x-2 shadow-xs">
                    <MapPin className="w-3 h-3 text-[#00E5C0]" />
                    <span className="font-bold text-white">{hub.hubName}</span>
                    <span className="text-[11px] text-[#00E5C0] font-mono font-semibold">({hub.nights} {hub.nights === 1 ? 'Night' : 'Nights'})</span>
                  </div>
                  {orderPos < model.routeHubs.length - 1 && (
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
          <div className="font-bold text-slate-900 text-sm">{model.clientName || 'Private Traveler'}</div>
          {model.clientCompany && <div className="text-slate-600 font-medium">{model.clientCompany}</div>}
          {model.clientEmail && <div className="text-slate-500 font-mono">{model.clientEmail}</div>}
          {model.clientPhone && <div className="text-slate-500 font-mono">{model.clientPhone}</div>}
        </div>

        <div className="space-y-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block flex items-center space-x-1">
            <Award className="w-3 h-3 text-slate-400" />
            <span>Prepared By Destination Specialist</span>
          </span>
          <div className="font-bold text-slate-900 text-sm">{model.agentName}</div>
          <div className="text-slate-700 font-medium">{model.agencyName}</div>
          {model.agentEmail && <div className="text-slate-500 font-mono">{model.agentEmail}</div>}
          {model.agentPhone && <div className="text-slate-500 font-mono">{model.agentPhone}</div>}
          {model.agencyWebsite && <div className="text-slate-500 text-[11px]">{model.agencyWebsite}</div>}
          {model.agencyAddress && <div className="text-slate-500 text-[11px]">{model.agencyAddress}</div>}
          <div className="text-[11px] text-teal-700 font-semibold flex items-center space-x-1 mt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
            <span>24/7 On-Ground Concierge & Multilingual Dispatch</span>
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 3.2. ACCOMMODATION & STAYS SUMMARY */}
      {/* ---------------------------------------------------- */}
      {model.accommodations && model.accommodations.length > 0 && (
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-2.5">
            <div className="flex items-center space-x-2">
              <Building2 className="w-4 h-4 text-[#00A88F]" />
              <h2 className="text-sm font-black text-slate-950 uppercase tracking-wide">
                Accommodation & Hotel Stays
              </h2>
            </div>
            <span className="text-[11px] font-mono font-bold text-slate-600">
              {model.quotationScope === 'LAND_ONLY'
                ? 'Land-Only Mode (No Accommodation Included)'
                : `${model.accommodations.length} ${model.accommodations.length === 1 ? 'Destination Stay' : 'Destination Stays'}`}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {model.accommodations.map((acc, stayPos) => {
              const isNoAcc = acc.hotelName.includes('No Accommodation');
              return (
                <div
                  key={`${acc.city}-${acc.hotelName}-${acc.checkInDate || acc.nights}-${stayPos}`}
                  className={`p-3.5 rounded-2xl border flex items-start justify-between gap-3 ${
                    isNoAcc
                      ? 'bg-slate-50 border-slate-200 text-slate-700'
                      : 'bg-amber-50/40 border-amber-200/80 text-slate-900'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-slate-900 text-[#00E5C0]">
                        {acc.city}
                      </span>
                      <span className="text-[11px] font-mono font-semibold text-slate-500">
                        {acc.nights} {acc.nights === 1 ? 'Night' : 'Nights'}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-slate-900">{acc.hotelName}</div>
                    <div className="text-[11px] text-slate-600">{acc.roomSummary}</div>
                    {acc.checkInDate && acc.checkOutDate && (
                      <div className="text-[10px] font-mono text-slate-500">
                        {acc.checkInDate} → {acc.checkOutDate}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 3.5. VISA & ANCILLARY SERVICES */}
      {/* ---------------------------------------------------- */}
      {visaItems.length > 0 && (
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b-2 border-emerald-800 pb-3">
            <div className="flex items-center space-x-2">
              <Globe className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-black text-slate-950 uppercase tracking-wide">
                Visa & Ancillary Services
              </h2>
            </div>
            <span className="text-xs text-emerald-800 font-mono font-bold">
              {visaItems.length} {visaItems.length === 1 ? 'Service' : 'Services'} Included
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3">
            {visaItems.map((item) => (
              <div
                key={item.id || `visa-${item.listingName}`}
                className="p-4 sm:p-5 rounded-2xl bg-emerald-50/50 border border-emerald-200/90 flex flex-col sm:flex-row sm:items-start justify-between gap-4"
              >
                <div className="flex items-start space-x-3.5 max-w-2xl">
                  <div className="p-2.5 rounded-xl bg-emerald-100 text-emerald-800 shrink-0 mt-0.5 border border-emerald-200">
                    <Globe className="w-5 h-5" />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-emerald-200 text-emerald-950 border border-emerald-300">
                        {item.rawItem?.product?.destinationName || item.rawItem?.product?.country || 'Destination Visa'}
                      </span>
                      <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded bg-white text-slate-700 border border-slate-200">
                        {item.rawItem?.product?.sku || 'VSA-EXP'}
                      </span>
                      {item.duration && (
                        <span className="text-[11px] font-medium text-slate-600 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{item.duration}</span>
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm sm:text-base font-bold text-slate-900">
                      {item.listingName}
                    </h4>
                    {item.configurationSummary && (
                      <p className="text-xs text-emerald-800 font-medium">
                        {item.configurationSummary}
                      </p>
                    )}

                    {/* Overview & Specifications */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Overview & Specifications</span>
                      <RichTextRenderer 
                        content={item.overview || ''}
                        className="text-xs text-slate-600 leading-relaxed"
                      />
                    </div>

                    {/* Inclusions */}
                    {item.inclusions.length > 0 && (
                      <div className="space-y-1 pt-1.5">
                        <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider block">Inclusions</span>
                        <div className="flex flex-wrap gap-1.5">
                          {item.inclusions.map((inc: string, pos: number) => (
                            <span key={`${item.id}-vinc-${inc}-${pos}`} className="text-[10px] bg-white text-emerald-950 px-2 py-0.5 rounded border border-emerald-200 flex items-center space-x-1">
                              <Check className="w-2.5 h-2.5 text-emerald-600" />
                              <span>{inc}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Exclusions */}
                    {item.exclusions.length > 0 && (
                      <div className="space-y-1 pt-1.5">
                        <span className="text-[10px] font-bold text-rose-600 uppercase tracking-wider block">Exclusions</span>
                        <div className="flex flex-wrap gap-1.5">
                          {item.exclusions.map((exc: string, pos: number) => (
                            <span key={`${item.id}-vexc-${exc}-${pos}`} className="text-[10px] bg-white text-rose-950 px-2 py-0.5 rounded border border-rose-200 flex items-center space-x-1">
                              <span className="text-rose-500 font-bold">✕</span>
                              <span>{exc}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {item.specialInstructions && (
                      <div className="text-[11px] text-emerald-950 bg-white p-2.5 rounded-xl border border-emerald-200 mt-1">
                        <span className="font-semibold text-emerald-900">Special Notes: </span>
                        {item.specialInstructions}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 self-end sm:self-start pt-2 sm:pt-0">
                  <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                    Visa & Ancillary Included
                  </span>
                  <div className="text-[10px] text-slate-500 font-sans mt-1">
                    {item.paxText}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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
            {itineraryDays.length} Days • {model.hotelItemsCount + model.landItemsCount} Total Services
          </span>
        </div>

        {/* Overall Journey Narrative & Overview */}
        {model.itineraryOverview && (
          <div className="p-5 rounded-2xl bg-gradient-to-r from-teal-50/70 to-slate-50 border border-teal-200/80 shadow-xs space-y-2">
            <div className="flex items-center space-x-2 text-teal-900">
              <Sparkles className="w-4 h-4 text-[#00A88F]" />
              <h3 className="text-xs font-black uppercase tracking-wider">
                Journey Narrative &amp; Overview
              </h3>
            </div>
            <RichTextRenderer 
              content={model.itineraryOverview} 
              className="text-xs text-slate-700 leading-relaxed" 
            />
          </div>
        )}

        <div className="space-y-5">
          {itineraryDays.map((day) => (
            <ProposalDayCard
              key={day.dayNumber}
              day={day}
              defaultDestination={model.destination}
            />
          ))}
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
            {generalInclusionItems.map((item) => (
              <div key={item.id || `gen-${item.listingName}`} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 text-xs flex justify-between items-start">
                <div>
                  <div className="font-bold text-slate-900">{item.listingName}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">{item.configurationSummary || `${item.categoryLabel} • ${model.destination}`}</div>
                </div>
                <span className="inline-block text-[9px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-1 rounded border border-emerald-300">
                  Included
                </span>
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
          <span>{model.operationalStandardsTitle}</span>
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
      {/* 6. QUOTATION PRICING SUMMARY (HOTEL & LAND TOTALS)   */}
      {/* ---------------------------------------------------- */}
      <div className="bg-slate-950 text-white p-6 sm:p-8 rounded-3xl flex flex-col sm:flex-row justify-between items-center gap-6 shadow-xl">
        <div className="space-y-1.5">
          <span className="text-xs font-black text-[#00E5C0] uppercase tracking-widest block">
            QUOTATION PRICING SUMMARY
          </span>
          {model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted && (
            <div className="text-base font-bold text-slate-200">
              <span className="text-white">Hotel Accommodation Total:</span>{' '}
              <span className="text-[#00E5C0] font-mono">{model.hotelAccommodationTotalFormatted}</span>
            </div>
          )}
          <h3 className="text-xl font-black text-white">
            <span>Land Part Total:</span>{' '}
            <span className="text-[#00E5C0] font-mono">{model.landPartTotalFormatted}</span>
          </h3>
          {model.hasHotelAccommodation && (
            <div className="text-lg font-black text-white pt-1 border-t border-slate-800/80">
              <span>Final Selling Price:</span>{' '}
              <span className="text-[#00E5C0] font-mono">{model.finalCustomerSellingPriceFormatted}</span>
            </div>
          )}
          <p className="text-xs text-slate-300 max-w-md">
            Land Part Total covers all included non-accommodation travel services (private transportation, guided experiences, entrance tickets, rail, and ancillary ground services) and applicable taxes.
          </p>
        </div>

        <div className="text-right shrink-0 space-y-1">
          {model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted && (
            <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">
              Hotel Accommodation Total: <span className="text-[#00E5C0] font-mono">{model.hotelAccommodationTotalFormatted}</span>
            </div>
          )}
          {model.hasHotelAccommodation && (
            <div className="text-xs text-slate-300 font-bold uppercase tracking-wider">
              Land Part Total: <span className="text-[#00E5C0] font-mono">{model.landPartTotalFormatted}</span>
            </div>
          )}
          <div className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {model.hasHotelAccommodation ? 'Final Selling Price' : 'Land Part Total'}
          </div>
          <div className="text-3xl sm:text-4xl font-black font-mono text-[#00E5C0]">
            {model.finalCustomerSellingPriceFormatted}
          </div>
          <div className="text-[11px] text-slate-300 font-bold uppercase tracking-wider">
            {model.currency} Guaranteed
          </div>
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 6.2. PACKAGE INCLUSIONS, EXCLUSIONS & IMPORTANT NOTES */}
      {/* ---------------------------------------------------- */}
      {((model.inclusions && model.inclusions.length > 0) || (model.exclusions && model.exclusions.length > 0) || model.importantInformation || model.cancellationPolicy) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {model.inclusions && model.inclusions.length > 0 && (
            <div className="bg-emerald-50/50 border border-emerald-200 rounded-2xl p-5 space-y-2.5">
              <h4 className="font-extrabold text-emerald-950 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Check className="w-4 h-4 text-emerald-600" />
                <span>Package Inclusions</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-emerald-950">
                {model.inclusions.map((inc, pos) => (
                  <li key={`pkg-inc-${inc}-${pos}`} className="flex items-start space-x-2">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{inc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {model.exclusions && model.exclusions.length > 0 && (
            <div className="bg-rose-50/50 border border-rose-200 rounded-2xl p-5 space-y-2.5">
              <h4 className="font-extrabold text-rose-950 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
                <Info className="w-4 h-4 text-rose-600" />
                <span>Package Exclusions</span>
              </h4>
              <ul className="space-y-1.5 text-xs text-rose-950">
                {model.exclusions.map((exc, pos) => (
                  <li key={`pkg-exc-${exc}-${pos}`} className="flex items-start space-x-2">
                    <span className="text-rose-500 font-bold shrink-0">✕</span>
                    <span>{exc}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {model.importantInformation && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-1.5 md:col-span-2">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">Important Information</h4>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{model.importantInformation}</p>
            </div>
          )}

          {model.cancellationPolicy && (
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-1.5 md:col-span-2">
              <h4 className="font-extrabold text-slate-900 uppercase tracking-wider text-[11px]">Cancellation Policy</h4>
              <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">{model.cancellationPolicy}</p>
            </div>
          )}
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* 6.5. OPERATIONAL & ATTRACTION GUIDELINES */}
      {/* ---------------------------------------------------- */}
      <div className="bg-amber-50/60 border border-amber-200/90 rounded-2xl p-5 space-y-2 text-xs">
        <h4 className="font-extrabold text-amber-950 uppercase tracking-wider text-[11px] flex items-center space-x-1.5">
          <Info className="w-4 h-4 text-amber-700" />
          <span>Operational Guidelines & Child / Attraction Policy</span>
        </h4>
        <ul className="space-y-1 text-amber-900/90 text-[11px] list-disc list-inside">
          <li>Infant below 2 years is considered free of charge unless specifically charged by ground supplier or airline.</li>
          <li>Children aged 2 to below 5 years are classified as CNB (Child No Bed). Hotel breakfast & service surcharges apply as per tariff.</li>
          <li>Children aged 5 to below 11 years are classified as CWB (Child With Bed). Extra bed is included in the room allotment.</li>
          <li>Guests aged 11 years and above are classified as Adults.</li>
          <li>Important: If a guest is required to purchase an attraction ticket directly due to age, height, or attraction-specific eligibility rules, the ticket cost will be borne directly by the guest at the gate.</li>
        </ul>
      </div>

      {/* ---------------------------------------------------- */}
      {/* 7. TERMS, CONDITIONS & SIGNATURE FOOTER */}
      {/* ---------------------------------------------------- */}
      <div className="pt-4 border-t border-slate-200 text-[11px] text-slate-500 space-y-3">
        <div className="space-y-3">
          <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
            {model.commercialTermsHeading || 'Commercial Quotation Terms'}
          </h4>
          {model.isDestinationWiseCommercialTerms && model.commercialTermsSnapshot?.entries?.length ? (
            <div className="space-y-4">
              {model.commercialTermsSnapshot.entries.map((entry) => (
                <div
                  key={`${entry.targetId}-${entry.version}`}
                  className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 space-y-2.5"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-200/80">
                    <span className="text-[11px] font-black uppercase tracking-wider text-slate-900">
                      {entry.targetName} — Commercial Quotation Terms
                    </span>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      v{entry.version}{entry.inheritedFromParentName ? ` • Inherited from ${entry.inheritedFromParentName}` : ''}
                    </span>
                  </div>
                  <div className="space-y-2.5 text-slate-600">
                    {entry.sections
                      .filter((s) => s.isActive !== false)
                      .sort((a, b) => a.displayOrder - b.displayOrder)
                      .map((sec) => (
                        <div key={sec.sectionId} className="space-y-1 break-inside-avoid">
                          {sec.heading && (
                            <div className="font-bold text-slate-900 text-xs">{sec.heading}</div>
                          )}
                          <RichTextRenderer content={sec.htmlContent} className="!text-xs text-slate-600" />
                        </div>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          ) : model.isCustomHistoricalCommercialTerms ? (
            <p className="leading-relaxed text-slate-600 whitespace-pre-line">
              {model.commercialTerms}
            </p>
          ) : (
            <div className="space-y-2 leading-relaxed text-slate-600">
              {(model.commercialTermsItems || COMMERCIAL_QUOTATION_TERMS_ITEMS).map((term) => (
                <p key={term.number} className="break-inside-avoid">
                  <strong className="font-bold text-slate-900">{term.heading}</strong>{' '}
                  <span>{term.body}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-center gap-2 text-[10px] text-slate-400 pt-3 border-t border-slate-100 font-mono">
          <span>{model.footerContactLine}</span>
          <span>{model.footerRightTitle}</span>
        </div>
      </div>
    </div>
  );
};

export const ProposalDocumentView = React.memo(ProposalDocumentViewBase);
ProposalDocumentView.displayName = 'ProposalDocumentView';

