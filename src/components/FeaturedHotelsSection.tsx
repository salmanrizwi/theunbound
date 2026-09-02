import React, { useState } from 'react';
import { Hotel } from '../types';
import { useQuotation } from '../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../services/pricingEngine';
import { hotelToProduct } from '../utils/hotelHelpers';
import { 
  Building, 
  Star, 
  MapPin, 
  Bed, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  Plus, 
  Check, 
  ShieldCheck, 
  Eye, 
  Compass,
  Layers,
  ChevronRight
} from 'lucide-react';

interface FeaturedHotelsSectionProps {
  hotels: Hotel[];
  destinationName?: string;
  onViewHotel: (hotel: Hotel) => void;
  onExploreMoreHotels?: () => void;
}

export const FeaturedHotelsSection: React.FC<FeaturedHotelsSectionProps> = ({
  hotels,
  destinationName,
  onViewHotel,
  onExploreMoreHotels
}) => {
  const { currency, addProductToQuote } = useQuotation();
  const [justAddedHotelId, setJustAddedHotelId] = useState<string | null>(null);

  // STRICT RULE: If there are NO hotels to show, conditionally hide completely!
  if (!hotels || hotels.length === 0) {
    return null;
  }

  const handleQuickAddHotel = (hotel: Hotel, e: React.MouseEvent) => {
    e.stopPropagation();
    const firstRoom = (hotel.roomTypes || [])[0];
    const prod = hotelToProduct(hotel, firstRoom, undefined, 3);
    addProductToQuote(prod, {
      adults: 2,
      children: 0,
      infants: 0,
      openDrawer: true
    });
    setJustAddedHotelId(hotel.id);
    setTimeout(() => setJustAddedHotelId(null), 2000);
  };

  return (
    <section id="featured-hotels-section" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center space-x-2 text-xs font-bold uppercase tracking-wider text-[#008972] mb-1">
            <Building className="w-4 h-4 text-[#00C6A6]" />
            <span>Direct DMC Accommodation Inventory</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-slate-900">
            Featured Luxury Hotels & Heritage Stays {destinationName && destinationName !== 'All Destinations' ? `in ${destinationName}` : ''}
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Contracted 5-star properties, traditional ryokans, and boutique residences with negotiated wholesale rates and VIP amenities.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <span className="text-xs font-semibold text-slate-400">
            <strong className="text-slate-900 font-bold">{hotels.length}</strong> {hotels.length === 1 ? 'Property' : 'Properties'} Available
          </span>
          {onExploreMoreHotels && (
            <button
              type="button"
              onClick={onExploreMoreHotels}
              className="text-xs font-bold text-[#00C6A6] hover:text-[#008972] flex items-center space-x-1 transition-colors cursor-pointer"
            >
              <span>View All Hotels</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Hotel Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {hotels.map((hotel) => {
          const startingConverted = convertCurrency(hotel.startingNetPrice, hotel.currency, currency);
          const isJustAdded = justAddedHotelId === hotel.id;

          return (
            <div
              key={hotel.id}
              onClick={() => onViewHotel(hotel)}
              className="group bg-white rounded-2xl border border-slate-200 hover:border-[#00C6A6]/60 shadow-xs hover:shadow-xl transition-all duration-300 overflow-hidden flex flex-col cursor-pointer"
            >
              {/* Hotel Hero Image */}
              <div className="relative h-52 sm:h-56 overflow-hidden bg-slate-900">
                <img
                  src={hotel.heroImage}
                  alt={hotel.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent pointer-events-none" />

                {/* Star Rating & Property Type Badge */}
                <div className="absolute top-3 left-3 flex items-center space-x-2">
                  <span className="bg-slate-900/85 backdrop-blur-xs text-white text-[11px] font-bold px-2.5 py-1 rounded-lg border border-white/15 flex items-center space-x-1">
                    <Building className="w-3 h-3 text-[#00C6A6]" />
                    <span>{hotel.propertyType ? hotel.propertyType.replace('_', ' ') : 'Hotel'}</span>
                  </span>
                  <div className="flex items-center bg-amber-500/90 text-white text-[11px] font-bold px-2 py-0.5 rounded-lg shadow-xs">
                    <Star className="w-3 h-3 fill-current mr-0.5" />
                    <span>{hotel.starRating}★</span>
                  </div>
                </div>

                {/* Location Badge (Bottom Left) */}
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <div className="flex items-center space-x-1.5 text-xs text-teal-300 font-medium mb-0.5">
                    <MapPin className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{hotel.area}, {hotel.cityName}</span>
                  </div>
                  <h3 className="text-base font-bold text-white line-clamp-1 group-hover:text-teal-200 transition-colors">
                    {hotel.name}
                  </h3>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-4 sm:p-5 flex-1 flex flex-col justify-between space-y-4">
                <div className="space-y-3">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {hotel.shortDescription || hotel.description}
                  </p>

                  {/* Amenities Highlights */}
                  {hotel.amenities && (hotel.amenities || []).length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {(hotel.amenities || []).slice(0, 3).map((amenity, i) => (
                        <span
                          key={i}
                          className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md flex items-center space-x-1"
                        >
                          <CheckCircle2 className="w-2.5 h-2.5 text-teal-600" />
                          <span className="truncate max-w-[140px]">{amenity}</span>
                        </span>
                      ))}
                      {(hotel.amenities || []).length > 3 && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-50 px-1.5 py-0.5 rounded-md">
                          +{(hotel.amenities || []).length - 3} more
                        </span>
                      )}
                    </div>
                  )}

                  {/* Room Categories preview */}
                  <div className="flex items-center space-x-2 text-xs text-slate-500 pt-1">
                    <Bed className="w-3.5 h-3.5 text-slate-400" />
                    <span>
                      {hotel.roomTypes?.length || 1} {(hotel.roomTypes?.length || 1) === 1 ? 'Room Category' : 'Room Categories'} Available
                    </span>
                  </div>
                </div>

                {/* Card Footer: Pricing & Actions */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block uppercase tracking-wider">
                      Direct Contracted Rate from
                    </span>
                    <div className="flex items-baseline space-x-1">
                      <span className="text-base sm:text-lg font-black text-slate-900 group-hover:text-[#008972] transition-colors">
                        {formatCurrency(startingConverted, currency)}
                      </span>
                      <span className="text-[11px] text-slate-500 font-normal">/ night</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="button"
                      onClick={(e) => handleQuickAddHotel(hotel, e)}
                      title="Add to Itinerary Quotation"
                      className={`p-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                        isJustAdded
                          ? 'bg-emerald-500 text-white border-emerald-500'
                          : 'bg-slate-100 hover:bg-[#00C6A6] text-slate-700 hover:text-white border-slate-200 hover:border-[#00C6A6]'
                      }`}
                    >
                      {isJustAdded ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                    </button>

                    <button
                      type="button"
                      onClick={() => onViewHotel(hotel)}
                      className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl shadow-2xs hover:shadow-xs transition-colors flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Explore</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
};
