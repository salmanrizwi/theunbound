import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { QuotationProvider, useQuotation } from './context/QuotationContext';
import { RosterProvider } from './context/RosterContext';
import { AppDatabase } from './services/db';
import { Product, Destination, Quotation, Booking } from './types';
import { Navbar, MainNavTab } from './components/Navbar';
import { DestinationPage } from './pages/DestinationPage';
import { B2BQuotationBuilderPage } from './pages/B2BQuotationBuilderPage';
import { ContactUsPage } from './pages/ContactUsPage';
import { TermsOfPolicyPage } from './pages/TermsOfPolicyPage';
import { PrivacyPolicyPage } from './pages/PrivacyPolicyPage';
import { RefundPolicyPage } from './pages/RefundPolicyPage';
import { AccountPage } from './pages/AccountPage';
import { CustomPageView } from './pages/CustomPageView';
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
  RotateCcw
} from 'lucide-react';

const MainAppContent: React.FC = () => {
  const { isAuthenticated, role, openAuthModal } = useAuth();
  const { setIsQuoteDrawerOpen, loadSavedQuote } = useQuotation();
  const db = AppDatabase.getInstance();

  // Navigation State - Defaults to 'all' (All Destinations as Homepage)
  const [activeTab, setActiveTab] = useState<MainNavTab>('DESTINATIONS');
  const [selectedDestinationSlug, setSelectedDestinationSlug] = useState<string>('all');
  const [activeCustomPageSlug, setActiveCustomPageSlug] = useState<string>('about-theunbound');

  // Real-time synced Database State for Destinations and Products
  const [destinations, setDestinations] = useState<Destination[]>(() => db.getDestinations());
  const [products, setProducts] = useState<Product[]>(() => db.getProducts());

  useEffect(() => {
    return db.subscribe(() => {
      setDestinations(db.getDestinations());
      setProducts(db.getProducts());
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
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectCustomPage = (slug: string) => {
    setActiveCustomPageSlug(slug);
    setActiveTab('CUSTOM_PAGE');
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
        onSelectTab={setActiveTab}
        onSelectCustomPage={handleSelectCustomPage}
        activeCustomPageSlug={activeCustomPageSlug}
        onOpenSpecs={() => setIsSpecsModalOpen(true)}
        onOpenBookings={() => setIsBookingsHistoryOpen(true)}
      />

      {/* Main Viewport Content Area */}
      <main className="flex-1 bg-[#F8FAFC]">
        {activeTab === 'DESTINATIONS' && (
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
          />
        )}

        {activeTab === 'B2B_BUILDER' && (
          <B2BQuotationBuilderPage
            destinations={destinations}
            products={products}
            onViewProductDetails={(p) => {
              setInspectingProductHidePrice(true);
              setInspectingProduct(p);
            }}
            onOpenSpecs={() => setIsSpecsModalOpen(true)}
            onBookQuotation={handleOpenQuotationBooking}
          />
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
            onNavigateToBuilder={() => setActiveTab('B2B_BUILDER')}
          />
        )}

        {activeTab === 'CUSTOM_PAGE' && (
          <CustomPageView
            pageSlug={activeCustomPageSlug}
            onBackToExplore={() => setActiveTab('DESTINATIONS')}
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

        {activeTab === 'ADMIN' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <AdminCMSHub
              destinations={destinations}
              products={products}
              onViewProduct={(p) => {
                setInspectingProductHidePrice(false);
                setInspectingProduct(p);
              }}
              onLoadQuote={(q) => {
                loadSavedQuote(q);
                setActiveTab('B2B_BUILDER');
              }}
            />
          </div>
        )}

        {activeTab === 'CONTACT' && <ContactUsPage />}
        {activeTab === 'TERMS' && <TermsOfPolicyPage />}
        {activeTab === 'PRIVACY' && <PrivacyPolicyPage />}
        {activeTab === 'REFUND' && <RefundPolicyPage />}
      </main>

      {/* Global Comprehensive DMC Footer */}
      <footer className="bg-slate-950 text-white border-t border-slate-800/80 pt-14 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-10">
          {/* Top Row: Brand & Value Proposition */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 pb-10 border-b border-slate-800">
            <div className="md:col-span-4 space-y-3.5">
              <div className="space-y-1">
                <span className="text-2xl font-black tracking-tight text-white font-sans block lowercase">
                  theunbound
                </span>
                <span className="text-[11px] tracking-wider text-[#00C6A6] font-bold block">
                  Unbound Experiences India Pvt Ltd
                </span>
              </div>

              <p className="text-xs text-slate-400 leading-relaxed max-w-sm">
                Professional Destination Management Company and wholesale technology operator providing contracted B2B wholesale rates, instant booking SLAs, and bespoke ground operations across Japan, United Kingdom, and Europe.
              </p>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  onClick={() => setIsSpecsModalOpen(true)}
                  className="inline-flex items-center space-x-1.5 bg-slate-900 hover:bg-slate-800 text-[#00C6A6] border border-[#00C6A6]/30 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>32-Point Architecture Spec</span>
                </button>
              </div>
            </div>

            {/* Destinations Links */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Core Destinations
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <button 
                    onClick={() => handleSelectDestination('all')}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>All Destinations (Global Overview)</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleSelectDestination('japan')}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>Japan (Tokyo, Kyoto, Osaka, Mt. Fuji)</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleSelectDestination('uk')}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>United Kingdom (London, Edinburgh, Highlands)</span>
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => handleSelectDestination('europe')}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <span>Europe (Paris, Rome, Amalfi, Swiss Alps)</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Quick Policies, Editorial & Compliance */}
            <div className="md:col-span-2 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Trust & Operations
              </h4>
              <ul className="space-y-2 text-xs text-slate-400">
                <li>
                  <button
                    onClick={() => {
                      setActiveTab('CONTACT');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Mail className="w-3 h-3 text-[#00C6A6]" />
                    <span>Contact Operations</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveTab('BLOGS');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <BookOpen className="w-3 h-3 text-[#00C6A6]" />
                    <span>Editorial & Insights</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveTab('TERMS');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <FileText className="w-3 h-3 text-[#00C6A6]" />
                    <span>Terms & Conditions</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveTab('PRIVACY');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <Lock className="w-3 h-3 text-[#00C6A6]" />
                    <span>Privacy Policy</span>
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => {
                      setActiveTab('REFUND');
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                  >
                    <RotateCcw className="w-3 h-3 text-[#00C6A6]" />
                    <span>Refund Policy</span>
                  </button>
                </li>
              </ul>
            </div>

            {/* Ground Operations Contact Details */}
            <div className="md:col-span-3 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                Official Head Office
              </h4>
              <div className="space-y-2 text-xs text-slate-400">
                <p className="flex items-start space-x-2">
                  <MapPin className="w-4 h-4 text-[#00C6A6] shrink-0 mt-0.5" />
                  <span className="leading-snug">
                    A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi
                  </span>
                </p>
                <p className="flex items-center space-x-2">
                  <Mail className="w-4 h-4 text-[#00C6A6] shrink-0" />
                  <a href="mailto:sales@theunbound.in" className="font-mono text-slate-300 hover:text-[#00C6A6] transition-colors">
                    sales@theunbound.in
                  </a>
                </p>
                <div className="flex flex-col space-y-1.5 pt-0.5">
                  <p className="flex items-center space-x-2">
                    <PhoneCall className="w-4 h-4 text-[#00C6A6] shrink-0" />
                    <span className="text-slate-400">Landline:</span>
                    <a href="tel:01141185542" className="font-mono font-semibold text-white hover:text-[#00C6A6] transition-colors">
                      011-41185542
                    </a>
                  </p>
                  <p className="flex items-center space-x-2">
                    <Phone className="w-4 h-4 text-[#00C6A6] shrink-0" />
                    <span className="text-slate-400">Mobile:</span>
                    <a href="tel:+919811654959" className="font-mono text-slate-300 hover:text-[#00C6A6] transition-colors">
                      +91-9811654959
                    </a>
                  </p>
                  <p className="flex items-center space-x-2 pl-6">
                    <a href="tel:+919718894959" className="font-mono text-slate-300 hover:text-[#00C6A6] transition-colors">
                      +91-9718894959
                    </a>
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 pt-1">
                  24/7 Agent Emergency Dispatch
                </p>
              </div>
            </div>
          </div>

          {/* Bottom Copyright & Status Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
            <div className="flex items-center space-x-2">
              <span>© 2026 Unbound Experiences India Pvt Ltd. All rights reserved.</span>
            </div>

            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1.5 text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Ground Operations Network: Operational (24-48h SLA)</span>
              </span>
              <span>•</span>
              <span>IATA / ASTA / PATA Verified</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Overlays & Modals */}
      {inspectingProduct && (
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

      {calculatorProduct && (
        <PricingCalculatorModal
          product={calculatorProduct}
          onClose={() => setCalculatorProduct(null)}
          onAddedToQuote={() => {
            setIsQuoteDrawerOpen(true);
          }}
        />
      )}

      {/* Booking Submission Modal */}
      {(bookingProduct || bookingQuotation) && (
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

      <QuoteBuilderDrawer onBookQuote={handleOpenQuotationBooking} />
      <AuthModal />

      {isSpecsModalOpen && (
        <SpecificationModal onClose={() => setIsSpecsModalOpen(false)} />
      )}
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
