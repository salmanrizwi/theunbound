import React, { useState } from 'react';
import { B2BPackage, CurrencyCode, Booking } from '../types';
import { AppDatabase } from '../services/db';
import { formatCurrency, convertCurrency } from '../services/pricingEngine';
import { useAuth } from '../context/AuthContext';
import { 
  Package, 
  MapPin, 
  Clock, 
  Calendar, 
  Sparkles, 
  ArrowRight, 
  Eye, 
  CheckCircle2, 
  Hotel, 
  Car, 
  Compass, 
  Layers,
  ChevronRight,
  ShieldCheck,
  MessageSquare
} from 'lucide-react';
import { PackageDetailModal } from './PackageDetailModal';
import { PackageEnquiryModal } from './PackageEnquiryModal';
import { BookingModal } from './BookingModal';

interface ReadyMadePackagesSectionProps {
  destinationId?: string;
  destinationName?: string;
  onCustomizePackage?: (pkg: B2BPackage) => void;
  onBookPackage?: (pkg: B2BPackage) => void;
  onEnquirePackage?: (pkg: B2BPackage) => void;
  currency?: CurrencyCode;
}

export const ReadyMadePackagesSection: React.FC<ReadyMadePackagesSectionProps> = ({
  destinationId,
  destinationName,
  onCustomizePackage,
  onBookPackage,
  onEnquirePackage,
  currency = 'USD'
}) => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [selectedPackage, setSelectedPackage] = useState<B2BPackage | null>(null);
  const [enquiryPackage, setEnquiryPackage] = useState<B2BPackage | null>(null);
  const [bookingPackage, setBookingPackage] = useState<B2BPackage | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<Booking | null>(null);

  const isB2BAgent = user && (user.role === 'B2B_AGENT' || user.role === 'AGENT' || user.role === 'ADMIN');

  const handleEnquire = (pkg: B2BPackage) => {
    if (onEnquirePackage) {
      onEnquirePackage(pkg);
    } else {
      setEnquiryPackage(pkg);
    }
  };

  const handleBook = (pkg: B2BPackage) => {
    if (onBookPackage) {
      onBookPackage(pkg);
    } else {
      setBookingPackage(pkg);
    }
  };

  // Query published packages for this destination or all destinations
  const packages = db.getPackages().filter(pkg => {
    // Only published packages
    const isPublished = pkg.status === 'PUBLISHED' || pkg.isPublished;
    if (!isPublished) return false;

    // Filter by destination if provided and not "all"
    if (destinationId && destinationId !== 'all') {
      const matchId = pkg.destinationId === destinationId || pkg.destinationId?.toLowerCase() === destinationId.toLowerCase();
      const matchName = destinationName && pkg.destinationName?.toLowerCase() === destinationName.toLowerCase();
      return matchId || matchName;
    }

    return pkg.visibility?.homepage !== false;
  });

  if (packages.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 text-[#008972] border border-[#00C6A6]/30 text-[10px] font-extrabold uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="w-3 h-3 text-[#00C6A6]" />
              <span>Signature Tour Circuits</span>
            </span>
            <span className="text-xs text-slate-400 font-semibold">
              {packages.length} Ready-Made {packages.length === 1 ? 'Circuit' : 'Circuits'}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight mt-1.5">
            Ready-Made Packages in {destinationName || 'Destinations'}
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-1">
            Pre-curated multi-city itineraries crafted with 5★ luxury accommodation, private chauffeur transfers, high-speed rail, and accredited local docents.
          </p>
        </div>
      </div>

      {/* Package Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {packages.map(pkg => {
          const durationText = `${pkg.durationNights || (pkg.durationDays - 1)}N / ${pkg.durationDays}D`;
          const baseNet = pkg.baseNetCostUSD || 2500;
          const retailPriceUSD = pkg.suggestedSellingPriceUSD || Math.round(baseNet * 1.3);
          const b2bPriceUSD = Math.round(baseNet * (1 + (pkg.pricingConfiguration?.b2bMarkupPercent || 12) / 100));

          const priceInUSD = isB2BAgent ? b2bPriceUSD : retailPriceUSD;
          const displayPrice = convertCurrency(priceInUSD, 'USD', currency);

          return (
            <div
              key={pkg.id}
              className="bg-white rounded-3xl border border-slate-200/90 overflow-hidden shadow-xs hover:shadow-xl transition-all duration-300 flex flex-col justify-between group"
            >
              <div>
                {/* Hero Image Container */}
                <div 
                  className="relative h-48 w-full overflow-hidden bg-slate-900 cursor-pointer"
                  onClick={() => setSelectedPackage(pkg)}
                >
                  <img
                    src={pkg.heroImage || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800'}
                    alt={pkg.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/20 to-black/20" />

                  {/* Top Badges */}
                  <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-full bg-slate-900/80 backdrop-blur-md text-white text-[10px] font-black uppercase tracking-wider flex items-center space-x-1">
                      <MapPin className="w-3 h-3 text-[#00C6A6]" />
                      <span>{pkg.destinationName}</span>
                    </span>

                    <span className="px-2.5 py-1 rounded-full bg-[#008972] text-white text-[10px] font-black uppercase tracking-wider shadow-sm">
                      {durationText}
                    </span>
                  </div>

                  {/* Bottom Text inside Image */}
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="inline-block px-2 py-0.5 rounded-md bg-white/20 backdrop-blur-md text-[9px] font-bold uppercase tracking-wider mb-1">
                      {pkg.tripType || 'LUXURY'} CIRCUIT
                    </span>
                    <h3 className="text-base font-black leading-tight line-clamp-1 drop-shadow-sm">
                      {pkg.title}
                    </h3>
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-5 space-y-3.5">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {pkg.tagline || pkg.description}
                  </p>

                  {/* Route Flow */}
                  {pkg.routeSummary && pkg.routeSummary.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                        Circuit Route:
                      </span>
                      <div className="flex flex-wrap items-center gap-1">
                        {pkg.routeSummary.map((route, i) => (
                          <span
                            key={i}
                            className="px-2 py-0.5 bg-slate-100 rounded-lg text-[10px] font-semibold text-slate-700"
                          >
                            {route}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Value Props Strip */}
                  <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] text-slate-600 font-medium border-t border-slate-100">
                    <div className="flex items-center space-x-1.5">
                      <Hotel className="w-3.5 h-3.5 text-[#008972]" />
                      <span>5★ Luxury Hotels</span>
                    </div>
                    <div className="flex items-center space-x-1.5">
                      <Car className="w-3.5 h-3.5 text-[#008972]" />
                      <span>Private Chauffeur</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Footer */}
              <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] uppercase text-slate-400 font-bold block">
                    {isB2BAgent ? 'B2B Wholesale' : 'Starting From'}
                  </span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {formatCurrency(displayPrice, currency)} <span className="text-[10px] text-slate-400 font-sans font-normal">/ pax</span>
                  </span>
                </div>

                <div className="flex items-center space-x-1.5">
                  <button
                    onClick={() => setSelectedPackage(pkg)}
                    className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
                    title="View Full Itinerary & Details"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  {isB2BAgent ? (
                    <button
                      onClick={() => {
                        if (onCustomizePackage) {
                          onCustomizePackage(pkg);
                        } else {
                          setSelectedPackage(pkg);
                        }
                      }}
                      className="inline-flex items-center space-x-1.5 px-4 py-2 bg-slate-900 hover:bg-[#008972] text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                    >
                      <span>Customize</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={() => handleEnquire(pkg)}
                        className="inline-flex items-center space-x-1 px-3 py-2 bg-slate-200/80 hover:bg-slate-300 text-slate-800 rounded-xl text-xs font-bold transition-all cursor-pointer"
                        title="Enquire about this package"
                      >
                        <MessageSquare className="w-3.5 h-3.5 text-[#008972]" />
                        <span>Enquire</span>
                      </button>

                      <button
                        onClick={() => handleBook(pkg)}
                        className="inline-flex items-center space-x-1.5 px-3.5 py-2 bg-[#008972] hover:bg-[#007360] text-white rounded-xl text-xs font-black transition-all cursor-pointer shadow-xs"
                        title="Instant Book this package"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>Book Now</span>
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Package Detail Modal */}
      {selectedPackage && (
        <PackageDetailModal
          packageItem={selectedPackage}
          onClose={() => setSelectedPackage(null)}
          onCustomizePackage={isB2BAgent ? (pkg) => {
            setSelectedPackage(null);
            if (onCustomizePackage) {
              onCustomizePackage(pkg);
            }
          } : undefined}
          onInstantBook={(pkg) => {
            setSelectedPackage(null);
            handleBook(pkg);
          }}
          onEnquirePackage={(pkg) => {
            setSelectedPackage(null);
            handleEnquire(pkg);
          }}
        />
      )}

      {/* Package Enquiry Modal */}
      {enquiryPackage && (
        <PackageEnquiryModal
          packageItem={enquiryPackage}
          onClose={() => setEnquiryPackage(null)}
          currency={currency}
        />
      )}

      {/* Booking Modal */}
      {bookingPackage && (
        <BookingModal
          isOpen={true}
          onClose={() => setBookingPackage(null)}
          packageItem={bookingPackage}
          currency={currency}
          onBookingComplete={(booking) => {
            setBookingPackage(null);
            setConfirmedBooking(booking);
          }}
        />
      )}
    </div>
  );
};
