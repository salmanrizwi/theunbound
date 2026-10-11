import React, { useState, useEffect } from 'react';
import { MapPin, Clock, Users, Car, Ship, Anchor, Ticket, Languages, Utensils, Compass, Calendar, Tag } from 'lucide-react';
import { CurrencyCode, ProductCategory } from '../../types';
import { canonicalImageService } from '../../services/imageService';

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
  validFrom?: string;
  validTo?: string;
  activeSurchargeCount?: number;
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
  validFrom,
  validTo,
  activeSurchargeCount = 0,
  className = ''
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [imageUrl]);

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
      case 'Ferries':
      case 'Ferry':
        return <Anchor className="w-3.5 h-3.5" />;
      default:
        return <Compass className="w-3.5 h-3.5" />;
    }
  };

  const validation = canonicalImageService.validateUserSuppliedImageUrl(imageUrl);
  const cleanPreviewUrl = validation.isValid && !validation.isEmpty ? validation.cleanUrl : '';

  return (
    <div className={`bg-white text-slate-800 rounded-2xl overflow-hidden shadow-xs border border-slate-200/90 ${className}`}>
      <div className="h-44 bg-slate-100 relative">
        {cleanPreviewUrl && !imgError ? (
          <img
            src={cleanPreviewUrl}
            alt={name || 'Product Preview'}
            onLoad={() => setImgError(false)}
            onError={() => setImgError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover transition-opacity duration-200"
          />
        ) : !validation.isValid ? (
          <div className="w-full h-full bg-rose-50 flex flex-col items-center justify-center p-4 text-center border-b border-rose-200">
            <span className="text-xs font-black text-rose-700">Invalid Image URL</span>
            <span className="text-[10px] font-medium text-rose-600 mt-1 line-clamp-2">{validation.error}</span>
          </div>
        ) : imgError ? (
          <div className="w-full h-full bg-rose-50 flex flex-col items-center justify-center p-4 text-center border-b border-rose-200">
            <span className="text-xs font-black text-rose-700">Image Failed to Load</span>
            <span className="text-[10px] font-medium text-rose-600 mt-1">Verify that the image URL is publicly accessible.</span>
          </div>
        ) : (
          <div className="w-full h-full bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
            {getCategoryIcon(category)}
            <span className="text-xs font-bold text-slate-500 mt-2">{name || 'Product Preview'}</span>
            <span className="text-[10px] text-slate-400 mt-0.5">No custom image configured</span>
          </div>
        )}

        <div className="absolute top-3 left-3 flex items-center gap-2">
          <span className="bg-[#00C6A6] text-white text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded shadow-xs">
            Product Preview
          </span>
          <span className="bg-white/90 backdrop-blur-xs text-slate-700 text-[10px] font-bold px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
            {status}
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        <div>
          <div className="flex items-center gap-1.5 text-[#008972] text-[10px] font-bold uppercase tracking-wider mb-0.5">
            {getCategoryIcon(category)}
            <span>{category}</span>
          </div>
          <h4 className="text-sm font-black text-slate-900 leading-snug line-clamp-2">
            {name || 'Mt. Fuji Private Tour'}
          </h4>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500">
          <span className="flex items-center gap-1">
            <MapPin className="w-3 h-3 text-[#00C6A6]" />
            <span>{cityName}, {destinationName}</span>
          </span>
          <span className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-slate-400" />
            <span>{duration}</span>
          </span>
        </div>

        {/* Category-Specific & Validity/Surcharge Preview Badges */}
        <div className="space-y-1 text-[11px]">
          {routeText && (
            <div className="text-[#008972] font-semibold truncate">
              Route: <strong>{routeText}</strong>
            </div>
          )}
          {languageText && (
            <div className="text-slate-600 truncate">
              Languages: <strong>{languageText}</strong>
            </div>
          )}
          {mealsText && (
            <div className="text-amber-700 truncate">
              Regime: <strong>{mealsText}</strong>
            </div>
          )}
          {(validFrom || validTo) && (
            <div className="flex items-center gap-1 text-slate-600 font-medium truncate">
              <Calendar className="w-3 h-3 text-[#008972] shrink-0" />
              <span>Valid: <strong className="font-mono">{validFrom || '—'}</strong> to <strong className="font-mono">{validTo || '—'}</strong></span>
            </div>
          )}
          {activeSurchargeCount > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-bold mr-1">
              <Tag className="w-2.5 h-2.5" />
              <span>{activeSurchargeCount} Active Surcharge{activeSurchargeCount > 1 ? 's' : ''}</span>
            </div>
          )}
          {upsellCount > 0 && (
            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-teal-50 border border-teal-200 text-[#008972] text-[10px] font-bold">
              <span>✨ {upsellCount} Optional Experience{upsellCount > 1 ? 's' : ''} Available</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between text-xs pt-3 border-t border-slate-100">
          <div>
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-semibold">
              Final Price
            </span>
            {capacityText && (
              <span className="text-[10px] text-slate-400">{capacityText}</span>
            )}
          </div>
          <div className="text-right">
            <span className="text-base font-black font-mono text-[#008972]">
              {currency} {startingPrice ? startingPrice.toLocaleString() : '0'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
