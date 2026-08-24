import React from 'react';
import { DestinationCity } from '../types';
import { MapPin, ArrowRight } from 'lucide-react';

interface CityHubsProps {
  cities: DestinationCity[];
  selectedCity: string;
  onSelectCity: (cityId: string) => void;
}

export const CityHubs: React.FC<CityHubsProps> = ({
  cities,
  selectedCity,
  onSelectCity
}) => {
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-3.5">
        <div>
          <h2 className="text-lg font-bold text-slate-800 tracking-tight flex items-center space-x-2">
            <MapPin className="w-4 h-4 text-[#00C6A6]" />
            <span>Destination Hubs & Regions</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Filter DMC contracted products, local guides, and luxury transfers by hub
          </p>
        </div>

        {selectedCity && (
          <button
            onClick={() => onSelectCity('')}
            className="text-xs text-[#00C6A6] font-semibold hover:underline cursor-pointer"
          >
            Show All Cities ({cities.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cities.map((city) => {
          const isSelected = selectedCity.toLowerCase() === city.name.toLowerCase() || selectedCity === city.id;
          return (
            <div
              key={city.id}
              id={`city-card-${city.id}`}
              onClick={() => onSelectCity(isSelected ? '' : city.name)}
              className={`group relative rounded-xl overflow-hidden cursor-pointer transition-all duration-200 border ${
                isSelected
                  ? 'ring-2 ring-[#00C6A6] border-transparent shadow-xs scale-102'
                  : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
              }`}
            >
              <div className="aspect-4/3 w-full relative overflow-hidden bg-slate-100">
                <img
                  src={city.image}
                  alt={city.name}
                  className="w-full h-full object-cover group-hover:scale-108 transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                
                <div className="absolute bottom-2 left-2.5 right-2.5 text-white">
                  <p className="text-sm font-bold leading-tight">{city.name}</p>
                  <p className="text-[10px] text-slate-300 font-medium">{city.productCount} Products</p>
                </div>
              </div>

              {isSelected && (
                <div className="bg-[#00C6A6] py-0.5 px-2 text-center text-[10px] font-bold text-white uppercase tracking-wider">
                  Active Hub
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
