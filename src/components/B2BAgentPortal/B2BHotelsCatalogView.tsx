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
  Eye
} from 'lucide-react';
import { Hotel, Destination, Product } from '../../types';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';

interface B2BHotelsCatalogViewProps {
  hotels: Hotel[];
  destinations: Destination[];
  onOpenCreateQuote: () => void;
}

export const B2BHotelsCatalogView: React.FC<B2BHotelsCatalogViewProps> = ({
  hotels,
  destinations,
  onOpenCreateQuote
}) => {
  const { items, addProductToQuote, removeProductFromQuote, currency } = useQuotation();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDestination, setSelectedDestination] = useState<string>('ALL');
  const [selectedStarRating, setSelectedStarRating] = useState<string>('ALL');
  const [previewHotel, setPreviewHotel] = useState<Hotel | null>(null);

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
    return items.some(it => it.product.id === hotelId);
  };

  const toggleHotel = (hotel: Hotel) => {
    const existing = items.find(it => it.product.id === hotel.id);
    if (existing) {
      removeProductFromQuote(existing.id);
    } else {
      const room = hotel.roomTypes?.[0];
      const rateUSD = room?.rates?.[0]?.adultNettCost || room?.rates?.[0]?.doubleNetRate || 380;
      const hotelProd: Product = {
        id: hotel.id,
        sku: `HTL-${hotel.id}`,
        destinationId: hotel.destinationId || 'dest-japan',
        destinationName: 'Contracted Property',
        country: hotel.cityName || 'Japan',
        city: hotel.cityName || 'Tokyo',
        productType: 'Hotel',
        name: `${hotel.name} (${room?.roomName || 'Deluxe Room'})`,
        shortDescription: hotel.shortDescription || '5-Star Luxury Accommodation',
        longDescription: hotel.shortDescription || '',
        supplierId: 'sup-hotel',
        supplierName: hotel.name,
        supplierProductCode: `SUP-HTL-${hotel.id}`,
        category: 'Travel Services',
        subcategory: 'Luxury Stay',
        duration: 'Per Night',
        operatingDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        operatingHours: '24/7 Concierge',
        adultNetPrice: rateUSD,
        childNetPrice: 0,
        infantNetPrice: 0,
        currency: 'USD',
        defaultMarkupPercent: 15,
        taxPercent: 10,
        commissionPercent: 10,
        serviceFeeFixed: 0,
        sellingPriceStartingFrom: rateUSD * 1.2,
        season: 'All Year',
        validityFrom: '2025-01-01',
        validityTo: '2026-12-31',
        minPax: 1,
        maxPax: 4,
        availability: 'INSTANT',
        bookingRequiredDays: 1,
        cancellationPolicy: 'Free cancellation up to 7 days prior.',
        inclusions: ['Daily Gourmet Breakfast', 'Complimentary WiFi', 'Access to Health Club'],
        exclusions: ['City Stay Taxes (payable on departure)', 'Personal Incidental Expenses'],
        importantInformation: ['Valid Passport Required at Check-in', 'Standard Check-in 15:00'],
        meetingPoint: hotel.address || 'Hotel Front Desk Reception',
        pickupInformation: 'Direct check-in at front desk',
        images: hotel.images?.length ? hotel.images : ['https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop'],
        location: hotel.address || 'City Center',
        latitude: 35.6762,
        longitude: 139.6503,
        rating: hotel.starRating || 5,
        reviewCount: 48,
        status: 'ACTIVE',
        lastUpdated: new Date().toISOString()
      };

      addProductToQuote(hotelProd, {
        adults: 2,
        children: 0,
        infants: 0
      });
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-[10px] font-bold uppercase tracking-wider">
              5★ Hotel & Ryokan Master Directory
            </span>
            <span className="text-xs text-slate-400">({hotels.length} Luxury Properties)</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 font-sans mt-1">Contracted Accommodations</h1>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            Direct wholesale allocations with room upgrades, breakfast inclusions, and VIP welcome amenities.
          </p>
        </div>

        <button
          onClick={onOpenCreateQuote}
          className="inline-flex items-center space-x-2 bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white px-5 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer"
        >
          <span>Open Quotation Builder ({items.length} in Quote)</span>
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search hotels by property name or city (e.g. Tokyu Capitol, Savoy, Bürgenstock, Ritz-Carlton)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 outline-none focus:border-[#00C6A6]"
          />
        </div>

        <div className="flex items-center space-x-2 w-full md:w-auto">
          <select
            value={selectedDestination}
            onChange={(e) => setSelectedDestination(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All Destinations</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>

          <select
            value={selectedStarRating}
            onChange={(e) => setSelectedStarRating(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 outline-none cursor-pointer"
          >
            <option value="ALL">All Ratings</option>
            <option value="5">5★ Luxury</option>
            <option value="4">4★ Premium</option>
          </select>
        </div>
      </div>

      {/* Hotels Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredHotels.map(hotel => {
          const isSelected = isHotelInQuote(hotel.id);
          const startingRate = hotel.roomTypes?.[0]?.rateUSD || 380;

          return (
            <div
              key={hotel.id}
              className={`bg-white border rounded-3xl overflow-hidden shadow-xs hover:shadow-xl transition-all flex flex-col justify-between group ${
                isSelected ? 'border-[#00C6A6] ring-1 ring-[#00C6A6]' : 'border-slate-200 hover:border-slate-300'
              }`}
            >
              <div>
                <div className="h-44 relative overflow-hidden bg-slate-900">
                  <img
                    src={hotel.heroImage || 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=800&auto=format&fit=crop'}
                    alt={hotel.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent"></div>
                  <div className="absolute top-3 left-3 px-2 py-0.5 rounded-full bg-slate-900/80 backdrop-blur text-[10px] font-bold text-[#00E5C0]">
                    {hotel.cityName || hotel.city}
                  </div>
                  <div className="absolute top-3 right-3 flex items-center px-2 py-0.5 rounded-full bg-white/95 text-[10px] font-extrabold text-amber-600">
                    <Star className="w-3 h-3 fill-amber-500 mr-0.5 text-amber-500" />
                    {hotel.starRating || 5}★
                  </div>
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <h3 className="text-sm font-bold leading-tight truncate">{hotel.name}</h3>
                  </div>
                </div>

                <div className="p-5 space-y-3">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {hotel.shortDescription || 'Prestigious property with dedicated concierge, bespoke dining, and wellness spa.'}
                  </p>

                  <div className="bg-slate-50 p-3 rounded-2xl border border-slate-100 space-y-1 text-xs">
                    <div className="flex justify-between text-slate-700">
                      <span className="font-semibold">Lead Room:</span>
                      <span>{hotel.roomTypes?.[0]?.name || 'Club Deluxe Room'}</span>
                    </div>
                    <div className="flex justify-between text-slate-700">
                      <span className="font-semibold">Board Basis:</span>
                      <span className="text-teal-700 font-bold">Bed & Gourmet Breakfast</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <span className="text-[10px] text-slate-400 block leading-tight">Wholesale Tariff / Night</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {formatCurrency(startingRate, currency)}
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setPreviewHotel(hotel)}
                    className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                  >
                    <Eye className="w-4 h-4" />
                  </button>

                  <button
                    onClick={() => toggleHotel(hotel)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white'
                    }`}
                  >
                    {isSelected ? '✓ In Quote' : '+ Add Hotel'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Hotel Preview Modal */}
      {previewHotel && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-5 shadow-2xl animate-in fade-in zoom-in-95">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] font-bold text-[#00C6A6] uppercase tracking-wider block">
                  {previewHotel.cityName || previewHotel.city} • {previewHotel.starRating || 5}★ Property
                </span>
                <h3 className="text-xl font-bold text-slate-900">{previewHotel.name}</h3>
              </div>
              <button
                onClick={() => setPreviewHotel(null)}
                className="p-1.5 text-slate-400 hover:text-slate-900 rounded-lg hover:bg-slate-100"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              {previewHotel.shortDescription || 'Full 5-star hotel profile with wholesale contractual rate guarantee.'}
            </p>

            <div className="space-y-2">
              <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Available Room Categories:</h4>
              <div className="space-y-2">
                {(previewHotel.roomTypes || [
                  { id: 'rm-1', name: 'Deluxe City View King', rateUSD: 380 },
                  { id: 'rm-2', name: 'Executive Suite with Club Access', rateUSD: 590 }
                ]).map((rm, i) => (
                  <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                    <span className="font-bold text-slate-900">{rm.name}</span>
                    <span className="font-mono font-bold text-teal-800">{formatCurrency(rm.rateUSD, currency)} / night</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
              <button
                onClick={() => setPreviewHotel(null)}
                className="text-xs font-bold text-slate-500 hover:text-slate-900"
              >
                Close
              </button>

              <button
                onClick={() => {
                  toggleHotel(previewHotel);
                  setPreviewHotel(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-[#00C6A6] hover:text-slate-950 text-white text-xs font-bold transition-all cursor-pointer"
              >
                {isHotelInQuote(previewHotel.id) ? 'Remove from Quote' : 'Add to Active Quotation'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
