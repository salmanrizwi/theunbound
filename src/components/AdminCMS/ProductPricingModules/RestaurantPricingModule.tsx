import React from 'react';
import { CurrencyCode, RestaurantConfig } from '../../../types';
import { formatCurrency } from '../../../services/pricingEngine';
import { Utensils, MapPin, Coffee, Sun, Moon } from 'lucide-react';

interface RestaurantPricingModuleProps {
  currency: CurrencyCode;
  restaurantConfig?: RestaurantConfig;
  adultNetPrice: number;
  childNetPrice: number;
  buyerMarkupPercent: number;
  b2bAgentMarkupPercent: number;
  taxPercent: number;
  serviceFeeFixed: number;
  onChange: (updatedConfig: RestaurantConfig) => void;
  onPriceChange: (adultNet: number, childNet: number) => void;
  onCurrencyChange: (currency: CurrencyCode) => void;
}

const DIETARY_OPTIONS = [
  'Vegetarian',
  'Halal-friendly (No Pork/Alcohol)',
  'Gluten-Free',
  'No Seafood',
  'Vegan',
  'Nut Allergy Safe',
  'Egg Allergy Safe',
  'Dairy Free'
];

export const RestaurantPricingModule: React.FC<RestaurantPricingModuleProps> = ({
  currency,
  restaurantConfig,
  adultNetPrice,
  childNetPrice,
  buyerMarkupPercent,
  b2bAgentMarkupPercent,
  taxPercent,
  serviceFeeFixed,
  onChange,
  onPriceChange,
  onCurrencyChange
}) => {
  const currentConfig: RestaurantConfig = {
    restaurantName: restaurantConfig?.restaurantName || '',
    specialty: restaurantConfig?.specialty || 'Authentic Regional Japanese Cuisine & Seasonal Kaiseki',
    mealSelect: restaurantConfig?.mealSelect && restaurantConfig.mealSelect.length > 0 ? restaurantConfig.mealSelect : ['Lunch', 'Dinner'],
    mealType: restaurantConfig?.mealType || 'KAISEKI_DINNER',
    seatingType: restaurantConfig?.seatingType || 'PRIVATE_ROOM_TATAMI',
    beveragePackage: restaurantConfig?.beveragePackage || 'STANDARD_TEA_WATER',
    dietaryAccommodations: restaurantConfig?.dietaryAccommodations || ['Vegetarian', 'Halal-friendly (No Pork/Alcohol)'],
    dressCode: restaurantConfig?.dressCode || 'Smart Casual'
  };

  const updateConfig = (patch: Partial<RestaurantConfig>) => {
    onChange({ ...currentConfig, ...patch });
  };

  const toggleMeal = (meal: 'Breakfast' | 'Lunch' | 'Dinner') => {
    const active = currentConfig.mealSelect || [];
    const next = active.includes(meal)
      ? active.filter(m => m !== meal)
      : [...active, meal];
    updateConfig({ mealSelect: next.length > 0 ? next : [meal] });
  };

  const calculateDelivered = (net: number, markup: number) => {
    const markupAmt = net * (markup / 100);
    const taxAmt = markupAmt * (taxPercent / 100);
    return Math.round(net + markupAmt + taxAmt + serviceFeeFixed);
  };

  return (
    <div className="space-y-4">
      {/* Restaurant Core Specifications */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-rose-500/30 space-y-4">
        <div className="flex items-center justify-between text-xs font-bold text-rose-300">
          <span className="flex items-center gap-1.5">
            <Utensils className="w-4 h-4" />
            <span>Restaurant Master Information & Specialty</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-800">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Restaurant Name *</label>
            <input
              type="text"
              required
              value={currentConfig.restaurantName || ''}
              onChange={e => updateConfig({ restaurantName: e.target.value })}
              placeholder="e.g. Ginza Kyubey Omakase / Gion Sasaki"
              className="w-full p-2 bg-white rounded-lg font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Cuisine Specialty / Highlight *</label>
            <input
              type="text"
              required
              value={currentConfig.specialty || ''}
              onChange={e => updateConfig({ specialty: e.target.value })}
              placeholder="e.g. Traditional Edo-mae Nigiri Sushi & Seasonal Sashimi"
              className="w-full p-2 bg-white rounded-lg font-medium"
            />
          </div>
        </div>

        {/* Meal Selection (Breakfast, Lunch, Dinner) */}
        <div className="space-y-1.5 pt-1 border-t border-slate-700/80">
          <label className="text-[11px] text-slate-300 font-medium">
            Meal Service Availability (Select applicable meal types) *
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(['Breakfast', 'Lunch', 'Dinner'] as const).map(meal => {
              const isSelected = (currentConfig.mealSelect || []).includes(meal);
              return (
                <button
                  key={meal}
                  type="button"
                  onClick={() => toggleMeal(meal)}
                  className={`p-2 rounded-xl flex items-center justify-center space-x-2 text-xs font-bold cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-rose-500 text-white border-rose-400 shadow-md scale-[1.01]'
                      : 'bg-slate-900 text-slate-300 border-slate-700 hover:bg-slate-800'
                  }`}
                >
                  {meal === 'Breakfast' && <Coffee className="w-3.5 h-3.5" />}
                  {meal === 'Lunch' && <Sun className="w-3.5 h-3.5" />}
                  {meal === 'Dinner' && <Moon className="w-3.5 h-3.5" />}
                  <span>{meal}</span>
                  {isSelected && <span className="text-[10px] ml-1">✓</span>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dining Format, Seating, Beverage */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-slate-800 pt-2 border-t border-slate-700/80">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Meal / Course Format</label>
            <select
              value={currentConfig.mealType || 'KAISEKI_DINNER'}
              onChange={e => updateConfig({ mealType: e.target.value as any })}
              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
            >
              <option value="KAISEKI_DINNER">Multi-Course Kaiseki Dinner</option>
              <option value="OMAKASE">Chef's Omakase Sushi</option>
              <option value="SET_LUNCH">Traditional Japanese Set Lunch</option>
              <option value="MULTI_COURSE">Western Fine Dining Course</option>
              <option value="BUFFET">Luxury Gourmet Buffet</option>
              <option value="AFTERNOON_TEA">Traditional Tea Ceremony & Sweets</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Seating Environment</label>
            <select
              value={currentConfig.seatingType || 'PRIVATE_ROOM_TATAMI'}
              onChange={e => updateConfig({ seatingType: e.target.value as any })}
              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
            >
              <option value="PRIVATE_ROOM_TATAMI">Private Room (Traditional Tatami)</option>
              <option value="PRIVATE_ROOM_TABLE">Private Room (Modern Table & Chairs)</option>
              <option value="CHEF_COUNTER">Chef's Counter Seating</option>
              <option value="MAIN_DINING">Main Dining Hall</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Beverage Package</label>
            <select
              value={currentConfig.beveragePackage || 'STANDARD_TEA_WATER'}
              onChange={e => updateConfig({ beveragePackage: e.target.value as any })}
              className="w-full p-2 bg-white rounded-lg font-medium text-xs"
            >
              <option value="STANDARD_TEA_WATER">Standard Green Tea & Mineral Water</option>
              <option value="NOMIHOUDAI_ALL_YOU_CAN_DRINK">All-You-Can-Drink (Nomihoudai 2h)</option>
              <option value="SAKE_PAIRING">Sommelier Curated Sake Pairing</option>
              <option value="SOMMELIER_WINE_PAIRING">Premium Wine Pairing</option>
              <option value="NON_ALCOHOLIC_PAIRING">Artisanal Non-Alcoholic Pairing</option>
            </select>
          </div>
        </div>

        {/* Dietary Accommodations */}
        <div className="space-y-1 pt-1">
          <label className="text-[11px] text-slate-300 font-medium">Supported Dietary Accommodations</label>
          <div className="flex flex-wrap gap-1.5">
            {DIETARY_OPTIONS.map(diet => {
              const active = currentConfig.dietaryAccommodations || [];
              const isSelected = active.includes(diet);
              return (
                <button
                  key={diet}
                  type="button"
                  onClick={() => {
                    const next = isSelected ? active.filter(d => d !== diet) : [...active, diet];
                    updateConfig({ dietaryAccommodations: next });
                  }}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-rose-400 text-slate-950 shadow-xs'
                      : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                  }`}
                >
                  {isSelected ? '✓ ' : '+ '}{diet}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Per-Person Meal Rate Inputs */}
      <div className="bg-slate-800/80 p-4 rounded-xl border border-rose-500/30 space-y-3">
        <div className="flex items-center justify-between text-xs font-bold text-rose-300">
          <span>Meal Tariff & Markups</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-800">
          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Base Currency</label>
            <select
              value={currency}
              onChange={e => onCurrencyChange(e.target.value as CurrencyCode)}
              className="w-full p-2 bg-white rounded-lg font-bold"
            >
              <option value="USD">USD ($)</option>
              <option value="EUR">EUR (€)</option>
              <option value="GBP">GBP (£)</option>
              <option value="JPY">JPY (¥)</option>
              <option value="INR">INR (₹)</option>
              <option value="AED">AED (AED)</option>
              <option value="THB">THB (฿)</option>
              <option value="AUD">AUD (A$)</option>
              <option value="CAD">CAD (CA$)</option>
              <option value="SGD">SGD (S$)</option>
              <option value="CHF">CHF (CHF)</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Adult Meal Nett Cost *</label>
            <input
              type="number"
              min="0"
              required
              value={adultNetPrice}
              onChange={e => onPriceChange(Number(e.target.value), childNetPrice)}
              className="w-full p-2 bg-white rounded-lg font-bold"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] text-slate-300 font-medium">Child Meal Nett Cost</label>
            <input
              type="number"
              min="0"
              value={childNetPrice}
              onChange={e => onPriceChange(adultNetPrice, Number(e.target.value))}
              className="w-full p-2 bg-white rounded-lg"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
