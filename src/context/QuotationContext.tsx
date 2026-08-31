import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { CurrencyCode, Product, QuoteItem, Quotation, TravelLead, B2BPackage } from '../types';
import { calculateProductPrice } from '../services/pricingEngine';
import { AppDatabase } from '../services/db';
import { useAuth } from './AuthContext';

interface QuotationContextType {
  items: QuoteItem[];
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
      notes?: string 
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
  const [items, setItems] = useState<QuoteItem[]>([]);
  const [currency, setCurrency] = useState<CurrencyCode>('USD');
  const [isQuoteDrawerOpen, setIsQuoteDrawerOpen] = useState(false);
  
  const [clientName, setClientName] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientCompany, setClientCompany] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [destination, setDestination] = useState('Japan');
  const [travelStartDate, setTravelStartDate] = useState(new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0]);
  const [travelEndDate, setTravelEndDate] = useState(new Date(Date.now() + 86400000 * 24).toISOString().split('T')[0]);
  const [leadId, setLeadId] = useState('');
  const [agentNotes, setAgentNotes] = useState('');
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);
  const [activeQuoteId, setActiveQuoteId] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState(1);
  const [isLocked, setIsLocked] = useState(false);

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
    }
  ) => {
    const adults = options?.adults ?? Math.max(1, product.minPax);
    const children = options?.children ?? 0;
    const infants = options?.infants ?? 0;
    const travelDate = options?.travelDate ?? new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
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
      calculation
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
          calculation
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
          calculation
        };
      })
    );
  };

  const updateItemServiceTime = (itemId: string, time: string) => {
    setItems(prev =>
      prev.map(item => (item.id === itemId ? { ...item, serviceTime: time } : item))
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
          calculation
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
          calculation
        };
      })
    );
  };

  const updateItemNotes = (itemId: string, notes: string) => {
    setItems(prev =>
      prev.map(item => (item.id === itemId ? { ...item, notes } : item))
    );
  };

  const clearQuote = () => {
    setItems([]);
    setClientName('');
    setClientEmail('');
    setClientCompany('');
    setLeadId('');
    setAgentNotes('');
    setOverallDiscountPercent(0);
    setActiveQuoteId(null);
    setCurrentVersion(1);
    setIsLocked(false);
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

    setSavedQuotes(prev => {
      const filtered = prev.filter(q => q.id !== newQuote.id);
      return [newQuote, ...filtered];
    });

    // Auto-capture or update as a CRM Travel Lead for ground operations
    try {
      const leadIdStr = leadId || `lead-quote-${newQuote.id}`;
      const newLead: TravelLead = {
        id: leadIdStr,
        leadNumber: leadId || `LED-${newQuote.quoteNumber.replace('UBQ-', '')}`,
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

  return (
    <QuotationContext.Provider
      value={{
        items,
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
