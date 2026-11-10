import React, { useState, useEffect, useMemo } from 'react';
import { AppDatabase } from '../services/db';
import { GalleryImage } from '../types';
import { Camera, MapPin, Sparkles, Tag, X, ChevronRight, User } from 'lucide-react';

interface PublicHappyCustomerGalleryProps {
  destinationName?: string;
}

export const PublicHappyCustomerGallery: React.FC<PublicHappyCustomerGalleryProps> = ({ destinationName }) => {
  const db = AppDatabase.getInstance();
  const [galleryImages, setGalleryImages] = useState<GalleryImage[]>(() => db.getGalleryImages());
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [activeModalImage, setActiveModalImage] = useState<GalleryImage | null>(null);
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({});

  useEffect(() => {
    return db.subscribe(() => {
      setGalleryImages(db.getGalleryImages());
    });
  }, [db]);

  // Only consider active & published items
  const publishedImages = useMemo(() => {
    return galleryImages.filter(img => img.isActive !== false && img.isPublished !== false);
  }, [galleryImages]);

  // Destination filtering if prop supplied
  const destTarget = (destinationName || '').toLowerCase().trim();
  const destinationFiltered = useMemo(() => {
    if (!destTarget) return publishedImages;
    return publishedImages.filter(img => 
      (img.destination || '').toLowerCase().includes(destTarget) || 
      (img.destination || '').toLowerCase() === 'global'
    );
  }, [publishedImages, destTarget]);

  // Extract all unique tags
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    destinationFiltered.forEach(img => {
      (img.tags || []).forEach(t => {
        const clean = t.trim();
        if (clean) set.add(clean);
      });
    });
    return Array.from(set).sort();
  }, [destinationFiltered]);

  // Tag filtered list
  const displayImages = useMemo(() => {
    if (selectedTag === 'ALL') return destinationFiltered;
    return destinationFiltered.filter(img => 
      (img.tags || []).some(t => t.toLowerCase() === selectedTag.toLowerCase())
    );
  }, [destinationFiltered, selectedTag]);

  // If there are no published images, do not render section on homepage
  if (destinationFiltered.length === 0) {
    return null;
  }

  const handleImageError = (id: string) => {
    setImageErrors(prev => ({ ...prev, [id]: true }));
  };

  return (
    <section id="happy-customer-gallery-section" className="space-y-6">
      {/* Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#008972] text-xs font-bold uppercase tracking-wider mb-1.5">
            <Camera className="w-4 h-4 text-[#008972]" />
            <span>Verified Guest Experiences & Live Expeditions</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Happy Customer Moments Gallery
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            Authentic guest stories, VIP tours, private yachts, cultural masterclasses, and executive family journeys curated by TheUnbound direct ground desks.
          </p>
        </div>

        <div className="flex items-center space-x-2 bg-white px-3.5 py-2 rounded-2xl border border-slate-200 shadow-2xs shrink-0 self-start sm:self-auto">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="text-xs font-bold text-slate-800">
            {destinationFiltered.length} Published Moments
          </span>
        </div>
      </div>

      {/* Tag Filter Pills */}
      {availableTags.length > 0 && (
        <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            type="button"
            onClick={() => setSelectedTag('ALL')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
              selectedTag === 'ALL'
                ? 'bg-[#008972] text-white shadow-xs'
                : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
            }`}
          >
            All Moments ({destinationFiltered.length})
          </button>
          {availableTags.map(tag => {
            const count = destinationFiltered.filter(i => (i.tags || []).includes(tag)).length;
            const isSelected = selectedTag.toLowerCase() === tag.toLowerCase();
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setSelectedTag(tag)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center space-x-1.5 ${
                  isSelected
                    ? 'bg-[#008972] text-white shadow-xs'
                    : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
                }`}
              >
                <span>#{tag}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Responsive Photo Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {displayImages.map((item) => {
          const isErrored = imageErrors[item.id];
          const displayCaption = item.description || item.caption || '';

          return (
            <div
              key={item.id}
              onClick={() => setActiveModalImage(item)}
              className="group relative bg-white rounded-2xl overflow-hidden border border-slate-200 shadow-2xs hover:shadow-xl transition-all duration-300 flex flex-col cursor-pointer"
            >
              {/* Image Container with 4:3 Aspect Ratio */}
              <div className="relative aspect-4/3 overflow-hidden bg-slate-100">
                {isErrored ? (
                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-slate-400 p-4 text-center">
                    <Camera className="w-8 h-8 mb-2 opacity-50" />
                    <span className="text-xs font-semibold">Verified Ground Moment</span>
                  </div>
                ) : (
                  <img
                    src={item.imageUrl}
                    alt={displayCaption || item.customerName || 'Happy Customer Moment'}
                    loading="lazy"
                    onError={() => handleImageError(item.id)}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/20 to-transparent opacity-85 group-hover:opacity-95 transition-opacity" />

                {/* Destination Badge */}
                {item.destination && (
                  <div className="absolute top-3 left-3">
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/95 backdrop-blur-xs text-slate-900 shadow-xs">
                      <MapPin className="w-3 h-3 text-[#008972]" />
                      <span>{item.destination}</span>
                    </span>
                  </div>
                )}

                {/* Customer Name */}
                {item.customerName && (
                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <p className="text-xs font-bold truncate drop-shadow-sm flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-[#00C6A6] shrink-0" />
                      <span>{item.customerName}</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Card Body */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                {item.title && (
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                    {item.title}
                  </h4>
                )}
                {displayCaption && (
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    "{displayCaption}"
                  </p>
                )}

                {/* Tags */}
                {item.tags && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 pt-2 border-t border-slate-100">
                    {item.tags.slice(0, 3).map((tag, idx) => (
                      <span
                        key={idx}
                        className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md"
                      >
                        #{tag}
                      </span>
                    ))}
                    {item.tags.length > 3 && (
                      <span className="text-[10px] text-slate-400 self-center">
                        +{item.tags.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Detail Modal Lightbox */}
      {activeModalImage && (
        <div 
          className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setActiveModalImage(null)}
        >
          <div 
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl border border-slate-200"
            onClick={e => e.stopPropagation()}
          >
            <div className="relative aspect-16/10 bg-slate-900 overflow-hidden">
              <img
                src={activeModalImage.imageUrl}
                alt={activeModalImage.caption || activeModalImage.customerName}
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
              <button
                type="button"
                onClick={() => setActiveModalImage(null)}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-slate-950/60 hover:bg-slate-950/90 text-white flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
              {activeModalImage.destination && (
                <div className="absolute bottom-4 left-4">
                  <span className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-full text-xs font-bold bg-white/95 text-slate-900 shadow-md">
                    <MapPin className="w-3.5 h-3.5 text-[#008972]" />
                    <span>{activeModalImage.destination}</span>
                  </span>
                </div>
              )}
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                {activeModalImage.customerName && (
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-teal-50 border border-teal-200 flex items-center justify-center text-[#008972] font-bold">
                      <User className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">{activeModalImage.customerName}</h3>
                      <p className="text-[11px] text-slate-400">Verified TheUnbound Experience</p>
                    </div>
                  </div>
                )}
                {activeModalImage.createdAt && (
                  <span className="text-xs text-slate-400">
                    {activeModalImage.createdAt}
                  </span>
                )}
              </div>

              {activeModalImage.title && (
                <h4 className="text-base font-bold text-slate-900">
                  {activeModalImage.title}
                </h4>
              )}

              {(activeModalImage.description || activeModalImage.caption) && (
                <p className="text-sm text-slate-700 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                  "{activeModalImage.description || activeModalImage.caption}"
                </p>
              )}

              {activeModalImage.tags && activeModalImage.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-2">
                  {activeModalImage.tags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="text-xs font-semibold bg-teal-50 text-[#008972] border border-teal-200 px-2.5 py-1 rounded-lg"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
