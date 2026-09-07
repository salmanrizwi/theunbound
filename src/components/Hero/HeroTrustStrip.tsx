import React from 'react';
import { HeroTrustItem } from '../../types';
import { ShieldCheck, Clock, Building2, Globe2, CheckCircle2, Award, Zap, Users } from 'lucide-react';

interface HeroTrustStripProps {
  items?: HeroTrustItem[];
  className?: string;
}

const ICON_MAP: Record<string, React.FC<{ className?: string }>> = {
  ShieldCheck,
  Clock,
  Building2,
  Globe2,
  CheckCircle2,
  Award,
  Zap,
  Users
};

export const HeroTrustStrip: React.FC<HeroTrustStripProps> = ({
  items = [],
  className = ''
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className={`w-full bg-slate-900/90 backdrop-blur-md border-t border-white/10 px-4 sm:px-6 py-3 sm:py-4 ${className}`}>
      <div className="max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {items.map((item, idx) => {
          const IconComponent = (item.icon && ICON_MAP[item.icon]) ? ICON_MAP[item.icon] : ShieldCheck;

          return (
            <div 
              key={item.id || `trust-item-${idx}`}
              className="flex items-start space-x-3 p-2 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-colors"
            >
              <div className="p-2 rounded-lg bg-[#00C6A6]/10 text-[#00C6A6] shrink-0 border border-[#00C6A6]/20">
                <IconComponent className="w-4 h-4 text-[#00C6A6]" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-white uppercase tracking-wider truncate">
                  {item.title}
                </h4>
                <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2 leading-relaxed">
                  {item.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
