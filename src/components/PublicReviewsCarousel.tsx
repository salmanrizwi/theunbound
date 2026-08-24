import React from 'react';
import { GoogleReview } from '../types';
import { AppDatabase } from '../services/db';
import { Star, ShieldCheck, MessageSquare, Building } from 'lucide-react';

interface PublicReviewsCarouselProps {
  destinationName?: string;
}

export const PublicReviewsCarousel: React.FC<PublicReviewsCarouselProps> = ({ destinationName }) => {
  const db = AppDatabase.getInstance();
  const allVisible = db.getVisibleReviews();

  const reviews = destinationName 
    ? allVisible.filter(r => r.destination.toLowerCase().includes(destinationName.toLowerCase()) || r.destination === 'Global')
    : allVisible;

  if (reviews.length === 0) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#00C6A6] text-xs font-bold uppercase tracking-wider mb-1">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>Verified Ground Testimonials</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 font-serif">
            Client & Partner Endorsements
          </h2>
          <p className="text-xs sm:text-sm text-slate-500 mt-1 max-w-xl">
            Real feedback from luxury travelers, private family groups, and top-tier global B2B travel advisors.
          </p>
        </div>

        {/* Aggregate Badge */}
        <div className="flex items-center space-x-3 bg-white p-3 rounded-2xl border border-slate-200 shadow-sm shrink-0">
          <div className="text-2xl font-bold text-slate-900 font-mono">5.0</div>
          <div>
            <div className="flex items-center text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
              ))}
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Google Business Verified</span>
          </div>
        </div>
      </div>

      {/* Grid of Reviews */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {reviews.map(rev => (
          <div
            key={rev.id}
            className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between space-y-4"
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

              <p className="text-xs sm:text-sm text-slate-700 italic leading-relaxed font-serif">
                "{rev.reviewText}"
              </p>

              {rev.responseFromOwner && (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px] text-slate-600 space-y-1">
                  <div className="font-bold text-slate-800 flex items-center space-x-1">
                    <MessageSquare className="w-3 h-3 text-[#00C6A6]" />
                    <span>Response from TheUnbound Team</span>
                  </div>
                  <p className="italic">"{rev.responseFromOwner.text}"</p>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <img
                  src={rev.authorAvatar}
                  alt={rev.authorName}
                  className="w-9 h-9 rounded-full object-cover border border-slate-200"
                />
                <div>
                  <div className="font-bold text-slate-900 text-xs">{rev.authorName}</div>
                  <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                    <span>{rev.destination}</span>
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
