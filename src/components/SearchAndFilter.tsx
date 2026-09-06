import React from 'react';
import { ProductFilterState } from '../types';
import { Search, Filter, X, ArrowUpDown, DollarSign, MapPin, Sparkles } from 'lucide-react';

interface SearchAndFilterProps {
  filters: ProductFilterState;
  onFilterChange: (filters: ProductFilterState) => void;
  availableCities: string[];
  totalResults: number;
}

export const SearchAndFilter: React.FC<SearchAndFilterProps> = ({
  filters,
  onFilterChange,
  availableCities,
  totalResults
}) => {
  const handleReset = () => {
    onFilterChange({
      searchQuery: '',
      destination: '',
      city: '',
      category: '',
      productType: '',
      minPrice: 0,
      maxPrice: 2000,
      duration: '',
      availability: '',
      sortBy: 'popular'
    });
  };

  const uniqueCities = React.useMemo(() => {
    return Array.from(new Set((availableCities || []).filter(Boolean)));
  }, [availableCities]);

  const hasActiveFilters = 
    filters.searchQuery || 
    filters.city || 
    filters.category || 
    filters.availability || 
    filters.maxPrice < 2000;

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-3 sm:p-5 shadow-xs mb-4 sm:mb-6 space-y-3 sm:space-y-4">
      {/* Search Row */}
      <div className="flex flex-col sm:flex-row items-center gap-2.5 sm:gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 sm:top-3" />
          <input
            type="text"
            placeholder="Search tours, cities, SKUs, or experiences..."
            value={filters.searchQuery}
            onChange={(e) => onFilterChange({ ...filters, searchQuery: e.target.value })}
            className="w-full bg-slate-50 border border-slate-200 rounded-lg pl-9 sm:pl-10 pr-4 py-2 text-xs sm:text-sm font-medium text-slate-900 focus:ring-1 focus:ring-[#00C6A6] focus:bg-white transition-all outline-none"
          />
          {filters.searchQuery && (
            <button
              onClick={() => onFilterChange({ ...filters, searchQuery: '' })}
              className="absolute right-3 top-2 sm:top-2.5 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Quick Sort Selector */}
        <div className="flex items-center space-x-2 w-full sm:w-auto justify-between shrink-0">
          <div className="flex items-center space-x-1.5 text-xs text-slate-500 font-medium shrink-0">
            <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
            <span>Sort:</span>
          </div>
          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ ...filters, sortBy: e.target.value as any })}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-slate-700 focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="newest">Recently Updated</option>
          </select>
        </div>
      </div>

      {/* Secondary Filter Dropdowns & Pills */}
      <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-3 pt-2.5 sm:pt-3 border-t border-slate-100 text-xs">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
          {/* City Selector */}
          <select
            value={filters.city}
            onChange={(e) => onFilterChange({ ...filters, city: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-medium text-slate-700 focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
          >
            <option value="">All Hubs ({uniqueCities.length})</option>
            {uniqueCities.map((city, idx) => (
              <option key={`city-opt-${city}-${idx}`} value={city}>{city}</option>
            ))}
          </select>

          {/* Availability */}
          <select
            value={filters.availability}
            onChange={(e) => onFilterChange({ ...filters, availability: e.target.value })}
            className="bg-slate-50 border border-slate-200 rounded-md px-2 sm:px-2.5 py-1 sm:py-1.5 text-xs font-medium text-slate-700 focus:ring-1 focus:ring-[#00C6A6] cursor-pointer"
          >
            <option value="">All Availability</option>
            <option value="INSTANT">Instant Confirmation</option>
            <option value="ON_REQUEST">On Request (24h)</option>
            <option value="LIMITED">Limited Allotment</option>
          </select>
        </div>

        <div className="flex items-center justify-between sm:justify-end w-full sm:w-auto space-x-2 sm:space-x-3 pt-1 sm:pt-0">
          <span className="text-[11px] sm:text-xs text-slate-500 font-medium">
            <span className="font-bold text-slate-800">{totalResults}</span> products available
          </span>

          {hasActiveFilters && (
            <button
              onClick={handleReset}
              className="text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
