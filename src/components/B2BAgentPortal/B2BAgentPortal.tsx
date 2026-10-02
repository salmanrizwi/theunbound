import React, { useState, useEffect, useMemo } from 'react';
import { B2BPortalSidebar, B2BPortalHeader, B2BTabType } from './B2BPortalNavbar';
import { B2BHomeDiscoveryView } from './B2BHomeDiscoveryView';
import { B2BDashboardView } from './B2BDashboardView';
import { UnifiedB2BQuotationBuilder } from './UnifiedB2BQuotationBuilder';
import { B2BPackagesView } from './B2BPackagesView';
import { B2BProductsCatalogView } from './B2BProductsCatalogView';
import { B2BHotelsCatalogView } from './B2BHotelsCatalogView';
import { B2BVisaView } from './B2BVisaView';
import { B2BQuotesManagerView } from './B2BQuotesManagerView';
import { B2BBookingsManagerView } from './B2BBookingsManagerView';
import { B2BLeadsManagerView } from './B2BLeadsManagerView';
import { B2BCustomersCRMView } from './B2BCustomersCRMView';
import { B2BMyLeadsAndClientsCRMView } from './B2BMyLeadsAndClientsCRMView';
import { B2BTasksManagerView } from './B2BTasksManagerView';
import { B2BAccountView } from './B2BAccountView';
import { HotelDetailModal } from '../HotelDetailModal';
import { ProductDetailModal } from '../ProductDetailModal';
import { RailJourneyModal } from '../RailJourneyModal';
import { PackageDetailModal } from '../PackageDetailModal';
import { PricingCalculatorModal } from '../PricingCalculatorModal';
import { isRailProduct } from '../../services/rail/JapanRailJourneyDataService';
import { BookingModal } from '../BookingModal';
import { BookingConfirmationModal } from '../BookingConfirmationModal';
import { QuoteBuilderDrawer } from '../QuoteBuilderDrawer';
import { Destination, Hotel, Product, B2BPackage, Quotation, B2BCustomer, CityHub, Booking, HotelRoomType, HotelRate, TravelLead } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { AppDatabase } from '../../services/db';
import { hotelToProduct } from '../../utils/hotelHelpers';
import { canUserAccessQuoteBuilder } from '../../services/permissionEngine';
import { CheckCircle2, ArrowRight, X, Lock } from 'lucide-react';

interface B2BAgentPortalProps {
  destinations: Destination[];
  hotels: Hotel[];
  products: Product[];
  onOpenBookingModal?: (quote?: Quotation) => void;
  initialTab?: B2BTabType;
  onTabChange?: (tab: B2BTabType) => void;
}

