import React from 'react';
import { ProductCategory } from '../types';
import { 
  Compass, 
  Car, 
  Route, 
  Train, 
  Ship, 
  Crown, 
  Sun, 
  UserCheck, 
  Bus, 
  Briefcase,
  Anchor,
  Sparkles
} from 'lucide-react';

interface CategoryFilterProps {
  categories?: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  categoryCounts?: Record<string, number>;
  totalCount?: number;
}

export const CATEGORIES: { name: ProductCategory; icon: React.ElementType }[] = [
  { name: 'Private Tours', icon: Crown },
  { name: 'Day Trips', icon: Sun },
  { name: 'Activities', icon: Compass },
  { name: 'Transfers', icon: Car },
  { name: 'Transport', icon: Bus },
  { name: 'Private Yacht', icon: Ship },
  { name: 'Tours', icon: Route },
  { name: 'Rail', icon: Train },
  { name: 'Ferries', icon: Anchor },
  { name: 'Guides', icon: UserCheck },
  { name: 'Travel Services', icon: Briefcase },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory,
  categoryCounts,
  totalCount
}) => {
  const displayCategories = categories && categories.length > 0
    ? CATEGORIES.filter(c => categories.includes(c.name))
    : CATEGORIES;

  return (
    <div className="mb-6">
      <div className="flex items-center space-x-2 overflow-x-auto pb-2 scrollbar-none no-scrollbar">
        <button
          id="cat-btn-all"
          onClick={() => onSelectCategory('')}
          className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
            selectedCategory === ''
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Sparkles className={`w-3.5 h-3.5 ${selectedCategory === '' ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
          <span>All Categories</span>
          {typeof totalCount === 'number' && (
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-1 ${
              selectedCategory === '' ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
            }`}>
              {totalCount}
            </span>
          )}
        </button>

        {displayCategories.map(({ name, icon: Icon }) => {
          const isActive = selectedCategory === name;
          const count = categoryCounts ? categoryCounts[name] : undefined;
          return (
            <button
              key={name}
              id={`cat-btn-${name.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => onSelectCategory(isActive ? '' : name)}
              className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#00C6A6] text-white shadow-xs font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
              <span>{name}</span>
              {typeof count === 'number' && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ml-0.5 ${
                  isActive ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
