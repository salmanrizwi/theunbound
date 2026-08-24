import React from 'react';
import { Product } from '../types';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { formatCurrency, convertCurrency } from '../services/pricingEngine';
import { 
  Star, 
  Clock, 
  MapPin, 
  Lock, 
  Calculator, 
  Check, 
  Plus, 
  Eye, 
  ShieldCheck,
  Calendar,
  Zap,
  Briefcase
} from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onViewDetails: (product: Product) => void;
  onOpenCalculator: (product: Product) => void;
  onInstantBook?: (product: Product) => void;
}

export const ProductCard: React.FC<ProductCardProps> = ({
  product,
  onViewDetails,
  onOpenCalculator,
  onInstantBook
}) => {
  const { isAuthenticated, openAuthModal, role } = useAuth();
  const { currency, addProductToQuote, items } = useQuotation();

  const isB2BAgentOrAdmin = role === 'B2B_AGENT' || role === 'ADMIN' || role === 'TEAM_MEMBER' || role === 'DMC_STAFF';
  const isAlreadyInQuote = items.some(item => item.product.id === product.id);

  // Convert starting baseline price to active currency
  const convertedStartingPrice = convertCurrency(
    product.sellingPriceStartingFrom,
    product.currency,
    currency
  );

  const handleCalculatorClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isAuthenticated) {
      openAuthModal(
        `Please sign in as a travel agent to calculate dynamic wholesale rates for "${product.name}".`,
        () => onOpenCalculator(product)
      );
      return;
    }
    onOpenCalculator(product);
  };

  const handleInstantBookClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onInstantBook) {
      onInstantBook(product);
    } else {
      onViewDetails(product);
    }
  };

  const getAvailabilityBadge = () => {
    switch (product.availability) {
      case 'INSTANT':
        return <span className="bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[10px] font-semibold px-2 py-0.5 rounded-md">Instant Confirmation</span>;
      case 'ON_REQUEST':
        return <span className="bg-amber-50 text-amber-700 border border-amber-200/80 text-[10px] font-semibold px-2 py-0.5 rounded-md">On Request (24h SLA)</span>;
      case 'LIMITED':
        return <span className="bg-purple-50 text-purple-700 border border-purple-200/80 text-[10px] font-semibold px-2 py-0.5 rounded-md">Limited Allotment</span>;
      default:
        return <span className="bg-slate-100 text-slate-700 text-[10px] font-semibold px-2 py-0.5 rounded-md">Available</span>;
    }
  };

  return (
    <div 
      id={`product-card-${product.id}`}
      className="bg-white rounded-2xl shadow-xs border border-slate-200 hover:border-[#00C6A6]/60 group overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md"
    >
      {/* Product Image Section */}
      <div 
        className="relative h-48 w-full overflow-hidden bg-slate-100 cursor-pointer"
        onClick={() => onViewDetails(product)}
      >
        <img
          src={product.images[0] || 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=800&auto=format&fit=crop'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        {/* Category Pill on top right */}
        <span className="absolute top-3 right-3 bg-white/95 backdrop-blur px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider text-[#00C6A6] shadow-sm">
          {product.category}
        </span>

        {/* Location pill on top left */}
        <span className="absolute top-3 left-3 bg-slate-900/85 backdrop-blur text-white text-[10px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1 shadow-sm">
          <MapPin className="w-3 h-3 text-[#00C6A6]" />
          <span>{product.city}</span>
        </span>

        {/* SKU tag for internal transparency */}
        {(role === 'ADMIN' || role === 'DMC_STAFF') && (
          <div className="absolute bottom-2.5 left-3">
            <span className="bg-slate-900/90 text-[10px] font-mono font-bold text-[#00E5C0] px-2 py-0.5 rounded">
              {product.sku}
            </span>
          </div>
        )}
      </div>

      {/* Card Body */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          <h3 
            onClick={() => onViewDetails(product)}
            className="font-bold text-slate-900 mb-1 group-hover:text-[#00C6A6] transition-colors leading-snug cursor-pointer line-clamp-1 text-base"
          >
            {product.name}
          </h3>

          <p className="text-xs text-slate-500 mb-3 line-clamp-2 leading-relaxed">
            {product.shortDescription}
          </p>

          <div className="flex items-center gap-4 text-[11px] text-slate-400 mb-4">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-400" />
              <span>{product.duration}</span>
            </span>

            <span className="flex items-center gap-1">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              <span className="font-semibold text-slate-700">{product.rating.toFixed(1)}</span>
              <span>({product.reviewCount})</span>
            </span>

            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5 text-slate-400" />
              <span>{product.city}</span>
            </span>
          </div>

          <div className="flex items-center justify-between mb-3 pt-2 border-t border-slate-100">
            {getAvailabilityBadge()}
            <span className="text-[11px] text-slate-400 flex items-center space-x-1">
              <Calendar className="w-3 h-3" />
              <span>{product.bookingRequiredDays}d advance</span>
            </span>
          </div>
        </div>

        {/* Pricing and Action Footer */}
        <div className="pt-3 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-3">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Direct Rate From
              </span>
              <div className="flex items-baseline space-x-1">
                <span className="text-lg font-extrabold text-slate-900 font-mono">
                  {formatCurrency(convertedStartingPrice, currency)}
                </span>
                <span className="text-xs text-slate-500 font-medium">/ pax</span>
              </div>
            </div>

            {/* Admin / Staff net cost */}
            {(role === 'ADMIN' || role === 'DMC_STAFF') && (
              <div className="text-right">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C6A6] block">
                  Net Cost ({product.currency})
                </span>
                <span className="text-xs font-mono font-bold text-slate-700">
                  {formatCurrency(product.adultNetPrice, product.currency)}
                </span>
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-2">
            <button
              id={`btn-view-details-${product.id}`}
              onClick={() => onViewDetails(product)}
              className="w-full flex items-center justify-center space-x-1 bg-slate-50 hover:bg-slate-100 text-slate-700 py-2.5 px-3 rounded-xl text-xs font-bold transition-colors cursor-pointer border border-slate-200"
            >
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              <span>Details</span>
            </button>

            {/* Buyer vs B2B Agent Action Button */}
            {isB2BAgentOrAdmin ? (
              <button
                id={`btn-calc-${product.id}`}
                onClick={handleCalculatorClick}
                className="w-full flex items-center justify-center space-x-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 shadow-sm shadow-[#00C6A6]/20"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>B2B Quote</span>
              </button>
            ) : (
              <button
                id={`btn-instant-book-${product.id}`}
                onClick={handleInstantBookClick}
                className="w-full flex items-center justify-center space-x-1 py-2.5 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer bg-slate-900 hover:bg-slate-800 text-white shadow-xs"
                title="Instant Book with 24–48h Ground Update SLA Guarantee"
              >
                <Zap className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Instant Book (SLA)</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
