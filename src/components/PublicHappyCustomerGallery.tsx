import React from 'react';
import { AppDatabase } from '../services/db';
import { Camera, MapPin, Sparkles, Heart } from 'lucide-react';

interface PublicHappyCustomerGalleryProps {
  destinationName?: string;
}

export const PublicHappyCustomerGallery: React.FC<PublicHappyCustomerGalleryProps> = ({ destinationName }) => {
  const db = AppDatabase.getInstance();
  const galleryImages = db.getGalleryImages().filter(img => img.isPublished);

  const destTarget = (destinationName || '').toLowerCase();
  const filtered = destTarget
    ? galleryImages.filter(img => (img.destination || '').toLowerCase().includes(destTarget) || img.destination === 'Global')
    : galleryImages;

  if (filtered.length === 0) return null;

  return (
    <section id="happy-customer-gallery-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <Camera className="w-4 h-4 text-[#00C6A6]" />
            <span>VIP Moments & Live Expeditions</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-serif">
            Happy Customer Moments Gallery
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl">
            Real guest memories, private yacht charters, cultural masterclasses, and luxury family group journeys arranged by TheUnbound ground teams.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-xs shrink-0">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-slate-800">
            {filtered.length} Live Photo Stories
          </span>
        </div>
      </div>

      {/* Responsive Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {filtered.map((item) => (
          <div
            key={item.id}
            className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-xs hover:shadow-lg transition-all duration-300 flex flex-col"
          >
            <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
              <img
                src={item.imageUrl}
                alt={item.caption}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/70 via-transparent to-black/10 opacity-80 group-hover:opacity-90 transition-opacity" />

              <div className="absolute top-3 left-3">
                <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 backdrop-blur-xs text-slate-900 shadow-xs">
                  <MapPin className="w-3 h-3 text-[#008972]" />
                  <span>{item.destination}</span>
                </span>
              </div>

              {item.customerName && (
                <div className="absolute bottom-3 left-3 right-3 text-white">
                  <p className="text-xs font-bold truncate drop-shadow-sm">
                    {item.customerName}
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
              <p className="text-xs text-slate-700 font-medium leading-relaxed">
                "{item.caption}"
              </p>

              {item.tags && (item.tags || []).length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                  {(item.tags || []).map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
