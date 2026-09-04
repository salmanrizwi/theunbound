import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { CurrencyCode, Product, QuoteItem, Quotation, TravelLead, B2BPackage, TripRouteHub, QuoteBuilderHandoffPayload, QuoteItemSource } from '../types';
import { calculateProductPrice } from '../services/pricingEngine';
import { AppDatabase } from '../services/db';
import { campaignAnalytics } from '../services/campaignAnalyticsService';
import { useAuth } from './AuthContext';

interface QuotationContextType {
  items: QuoteItem[];
  setItems: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
  loadQuoteItems: (items: QuoteItem[]) => void;
  currency: CurrencyCode;
  setCurrency: (curr: CurrencyCode) => void;
  isQuoteDrawerOpen: boolean;
  setIsQuoteDrawerOpen: (open: boolean) => void;
  addProductToQuote: (
    product: Product, 
    options?: { 
      adults?: number; 
      children?: number; 
      infants?: number; 
      travelDate?: string; 
      serviceTime?: string;
      notes?: string;
      selectedAddonIds?: string[];
      openDrawer?: boolean;
      source?: QuoteItemSource;
      aiSuggested?: boolean;
    }
  ) => void;
  removeProductFromQuote: (itemId: string) => void;
  updateItemPax: (itemId: string, pax: { adults: number; children: number; infants: number }) => void;
  updateItemTravelDate: (itemId: string, date: string) => void;
  updateItemServiceTime: (itemId: string, time: string) => void;
  updateItemFull: (
    itemId: string, 
    updates: { 
      travelDate?: string; 
      serviceTime?: string; 
      pax?: { adults: number; children: number; infants: number }; 
      selectedAddonIds?: string[]; 
      notes?: string;
      source?: QuoteItemSource;
    }
  ) => void;
  updateQuoteItem: (
    itemId: string,
    updatedProduct: Product,
    options: {
      adults?: number;
      children?: number;
      infants?: number;
      travelDate?: string;
      serviceTime?: string;
      notes?: string;
      selectedAddonIds?: string[];
    }
  ) => void;
  toggleItemAddon: (itemId: string, addonId: string) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  clearQuote: () => void;
  
  // Quotation metadata
  clientName: string;
  setClientName: (name: string) => void;
  clientEmail: string;
  setClientEmail: (email: string) => void;
  clientCompany: string;
  setClientCompany: (company: string) => void;
  clientPhone: string;
  setClientPhone: (phone: string) => void;
  destination: string;
  setDestination: (dest: string) => void;
  travelStartDate: string;
  travelEndDate: string;
  setQuotationDates: (startDate: string, endDate: string) => void;
  setClientDetails: (name: string, email: string, phone?: string, company?: string) => void;
  leadId: string;
  setLeadId: (leadId: string) => void;
  agentNotes: string;
  setAgentNotes: (notes: string) => void;
  overallDiscountPercent: number;
  setOverallDiscountPercent: (percent: number) => void;
  activeQuoteId: string | null;
  currentVersion: number;
  isLocked: boolean;

  // Route Hubs, Pax Configuration, Day Themes
  routeHubs: TripRouteHub[];
  setRouteHubs: React.Dispatch<React.SetStateAction<TripRouteHub[]>>;
  paxConfig: { adults: number; children: number; childAges: number[]; infants: number };
  setPaxConfig: React.Dispatch<React.SetStateAction<{ adults: number; children: number; childAges: number[]; infants: number }>>;
  dayThemes: Record<number, string>;
  setDayThemes: React.Dispatch<React.SetStateAction<Record<number, string>>>;

  // AI Planner Integration & State Tracking
  handoffPayload: QuoteBuilderHandoffPayload | null;
  setHandoffPayload: (payload: QuoteBuilderHandoffPayload | null) => void;
  quoteSource: 'AI_PLANNER' | 'USER' | 'HYBRID';
  setQuoteSource: (source: 'AI_PLANNER' | 'USER' | 'HYBRID') => void;
  priceRefreshNotice: string | null;
  clearPriceRefreshNotice: () => void;
  loadAiPlannerPayload: (payload: QuoteBuilderHandoffPayload) => { priceVariance: boolean; oldPrice: number; newPrice: number };
  
