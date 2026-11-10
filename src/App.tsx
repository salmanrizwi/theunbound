import React, { useState, useEffect, useMemo } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QuotationProvider, useQuotation } from './context/QuotationContext';
import { RosterProvider } from './context/RosterContext';
import { AppDatabase } from './services/db';
import { Product, Destination, Quotation, Booking, Hotel, FooterConfig } from './types';
import { Navbar, MainNavTab } from './components/Navbar';
import { CookieConsentBanner } from './components/CookieConsentBanner';
import { GlobalToastContainer } from './components/common/GlobalToastContainer';
import { isRailProduct } from './services/rail/JapanRailJourneyDataService';
import { AuthModal } from './components/AuthModal';
import { PublicPromotionsBanner } from './components/PublicPromotionsBanner';
import { BuyerFooter } from './components/BuyerPortal/BuyerFooter';
import { PortalAccessRestrictedView } from './components/PortalAccessRestrictedView';
import { GlobalErrorBoundary } from './components/common/GlobalErrorBoundary';

// Code-split pages and major portal applications for high performance
const DestinationPage = React.lazy(() => import('./pages/DestinationPage').then(m => ({ default: m.DestinationPage })));
const LoggedOutBuyerHomepage = React.lazy(() => import('./pages/LoggedOutBuyerHomepage').then(m => ({ default: m.LoggedOutBuyerHomepage })));
const B2BQuotationBuilderPage = React.lazy(() => import('./pages/B2BQuotationBuilderPage').then(m => ({ default: m.B2BQuotationBuilderPage })));
const ContactUsPage = React.lazy(() => import('./pages/ContactUsPage').then(m => ({ default: m.ContactUsPage })));
const TermsOfPolicyPage = React.lazy(() => import('./pages/TermsOfPolicyPage').then(m => ({ default: m.TermsOfPolicyPage })));
const PrivacyPolicyPage = React.lazy(() => import('./pages/PrivacyPolicyPage').then(m => ({ default: m.PrivacyPolicyPage })));
const RefundPolicyPage = React.lazy(() => import('./pages/RefundPolicyPage').then(m => ({ default: m.RefundPolicyPage })));
const CookiePolicyPage = React.lazy(() => import('./pages/CookiePolicyPage').then(m => ({ default: m.CookiePolicyPage })));
const AccountPage = React.lazy(() => import('./pages/AccountPage').then(m => ({ default: m.AccountPage })));
const VisaPage = React.lazy(() => import('./pages/VisaPage').then(m => ({ default: m.VisaPage })));
const CustomPageView = React.lazy(() => import('./pages/CustomPageView').then(m => ({ default: m.CustomPageView })));
const AboutUsPage = React.lazy(() => import('./pages/AboutUsPage').then(m => ({ default: m.AboutUsPage })));
const PublicBlogHub = React.lazy(() => import('./components/PublicBlogHub').then(m => ({ default: m.PublicBlogHub })));

// Heavy portal hubs & modals code-split on demand
const AdminCMSHub = React.lazy(() => import('./components/AdminCMS/AdminCMSHub').then(m => ({ default: m.AdminCMSHub })));
const B2BAgentPortal = React.lazy(() => import('./components/B2BAgentPortal/B2BAgentPortal').then(m => ({ default: m.B2BAgentPortal })));
const ProductDetailModal = React.lazy(() => import('./components/ProductDetailModal').then(m => ({ default: m.ProductDetailModal })));
const RailJourneyModal = React.lazy(() => import('./components/RailJourneyModal').then(m => ({ default: m.RailJourneyModal })));
const PricingCalculatorModal = React.lazy(() => import('./components/PricingCalculatorModal').then(m => ({ default: m.PricingCalculatorModal })));
const QuoteBuilderDrawer = React.lazy(() => import('./components/QuoteBuilderDrawer').then(m => ({ default: m.QuoteBuilderDrawer })));
const SpecificationModal = React.lazy(() => import('./components/SpecificationModal').then(m => ({ default: m.SpecificationModal })));
const BookingModal = React.lazy(() => import('./components/BookingModal').then(m => ({ default: m.BookingModal })));
const BookingConfirmationModal = React.lazy(() => import('./components/BookingConfirmationModal').then(m => ({ default: m.BookingConfirmationModal })));
const BookingsManagementModal = React.lazy(() => import('./components/BookingsManagementModal').then(m => ({ default: m.BookingsManagementModal })));
const QuoteBuilderAuthRequiredModal = React.lazy(() => import('./components/QuoteBuilderAuthRequiredModal').then(m => ({ default: m.QuoteBuilderAuthRequiredModal })));
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
import { inventoryVisibilityService } from './services/inventoryVisibilityService';
import { automaticTaskEngine } from './services/automaticTaskEngine';
import { marketingAutomationScheduler } from './services/marketingAutomationScheduler';

