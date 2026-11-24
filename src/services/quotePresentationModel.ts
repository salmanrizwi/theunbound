import { Quotation, QuoteItem, TripRouteHub, QuoteBrandingMode, AgencyBrandingSnapshot, User, QuotationCommercialTermsSnapshot } from '../types';
import { formatCurrency, calculateQuoteTotal, convertCurrency, resolveQuoteAgencyPricingContext, roundCurrencyAmount } from './pricingEngine';
import { THEUNBOUND_REGISTERED_ADDRESS, THEUNBOUND_CURRENT_ADDRESS, AppDatabase } from './db';
import { getInventoryDisplayName, getInventoryConfigurationSummary } from '../utils/inventoryDisplayHelpers';
import { isRailQuoteItem } from './rail/JapanRailJourneyDataService';
import { 
  renderProposalViewHtmlEmail,
  renderStructuredQuotationHtmlEmail, 
  formatPlainTextQuotationToHtml,
  renderSimpleSemanticQuotationEmailFromModel,
  renderOption2CompleteFormattedHtmlEmail,
  convertHtmlToCleanPlainText
} from './quoteEmailFormatter';
import { richTextToWhatsApp, richTextToPlainText } from '../utils/richTextFormatter';
import { 
  resolveQuoteItemInclusions, 
  resolveQuoteItemExclusions, 
  resolveQuoteItemCategory 
} from '../utils/b2bQuotationHelpers';
import { resolveAuthoritativeCategory } from './configuratorRegistry';
import {
  doesHotelItemBelongToHubOccurrence,
  shouldExcludeHotelItemByNoAccommodation,
  computeStayDatesForHub
} from '../utils/hubStayMatching';
import {
  COMMERCIAL_QUOTATION_TERMS_HEADING,
  COMMERCIAL_QUOTATION_TERMS_ITEMS,
  COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT,
  COMMERCIAL_QUOTATION_TERMS_HTML,
  COMMERCIAL_QUOTATION_TERMS_WHATSAPP,
  CommercialQuotationTermItem,
  resolveAuthoritativeCommercialTerms
} from '../constants/commercialQuotationTerms';
export {
  COMMERCIAL_QUOTATION_TERMS_HEADING,
  COMMERCIAL_QUOTATION_TERMS_ITEMS,
  COMMERCIAL_QUOTATION_TERMS_PLAIN_TEXT,
  COMMERCIAL_QUOTATION_TERMS_HTML,
  COMMERCIAL_QUOTATION_TERMS_WHATSAPP,
  resolveAuthoritativeCommercialTerms
};
export type { CommercialQuotationTermItem };

export function isTheUnboundBrandString(val?: string | null): boolean {
  if (!val) return false;
  const lower = val.trim().toLowerCase();
  return (
    lower.includes('theunbound') ||
    lower.includes('the unbound') ||
    lower === '+91-9811654959'
  );
}

export function sanitizeWhiteLabelString(
  rawText: string | undefined | null,
  agencyName: string,
  agencyEmail?: string,
  agencyPhone?: string
): string {
  if (!rawText) return '';
  const safeAgency = agencyName && !isTheUnboundBrandString(agencyName) ? agencyName : 'Your Travel Agency';
  let result = rawText;
  result = result.replace(/In Association with TheUnbound Luxury DMC Network/gi, 'Official Bespoke Travel Proposal');
  result = result.replace(/TheUnbound Luxury DMC Network/gi, safeAgency);
  result = result.replace(/TheUnbound Luxury DMC/gi, safeAgency);
  result = result.replace(/TheUnbound DMC Global Ground Logistics/gi, safeAgency);
  result = result.replace(/TheUnbound Ground Operations/gi, `${safeAgency} Ground Operations`);
  result = result.replace(/TheUnbound DMC/gi, safeAgency);
  result = result.replace(/TheUnbound/gi, safeAgency);
  result = result.replace(/theunbound\.in/gi, '');
  result = result.replace(/theunbound\.com/gi, '');
  result = result.replace(/sales@theunbound\.in/gi, agencyEmail && !isTheUnboundBrandString(agencyEmail) ? agencyEmail : '');
  result = result.replace(/agent@theunbound\.com/gi, agencyEmail && !isTheUnboundBrandString(agencyEmail) ? agencyEmail : '');
  result = result.replace(/\+91-9811654959/g, agencyPhone && !isTheUnboundBrandString(agencyPhone) ? agencyPhone : '');
  return result.replace(/\s+•\s+•\s+/g, ' • ').replace(/^[•\s]+|[•\s]+$/g, '').trim();
}

export interface WhiteLabelReadinessValidation {
  isReady: boolean;
  missingMandatoryFields: string[];
  optionalMissingFields: string[];
}

export function validateWhiteLabelReadiness(
  branding?: Partial<AgencyBrandingSnapshot> | null
): WhiteLabelReadinessValidation {
  const missingMandatoryFields: string[] = [];
  const optionalMissingFields: string[] = [];

  const agencyName = branding?.agencyName?.trim() || '';
  if (!agencyName || isTheUnboundBrandString(agencyName) || agencyName.toLowerCase() === 'travel partner agency') {
    missingMandatoryFields.push('Agency / Company Name');
  }

  const hasValidEmail = Boolean(branding?.email?.trim() && !isTheUnboundBrandString(branding.email));
  const hasValidPhone = Boolean(branding?.phone?.trim() && !isTheUnboundBrandString(branding.phone));
  if (!hasValidEmail && !hasValidPhone) {
    missingMandatoryFields.push('Business Email or Contact Phone Number');
  }

  if (!branding?.logoUrl?.trim()) {
    optionalMissingFields.push('Agency Logo');
  }
  if (!branding?.address?.trim()) {
    optionalMissingFields.push('Business Address');
  }
  if (!branding?.website?.trim()) {
    optionalMissingFields.push('Agency Website');
  }

  return {
    isReady: missingMandatoryFields.length === 0,
    missingMandatoryFields,
    optionalMissingFields
  };
}

export function buildAgencyBrandingSnapshotFromUser(
  user?: Partial<User> | null,
  quote?: Partial<Quotation> | null,
  mode: QuoteBrandingMode = 'STANDARD'
): AgencyBrandingSnapshot {
  const existingSnap = quote?.brandingSnapshot;
  const rawAgencyName =
    user?.agencyName ||
    user?.companyName ||
    existingSnap?.agencyName ||
    quote?.agentAgency ||
    quote?.agentCompany ||
    '';
  const cleanAgencyName =
    mode === 'WHITE_LABEL'
      ? (isTheUnboundBrandString(rawAgencyName) ? '' : rawAgencyName.trim())
      : (rawAgencyName.trim() || 'theunbound');

  const rawAgentName =
    user?.name ||
    user?.displayName ||
    existingSnap?.agentName ||
    quote?.agentName ||
    'Bespoke Travel Specialist';
  const cleanAgentName =
    mode === 'WHITE_LABEL' && isTheUnboundBrandString(rawAgentName)
      ? 'Senior Travel Consultant'
      : rawAgentName;

  const rawEmail =
    user?.companyEmail ||
    user?.email ||
    existingSnap?.email ||
    quote?.agentEmail ||
    '';
  const cleanEmail =
    mode === 'WHITE_LABEL'
      ? (isTheUnboundBrandString(rawEmail) ? '' : rawEmail.trim())
      : (rawEmail.trim() || 'sales@theunbound.in');

  const rawPhone =
    user?.companyPhone ||
    user?.phone ||
    user?.contactNumber ||
    existingSnap?.phone ||
    quote?.agentPhone ||
    '';
  const cleanPhone =
    mode === 'WHITE_LABEL'
      ? (isTheUnboundBrandString(rawPhone) ? '' : rawPhone.trim())
      : (rawPhone.trim() || '+91-9811654959');

  const rawLogo =
    user?.brandLogoUrl ||
    user?.logoUrl ||
    existingSnap?.logoUrl ||
    quote?.agentLogoUrl ||
    '';
  const cleanLogo =
    mode === 'WHITE_LABEL' && isTheUnboundBrandString(rawLogo)
      ? ''
      : rawLogo.trim();

  const rawWebsite =
    user?.companyWebsite ||
    existingSnap?.website ||
    '';
  const cleanWebsite =
    mode === 'WHITE_LABEL' && isTheUnboundBrandString(rawWebsite)
      ? ''
      : rawWebsite.trim();

  const addressParts = [
    user?.companyAddress || user?.address,
    user?.companyCity || user?.city,
    user?.companyState || user?.state,
    user?.companyPostalCode || user?.postalCode,
    user?.companyCountry || user?.country
  ].filter(Boolean);
  const resolvedAddress = existingSnap?.address || (addressParts.length > 0 ? Array.from(new Set(addressParts)).join(', ') : '');

  return {
    mode,
    agencyId: user?.companyId || user?.id || existingSnap?.agencyId || quote?.agentId,
    agencyName: cleanAgencyName,
    agentName: cleanAgentName,
    tagline: user?.quoteTagline || existingSnap?.tagline || undefined,
    logoUrl: cleanLogo || undefined,
    primaryColor: user?.brandPrimaryColor || existingSnap?.primaryColor || '#0f172a',
    accentColor: user?.brandAccentColor || existingSnap?.accentColor || '#4f46e5',
    address: resolvedAddress || undefined,
    registeredAddress: user?.companyRegisteredAddress || existingSnap?.registeredAddress || (mode === 'WHITE_LABEL' ? resolvedAddress : THEUNBOUND_REGISTERED_ADDRESS),
    currentAddress: user?.companyCurrentAddress || existingSnap?.currentAddress || (mode === 'WHITE_LABEL' ? undefined : THEUNBOUND_CURRENT_ADDRESS),
    phone: cleanPhone || undefined,
    email: cleanEmail || undefined,
    website: cleanWebsite || undefined,
    footerText: user?.quoteFooterText || existingSnap?.footerText || undefined,
    disclaimer: user?.quoteDisclaimer || existingSnap?.disclaimer || undefined,
    capturedAt: new Date().toISOString()
  };
}

export interface ServicePresentationItem {
  id: string;
  category: string;
  categoryLabel: string;
  badgeBg: string;
  badgeText: string;
  colorClass: string;
  badgeClass: string;
  listingName: string;
  duration?: string;
  serviceTime?: string;
  configurationSummary?: string;
  isRail: boolean;
  railDetails?: {
    origin: string;
    destination: string;
    carType: string;
    seatType: string;
    serviceGroup: string;
    seatPreference?: string;
    pnrReference?: string;
  };
  overview: string;
  inclusions: string[];
  exclusions: string[];
  specialInstructions?: string;
  meetingPoint?: string;
  pickupPoint?: string;
  dropoffPoint?: string;
  priceFormatted: string;
  paxText: string;
  statusText: string;
  rawItem: QuoteItem;
}

export interface DayPresentationData {
  dayId: string;
  dayNumber: number;
  dateString: string;
  dayOfWeek: string;
  formattedDate: string;
  hubName: string;
  isTransitionDay: boolean;
  prevHubName?: string;
  customTheme?: string;
  dayOverview?: string;
  dayNotes?: string;
  services: ServicePresentationItem[];
}

export interface OperationalStandardCard {
  title: string;
  desc: string;
  icon: string;
}

export interface HotelPresentationItem {
  id: string;
  hotelName: string;
  cityHub: string;
  starRating?: string;
  checkInDate: string;
  checkOutDate: string;
  nightsCount: number;
  roomType: string;
  roomsCount: number;
  occupancy: string;
  mealPlan: string;
  overview?: string;
  inclusions: string[];
  exclusions: string[];
  priceFormatted?: string;
  notes?: string;
}

export interface AccommodationStaySummaryItem {
  hubId?: string;
  city: string;
  nights: number;
  hotelName: string;
  roomSummary?: string;
  checkInDate?: string;
  checkOutDate?: string;
  mealPlan?: string;
  isNoAccommodation?: boolean;
}

export interface QuotePresentationModel {
  quoteId: string;
  quoteNumber: string;
  version: number;
  status: string;
  title: string;
  sourcePackageId?: string;
  sourcePackageName?: string;
  quotationScope: 'HOTEL_LAND' | 'LAND_ONLY' | 'HOTEL_ONLY' | 'FULL_PACKAGE';
  selectedOptionId?: string;
  snapshotHash?: string;
  authoritativeSnapshotId?: string;
  createdDateFormatted: string;
  validUntilFormatted: string;
  currency: string;
  totalSellingPriceNumeric: number;
  finalCustomerSellingPriceNumeric: number;
  finalCustomerSellingPriceFormatted: string;
  baseSellingPriceNumeric: number;
  baseSellingPriceFormatted: string;
  agentMarginAmountNumeric: number;
  agentMarginAmountFormatted: string;
  surchargesTotalNumeric: number;
  surchargesTotalFormatted: string;
  appliedSurchargesCount: number;
  taxesTotalNumeric: number;
  serviceFeesTotalNumeric: number;
  discountsTotalNumeric: number;
  promotionDiscountAmountNumeric: number;
  promotionDiscountAmountFormatted?: string;
  appliedPromotion?: {
    promotionId: string;
    code: string;
    promotionName: string;
    discountType: 'PERCENTAGE' | 'FIXED';
    discountValue: number;
    discountAmountNumeric: number;
    discountAmountFormatted: string;
    label: string;
  } | null;
  
  // Separate Primary Totals: Hotel Accommodation Total & Land Part Total (Excludes Accommodation)
  hasHotelAccommodation: boolean;
  hotelAccommodationTotalNumeric: number;
  hotelAccommodationTotalFormatted?: string;
  hotelPartTotalFormatted?: string;
  isHotelPartTotalAuthoritative?: boolean;
  hotelItemsCount: number;

  hasLandServices: boolean;
  landPartTotalNumeric: number;
  landPartTotalFormatted: string;
  isLandPartTotalAuthoritative?: boolean;
  landItemsCount: number;
  
  // Agent & Agency Branding
  brandingMode: QuoteBrandingMode;
  isWhiteLabel: boolean;
  agencyName: string;
  agentName: string;
  agentEmail?: string;
  agentPhone?: string;
  agentLogoUrl?: string;
  agencyAddress?: string;
  agencyRegisteredAddress?: string;
  agencyCurrentAddress?: string;
  agencyWebsite?: string;
  brandPrimaryColor?: string;
  brandAccentColor?: string;
  agentAgencySubtitle: string;
  documentBadgeTitle: string;
  operationalStandardsTitle: string;
  footerRightTitle: string;
  agentNotes?: string;
  
  // Client Dossier
  clientName: string;
  clientCompany?: string;
  clientEmail?: string;
  clientPhone?: string;
  
  // Journey Overview
  destination: string;
  totalDays: number;
  totalNights: number;
  effectivePax: number;
  adultsCount: number;
  childrenCount: number;
  infantsCount: number;
  paxDetailsText: string;
  nationality?: string;
  travelStyle?: string;
  dateSpanText?: string;
  travelStartDate?: string;
  travelEndDate?: string;
  selectedOptionTitle?: string;
  selectedOptionNumber?: number;
  pricePerPersonFormatted: string;
  routeHubs: Array<{
    hubName: string;
    nights: number;
  }>;
  
  // Curated Hotels Summary
  hotels: HotelPresentationItem[];

  // Accommodations Summary (All Route Hubs, including NO_ACCOMMODATION)
  accommodations: AccommodationStaySummaryItem[];

  // Visa & Ancillary Services
  visaServices: ServicePresentationItem[];
  
  // Day-by-Day Chronological Itinerary
  days: DayPresentationData[];
  
  // Journey Narrative & Overview
  itineraryOverview?: string;
  narrative?: string;
  
  // General Inclusions & Package Notes
  additionalServices: Array<{
    name: string;
    summary: string;
    priceFormatted: string;
    category?: string;
    overview?: string;
    inclusions?: string[];
    exclusions?: string[];
    specialInstructions?: string;
  }>;
  inclusions: string[];
  exclusions: string[];
  importantInformation?: string;
  cancellationPolicy?: string;
  
