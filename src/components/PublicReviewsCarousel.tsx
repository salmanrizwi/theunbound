import React from 'react';
import { AppDatabase } from '../services/db';
import { googleBusinessService } from '../services/googleBusinessService';
import { Star, ShieldCheck, MessageSquare, ExternalLink } from 'lucide-react';

interface PublicReviewsCarouselProps {
  destinationName?: string;
}

export const PublicReviewsCarousel: React.FC<PublicReviewsCarouselProps> = ({ destinationName }) => {
  const db = AppDatabase.getInstance();
  const config = googleBusinessService.getConfig();
  
  if (config.displaySettings?.showOnHomepage === false) {
    return null;
  }

  const allVisible = db.getVisibleReviews();
  const minRating = config.displaySettings?.minRating || 1;
  const maxCount = config.displaySettings?.maxDisplayCount || 12;

  let reviews = allVisible.filter(r => r.rating >= minRating);

  if (destinationName) {
    reviews = reviews.filter(r => {
      const dest = (r.destination || 'Global').toLowerCase();
      return dest.includes(destinationName.toLowerCase()) || dest === 'global';
    });
  }

  // Sort according to display settings
  if (config.displaySettings?.sortBy === 'LATEST') {
    reviews.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  } else if (config.displaySettings?.sortBy === 'HIGHEST_RATED') {
    reviews.sort((a, b) => b.rating - a.rating);
  } else {
    // Featured first
    reviews.sort((a, b) => {
      if (a.isFeatured === b.isFeatured) {
        return (a.displayOrder || 0) - (b.displayOrder || 0);
      }
      return a.isFeatured ? -1 : 1;
    });
  }

  reviews = reviews.slice(0, maxCount);

  // ABSOLUTE RULE: If no real reviews exist, do not render or fabricate mock reviews
  if (reviews.length === 0) {
    return null;
  }

  const avgRating = (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1);
  const mapsLink = config.mapsUrl || 'https://maps.app.goo.gl/oXYBiMGguZvkbqfw5';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>Google Business Profile Testimonials</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-serif">
            Client & Partner Endorsements
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Verified feedback from luxury travelers, private family groups, and top-tier global B2B travel advisors.
          </p>
        </div>

        {/* Aggregate Badge with Real Google Maps Listing Link */}
        <a
          href={mapsLink}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center space-x-3 bg-white hover:bg-slate-50 p-3.5 rounded-2xl border border-slate-200 shadow-xs transition-colors group shrink-0"
          title="View TheUnbound on Google Maps"
        >
          <div className="text-2xl font-bold text-slate-900 font-mono">{avgRating}</div>
          <div>
            <div className="flex items-center text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`w-3.5 h-3.5 ${
                    i < Math.round(Number(avgRating)) ? 'fill-amber-400 text-amber-400' : 'text-slate-200'
                  }`}
                />
              ))}
            </div>
            <div className="text-[10px] text-slate-500 font-medium flex items-center space-x-1 mt-0.5">
              <span>Google Business Verified</span>
              <ExternalLink className="w-3 h-3 text-slate-400 group-hover:text-[#008972] transition-colors" />
            </div>
          </div>
        </a>
      </div>

      {/* Grid of Real Google Reviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reviews.map(rev => (
          <div
            key={rev.id}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-4"
          >
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`w-4 h-4 ${i < rev.rating ? 'fill-amber-400 text-amber-400' : 'text-slate-200'}`}
                    />
                  ))}
                </div>
                <span className="text-[11px] text-slate-400 font-medium">{rev.relativeTimeDescription || rev.date}</span>
              </div>

              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-serif">
                &ldquo;{rev.reviewText}&rdquo;
              </p>

              {rev.responseFromOwner && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center space-x-1">
                    <MessageSquare className="w-3 h-3 text-[#00C6A6]" />
                    <span>Response from TheUnbound Team</span>
                  </div>
                  <p className="italic">&ldquo;{rev.responseFromOwner.text}&rdquo;</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {rev.authorAvatar ? (
                  <img
                    src={rev.authorAvatar}
                    alt={rev.authorName}
                    className="w-9 h-9 rounded-full object-cover border border-slate-200"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-xs border border-slate-200">
                    {rev.authorName.charAt(0)}
                  </div>
                )}
                <div>
                  <div className="font-bold text-slate-900 text-xs">{rev.authorName}</div>
                  <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <span>{rev.locationName || rev.destination || 'Google Business'}</span>
                    {rev.verifiedPartner && <ShieldCheck className="w-3 h-3 text-[#00C6A6]" />}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
