import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import { B2BPortalSidebar, B2BPortalHeader, B2BTabType } from './B2BPortalNavbar';
import { lazyWithRetry } from '../../utils/lazyWithRetry';
import { isRailProduct } from '../../services/rail/JapanRailJourneyDataService';

const B2BHomeDiscoveryView = lazyWithRetry(() => import('./B2BHomeDiscoveryView').then(m => ({ default: m.B2BHomeDiscoveryView })));
const B2BDashboardView = lazyWithRetry(() => import('./B2BDashboardView').then(m => ({ default: m.B2BDashboardView })));
const B2BWishlistManagerView = lazyWithRetry(() => import('./B2BWishlistManagerView').then(m => ({ default: m.B2BWishlistManagerView })));
const UnifiedB2BQuotationBuilder = lazyWithRetry(() => import('./UnifiedB2BQuotationBuilder').then(m => ({ default: m.UnifiedB2BQuotationBuilder })));
const B2BPackagesView = lazyWithRetry(() => import('./B2BPackagesView').then(m => ({ default: m.B2BPackagesView })));
const B2BProductsCatalogView = lazyWithRetry(() => import('./B2BProductsCatalogView').then(m => ({ default: m.B2BProductsCatalogView })));
const B2BHotelsCatalogView = lazyWithRetry(() => import('./B2BHotelsCatalogView').then(m => ({ default: m.B2BHotelsCatalogView })));
const B2BVisaView = lazyWithRetry(() => import('./B2BVisaView').then(m => ({ default: m.B2BVisaView })));
const B2BQuotesManagerView = lazyWithRetry(() => import('./B2BQuotesManagerView').then(m => ({ default: m.B2BQuotesManagerView })));
const B2BBookingsManagerView = lazyWithRetry(() => import('./B2BBookingsManagerView').then(m => ({ default: m.B2BBookingsManagerView })));
const B2BMyLeadsAndClientsCRMView = lazyWithRetry(() => import('./B2BMyLeadsAndClientsCRMView').then(m => ({ default: m.B2BMyLeadsAndClientsCRMView })));
const B2BTasksManagerView = lazyWithRetry(() => import('./B2BTasksManagerView').then(m => ({ default: m.B2BTasksManagerView })));
const B2BAccountView = lazyWithRetry(() => import('./B2BAccountView').then(m => ({ default: m.B2BAccountView })));
const B2BViewDetailsModal = lazyWithRetry(() => import('../B2BViewDetailsModal').then(m => ({ default: m.B2BViewDetailsModal })));
const AddHotelToQuoteModal = lazyWithRetry(() => import('./AddHotelToQuoteModal').then(m => ({ default: m.AddHotelToQuoteModal })));
const RailJourneyModal = lazyWithRetry(() => import('../RailJourneyModal').then(m => ({ default: m.RailJourneyModal })));
const PricingCalculatorModal = lazyWithRetry(() => import('../PricingCalculatorModal').then(m => ({ default: m.PricingCalculatorModal })));
const BookingModal = lazyWithRetry(() => import('../BookingModal').then(m => ({ default: m.BookingModal })));
const BookingConfirmationModal = lazyWithRetry(() => import('../BookingConfirmationModal').then(m => ({ default: m.BookingConfirmationModal })));
const QuoteBuilderDrawer = lazyWithRetry(() => import('../QuoteBuilderDrawer').then(m => ({ default: m.QuoteBuilderDrawer })));
const MyCashbackWalletView = lazyWithRetry(() => import('./MyCashbackWalletView').then(m => ({ default: m.MyCashbackWalletView })));
const QuoteBookingConfirmationModal = lazyWithRetry(() => import('./QuoteBookingConfirmationModal').then(m => ({ default: m.QuoteBookingConfirmationModal })));
import { Destination, Hotel, Product, B2BPackage, Quotation, B2BCustomer, CityHub, Booking, HotelRoomType, HotelRate, TravelLead } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { useAuth } from '../../context/AuthContext';
import { AppDatabase } from '../../services/db';
import { inventoryVisibilityService } from '../../services/inventoryVisibilityService';
import { canonicalImageService } from '../../services/imageService';
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

  const activeTabRef = useRef<B2BTabType>(activeTab);
  activeTabRef.current = activeTab;

  const handleTabSelect = useCallback((tab: B2BTabType) => {
    setActiveTab(tab);
    if (onTabChange) {
      onTabChange(tab);
    }
  }, [onTabChange]);

  // Global Modals State
  const [inspectingHotel, setInspectingHotel] = useState<Hotel | null>(null);
  const [configuringHotel, setConfiguringHotel] = useState<Hotel | null>(null);
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);
  const [calculatorProduct, setCalculatorProduct] = useState<Product | null>(null);
  const [railConfiguringProduct, setRailConfiguringProduct] = useState<Product | null>(null);
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

  const showToast = useCallback((title: string, subtitle?: string) => {
    setToastMessage({ title, subtitle });
    setTimeout(() => {
      setToastMessage(null);
    }, 3500);
  }, []);

  const [hubsTick, setHubsTick] = useState(0);
  const [, setPortalTick] = useState(0);

  useEffect(() => {
    const unsubDb = db.subscribeToCollections([
      'destinations',
      'regions',
      'city_hubs',
      'products',
      'hotels',
      'visas',
      'b2b_packages',
      'transfer_routes',
      'travel_protection_plans',
      'vip_ground_services',
      'connectivity_plans',
      'inventory_tombstones'
    ], () => setHubsTick(t => t + 1));
    const unsubImg = canonicalImageService.subscribe(() => {
      if (activeTabRef.current === 'create-quote') return;
      setPortalTick(t => t + 1);
    });
    return () => {
      unsubDb();
      unsubImg();
    };
  }, [db]);

  const b2bDestinations: Destination[] = useMemo(() => {
    return inventoryVisibilityService.getB2BActiveDestinations();
  }, [destinations, hubsTick]);

  const b2bHotels: Hotel[] = useMemo(() => {
    return inventoryVisibilityService.getB2BActiveHotels();
  }, [hotels, destinations, hubsTick]);

  const b2bProducts: Product[] = useMemo(() => {
    return inventoryVisibilityService.getB2BActiveProducts();
  }, [products, destinations, hubsTick]);

  const cityHubs: CityHub[] = useMemo(() => {
    return inventoryVisibilityService.getB2BActiveHubs();
  }, [destinations, hubsTick]);

  const [targetQuoteIdForBuilder, setTargetQuoteIdForBuilder] = useState<string | null>(null);
  const [targetQuoteVersionForBuilder, setTargetQuoteVersionForBuilder] = useState<number | undefined>(undefined);
  const [targetQuoteModeForBuilder, setTargetQuoteModeForBuilder] = useState<'inspect' | 'edit' | 'readonly' | 'restore'>('inspect');

  const { 
    items, 
    clearQuote, 
    addProductToQuote, 
    setClientDetails, 
    setQuotationDates, 
    setDestination, 
    loadSavedQuote,
    loadPackageIntoQuote,
    quoteSource,
    sourcePackageId,
    setIsQuoteDrawerOpen,
    loadAiPlannerPayload,
    setLeadId,
    currency
  } = useQuotation();

  // Scroll to top when switching non-builder tabs & ensure Cart Drawer closes on entering Quote Builder
  useEffect(() => {
    if (activeTab === 'create-quote') {
      setIsQuoteDrawerOpen(false);
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }, [activeTab, setIsQuoteDrawerOpen]);

  const handleNavigate = (tab: string) => {
    const tabMap: Record<string, B2BTabType> = {
      'HOME': 'home',
      'home': 'home',
      'DISCOVERY': 'home',
      'discovery': 'home',
      'DASHBOARD': 'dashboard',
      'dashboard': 'dashboard',
      'WISHLIST': 'wishlist',
      'wishlist': 'wishlist',
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
      'MY_CASHBACK': 'my-cashback',
      'my-cashback': 'my-cashback',
      'ACCOUNT': 'account',
      'account': 'account'
    };
    const target = tabMap[tab] || (tab as B2BTabType);
    setActiveTab(target);
  };

  const handleOpenCreateQuote = (destSlug?: string) => {
    clearQuote();
    setTargetQuoteIdForBuilder(null);
    setTargetQuoteVersionForBuilder(undefined);
    setTargetQuoteModeForBuilder('edit');
    if (destSlug) {
      setInitialDestinationSlug(destSlug);
    } else {
      setInitialDestinationSlug(undefined);
    }
    setActiveTab('create-quote');
  };

  const handleCustomizePackage = (pkg: B2BPackage) => {
    clearQuote();
    loadPackageIntoQuote(pkg);
    setTargetQuoteIdForBuilder(null);
    setTargetQuoteVersionForBuilder(undefined);
    setTargetQuoteModeForBuilder('edit');
    setInitialDestinationSlug(undefined);

    showToast(
      'Package Loaded into Quote Builder',
      `${pkg.title} (${pkg.durationDays}D/${pkg.durationNights}N)`
    );
    setActiveTab('create-quote');
  };

  const handleEditQuote = (quote: Quotation) => {
    loadSavedQuote(quote);
    setTargetQuoteIdForBuilder(quote.id);
    setTargetQuoteVersionForBuilder(quote.latestVersion || quote.version);
    setTargetQuoteModeForBuilder(quote.isLocked ? 'inspect' : 'edit');
    setActiveTab('create-quote');
  };

  const handleOpenQuoteVersion = (
    quoteId: string,
    options?: { version?: number; mode?: 'inspect' | 'edit' | 'readonly' | 'restore'; leadId?: string }
  ) => {
    const targetQuote = db.getQuoteByIdAuthorized(quoteId, user);
    if (targetQuote) {
      loadSavedQuote(targetQuote);
    }
    setTargetQuoteIdForBuilder(quoteId);
    setTargetQuoteVersionForBuilder(options?.version);
    setTargetQuoteModeForBuilder(options?.mode || 'inspect');
    if (options?.leadId) {
      setLeadId(options.leadId);
    }
    setActiveTab('create-quote');
  };

  const handleRestoreQuoteVersion = (quoteId: string, version: number) => {
    handleOpenQuoteVersion(quoteId, { version, mode: 'restore' });
    showToast(`Restoring v${version} as Unsaved Draft`, 'Review and click Save Draft to create a new saved version.');
  };

  const handleQuoteSaved = useCallback((savedQuote: Quotation) => {
    if (!savedQuote?.id) return;
    setTargetQuoteIdForBuilder(savedQuote.id);
    setTargetQuoteVersionForBuilder(savedQuote.latestVersion || savedQuote.version || 1);
    setTargetQuoteModeForBuilder('edit');
  }, []);

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

  const [pendingQuoteBookingConfirm, setPendingQuoteBookingConfirm] = useState<Quotation | null>(null);

  const handleConvertToBooking = useCallback((quote: Quotation) => {
    setPendingQuoteBookingConfirm(quote);
  }, []);

  const handleBackToDashboardFromBuilder = useCallback(() => {
    handleTabSelect('dashboard');
  }, [handleTabSelect]);

  const handleViewMyQuotesFromBuilder = useCallback(() => {
    handleTabSelect('my-quotes');
  }, [handleTabSelect]);

  const handleNavigateToPackagesFromBuilder = useCallback(() => {
    handleTabSelect('packages');
  }, [handleTabSelect]);

  // Guarded modal & booking openers (fail-closed for non-active destinations)
  const openProductDetailsGuarded = useCallback((prod: Product) => {
    if (!inventoryVisibilityService.isEntityAccessibleInB2B('PRODUCT', prod)) {
      showToast('Unavailable in B2B Portal', `"${prod.name}" belongs to a non-active destination.`);
      return;
    }
    setInspectingProduct(prod);
  }, [showToast]);

  const openHotelDetailsGuarded = useCallback((hotel: Hotel) => {
    if (!inventoryVisibilityService.isEntityAccessibleInB2B('HOTEL', hotel)) {
      showToast('Unavailable in B2B Portal', `"${hotel.name}" belongs to a non-active destination.`);
      return;
    }
    setInspectingHotel(hotel);
  }, [showToast]);

  const openPackageDetailsGuarded = useCallback((pkg: B2BPackage) => {
    if (!inventoryVisibilityService.isEntityAccessibleInB2B('PACKAGE', pkg)) {
      showToast('Unavailable in B2B Portal', `"${pkg.title}" includes a non-active destination.`);
      return;
    }
    setInspectingPackage(pkg);
  }, [showToast]);

  // Instant booking handlers
  const handleBookProductDirect = (prod: Product) => {
    if (!inventoryVisibilityService.isEntityAccessibleInB2B('PRODUCT', prod)) {
      showToast('Booking Blocked', `"${prod.name}" is unavailable because its destination is not Active.`);
      return;
    }
    setInspectingProduct(null);
    setCalculatorProduct(null);
    setBookingItem({ product: prod });
  };

  const handleBookHotelDirect = (hotel: Hotel, roomType?: HotelRoomType, rate?: HotelRate, nights?: number) => {
    if (!inventoryVisibilityService.isEntityAccessibleInB2B('HOTEL', hotel)) {
      showToast('Booking Blocked', `"${hotel.name}" is unavailable because its destination is not Active.`);
      return;
    }
    setInspectingHotel(null);
    const room = roomType || hotel.roomTypes?.[0];
    const roomRate = rate || room?.rates?.[0];
    const hotelProd = room && roomRate ? hotelToProduct(hotel, room, roomRate, nights || 3) : null;
    if (hotelProd) {
      setBookingItem({ product: hotelProd });
    }
  };

  const handleBookPackageDirect = (pkg: B2BPackage) => {
    if (!inventoryVisibilityService.isEntityAccessibleInB2B('PACKAGE', pkg)) {
      showToast('Booking Blocked', `"${pkg.title}" is unavailable because a mapped destination is not Active.`);
      return;
    }
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
        <Suspense
          fallback={
            <div className="w-full min-h-[360px] flex flex-col items-center justify-center p-10 text-slate-400 gap-3">
              <div className="w-8 h-8 rounded-full border-2 border-[#00C6A6] border-t-transparent animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Loading workspace module...</span>
            </div>
          }
        >
        {activeTab === 'home' && (
          <B2BHomeDiscoveryView
            destinations={b2bDestinations}
            hotels={b2bHotels}
            products={b2bProducts}
            cityHubs={cityHubs}
            onNavigate={handleNavigate}
            onOpenCreateQuoteWithDestination={handleOpenCreateQuote}
            onOpenPackageCustomizer={handleCustomizePackage}
            onViewProductDetails={openProductDetailsGuarded}
            onViewHotelDetails={openHotelDetailsGuarded}
            onViewPackageDetails={openPackageDetailsGuarded}
            onOpenCalculator={(prod) => {
              if (!inventoryVisibilityService.isEntityAccessibleInB2B('PRODUCT', prod)) {
                showToast('Unavailable in B2B Portal', `"${prod.name}" belongs to a non-active destination.`);
                return;
              }
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

        {activeTab === 'wishlist' && (
          <B2BWishlistManagerView
            products={products}
            hotels={hotels}
            onNavigate={handleNavigate}
            onViewProductDetails={(prod) => setInspectingProduct(prod)}
            onViewHotelDetails={(hotel) => setInspectingHotel(hotel)}
            onViewPackageDetails={(pkg) => setInspectingPackage(pkg)}
            onConfigureProduct={(prod) => {
              if (isRailProduct(prod)) {
                setRailConfiguringProduct(prod);
              } else {
                setCalculatorProduct(prod);
              }
            }}
            onConfigureHotel={(hotel) => setConfiguringHotel(hotel)}
            onConfigurePackage={handleCustomizePackage}
            onItemAddedToQuote={(msg) => showToast(msg)}
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
              isNewQuoteMode={!targetQuoteIdForBuilder && quoteSource !== 'PACKAGE' && !sourcePackageId}
              onBackToDashboard={handleBackToDashboardFromBuilder}
              onViewMyQuotes={handleViewMyQuotesFromBuilder}
              onNavigateToPackages={handleNavigateToPackagesFromBuilder}
              onConvertToBooking={handleConvertToBooking}
              onQuoteSaved={handleQuoteSaved}
            />
          )
        )}

        {activeTab === 'packages' && (
          <B2BPackagesView
            onCustomizePackage={handleCustomizePackage}
            onOpenCreateQuote={() => handleOpenCreateQuote()}
            onViewPackageDetails={openPackageDetailsGuarded}
          />
        )}

        {activeTab === 'products' && (
          <B2BProductsCatalogView
            products={b2bProducts}
            destinations={b2bDestinations}
            onOpenCreateQuote={() => handleOpenCreateQuote()}
            onViewProductDetails={openProductDetailsGuarded}
          />
        )}

        {activeTab === 'hotels' && (
          <B2BHotelsCatalogView
            hotels={b2bHotels}
            destinations={b2bDestinations}
            onOpenCreateQuote={() => handleOpenCreateQuote()}
            onViewHotelDetails={openHotelDetailsGuarded}
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
            onOpenQuoteVersion={handleOpenQuoteVersion}
            onRestoreQuoteVersion={handleRestoreQuoteVersion}
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
            onOpenQuoteVersion={handleOpenQuoteVersion}
            onRestoreQuoteVersion={handleRestoreQuoteVersion}
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

        {activeTab === 'my-cashback' && (
          <MyCashbackWalletView />
        )}
        </Suspense>
      </main>

      <Suspense fallback={null}>
      {/* Global Hotel Details & Stay Modal */}
      {inspectingHotel && (
        <B2BViewDetailsModal
          hotel={inspectingHotel}
          onClose={() => setInspectingHotel(null)}
          onConfigureHotel={(h) => {
            setInspectingHotel(null);
            setConfiguringHotel(h);
          }}
          onInstantBookHotel={(h, r, rate, nights) => handleBookHotelDirect(h, r, rate, nights)}
        />
      )}

      {/* Global Hotel Configuration & Add To Quote Modal */}
      {configuringHotel && (
        <AddHotelToQuoteModal
          hotel={configuringHotel}
          isOpen={!!configuringHotel}
          onClose={() => setConfiguringHotel(null)}
          onSuccess={(h, details) => {
            showToast('Stay Added to Quotation', h.name);
          }}
        />
      )}

      {/* Global Product Details Modal (Unified Read-Only Information Modal for ALL Products) */}
      {inspectingProduct && (
        <B2BViewDetailsModal
          product={inspectingProduct}
          onClose={() => setInspectingProduct(null)}
          onOpenCalculator={(p) => {
            setInspectingProduct(null);
            if (isRailProduct(p)) {
              setRailConfiguringProduct(p);
            } else {
              setCalculatorProduct(p);
            }
          }}
          onBookProduct={(p) => handleBookProductDirect(p)}
        />
      )}

      {/* Dynamic Japan Rail Journey Configurator */}
      {railConfiguringProduct && (
        <RailJourneyModal
          product={railConfiguringProduct}
          portalOrigin="B2B_AGENT"
          onClose={() => setRailConfiguringProduct(null)}
          onAddToQuote={() => {
            setRailConfiguringProduct(null);
            setIsQuoteDrawerOpen(true);
          }}
          onInstantBook={(p) => {
            setRailConfiguringProduct(null);
            handleBookProductDirect(p);
          }}
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
        <B2BViewDetailsModal
          packageItem={inspectingPackage}
          onClose={() => setInspectingPackage(null)}
          onCustomizePackage={(pkg) => {
            setInspectingPackage(null);
            handleCustomizePackage(pkg);
          }}
          onInstantBookPackage={(pkg) => {
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

      {/* Quotation-to-Booking Confirmation & Promotion Validation Modal */}
      {pendingQuoteBookingConfirm && (
        <QuoteBookingConfirmationModal
          isOpen={true}
          quote={pendingQuoteBookingConfirm}
          user={user}
          onClose={() => setPendingQuoteBookingConfirm(null)}
          onConfirmBooking={async (finalizedQuote, specialNotes) => {
            const booking = await db.convertQuotationToBookingAsync(finalizedQuote, user, specialNotes);
            if (booking) {
              handleBookingCompleted(booking);
            }
            return booking;
          }}
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
      </Suspense>
      </div>
    </div>
  );
};