  // Operational Standards
  operationalStandards: OperationalStandardCard[];
  
  // Financial Tariff
  totalItineraryValueFormatted: string;
  pricePerTravelerFormatted: string;
  guaranteedCurrencyLine: string;
  
  // Operational Policies
  childAndAttractionPolicies: string[];
  
  // Commercial Terms
  commercialTermsHeading: string;
  commercialTermsItems: readonly CommercialQuotationTermItem[];
  commercialTerms: string;
  commercialTermsHtml: string;
  commercialTermsWhatsApp: string;
  isCustomHistoricalCommercialTerms?: boolean;
  isDestinationWiseCommercialTerms?: boolean;
  commercialTermsSnapshot?: QuotationCommercialTermsSnapshot;
  footerContactLine: string;
  customFooterText?: string;
}

export function isVisaQuoteItem(it: QuoteItem): boolean {
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
}

export function getCategoryStyleMeta(category?: string, productType?: string, itemOrProduct?: any) {
  const authoritativeCat = resolveAuthoritativeCategory(itemOrProduct || { category, productType });
  const raw = (category || productType || '').trim();
  const lower = (authoritativeCat || raw).toLowerCase();

  if (authoritativeCat === 'Tickets' || lower === 'tickets' || lower === 'ticket' || lower.includes('ticket')) {
    return {
      label: raw || 'Tickets',
      badgeBg: '#F3E8FF',
      badgeText: '#6B21A8',
      colorClass: 'bg-purple-50/80 text-purple-900 border-purple-200/90',
      badgeClass: 'bg-purple-100 text-purple-900'
    };
  }
  if (authoritativeCat === 'Private Yacht' || lower.includes('yacht')) {
    return {
      label: raw || 'Private Yacht',
      badgeBg: '#CFFAFE',
      badgeText: '#155E75',
      colorClass: 'bg-cyan-50/80 text-cyan-900 border-cyan-200/90',
      badgeClass: 'bg-cyan-100 text-cyan-900'
    };
  }
  if (authoritativeCat === 'Ferries' || lower.includes('ferry') || lower.includes('ferries')) {
    return {
      label: raw || 'Ferries',
      badgeBg: '#CCFBF1',
      badgeText: '#115E59',
      colorClass: 'bg-teal-50/80 text-teal-900 border-teal-200/90',
      badgeClass: 'bg-teal-100 text-teal-900'
    };
  }
  if (authoritativeCat === 'Guides' || lower.includes('guide')) {
    return {
      label: raw || 'Guides',
      badgeBg: '#FFEDD5',
      badgeText: '#9A3412',
      colorClass: 'bg-orange-50/80 text-orange-900 border-orange-200/90',
      badgeClass: 'bg-orange-100 text-orange-900'
    };
  }
  if (authoritativeCat === 'Group Tours' || lower === 'group tours' || lower.includes('group tour')) {
    return {
      label: raw || 'Group Tours',
      badgeBg: '#DBEAFE',
      badgeText: '#1E40AF',
      colorClass: 'bg-blue-50/80 text-blue-900 border-blue-200/90',
      badgeClass: 'bg-blue-100 text-blue-900'
    };
  }
  if (authoritativeCat === 'Hotels' || lower.includes('hotel') || lower.includes('accommodation') || lower.includes('resort') || lower.includes('ryokan')) {
    return {
      label: raw || 'Hotels',
      badgeBg: '#FEF3C7',
      badgeText: '#92400E',
      colorClass: 'bg-amber-50/80 text-amber-900 border-amber-200/90',
      badgeClass: 'bg-amber-100 text-amber-900'
    };
  }
  if (authoritativeCat === 'Rail / Shinkansen' || authoritativeCat === 'Rail' || lower.includes('rail') || lower.includes('train') || lower.includes('shinkansen')) {
    return {
      label: raw || 'Rail / Shinkansen',
      badgeBg: '#E0E7FF',
      badgeText: '#3730A3',
      colorClass: 'bg-indigo-50/80 text-indigo-900 border-indigo-200/90',
      badgeClass: 'bg-indigo-100 text-indigo-900'
    };
  }
  if (authoritativeCat === 'Transfers' || lower.includes('transfer') || lower.includes('transport') || lower.includes('vehicle')) {
    return {
      label: raw || 'Transfers',
      badgeBg: '#D1FAE5',
      badgeText: '#065F46',
      colorClass: 'bg-emerald-50/80 text-emerald-900 border-emerald-200/90',
      badgeClass: 'bg-emerald-100 text-emerald-900'
    };
  }
  if (authoritativeCat === 'Lunch / Dinner Restaurant' || lower.includes('dining') || lower.includes('restaurant') || lower.includes('food') || lower.includes('culinary') || lower.includes('meal')) {
    return {
      label: raw || 'Lunch / Dinner Restaurant',
      badgeBg: '#FFE4E6',
      badgeText: '#9F1239',
      colorClass: 'bg-rose-50/80 text-rose-900 border-rose-200/90',
      badgeClass: 'bg-rose-100 text-rose-900'
    };
  }
  if (authoritativeCat === 'Visa & Ancillary Services' || lower.includes('visa') || lower.includes('insurance') || lower.includes('connectivity') || lower.includes('vip')) {
    return {
      label: raw || 'Visa & Ancillary Services',
      badgeBg: '#D1FAE5',
      badgeText: '#065F46',
      colorClass: 'bg-emerald-50/80 text-emerald-900 border-emerald-200/90',
      badgeClass: 'bg-emerald-100 text-emerald-900'
    };
  }
  if (authoritativeCat === 'Private Tours' || lower.includes('private tour')) {
    return {
      label: raw || 'Private Tours',
      badgeBg: '#FEF3C7',
      badgeText: '#92400E',
      colorClass: 'bg-amber-50/80 text-amber-900 border-amber-200/90',
      badgeClass: 'bg-amber-100 text-amber-900'
    };
  }
  return {
    label: raw || authoritativeCat || 'Service',
    badgeBg: '#CCFBF1',
    badgeText: '#115E59',
    colorClass: 'bg-teal-50/80 text-teal-900 border-teal-200/90',
    badgeClass: 'bg-teal-100 text-teal-900'
  };
}

function sanitizePresentationRawItem(item: QuoteItem): QuoteItem {
  if (!item || typeof item !== 'object') return item;
  const clean: any = { ...item };
  delete clean.totalNetCost;
  delete clean.netCost;
  delete clean.internalNettCost;
  delete clean.supplierCost;
  delete clean.internalMarkup;
  delete clean.internalMargin;
  delete clean.internalProfit;
  if (clean.product && typeof clean.product === 'object') {
    const cleanProd: any = { ...clean.product };
    delete cleanProd.adultNetPrice;
    delete cleanProd.childNetPrice;
    delete cleanProd.infantNetPrice;
    delete cleanProd.netPrice;
    delete cleanProd.nettPrice;
    delete cleanProd.supplierNetRate;
    delete cleanProd.supplierCost;
    delete cleanProd.defaultMarkupPercent;
    delete cleanProd.markupPercent;
    delete cleanProd.profitMargin;
    clean.product = cleanProd;
  }
  if (clean.calculation && typeof clean.calculation === 'object') {
    const cleanCalc: any = { ...clean.calculation };
    delete cleanCalc.totalNetCost;
    delete cleanCalc.unitNettPrice;
    delete cleanCalc.totalNettPrice;
    delete cleanCalc.nativeTotalNetCost;
    delete cleanCalc.markupAmount;
    delete cleanCalc.markupRate;
    delete cleanCalc.internalMargin;
    delete cleanCalc.marginAmount;
    delete cleanCalc.profit;
    clean.calculation = cleanCalc;
  }
  if (clean.manualHotelDetails && typeof clean.manualHotelDetails === 'object') {
    const cleanMh: any = { ...clean.manualHotelDetails };
    delete cleanMh.ratePerNight;
    delete cleanMh.totalNetCost;
    delete cleanMh.netCost;
    delete cleanMh.markupPercent;
    delete cleanMh.markupAmount;
    delete cleanMh.internalMargin;
    clean.manualHotelDetails = cleanMh;
  }
  if (clean.pricing_snapshot && typeof clean.pricing_snapshot === 'object') {
    const cleanPs: any = { ...clean.pricing_snapshot };
    delete cleanPs.totalNetCost;
    delete cleanPs.unitNettPrice;
    delete cleanPs.totalNettPrice;
    delete cleanPs.nativeTotalNetCost;
    delete cleanPs.markupAmount;
    delete cleanPs.markupRate;
    delete cleanPs.internalMargin;
    delete cleanPs.marginAmount;
    delete cleanPs.profit;
    clean.pricing_snapshot = cleanPs;
  }
  return clean as QuoteItem;
}

export function transformQuoteItemToPresentation(item: QuoteItem, currency: string): ServicePresentationItem {
  const isRail = isRailQuoteItem(item) || (item.category === 'Rail') || (item as any).service_type === 'RAIL' || Boolean(item.railJourneyDetails);
  const rawCategory = item.product?.category || item.category || (item.contentSnapshot as any)?.category || (item.contentSnapshot as any)?.categoryLabel;
  const styleMeta = getCategoryStyleMeta(rawCategory, item.product?.productType, item);
  const authoritativeCategory = resolveQuoteItemCategory(item);
  const finalCategory = rawCategory || authoritativeCategory;

  // Single authoritative source for inclusions & exclusions
  const inclusions = resolveQuoteItemInclusions(item);
  const exclusions = resolveQuoteItemExclusions(item);

  const overview = item.contentSnapshot?.overviewSpecifications || 
                   item.product?.longDescription || 
                   item.product?.description || 
                   item.product?.shortDescription || 
                   (item as any).description || '';

  let railDetails;
  if (isRail && item.railJourneyDetails) {
    const rd = item.railJourneyDetails;
    railDetails = {
      origin: `${rd.originStationName || 'Origin'} (${rd.originStationCode || 'TYO'})`,
      destination: `${rd.destinationStationName || 'Destination'} (${rd.destinationStationCode || 'KYO'})`,
      carType: rd.carType || 'Ordinary',
      seatType: rd.seatType || 'Reserved Seat',
      serviceGroup: rd.serviceGroup === 'NOZOMI_MIZUHO' ? 'Nozomi Super Express' : 'Hikari/Kodama Express',
      seatPreference: rd.seatPreference,
      pnrReference: rd.pnrReference
    };
  }

  const meetingPoint = item.metadata?.meetingPoint || (item.product as any)?.meetingPoint || (item as any).meetingPoint;
  const pickupPoint = item.metadata?.pickupPoint || item.selected_options?.pickupLocation || (item.product as any)?.pickupPoint || (item as any).pickupPoint;
  const dropoffPoint = item.metadata?.dropoffPoint || item.selected_options?.dropoffLocation || (item.product as any)?.dropoffPoint || (item as any).dropoffPoint;

  const adultsCount = item.pax?.adults || (item as any).paxCount || 2;
  const childrenCount = item.pax?.children || 0;

  return {
    id: item.id || `item-${Math.random()}`,
    category: finalCategory,
    categoryLabel: finalCategory,
    badgeBg: styleMeta.badgeBg,
    badgeText: styleMeta.badgeText,
    colorClass: styleMeta.colorClass,
    badgeClass: styleMeta.badgeClass,
    listingName: getInventoryDisplayName(item),
    duration: item.product?.duration || (item as any).duration,
    serviceTime: item.serviceTime,
    configurationSummary: getInventoryConfigurationSummary(item),
    isRail,
    railDetails,
    overview,
    inclusions,
    exclusions,
    specialInstructions: item.notes || (item as any).specialInstructions,
    meetingPoint,
    pickupPoint,
    dropoffPoint,
    priceFormatted: '',
    paxText: `${adultsCount} Adults${childrenCount ? `, ${childrenCount} Ch` : ''}`,
    statusText: 'Confirmed Allotment',
    rawItem: sanitizePresentationRawItem(item)
  };
}

function hasVisibleDayContentOrMedia(val: unknown): val is string {
  if (typeof val !== 'string') return false;
  const trimmed = val.trim();
  if (!trimmed) return false;
  if (/<img\b/i.test(trimmed)) return true;
  const plain = trimmed
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0;
}

function pickDayMapValue(
  dayNum: number,
  sources: Array<Record<string | number, any> | undefined | null>
): string | undefined {
  const keys: Array<string | number> = [dayNum, String(dayNum), `day-${dayNum}`, `Day ${dayNum}`];
  for (const src of sources) {
    if (!src || typeof src !== 'object') continue;
    for (const k of keys) {
      const candidate = src[k];
      if (hasVisibleDayContentOrMedia(candidate)) {
        return candidate;
      }
    }
  }
  return undefined;
}

