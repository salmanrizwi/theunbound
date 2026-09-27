import React, { useState } from 'react';
import { MapPin, Clock, Users, Car, Ship, Ticket, Languages, Utensils, Compass } from 'lucide-react';
import { CurrencyCode, ProductCategory } from '../../types';

interface ProductPreviewCardProps {
  name: string;
  category: ProductCategory;
  cityName?: string;
  destinationName?: string;
  duration?: string;
  imageUrl?: string;
  currency?: CurrencyCode;
  startingPrice?: number;
  status?: string;
  capacityText?: string;
  upsellCount?: number;
  routeText?: string;
  languageText?: string;
  mealsText?: string;
  className?: string;
}

export const ProductPreviewCard: React.FC<ProductPreviewCardProps> = ({
  name,
  category,
  cityName = 'Tokyo',
  destinationName = 'Japan',
  duration = 'Full Day',
  imageUrl,
  currency = 'USD',
  startingPrice = 0,
  status = 'ACTIVE',
  capacityText,
  upsellCount = 0,
  routeText,
  languageText,
  mealsText,
  className = ''
}) => {
  const [imgError, setImgError] = useState(false);

  const getCategoryIcon = (cat: ProductCategory) => {
    switch (cat) {
      case 'Private Tours':
      case 'Transfers':
        return <Car className="w-3.5 h-3.5" />;
      case 'Group Tours':
        return <Users className="w-3.5 h-3.5" />;
      case 'Tickets':
        return <Ticket className="w-3.5 h-3.5" />;
      case 'Guides':
        return <Languages className="w-3.5 h-3.5" />;
      case 'Lunch / Dinner Restaurant':
        return <Utensils className="w-3.5 h-3.5" />;
      case 'Private Yacht':
        return <Ship className="w-3.5 h-3.5" />;
      default:
        return <Compass className="w-3.5 h-3.5" />;
    }
  };

  const defaultImage = 'https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=800';

  return (
    <div className={`bg-slate-900 text-white rounded-2xl overflow-hidden shadow-md border border-slate-800 ${className}`}>
      <div className="h-44 bg-slate-800 relative">
        {!imgError && (imageUrl || defaultImage) ? (
          <img
            src={imageUrl || defaultImage}
            alt={name || 'Product Preview'}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover opacity-90 transition-opacity duration-200"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-slate-800 to-indigo-950 flex flex-col items-center justify-center p-4 text-center">
            {getCategoryIcon(category)}
            <span className="text-xs font-bold text-slate-300 mt-2">{name || 'Product Image'}</span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="bg-[#00C6A6] text-slate-950 text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-xs">
            Product Preview
          </span>
          <span className="bg-slate-950/80 text-white text-[10px] font-bold px-2 py-0.5 rounded border border-slate-800">
            {status}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-1.5 text-[#00E5C0] text-[10px] font-bold uppercase tracking-wider mb-0.5">
            {getCategoryIcon(category)}
            <span>{category}</span>
          </div>
          <h4 className="text-sm font-black text-white leading-snug line-clamp-2">
            {name || 'Mt. Fuji Private Tour'}
          </h4>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#00C6A6]" />
            <span>{cityName}, {destinationName}</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{duration}</span>
          </span>
        </div>

        {/* Category-Specific Preview Badges */}
        <div className="space-y-1 text-[11px]">
          {routeText && (
            <div className="text-teal-300 font-medium truncate">
              Route: <strong>{routeText}</strong>
            </div>
          )}
          {languageText && (
            <div className="text-slate-300 truncate">
              Languages: <strong>{languageText}</strong>
            </div>
          )}
          {mealsText && (
            <div className="text-amber-300 truncate">
              Regime: <strong>{mealsText}</strong>
            </div>
          )}
          {upsellCount > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-900/60 border border-teal-700/60 text-teal-300 text-[10px] font-bold">
              <span>✨ {upsellCount} Optional Experience{upsellCount > 1 ? 's' : ''} Available</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-800">
          <div>
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block font-semibold">
              Final Price
            </span>
            {capacityText && (
              <span className="text-[10px] text-slate-400">{capacityText}</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-base font-black font-mono text-[#00C6A6]">
              {currency} {startingPrice ? startingPrice.toLocaleString() : '0'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