  // Computed summary
  totalNetCost: number;
  totalGrossBeforeTax: number;
  totalTaxes: number;
  totalServiceFees: number;
  totalSellingPrice: number;
  totalMarginAmount: number;
  totalPaxAcrossItems: number;
  
  // Saved Quotes & Package Customization
  savedQuotes: Quotation[];
  saveCurrentQuote: () => Quotation | null;
  loadSavedQuote: (quote: Quotation) => void;
  loadPackageIntoQuote: (pkg: B2BPackage) => void;
  deleteSavedQuote: (quoteId: string) => void;
}

const STORAGE_KEY_SAVED_QUOTES = 'theunbound_saved_quotes';

const QuotationContext = createContext<QuotationContextType | undefined>(undefined);

export const QuotationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [items, setItems] = useState<QuoteItem[]>(() => {
    try {
      const saved = localStorage.getItem('theunbound_cart_items');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch (e) {
      console.error('Error loading cart items from storage:', e);
    }
    return [];
  });
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [isQuoteDrawerOpen, setIsQuoteDrawerOpen] = useState(false);

  // Sync items to localStorage for session and cross-page persistence
  useEffect(() => {
    try {
      localStorage.setItem('theunbound_cart_items', JSON.stringify(items));
    } catch (e) {
      console.error('Error saving cart items to storage:', e);
    }
  }, [items]);
  
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  // No hardcoded default destination or dates: Quote Builder starts empty unless AI or user provides values
  const [destination, setDestination] = useState('');
  const [travelStartDate, setTravelStartDate] = useState('');
  const [travelEndDate, setTravelEndDate] = useState('');
  const [routeHubs, setRouteHubs] = useState<TripRouteHub[]>([]);
  const [paxConfig, setPaxConfig] = useState({ adults: 2, children: 0, childAges: [] as number[], infants: 0 });
  const [dayThemes, setDayThemes] = useState<Record<number, string>>({});
  const [handoffPayload, setHandoffPayload] = useState<QuoteBuilderHandoffPayload | null>(null);
  const [quoteSource, setQuoteSource] = useState<'AI_PLANNER' | 'USER' | 'HYBRID'>('USER');
  const [priceRefreshNotice, setPriceRefreshNotice] = useState<string | null>(null);
  const [leadId, setLeadId] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [isLocked, setIsLocked] = useState(false);

  const clearPriceRefreshNotice = () => setPriceRefreshNotice(null);

  const setQuotationDates = (startDate: string, endDate: string) => {
    setTravelStartDate(startDate);
    setTravelEndDate(endDate);
  };

  const setClientDetails = (name: string, email: string, phone?: string, company?: string) => {
    setClientName(name);
    setClientEmail(email);
    if (phone) setClientPhone(phone);
    if (company) setClientCompany(company);
  };

  const pricingTier = user && user.role !== 'PUBLIC' ? 'B2B' : 'B2C';

  const [savedQuotes, setSavedQuotes] = useState<Quotation[]>(() => {
    const db = AppDatabase.getInstance();
    return db.getQuotesForUser(user);
  });

  // Sync savedQuotes when user changes or DB updates
  useEffect(() => {
    const db = AppDatabase.getInstance();
    const refreshQuotes = () => {
      setSavedQuotes(db.getQuotesForUser(user));
    };
    refreshQuotes();
    const unsub = db.subscribe(refreshQuotes);
    return () => {
      unsub();
    };
  }, [user]);

  // Recalculate all items whenever currency or user pricingTier changes
  useEffect(() => {
    setItems(prevItems =>
      prevItems.map(item => {
        const calculation = calculateProductPrice(item.product, {
          productId: item.product.id,
          pricingTier,
          adults: item.pax.adults,
          children: item.pax.children,
          infants: item.pax.infants,
          travelDate: item.travelDate,
          targetCurrency: currency,
          selectedAddonIds: item.selectedAddonIds
        });
        return {
          ...item,
          calculation
        };
      })
    );
  }, [currency, pricingTier]);

  const addProductToQuote = (
    product: Product,
    options?: {
      adults?: number;
      children?: number;
      infants?: number;
      travelDate?: string;
      serviceTime?: string;
      notes?: string;
      selectedAddonIds?: string[];
      openDrawer?: boolean;
      source?: QuoteItemSource;
      aiSuggested?: boolean;
    }
  ) => {
    const adults = options?.adults ?? Math.max(1, product.minPax);
    const children = options?.children ?? 0;
    const infants = options?.infants ?? 0;
    const travelDate = options?.travelDate ?? travelStartDate ?? '';
    const selectedAddonIds = options?.selectedAddonIds ?? [];
    const serviceTime = options?.serviceTime;
    const notes = options?.notes;

    const calculation = calculateProductPrice(product, {
      productId: product.id,
      pricingTier,
      adults,
      children,
      infants,
      travelDate,
      targetCurrency: currency,
      selectedAddonIds
    });

    const newItem: QuoteItem = {
      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      product,
      pax: { adults, children, infants },
      travelDate,
      serviceTime,
      notes,
      selectedAddonIds,
      calculation,
      source: options?.source || 'USER',
      aiSuggested: options?.aiSuggested ?? false
    };

    setItems(prev => [...prev, newItem]);
    if (options?.openDrawer !== false) {
      setIsQuoteDrawerOpen(true);
    }
  };

  const removeProductFromQuote = (itemId: string) => {
    setItems(prev => prev.filter(i => i.id !== itemId));
  };

  const updateItemPax = (itemId: string, pax: { adults: number; children: number; infants: number }) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const calculation = calculateProductPrice(item.product, {
          productId: item.product.id,
          pricingTier,
          adults: pax.adults,
          children: pax.children,
          infants: pax.infants,
          travelDate: item.travelDate,
          targetCurrency: currency,
          selectedAddonIds: item.selectedAddonIds
        });
        return {
          ...item,
          pax,
          calculation,
          source: 'USER',
          aiSuggested: false
        };
      })
    );
  };

  const updateItemTravelDate = (itemId: string, date: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const calculation = calculateProductPrice(item.product, {
          productId: item.product.id,
          pricingTier,
          adults: item.pax.adults,
          children: item.pax.children,
          infants: item.pax.infants,
          travelDate: date,
          targetCurrency: currency,
          selectedAddonIds: item.selectedAddonIds
        });
        return {
          ...item,
          travelDate: date,
          calculation,
          source: 'USER',
          aiSuggested: false
        };
      })
    );
  };

  const updateItemServiceTime = (itemId: string, time: string) => {
    setItems(prev =>
      prev.map(item => (item.id === itemId ? { ...item, serviceTime: time, source: 'USER', aiSuggested: false } : item))
    );
  };

  const updateItemFull = (
    itemId: string,
    updates: {
      travelDate?: string;
      serviceTime?: string;
      pax?: { adults: number; children: number; infants: number };
      selectedAddonIds?: string[];
      notes?: string;
      source?: QuoteItemSource;
    }
  ) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const nextDate = updates.travelDate ?? item.travelDate;
        const nextPax = updates.pax ?? item.pax;
        const nextAddons = updates.selectedAddonIds ?? item.selectedAddonIds;
        const nextServiceTime = updates.serviceTime !== undefined ? updates.serviceTime : item.serviceTime;
        const nextNotes = updates.notes !== undefined ? updates.notes : item.notes;

        const calculation = calculateProductPrice(item.product, {
          productId: item.product.id,
          pricingTier,
          adults: nextPax.adults,
          children: nextPax.children,
          infants: nextPax.infants,
          travelDate: nextDate,
          targetCurrency: currency,
          selectedAddonIds: nextAddons
        });

        return {
          ...item,
          travelDate: nextDate,
          serviceTime: nextServiceTime,
          pax: nextPax,
          selectedAddonIds: nextAddons,
          notes: nextNotes,
          calculation,
          source: updates.source ?? 'USER',
          aiSuggested: updates.source === 'AI_PLANNER'
        };
      })
    );
  };

  const updateQuoteItem = (
    itemId: string,
    updatedProduct: Product,
    options: {
      adults?: number;
      children?: number;
      infants?: number;
      travelDate?: string;
      serviceTime?: string;
      notes?: string;
      selectedAddonIds?: string[];
    }
  ) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const adults = options.adults ?? item.pax.adults;
        const children = options.children ?? item.pax.children;
        const infants = options.infants ?? item.pax.infants;
        const travelDate = options.travelDate ?? item.travelDate;
        const serviceTime = options.serviceTime !== undefined ? options.serviceTime : item.serviceTime;
        const notes = options.notes !== undefined ? options.notes : item.notes;
        const selectedAddonIds = options.selectedAddonIds ?? item.selectedAddonIds;

        const calculation = calculateProductPrice(updatedProduct, {
          productId: updatedProduct.id,
          pricingTier,
          adults,
          children,
          infants,
          travelDate,
          targetCurrency: currency,
          selectedAddonIds
        });

        return {
          ...item,
          product: updatedProduct,
          pax: { adults, children, infants },
          travelDate,
          serviceTime,
          notes,
          selectedAddonIds,
          calculation,
          source: 'USER',
          aiSuggested: false
        };
      })
    );
  };

  const toggleItemAddon = (itemId: string, addonId: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const currentAddons = item.selectedAddonIds || [];
        const nextAddons = currentAddons.includes(addonId)
          ? currentAddons.filter(id => id !== addonId)
          : [...currentAddons, addonId];

        const calculation = calculateProductPrice(item.product, {
          productId: item.product.id,
          pricingTier,
          adults: item.pax.adults,
          children: item.pax.children,
          infants: item.pax.infants,
          travelDate: item.travelDate,
          targetCurrency: currency,
          selectedAddonIds: nextAddons
        });

        return {
          ...item,
          selectedAddonIds: nextAddons,
          calculation,
          source: 'USER',
          aiSuggested: false
        };
      })
    );
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setItems(prev =>
      prev.map(item => (item.id === itemId ? { ...item, notes, source: 'USER', aiSuggested: false } : item))
    );
  };

  const clearQuote = () => {
    setItems([]);
    setClientName('');
    setClientEmail('');
    setClientCompany('');
    setClientPhone('');
    setDestination('');
    setTravelStartDate('');
    setTravelEndDate('');
    setRouteHubs([]);
    setPaxConfig({ adults: 2, children: 0, childAges: [], infants: 0 });
    setDayThemes({});
    setHandoffPayload(null);
    setQuoteSource('USER');
    setPriceRefreshNotice(null);
    setLeadId('');
    setAgentNotes('');
    setOverallDiscountPercent(0);
    setActiveQuoteId(null);
    setCurrentVersion(1);
    setIsLocked(false);
    try {
      localStorage.removeItem('theunbound_cart_items');
    } catch (e) {
      console.error('Error clearing cart storage:', e);
    }
  };

  const loadAiPlannerPayload = (payload: QuoteBuilderHandoffPayload) => {
    const db = AppDatabase.getInstance();
    const allDestinations = db.getDestinations();
    const allProducts = db.getProducts();

    // 1. Verify destination against DB
    const matchedDest = allDestinations.find(
      d => d.id === payload.destination.id ||
           d.name.toLowerCase() === payload.destination.name.toLowerCase() ||
           d.slug === payload.destination.slug
    );
    const destName = matchedDest ? matchedDest.name : payload.destination.name;

    // 2. Validate route hubs with AI metadata
    const validatedHubs: TripRouteHub[] = (payload.routeHubs || []).map((hub, idx) => ({
      ...hub,
      id: hub.id || `ai-hub-${idx + 1}-${Date.now()}`,
      order: hub.order || idx + 1,
      nights: Math.max(1, hub.nights || 1),
      source: 'AI_PLANNER' as QuoteItemSource,
      aiSuggested: true
    }));

    // 3. Recalculate each item via authoritative PricingEngine
    let recalculatedItems: QuoteItem[] = [];
    let sumRecalculatedPrice = 0;

    if (payload.items && payload.items.length > 0) {
      recalculatedItems = payload.items.map(item => {
        const dbProduct = allProducts.find(p => p.id === item.product.id) || item.product;
        const adults = item.pax?.adults || payload.pax.adults || 2;
        const children = item.pax?.children || payload.pax.children || 0;
        const infants = item.pax?.infants || payload.pax.infants || 0;
        const travelDate = item.travelDate || payload.travelDates.startDate || '';

        const calc = calculateProductPrice(dbProduct, {
          productId: dbProduct.id,
          pricingTier,
          adults,
          children,
          infants,
          travelDate,
          targetCurrency: currency,
          selectedAddonIds: item.selectedAddonIds || []
        });

        sumRecalculatedPrice += calc.finalTotalSellingPrice;

        return {
          ...item,
          product: dbProduct,
          pax: { adults, children, infants },
          travelDate,
          calculation: calc,
          source: 'AI_PLANNER' as QuoteItemSource,
          aiSuggested: true
        };
      });
    }

    // 4. Check for price variance between AI plan and live pricing engine
    const aiExpectedPrice = payload.calculatedSellingPrice || 0;
    const priceDiff = Math.abs(sumRecalculatedPrice - aiExpectedPrice);
    const hasVariance = priceDiff > 1;

    if (hasVariance) {
      setPriceRefreshNotice('Pricing has been refreshed using the latest available rates.');
    } else {
      setPriceRefreshNotice(null);
    }

    // 5. Apply state to Quote Builder
    setDestination(destName);
    setTravelStartDate(payload.travelDates.startDate);
    setTravelEndDate(payload.travelDates.endDate);
    setRouteHubs(validatedHubs);
    setPaxConfig({
      adults: payload.pax.adults,
      children: payload.pax.children,
      childAges: payload.pax.childAges || [],
      infants: payload.pax.infants
    });
    setDayThemes(payload.dayThemes || {});
    setItems(recalculatedItems);
    setHandoffPayload(payload);
    setQuoteSource('AI_PLANNER');
    setActiveQuoteId(null);
    setCurrentVersion(1);
    setIsLocked(false);

    return {
      priceVariance: hasVariance,
      oldPrice: aiExpectedPrice,
      newPrice: sumRecalculatedPrice
    };
  };

  // Aggregated financials
  const totals = useMemo(() => {
    let net = 0;
    let gross = 0;
    let taxes = 0;
    let fees = 0;
    let selling = 0;
    let margin = 0;
    let totalPax = 0;

    for (const item of items) {
      net += item.calculation.totalNetCost;
      gross += item.calculation.grossBeforeTax;
      taxes += item.calculation.taxAmount;
      fees += item.calculation.serviceFee;
      selling += item.calculation.finalTotalSellingPrice;
      margin += item.calculation.dmcMarginAmount;
      totalPax += item.pax.adults + item.pax.children;
    }

    if (overallDiscountPercent > 0) {
      const discountVal = selling * (overallDiscountPercent / 100);
      selling -= discountVal;
      margin -= discountVal;
    }

    return {
      totalNetCost: net,
      totalGrossBeforeTax: gross,
      totalTaxes: taxes,
      totalServiceFees: fees,
      totalSellingPrice: selling,
      totalMarginAmount: margin,
      totalPaxAcrossItems: totalPax
    };
  }, [items, overallDiscountPercent]);

  const saveCurrentQuote = (): Quotation | null => {
    if (items.length === 0) return null;

    const db = AppDatabase.getInstance();
    const existingQuote = activeQuoteId ? db.getQuoteByIdAuthorized(activeQuoteId, user) : null;

    const quoteIdToUse = activeQuoteId || `quote-${Date.now()}`;
    const quoteNumberToUse = existingQuote?.quoteNumber || `UBQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const newQuote: Quotation = {
      id: quoteIdToUse,
      quoteNumber: quoteNumberToUse,
      title: clientName ? `Quotation for ${clientName}` : `Bespoke Itinerary Quote #${items.length} Products`,
      clientName: clientName || 'Client Name Pending',
      clientEmail,
      clientCompany,
      leadId: leadId || undefined,
      agentId: user?.id || 'usr-anonymous',
      agentName: user?.name || 'Travel Consultant',
      agentAgency: user?.agencyName || user?.companyName,
      agentLogoUrl: user?.brandLogoUrl || user?.logoUrl,
      destination: items[0]?.product.destinationName || 'Multi-Destination',
      currency,
      items,
      version: currentVersion,
      isLocked: isLocked,
      overallDiscountPercent,
      agentNotes,
      termsAndConditions: 'Quotation valid for 14 days from generation date. Subject to hotel and guide confirmation at time of deposit.',
      status: existingQuote?.status || 'DRAFT',
      createdAt: existingQuote?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
      totalNetCost: totals.totalNetCost,
      totalSellingPrice: totals.totalSellingPrice,
      totalTaxes: totals.totalTaxes,
      totalMargin: totals.totalMarginAmount
    };

    // Save to AppDatabase (which persists and notifies subscribers)
    db.saveQuote(newQuote, user);
    setActiveQuoteId(newQuote.id);

    // Track Campaign Conversion Attribution if active
    campaignAnalytics.trackQuoteCreated(
      newQuote.id, 
      Number(totals.totalSellingPrice) || 0, 
      currency, 
      items[0]?.product.destinationId
    );

    setSavedQuotes(prev => {
      const filtered = prev.filter(q => q.id !== newQuote.id);
      return [newQuote, ...filtered];
    });

    // Auto-capture or update as a CRM Travel Lead for ground operations
    try {
      const leadIdStr = leadId || `lead-quote-${newQuote.id}`;
      const newLead: TravelLead = {
        id: leadIdStr,
        leadNumber: leadId || `LED-${(newQuote.quoteNumber || newQuote.id || Date.now().toString()).replace('UBQ-', '')}`,
        contactName: clientName || user?.name || 'Inquiring Traveler / Agency',
        email: clientEmail || user?.email || 'sales@theunbound.in',
        phone: '',
        agencyName: clientCompany || user?.agencyName,
        source: 'QUOTATION_SAVED',
        status: 'QUOTED',
        assignedStaffId: user?.id || 'staff-01',
        assignedStaffName: user?.name || 'Operations Desk',
        destinationId: items[0]?.product.destinationId || 'japan',
        destinationName: items[0]?.product.destinationName || 'Multi-Destination',
        travelDates: items[0]?.travelDate || 'Upcoming 2026',
        paxAdults: items.reduce((sum, it) => sum + it.pax.adults, 0) || 2,
        paxChildren: items.reduce((sum, it) => sum + it.pax.children, 0) || 0,
        estimatedBudget: totals.totalSellingPrice,
        currency,
        quoteId: newQuote.id,
        quoteNumber: newQuote.quoteNumber,
        travelRequirements: `Generated itinerary with ${items.length} items: ${items.map(i => i.product.name).join(', ')}`,
        notes: [
          {
            id: `note-${Date.now()}`,
            authorName: user?.name || 'System Automation',
            text: `B2B Quotation ${newQuote.quoteNumber} (v${newQuote.version || 1}) created/saved for value ${(Number(totals?.totalSellingPrice) || 0).toLocaleString()} ${currency}.`,
            timestamp: new Date().toISOString()
          }
        ],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.saveLead(newLead, user);
    } catch (e) {
      console.debug('Lead auto-capture from quote save:', e);
    }

    return newQuote;
  };

  const loadSavedQuote = (quote: Quotation) => {
    setItems(quote.items || []);
    setCurrency(quote.currency || 'USD');
    setClientName(quote.clientName || '');
    setClientEmail(quote.clientEmail || '');
    setClientCompany(quote.clientCompany || '');
    setLeadId(quote.leadId || '');
    setAgentNotes(quote.agentNotes || '');
    setOverallDiscountPercent(quote.overallDiscountPercent || 0);
    setActiveQuoteId(quote.id);
    setCurrentVersion(quote.version || 1);
    setIsLocked(!!quote.isLocked);
    setIsQuoteDrawerOpen(true);
  };

  const loadPackageIntoQuote = (pkg: B2BPackage) => {
    const db = AppDatabase.getInstance();
    const allProducts = db.getProducts();
    const packageCurrency = pkg.currency || 'USD';
    setCurrency(packageCurrency);

    // Compute start date: 14 days in future
    const startDateObj = new Date(Date.now() + 86400000 * 14);
    const startDateStr = startDateObj.toISOString().split('T')[0];
    const durationDays = pkg.durationDays || 5;
    const endDateObj = new Date(startDateObj.getTime() + 86400000 * (durationDays - 1));
    const endDateStr = endDateObj.toISOString().split('T')[0];

    setTravelStartDate(startDateStr);
    setTravelEndDate(endDateStr);
    setDestination(pkg.destinationName || 'Japan');
    setClientName(`Bespoke Traveler - ${pkg.title}`);
    setAgentNotes(`Customized from Ready-Made Package Circuit: "${pkg.title}" (${durationDays} Days / ${pkg.durationNights || durationDays - 1} Nights). Route: ${(pkg.routeSummary || []).join(' → ')}`);

    // Build QuoteItems from package itinerary & products
    const newItems: QuoteItem[] = [];
    const defaultPax = { adults: 2, children: 0, infants: 0 };

    if (pkg.itinerary && pkg.itinerary.length > 0) {
      pkg.itinerary.forEach((day, dayIndex) => {
        const dayDate = new Date(startDateObj.getTime() + 86400000 * dayIndex).toISOString().split('T')[0];
        (day.productIds || []).forEach((prodId, pIdx) => {
          const product = allProducts.find(p => p.id === prodId);
          if (product) {
            const calculation = calculateProductPrice(product, {
              productId: product.id,
              travelDate: dayDate,
              adults: defaultPax.adults,
              children: defaultPax.children,
              infants: defaultPax.infants,
              targetCurrency: packageCurrency,
              userRole: 'B2B_AGENT'
            });
            newItems.push({
              id: `item-pkg-${pkg.id}-d${day.dayNumber}-${pIdx}-${Date.now()}`,
              product,
              travelDate: dayDate,
              serviceTime: pIdx === 0 ? '09:00' : '14:00',
              pax: defaultPax,
              calculation,
              selectedAddonIds: [],
              notes: `Day ${day.dayNumber}: ${day.title}`
            });
          }
        });
      });
    }

    // Fallback: If itinerary had no productIds, attach top-level productIds
    if (newItems.length === 0 && pkg.productIds && pkg.productIds.length > 0) {
      pkg.productIds.forEach((prodId, idx) => {
        const product = allProducts.find(p => p.id === prodId);
        if (product) {
          const dayDate = new Date(startDateObj.getTime() + 86400000 * (idx % durationDays)).toISOString().split('T')[0];
          const calculation = calculateProductPrice(product, {
            productId: product.id,
            travelDate: dayDate,
            adults: defaultPax.adults,
            children: defaultPax.children,
            infants: defaultPax.infants,
            targetCurrency: packageCurrency,
            userRole: 'B2B_AGENT'
          });
          newItems.push({
            id: `item-pkg-${pkg.id}-${idx}-${Date.now()}`,
            product,
            travelDate: dayDate,
            serviceTime: '09:00',
            pax: defaultPax,
            calculation,
            selectedAddonIds: [],
            notes: `Package Component ${idx + 1}`
          });
        }
      });
    }

    setItems(newItems);
    setActiveQuoteId(null); // Fresh bespoke quote derived from package
    setCurrentVersion(1);
    setIsLocked(false);
    setIsQuoteDrawerOpen(true);
  };

  const deleteSavedQuote = (quoteId: string) => {
    const db = AppDatabase.getInstance();
    db.deleteQuote(quoteId, user);
    setSavedQuotes(prev => prev.filter(q => q.id !== quoteId));
  };

  const loadQuoteItems = (newItems: QuoteItem[]) => {
    setItems(newItems || []);
  };

  return (
    <QuotationContext.Provider
      value={{
        items,
        setItems,
        loadQuoteItems,
        currency,
        setCurrency,
        isQuoteDrawerOpen,
        setIsQuoteDrawerOpen,
        addProductToQuote,
        removeProductFromQuote,
        updateItemPax,
        updateItemTravelDate,
        updateItemServiceTime,
        updateItemFull,
        updateQuoteItem,
        toggleItemAddon,
        updateItemNotes,
        clearQuote,
        clientName,
        setClientName,
        clientEmail,
        setClientEmail,
        clientCompany,
        setClientCompany,
        clientPhone,
        setClientPhone,
        destination,
        setDestination,
        travelStartDate,
        travelEndDate,
        setQuotationDates,
        setClientDetails,
        leadId,
        setLeadId,
        agentNotes,
        setAgentNotes,
        overallDiscountPercent,
        setOverallDiscountPercent,
        activeQuoteId,
        currentVersion,
        isLocked,
        routeHubs,
        setRouteHubs,
        paxConfig,
        setPaxConfig,
        dayThemes,
        setDayThemes,
        handoffPayload,
        setHandoffPayload,
        quoteSource,
        setQuoteSource,
        priceRefreshNotice,
        clearPriceRefreshNotice,
        loadAiPlannerPayload,
        ...totals,
        savedQuotes,
        saveCurrentQuote,
        loadSavedQuote,
        loadPackageIntoQuote,
        deleteSavedQuote
      }}
    >
      {children}
    </QuotationContext.Provider>
  );
};

export const useQuotation = (): QuotationContextType => {
  const context = useContext(QuotationContext);
  if (!context) {
    throw new Error('useQuotation must be used within a QuotationProvider');
  }
  return context;
};
