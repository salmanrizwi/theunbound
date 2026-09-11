import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QuotationProvider, useQuotation } from './context/QuotationContext';
import { RosterProvider } from './context/RosterContext';
import { AppDatabase } from './services/db';
import { Product, Destination, Quotation, Booking, Hotel, FooterConfig } from './types';
import { Navbar, MainNavTab } from './components/Navbar';
import { DestinationPage } from './pages/DestinationPage';
import { LoggedOutBuyerHomepage } from './pages/LoggedOutBuyerHomepage';
import { B2BQuotationBuilderPage } from './pages/B2BQuotationBuilderPage';
import { ContactUsPage } from './pages/ContactUsPage';
import { TermsOfPolicyPage } from './pages/TermsOfPolicyPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { RefundPolicyPage } from './pages/RefundPolicyPage';
import { CookiePolicyPage } from './pages/CookiePolicyPage';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { AccountPage } from './pages/AccountPage';
import { VisaPage } from './pages/VisaPage';
import { CustomPageView } from './pages/CustomPageView';
import { AboutUsPage } from './pages/AboutUsPage';
import { ProductDetailModal } from './components/ProductDetailModal';
import { PricingCalculatorModal } from './components/PricingCalculatorModal';
import { QuoteBuilderDrawer } from './components/QuoteBuilderDrawer';
import { AuthModal } from './components/AuthModal';
import { UserDashboard } from './components/UserDashboard';
import { AdminDashboard } from './components/AdminDashboard';
import { AdminCMSHub } from './components/AdminCMS/AdminCMSHub';
import { PublicPromotionsBanner } from './components/PublicPromotionsBanner';
import { PublicBlogHub } from './components/PublicBlogHub';
import { PublicReviewsCarousel } from './components/PublicReviewsCarousel';
import { SpecificationModal } from './components/SpecificationModal';
import { BookingModal } from './components/BookingModal';
import { BookingConfirmationModal } from './components/BookingConfirmationModal';
import { BookingsManagementModal } from './components/BookingsManagementModal';
import { B2BAgentPortal } from './components/B2BAgentPortal/B2BAgentPortal';
import { BuyerFooter } from './components/BuyerPortal/BuyerFooter';
import { QuoteBuilderAuthRequiredModal } from './components/QuoteBuilderAuthRequiredModal';
import { PortalAccessRestrictedView } from './components/PortalAccessRestrictedView';
import { ChatbotLauncher } from './components/Chatbot/ChatbotLauncher';
import { 
  parseRoute, 
  getCurrentPath, 
  validateRouteAccess, 
  navigateTo, 
  setIntendedPath, 
  ParsedRoute 
} from './services/portalRouter';
import { canUserAccessCMS, canUserAccessQuoteBuilder, canUserAccessB2BInventory } from './services/permissionEngine';
import { 
  Globe2, 
  ShieldCheck, 
  MapPin, 
  Mail, 
  Phone, 
  PhoneCall, 
  BookOpen, 
  FileText, 
  Lock, 
  RotateCcw,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Loader2
} from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, role, user, isInitializing, openAuthModal } = useAuth();
  const { setIsQuoteDrawerOpen, loadSavedQuote, loadPackageIntoQuote } = useQuotation();
  const db = AppDatabase.getInstance();

  // URL and Routing State
  const [currentRoute, setCurrentRoute] = useState<ParsedRoute>(() => parseRoute(getCurrentPath()));
  const [isQuoteAuthModalOpen, setIsQuoteAuthModalOpen] = useState(false);

  // Navigation State - Defaults to 'all' (All Destinations as Homepage)
  const [activeTab, setActiveTab] = useState<MainNavTab>('DESTINATIONS');
  const [selectedDestinationSlug, setSelectedDestinationSlug] = useState<string>('all');
  const [activeCustomPageSlug, setActiveCustomPageSlug] = useState<string>('about-theunbound');

  // Real-time synced Database State for Destinations and Products
  const [destinations, setDestinations] = useState<Destination[]>(() => db.getDestinations());
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [hotels, setHotels] = useState<Hotel[]>(() => db.getHotels());
  const [footerConfig, setFooterConfig] = useState<FooterConfig>(() => db.getFooterConfig());

  // Synchronize route changes from browser navigation or programmatic navigateTo()
  useEffect(() => {
    const handleLocationChange = () => {
      const parsed = parseRoute(getCurrentPath());
      setCurrentRoute(parsed);

      if (parsed.namespace === 'BUYER') {
        if (parsed.subTab === 'destinations') {
          setActiveTab('DESTINATIONS');
          if (parsed.param) setSelectedDestinationSlug(parsed.param);
        } else if (parsed.subTab === 'visas') {
          setActiveTab('VISAS');
        } else if (parsed.subTab === 'contact') {
          setActiveTab('CONTACT');
        } else if (parsed.subTab === 'about') {
          setActiveTab('ABOUT');
        } else if (parsed.subTab === 'blogs') {
          setActiveTab('BLOGS');
        } else if (parsed.subTab === 'dashboard') {
          setActiveTab('DASHBOARD');
        } else if (parsed.subTab === 'account') {
          setActiveTab('ACCOUNT');
        } else if (parsed.subTab === 'page' && parsed.param) {
          setActiveTab('CUSTOM_PAGE');
          setActiveCustomPageSlug(parsed.param);
        } else if (parsed.subTab === 'terms') {
          setActiveTab('TERMS');
        } else if (parsed.subTab === 'privacy') {
          setActiveTab('PRIVACY');
        } else if (parsed.subTab === 'refund') {
          setActiveTab('REFUND');
        } else if (parsed.subTab === 'cookies') {
          setActiveTab('COOKIES');
        }
      }
    };

    const handleOpenPrivacy = () => {
      setActiveTab('PRIVACY');
      navigateTo('/privacy');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    window.addEventListener('theunbound_route_changed', handleLocationChange);
    window.addEventListener('theunbound_open_privacy_policy', handleOpenPrivacy);

    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
      window.removeEventListener('theunbound_route_changed', handleLocationChange);
      window.removeEventListener('theunbound_open_privacy_policy', handleOpenPrivacy);
    };
  }, []);

  // Show auth modal if unauthenticated user attempts to visit /b2b/quote-builder
  useEffect(() => {
    if (!isAuthenticated && currentRoute.pathname === '/b2b/quote-builder') {
      setIsQuoteAuthModalOpen(true);
    }
  }, [isAuthenticated, currentRoute.pathname]);

  const isB2BAuthorized = canUserAccessB2BInventory(user).allowed;
  const canAccessB2B = isAuthenticated && canUserAccessQuoteBuilder(user, 'B2B').allowed;

  const handleCustomizePackage = (pkg: any) => {
    if (!isAuthenticated) {
      setIntendedPath('/b2b/quote-builder');
      setIsQuoteAuthModalOpen(true);
      return;
    }
    const quoteAccess = canUserAccessQuoteBuilder(user, 'B2B');
    if (!quoteAccess.allowed) {
      setIsQuoteAuthModalOpen(true);
      return;
    }
    loadPackageIntoQuote(pkg);
    navigateTo('/b2b/quote-builder');
  };

  useEffect(() => {
    return db.subscribe(() => {
      setDestinations(db.getDestinations());
      setProducts(db.getProducts());
      setHotels(db.getHotels());
      setFooterConfig(db.getFooterConfig());
    });
  }, [db]);

  // Active Modals State
  const [inspectingProduct, setInspectingProduct] = useState<Product | null>(null);
  const [inspectingProductHidePrice, setInspectingProductHidePrice] = useState(false);
  const [calculatorProduct, setCalculatorProduct] = useState<Product | null>(null);
  const [isSpecsModalOpen, setIsSpecsModalOpen] = useState(false);

  // Booking Flow States
  const [bookingProduct, setBookingProduct] = useState<Product | null>(null);
  const [bookingQuotation, setBookingQuotation] = useState<Quotation | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);
  const [isBookingsHistoryOpen, setIsBookingsHistoryOpen] = useState(false);

  // Active Destination object or 'all'
  const isAllDestinations = selectedDestinationSlug === 'all';
  const currentDestination = isAllDestinations
    ? null
    : (destinations.find(d => d.slug === selectedDestinationSlug) || destinations[0]);

  const handleSelectDestination = (slug: string) => {
    setSelectedDestinationSlug(slug);
    setActiveTab('DESTINATIONS');
    navigateTo(slug === 'all' ? '/' : `/destinations/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCustomPage = (slug: string) => {
    setActiveCustomPageSlug(slug);
    setActiveTab('CUSTOM_PAGE');
    navigateTo(`/pages/${slug}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenProductBooking = (product: Product) => {
    setInspectingProduct(null);
    setBookingQuotation(null);
    setBookingProduct(product);
  };

  const handleOpenQuotationBooking = (quotation: Quotation) => {
    setBookingProduct(null);
    setBookingQuotation(quotation);
  };

  const handleBookingCompleted = (booking: Booking) => {
    setBookingProduct(null);
    setBookingQuotation(null);
    setConfirmedBooking(booking);
  };

  // Prevent authentication flash or premature access rejection during session restoration
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white selection:bg-[#00C6A6] selection:text-white">
        <div className="flex flex-col items-center space-y-4 animate-in fade-in duration-300">
          <div className="w-14 h-14 rounded-2xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0]">
            <Loader2 className="w-7 h-7 animate-spin" />
          </div>
          <div className="text-center space-y-1">
            <p className="text-xs font-bold tracking-widest uppercase text-[#00E5C0]">TheUnbound DMC</p>
            <p className="text-xs text-slate-400 font-medium">Restoring secure session...</p>
          </div>
        </div>
      </div>
    );
  }

  // Route Access Validation
  const accessCheck = validateRouteAccess(user, currentRoute.pathname);

  // STRICT ROLE-BASED PORTAL SEGREGATION:
  // 1. Authenticated B2B Travel Agent
  if (isAuthenticated && (role === 'B2B_AGENT' || role === 'AGENT')) {
    if (!accessCheck.allowed) {
      return (
        <PortalAccessRestrictedView
          targetNamespace={currentRoute.namespace}
          reason={accessCheck.reason || 'ACCESS_RESTRICTED'}
          message={accessCheck.message}
          onRedirect={() => navigateTo('/b2b')}
        />
      );
    }

    const b2bTab = (currentRoute.subTab === 'quote-builder' || currentRoute.subTab === 'create-quote')
      ? 'create-quote'
      : (currentRoute.subTab as any) || 'home';

    return (
      <B2BAgentPortal
        destinations={destinations}
        hotels={hotels}
        products={products}
        onOpenBookingModal={handleOpenQuotationBooking}
        initialTab={b2bTab}
        onTabChange={(tab) => {
          const path = tab === 'create-quote' ? '/b2b/quote-builder' : tab === 'home' ? '/b2b' : `/b2b/${tab}`;
          navigateTo(path);
        }}
      />
    );
  }

  // 2. Authenticated Admin & Operations Staff
  const hasCMSAccess = isAuthenticated && canUserAccessCMS(user);
  if (isAuthenticated && hasCMSAccess) {
    if (!accessCheck.allowed) {
      return (
        <PortalAccessRestrictedView
          targetNamespace={currentRoute.namespace}
          reason={accessCheck.reason || 'ACCESS_RESTRICTED'}
          message={accessCheck.message}
          onRedirect={() => navigateTo('/admin')}
        />
      );
    }

    return (
      <AdminCMSHub
        destinations={destinations}
        products={products}
        onViewProduct={(p) => {
          setInspectingProductHidePrice(false);
          setInspectingProduct(p);
        }}
        onLoadQuote={(q) => {
          loadSavedQuote(q);
        }}
        onCustomizePackage={handleCustomizePackage}
      />
    );
  }

  // 3. Unauthenticated visitor or Buyer visiting restricted internal route (e.g. /admin or /b2b)
  if (!accessCheck.allowed) {
    if (accessCheck.reason === 'AUTH_REQUIRED' && currentRoute.pathname === '/b2b/quote-builder') {
      // Keep Buyer layout in background and show QuoteBuilderAuthRequiredModal
    } else {
      return (
        <PortalAccessRestrictedView
          targetNamespace={currentRoute.namespace}
          reason={accessCheck.reason || 'ACCESS_RESTRICTED'}
          message={accessCheck.message}
          onRedirect={() => navigateTo('/')}
        />
      );
    }
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-[#00C6A6] selection:text-white">
      {/* Dynamic Promotions Banner & Modals */}
      <PublicPromotionsBanner onNavigateDestination={handleSelectDestination} />

      {/* Top Main Navigation */}
      <Navbar
        destinations={destinations}
        selectedDestinationSlug={selectedDestinationSlug}
        onSelectDestination={handleSelectDestination}
        activeTab={activeTab}
        onSelectTab={(tab) => {
          setActiveTab(tab);
          const pathMap: Record<string, string> = {
            DESTINATIONS: '/destinations',
            VISAS: '/visas',
            CONTACT: '/contact',
            ABOUT: '/about',
            BLOGS: '/blogs',
            TERMS: '/terms',
            PRIVACY: '/privacy',
            REFUND: '/refund',
            DASHBOARD: '/dashboard',
            ACCOUNT: '/account',
          };
          if (pathMap[tab]) {
            navigateTo(pathMap[tab]);
          }
        }}
        onSelectCustomPage={handleSelectCustomPage}
        activeCustomPageSlug={activeCustomPageSlug}
        onOpenSpecs={() => setIsSpecsModalOpen(true)}
        onOpenBookings={() => setIsBookingsHistoryOpen(true)}
      />

      {/* Main Viewport Content Area */}
      <main className="flex-1 bg-[#F8FAFC]">
        {activeTab === 'DESTINATIONS' && (
          !isB2BAuthorized ? (
            isAllDestinations ? (
              <LoggedOutBuyerHomepage
                allDestinations={destinations}
                onSelectDestination={handleSelectDestination}
              />
            ) : (
              <DestinationPage
                destination={currentDestination}
                allDestinations={destinations}
                onSelectDestination={handleSelectDestination}
                products={[]}
                onViewProduct={() => {}}
                onOpenCalculator={() => {}}
                onInstantBook={() => {}}
                onCustomizePackage={handleCustomizePackage}
              />
            )
          ) : (
            <DestinationPage
              destination={currentDestination}
              allDestinations={destinations}
              onSelectDestination={handleSelectDestination}
              products={products}
              onViewProduct={(p) => {
                setInspectingProductHidePrice(false);
                setInspectingProduct(p);
              }}
              onOpenCalculator={(p) => setCalculatorProduct(p)}
              onInstantBook={(p) => handleOpenProductBooking(p)}
              onCustomizePackage={handleCustomizePackage}
            />
          )
        )}

        {activeTab === 'B2B_BUILDER' && (
          canAccessB2B ? (
            <B2BQuotationBuilderPage
              destinations={destinations}
              products={products}
              onViewProductDetails={(p) => {
                setInspectingProductHidePrice(true);
                setInspectingProduct(p);
              }}
              onOpenSpecs={() => setIsSpecsModalOpen(true)}
              onBookQuotation={handleOpenQuotationBooking}
              onBack={() => setActiveTab('DESTINATIONS')}
            />
          ) : (
            <div className="max-w-xl mx-auto my-20 p-10 bg-white rounded-3xl border border-slate-200 shadow-sm text-center space-y-4">
              <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-2xl flex items-center justify-center mx-auto">
                <Lock className="w-7 h-7" />
              </div>
              <h2 className="text-xl font-bold text-slate-900">B2B Quote Builder Access Restricted</h2>
              <p className="text-sm text-slate-500 leading-relaxed max-w-md mx-auto">
                Your account does not have permission to access the B2B Wholesale Quotation Builder. If you need access, please contact your administrator.
              </p>
              <button 
                onClick={() => setActiveTab('DESTINATIONS')} 
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                Return to Destinations
              </button>
            </div>
          )
        )}

        {activeTab === 'DASHBOARD' && (
          <UserDashboard
            onExploreProducts={() => setActiveTab('DESTINATIONS')}
            onSelectDestination={handleSelectDestination}
            onViewProduct={(p) => {
              setInspectingProductHidePrice(false);
              setInspectingProduct(p);
            }}
            onNavigateToAccount={() => setActiveTab('ACCOUNT')}
            products={products}
          />
        )}

        {activeTab === 'ACCOUNT' && (
          <AccountPage
            onBackToExplore={() => setActiveTab('DESTINATIONS')}
            onNavigateToBuilder={() => {
              if (!isAuthenticated) {
                setIntendedPath('/b2b/quote-builder');
                setIsQuoteAuthModalOpen(true);
                return;
              }
              const quoteAccess = canUserAccessQuoteBuilder(user, 'B2B');
              if (!quoteAccess.allowed) {
                setIsQuoteAuthModalOpen(true);
                return;
              }
              navigateTo('/b2b/quote-builder');
            }}
          />
        )}

        {activeTab === 'CUSTOM_PAGE' && (
          <CustomPageView
            pageSlug={activeCustomPageSlug}
            onBackToExplore={() => setActiveTab('DESTINATIONS')}
            onNavigateToBuilder={() => {
              if (!isAuthenticated) {
                setIntendedPath('/b2b/quote-builder');
                setIsQuoteAuthModalOpen(true);
                return;
              }
              const quoteAccess = canUserAccessQuoteBuilder(user, 'B2B');
              if (!quoteAccess.allowed) {
                setIsQuoteAuthModalOpen(true);
                return;
              }
              navigateTo('/b2b/quote-builder');
            }}
            onSelectDestination={handleSelectDestination}
            onNavigateToContact={() => setActiveTab('CONTACT')}
          />
        )}

        {activeTab === 'ABOUT' && (
          <AboutUsPage
            onBackToExplore={() => setActiveTab('DESTINATIONS')}
            onNavigateToBuilder={() => {
              if (!isAuthenticated) {
                setIntendedPath('/b2b/quote-builder');
                setIsQuoteAuthModalOpen(true);
                return;
              }
              const quoteAccess = canUserAccessQuoteBuilder(user, 'B2B');
              if (!quoteAccess.allowed) {
                setIsQuoteAuthModalOpen(true);
                return;
              }
              navigateTo('/b2b/quote-builder');
            }}
            onSelectDestination={handleSelectDestination}
            onNavigateToContact={() => setActiveTab('CONTACT')}
          />
        )}

        {activeTab === 'BLOGS' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <PublicBlogHub
              onBackToExplore={() => setActiveTab('DESTINATIONS')}
              onNavigateDestination={handleSelectDestination}
            />
          </div>
        )}

        {activeTab === 'VISAS' && <VisaPage />}
        {activeTab === 'CONTACT' && <ContactUsPage />}
        {activeTab === 'TERMS' && <TermsOfPolicyPage />}
        {activeTab === 'PRIVACY' && <PrivacyPolicyPage />}
        {activeTab === 'REFUND' && <RefundPolicyPage />}
        {activeTab === 'COOKIES' && <CookiePolicyPage />}
      </main>

      {/* Buyer Experience Footer */}
      <BuyerFooter
        onSelectDestination={handleSelectDestination}
        onSelectTab={(tab) => {
          setActiveTab(tab as any);
          const pathMap: Record<string, string> = {
            DESTINATIONS: '/destinations',
            VISAS: '/visas',
            CONTACT: '/contact',
            ABOUT: '/about',
            BLOGS: '/blogs',
            TERMS: '/terms',
            PRIVACY: '/privacy',
            REFUND: '/refund',
            COOKIES: '/cookies',
            DASHBOARD: '/dashboard',
            ACCOUNT: '/account',
          };
          if (pathMap[tab]) {
            navigateTo(pathMap[tab]);
          }
        }}
        onSelectCustomPage={handleSelectCustomPage}
      />

      {/* Global Overlays & Modals - RESTRICTED TO AUTHORIZED B2B AGENTS */}
      {inspectingProduct && isB2BAuthorized && (
        <ProductDetailModal
          product={inspectingProduct}
          hidePrice={inspectingProductHidePrice}
          onClose={() => setInspectingProduct(null)}
          onOpenCalculator={(p) => {
            setInspectingProduct(null);
            setCalculatorProduct(p);
          }}
          onBookProduct={(p) => handleOpenProductBooking(p)}
        />
      )}

      {calculatorProduct && isB2BAuthorized && (
        <PricingCalculatorModal
          product={calculatorProduct}
          onClose={() => setCalculatorProduct(null)}
          onAddedToQuote={() => {
            setIsQuoteDrawerOpen(true);
          }}
        />
      )}

      {/* Booking Submission Modal */}
      {(bookingProduct || bookingQuotation) && isB2BAuthorized && (
        <BookingModal
          product={bookingProduct || undefined}
          quotation={bookingQuotation || undefined}
          onClose={() => {
            setBookingProduct(null);
            setBookingQuotation(null);
          }}
          onBookingComplete={handleBookingCompleted}
        />
      )}

      {/* Booking Confirmation & Email Dispatch Modal */}
      {confirmedBooking && (
        <BookingConfirmationModal
          booking={confirmedBooking}
          onClose={() => setConfirmedBooking(null)}
          onViewAllBookings={() => {
            setConfirmedBooking(null);
            setIsBookingsHistoryOpen(true);
          }}
        />
      )}

      {/* Central Bookings Management & History Modal */}
      <BookingsManagementModal
        isOpen={isBookingsHistoryOpen}
        onClose={() => setIsBookingsHistoryOpen(false)}
      />

      <QuoteBuilderDrawer onBookQuote={(booking: Booking) => setConfirmedBooking(booking)} />
      <AuthModal />

      {/* Quote Builder Authentication Required Modal */}
      <QuoteBuilderAuthRequiredModal
        isOpen={isQuoteAuthModalOpen}
        onClose={() => {
          setIsQuoteAuthModalOpen(false);
          if (currentRoute.pathname.startsWith('/b2b')) {
            navigateTo('/');
          }
        }}
        onOpenLogin={() => {
          setIsQuoteAuthModalOpen(false);
          setIntendedPath('/b2b/quote-builder');
          openAuthModal('Please log in to access the B2B Wholesale Quotation Builder.');
        }}
        onOpenRegister={() => {
          setIsQuoteAuthModalOpen(false);
          setIntendedPath('/b2b/quote-builder');
          openAuthModal('Create an account to apply for B2B Wholesale Quotation Builder access.');
        }}
      />

      {isSpecsModalOpen && (
        <SpecificationModal onClose={() => setIsSpecsModalOpen(false)} />
      )}

      {/* Global TheUnbound AI Travel Specialist Chatbot Launcher for Retail & Buyer Portals */}
      <ChatbotLauncher portal="BUYER" />

      {/* Global GDPR & DPDP Cookie Consent Banner */}
      <CookieConsentBanner
        onNavigateToCookiePolicy={() => {
          setActiveTab('COOKIES');
          navigateTo('/cookies');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <RosterProvider>
        <QuotationProvider>
          <MainAppContent />
        </QuotationProvider>
      </RosterProvider>
    </AuthProvider>
  );
}