export function buildQuotePresentationModel(
  quote: Quotation,
  agentOverride?: {
    name?: string;
    agencyName?: string;
    email?: string;
    phone?: string;
    logoUrl?: string;
    address?: string;
    registeredAddress?: string;
    currentAddress?: string;
    website?: string;
    primaryColor?: string;
    accentColor?: string;
    tagline?: string;
    footerText?: string;
    disclaimer?: string;
    brandingMode?: QuoteBrandingMode;
    selectedOptionIndexOrId?: number | string;
  }
): QuotePresentationModel {
  // Resolve option if applicable without ever discarding populated quote.items for an empty option slot
  let activeOption = undefined as any;
  let selectedOptionTitle: string | undefined = undefined;
  let selectedOptionNumber: number | undefined = undefined;

  if (quote.options && quote.options.length > 0) {
    const sel = agentOverride?.selectedOptionIndexOrId ?? quote.activeOptionId;
    if (typeof sel === 'number') {
      const zeroIdxCandidate = quote.options[sel];
      const oneIdxCandidate = sel >= 1 ? (quote.options.find(o => o.optionNumber === sel) || quote.options[sel - 1]) : undefined;
      if (zeroIdxCandidate && ((zeroIdxCandidate.items && zeroIdxCandidate.items.length > 0) || !oneIdxCandidate)) {
        activeOption = zeroIdxCandidate;
        selectedOptionNumber = zeroIdxCandidate.optionNumber || (sel + 1);
      } else if (oneIdxCandidate) {
        activeOption = oneIdxCandidate;
        selectedOptionNumber = oneIdxCandidate.optionNumber || sel;
      }
      if (activeOption) {
        selectedOptionTitle = activeOption.title || activeOption.optionTitle || `Option ${selectedOptionNumber}`;
      }
    } else if (typeof sel === 'string') {
      const idx = quote.options.findIndex(o => o.id === sel);
      if (idx >= 0) {
        activeOption = quote.options[idx];
        selectedOptionNumber = activeOption.optionNumber || (idx + 1);
        selectedOptionTitle = activeOption.title || activeOption.optionTitle || `Option ${selectedOptionNumber}`;
      }
    }
  }

  const rawItems: QuoteItem[] = (activeOption?.items && activeOption.items.length > 0)
    ? activeOption.items
    : (quote.items || []);
  const hubs: TripRouteHub[] = (activeOption?.routeHubs && activeOption.routeHubs.length > 0)
    ? activeOption.routeHubs
    : (quote.routeHubs || []);
  const sortedHubs = [...hubs].sort((a, b) => a.order - b.order);

  const effectiveScope = activeOption?.quotationScope || activeOption?.scope || quote.quotationScope || quote.scope || 'FULL_PACKAGE';
  const isLandOnlyQuote = effectiveScope === 'LAND_ONLY';

  const isHubNoAccommodation = (h?: TripRouteHub | null): boolean => {
    if (!h) return isLandOnlyQuote;
    return isLandOnlyQuote || h.accommodationType === 'NO_ACCOMMODATION' || h.accommodationType === 'none';
  };


  const isHotelQuoteItem = (it: QuoteItem): boolean => {
    const cat = (it.product?.category || it.category || it.product?.productType || '').toLowerCase();
    return cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan') ||
           it.product?.productType === 'HOTEL' || (it as any).service_type === 'HOTEL' ||
           Boolean(it.isManualHotel || it.manualHotelDetails || it.hotelId);
  };

  const items: QuoteItem[] = rawItems.filter(it => {
    if (it.isNoAccommodation || (it as any).accommodationType === 'NO_ACCOMMODATION' || (it as any).accommodationType === 'none') {
      return false;
    }
    if (shouldExcludeHotelItemByNoAccommodation(it, sortedHubs, isLandOnlyQuote)) {
      return false;
    }
    return true;
  });

  const effectiveCurrency = quote.currency || 'USD';
  const effectiveBrandingMode: QuoteBrandingMode =
    agentOverride?.brandingMode ||
    quote.brandingMode ||
    quote.brandingSnapshot?.mode ||
    'STANDARD';
  const isWhiteLabel = effectiveBrandingMode === 'WHITE_LABEL';
  const snap = quote.brandingSnapshot;

  const rawAgencyCandidate =
    agentOverride?.agencyName ||
    snap?.agencyName ||
    quote.agentAgency ||
    quote.agentCompany ||
    '';
  const effectiveAgency = isWhiteLabel
    ? ((!isTheUnboundBrandString(rawAgencyCandidate) && rawAgencyCandidate.trim()) ? rawAgencyCandidate.trim() : 'Partner Travel Agency')
    : (rawAgencyCandidate.trim() || 'theunbound');

  const rawAgentNameCandidate =
    agentOverride?.name ||
    snap?.agentName ||
    quote.agentName ||
    'Bespoke Travel Specialist';
  const effectiveAgentName = (isWhiteLabel && isTheUnboundBrandString(rawAgentNameCandidate))
    ? 'Senior Travel Consultant'
    : rawAgentNameCandidate;

  const rawEmailCandidate =
    agentOverride?.email ??
    snap?.email ??
    quote.agentEmail ??
    '';
  const effectiveAgentEmail = isWhiteLabel
    ? (isTheUnboundBrandString(rawEmailCandidate) ? undefined : (rawEmailCandidate.trim() || undefined))
    : (rawEmailCandidate.trim() || 'sales@theunbound.in');

  const rawPhoneCandidate =
    agentOverride?.phone ??
    snap?.phone ??
    quote.agentPhone ??
    '';
  const effectiveAgentPhone = isWhiteLabel
    ? (isTheUnboundBrandString(rawPhoneCandidate) ? undefined : (rawPhoneCandidate.trim() || undefined))
    : (rawPhoneCandidate.trim() || '+91-9811654959');

  const rawLogoCandidate =
    agentOverride?.logoUrl ??
    snap?.logoUrl ??
    quote.agentLogoUrl ??
    '';
  const effectiveAgentLogoUrl = (isWhiteLabel && isTheUnboundBrandString(rawLogoCandidate))
    ? undefined
    : (rawLogoCandidate.trim() || undefined);

  const rawWebsiteCandidate = agentOverride?.website ?? snap?.website ?? '';
  const effectiveAgencyWebsite = (isWhiteLabel && isTheUnboundBrandString(rawWebsiteCandidate))
    ? undefined
    : (rawWebsiteCandidate.trim() || undefined);

  let centralProfile: { registeredAddress?: string; currentAddress?: string; salesEmail?: string; phone?: string } = {};
  if (!isWhiteLabel) {
    try {
      centralProfile = AppDatabase.getInstance().getCentralCompanyProfile() || {};
    } catch {
      centralProfile = {};
    }
  }

  const rawRegisteredFallback = centralProfile.registeredAddress || THEUNBOUND_REGISTERED_ADDRESS;
  const rawCurrentFallback = (centralProfile.currentAddress || THEUNBOUND_CURRENT_ADDRESS).replace(/\r?\n/g, ', ');

  const rawAddressCandidate = agentOverride?.address ?? snap?.address ?? '';
  const effectiveAgencyAddress = (isWhiteLabel && isTheUnboundBrandString(rawAddressCandidate))
    ? undefined
    : (rawAddressCandidate.trim() || undefined);

  const rawRegisteredCandidate = agentOverride?.registeredAddress ?? snap?.registeredAddress ?? rawAddressCandidate;
  const effectiveAgencyRegisteredAddress = isWhiteLabel
    ? (isTheUnboundBrandString(rawRegisteredCandidate) ? undefined : (rawRegisteredCandidate.trim().replace(/\r?\n/g, ', ') || undefined))
    : ((rawRegisteredCandidate.trim() || rawRegisteredFallback).replace(/\r?\n/g, ', '));

  const rawCurrentCandidate = agentOverride?.currentAddress ?? snap?.currentAddress ?? '';
  const effectiveAgencyCurrentAddress = isWhiteLabel
    ? (isTheUnboundBrandString(rawCurrentCandidate) ? undefined : (rawCurrentCandidate.trim().replace(/\r?\n/g, ', ') || undefined))
    : ((rawCurrentCandidate.trim() || rawCurrentFallback).replace(/\r?\n/g, ', '));

  const effectivePrimaryColor = agentOverride?.primaryColor || snap?.primaryColor || '#0f172a';
  const effectiveAccentColor = agentOverride?.accentColor || snap?.accentColor || '#4f46e5';
  const effectiveTagline = agentOverride?.tagline || snap?.tagline;

  const rawAgentNotes = typeof quote.agentNotes === 'string'
    ? quote.agentNotes
    : Array.isArray(quote.agentNotes)
      ? (quote.agentNotes as any[]).map(x => typeof x === 'string' ? x : x?.text || '').filter(Boolean).join('\n')
      : undefined;
  const effectiveAgentNotes = isWhiteLabel && rawAgentNotes
    ? sanitizeWhiteLabelString(rawAgentNotes, effectiveAgency, effectiveAgentEmail, effectiveAgentPhone)
    : rawAgentNotes;

  // Split visa vs non-visa
  const visaItems = items.filter(isVisaQuoteItem);
  const nonVisaItems = items.filter(it => !isVisaQuoteItem(it));

  // Compute days
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

  if (calDays.length === 0) {
    const validDates = nonVisaItems.map(it => it.travelDate).filter((d): d is string => Boolean(d));
    const uniqueDates = Array.from(new Set<string>(validDates)).sort();
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
      const maxExplicitDay = nonVisaItems.reduce((max, it) => Math.max(max, Number((it as any).dayNumber) || 0), 0);
      const totalNights = hubs.reduce((sum, h) => sum + (h.nights || 0), 0) || Math.max(maxExplicitDay > 0 ? maxExplicitDay - 1 : 0, items.length, 3);
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

  const effectivePax = quote.totalPax || (quote as any).effectivePax || (quote as any).paxCount || ((quote.adultsCount || (quote as any).adults || 2) + (quote.childrenCount || (quote as any).children || 0) + (quote.infantsCount || (quote as any).infants || 0));
  const adultsDisplay = quote.adultsCount || (quote as any).adults || effectivePax || 2;
  const childrenDisplay = quote.childrenCount || (quote as any).children || 0;
  const infantsDisplay = quote.infantsCount || (quote as any).infants || 0;

  // Build curated hotels list strictly per itinerary hub occurrence (supporting repeated hubs & same/different hotels)
  const hotels: HotelPresentationItem[] = [];
  const seenHotelItemIds = new Set<string>();

  if (sortedHubs.length > 0) {
    sortedHubs.forEach((h, hIdx) => {
      const city = h.hubName || h.destinationName || quote.destination || 'City Hub';
      const nights = h.nights || 1;
      const computedDates = computeStayDatesForHub(sortedHubs, h.id || (hIdx + 1), quote.travelStartDate, nights);
      let checkInDate = computedDates.checkInIso
        ? new Date(computedDates.checkInIso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : (quote.travelStartDate || `Day ${hIdx + 1}`);
      let checkOutDate = computedDates.checkOutIso
        ? new Date(computedDates.checkOutIso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : (quote.travelEndDate || `Day ${hIdx + nights + 1}`);

      const matchedHotelItem = nonVisaItems.find(it =>
        doesHotelItemBelongToHubOccurrence(it, h, sortedHubs)
      );

      if (!isHubNoAccommodation(h) && (h.hotelId || h.manualHotel?.hotelName || matchedHotelItem)) {
        const hotelName =
          h.manualHotel?.hotelName ||
          (matchedHotelItem ? getInventoryDisplayName(matchedHotelItem) : h.hotelId) ||
          'Selected Luxury Hotel';
        const roomType =
          h.roomConfiguration?.roomTypeName ||
          h.manualHotel?.roomType ||
          matchedHotelItem?.selected_options?.roomType ||
          matchedHotelItem?.configuration_snapshot?.roomTypeName ||
          'Deluxe Luxury Room';
        const mealPlan =
          h.roomConfiguration?.mealPlanName ||
          h.manualHotel?.mealPlanName ||
          h.manualHotel?.mealPlan ||
          'Daily Breakfast Included';
        const starRating = h.manualHotel?.starRating || (h.manualHotel as any)?.category || '4 Star / 5 Star';
        const roomsCount =
          h.roomConfiguration?.roomsCount ||
          h.roomsCount ||
          matchedHotelItem?.roomsCount ||
          h.manualHotel?.numberOfRooms ||
          quote.roomingConfig?.roomsCount ||
          1;

        if (matchedHotelItem?.id) seenHotelItemIds.add(matchedHotelItem.id);

        hotels.push({
          id: h.accommodationStayId || h.id || `hotel-hub-${hIdx}`,
          hotelName,
          cityHub: city,
          starRating: String(starRating),
          checkInDate,
          checkOutDate,
          nightsCount: nights,
          roomType,
          roomsCount,
          occupancy: `${adultsDisplay} Adults${childrenDisplay ? ` + ${childrenDisplay} Ch` : ''}`,
          mealPlan,
          overview: matchedHotelItem?.contentSnapshot?.overviewSpecifications || matchedHotelItem?.product?.longDescription || matchedHotelItem?.product?.shortDescription,
          inclusions: matchedHotelItem?.contentSnapshot?.inclusions || matchedHotelItem?.product?.inclusions || [mealPlan, `${roomsCount} × ${roomType} (${nights} Nights)`],
          exclusions: matchedHotelItem?.contentSnapshot?.exclusions || matchedHotelItem?.product?.exclusions || [],
          priceFormatted: undefined,
          notes: h.manualHotel?.internalNotes || (h.manualHotel as any)?.notes || matchedHotelItem?.notes
        });
      }
    });
  }

  // Also include any standalone Hotel QuoteItems that were not matched via routeHubs
  nonVisaItems.forEach((it, idx) => {
    const cat = (it.product?.category || it.category || it.product?.productType || '').toLowerCase();
    const isHtl = cat.includes('hotel') || cat.includes('accommodation') || cat.includes('resort') || cat.includes('ryokan') || Boolean(it.isManualHotel) || Boolean(it.hotelId);
    if (!isHtl) return;
    if (seenHotelItemIds.has(it.id)) return;
    seenHotelItemIds.add(it.id);

    const hotelName = getInventoryDisplayName(it);
    const city = it.product?.city || quote.destination || 'Destination Hub';
    hotels.push({
      id: it.accommodationStayId || it.id || `hotel-item-${idx}`,
      hotelName,
      cityHub: city,
      starRating: '4 Star / 5 Star',
      checkInDate: it.checkInDate || it.travelDate || quote.travelStartDate || 'Day 1',
      checkOutDate: it.checkOutDate || quote.travelEndDate || 'As per itinerary',
      nightsCount: it.nights || (it as any).quantity || 1,
      roomType: getInventoryConfigurationSummary(it) || 'Luxury Room',
      roomsCount: it.roomsCount || quote.roomingConfig?.roomsCount || 1,
      occupancy: `${it.pax?.adults || adultsDisplay} Adults${it.pax?.children ? ` + ${it.pax.children} Ch` : ''}`,
      mealPlan: 'Daily Breakfast Included',
      overview: it.contentSnapshot?.overviewSpecifications || it.product?.longDescription || it.product?.shortDescription,
      inclusions: it.contentSnapshot?.inclusions || it.product?.inclusions || [],
      exclusions: it.contentSnapshot?.exclusions || it.product?.exclusions || [],
      priceFormatted: undefined,
      notes: it.notes
    });
  });

  // Build accommodations summary list for all route hubs in exact sequence (including repeated hubs & NO_ACCOMMODATION)
  const accommodations: AccommodationStaySummaryItem[] = [];
  if (sortedHubs.length > 0) {
    sortedHubs.forEach((h, hIdx) => {
      const city = h.hubName || h.destinationName || quote.destination || `Hub ${hIdx + 1}`;
      const nights = h.nights || 1;
      const computedDates = computeStayDatesForHub(sortedHubs, h.id || (hIdx + 1), quote.travelStartDate, nights);
      const checkInDate = computedDates.checkInIso
        ? new Date(computedDates.checkInIso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : (quote.travelStartDate || `Day ${hIdx + 1}`);
      const checkOutDate = computedDates.checkOutIso
        ? new Date(computedDates.checkOutIso).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
        : (quote.travelEndDate || `Day ${hIdx + nights + 1}`);

      const isNoAcc = isHubNoAccommodation(h);
      if (isNoAcc) {
        accommodations.push({
          hubId: h.id,
          city,
          nights,
          hotelName: 'No Accommodation (Arranged by Client)',
          roomSummary: 'Arranged directly by traveler / Client self-booked',
          checkInDate,
          checkOutDate,
          isNoAccommodation: true
        });
      } else {
        const matchedHotelItem = nonVisaItems.find(it =>
          doesHotelItemBelongToHubOccurrence(it, h, sortedHubs)
        );

        const hotelName =
          h.manualHotel?.hotelName ||
          (matchedHotelItem ? getInventoryDisplayName(matchedHotelItem) : h.hotelId) ||
          'Selected Luxury Hotel';
        const roomType =
          h.roomConfiguration?.roomTypeName ||
          h.manualHotel?.roomType ||
          matchedHotelItem?.selected_options?.roomType ||
          matchedHotelItem?.configuration_snapshot?.roomTypeName ||
          'Standard Room';
        const mealPlan =
          h.roomConfiguration?.mealPlanName ||
          h.manualHotel?.mealPlanName ||
          h.manualHotel?.mealPlan ||
          'Daily Breakfast Included';
        const roomsCount =
          h.roomConfiguration?.roomsCount ||
          h.roomsCount ||
          matchedHotelItem?.roomsCount ||
          h.manualHotel?.numberOfRooms ||
          quote.roomingConfig?.roomsCount ||
          1;

        accommodations.push({
          hubId: h.id,
          city,
          nights,
          hotelName,
          roomSummary: `${roomsCount} Room(s) • ${roomType} (${mealPlan})`,
          checkInDate,
          checkOutDate,
          mealPlan,
          isNoAccommodation: false
        });
      }
    });
  } else if (hotels.length > 0) {
    hotels.forEach(h => {
      accommodations.push({
        hubId: h.id,
        city: h.cityHub,
        nights: h.nightsCount,
        hotelName: h.hotelName,
        roomSummary: `${h.roomsCount} Room(s) • ${h.roomType} (${h.mealPlan})`,
        checkInDate: h.checkInDate,
        checkOutDate: h.checkOutDate,
        mealPlan: h.mealPlan,
        isNoAccommodation: false
      });
    });
  }

  const days: DayPresentationData[] = calDays.map((calDay) => {
    let activeHub: TripRouteHub | null = null;
    let isTransitionDay = false;
    let isHubCheckIn = false;
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
          if (calDay.dayNumber === hubStartDay) {
            isHubCheckIn = true;
            if (i > 0) {
              isTransitionDay = true;
              prevHub = sortedHubs[i - 1];
            }
          }
          break;
        }
        runningNightCount += hubNights;
      }

      if (!activeHub && sortedHubs.length > 0) {
        activeHub = sortedHubs[sortedHubs.length - 1];
      }
    }

    const dayItems = nonVisaItems.filter(it => {
      if (it.travelDate) {
        return it.travelDate === calDay.dateString;
      }
      return Number((it as any).dayNumber) === calDay.dayNumber;
    });

    const dayServices = dayItems.map(it => transformQuoteItemToPresentation(it, effectiveCurrency));

    // If this day is a hub check-in and the hub has a manualHotel/hotelId that wasn't already in dayItems, synthesize a hotel service card so all channels show it
    if (isHubCheckIn && activeHub && !isHubNoAccommodation(activeHub) && (activeHub.manualHotel?.hotelName || activeHub.hotelId)) {
      const targetHotelName = (activeHub.manualHotel?.hotelName || activeHub.hotelId || '').toLowerCase();
      const alreadyHasHotelInDay = dayItems.some(it =>
        isHotelQuoteItem(it) && doesHotelItemBelongToHubOccurrence(it, activeHub!, sortedHubs)
      ) || dayServices.some(s =>
        s.categoryLabel === 'Luxury Accommodation' ||
        (Boolean(targetHotelName) && s.category === 'Accommodation' && s.listingName.toLowerCase().includes(targetHotelName))
      );
      if (!alreadyHasHotelInDay) {
        const hubName = activeHub.hubName || quote.destination || 'Japan';
        const hotelDisplayName = activeHub.manualHotel?.hotelName || activeHub.hotelId || `${hubName} Luxury Hotel`;
        const roomType = activeHub.manualHotel?.roomType || 'Deluxe Room';
        const mealPlan = activeHub.manualHotel?.mealPlanName || activeHub.manualHotel?.mealPlan || 'Daily Breakfast Included';
        const roomsCount = activeHub.roomsCount || activeHub.manualHotel?.numberOfRooms || quote.roomingConfig?.roomsCount || 1;
        const nights = activeHub.nights || 1;
        const htlStyle = getCategoryStyleMeta('Accommodation', 'Hotel');
        const manualSourceCurr = (activeHub.manualHotel as any)?.rateCurrency || (activeHub.manualHotel as any)?.currency || effectiveCurrency;
        const rawManualPrice = activeHub.manualHotel
          ? ((activeHub.manualHotel as any).totalSellingPrice || (activeHub.manualHotel.ratePerNight || 0) * nights * roomsCount)
          : 0;
        const manualPrice = rawManualPrice > 0
          ? roundCurrencyAmount(
              (activeHub.manualHotel as any)?.totalSellingPrice
                ? rawManualPrice
                : convertCurrency(rawManualPrice, manualSourceCurr, effectiveCurrency),
              effectiveCurrency
            )
          : 0;

        dayServices.unshift({
          id: `synth-hotel-${activeHub.id || calDay.dayNumber}`,
          category: 'Accommodation',
          categoryLabel: htlStyle.label,
          badgeBg: htlStyle.badgeBg,
          badgeText: htlStyle.badgeText,
          colorClass: htlStyle.colorClass,
          badgeClass: htlStyle.badgeClass,
          listingName: hotelDisplayName,
          duration: `${nights} ${nights === 1 ? 'Night' : 'Nights'}`,
          configurationSummary: `${roomType} • ${roomsCount} ${roomsCount === 1 ? 'Room' : 'Rooms'} • ${mealPlan}`,
          isRail: false,
          overview: `Confirmed ${nights}-night accommodation stay at ${hotelDisplayName} in ${hubName}.`,
          inclusions: [mealPlan, `${roomsCount} × ${roomType} (${nights} Nights)`],
          exclusions: [],
          specialInstructions: activeHub.manualHotel?.internalNotes || activeHub.notes,
          priceFormatted: '',
          paxText: `${adultsDisplay} Adults${childrenDisplay ? `, ${childrenDisplay} Ch` : ''}`,
          statusText: 'Confirmed Allotment',
          rawItem: {
            id: `synth-hotel-${activeHub.id || calDay.dayNumber}`,
            product: {
              id: activeHub.hotelId || `htl-${calDay.dayNumber}`,
              name: hotelDisplayName,
              category: 'Accommodation'
            } as any,
            travelDate: calDay.dateString,
            itineraryHubOccurrenceId: activeHub.itineraryHubOccurrenceId || activeHub.id,
            accommodationStayId: activeHub.accommodationStayId,
            pax: { adults: adultsDisplay, children: childrenDisplay, infants: infantsDisplay },
            selectedAddonIds: [],
            calculation: {
              totalSellingPrice: manualPrice,
              finalTotalSellingPrice: manualPrice,
              currency: effectiveCurrency
            } as any,
            totalSellingPrice: manualPrice,
            currency: effectiveCurrency as any
          } as any
        });
      }
    }

    const authItinerary = (quote.authoritativeSnapshot as any)?.itinerary;
    const rawDaysFallbackEntry = Array.isArray((quote as any).days)
      ? (quote as any).days.find((d: any) => Number(d?.dayNumber) === calDay.dayNumber)
      : undefined;

    const customTheme = pickDayMapValue(calDay.dayNumber, [
      (activeOption as any)?.dayThemes,
      quote.dayThemes,
      authItinerary?.dayThemes
    ]);

    const dayOverview =
      pickDayMapValue(calDay.dayNumber, [
        (activeOption as any)?.dayOverviews,
        (activeOption as any)?.dayDescriptions,
        (quote as any).dayOverviews,
        (quote as any).dayDescriptions,
        authItinerary?.dayOverviews,
        authItinerary?.dayDescriptions
      ]) ??
      (hasVisibleDayContentOrMedia(rawDaysFallbackEntry?.dayOverview)
        ? rawDaysFallbackEntry.dayOverview
        : hasVisibleDayContentOrMedia(rawDaysFallbackEntry?.overview)
          ? rawDaysFallbackEntry.overview
          : hasVisibleDayContentOrMedia(rawDaysFallbackEntry?.description)
            ? rawDaysFallbackEntry.description
            : undefined);

    const dayNotes =
      pickDayMapValue(calDay.dayNumber, [
        (activeOption as any)?.dayNotes,
        (activeOption as any)?.dayOperationalNotes,
        (quote as any).dayNotes,
        (quote as any).dayOperationalNotes,
        authItinerary?.dayNotes,
        authItinerary?.dayOperationalNotes
      ]) ??
      (hasVisibleDayContentOrMedia(rawDaysFallbackEntry?.dayNotes)
        ? rawDaysFallbackEntry.dayNotes
        : undefined);

    return {
      dayId: `day-${calDay.dayNumber}`,
      dayNumber: calDay.dayNumber,
      dateString: calDay.dateString,
      dayOfWeek: calDay.dayOfWeek,
      formattedDate: calDay.formattedDate,
      hubName: activeHub?.hubName || quote.destination || 'Japan',
      isTransitionDay,
      prevHubName: prevHub?.hubName,
      customTheme,
      dayOverview,
      dayNotes,
      services: dayServices
    };
  });

  const dayDatesSet = new Set(calDays.map(d => d.dateString));
  const dayNumbersSet = new Set(calDays.map(d => d.dayNumber));
  const generalInclusions = nonVisaItems
    .filter(it => {
      if (it.travelDate) {
        return !dayDatesSet.has(it.travelDate);
      }
      if ((it as any).dayNumber !== undefined) {
        return !dayNumbersSet.has(Number((it as any).dayNumber));
      }
      return true;
    })
    .map(it => {
      const pres = transformQuoteItemToPresentation(it, effectiveCurrency);
      return {
        name: pres.listingName,
        summary: pres.configurationSummary || `${it.product?.category || 'Service'} • ${it.product?.city || quote.destination}`,
        priceFormatted: pres.priceFormatted,
        category: pres.categoryLabel,
        overview: pres.overview,
        inclusions: pres.inclusions,
        exclusions: pres.exclusions,
        specialInstructions: pres.specialInstructions
      };
    });

  const totalNights = hubs.reduce((sum, h) => sum + (h.nights || 0), 0) || Math.max(1, days.length - 1);

  // --------------------------------------------------------------------------
  // Single Authoritative Pricing Source: Authoritative Snapshot (if matching) -> Central Pricing Engine
  // --------------------------------------------------------------------------
  const authSnap = quote.authoritativeSnapshot;
  const effectiveAgentMarginType = quote.agentMarginType || (quote as any).agent_margin_type || 'PERCENTAGE';
  const effectiveAgentMarginVal = Math.max(
    0,
    Number(quote.agentMarginValue ?? (quote as any).agent_margin_value ?? quote.overallMarkupPercent ?? 0)
  );
  const effectiveDiscountPct = Number(quote.overallDiscountPercent || 0);
  const reqRawAdminVal = (quote as any).adminManualMarginValue ?? (quote as any).admin_manual_margin_value;
  const hasReqAdminConfig =
    reqRawAdminVal !== undefined ||
    (quote as any).adminMarginMode !== undefined ||
    (quote as any).admin_margin_mode !== undefined;
  const reqAdminMode = ((quote as any).adminMarginMode ?? (quote as any).admin_margin_mode) === 'REPLACE' ? 'REPLACE' : 'ADD';
  const reqAdminType = ((quote as any).adminManualMarginType ?? (quote as any).admin_manual_margin_type) === 'FIXED' ? 'FIXED' : 'PERCENTAGE';
  const reqAdminVal = Math.max(0, Number.isFinite(Number(reqRawAdminVal)) ? Number(reqRawAdminVal) : 0);

  const authSnapAdminMatches =
    !hasReqAdminConfig ||
    (
      (authSnap?.pricing?.adminMarginMode ??
        (authSnap?.pricing?.currencyConversionSnapshot?.totals as any)?.manualMarginAdjustmentMode ??
        'ADD') === reqAdminMode &&
      (authSnap?.pricing?.adminManualMarginType ??
        (authSnap?.pricing?.currencyConversionSnapshot?.totals as any)?.manualMarginAdjustmentType ??
        'PERCENTAGE') === reqAdminType &&
      Math.abs(
        Number(
          authSnap?.pricing?.adminManualMarginValue ??
          (authSnap?.pricing?.currencyConversionSnapshot?.totals as any)?.manualMarginAdjustmentValue ??
          0
        ) - reqAdminVal
      ) < 0.0001
    );

  const quoteAgencyCtxForAuth = resolveQuoteAgencyPricingContext(quote);
  const authSnapMarginMode =
    authSnap?.pricing?.activeMarginMode ??
    (authSnap?.pricing?.productLevelMarginEnabled !== undefined
      ? (authSnap.pricing.productLevelMarginEnabled ? 'PRODUCT_LEVEL' : 'AGENT_LEVEL')
      : undefined);
  const authSnapAgencyMatches =
    !authSnapMarginMode ||
    (authSnapMarginMode === quoteAgencyCtxForAuth.activeMarginMode &&
      (quoteAgencyCtxForAuth.productLevelMarginEnabled ||
        authSnap?.pricing?.agentLevelMarginPercent === undefined ||
        Math.abs(Number(authSnap.pricing.agentLevelMarginPercent) - quoteAgencyCtxForAuth.agentLevelMarginPercent) < 0.001));

  const isWorkingQuoteLocked = Boolean(
    quote.isLocked ||
    ['ISSUED', 'SENT', 'APPROVED', 'ACCEPTED', 'CONVERTED', 'BOOKED'].includes(String(quote.status || '').toUpperCase())
  );
  const quoteVerForAuth = Number(quote.version || quote.latestVersion || 0);
  const authVerForAuth = Number(authSnap?.versionNumber || 0);
  const authSnapVersionMatches = !quoteVerForAuth || !authVerForAuth || quoteVerForAuth === authVerForAuth;
  const authSnapOverridesMatch =
    JSON.stringify((quote as any).surchargeOverrides || []) ===
    JSON.stringify(authSnap?.pricing?.surchargeOverrides || []);
  const itemsHaveProductMarkup = items.some(it => Number(it.agentAdditionalMarkupValue || 0) > 0);
  const authSnapHasProductMarkup = Number(authSnap?.pricing?.productLevelAgentMarkupTotal || 0) > 0;
  const authSnapItemMarkupsMatch = itemsHaveProductMarkup === authSnapHasProductMarkup;
  const quotePromoSigForAuth = quote.appliedPromotion
    ? `${quote.appliedPromotion.promotionId}:${quote.appliedPromotion.code}:${quote.appliedPromotion.discountValue}:${quote.appliedPromotion.discountAmount ?? ''}`
    : '';
  const authSnapPromoSig = authSnap?.pricing?.appliedPromotion
    ? `${authSnap.pricing.appliedPromotion.promotionId}:${authSnap.pricing.appliedPromotion.code}:${authSnap.pricing.appliedPromotion.discountValue}:${authSnap.pricing.appliedPromotion.discountAmount ?? ''}`
    : '';
  const authSnapPromoMatches = quotePromoSigForAuth === authSnapPromoSig;

  const useAuthSnapPricing = Boolean(
    authSnap &&
    authSnap.pricing &&
    authSnap.pricing.currency === effectiveCurrency &&
    (!activeOption?.id || !authSnap.selectedOptionId || authSnap.selectedOptionId === activeOption.id) &&
    (
      (isWorkingQuoteLocked && authSnapVersionMatches && authSnapAdminMatches && authSnapOverridesMatch && authSnapPromoMatches) ||
      (
        !isWorkingQuoteLocked &&
        authSnapVersionMatches &&
        authSnap.itinerary.itemsCount === items.length &&
        (authSnap.pricing.agentMarginType || 'PERCENTAGE') === effectiveAgentMarginType &&
        Math.abs(Number(authSnap.pricing.agentMarginValue || 0) - effectiveAgentMarginVal) < 0.0001 &&
        Math.abs(Number(authSnap.pricing.overallDiscountPercent || 0) - effectiveDiscountPct) < 0.0001 &&
        authSnapAdminMatches &&
        authSnapAgencyMatches &&
        authSnapOverridesMatch &&
        authSnapItemMarkupsMatch &&
        authSnapPromoMatches
      )
    )
  );

  const centralTotals = calculateQuoteTotal(quote, activeOption?.id, undefined, effectiveCurrency);

  const rawAuthHotelTotal = authSnap?.pricing?.hotelAccommodationTotal;
  const rawAuthLandTotal = authSnap?.pricing?.landPartTotal;

  const isHotelPartTotalAuthoritative = useAuthSnapPricing
    ? (isLandOnlyQuote || (typeof rawAuthHotelTotal === 'number' && Number.isFinite(rawAuthHotelTotal) && rawAuthHotelTotal >= 0))
    : (isLandOnlyQuote || (typeof centralTotals.hotelTotalSellingPrice === 'number' && Number.isFinite(centralTotals.hotelTotalSellingPrice) && centralTotals.hotelTotalSellingPrice >= 0));

  const isLandPartTotalAuthoritative = useAuthSnapPricing
    ? (typeof rawAuthLandTotal === 'number' && Number.isFinite(rawAuthLandTotal) && rawAuthLandTotal >= 0)
    : (typeof centralTotals.landPartTotalSellingPrice === 'number' && Number.isFinite(centralTotals.landPartTotalSellingPrice) && centralTotals.landPartTotalSellingPrice >= 0);

  let hotelAccommodationTotalNumeric = useAuthSnapPricing
    ? roundCurrencyAmount(isLandOnlyQuote ? 0 : (isHotelPartTotalAuthoritative ? Number(rawAuthHotelTotal) : 0), effectiveCurrency)
    : centralTotals.hotelTotalSellingPrice;
  let landPartTotalNumeric = useAuthSnapPricing
    ? roundCurrencyAmount(isLandPartTotalAuthoritative ? Number(rawAuthLandTotal) : 0, effectiveCurrency)
    : centralTotals.landPartTotalSellingPrice;
  const hotelItemsCount = centralTotals.hotelItemsIncludedCount;
  const landItemsCount = centralTotals.landItemsIncludedCount;

  // Fallback to pre-calculated quote / activeOption fields only if no items exist
  if (!useAuthSnapPricing && !isLandOnlyQuote && hotelAccommodationTotalNumeric === 0 && hotelItemsCount === 0) {
    if (typeof (activeOption as any)?.hotelAccommodationTotal === 'number' && (activeOption as any).hotelAccommodationTotal > 0) {
      hotelAccommodationTotalNumeric = (activeOption as any).hotelAccommodationTotal;
    } else if (typeof (quote as any).hotelAccommodationTotal === 'number' && (quote as any).hotelAccommodationTotal > 0) {
      hotelAccommodationTotalNumeric = (quote as any).hotelAccommodationTotal;
    } else if (typeof (quote as any).hotelTotalSelling === 'number' && (quote as any).hotelTotalSelling > 0) {
      hotelAccommodationTotalNumeric = (quote as any).hotelTotalSelling;
    }
  }

  const hasHotelAccommodation = !isLandOnlyQuote && hotelAccommodationTotalNumeric > 0 && (hotelItemsCount > 0 || hotels.length > 0);
  const hotelAccommodationTotalFormatted = hasHotelAccommodation
    ? formatCurrency(hotelAccommodationTotalNumeric, effectiveCurrency)
    : undefined;
  const hotelPartTotalFormatted = isHotelPartTotalAuthoritative
    ? formatCurrency(hotelAccommodationTotalNumeric, effectiveCurrency)
    : undefined;

  // Critical Rule: Land Part Total strictly excludes all hotel accommodation charges
  const hasLandServices = landPartTotalNumeric > 0 || landItemsCount > 0;
  const landPartTotalFormatted = isLandPartTotalAuthoritative
    ? formatCurrency(landPartTotalNumeric, effectiveCurrency)
    : formatCurrency(0, effectiveCurrency);

  // Authoritative Final Customer Selling Price (Hotel Accommodation Total + Land Part Total)
  const finalCustomerSellingPriceNumeric = roundCurrencyAmount(
    useAuthSnapPricing
      ? (isLandOnlyQuote ? landPartTotalNumeric : authSnap!.pricing.finalCustomerSellingPrice)
      : (centralTotals.finalCustomerSellingPrice > 0
          ? centralTotals.finalCustomerSellingPrice
          : ((hasHotelAccommodation ? hotelAccommodationTotalNumeric : 0) + landPartTotalNumeric)),
    effectiveCurrency
  );
  const finalCustomerSellingPriceFormatted = formatCurrency(finalCustomerSellingPriceNumeric, effectiveCurrency);
  const baseSellingPriceNumeric = roundCurrencyAmount(
    useAuthSnapPricing
      ? (authSnap!.pricing.theUnboundBaseSellingPrice || authSnap!.pricing.baseFinalSellingPrice || finalCustomerSellingPriceNumeric)
      : (centralTotals.theUnboundBaseSellingPrice > 0
          ? centralTotals.theUnboundBaseSellingPrice
          : finalCustomerSellingPriceNumeric),
    effectiveCurrency
  );
  const baseSellingPriceFormatted = formatCurrency(baseSellingPriceNumeric, effectiveCurrency);
  const agentMarginAmountNumeric = roundCurrencyAmount(
    useAuthSnapPricing ? (authSnap!.pricing.agentMarginAmount || 0) : (centralTotals.markupAmount || 0),
    effectiveCurrency
  );
  const agentMarginAmountFormatted = formatCurrency(agentMarginAmountNumeric, effectiveCurrency);

  const surchargesTotalNumeric = roundCurrencyAmount(
    useAuthSnapPricing
      ? (authSnap!.pricing.surchargesTotal || 0)
      : (quote.surchargesTotal ?? quote.pricingSnapshot?.surchargesTotal ?? quote.currencyConversionSnapshot?.surchargesTotal ?? 0),
    effectiveCurrency
  );
  const surchargesTotalFormatted = formatCurrency(surchargesTotalNumeric, effectiveCurrency);
  const appliedSurchargesCount = useAuthSnapPricing
    ? (authSnap!.pricing.appliedSurcharges?.length || 0)
    : ((quote.appliedSurcharges || quote.pricingSnapshot?.appliedSurcharges || quote.currencyConversionSnapshot?.appliedSurcharges || []).length);
  const taxesTotalNumeric = roundCurrencyAmount(
    useAuthSnapPricing
      ? (authSnap!.pricing.taxesTotal || 0)
      : (quote.pricingSnapshot?.taxesTotal ?? quote.currencyConversionSnapshot?.totals?.taxesTotal ?? quote.totalTaxes ?? 0),
    effectiveCurrency
  );
  const serviceFeesTotalNumeric = roundCurrencyAmount(
    useAuthSnapPricing
      ? (authSnap!.pricing.serviceFeesTotal || 0)
      : (quote.pricingSnapshot?.serviceFeesTotal ?? quote.currencyConversionSnapshot?.totals?.serviceFeesTotal ?? 0),
    effectiveCurrency
  );
  const discountsTotalNumeric = roundCurrencyAmount(
    useAuthSnapPricing
      ? (authSnap!.pricing.discountsTotal || 0)
      : (centralTotals.discountAmount || 0),
    effectiveCurrency
  );

  const rawAppliedPromo = useAuthSnapPricing
    ? (authSnap!.pricing.appliedPromotion || quote.appliedPromotion || null)
    : ((centralTotals as any).appliedPromotion || quote.appliedPromotion || null);
  const promotionDiscountAmountNumeric = roundCurrencyAmount(
    rawAppliedPromo
      ? (useAuthSnapPricing
          ? (authSnap!.pricing.promotionDiscountAmount ?? rawAppliedPromo.discountAmount ?? 0)
          : ((centralTotals as any).promotionDiscountAmount ?? rawAppliedPromo.discountAmount ?? 0))
      : 0,
    effectiveCurrency
  );
  const promotionDiscountAmountFormatted =
    rawAppliedPromo && promotionDiscountAmountNumeric > 0
      ? formatCurrency(promotionDiscountAmountNumeric, effectiveCurrency)
      : undefined;
  const appliedPromotionView =
    rawAppliedPromo && promotionDiscountAmountNumeric > 0
      ? {
          promotionId: rawAppliedPromo.promotionId,
          code: rawAppliedPromo.code || rawAppliedPromo.normalizedCode,
          promotionName: rawAppliedPromo.promotionName,
          discountType: rawAppliedPromo.discountType,
          discountValue: rawAppliedPromo.discountValue,
          discountAmountNumeric: promotionDiscountAmountNumeric,
          discountAmountFormatted: formatCurrency(promotionDiscountAmountNumeric, effectiveCurrency),
          label: `${rawAppliedPromo.promotionName} (${rawAppliedPromo.code || rawAppliedPromo.normalizedCode})`
        }
      : null;

  // Authoritative total selling price across all channels
  const effectiveSellingPrice = finalCustomerSellingPriceNumeric;
  const pricePerPerson = roundCurrencyAmount(effectiveSellingPrice / Math.max(1, effectivePax), effectiveCurrency);

  const paxDetailsText = quote.passengerBreakdown
    ? `ADT: ${quote.passengerBreakdown.adults}${quote.passengerBreakdown.cwb > 0 ? ` | CWB: ${quote.passengerBreakdown.cwb}` : ''}${quote.passengerBreakdown.cnb > 0 ? ` | CNB: ${quote.passengerBreakdown.cnb}` : ''}${quote.passengerBreakdown.infants > 0 ? ` | INF: ${quote.passengerBreakdown.infants}` : ''}`
    : `${effectivePax} Guests (${adultsDisplay} Adults${childrenDisplay ? `, ${childrenDisplay} Children` : ''}${infantsDisplay ? `, ${infantsDisplay} Infants` : ''})`;

  const dateSpanText = (quote.travelStartDate && quote.travelEndDate)
    ? `${quote.travelStartDate} → ${quote.travelEndDate}`
    : (calDays.length > 0 ? `${calDays[0].dateString} → ${calDays[calDays.length - 1].dateString}` : undefined);

  const operationalStandards: OperationalStandardCard[] = [
    {
      title: '🚗 Private Chauffeur Fleet',
      desc: 'Pristine air-conditioned vehicles with commercial licensed drivers and door-to-door luggage handling.',
      icon: 'Car'
    },
    {
      title: '⛩️ Licensed Local Guides',
      desc: 'Government-certified bilingual specialists delivering insightful cultural and historical immersion.',
      icon: 'Award'
    },
    {
      title: '🏨 Confirmed Allocations',
      desc: 'Direct supplier contracted allotments with daily breakfast and verified luxury standards.',
      icon: 'Building2'
    },
    {
      title: '🛡️ 24/7 Operations Desk',
      desc: 'Live flight tracking, real-time dispatch monitoring, and 24/7 emergency WhatsApp concierge support.',
      icon: 'ShieldCheck'
    }
  ];

  const childAndAttractionPolicies = [
    'Infant below 2 years is considered free of charge unless specifically charged by ground supplier or airline.',
    'Children aged 2 to below 5 years are classified as CNB (Child No Bed). Hotel breakfast & service surcharges apply as per tariff.',
    'Children aged 5 to below 11 years are classified as CWB (Child With Bed). Extra bed is included in the room allotment.',
    'Guests aged 11 years and above are classified as Adults.',
    'Important: If a guest is required to purchase an attraction ticket directly due to age, height, or attraction-specific eligibility rules, the ticket cost will be borne directly by the guest at the gate.'
  ];

  const formatValidUntil = (val?: string) => {
    if (!quote.isLocked || !val || val.toLowerCase().includes('14 day') || val.toLowerCase().includes('14 calendar day')) {
      return 'Subject to Availability at Booking';
    }
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return val;
  };

  const formatCreatedDate = (val?: string) => {
    if (!val) return new Date().toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
    }
    return val;
  };

  const resolvedSubtitle = isWhiteLabel
    ? (effectiveTagline && !isTheUnboundBrandString(effectiveTagline)
        ? effectiveTagline
        : [
            'Official Travel Proposal & Bespoke Itinerary',
            effectiveAgencyWebsite,
            effectiveAgencyAddress
          ].filter(Boolean).join(' • '))
    : (effectiveAgency && !isTheUnboundBrandString(effectiveAgency)
        ? 'Authorized Travel Partner • In Association with TheUnbound Luxury DMC Network'
        : 'Destination Management Operations • Direct Ground Logistics & Destination Operations Hub');

  const termsSourceQuote: Quotation = (authSnap?.commercialTerms?.snapshot || authSnap?.commercialTerms?.plainText)
    ? {
        ...quote,
        commercialTermsSnapshot: quote.commercialTermsSnapshot || authSnap.commercialTerms.snapshot,
        termsAndConditions: quote.termsAndConditions || authSnap.commercialTerms.plainText
      }
    : quote;

  const resolvedTermsObj = resolveAuthoritativeCommercialTerms(termsSourceQuote);
  const shouldSanitizeTermsWhiteLabel =
    isWhiteLabel && (resolvedTermsObj.isCustomHistoricalSnapshot || resolvedTermsObj.isDestinationWiseSnapshot);
  const resolvedCommercialTerms = shouldSanitizeTermsWhiteLabel
    ? sanitizeWhiteLabelString(resolvedTermsObj.plainText, effectiveAgency, effectiveAgentEmail, effectiveAgentPhone)
    : resolvedTermsObj.plainText;
  const resolvedCommercialTermsHtml = shouldSanitizeTermsWhiteLabel
    ? sanitizeWhiteLabelString(resolvedTermsObj.htmlText, effectiveAgency, effectiveAgentEmail, effectiveAgentPhone)
    : resolvedTermsObj.htmlText;
  const resolvedCommercialTermsWhatsApp = shouldSanitizeTermsWhiteLabel
    ? sanitizeWhiteLabelString(resolvedTermsObj.whatsAppText, effectiveAgency, effectiveAgentEmail, effectiveAgentPhone)
    : resolvedTermsObj.whatsAppText;

  const customFooterText = agentOverride?.footerText || snap?.footerText;
  const resolvedFooterContactLine = isWhiteLabel
    ? (customFooterText && !isTheUnboundBrandString(customFooterText)
        ? customFooterText
        : [
            effectiveAgency,
            effectiveAgentEmail,
            effectiveAgentPhone,
            effectiveAgencyWebsite,
            effectiveAgencyAddress,
            'Official Contracted Quotation Document'
          ].filter(Boolean).join(' • '))
    : `TheUnbound DMC Global Ground Logistics • Reg: ${effectiveAgencyRegisteredAddress || THEUNBOUND_REGISTERED_ADDRESS} • Current: ${effectiveAgencyCurrentAddress || THEUNBOUND_CURRENT_ADDRESS.replace(/\r?\n/g, ', ')} • ${centralProfile.salesEmail || 'sales@theunbound.in'} • Official Contracted Quotation Document`;

  const resolvedInclusions = (authSnap?.itinerary?.inclusions && authSnap.itinerary.inclusions.length > 0)
    ? authSnap.itinerary.inclusions
    : (Array.isArray(quote.inclusions) ? quote.inclusions.filter(Boolean) : []);
  const resolvedExclusions = (authSnap?.itinerary?.exclusions && authSnap.itinerary.exclusions.length > 0)
    ? authSnap.itinerary.exclusions
    : (Array.isArray(quote.exclusions) ? quote.exclusions.filter(Boolean) : []);
  const rawImportantInfo = authSnap?.itinerary?.importantInformation ?? quote.importantInformation;
  const rawCancellationPolicy = authSnap?.itinerary?.cancellationPolicy ?? quote.cancellationPolicy;
  const resolvedImportantInfo = isWhiteLabel && rawImportantInfo
    ? sanitizeWhiteLabelString(rawImportantInfo, effectiveAgency, effectiveAgentEmail, effectiveAgentPhone)
    : rawImportantInfo;
  const resolvedCancellationPolicy = isWhiteLabel && rawCancellationPolicy
    ? sanitizeWhiteLabelString(rawCancellationPolicy, effectiveAgency, effectiveAgentEmail, effectiveAgentPhone)
    : rawCancellationPolicy;

  const resolvedTitle =
    authSnap?.trip?.title ||
    quote.title ||
    quote.sourcePackageName ||
    `${quote.destination || 'Japan'} Bespoke Travel Itinerary`;

  return {
    quoteId: quote.id || quote.quoteNumber || 'UBQ-2026',
    quoteNumber: quote.quoteNumber || quote.id || 'UBQ-2026',
    version: authSnap?.versionNumber || quote.version || 1,
    status: authSnap?.status || quote.status || 'DRAFT',
    title: isWhiteLabel
      ? sanitizeWhiteLabelString(resolvedTitle, effectiveAgency, effectiveAgentEmail, effectiveAgentPhone)
      : resolvedTitle,
    sourcePackageId: authSnap?.sourcePackageId ?? quote.sourcePackageId,
    sourcePackageName: authSnap?.sourcePackageName ?? quote.sourcePackageName,
    quotationScope: effectiveScope,
    selectedOptionId: activeOption?.id || authSnap?.selectedOptionId || quote.activeOptionId,
    snapshotHash: quote.snapshotHash || authSnap?.snapshotHash,
    authoritativeSnapshotId: authSnap?.snapshotId,
    createdDateFormatted: formatCreatedDate(authSnap?.createdAt || quote.createdAt),
    validUntilFormatted: formatValidUntil(quote.validUntil),
    currency: effectiveCurrency,
    totalSellingPriceNumeric: effectiveSellingPrice,
    finalCustomerSellingPriceNumeric,
    finalCustomerSellingPriceFormatted,
    baseSellingPriceNumeric,
    baseSellingPriceFormatted,
    agentMarginAmountNumeric,
    agentMarginAmountFormatted,
    surchargesTotalNumeric,
    surchargesTotalFormatted,
    appliedSurchargesCount,
    taxesTotalNumeric,
    serviceFeesTotalNumeric,
    discountsTotalNumeric,
    promotionDiscountAmountNumeric,
    promotionDiscountAmountFormatted,
    appliedPromotion: appliedPromotionView,
    brandingMode: effectiveBrandingMode,
    isWhiteLabel,
    agencyName: effectiveAgency,
    agentName: effectiveAgentName,
    agentEmail: effectiveAgentEmail,
    agentPhone: effectiveAgentPhone,
    agentLogoUrl: effectiveAgentLogoUrl,
    agencyAddress: effectiveAgencyAddress,
    agencyRegisteredAddress: effectiveAgencyRegisteredAddress,
    agencyCurrentAddress: effectiveAgencyCurrentAddress,
    agencyWebsite: effectiveAgencyWebsite,
    brandPrimaryColor: effectivePrimaryColor,
    brandAccentColor: effectiveAccentColor,
    agentAgencySubtitle: resolvedSubtitle,
    documentBadgeTitle: isWhiteLabel ? 'Official Travel Proposal' : 'Official Quotation Proposal',
    operationalStandardsTitle: isWhiteLabel
      ? `${effectiveAgency} Service Standards & Ground Inclusions`
      : 'TheUnbound Ground Operations Standards & Inclusions',
    footerRightTitle: isWhiteLabel
      ? `Issued by ${effectiveAgency}`
      : 'Official DMC Electronic Proposal',
    agentNotes: effectiveAgentNotes,
    clientName: quote.clientName && quote.clientName !== 'Client Name Pending' ? quote.clientName : (quote.clientName || 'Valued Guest'),
    clientCompany: quote.clientCompany,
    clientEmail: quote.clientEmail,
    clientPhone: quote.clientPhone,
    destination: quote.destination || 'Japan',
    totalDays: days.length,
    totalNights,
    effectivePax,
    adultsCount: adultsDisplay,
    childrenCount: childrenDisplay,
    infantsCount: infantsDisplay,
    paxDetailsText,
    nationality: quote.nationality,
    travelStyle: quote.travelStyle,
    dateSpanText,
    travelStartDate: quote.travelStartDate,
    travelEndDate: quote.travelEndDate,
    selectedOptionTitle: selectedOptionTitle || authSnap?.selectedOptionTitle,
    selectedOptionNumber,
    pricePerPersonFormatted: formatCurrency(pricePerPerson, effectiveCurrency),
    routeHubs: sortedHubs.map(h => ({ hubName: h.hubName || h.destinationName || quote.destination || 'Hub', nights: h.nights || 1 })),
    hotels,
    accommodations,
    hasHotelAccommodation,
    hotelAccommodationTotalNumeric,
    hotelAccommodationTotalFormatted,
    hotelPartTotalFormatted,
    isHotelPartTotalAuthoritative,
    hotelItemsCount,
    hasLandServices,
    landPartTotalNumeric,
    landPartTotalFormatted,
    isLandPartTotalAuthoritative,
    landItemsCount,
    visaServices: visaItems.map(it => transformQuoteItemToPresentation(it, effectiveCurrency)),
    days,
    itineraryOverview: authSnap?.itinerary?.itineraryOverview || quote.itineraryOverview || (quote as any).narrative || undefined,
    narrative: authSnap?.itinerary?.itineraryOverview || quote.itineraryOverview || (quote as any).narrative || undefined,
    additionalServices: generalInclusions,
    inclusions: resolvedInclusions,
    exclusions: resolvedExclusions,
    importantInformation: resolvedImportantInfo,
    cancellationPolicy: resolvedCancellationPolicy,
    operationalStandards,
    totalItineraryValueFormatted: finalCustomerSellingPriceFormatted,
    pricePerTravelerFormatted: `${formatCurrency(pricePerPerson, effectiveCurrency)} / Traveler (${effectivePax} Guests)`,
    guaranteedCurrencyLine: `Guaranteed in ${effectiveCurrency} • No Hidden Surcharges`,
    childAndAttractionPolicies,
    commercialTermsHeading: resolvedTermsObj.heading,
    commercialTermsItems: resolvedTermsObj.items,
    commercialTerms: resolvedCommercialTerms,
    commercialTermsHtml: resolvedCommercialTermsHtml,
    commercialTermsWhatsApp: resolvedCommercialTermsWhatsApp,
    isCustomHistoricalCommercialTerms: resolvedTermsObj.isCustomHistoricalSnapshot,
    isDestinationWiseCommercialTerms: resolvedTermsObj.isDestinationWiseSnapshot,
    commercialTermsSnapshot: termsSourceQuote.commercialTermsSnapshot,
    footerContactLine: resolvedFooterContactLine,
    customFooterText: customFooterText && !isTheUnboundBrandString(customFooterText) ? customFooterText : undefined
  };
}

