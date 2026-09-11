import React, { useState } from 'react';
import { Destination } from '../types';
import { BuyerHeroSection } from '../components/BuyerPortal/BuyerHeroSection';
import { PublicReviewsCarousel } from '../components/PublicReviewsCarousel';
import { FinalCTA } from '../components/FinalCTA';
import { 
  Building2, 
  ShieldCheck, 
  Clock, 
  FileText, 
  HelpCircle, 
  ChevronDown, 
  ChevronUp, 
  ArrowRight,
  Lock,
  Sparkles,
  Users2,
  CheckCircle2,
  PhoneCall,
  Globe2,
  Compass,
  Layers,
  Award,
  Headphones,
  CheckCircle,
  Briefcase
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { navigateTo } from '../services/portalRouter';

interface LoggedOutBuyerHomepageProps {
  allDestinations: Destination[];
  onSelectDestination: (slug: string) => void;
  onOpenRegister?: () => void;
  onOpenLogin?: () => void;
}

export const LoggedOutBuyerHomepage: React.FC<LoggedOutBuyerHomepageProps> = ({
  allDestinations,
  onSelectDestination,
  onOpenRegister,
  onOpenLogin
}) => {
  const { openAuthModal } = useAuth();
  const [expandedFaqIdx, setExpandedFaqIdx] = useState<number | null>(null);

  // Filter out any virtual "all" destination
  const displayDestinations = (allDestinations || []).filter(d => d.slug !== 'all');

  const handlePartnerAction = () => {
    if (onOpenRegister) {
      onOpenRegister();
    } else {
      openAuthModal('Register your travel agency to apply for verified B2B Agent portal access.');
    }
  };

  const handleLoginAction = () => {
    if (onOpenLogin) {
      onOpenLogin();
    } else {
      const emailInput = document.getElementById('b2b-login-email');
      if (emailInput) {
        emailInput.focus();
        emailInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        openAuthModal('Sign in to your verified B2B Agent account.');
      }
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-16 space-y-12 sm:space-y-16">
      
      {/* 1. HERO SECTION: Official B2B DMC Messaging + Embedded Agent Portal Login Terminal */}
      <BuyerHeroSection
        allDestinations={allDestinations}
        onSelectDestination={onSelectDestination}
        onOpenRegister={handlePartnerAction}
      />

      {/* 2. BRAND INTRODUCTION & DMC ARCHITECTURE */}
      <section id="b2b-brand-introduction" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-7 space-y-5 text-left">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold uppercase tracking-wider">
              <Award className="w-3.5 h-3.5 text-[#008972]" />
              <span>Direct Destination Management Company</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-black text-slate-900 tracking-tight leading-tight">
              An Exclusive Trade Infrastructure for Inbound & Outbound Travel Designers
            </h2>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              TheUnbound operates directly licensed ground operations desks, owned and contracted vehicle fleets, and accredited bilingual guide networks across Europe, Japan, the United Kingdom, and emerging global corridors. We strictly do not sell to end consumers or public travelers.
            </p>
            <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
              Every rate in our system is a confidential wholesale net tariff designed to protect trade agency margins, accompanied by strict 24–48 hour proposal SLAs and 24/7 on-tour ground dispatch.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-2xl font-black text-slate-900">100%</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">B2B Trade Exclusive</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
                <div className="text-2xl font-black text-[#008972]">24–48h</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">Proposal Turnaround</div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 col-span-2 sm:col-span-1">
                <div className="text-2xl font-black text-slate-900">Zero</div>
                <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-0.5">Middleman Markups</div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900 rounded-2xl p-6 text-white space-y-4 shadow-xl border border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0]">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Private Commercial Tariffs</h4>
                  <p className="text-xs text-slate-400">Restricted to vetted travel partners</p>
                </div>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed">
                Wholesale hotel allotments, private chauffeur dispatches, licensed guide manifests, and commercial rates are strictly withheld from public view.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <button
                  type="button"
                  id="brand-section-login-btn"
                  onClick={handleLoginAction}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs font-bold transition-all text-center cursor-pointer shadow-sm"
                >
                  Agent Login
                </button>
                <button
                  type="button"
                  id="brand-section-register-btn"
                  onClick={handlePartnerAction}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold transition-all text-center cursor-pointer"
                >
                  Apply for Access
                </button>
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 space-y-2 text-left">
              <div className="flex items-center space-x-2 text-[#008972] font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Regulatory Verification</span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed">
                We independently verify trade credentials (IATA, ABTA, ASTA, or national trade licenses) before commercial rates are unlocked.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. HIGH-LEVEL EDITORIAL DESTINATION EXPERTISE (NON-COMMERCIAL) */}
      <section id="b2b-destination-expertise" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8 text-left">
          <div className="space-y-1.5">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#008972]">
              Destination Management Operations
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Explore Our Destination Expertise Across Global Corridors
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Specialized ground handling, VIP logistical planning, and local dispatch capabilities across Japan, Europe, Southeast Asia, the United Kingdom, Dubai, and Azerbaijan.
            </p>
          </div>
          <div className="flex items-center space-x-2 shrink-0">
            <span className="inline-flex items-center space-x-1 text-xs font-bold text-slate-500 bg-slate-200/70 px-3 py-1.5 rounded-xl">
              <Globe2 className="w-3.5 h-3.5 text-slate-700" />
              <span>{displayDestinations.length} Active Operational Desks</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayDestinations.map((dest) => (
            <div
              key={`b2b-editorial-dest-${dest.id || dest.slug}`}
              id={`editorial-destination-card-${dest.slug}`}
              className="bg-white rounded-2xl border border-slate-200 shadow-xs hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col text-left group"
            >
              <div className="relative aspect-16/10 w-full overflow-hidden bg-slate-900">
                <img
                  src={dest.heroImage}
                  alt={dest.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                  referrerPolicy="no-referrer"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/30 to-transparent" />
                
                <div className="absolute top-3 inset-x-3 flex items-center justify-between z-10">
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/95 text-slate-900 shadow-xs">
                    {dest.country}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-[#00C6A6] text-slate-950 shadow-xs">
                    Direct Ground Desk
                  </span>
                </div>

                <div className="absolute bottom-3 inset-x-3 text-white z-10">
                  <h3 className="text-xl font-black text-white leading-tight">
                    {dest.name}
                  </h3>
                  {dest.tagline && (
                    <p className="text-xs text-slate-200 mt-0.5 line-clamp-1">
                      {dest.tagline}
                    </p>
                  )}
                </div>
              </div>

              <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
                <p className="text-xs text-slate-600 line-clamp-3 leading-relaxed">
                  {dest.description || `Specialized B2B ground handling, VIP logistics, and licensed bilingual guides in ${dest.name}.`}
                </p>

                <div className="space-y-2 pt-3 border-t border-slate-100">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Operational Highlights:
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                      Licensed Guides
                    </span>
                    <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                      Owned Fleet Logistics
                    </span>
                    <span className="text-[10px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md">
                      VIP Hotel Allotments
                    </span>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handlePartnerAction}
                    className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#00C6A6]" />
                    <span>Agent Verification Required for Inventory</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 4. WHY TRAVEL AGENTS PARTNER WITH THEUNBOUND & B2B BENEFITS */}
      <section id="b2b-partnership-benefits" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 text-white border border-slate-800 space-y-10">
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#00E5C0] bg-[#00C6A6]/10 px-3.5 py-1 rounded-full border border-[#00C6A6]/30">
              Trade Partner Advantage
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              Why Premier Travel Advisors & Tour Operators Partner with TheUnbound
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed">
              We remove the operational friction of sourcing international ground services, protecting your reputation with guaranteed SLAs and confidential net wholesale rates.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-left">
            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0]">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Direct Contracts, Zero Brokers</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Direct procurement with luxury hotels, ryokan masters, private chauffeurs, and local venue directors. You avoid multi-tier aggregator markups and gain authentic destination authority.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0]">
                <Clock className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Strict 24–48h SLA Quotations</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Never lose a VIP client due to slow ground supplier responses. Our destination itinerary architects deliver itemized, client-ready proposals within 24 to 48 hours guaranteed.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0]">
                <Briefcase className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">White-Label Quotation Engine</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Generate unbranded, beautifully formatted client proposals featuring your travel agency logo, contact information, and customizable retail markup percentages.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0]">
                <Headphones className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Dedicated Account Management</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                A single point of operational contact who understands your high-net-worth traveler preferences, dietary restrictions, mobility requirements, and luxury expectations.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0]">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Multi-Currency Net Tariffs</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                View confidential net wholesale pricing in destination currency (JPY, EUR, GBP, AED) or converted dynamically to USD, CAD, or AUD with zero foreign transaction penalties.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-800/80 border border-slate-700/80 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/10 border border-[#00C6A6]/30 flex items-center justify-center text-[#00E5C0]">
                <PhoneCall className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">24/7 Bilingual Ground Dispatch</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Local duty managers on call in every active country timezone to coordinate flight delays, chauffeur pickups, restaurant reservations, and emergency changes.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. 4-STEP PARTNER ONBOARDING PROCESS */}
      <section id="b2b-onboarding-process" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-xs space-y-8">
          <div className="text-center max-w-2xl mx-auto space-y-2">
            <span className="text-[11px] font-black uppercase tracking-widest text-[#008972] bg-[#00C6A6]/10 px-3 py-1 rounded-full">
              Seamless Trade Registration
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Partner Onboarding in 4 Simple Steps
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              How licensed travel agents and tour operators unlock full inventory, commercial net rates, and digital booking tools.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 relative">
            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#00E5C0] font-black flex items-center justify-center text-sm shadow-xs">
                01
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Submit Agency Application</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Provide your travel agency name, business email, contact details, and trade license / GST / IATA credentials.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#00E5C0] font-black flex items-center justify-center text-sm shadow-xs">
                02
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Vetting & Accreditation</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Our trade onboarding desk reviews your commercial credentials within 24 hours to preserve market exclusivity.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-slate-900 text-[#00E5C0] font-black flex items-center justify-center text-sm shadow-xs">
                03
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Access Net Tariffs & Inventory</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Log into your personalized B2B portal to query live rates, hotel allocations, and private transfer routes.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 text-left">
              <div className="w-10 h-10 rounded-xl bg-[#00C6A6] text-slate-950 font-black flex items-center justify-center text-sm shadow-xs">
                04
              </div>
              <h3 className="font-bold text-slate-900 text-sm">Build Quotes & Dispatch</h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Generate branded customer proposals and submit instant booking requests with confirmed ground fulfillment.
              </p>
            </div>
          </div>

          <div className="text-center pt-4">
            <button
              type="button"
              id="onboarding-cta-btn"
              onClick={handlePartnerAction}
              className="px-8 py-3.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-sm font-black transition-all shadow-md inline-flex items-center space-x-2 cursor-pointer"
            >
              <span>Apply for B2B Trade Accreditation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </section>

      {/* 6. VERIFIED TRADE PARTNER TESTIMONIALS */}
      <section id="b2b-testimonials" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <PublicReviewsCarousel />
      </section>

      {/* 7. TRADE PARTNERSHIP & OPERATIONAL FAQS */}
      <section id="b2b-trade-faqs" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-xs space-y-8">
          <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 text-left">
            <div className="w-10 h-10 rounded-xl bg-[#008972]/10 flex items-center justify-center text-[#008972]">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                B2B Trade Partnership & Ground Operations FAQs
              </h3>
              <p className="text-xs sm:text-sm text-slate-500">
                Everything travel advisors, travel designers, and tour operators need to know about working with TheUnbound.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
            {[
              {
                q: 'Who qualifies for access to TheUnbound B2B portal?',
                a: 'Access is strictly limited to accredited travel agents, outbound tour operators, luxury travel advisors, and corporate concierge firms with verified business registrations (IATA, ABTA, ASTA, or national trade licenses). We do not accept public registrations.'
              },
              {
                q: 'Why are products, hotels, and prices hidden from the public website?',
                a: 'To protect the business margins and confidentiality of our travel trade partners, all commercial inventory, net wholesale rates, and supplier contracts are protected behind verified B2B authentication.'
              },
              {
                q: 'How are confidential wholesale tariffs and markup controls calculated?',
                a: 'Authenticated agents view net wholesale costs in local destination currency (e.g., JPY for Japan, EUR for Europe). Using our B2B Quote Builder, you configure your own percentage or fixed markup to output client-ready proposals in your chosen currency.'
              },
              {
                q: 'What is the standard turnaround SLA for custom FIT proposals?',
                a: 'Our standard quotation turnaround is 24 to 48 hours for bespoke multi-city itineraries. Instant-book products and direct hotel allocations confirm in real-time with guaranteed voucher issuance.'
              },
              {
                q: 'Can we generate unbranded or agency-branded proposals for our clients?',
                a: 'Yes. Our B2B Quotation Builder allows you to apply your agency name, logo, and advisor details, exporting white-label PDF itineraries with zero TheUnbound commercial branding.'
              },
              {
                q: 'How does on-tour emergency ground support work?',
                a: 'Every active booking is backed by dedicated local duty managers in destination timezones. We provide your clients with a 24/7 bilingual emergency assistance line while keeping your agency informed via real-time operational updates.'
              }
            ].map((faq, idx) => {
              const isExpanded = expandedFaqIdx === idx;
              return (
                <div
                  key={idx}
                  onClick={() => setExpandedFaqIdx(isExpanded ? null : idx)}
                  className="p-5 rounded-2xl bg-slate-50 hover:bg-slate-100/80 border border-slate-200 transition-colors cursor-pointer space-y-2"
                >
                  <div className="flex justify-between items-center">
                    <h4 className="text-sm font-bold text-slate-900 leading-snug">{faq.q}</h4>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />}
                  </div>
                  {isExpanded && (
                    <p className="text-xs text-slate-600 leading-relaxed pt-2">
                      {faq.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. FINAL TRADE PARTNER CALL-TO-ACTION */}
      <section id="b2b-final-cta" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 rounded-3xl p-8 sm:p-14 text-center text-white border border-slate-800 space-y-6 shadow-2xl relative overflow-hidden">
          <div className="max-w-2xl mx-auto space-y-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-[#00C6A6] bg-[#00C6A6]/10 px-3.5 py-1 rounded-full border border-[#00C6A6]/30">
              Trade Accreditation
            </span>
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-black text-white tracking-tight">
              Ready to Upgrade Your Global Ground Operations?
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Apply for agency verification today to unlock confidential wholesale net tariffs, 24–48h quotation fulfillment, and direct ground handling across our global operational network.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              type="button"
              id="final-cta-login-btn"
              onClick={handleLoginAction}
              className="px-8 py-3.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b094] text-slate-950 text-xs sm:text-sm font-black transition-all shadow-lg shadow-[#00C6A6]/20 flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
            >
              <Lock className="w-4 h-4" />
              <span>Login as B2B Agent</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              id="final-cta-register-btn"
              onClick={handlePartnerAction}
              className="px-7 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-bold transition-all backdrop-blur-md flex items-center space-x-2 cursor-pointer active:scale-[0.98]"
            >
              <Building2 className="w-4 h-4 text-[#00C6A6]" />
              <span>Become a B2B Partner</span>
            </button>
          </div>

          <p className="text-[11px] text-slate-400">
            For existing inquiries or immediate FIT dispatch, contact our trade desk at <span className="text-[#00E5C0] font-mono">business@theunbound.in</span>
          </p>
        </div>
      </section>

    </div>
  );
};
