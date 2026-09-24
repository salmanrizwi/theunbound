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
import { GlobalToastContainer } from './components/common/GlobalToastContainer';
import { AccountPage } from './pages/AccountPage';
import { VisaPage } from './pages/VisaPage';
import { CustomPageView } from './pages/CustomPageView';
import { AboutUsPage } from './pages/AboutUsPage';
import { ProductDetailModal } from './components/ProductDetailModal';
import { RailJourneyModal } from './components/RailJourneyModal';
import { PricingCalculatorModal } from './components/PricingCalculatorModal';
import { isRailProduct } from './services/rail/JapanRailJourneyDataService';
import { QuoteBuilderDrawer } from './components/QuoteBuilderDrawer';
import { AuthModal } from './components/AuthModal';
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
import { 
  parseRoute, 
  getCurrentPath, 
  validateRouteAccess, 
  navigateTo, 
  setIntendedPath, 
  ParsedRoute 
} from './services/portalRouter';
import { canUserAccessCMS, canUserAccessQuoteBuilder, canUserAccessB2BInventory } from './services/permissionEngine';
import { authDiagnostic } from './services/authDiagnostic';
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
  const [activeTab, setActiveTab] = useState<MainNavTab>(() => {
    const route = parseRoute(getCurrentPath());
    if (route.namespace === 'PUBLIC' || route.namespace === 'BUYER') {
      if (route.subTab === 'visas') return 'VISAS';
      if (route.subTab === 'contact') return 'CONTACT';
      if (route.subTab === 'about') return 'ABOUT';
      if (route.subTab === 'blogs') return 'BLOGS';
      if (route.subTab === 'page') return 'CUSTOM_PAGE';
      if (route.subTab === 'terms') return 'TERMS';
      if (route.subTab === 'privacy') return 'PRIVACY';
      if (route.subTab === 'refund') return 'REFUND';
      if (route.subTab === 'cookies') return 'COOKIES';
    }
    return 'DESTINATIONS';
  });

  const [selectedDestinationSlug, setSelectedDestinationSlug] = useState<string>(() => {
    const route = parseRoute(getCurrentPath());
    if (route.subTab === 'destinations' && route.param) {
      return route.param;
    }
    return 'all';
  });

  const [activeCustomPageSlug, setActiveCustomPageSlug] = useState<string>(() => {
    const route = parseRoute(getCurrentPath());
    if (route.subTab === 'page' && route.param) {
      return route.param;
    }
    return 'about-theunbound';
  });

  // Real-time synced Database State for Destinations and Products
  const [destinations, setDestinations] = useState<Destination[]>(() => db.getDestinations());
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());
  const [hotels, setHotels] = useState<Hotel[]>(() => db.getHotels());
  const [footerConfig, setFooterConfig] = useState<FooterConfig>(() => db.getFooterConfig());

  // Synchronize route changes from browser navigation or programmatic navigateTo()
  useEffect(() => {
    authDiagnostic.markStage('T11');
  }, [currentRoute.pathname]);

  useEffect(() => {
    const handleLocationChange = () => {
      const parsed = parseRoute(getCurrentPath());
      setCurrentRoute(parsed);

      if (parsed.namespace === 'PUBLIC' || parsed.namespace === 'BUYER') {
        if (parsed.subTab === 'dashboard') {
          // No Buyer dashboard: Redirect directly to authorized portal
          if (user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER') {
            navigateTo('/admin', { replace: true });
          } else if (user?.role === 'B2B_AGENT' || user?.role === 'AGENT') {
            navigateTo('/b2b/dashboard', { replace: true });
          } else {
            navigateTo('/', { replace: true });
          }
          return;
        } else if (parsed.subTab === 'account') {
          if (user?.role === 'ADMIN' || user?.role === 'TEAM_MEMBER') {
            navigateTo('/admin/accounts', { replace: true });
          } else if (user?.role === 'B2B_AGENT' || user?.role === 'AGENT') {
            navigateTo('/b2b/account', { replace: true });
          } else {
            navigateTo('/', { replace: true });
          }
          return;
        } else if (parsed.subTab === 'destinations') {
          setActiveTab('DESTINATIONS');
          setSelectedDestinationSlug(parsed.param || 'all');
        } else if (parsed.subTab === 'visas') {
          setActiveTab('VISAS');
        } else if (parsed.subTab === 'contact') {
          setActiveTab('CONTACT');
        } else if (parsed.subTab === 'about') {
          setActiveTab('ABOUT');
        } else if (parsed.subTab === 'blogs') {
          setActiveTab('BLOGS');
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
  const hasCMSAccess = isAuthenticated && canUserAccessCMS(user);

  // 1. ADMIN OPERATIONS CMS ENGINE (/admin/*)
  if (currentRoute.namespace === 'ADMIN') {
    if (!hasCMSAccess) {
      return (
        <PortalAccessRestrictedView
          targetNamespace="ADMIN"
          reason={!isAuthenticated ? 'AUTH_REQUIRED' : 'ACCESS_RESTRICTED'}
          message="Administrative access is restricted to verified TheUnbound DMC operations personnel."
          onRedirect={() => navigateTo(isB2BAuthorized ? '/b2b' : '/')}
        />
      );
    }

    return (
      <AdminCMSHub
        initialTab={currentRoute.subTab}
        initialSubTab={currentRoute.param}
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

  // 2. WHOLESALE B2B AGENT PORTAL (/b2b/*)
  if (currentRoute.namespace === 'B2B') {
    if (!isB2BAuthorized && !hasCMSAccess) {
      if (accessCheck.reason === 'AUTH_REQUIRED' && currentRoute.pathname === '/b2b/quote-builder') {
        // Allow QuoteBuilderAuthRequiredModal on Buyer background
      } else {
        return (
          <PortalAccessRestrictedView
            targetNamespace="B2B"
            reason={!isAuthenticated ? 'AUTH_REQUIRED' : 'ACCESS_RESTRICTED'}
            message="Wholesale B2B Agent portal access is restricted to verified travel agency partners."
            onRedirect={() => navigateTo('/')}
          />
        );
      }
    } else {
      // Map legacy standalone lead routes to canonical CRM route
      const isLegacyLeadRoute = currentRoute.subTab === 'leads' || currentRoute.subTab === 'assigned-leads';
      const b2bTab = (currentRoute.subTab === 'quote-builder' || currentRoute.subTab === 'create-quote')
        ? 'create-quote'
        : (isLegacyLeadRoute || currentRoute.subTab === 'customers' || currentRoute.subTab === 'crm')
          ? 'crm'
          : (currentRoute.subTab as any) || 'home';

      // Canonical URL synchronization: if visited /b2b/leads or /b2b/assigned-leads, update URL to /b2b/crm without reload
      if (isLegacyLeadRoute && typeof window !== 'undefined' && window.location.pathname !== '/b2b/crm') {
        window.history.replaceState(null, '', '/b2b/crm');
      }

      return (
        <B2BAgentPortal
          destinations={destinations}
          hotels={hotels}
          products={products}
          onOpenBookingModal={handleOpenQuotationBooking}
          initialTab={b2bTab}
          onTabChange={(tab) => {
            const path = tab === 'create-quote' 
              ? '/b2b/quote-builder' 
              : tab === 'home' 
                ? '/b2b' 
                : (tab === 'crm' || tab === 'leads' || tab === 'customers') 
                  ? '/b2b/crm' 
                  : `/b2b/${tab}`;
            navigateTo(path);
          }}
        />
      );
    }
  }

  // 3. Fallback check for any other unpermitted route
  if (!accessCheck.allowed && currentRoute.namespace !== 'PUBLIC' && currentRoute.namespace !== 'BUYER') {
    return (
      <PortalAccessRestrictedView
        targetNamespace={currentRoute.namespace}
        reason={accessCheck.reason || 'ACCESS_RESTRICTED'}
        message={accessCheck.message}
        onRedirect={() => navigateTo('/')}
      />
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden min-w-0 bg-[#F8FAFC] text-slate-900 flex flex-col font-sans selection:bg-[#00C6A6] selection:text-white">
      {/* Authenticated Staff & Partner Quick Navigation Bar */}
      {isAuthenticated && (hasCMSAccess || isB2BAuthorized) && (
        <div className="bg-slate-900 text-slate-300 px-4 py-2 text-xs flex flex-wrap items-center justify-between border-b border-slate-800 gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
            <span>
              Signed in: <strong className="text-white">{user?.name || user?.email}</strong> ({user?.role === 'ADMIN' ? 'Operations Admin' : user?.role === 'B2B_AGENT' ? 'B2B Travel Partner' : user?.role})
            </span>
          </div>
          <div className="flex items-center gap-4">
            {hasCMSAccess && (
              <button
                onClick={() => navigateTo('/admin')}
                className="text-amber-400 hover:text-amber-300 font-semibold underline flex items-center gap-1 transition-colors"
              >
                Go to Admin CMS Hub &rarr;
              </button>
            )}
            {isB2BAuthorized && (
              <button
                onClick={() => navigateTo('/b2b')}
                className="text-[#00C6A6] hover:text-emerald-300 font-semibold underline flex items-center gap-1 transition-colors"
              >
                Go to Wholesale B2B Portal &rarr;
              </button>
            )}
          </div>
        </div>
      )}

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
      <main className="flex-1 w-full min-w-0 max-w-full bg-[#F8FAFC]">
        {activeTab === 'DESTINATIONS' && (
          isAllDestinations ? (
            /* Authoritative Canonical Home Page — Used for ALL visitors (unauthenticated, B2B Agent, and Admin) */
            <LoggedOutBuyerHomepage
              allDestinations={destinations}
              onSelectDestination={handleSelectDestination}
            />
          ) : (
            <DestinationPage
              destination={currentDestination}
              allDestinations={destinations}
              onSelectDestination={handleSelectDestination}
              products={isB2BAuthorized ? products : []}
              onViewProduct={(p) => {
                if (isB2BAuthorized) {
                  setInspectingProductHidePrice(false);
                  setInspectingProduct(p);
                }
              }}
              onOpenCalculator={(p) => {
                if (isB2BAuthorized) {
                  if (isRailProduct(p)) {
                    setInspectingProduct(p);
                  } else {
                    setCalculatorProduct(p);
                  }
                }
              }}
              onInstantBook={(p) => {
                if (isB2BAuthorized) handleOpenProductBooking(p);
              }}
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

      {/* Dynamic Japan Rail Journey Selection Interface */}
      {inspectingProduct && isRailProduct(inspectingProduct) && (
        <RailJourneyModal
          product={inspectingProduct}
          portalOrigin="BUYER"
          onClose={() => setInspectingProduct(null)}
          onAddToQuote={() => {
            setInspectingProduct(null);
            setIsQuoteDrawerOpen(true);
          }}
          onInstantBook={(p) => {
            setInspectingProduct(null);
            if (isB2BAuthorized) {
              handleOpenProductBooking(p);
            } else {
              setIsQuoteDrawerOpen(true);
            }
          }}
        />
      )}

      {/* Global Overlays & Modals - Standard Product Details */}
      {inspectingProduct && isB2BAuthorized && !isRailProduct(inspectingProduct) && (
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

      {calculatorProduct && isB2BAuthorized && !isRailProduct(calculatorProduct) && (
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

      {/* Global GDPR & DPDP Cookie Consent Banner */}
      <CookieConsentBanner
        onNavigateToCookiePolicy={() => {
          setActiveTab('COOKIES');
          navigateTo('/cookies');
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* Standard Light TheUnbound Global Toast Notifications */}
      <GlobalToastContainer />
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
