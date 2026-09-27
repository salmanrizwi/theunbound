import React from 'react';
import { ProductCategory } from '../types';
import { 
  Crown, 
  Users, 
  Car, 
  Ticket, 
  Ship, 
  Anchor, 
  UserCheck, 
  Building2, 
  ShieldCheck, 
  Train, 
  Utensils,
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
  { name: 'Group Tours', icon: Users },
  { name: 'Transfers', icon: Car },
  { name: 'Tickets', icon: Ticket },
  { name: 'Private Yacht', icon: Ship },
  { name: 'Ferries', icon: Anchor },
  { name: 'Guides', icon: UserCheck },
  { name: 'Hotels', icon: Building2 },
  { name: 'Visa & Ancillary Services', icon: ShieldCheck },
  { name: 'Rail / Shinkansen', icon: Train },
  { name: 'Lunch / Dinner Restaurant', icon: Utensils },
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
    <div className="mb-4 sm:mb-6">
      <div className="flex items-center space-x-1.5 sm:space-x-2 overflow-x-auto pb-1.5 sm:pb-2 scrollbar-none no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0">
        <button
          id="cat-btn-all"
          onClick={() => onSelectCategory('')}
          className={`flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 shrink-0 ${
            selectedCategory === ''
              ? 'bg-slate-900 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
          }`}
        >
          <Sparkles className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${selectedCategory === '' ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
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
              className={`flex items-center space-x-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-95 shrink-0 ${
                isActive
                  ? 'bg-[#00C6A6] text-white shadow-xs font-bold'
                  : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300 hover:bg-slate-50'
              }`}
            >
              <Icon className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
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
