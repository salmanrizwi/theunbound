import React from 'react';
import { 
  ShieldCheck, 
  Clock, 
  Building2, 
  FileText, 
  Globe2, 
  Headphones, 
  Sparkles, 
  CheckCircle2, 
  ArrowRight 
} from 'lucide-react';
import { SectionHeader } from './SectionHeader';
import { navigateTo } from '../services/portalRouter';

export interface WhyTheUnboundPillar {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  badge?: string;
  iconType: 'SHIELD' | 'CLOCK' | 'INVENTORY' | 'QUOTATION' | 'GLOBAL' | 'SUPPORT';
}

interface WhyTheUnboundProps {
  heading?: string;
  subheading?: string;
  eyebrow?: string;
  pillars?: WhyTheUnboundPillar[];
  showCta?: boolean;
  onExploreProducts?: () => void;
  className?: string;
}

const DEFAULT_PILLARS: WhyTheUnboundPillar[] = [
  {
    id: 'pillar-licensing',
    title: 'Direct DMC Ground Licensing',
    subtitle: 'Zero Intermediaries • Verified Quality',
    description: 'Directly contracted operations desks in Tokyo, London, and Paris with owned vehicle allocations, vetted luxury ryokans, and accredited local guides.',
    badge: 'Direct Ground Contracts',
    iconType: 'SHIELD'
  },
  {
    id: 'pillar-sla',
    title: '24–48h Operational SLA',
    subtitle: 'Guaranteed Turnaround • High Velocity',
    description: 'Fast confirmation turnaround on complex multi-city FIT proposals and group bookings with dedicated trade reservation managers.',
    badge: 'Guaranteed Turnaround',
    iconType: 'CLOCK'
  },
  {
    id: 'pillar-curated',
    title: 'Wholesale Curated Tariffs',
    subtitle: 'Confidential B2B Net Rates',
    description: 'Contracted wholesale prices across 5-star hotels, bespoke experiential charters, Michelin dining reservations, and private airport VIP tarmac transfers.',
    badge: 'Confidential Tariffs',
    iconType: 'INVENTORY'
  },
  {
    id: 'pillar-support',
    title: '24x7 In-Destination Care',
    subtitle: 'Multilingual Ground Dispatch Desk',
    description: 'Round-the-clock emergency support for travelers on tour, ensuring instant flight re-routing, vehicle swaps, and concierge emergency assistance.',
    badge: '24/7 Operations Desk',
    iconType: 'SUPPORT'
  }
];

export const WhyTheUnbound: React.FC<WhyTheUnboundProps> = ({
  heading = 'Why Global Travel Partners Choose TheUnbound',
  subheading = 'We combine direct contracted ground operations, high-velocity travel technology, and authentic destination expertise for modern travel agencies and designers.',
  eyebrow = 'TheUnbound Operational Edge',
  pillars = DEFAULT_PILLARS,
  showCta = true,
  onExploreProducts,
  className = ''
}) => {
  const getPillarIcon = (type: string) => {
    switch (type) {
      case 'SHIELD':
        return ShieldCheck;
      case 'CLOCK':
        return Clock;
      case 'INVENTORY':
        return Building2;
      case 'QUOTATION':
        return FileText;
      case 'GLOBAL':
        return Globe2;
      case 'SUPPORT':
      default:
        return Headphones;
    }
  };

  return (
    <section id="why-theunbound-section" className={`space-y-6 ${className}`}>
      <SectionHeader
        eyebrow={eyebrow}
        eyebrowIcon={ShieldCheck}
        title={heading}
        subtitle={subheading}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        {pillars.map((pillar) => {
          const IconComponent = getPillarIcon(pillar.iconType);
          return (
            <div
              key={pillar.id}
              className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200 hover:border-[#00C6A6] hover:shadow-md transition-all duration-200 flex flex-col justify-between group"
            >
              <div className="space-y-3.5">
                <div className="flex items-center justify-between">
                  <div className="w-11 h-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#00C6A6] group-hover:bg-[#00C6A6] group-hover:text-white transition-colors">
                    <IconComponent className="w-5 h-5" />
                  </div>
                  {pillar.badge && (
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider bg-slate-50 px-2 py-0.5 rounded-md border border-slate-100">
                      {pillar.badge}
                    </span>
                  )}
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-bold text-slate-900 leading-snug group-hover:text-[#008972] transition-colors">
                    {pillar.title}
                  </h3>
                  <p className="text-[11px] font-semibold text-[#008972] mt-0.5">
                    {pillar.subtitle}
                  </p>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {pillar.description}
                </p>
              </div>

              <div className="pt-4 mt-2 border-t border-slate-100 flex items-center space-x-1.5 text-[11px] font-bold text-slate-400 group-hover:text-[#00C6A6] transition-colors">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#00C6A6]" />
                <span>Verified Direct Standard</span>
              </div>
            </div>
          );
        })}
      </div>

      {showCta && (
        <div className="bg-slate-900 rounded-2xl p-4 sm:p-6 text-white flex flex-col sm:flex-row items-center justify-between gap-4 border border-slate-800">
          <div className="flex items-center space-x-3 text-center sm:text-left">
            <div className="w-9 h-9 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0] shrink-0">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-white">
                B2B Agency Partnership Desks
              </h4>
              <p className="text-[11px] sm:text-xs text-slate-300 mt-0.5">
                Wholesale contracts, multi-currency escrow billing, and custom client-facing PDF proposals.
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={() => navigateTo('/contact')}
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs font-bold transition-colors cursor-pointer"
            >
              Speak with DMC Desk
            </button>
            <button
              onClick={() => navigateTo('/b2b/quote-builder')}
              className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 text-xs font-bold transition-colors shadow-sm cursor-pointer flex items-center space-x-1.5"
            >
              <span>Build Client Quote</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}
    </section>
  );
};
