import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { CurrencyCode, Product, QuoteItem, Quotation } from '../types';
import { calculateProductPrice } from '../services/pricingEngine';
import { useAuth } from './AuthContext';

interface QuotationContextType {
  items: QuoteItem[];
  currency: CurrencyCode;
  setCurrency: (curr: CurrencyCode) => void;
  isQuoteDrawerOpen: boolean;
  setIsQuoteDrawerOpen: (open: boolean) => void;
  addProductToQuote: (product: Product, options?: { adults?: number; children?: number; infants?: number; travelDate?: string; selectedAddonIds?: string[] }) => void;
  removeProductFromQuote: (itemId: string) => void;
  updateItemPax: (itemId: string, pax: { adults: number; children: number; infants: number }) => void;
  updateItemTravelDate: (itemId: string, date: string) => void;
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
  agentNotes: string;
  setAgentNotes: (notes: string) => void;
  overallDiscountPercent: number;
  setOverallDiscountPercent: (percent: number) => void;
  
  // Computed summary
  totalNetCost: number;
  totalGrossBeforeTax: number;
  totalTaxes: number;
  totalServiceFees: number;
  totalSellingPrice: number;
  totalMarginAmount: number;
  totalPaxAcrossItems: number;
  
  // Saved Quotes
  savedQuotes: Quotation[];
  saveCurrentQuote: () => Quotation | null;
  loadSavedQuote: (quote: Quotation) => void;
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
  const [agentNotes, setAgentNotes] = useState('');
  const [overallDiscountPercent, setOverallDiscountPercent] = useState(0);

  const pricingTier = user && user.role !== 'PUBLIC' ? 'B2B' : 'B2C';

  const [savedQuotes, setSavedQuotes] = useState<Quotation[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SAVED_QUOTES);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse saved quotes', e);
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SAVED_QUOTES, JSON.stringify(savedQuotes));
  }, [savedQuotes]);

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
      selectedAddonIds?: string[];
    }
  ) => {
    const adults = options?.adults ?? Math.max(1, product.minPax);
    const children = options?.children ?? 0;
    const infants = options?.infants ?? 0;
    const travelDate = options?.travelDate ?? new Date(Date.now() + 86400000 * 14).toISOString().split('T')[0];
    const selectedAddonIds = options?.selectedAddonIds ?? [];

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
      selectedAddonIds,
      calculation
    };

    setItems(prev => [...prev, newItem]);
    setIsQuoteDrawerOpen(true);
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

  const toggleItemAddon = (itemId: string, addonId: string) => {
    setItems(prev =>
      prev.map(item => {
        if (item.id !== itemId) return item;
        const nextAddons = item.selectedAddonIds.includes(addonId)
          ? item.selectedAddonIds.filter(id => id !== addonId)
          : [...item.selectedAddonIds, addonId];

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
    setAgentNotes('');
    setOverallDiscountPercent(0);
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

    const newQuote: Quotation = {
      id: `quote-${Date.now()}`,
      quoteNumber: `UBQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      title: clientName ? `Quotation for ${clientName}` : `Bespoke Itinerary Quote #${items.length} Products`,
      clientName: clientName || 'Client Name Pending',
      clientEmail,
      clientCompany,
      agentId: user?.id || 'usr-anonymous',
      agentName: user?.name || 'Travel Consultant',
      destination: items[0]?.product.destinationName || 'Multi-Destination',
      currency,
      items,
      overallDiscountPercent,
      agentNotes,
      termsAndConditions: 'Quotation valid for 14 days from generation date. Subject to hotel and guide confirmation at time of deposit.',
      status: 'DRAFT',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      validUntil: new Date(Date.now() + 86400000 * 14).toISOString(),
      totalNetCost: totals.totalNetCost,
      totalSellingPrice: totals.totalSellingPrice,
      totalTaxes: totals.totalTaxes,
      totalMargin: totals.totalMarginAmount
    };

    setSavedQuotes(prev => [newQuote, ...prev]);
    return newQuote;
  };

  const loadSavedQuote = (quote: Quotation) => {
    setItems(quote.items);
    setCurrency(quote.currency);
    setClientName(quote.clientName);
    setClientEmail(quote.clientEmail || '');
    setClientCompany(quote.clientCompany || '');
    setAgentNotes(quote.agentNotes || '');
    setOverallDiscountPercent(quote.overallDiscountPercent || 0);
    setIsQuoteDrawerOpen(true);
  };

  const deleteSavedQuote = (quoteId: string) => {
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
        toggleItemAddon,
        updateItemNotes,
        clearQuote,
        clientName,
        setClientName,
        clientEmail,
        setClientEmail,
        clientCompany,
        setClientCompany,
        agentNotes,
        setAgentNotes,
        overallDiscountPercent,
        setOverallDiscountPercent,
        ...totals,
        savedQuotes,
        saveCurrentQuote,
        loadSavedQuote,
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