// Ensure global marketing automation & operational task engines are initialized on startup
void automaticTaskEngine;
void marketingAutomationScheduler;
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

const ModuleLoadingFallback: React.FC<{ label?: string }> = ({ label = 'Loading...' }) => (
  <div className="w-full min-h-[350px] flex flex-col items-center justify-center p-8 text-slate-400 space-y-3">
    <Loader2 className="w-8 h-8 text-[#00C6A6] animate-spin" />
    <span className="text-xs font-bold uppercase tracking-wider text-slate-500">{label}</span>
  </div>
);

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
  const foundDestination = isAllDestinations
    ? null
    : destinations.find(d => d.slug === selectedDestinationSlug);

  const isDestinationVisible = foundDestination
    ? inventoryVisibilityService.isDestinationEligible(foundDestination, role)
    : false;

  const currentDestination = isDestinationVisible ? foundDestination : null;

  // Filter only active/visible destinations for customer-facing views (Header, Footer, B2B Agent Portal, etc.)
  const activeDestinations = useMemo(() => {
    return destinations.filter(d => 
      inventoryVisibilityService.isDestinationEligible(d, role)
    );
  }, [destinations, role]);

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
      <GlobalErrorBoundary fallbackTitle="Admin CMS Encountered an Issue">
        <React.Suspense fallback={<ModuleLoadingFallback label="Loading Operations Admin CMS..." />}>
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
        </React.Suspense>
      </GlobalErrorBoundary>
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
        <GlobalErrorBoundary fallbackTitle="B2B Agent Portal Encountered an Issue">
          <React.Suspense fallback={<ModuleLoadingFallback label="Loading Wholesale B2B Portal..." />}>
            <B2BAgentPortal
              destinations={activeDestinations}
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
          </React.Suspense>
        </GlobalErrorBoundary>
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
        destinations={activeDestinations}
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

      <main className="flex-1 w-full min-w-0 max-w-full bg-[#F8FAFC]">
        <GlobalErrorBoundary fallbackTitle="Page Content Encountered an Issue">
          <React.Suspense fallback={<ModuleLoadingFallback label="Loading content..." />}>
          {activeTab === 'DESTINATIONS' && (
          isAllDestinations ? (
            /* Authoritative Canonical Home Page — Used for ALL visitors (unauthenticated, B2B Agent, and Admin) */
            <LoggedOutBuyerHomepage
              allDestinations={activeDestinations}
              onSelectDestination={handleSelectDestination}
            />
          ) : currentDestination ? (
            <DestinationPage
              destination={currentDestination}
              allDestinations={activeDestinations}
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
                  setCalculatorProduct(p);
                }
              }}
              onInstantBook={(p) => {
                if (isB2BAuthorized) handleOpenProductBooking(p);
              }}
              onCustomizePackage={handleCustomizePackage}
            />
          ) : (
            <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-amber-50 text-amber-500 border border-amber-200">
                <Globe2 className="w-8 h-8" />
              </div>
              <h2 className="text-2xl font-black font-sans text-slate-900 tracking-tight">
                DESTINATION TEMPORARILY OFFLINE
              </h2>
              <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                This destination corridor is currently undergoing live operational synchronization and ground tariff adjustments. Please return to the Destination Explorer.
              </p>
              <button
                onClick={() => handleSelectDestination('all')}
                className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 text-xs sm:text-sm font-bold transition-all cursor-pointer inline-flex items-center space-x-2"
              >
                <span>Return to Destination Explorer</span>
              </button>
            </div>
          )
        )}

        {activeTab === 'B2B_BUILDER' && (
          canAccessB2B ? (
            <B2BQuotationBuilderPage
              destinations={activeDestinations}
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
          </React.Suspense>
        </GlobalErrorBoundary>
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

      {/* Global Overlays & Modals - Lazy-loaded on demand */}
      <React.Suspense fallback={null}>
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

        {calculatorProduct && isB2BAuthorized && (
          <PricingCalculatorModal
            product={calculatorProduct}
            onClose={() => setCalculatorProduct(null)}
            onAddedToQuote={() => {
              setIsQuoteDrawerOpen(true);
            }}
          />
        )}

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

        <BookingsManagementModal
          isOpen={isBookingsHistoryOpen}
          onClose={() => setIsBookingsHistoryOpen(false)}
        />

        <QuoteBuilderDrawer onBookQuote={(booking: Booking) => setConfirmedBooking(booking)} />

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
      </React.Suspense>

      <AuthModal />

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
