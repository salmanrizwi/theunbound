import React from 'react';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { formatCurrency } from '../services/pricingEngine';
import { Product } from '../types';
import { 
  User, 
  Bookmark, 
  FileText, 
  Clock, 
  MapPin, 
  Trash2, 
  ExternalLink, 
  ArrowRight, 
  Building2, 
  Sparkles, 
  Compass,
  CheckCircle2
} from 'lucide-react';

interface UserDashboardProps {
  onExploreProducts: () => void;
  onSelectDestination: (dest: string) => void;
  onViewProduct: (product: Product) => void;
  products: Product[];
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  onExploreProducts,
  onSelectDestination,
  onViewProduct,
  products
}) => {
  const { user } = useAuth();
  const { savedQuotes, loadSavedQuote, deleteSavedQuote, currency } = useQuotation();

  const featuredProducts = products.slice(0, 4);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* Welcome Banner */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-4">
            <img
              src={user?.avatarUrl || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?q=80&w=200&auto=format&fit=crop'}
              alt={user?.name}
              className="w-16 h-16 rounded-2xl object-cover ring-2 ring-[#00C6A6]"
            />
            <div>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30 mb-1">
                <span>Verified {user?.role || 'Agent'} Account</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold font-sans">
                Welcome back, {user?.name || 'Travel Designer'}
              </h1>
              <p className="text-xs text-slate-300 flex items-center space-x-2 mt-0.5">
                <Building2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>{user?.agencyName || 'Luxury Discovery Travel Partners'}</span>
                <span>•</span>
                <span>{user?.email}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={onExploreProducts}
              className="bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-bold px-5 py-2.5 rounded-xl text-xs transition-all shadow-md shadow-[#00C6A6]/20 flex items-center space-x-1.5 cursor-pointer"
            >
              <Compass className="w-4 h-4" />
              <span>Browse DMC Catalog</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Grid: Saved Quotes + Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Saved Quotes Management */}
        <div className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900 flex items-center space-x-2">
              <Bookmark className="w-4 h-4 text-[#008972]" />
              <span>Saved Client Quotations ({savedQuotes.length})</span>
            </h2>
          </div>

          {savedQuotes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-8 text-center">
              <FileText className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-sm font-bold text-slate-700">No saved quotations yet</p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
                Use the pricing calculator on any product to select items, calculate tiered markups, and save quotations.
              </p>
              <button
                onClick={onExploreProducts}
                className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Start New Itinerary Quote
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {savedQuotes.map((quote) => (
                <div
                  key={quote.id}
                  className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] font-mono font-bold bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                        {quote.quoteNumber}
                      </span>
                      <span className="text-xs font-bold text-slate-900">{quote.clientName}</span>
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                        {quote.items.length} Products
                      </span>
                    </div>

                    <p className="text-xs text-slate-500">
                      Destination: <span className="font-medium text-slate-700">{quote.destination}</span> • Created: {new Date(quote.createdAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end space-x-4 shrink-0">
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Total Quotation:</span>
                      <span className="text-sm font-black text-slate-900 font-mono">
                        {formatCurrency(quote.totalSellingPrice, quote.currency)}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <button
                        onClick={() => loadSavedQuote(quote)}
                        className="bg-[#00C6A6]/10 hover:bg-[#00C6A6]/20 text-[#008972] font-bold px-3 py-1.5 rounded-lg text-xs transition-colors flex items-center space-x-1 cursor-pointer"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Open</span>
                      </button>

                      <button
                        onClick={() => deleteSavedQuote(quote.id)}
                        className="text-slate-400 hover:text-red-500 p-1.5 rounded-lg transition-colors cursor-pointer"
                        title="Delete Quote"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Destination & Hub Shortcuts */}
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Contracted Destinations
            </h3>

            <div className="space-y-2">
              <button
                onClick={() => onSelectDestination('japan')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors text-left cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Japan DMC Portfolio</p>
                  <p className="text-[10px] text-slate-500">Tokyo, Kyoto, Osaka, Mt. Fuji</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onSelectDestination('united-kingdom')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors text-left cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">United Kingdom DMC</p>
                  <p className="text-[10px] text-slate-500">London, Cotswolds, Edinburgh</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>

              <button
                onClick={() => onSelectDestination('europe')}
                className="w-full p-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 flex items-center justify-between transition-colors text-left cursor-pointer"
              >
                <div>
                  <p className="text-xs font-bold text-slate-900">Continental Europe DMC</p>
                  <p className="text-[10px] text-slate-500">Paris, Rome, Swiss Alps, Spain</p>
                </div>
                <ArrowRight className="w-4 h-4 text-slate-400" />
              </button>
            </div>
          </div>

          {/* Quick Recommended Products */}
          <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3 shadow-xs">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#00C6A6]" />
              <span>DMC Popular Picks</span>
            </h3>

            <div className="space-y-2.5">
              {featuredProducts.map((p) => (
                <div
                  key={p.id}
                  onClick={() => onViewProduct(p)}
                  className="flex items-center space-x-3 p-2 rounded-xl hover:bg-slate-50 cursor-pointer transition-colors"
                >
                  <img
                    src={p.images[0]}
                    alt={p.name}
                    className="w-12 h-12 rounded-lg object-cover shrink-0"
                  />
                  <div className="overflow-hidden">
                    <p className="text-xs font-bold text-slate-900 truncate">{p.name}</p>
                    <p className="text-[10px] text-slate-500">{p.city} • {p.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