// ============================================================================
// CANONICAL CHANNEL RENDERER 1: COMPLETE EMAIL RENDERER (HTML + PLAIN TEXT)
// ============================================================================

export function renderQuoteEmailFromPresentationModel(
  model: QuotePresentationModel,
  customNote?: string,
  mode: 'PROPOSAL_VIEW' | 'PLAIN_TEXT' = 'PROPOSAL_VIEW'
): {
  subject: string;
  htmlBody: string;
  textBody: string;
  proposalViewHtml: string;
  simpleSemanticHtml: string;
} {
  const subjectPrefix = model.isWhiteLabel ? `${model.agencyName} — ` : '';
  const subject = `${subjectPrefix}Bespoke Itinerary & Quotation Proposal [${model.quoteNumber} v${model.version}] — ${model.destination} (${model.totalDays} Days / ${model.totalNights} Nights) — ${model.clientName}`;

  const routeString = model.routeHubs.length > 0
    ? model.routeHubs.map(h => `${h.hubName} (${h.nights} ${h.nights === 1 ? 'Night' : 'Nights'})`).join(' → ')
    : model.destination;

  // 1. Build Complete Plain-Text Representation (mirrors 100% of Quote Preview)
  const textSections: string[] = [];

  textSections.push([
    `${model.agencyName.toUpperCase()} — OFFICIAL ITINERARY & QUOTATION PROPOSAL`,
    model.agentAgencySubtitle,
    ``,
    `Quote Reference : ${model.quoteNumber} (v${model.version})`,
    `Quote ID        : ${model.quoteId}`,
    `Status          : ${model.status}`,
    `Issue Date      : ${model.createdDateFormatted}`,
    `Valid Until     : ${model.validUntilFormatted}`,
    model.selectedOptionTitle ? `Selected Option : ${model.selectedOptionTitle}` : ''
  ].filter(Boolean).join('\n'));

  if (customNote && customNote.trim()) {
    const cleanNote = model.isWhiteLabel
      ? sanitizeWhiteLabelString(customNote.trim(), model.agencyName, model.agentEmail, model.agentPhone)
      : customNote.trim();
    textSections.push([
      `PERSONAL NOTE FROM ${model.agentName.toUpperCase()}:`,
      cleanNote
    ].join('\n'));
  }

  textSections.push([
    `1. CURATED JOURNEY OVERVIEW`,
    `Itinerary       : ${model.destination} Bespoke Travel Itinerary`,
    `Destination     : ${model.destination}`,
    `Route & Hubs    : ${routeString}`,
    `Duration        : ${model.totalDays} Days / ${model.totalNights} Nights`,
    `Travel Dates    : ${model.dateSpanText || 'Flexible Dates'}`,
    `Passengers      : ${model.paxDetailsText}`,
    model.nationality ? `Nationality     : ${model.nationality}` : '',
    model.travelStyle ? `Travel Style    : ${model.travelStyle}` : '',
    ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
      `Hotel Accommodation Total : ${model.hotelAccommodationTotalFormatted}`
    ] : []),
    `Land Part Total : ${model.landPartTotalFormatted}`
  ].filter(Boolean).join('\n'));

  if (model.itineraryOverview) {
    textSections.push([
      `JOURNEY NARRATIVE & OVERVIEW:`,
      richTextToPlainText(model.itineraryOverview)
    ].join('\n'));
  }

  textSections.push([
    `2. CLIENT & SPECIALIST DOSSIER`,
    `Prepared For (Client):`,
    `  Name          : ${model.clientName}`,
    model.clientCompany ? `  Company       : ${model.clientCompany}` : '',
    model.clientEmail ? `  Email         : ${model.clientEmail}` : '',
    model.clientPhone ? `  Phone         : ${model.clientPhone}` : '',
    ``,
    `Prepared By (Specialist):`,
    `  Specialist    : ${model.agentName}`,
    `  Agency        : ${model.agencyName}`,
    model.agentEmail ? `  Email         : ${model.agentEmail}` : '',
    model.agentPhone ? `  Phone         : ${model.agentPhone}` : '',
    model.agencyWebsite ? `  Website       : ${model.agencyWebsite}` : '',
    model.agencyAddress ? `  Address       : ${model.agencyAddress}` : '',
    model.agentNotes ? `  Agent Notes   : ${model.agentNotes}` : ''
  ].filter(Boolean).join('\n'));

  if (model.accommodations && model.accommodations.length > 0) {
    const accommodationLines = [
      `3. ACCOMMODATION & HOTEL STAYS (${model.accommodations.length} ${model.accommodations.length === 1 ? 'STAY' : 'STAYS'})`
    ];
    model.accommodations.forEach((acc, idx) => {
      accommodationLines.push(
        `[${idx + 1}] ${acc.hotelName} (${acc.city})`,
        `    Stay Dates  : ${acc.checkInDate || 'TBD'} → ${acc.checkOutDate || 'TBD'} (${acc.nights} ${acc.nights === 1 ? 'Night' : 'Nights'})`,
        acc.roomSummary ? `    Room Config : ${acc.roomSummary}` : ''
      );
    });
    textSections.push(accommodationLines.filter(Boolean).join('\n'));
  } else if (model.hotels.length > 0) {
    const hotelLines = [
      `3. CURATED ACCOMMODATION SUMMARY (${model.hotels.length} ${model.hotels.length === 1 ? 'STAY' : 'STAYS'})`
    ];
    model.hotels.forEach((h, idx) => {
      hotelLines.push(
        `[${idx + 1}] ${h.hotelName} (${h.cityHub}${h.starRating ? ` • ${h.starRating}` : ''})`,
        `    Stay Dates  : ${h.checkInDate} → ${h.checkOutDate} (${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'})`,
        `    Room & Meal : ${h.roomsCount} × ${h.roomType} | ${h.mealPlan} | Occupancy: ${h.occupancy}`,
        h.overview ? `    Overview    : ${convertHtmlToCleanPlainText(h.overview)}` : '',
        h.inclusions.length > 0 ? `    Inclusions  : ${h.inclusions.join(' | ')}` : '',
        h.exclusions.length > 0 ? `    Exclusions  : ${h.exclusions.join(' | ')}` : '',
        h.notes ? `    Stay Notes  : ${convertHtmlToCleanPlainText(h.notes)}` : ''
      );
    });
    textSections.push(hotelLines.filter(Boolean).join('\n'));
  }

  if (model.visaServices.length > 0) {
    const visaLines = [
      `4. VISA & ANCILLARY SERVICES (${model.visaServices.length} INCLUDED)`
    ];
    model.visaServices.forEach((v, idx) => {
      visaLines.push(
        `[${idx + 1}] ${v.listingName} (${v.categoryLabel}) [${v.paxText}] • Included`,
        v.duration ? `    Duration        : ${v.duration}` : '',
        v.configurationSummary ? `    Specifications  : ${v.configurationSummary}` : '',
        v.overview ? `    Overview        : ${convertHtmlToCleanPlainText(v.overview)}` : '',
        v.inclusions.length > 0 ? `    Inclusions      : ${v.inclusions.map(i => `✓ ${i}`).join(' | ')}` : '',
        v.exclusions.length > 0 ? `    Exclusions      : ${v.exclusions.map(e => `✕ ${e}`).join(' | ')}` : '',
        v.specialInstructions ? `    Special Notes   : ${convertHtmlToCleanPlainText(v.specialInstructions)}` : ''
      );
    });
    textSections.push(visaLines.filter(Boolean).join('\n'));
  }

  const daySectionLines: string[] = [
    `5. DAY-BY-DAY CHRONOLOGICAL ITINERARY (${model.days.length} DAYS)`
  ];

  model.days.forEach(day => {
    const transitionBadge = day.isTransitionDay && day.prevHubName ? ` [Transfer: ${day.prevHubName} → ${day.hubName}]` : '';
    const themeText = day.customTheme ? ` • ${day.customTheme}` : '';
    daySectionLines.push(
      ``,
      `DAY ${String(day.dayNumber).padStart(2, '0')}: ${day.dayOfWeek}, ${day.formattedDate} — ${day.hubName} Base${transitionBadge}${themeText}`
    );

    if (day.dayOverview) {
      daySectionLines.push(`Day ${day.dayNumber} Overview: ${convertHtmlToCleanPlainText(day.dayOverview)}`);
    }

    if (day.services.length === 0) {
      daySectionLines.push(
        `  • Day at Leisure in ${day.hubName} (Self-Paced)`,
        `    Free time for personal exploration, neighborhood shopping, and local dining discoveries.`
      );
    } else {
      day.services.forEach((s, sIdx) => {
        daySectionLines.push(
          `  [${sIdx + 1}] ${s.listingName} (${s.categoryLabel})`,
          `      Allotment Status : ${s.statusText} (${s.paxText})`,
          (s.duration || s.serviceTime) ? `      Schedule       : ${[s.duration ? `Duration: ${s.duration}` : '', s.serviceTime ? `Time: ${s.serviceTime}` : ''].filter(Boolean).join(' • ')}` : '',
          s.configurationSummary ? `      Specifications : ${s.configurationSummary}` : '',
          s.meetingPoint ? `      Meeting Point  : ${s.meetingPoint}` : '',
          s.pickupPoint ? `      Pickup Point   : ${s.pickupPoint}` : '',
          s.dropoffPoint ? `      Drop-off Point : ${s.dropoffPoint}` : '',
          (s.isRail && s.railDetails) ? `      Bullet Train   : ${s.railDetails.origin} → ${s.railDetails.destination} | ${s.railDetails.carType} (${s.railDetails.seatType}) | ${s.railDetails.serviceGroup}${s.railDetails.seatPreference ? ` | Seat: ${s.railDetails.seatPreference}` : ''}${s.railDetails.pnrReference ? ` | PNR: ${s.railDetails.pnrReference}` : ''}` : '',
          s.overview ? `      Overview       : ${convertHtmlToCleanPlainText(s.overview)}` : '',
          s.inclusions.length > 0 ? `      Inclusions     : ${s.inclusions.map(i => `✓ ${i}`).join(' | ')}` : '',
          s.exclusions.length > 0 ? `      Exclusions     : ${s.exclusions.map(e => `✕ ${e}`).join(' | ')}` : '',
          s.specialInstructions ? `      Instructions   : ${convertHtmlToCleanPlainText(s.specialInstructions)}` : ''
        );
      });
    }

    if (day.dayNotes) {
      daySectionLines.push(`  Day ${day.dayNumber} Operational Notes: ${convertHtmlToCleanPlainText(day.dayNotes)}`);
    }
  });

  textSections.push(daySectionLines.filter(Boolean).join('\n'));

  if (model.additionalServices.length > 0) {
    const addLines = [
      `6. ADDITIONAL PACKAGE SERVICES & PRIVILEGES`
    ];
    model.additionalServices.forEach((a, idx) => {
      addLines.push(
        `  [${idx + 1}] ${a.name} • Included`,
        `      Details    : ${a.summary}`,
        a.overview ? `      Overview   : ${convertHtmlToCleanPlainText(a.overview)}` : '',
        (a.inclusions && a.inclusions.length > 0) ? `      Inclusions : ${a.inclusions.join(' | ')}` : '',
        (a.exclusions && a.exclusions.length > 0) ? `      Exclusions : ${a.exclusions.join(' | ')}` : '',
        a.specialInstructions ? `      Notes      : ${convertHtmlToCleanPlainText(a.specialInstructions)}` : ''
      );
    });
    textSections.push(addLines.filter(Boolean).join('\n'));
  }

  textSections.push([
    `7. ${model.operationalStandardsTitle.toUpperCase()}`,
    ...model.operationalStandards.map(op => `  • ${op.title}: ${op.desc}`)
  ].join('\n'));

  textSections.push([
    `8. TOTAL PACKAGE INVESTMENT`,
    ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
      `Hotel Accommodation Total        : ${model.hotelAccommodationTotalFormatted}`
    ] : []),
    `Land Part Total                  : ${model.landPartTotalFormatted}`,
    ...(model.appliedPromotion ? [
      `Promotional Discount (${model.appliedPromotion.code}) : -${model.appliedPromotion.discountAmountFormatted} (${model.appliedPromotion.promotionName})`
    ] : []),
    `Final Selling Price              : ${model.finalCustomerSellingPriceFormatted}`,
    `Currency & Tax Guarantee         : ${model.guaranteedCurrencyLine}`,
    `Quotation Valid Until            : ${model.validUntilFormatted}`
  ].join('\n'));

  if (
    model.inclusions.length > 0 ||
    model.exclusions.length > 0 ||
    model.importantInformation ||
    model.cancellationPolicy
  ) {
    const pkgPolicyLines: string[] = [`8B. PACKAGE INCLUSIONS, EXCLUSIONS & POLICY NOTES`];
    if (model.inclusions.length > 0) {
      pkgPolicyLines.push(`Package Inclusions:`);
      model.inclusions.forEach((inc) => pkgPolicyLines.push(`  ✓ ${inc}`));
    }
    if (model.exclusions.length > 0) {
      pkgPolicyLines.push(`Package Exclusions:`);
      model.exclusions.forEach((exc) => pkgPolicyLines.push(`  ✕ ${exc}`));
    }
    if (model.importantInformation) {
      pkgPolicyLines.push(`Important Information: ${convertHtmlToCleanPlainText(model.importantInformation)}`);
    }
    if (model.cancellationPolicy) {
      pkgPolicyLines.push(`Cancellation Policy: ${convertHtmlToCleanPlainText(model.cancellationPolicy)}`);
    }
    textSections.push(pkgPolicyLines.join('\n'));
  }

  textSections.push([
    `9. OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY`,
    ...model.childAndAttractionPolicies.map(p => `  • ${p}`)
  ].join('\n'));

  textSections.push([
    `10. ${(model.commercialTermsHeading || COMMERCIAL_QUOTATION_TERMS_HEADING).toUpperCase()}`,
    model.commercialTerms,
    ``,
    convertHtmlToCleanPlainText(model.footerContactLine)
  ].join('\n'));

  const rawTextBody = textSections.join('\n\n');
  const textBody = model.isWhiteLabel
    ? sanitizeWhiteLabelString(rawTextBody, model.agencyName, model.agentEmail, model.agentPhone)
    : rawTextBody;

  // Option 1: Proposal View Rich HTML Email (adapted for responsive email clients)
  const rawProposalViewHtml = renderProposalViewHtmlEmail(model, customNote);
  const proposalViewHtml = model.isWhiteLabel
    ? sanitizeWhiteLabelString(rawProposalViewHtml, model.agencyName, model.agentEmail, model.agentPhone)
    : rawProposalViewHtml;

  // Option 2: Complete Formatted Quotation (Excel-Style Tabular Quotation HTML)
  const rawSimpleSemanticHtml = renderOption2CompleteFormattedHtmlEmail(model, customNote);
  const simpleSemanticHtml = model.isWhiteLabel
    ? sanitizeWhiteLabelString(rawSimpleSemanticHtml, model.agencyName, model.agentEmail, model.agentPhone)
    : rawSimpleSemanticHtml;

  const htmlBody = mode === 'PLAIN_TEXT' ? simpleSemanticHtml : proposalViewHtml;

  return {
    subject: model.isWhiteLabel ? sanitizeWhiteLabelString(subject, model.agencyName, model.agentEmail, model.agentPhone) : subject,
    htmlBody,
    textBody,
    proposalViewHtml,
    simpleSemanticHtml
  };
}

