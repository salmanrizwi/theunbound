import React, { useState, useMemo } from 'react';
import { 
  Building2, 
  Search, 
  MapPin, 
  Star, 
  Check, 
  Plus, 
  DollarSign, 
  ShieldCheck, 
  Sparkles,
  ArrowRight,
  Eye,
  BookmarkCheck,
  X,
  Coffee,
  Wifi,
  Tv,
  Utensils,
  Trash2,
  Calendar,
  Bed
} from 'lucide-react';
import { Hotel, Destination, Product } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';
import { AddHotelToQuoteModal } from './AddHotelToQuoteModal';
import { HotelDetailModal } from '../HotelDetailModal';

interface B2BHotelsCatalogViewProps {
  hotels: Hotel[];
  destinations: Destination[];
  onOpenCreateQuote: () => void;
  onViewHotelDetails?: (hotel: Hotel) => void;
}

export const B2BHotelsCatalogView: React.FC<B2BHotelsCatalogViewProps> = ({
  hotels,
  destinations,
  onOpenCreateQuote,
  onViewHotelDetails
}) => {
  const { items, removeProductFromQuote, currency, setIsQuoteDrawerOpen } = useQuotation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedStarRating, setSelectedStarRating] = useState<string>('ALL');
  
  // Modal states
  const [selectedHotelForDetails, setSelectedHotelForDetails] = useState<Hotel | null>(null);
  const [selectedHotelForQuote, setSelectedHotelForQuote] = useState<Hotel | null>(null);
  const [quoteSuccessNotification, setQuoteSuccessNotification] = useState<{ hotel: Hotel; details: any } | null>(null);

  const filteredHotels = useMemo(() => {
    return hotels.filter(h => {
      const matchesSearch = 
        h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (h.cityName && h.cityName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (h.city && h.city.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesDest = selectedDestination === 'ALL' || h.destinationId === selectedDestination;
      const matchesStar = selectedStarRating === 'ALL' || (h.starRating && h.starRating.toString() === selectedStarRating);

      return matchesSearch && matchesDest && matchesStar;
    });
  }, [hotels, searchQuery, selectedDestination, selectedStarRating]);

  const isHotelInQuote = (hotelId: string) => {
    return items.some(it => it.product.id === hotelId || it.product.id.includes(hotelId));
  };

  const handleOpenAddHotelModal = (hotel: Hotel) => {
    setSelectedHotelForQuote(hotel);
  };

  const handleRemoveHotelFromQuote = (hotelId: string) => {
    const existing = items.find(it => it.product.id === hotelId || it.product.id.includes(hotelId));
    if (existing) {
      removeProductFromQuote(existing.id);
    }
  };

  const handleViewDetails = (hotel: Hotel) => {
    if (onViewHotelDetails) {
      onViewHotelDetails(hotel);
    } else {
      setSelectedHotelForDetails(hotel);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-200 text-[10px] font-bold uppercase tracking-wider">
              5★ Contracted Accommodations & Ryokans
            </span>
            <span className="text-xs text-slate-400 font-mono">({hotels.length} Luxury Properties)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Contracted Accommodations & Ryokans</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Direct wholesale allocations with room upgrades, gourmet breakfast inclusions, and VIP welcome amenities.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
        >
          <span>Open Quotation Builder ({items.length} in Quote)</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Success Notification */}
      {quoteSuccessNotification && (
        <div className="bg-amber-950 text-white px-5 py-3.5 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-lg border border-amber-500/40 animate-in fade-in slide-in-from-top-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-bold">
              <Check className="w-4 h-4 stroke-[3]" />
            </div>
            <div>
              <div className="text-xs font-bold text-white">
                {quoteSuccessNotification.hotel.name} added to Cart!
              </div>
              <div className="text-[11px] text-amber-300">
                {quoteSuccessNotification.details?.nights || 3} Nights ({quoteSuccessNotification.details?.checkInDate} to {quoteSuccessNotification.details?.checkOutDate}) • {quoteSuccessNotification.details?.roomName || 'Deluxe Room'}.
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={() => setIsQuoteDrawerOpen(true)}
              className="px-3.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black transition-all cursor-pointer shadow-xs flex items-center space-x-1.5"
            >
              <Building2 className="w-3.5 h-3.5" />
              <span>View Cart</span>
            </button>
            <button
              onClick={() => setQuoteSuccessNotification(null)}
              className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search hotels by property name or city (e.g. Tokyu Capitol, Savoy, Bürgenstock, Ritz-Carlton, Hoshinoya)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6] focus:bg-white transition-all"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="ALL">All Destinations</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={selectedStarRating}
            onChange={(e) => setSelectedStarRating(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer hover:border-slate-300"
          >
            <option value="ALL">All Ratings</option>
            <option value="5">5★ Luxury & Ryokans</option>
            <option value="4">4★ Premium Heritage</option>
          </select>
        </div>
      </div>

      {/* Hotels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHotels.map(hotel => {
          const inQuote = isHotelInQuote(hotel.id);
          const room = hotel.roomTypes?.[0];
          const finalSellingPriceUSD = hotel.startingSellingPrice || Math.round((room?.rates?.[0]?.adultNettCost || room?.rates?.[0]?.doubleNetRate || hotel.startingNetPrice || 380) * 1.25);

          return (
            <div
              key={hotel.id}
              className="bg-white rounded-3xl border border-slate-200/90 shadow-xs hover:shadow-lg hover:border-amber-500 transition-all flex flex-col overflow-hidden group"
            >
              {/* Image Header */}
              <div 
                className="relative h-48 overflow-hidden bg-slate-900 cursor-pointer"
                onClick={() => handleViewDetails(hotel)}
              >
                <img
                  src={hotel.heroImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop'}
                  alt={hotel.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                <div className="absolute top-3 left-3 px-2.5 py-0.5 rounded-full bg-slate-900/80 backdrop-blur-xs text-[10px] font-bold text-[#00E5C0]">
                  {hotel.cityName || hotel.city}
                </div>
                <div className="absolute top-3 right-3 flex items-center px-2.5 py-0.5 rounded-full bg-amber-400 text-[10px] font-black text-slate-950">
                  <Star className="w-3 h-3 fill-slate-950 mr-0.5" />
                  {hotel.starRating || 5}★
                </div>
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <h3 className="text-base font-extrabold leading-tight truncate drop-shadow-xs">{hotel.name}</h3>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-2.5">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {hotel.shortDescription || 'Prestigious property with dedicated concierge, bespoke dining, and wellness spa.'}
                  </p>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span className="font-semibold text-[11px]">Contract Room:</span>
                      <span className="font-bold text-slate-900 truncate max-w-[150px]">{room?.roomName || 'Deluxe Room'}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span className="font-semibold text-[11px]">Board Basis:</span>
                      <span className="text-emerald-700 font-bold">Gourmet Breakfast Included</span>
                    </div>
                  </div>
                </div>

                {/* Price Row */}
                <div className="pt-3 border-t border-slate-100 flex items-baseline justify-between">
                  <div>
                    <span className="text-[10px] text-slate-400 block font-bold uppercase tracking-wider">Final Selling Price</span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-base font-black text-slate-900 font-mono">
                        {formatCurrency(finalSellingPriceUSD, currency)}
                      </span>
                      <span className="text-[10px] text-slate-400">/ night</span>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Direct Allotment
                  </span>
                </div>

                {/* Standardized 3 Action Buttons */}
                <div className="space-y-2 pt-1">
                  {/* Primary Row: Add to Quote or In Quote status */}
                  {inQuote ? (
                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => handleOpenAddHotelModal(hotel)}
                        className="flex-1 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs"
                        title="Click to adjust stay dates, nights or room tier"
                      >
                        <Check className="w-3.5 h-3.5" />
                        <span>In Cart (Edit Stay)</span>
                      </button>
                      <button
                        onClick={() => handleRemoveHotelFromQuote(hotel.id)}
                        className="p-2.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
                        title="Remove from Cart"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenAddHotelModal(hotel)}
                      className="w-full py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center space-x-1.5 cursor-pointer shadow-xs bg-amber-500 hover:bg-amber-600 text-slate-950"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Configure & Add to Cart</span>
                    </button>
                  )}

                  {/* Secondary Row: View Details (Full Width) */}
                  <button
                    onClick={() => handleViewDetails(hotel)}
                    className="w-full py-2 px-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5 text-slate-300" />
                    <span>View Details</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Dedicated Add Hotel to Quote Modal with Live Stay Calculator */}
      {selectedHotelForQuote && (
        <AddHotelToQuoteModal
          hotel={selectedHotelForQuote}
          isOpen={!!selectedHotelForQuote}
          onClose={() => setSelectedHotelForQuote(null)}
          onSuccess={(h, details) => {
            setQuoteSuccessNotification({ hotel: h, details });
          }}
        />
      )}

      {/* Standardized Buyer-style Hotel Details Modal */}
      {selectedHotelForDetails && (
        <HotelDetailModal
          hotel={selectedHotelForDetails}
          onClose={() => setSelectedHotelForDetails(null)}
        />
      )}
    </div>
  );
};
