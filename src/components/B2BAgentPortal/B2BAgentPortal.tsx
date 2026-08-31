import React, { useState, useEffect, useMemo } from 'react';
import { B2BPortalNavbar, B2BTabType } from './B2BPortalNavbar';
import { B2BDashboardView } from './B2BDashboardView';
import { UnifiedB2BQuotationBuilder } from './UnifiedB2BQuotationBuilder';
import { B2BPackagesView } from './B2BPackagesView';
import { B2BProductsCatalogView } from './B2BProductsCatalogView';
import { B2BHotelsCatalogView } from './B2BHotelsCatalogView';
import { B2BQuotesManagerView } from './B2BQuotesManagerView';
import { B2BBookingsManagerView } from './B2BBookingsManagerView';
import { B2BCustomersCRMView } from './B2BCustomersCRMView';
import { B2BTasksManagerView } from './B2BTasksManagerView';
import { B2BAccountView } from './B2BAccountView';
import { Destination, Hotel, Product, B2BPackage, Quotation, B2BCustomer, CityHub } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { AppDatabase } from '../../services/db';

interface B2BAgentPortalProps {
  destinations: Destination[];
  hotels: Hotel[];
  products: Product[];
  onOpenBookingModal?: (quote?: Quotation) => void;
  onSwitchToBuyerMode?: () => void;
}

export const B2BAgentPortal: React.FC<B2BAgentPortalProps> = ({
  destinations = [],
  hotels = [],
  products = [],
  onOpenBookingModal,
  onSwitchToBuyerMode
}) => {
  const [activeTab, setActiveTab] = useState<B2BTabType>('dashboard');
  const [initialDestinationSlug, setInitialDestinationSlug] = useState<string | undefined>(undefined);
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const cityHubs: CityHub[] = useMemo(() => {
    return db.getCityHubs() || [];
  }, [db]);

  const { 
    items, 
    clearQuote, 
    addProductToQuote, 
    setClientDetails, 
    setQuotationDates, 
    setDestination, 
    loadSavedQuote 
  } = useQuotation();

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleNavigate = (tab: string) => {
    const tabMap: Record<string, B2BTabType> = {
      'CREATE_QUOTE': 'create-quote',
      'create-quote': 'create-quote',
      'PACKAGES': 'packages',
      'packages': 'packages',
      'PRODUCTS': 'products',
      'products': 'products',
      'HOTELS': 'hotels',
      'hotels': 'hotels',
      'MY_QUOTES': 'my-quotes',
      'my-quotes': 'my-quotes',
      'BOOKINGS': 'bookings',
      'bookings': 'bookings',
      'CUSTOMERS': 'customers',
      'customers': 'customers',
      'TASKS': 'tasks',
      'tasks': 'tasks',
      'ACCOUNT': 'account',
      'account': 'account',
      'DASHBOARD': 'dashboard',
      'dashboard': 'dashboard'
    };
    const target = tabMap[tab] || (tab as B2BTabType);
    setActiveTab(target);
  };

  const handleOpenCreateQuote = (destSlug?: string) => {
    if (destSlug) {
      setInitialDestinationSlug(destSlug);
    }
    setActiveTab('create-quote');
  };

  const handleCustomizePackage = (pkg: B2BPackage) => {
    // 1. Clear active quote
    clearQuote();

    // 2. Set Destination & Dates
    setDestination(pkg.destinationName);
    setQuotationDates('2026-05-10', '2026-05-20');

    // 3. Find corresponding products and add them to quote
    const destProducts = products.filter(p => 
      p.destinationName.toLowerCase().includes(pkg.destinationName.toLowerCase()) ||
      p.country.toLowerCase().includes(pkg.destinationName.toLowerCase())
    );

    if (destProducts.length > 0) {
      destProducts.slice(0, 4).forEach(prod => {
        addProductToQuote(prod, { adults: 2, children: 0, infants: 0 });
      });
    }

    // 4. Switch to quotation builder step
    setActiveTab('create-quote');
  };

  const handleEditQuote = (quote: Quotation) => {
    loadSavedQuote(quote);
    setActiveTab('create-quote');
  };

  const handleCreateQuoteForCustomer = (customer: B2BCustomer) => {
    setClientDetails(
      customer.name,
      customer.email,
      customer.phone,
      customer.company
    );
    if (customer.preferredDestination) {
      setDestination(customer.preferredDestination);
    }
    setActiveTab('create-quote');
  };

  const handleConvertToBooking = (quote: Quotation) => {
    if (onOpenBookingModal) {
      onOpenBookingModal(quote);
    } else {
      setActiveTab('bookings');
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900 selection:bg-[#00C6A6] selection:text-slate-950">
      {/* Dedicated B2B Navigation */}
      <B2BPortalNavbar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        quoteItemCount={items.length}
        onSwitchToBuyerMode={onSwitchToBuyerMode}
      />

      {/* Main Content Area */}
      <main className="flex-1 pb-16">
        {activeTab === 'dashboard' && (
          <B2BDashboardView
            onNavigate={handleNavigate}
            onOpenCreateQuoteWithDestination={handleOpenCreateQuote}
            onOpenPackageCustomizer={handleCustomizePackage}
            onLoadQuote={handleEditQuote}
            destinations={destinations}
            products={products}
            hotels={hotels}
          />
        )}

        {activeTab === 'create-quote' && (
          <UnifiedB2BQuotationBuilder
            initialDestinationSlug={initialDestinationSlug}
            destinations={destinations}
            hotels={hotels}
            products={products}
            cityHubs={cityHubs}
            onBackToDashboard={() => setActiveTab('dashboard')}
            onViewMyQuotes={() => setActiveTab('my-quotes')}
            onConvertToBooking={handleConvertToBooking}
          />
        )}

        {activeTab === 'packages' && (
          <B2BPackagesView
            onCustomizePackage={handleCustomizePackage}
            onOpenCreateQuote={() => handleOpenCreateQuote()}
          />
        )}

        {activeTab === 'products' && (
          <B2BProductsCatalogView
            products={products}
            destinations={destinations}
            onOpenCreateQuote={() => handleOpenCreateQuote()}
          />
        )}

        {activeTab === 'hotels' && (
          <B2BHotelsCatalogView
            hotels={hotels}
            destinations={destinations}
            onOpenCreateQuote={() => handleOpenCreateQuote()}
          />
        )}

        {activeTab === 'my-quotes' && (
          <B2BQuotesManagerView
            onOpenCreateQuote={() => handleOpenCreateQuote()}
            onEditQuote={handleEditQuote}
            onConvertToBooking={handleConvertToBooking}
          />
        )}

        {activeTab === 'bookings' && (
          <B2BBookingsManagerView
            onOpenCreateQuote={() => handleOpenCreateQuote()}
          />
        )}

        {activeTab === 'customers' && (
          <B2BCustomersCRMView
            onCreateQuoteForCustomer={handleCreateQuoteForCustomer}
          />
        )}

        {activeTab === 'tasks' && (
          <B2BTasksManagerView />
        )}

        {activeTab === 'account' && (
          <B2BAccountView />
        )}
      </main>
    </div>
  );
};