export const B2BAgentPortal: React.FC<B2BAgentPortalProps> = ({
  destinations = [],
  hotels = [],
  products = [],
  onOpenBookingModal,
  initialTab = 'home',
  onTabChange
}) => {
  const [activeTab, setActiveTab] = useState<B2BTabType>(initialTab);
  const [initialDestinationSlug, setInitialDestinationSlug] = useState<string | undefined>(undefined);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  useEffect(() => {
    if (initialTab && initialTab !== activeTab) {
      setActiveTab(initialTab);
    }
  }, [initialTab]);

  const handleTabSelect = (tab: B2BTabType) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  };

  // Global Modals State
  const [inspectingHotel, setInspectingHotel] = useState<Hotel | null>(null);
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);
  const [calculatorProduct, setCalculatorProduct] = useState<Product | null>(null);
  const [inspectingPackage, setInspectingPackage] = useState<B2BPackage | null>(null);
  
  // Booking Modal State
  const [bookingItem, setBookingItem] = useState<{
    product?: Product | null;
    quotation?: Quotation | null;
    packageItem?: B2BPackage | null;
  } | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  // Toast Notification State
  const [toastMessage, setToastMessage] = useState<{ title: string; subtitle?: string } | null>(null);

  const showToast = (title: string, subtitle?: string) => {
    setToastMessage({ title, subtitle });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  };

  const cityHubs: CityHub[] = useMemo(() => {
    return db.getCityHubs() || [];
  }, [db]);

  const [targetQuoteIdForBuilder, setTargetQuoteIdForBuilder] = useState<string | null>(null);
  const [targetQuoteVersionForBuilder, setTargetQuoteVersionForBuilder] = useState<number | undefined>(undefined);
  const [targetQuoteModeForBuilder, setTargetQuoteModeForBuilder] = useState<'inspect' | 'edit' | 'readonly'>('inspect');

  const { 
    items, 
    clearQuote, 
    addProductToQuote, 
    setClientDetails, 
    setQuotationDates, 
    setDestination, 
    loadSavedQuote,
    setIsQuoteDrawerOpen,
    loadAiPlannerPayload,
    setLeadId,
    currency
  } = useQuotation();

  // Scroll to top when tab changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeTab]);

  const handleNavigate = (tab: string) => {
    const tabMap: Record<string, B2BTabType> = {
      'HOME': 'home',
      'home': 'home',
      'DISCOVERY': 'home',
      'discovery': 'home',
      'DASHBOARD': 'dashboard',
      'dashboard': 'dashboard',
      'CREATE_QUOTE': 'create-quote',
      'create-quote': 'create-quote',
      'PACKAGES': 'packages',
      'packages': 'packages',
      'PRODUCTS': 'products',
      'products': 'products',
      'HOTELS': 'hotels',
      'hotels': 'hotels',
      'VISA': 'visa',
      'visa': 'visa',
      'VISAS': 'visa',
      'visas': 'visa',
      'MY_QUOTES': 'my-quotes',
      'my-quotes': 'my-quotes',
      'BOOKINGS': 'bookings',
      'bookings': 'bookings',
      'CRM': 'crm',
      'crm': 'crm',
      'LEADS': 'crm',
      'leads': 'crm',
      'assigned-leads': 'crm',
      'CUSTOMERS': 'crm',
      'customers': 'crm',
      'TASKS': 'tasks',
      'tasks': 'tasks',
      'ACCOUNT': 'account',
      'account': 'account'
    };
    const target = tabMap[tab] || (tab as B2BTabType);
    setActiveTab(target);
  };

  const handleOpenCreateQuote = (destSlug?: string) => {
    setTargetQuoteIdForBuilder(null);
    setTargetQuoteVersionForBuilder(undefined);
    setTargetQuoteModeForBuilder('edit');
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

    showToast('Package Imported to Quote Builder', `${pkg.title} (${pkg.durationDays}D/${pkg.durationNights}N)`);
    // 4. Switch to quotation builder step
    setActiveTab('create-quote');
  };

  const handleEditQuote = (quote: Quotation) => {
    loadSavedQuote(quote);
    setTargetQuoteIdForBuilder(quote.id);
    setTargetQuoteVersionForBuilder(quote.version);
    setTargetQuoteModeForBuilder(quote.isLocked ? 'inspect' : 'edit');
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

  const handleCreateQuoteForLead = (lead: TravelLead) => {
    setClientDetails(
      lead.contactName || '',
      lead.email || '',
      lead.phone || '',
      lead.companyName || lead.agencyName || ''
    );
    if (lead.destinationName || lead.destinationId) {
      setDestination(lead.destinationName || lead.destinationId || '');
    }
    if (lead.id) {
      setLeadId(lead.id);
    }
    showToast('Quote Builder Ready', `Prepopulated from assigned Lead ${lead.leadNumber || lead.contactName}`);
    setActiveTab('create-quote');
  };

  const handleConvertToBooking = (quote: Quotation) => {
    setBookingItem({ quotation: quote });
  };

  // Instant booking handlers
  const handleBookProductDirect = (prod: Product) => {
    setInspectingProduct(null);
    setCalculatorProduct(null);
    setBookingItem({ product: prod });
  };

  const handleBookHotelDirect = (hotel: Hotel, roomType?: HotelRoomType, rate?: HotelRate, nights?: number) => {
    setInspectingHotel(null);
    const room = roomType || hotel.roomTypes?.[0];
    const roomRate = rate || room?.rates?.[0];
    const hotelProd = room && roomRate ? hotelToProduct(hotel, room, roomRate, nights || 3) : null;
    if (hotelProd) {
      setBookingItem({ product: hotelProd });
    }
  };

  const handleBookPackageDirect = (pkg: B2BPackage) => {
    setInspectingPackage(null);
    setBookingItem({ packageItem: pkg });
  };

  const handleBookingCompleted = (booking: Booking) => {
    setBookingItem(null);
    setConfirmedBooking(booking);
  };

  return (
    <div className="flex h-screen w-full max-w-full overflow-hidden bg-slate-100 font-sans text-slate-900 selection:bg-[#00C6A6] selection:text-slate-950">
      {/* Persistent Left Sidebar Navigation */}
      <B2BPortalSidebar
        activeTab={activeTab}
        onSelectTab={handleTabSelect}
        isMobileOpen={isMobileMenuOpen}
        onCloseMobile={() => setIsMobileMenuOpen(false)}
      />

      {/* Main Workspace Column */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto w-full">
        {/* Sticky Top Header Bar */}
        <B2BPortalHeader
          activeTab={activeTab}
          onSelectTab={handleTabSelect}
          onToggleMobileMenu={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          onOpenCreateQuote={() => handleOpenCreateQuote()}
        />

        {/* Floating Success Feedback Toast */}
        {toastMessage && (
          <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-[#00C6A6]/40 flex items-center space-x-3.5 animate-in slide-in-from-bottom-5 duration-200">
            <div className="w-8 h-8 rounded-xl bg-[#00C6A6]/20 text-[#00E5C0] flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="pr-2">
              <p className="text-xs font-black text-white">{toastMessage.title}</p>
              {toastMessage.subtitle && (
                <p className="text-[11px] text-slate-400 font-medium">{toastMessage.subtitle}</p>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  setToastMessage(null);
                  setIsQuoteDrawerOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 text-xs font-black transition-colors flex items-center space-x-1 cursor-pointer"
              >
                <span>View Cart ({items.length})</span>
              </button>
            </div>
            <button
              onClick={() => setToastMessage(null)}
              className="text-slate-500 hover:text-white p-1 rounded-md cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 w-full min-w-0 max-w-full pb-16">
        {activeTab === 'home' && (
          <B2BHomeDiscoveryView
            destinations={destinations}
            hotels={hotels}
            products={products}
            cityHubs={cityHubs}
            onNavigate={handleNavigate}
            onOpenCreateQuoteWithDestination={handleOpenCreateQuote}
            onOpenPackageCustomizer={handleCustomizePackage}
            onViewProductDetails={(prod) => setInspectingProduct(prod)}
            onViewHotelDetails={(hotel) => setInspectingHotel(hotel)}
            onViewPackageDetails={(pkg) => setInspectingPackage(pkg)}
            onOpenCalculator={(prod) => {
              if (isRailProduct(prod)) {
                setInspectingProduct(prod);
              } else {
                setCalculatorProduct(prod);
              }
            }}
            onItemAddedToQuote={(itemName) => showToast('Added to Quotation', itemName)}
          />
        )}

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
          !canUserAccessQuoteBuilder(user, 'B2B').allowed ? (
            <div className="max-w-xl mx-auto my-12 p-8 bg-white border border-rose-200 rounded-3xl text-center space-y-4 shadow-lg">
              <div className="w-14 h-14 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto border border-rose-100">
                <Lock className="w-6 h-6" />
              </div>
              <h2 className="text-xl font-black text-slate-900">B2B Quote Builder Access Restricted</h2>
              <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
                {canUserAccessQuoteBuilder(user, 'B2B').reason || 'Your agency account is not authorized to access the B2B Quotation Builder. Please contact your TheUnbound account manager.'}
              </p>
              <button
                onClick={() => handleTabSelect('dashboard')}
                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
              >
                Return to Dashboard
              </button>
            </div>
          ) : (
            <UnifiedB2BQuotationBuilder
              initialDestinationSlug={initialDestinationSlug}
              destinations={destinations}
              hotels={hotels}
              products={products}
              cityHubs={cityHubs}
              targetQuoteId={targetQuoteIdForBuilder || undefined}
              targetQuoteVersion={targetQuoteVersionForBuilder}
              initialMode={targetQuoteModeForBuilder}
              isNewQuoteMode={!targetQuoteIdForBuilder}
              onBackToDashboard={() => handleTabSelect('dashboard')}
              onViewMyQuotes={() => handleTabSelect('my-quotes')}
              onConvertToBooking={handleConvertToBooking}
            />
          )
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

        {activeTab === 'visa' && (
          <B2BVisaView
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

        {(activeTab === 'crm' || activeTab === 'leads' || activeTab === 'customers') && (
          <B2BMyLeadsAndClientsCRMView
            initialSubView={activeTab === 'customers' ? 'clients' : 'assigned-leads'}
            onCreateQuoteFromLead={handleCreateQuoteForLead}
            onCreateQuoteForCustomer={handleCreateQuoteForCustomer}
            onNavigateToBooking={() => {
              setActiveTab('bookings');
            }}
          />
        )}

        {activeTab === 'tasks' && (
          <B2BTasksManagerView />
        )}

        {activeTab === 'account' && (
          <B2BAccountView />
        )}
      </main>

      {/* Global Hotel Details & Stay Modal */}
      {inspectingHotel && (
        <HotelDetailModal
          hotel={inspectingHotel}
          onClose={() => setInspectingHotel(null)}
          onInstantBook={(h, r, rate, nights) => handleBookHotelDirect(h, r, rate, nights)}
        />
      )}

      {/* Dynamic Japan Rail Journey Configurator */}
      {inspectingProduct && isRailProduct(inspectingProduct) && (
        <RailJourneyModal
          product={inspectingProduct}
          portalOrigin="B2B_AGENT"
          onClose={() => setInspectingProduct(null)}
          onAddToQuote={() => {
            setInspectingProduct(null);
            setIsQuoteDrawerOpen(true);
          }}
          onInstantBook={(p) => {
            setInspectingProduct(null);
            handleBookProductDirect(p);
          }}
        />
      )}

      {/* Global Product Details Modal */}
      {inspectingProduct && !isRailProduct(inspectingProduct) && (
        <ProductDetailModal
          product={inspectingProduct}
          onClose={() => setInspectingProduct(null)}
          onOpenCalculator={(p) => {
            setInspectingProduct(null);
            setCalculatorProduct(p);
          }}
          onBookProduct={(p) => handleBookProductDirect(p)}
        />
      )}

      {/* Global Pricing Calculator Modal */}
      {calculatorProduct && !isRailProduct(calculatorProduct) && (
        <PricingCalculatorModal
          product={calculatorProduct}
          onClose={() => setCalculatorProduct(null)}
          onAddedToQuote={() => {
            setCalculatorProduct(null);
            showToast('Added to Quotation', calculatorProduct.name);
          }}
        />
      )}

      {/* Global Package Itinerary Modal */}
      {inspectingPackage && (
        <PackageDetailModal
          packageItem={inspectingPackage}
          onClose={() => setInspectingPackage(null)}
          onCustomizePackage={(pkg) => {
            setInspectingPackage(null);
            handleCustomizePackage(pkg);
          }}
          onInstantBook={(pkg) => {
            setInspectingPackage(null);
            handleBookPackageDirect(pkg);
          }}
        />
      )}

      {/* Global Direct Booking Modal */}
      {bookingItem && (
        <BookingModal
          isOpen={true}
          onClose={() => setBookingItem(null)}
          product={bookingItem.product || null}
          quotation={bookingItem.quotation || null}
          packageItem={bookingItem.packageItem || null}
          currentUser={user}
          onBookingComplete={handleBookingCompleted}
        />
      )}

      {/* Global Booking Confirmation Modal */}
      {confirmedBooking && (
        <BookingConfirmationModal
          isOpen={true}
          onClose={() => setConfirmedBooking(null)}
          booking={confirmedBooking}
          onOpenMyBookings={() => {
            setConfirmedBooking(null);
            setActiveTab('bookings');
          }}
        />
      )}

      {/* Global Left-Side B2B Cart Drawer */}
      <QuoteBuilderDrawer
        onBookQuote={(booking: Booking) => setConfirmedBooking(booking)}
        onNavigateToQuoteBuilder={() => setActiveTab('create-quote')}
        onNavigateToCatalog={(tab) => setActiveTab(tab as B2BTabType)}
      />
      </div>
    </div>
  );
};
