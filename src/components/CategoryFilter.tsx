import React from 'react';
import { ProductCategory } from '../types';
import { 
  Building2, 
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
  Sparkles
} from 'lucide-react';

interface CategoryFilterProps {
  categories?: string[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
}

export const CATEGORIES: { name: ProductCategory; icon: React.ElementType }[] = [
  { name: 'Private Tours', icon: Crown },
  { name: 'Day Trips', icon: Sun },
  { name: 'Activities', icon: Compass },
  { name: 'Transfers', icon: Car },
  { name: 'Hotels', icon: Building2 },
  { name: 'Rail', icon: Train },
  { name: 'Tours', icon: Route },
  { name: 'Cruises', icon: Ship },
  { name: 'Guides', icon: UserCheck },
  { name: 'Transport', icon: Bus },
  { name: 'Travel Services', icon: Briefcase },
];

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  selectedCategory,
  onSelectCategory
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
        </button>

        {displayCategories.map(({ name, icon: Icon }) => {
          const isActive = selectedCategory === name;
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
            </button>
          );
        })}
      </div>
    </div>
  );
};