// ============================================================================
// CANONICAL CHANNEL RENDERER 2: COMPLETE WHATSAPP RENDERER
// ============================================================================

export function renderQuoteWhatsAppFromPresentationModel(
  model: QuotePresentationModel,
  options?: {
    customNote?: string;
    useEmojis?: boolean;
    formatStyle?: 'DETAILED' | 'SUMMARY';
  }
): string {
  const useEmojis = options?.useEmojis !== false;
  const DIVIDER = useEmojis ? '━━━━━━━━━━━━━━━━━━━━━' : '------------------------';
  const sections: string[] = [];

  const routeString = model.routeHubs.length > 0
    ? model.routeHubs.map(h => `${h.hubName} (${h.nights}N)`).join(useEmojis ? ' ➔ ' : ' -> ')
    : model.destination;

  // 1. Header, Quote Reference, Client & Agent Details, Trip Overview
  const headerLines: string[] = [];
  if (useEmojis) {
    headerLines.push(
      `✨ *${model.agencyName.toUpperCase()} — OFFICIAL TRAVEL QUOTATION PROPOSAL* ✨`,
      `📋 *Quote Reference:* *#${model.quoteNumber}* (v${model.version})`,
      `🆔 *Quote ID:* ${model.quoteId} | *Status:* ${model.status}`,
      `📅 *Issued:* ${model.createdDateFormatted} | *Valid Until:* ${model.validUntilFormatted}`,
      ``,
      `👋 *Prepared For:* *${model.clientName}*`,
      model.clientCompany ? `🏢 *Client Organization:* ${model.clientCompany}` : '',
      model.clientEmail ? `✉️ *Client Email:* ${model.clientEmail}` : '',
      model.clientPhone ? `📞 *Client Phone:* ${model.clientPhone}` : '',
      ``,
      `🌍 *Destination:* *${model.destination.toUpperCase()}*`,
      `🗓️ *Duration:* ${model.totalDays} Days / ${model.totalNights} Nights`,
      `✈️ *Travel Dates:* ${model.dateSpanText || 'Flexible Dates'}`,
      `👥 *Passengers:* ${model.paxDetailsText}`,
      model.nationality ? `🛂 *Nationality:* ${model.nationality}` : '',
      model.travelStyle ? `💎 *Travel Style:* ${model.travelStyle}` : '',
      model.selectedOptionTitle ? `🌟 *Curated Option:* ${model.selectedOptionTitle}` : '',
      `🗺️ *Route & Hubs:* ${routeString}`
    );
  } else {
    headerLines.push(
      `*${model.agencyName.toUpperCase()} — OFFICIAL TRAVEL QUOTATION PROPOSAL*`,
      `Quote Reference: *#${model.quoteNumber}* (v${model.version})`,
      `Quote ID: ${model.quoteId} | Status: ${model.status}`,
      `Issued: ${model.createdDateFormatted} | Valid Until: ${model.validUntilFormatted}`,
      ``,
      `Prepared For: *${model.clientName}*`,
      model.clientCompany ? `Organization: ${model.clientCompany}` : '',
      model.clientEmail ? `Client Email: ${model.clientEmail}` : '',
      model.clientPhone ? `Client Phone: ${model.clientPhone}` : '',
      ``,
      `Destination: *${model.destination.toUpperCase()}*`,
      `Duration: ${model.totalDays} Days / ${model.totalNights} Nights`,
      `Travel Dates: ${model.dateSpanText || 'Flexible Dates'}`,
      `Passengers: ${model.paxDetailsText}`,
      model.nationality ? `Nationality: ${model.nationality}` : '',
      model.travelStyle ? `Travel Style: ${model.travelStyle}` : '',
      model.selectedOptionTitle ? `Selected Option: ${model.selectedOptionTitle}` : '',
      `Route & Hubs: ${routeString}`
    );
  }
  sections.push(headerLines.filter(l => l !== '').join('\n').replace(/\n\n+/g, '\n\n'));

  // 2. Curated Accommodation & Luxury Stays
  if (model.accommodations && model.accommodations.length > 0) {
    const accLines: string[] = [
      useEmojis ? `🏨 *ACCOMMODATION & STAYS (${model.accommodations.length})*` : `*ACCOMMODATION & STAYS (${model.accommodations.length})*`
    ];
    model.accommodations.forEach(acc => {
      const isNoAcc = acc.hotelName.includes('No Accommodation') || acc.isNoAccommodation;
      if (useEmojis) {
        accLines.push(
          `• 🏙️ *${acc.city.toUpperCase()}* — *${acc.nights}* ${acc.nights === 1 ? 'Night' : 'Nights'}\n  ${isNoAcc ? '🚫' : '⭐'} *${acc.hotelName}*${acc.roomSummary ? ` | ${acc.roomSummary}` : ''}${acc.checkInDate && acc.checkOutDate ? `\n  📅 ${acc.checkInDate} ➔ ${acc.checkOutDate}` : ''}`
        );
      } else {
        accLines.push(
          `• *${acc.city.toUpperCase()}* — ${acc.nights} ${acc.nights === 1 ? 'Night' : 'Nights'}\n  ${acc.hotelName}${acc.roomSummary ? ` | ${acc.roomSummary}` : ''}${acc.checkInDate && acc.checkOutDate ? `\n  Stay Dates: ${acc.checkInDate} to ${acc.checkOutDate}` : ''}`
        );
      }
    });
    sections.push(accLines.join('\n'));
  } else if (model.hotels.length > 0) {
    const hotelLines: string[] = [
      useEmojis ? `🏨 *CURATED ACCOMMODATION & LUXURY STAYS (${model.hotels.length})*` : `*ACCOMMODATION & STAYS (${model.hotels.length})*`
    ];
    model.hotels.forEach(h => {
      const hotelOverview = h.overview ? richTextToWhatsApp(h.overview) : '';
      const hotelNotes = h.notes ? richTextToWhatsApp(h.notes) : '';
      if (useEmojis) {
        const entry = [
          `• 🏙️ *${h.cityHub.toUpperCase()}* — *${h.nightsCount}* ${h.nightsCount === 1 ? 'Night' : 'Nights'}`,
          `  ⭐ *${h.hotelName}*${h.starRating ? ` (${h.starRating})` : ''}`,
          `  🛏️ *Room:* ${h.roomsCount} × ${h.roomType} | 🍳 *Meal Plan:* ${h.mealPlan}`,
          `  📅 *Stay Dates:* ${h.checkInDate} ➔ ${h.checkOutDate}`,
          hotelOverview ? `  📝 *Overview:* ${hotelOverview}` : '',
          h.inclusions.length > 0 ? `  ✅ *Inclusions:* ${h.inclusions.map(i => richTextToWhatsApp(i)).join(', ')}` : '',
          h.exclusions.length > 0 ? `  ❌ *Exclusions:* ${h.exclusions.map(e => richTextToWhatsApp(e)).join(', ')}` : '',
          hotelNotes ? `  💡 *Notes:* ${hotelNotes}` : ''
        ].filter(Boolean).join('\n');
        hotelLines.push(entry);
      } else {
        const entry = [
          `• *${h.cityHub.toUpperCase()}* — ${h.nightsCount} ${h.nightsCount === 1 ? 'Night' : 'Nights'}`,
          `  ${h.hotelName}${h.starRating ? ` (${h.starRating})` : ''} | ${h.roomsCount} × ${h.roomType} • ${h.mealPlan}`,
          `  Stay Dates: ${h.checkInDate} to ${h.checkOutDate}`,
          hotelOverview ? `  Overview: ${hotelOverview}` : '',
          h.inclusions.length > 0 ? `  Inclusions: ${h.inclusions.map(i => richTextToWhatsApp(i)).join(', ')}` : '',
          h.exclusions.length > 0 ? `  Exclusions: ${h.exclusions.map(e => richTextToWhatsApp(e)).join(', ')}` : '',
          hotelNotes ? `  Notes: ${hotelNotes}` : ''
        ].filter(Boolean).join('\n');
        hotelLines.push(entry);
      }
    });
    sections.push(hotelLines.join('\n'));
  }

  // 3. Visa & Ancillary Services
  if (model.visaServices.length > 0) {
    const visaLines: string[] = [
      useEmojis ? `🛂 *VISA & ANCILLARY SERVICES (${model.visaServices.length} INCLUDED)*` : `*VISA & ANCILLARY SERVICES (${model.visaServices.length} INCLUDED)*`
    ];
    model.visaServices.forEach(v => {
      const vOverview = v.overview ? richTextToWhatsApp(v.overview) : '';
      const vInstructions = v.specialInstructions ? richTextToWhatsApp(v.specialInstructions) : '';
      const lines = [
        useEmojis
          ? `• 📑 *${v.listingName}* [${v.categoryLabel}] • *Included* (${v.paxText})`
          : `• *${v.listingName}* [${v.categoryLabel}] • Included (${v.paxText})`,
        v.duration ? `  ⏱️ Duration: ${v.duration}` : '',
        v.configurationSummary ? `  ⚙️ Specs: ${v.configurationSummary}` : '',
        vOverview ? `  📖 Overview: ${vOverview}` : '',
        v.inclusions.length > 0 ? `  ✅ Inclusions: ${v.inclusions.map(i => richTextToWhatsApp(i)).join(', ')}` : '',
        v.exclusions.length > 0 ? `  ❌ Exclusions: ${v.exclusions.map(e => richTextToWhatsApp(e)).join(', ')}` : '',
        vInstructions ? `  💡 Notes: ${vInstructions}` : ''
      ].filter(Boolean);
      visaLines.push(lines.join('\n'));
    });
    sections.push(visaLines.join('\n'));
  }

  // 3.5 Journey Narrative & Overview
  if (model.itineraryOverview) {
    const narrativeText = richTextToWhatsApp(model.itineraryOverview);
    if (narrativeText) {
      const narrativeLines = [
        useEmojis ? `📖 *JOURNEY NARRATIVE & OVERVIEW*` : `*JOURNEY NARRATIVE & OVERVIEW*`,
        narrativeText
      ];
      sections.push(narrativeLines.join('\n'));
    }
  }

  // 4. Complete Day-by-Day Chronological Itinerary (Always included in full)
  if (model.days.length > 0) {
    const planLines: string[] = [
      useEmojis ? `🗺️ *DAY-BY-DAY CHRONOLOGICAL ITINERARY (${model.days.length} DAYS)*` : `*DAY-BY-DAY CHRONOLOGICAL ITINERARY (${model.days.length} DAYS)*`
    ];

    model.days.forEach(day => {
      const transitionStr = day.isTransitionDay && day.prevHubName ? ` [Transfer: ${day.prevHubName} ➔ ${day.hubName}]` : '';
      const themeStr = day.customTheme ? ` — ${day.customTheme}` : '';
      const dayHeader = useEmojis
        ? `📅 *DAY ${day.dayNumber} (${day.dayOfWeek}, ${day.formattedDate}): ${day.hubName} Base*${transitionStr}${themeStr}`
        : `*DAY ${day.dayNumber} (${day.dayOfWeek}, ${day.formattedDate}): ${day.hubName} Base*${transitionStr}${themeStr}`;

      const dayItems: string[] = [dayHeader];

      if (day.dayOverview) {
        dayItems.push(`  📝 *Day Overview:* ${richTextToWhatsApp(day.dayOverview)}`);
      }

      if (day.services.length === 0) {
        dayItems.push(
          useEmojis
            ? `  🧭 *Day at Leisure in ${day.hubName}* — Free time for personal exploration, shopping & local dining.`
            : `  • Day at Leisure in ${day.hubName} — Free time for personal exploration, shopping & local dining.`
        );
      } else {
        day.services.forEach(s => {
          const icon = s.isRail ? '🚅' : s.categoryLabel.includes('Accommodation') ? '🏨' : s.categoryLabel.includes('Transfer') ? '🚗' : '🎟️';
          const sLines: string[] = [
            useEmojis
              ? `  ${icon} *${s.listingName}* (${s.categoryLabel}) [${s.paxText}]`
              : `  • *${s.listingName}* (${s.categoryLabel}) [${s.paxText}]`
          ];

          if (s.duration || s.serviceTime) {
            const sched = [s.duration ? `Duration: ${s.duration}` : '', s.serviceTime ? `Time: ${s.serviceTime}` : ''].filter(Boolean).join(' | ');
            sLines.push(`     ⏱️ ${sched}`);
          }
          if (s.configurationSummary && !s.isRail) {
            sLines.push(`     ⚙️ Specs: ${s.configurationSummary}`);
          }
          if (s.meetingPoint) {
            sLines.push(`     📍 Meeting Point: ${s.meetingPoint}`);
          }
          if (s.pickupPoint) {
            sLines.push(`     🚗 Pickup: ${s.pickupPoint}`);
          }
          if (s.dropoffPoint) {
            sLines.push(`     🏁 Drop-off: ${s.dropoffPoint}`);
          }
          if (s.isRail && s.railDetails) {
            sLines.push(
              `     🚄 Bullet Train: ${s.railDetails.origin} ➔ ${s.railDetails.destination} • ${s.railDetails.carType} (${s.railDetails.seatType}) • ${s.railDetails.serviceGroup}${s.railDetails.seatPreference ? ` • Seat: ${s.railDetails.seatPreference}` : ''}${s.railDetails.pnrReference ? ` • PNR: ${s.railDetails.pnrReference}` : ''}`
            );
          }
          const sOverview = s.overview ? richTextToWhatsApp(s.overview) : '';
          if (sOverview) {
            sLines.push(`     📖 Overview: ${sOverview}`);
          }
          if (s.inclusions.length > 0) {
            sLines.push(`     ✅ Inclusions: ${s.inclusions.map(i => richTextToWhatsApp(i)).join(', ')}`);
          }
          if (s.exclusions.length > 0) {
            sLines.push(`     ❌ Exclusions: ${s.exclusions.map(e => richTextToWhatsApp(e)).join(', ')}`);
          }
          const sInstructions = s.specialInstructions ? richTextToWhatsApp(s.specialInstructions) : '';
          if (sInstructions) {
            sLines.push(`     💡 Instructions: ${sInstructions}`);
          }
          dayItems.push(sLines.join('\n'));
        });
      }

      if (day.dayNotes) {
        dayItems.push(`  📌 *Day ${day.dayNumber} Notes:* ${richTextToWhatsApp(day.dayNotes)}`);
      }

      dayItems.push(useEmojis ? `  🛌 *Overnight Hub:* ${day.hubName}` : `  • Overnight Hub: ${day.hubName}`);
      planLines.push(dayItems.join('\n'));
      planLines.push(useEmojis ? `┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈` : `------------------------`);
    });

    if (planLines[planLines.length - 1].startsWith('┈') || planLines[planLines.length - 1].startsWith('-')) {
      planLines.pop();
    }
    sections.push(planLines.join('\n'));
  }

  // 5. Additional Package Services & Privileges
  if (model.additionalServices.length > 0) {
    const addLines: string[] = [
      useEmojis ? `✨ *ADDITIONAL PACKAGE SERVICES & PRIVILEGES*` : `*ADDITIONAL PACKAGE SERVICES & PRIVILEGES*`
    ];
    model.additionalServices.forEach(a => {
      const aSummary = a.summary ? richTextToWhatsApp(a.summary) : '';
      const aOverview = a.overview ? richTextToWhatsApp(a.overview) : '';
      const aInstructions = a.specialInstructions ? richTextToWhatsApp(a.specialInstructions) : '';
      addLines.push(
        useEmojis
          ? `• 💎 *${a.name}* • *Included*\n  ${aSummary}${aOverview ? `\n  Overview: ${aOverview}` : ''}${aInstructions ? `\n  Notes: ${aInstructions}` : ''}`
          : `• *${a.name}* • Included\n  ${aSummary}${aOverview ? `\n  Overview: ${aOverview}` : ''}${aInstructions ? `\n  Notes: ${aInstructions}` : ''}`
      );
    });
    sections.push(addLines.join('\n'));
  }

  // 6. Ground Operations Standards
  const stdLines: string[] = [
    useEmojis ? `🛡️ *GROUND OPERATIONS STANDARDS & GUARANTEES*` : `*GROUND OPERATIONS STANDARDS & GUARANTEES*`
  ];
  model.operationalStandards.forEach(op => {
    stdLines.push(`• *${op.title}:* ${op.desc}`);
  });
  sections.push(stdLines.join('\n'));

  // 6B. Package-Level Inclusions, Exclusions & Policy Notes
  if (
    model.inclusions.length > 0 ||
    model.exclusions.length > 0 ||
    model.importantInformation ||
    model.cancellationPolicy
  ) {
    const pkgLines: string[] = [
      useEmojis ? `📋 *PACKAGE INCLUSIONS & EXCLUSIONS*` : `*PACKAGE INCLUSIONS & EXCLUSIONS*`
    ];
    if (model.inclusions.length > 0) {
      pkgLines.push(useEmojis ? `✅ *Inclusions:*` : `*Inclusions:*`);
      model.inclusions.forEach((inc) => pkgLines.push(`  • ${inc}`));
    }
    if (model.exclusions.length > 0) {
      pkgLines.push(useEmojis ? `❌ *Exclusions:*` : `*Exclusions:*`);
      model.exclusions.forEach((exc) => pkgLines.push(`  • ${exc}`));
    }
    if (model.importantInformation) {
      pkgLines.push(`${useEmojis ? 'ℹ️ ' : ''}*Important Information:* ${richTextToWhatsApp(model.importantInformation)}`);
    }
    if (model.cancellationPolicy) {
      pkgLines.push(`${useEmojis ? '⚖️ ' : ''}*Cancellation Policy:* ${richTextToWhatsApp(model.cancellationPolicy)}`);
    }
    sections.push(pkgLines.join('\n'));
  }

  // 7. Operational Guidelines & Child / Attraction Policies
  if (model.childAndAttractionPolicies.length > 0) {
    const polLines: string[] = [
      useEmojis ? `ℹ️ *OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY*` : `*OPERATIONAL GUIDELINES & CHILD / ATTRACTION POLICY*`
    ];
    model.childAndAttractionPolicies.forEach(p => {
      polLines.push(`• ${p}`);
    });
    sections.push(polLines.join('\n'));
  }

  // 8. YOUR TRAVEL QUOTATION (PRICING SUMMARY)
  const priceLines: string[] = [];
  const cleanCommercialTerms = model.commercialTermsWhatsApp || richTextToWhatsApp(model.commercialTerms);
  if (useEmojis) {
    priceLines.push(
      `💰 *Your Travel Quotation*`,
      ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
        ``,
        `🏨 *Hotel Accommodation Total:* ${model.hotelAccommodationTotalFormatted}`
      ] : []),
      ``,
      `🏷️ *Land Part Total:* ${model.landPartTotalFormatted}`,
      ...(model.appliedPromotion ? [
        ``,
        `🎟️ *Promotional Discount (${model.appliedPromotion.code}):* -${model.appliedPromotion.discountAmountFormatted} (${model.appliedPromotion.promotionName})`
      ] : []),
      ``,
      `💎 *Final Selling Price:* ${model.finalCustomerSellingPriceFormatted}`,
      ``,
      `💱 *Currency & Taxes:* ${model.guaranteedCurrencyLine}`,
      `⏳ *Quote Valid Until:* *${model.validUntilFormatted}*`,
      ``,
      `📜 *${model.commercialTermsHeading || COMMERCIAL_QUOTATION_TERMS_HEADING}*`,
      ``,
      cleanCommercialTerms
    );
  } else {
    priceLines.push(
      `*Your Travel Quotation*`,
      ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
        ``,
        `Hotel Accommodation Total: ${model.hotelAccommodationTotalFormatted}`
      ] : []),
      ``,
      `Land Part Total: ${model.landPartTotalFormatted}`,
      ...(model.appliedPromotion ? [
        ``,
        `Promotional Discount (${model.appliedPromotion.code}): -${model.appliedPromotion.discountAmountFormatted} (${model.appliedPromotion.promotionName})`
      ] : []),
      ``,
      `Final Selling Price: ${model.finalCustomerSellingPriceFormatted}`,
      ``,
      `Currency & Taxes: ${model.guaranteedCurrencyLine}`,
      `Quote Valid Until: ${model.validUntilFormatted}`,
      ``,
      `*${model.commercialTermsHeading || COMMERCIAL_QUOTATION_TERMS_HEADING}*`,
      ``,
      cleanCommercialTerms
    );
  }
  sections.push(priceLines.join('\n'));

  // 9. Personal Note
  if (options?.customNote && options.customNote.trim()) {
    const cleanCustomNote = richTextToWhatsApp(options.customNote.trim());
    sections.push(
      useEmojis
        ? `📝 *PERSONAL NOTE FROM YOUR TRAVEL DESIGNER:*\n"${cleanCustomNote}"`
        : `*PERSONAL NOTE:*\n${cleanCustomNote}`
    );
  }

  // 10. Quick Replies & Concierge Contact
  const interactiveLines: string[] = [];
  if (useEmojis) {
    interactiveLines.push(
      `📲 *INTERACTIVE QUICK REPLIES (TAP TO RESPOND):*`,
      `1️⃣ *Reply "1" or "CONFIRM"* ➔ Lock in dates & receive booking voucher + invoice`,
      `2️⃣ *Reply "2" or "CUSTOMIZE"* ➔ Adjust dates, swap hotels, or customize activities`,
      `3️⃣ *Reply "3" or "CALL ME"* ➔ Request a consultation call with our destination specialist`,
      `4️⃣ *Reply "4" or "PDF"* ➔ Receive full high-resolution official PDF proposal brochure`,
      ``,
      `🛎️ *DEDICATED TRAVEL CONCIERGE*`,
      `👤 *${model.agentName}*`,
      `🏢 ${model.agencyName}`,
      model.agentPhone ? `📞 WhatsApp / Direct: ${model.agentPhone}` : '',
      model.agentEmail ? `✉️ Email: ${model.agentEmail}` : '',
      model.agencyWebsite ? `🌐 Website: ${model.agencyWebsite}` : '',
      model.isWhiteLabel
        ? (model.agencyAddress ? `📍 Address: ${model.agencyAddress}` : '')
        : [
            model.agencyRegisteredAddress ? `📍 Registered Address: ${model.agencyRegisteredAddress}` : '',
            model.agencyCurrentAddress ? `🏢 Current Address: ${model.agencyCurrentAddress.replace(/\n/g, ', ')}` : ''
          ].filter(Boolean).join('\n'),
      model.isWhiteLabel ? `📄 ${model.footerContactLine}` : ''
    );
  } else {
    interactiveLines.push(
      `*HOW TO PROCEED (QUICK REPLIES):*`,
      `[1] Confirm & Request Booking Invoice`,
      `[2] Customize Hotels, Dates or Itinerary`,
      `[3] Request a Call with our Destination Specialist`,
      `[4] Request Official PDF Proposal Document`,
      ``,
      `*TRAVEL CONCIERGE & DESK*`,
      `Prepared by: *${model.agentName}* (${model.agencyName})`,
      model.agentPhone ? `WhatsApp / Tel: ${model.agentPhone}` : '',
      model.agentEmail ? `Email: ${model.agentEmail}` : '',
      model.agencyWebsite ? `Website: ${model.agencyWebsite}` : '',
      model.isWhiteLabel
        ? (model.agencyAddress ? `Address: ${model.agencyAddress}` : '')
        : [
            model.agencyRegisteredAddress ? `Registered Address: ${model.agencyRegisteredAddress}` : '',
            model.agencyCurrentAddress ? `Current Address: ${model.agencyCurrentAddress.replace(/\n/g, ', ')}` : ''
          ].filter(Boolean).join('\n'),
      model.isWhiteLabel ? model.footerContactLine : ''
    );
  }
  sections.push(interactiveLines.filter(Boolean).join('\n'));

  const finalWhatsApp = sections.join(`\n\n${DIVIDER}\n\n`);
  return model.isWhiteLabel
    ? sanitizeWhiteLabelString(finalWhatsApp, model.agencyName, model.agentEmail, model.agentPhone)
    : finalWhatsApp;
}

// ============================================================================
// CANONICAL COMPLETENESS VALIDATOR (PREVIEW vs PDF vs EMAIL vs WHATSAPP)
// ============================================================================

export interface QuoteChannelCompletenessReport {
  isComplete: boolean;
  missingInEmailHtml: string[];
  missingInEmailText: string[];
  missingInWhatsApp: string[];
  checkedElementsCount: number;
}

export function validateQuotePresentationCompleteness(
  model: QuotePresentationModel,
  emailOutput?: { subject: string; htmlBody: string; textBody: string },
  whatsAppOutput?: string
): QuoteChannelCompletenessReport {
  const email = emailOutput || renderQuoteEmailFromPresentationModel(model);
  const whatsapp = whatsAppOutput || renderQuoteWhatsAppFromPresentationModel(model);

  const missingInEmailHtml: string[] = [];
  const missingInEmailText: string[] = [];
  const missingInWhatsApp: string[] = [];

  const requiredTokens: { label: string; value: string }[] = [
    { label: 'Quote Reference', value: model.quoteNumber },
    { label: 'Client Name', value: model.clientName },
    { label: 'Destination', value: model.destination },
    { label: 'Passenger Summary', value: model.paxDetailsText },
    { label: 'Land Part Total', value: model.landPartTotalFormatted },
    { label: 'Final Selling Price', value: model.finalCustomerSellingPriceFormatted },
    { label: 'Agent Name', value: model.agentName },
    { label: 'Agency Name', value: model.agencyName },
    { label: 'Valid Until Date', value: model.validUntilFormatted },
    ...(model.hasHotelAccommodation && model.hotelAccommodationTotalFormatted ? [
      { label: 'Hotel Accommodation Total', value: model.hotelAccommodationTotalFormatted }
    ] : [])
  ];

  model.hotels.forEach(h => {
    requiredTokens.push({ label: `Hotel: ${h.hotelName}`, value: h.hotelName });
  });

  model.visaServices.forEach(v => {
    requiredTokens.push({ label: `Visa Service: ${v.listingName}`, value: v.listingName });
  });

  model.days.forEach(d => {
    requiredTokens.push({ label: `Day ${d.dayNumber} Hub`, value: d.hubName });
    d.services.forEach(s => {
      requiredTokens.push({ label: `Day ${d.dayNumber} Service: ${s.listingName}`, value: s.listingName });
      if (s.meetingPoint) {
        requiredTokens.push({ label: `Meeting Point: ${s.meetingPoint}`, value: s.meetingPoint });
      }
      if (s.pickupPoint) {
        requiredTokens.push({ label: `Pickup Point: ${s.pickupPoint}`, value: s.pickupPoint });
      }
      if (s.dropoffPoint) {
        requiredTokens.push({ label: `Dropoff Point: ${s.dropoffPoint}`, value: s.dropoffPoint });
      }
    });
  });

  requiredTokens.forEach(token => {
    if (!token.value) return;
    const valLower = token.value.toLowerCase();
    if (!email.htmlBody.includes(token.value) && !email.htmlBody.toLowerCase().includes(valLower)) {
      missingInEmailHtml.push(token.label);
    }
    if (!email.textBody.includes(token.value) && !email.textBody.toLowerCase().includes(valLower)) {
      missingInEmailText.push(token.label);
    }
    if (!whatsapp.includes(token.value) && !whatsapp.toLowerCase().includes(valLower)) {
      missingInWhatsApp.push(token.label);
    }
  });

  return {
    isComplete:
      missingInEmailHtml.length === 0 &&
      missingInEmailText.length === 0 &&
      missingInWhatsApp.length === 0,
    missingInEmailHtml,
    missingInEmailText,
    missingInWhatsApp,
    checkedElementsCount: requiredTokens.length
  };
}

export function generateWhatsAppSummaryText(
  model: QuotePresentationModel,
  options?: {
    customNote?: string;
    useEmojis?: boolean;
    formatStyle?: 'DETAILED' | 'SUMMARY';
  }
): string {
  return renderQuoteWhatsAppFromPresentationModel(model, options);
}

export function generateEmailPlainTextSummary(
  model: QuotePresentationModel,
  customNote?: string
): string {
  return renderQuoteEmailFromPresentationModel(model, customNote).textBody;
}

export { 
  renderProposalViewHtmlEmail,
  renderStructuredQuotationHtmlEmail, 
  formatPlainTextQuotationToHtml,
  formatPlainTextQuotationToSimpleSemanticHtml,
  renderSimpleSemanticQuotationEmailFromModel,
  renderOption2CompleteFormattedHtmlEmail
} from './quoteEmailFormatter';



