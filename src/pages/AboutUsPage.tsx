import React, { useState } from 'react';
import { 
  Compass, 
  Globe2, 
  ShieldCheck, 
  MapPin, 
  Phone, 
  Mail, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Award, 
  TrendingUp, 
  Users, 
  Calendar, 
  Building2, 
  FileText, 
  Clock, 
  Plane, 
  Cpu,
  ExternalLink,
  ChevronRight,
  MessageSquare,
  Quote,
  Zap,
  Star,
  Send,
  Heart
} from 'lucide-react';
import { AppDatabase } from '../services/db';
import { HeroTrustStrip } from '../components/Hero/HeroTrustStrip';
import { WhyTheUnbound } from '../components/WhyTheUnbound';

interface AboutUsPageProps {
  onBackToExplore?: () => void;
  onNavigateToBuilder?: () => void;
  onSelectDestination?: (slug: string) => void;
  onNavigateToContact?: () => void;
}

export const AboutUsPage: React.FC<AboutUsPageProps> = ({
  onBackToExplore,
  onNavigateToBuilder,
  onSelectDestination,
  onNavigateToContact
}) => {
  const db = AppDatabase.getInstance();
  const [activeWorkflowStep, setActiveWorkflowStep] = useState<number>(1);
  const [quickMessageSent, setQuickMessageSent] = useState(false);
  const [agentName, setAgentName] = useState('');
  const [agentEmail, setAgentEmail] = useState('');
  const [agentRequirement, setAgentRequirement] = useState('');

  const handleQuickLeadSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agentEmail.trim()) return;

    db.saveLead({
      id: `lead-about-${Date.now()}`,
      leadNumber: `LED-ABT-${Math.floor(1000 + Math.random() * 9000)}`,
      contactName: agentName.trim() || 'Partner Inquiry',
      email: agentEmail.trim(),
      phone: '+91-9811654959',
      agencyName: 'Agency Inquiry via About Us',
      source: 'ABOUT_US_PAGE',
      status: 'NEW',
      assignedStaffId: 'staff-ops-01',
      assignedStaffName: 'DMC Central Operations',
      destinationId: 'europe',
      destinationName: 'Europe, UK & Japan',
      travelDates: 'Upcoming 2026/2027 Season',
      paxAdults: 2,
      paxChildren: 0,
      paxInfants: 0,
      travelRequirements: agentRequirement.trim() || 'Inquiry from About Us page regarding B2B DMC partnership tariffs',
      notes: [
        {
          id: `note-${Date.now()}`,
          authorName: 'About Us Lead Form',
          text: `Inquiry submitted: ${agentRequirement.trim() || 'Partner registration request'}`,
          timestamp: new Date().toISOString()
        }
      ],
      estimatedBudget: 5000,
      currency: 'USD',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, null);

    setQuickMessageSent(true);
  };

  const workflowSteps = [
    {
      step: '01',
      title: 'Connect with Us',
      shortDesc: 'Tell us your requirement and traveler profile',
      fullDesc: 'Connect directly with our destination specialists via portal, email, or WhatsApp. Share your guest details, destination wishlist, budget range, and preferred travel dates.',
      icon: MessageSquare,
      accent: 'from-teal-500 to-emerald-600'
    },
    {
      step: '02',
      title: 'Get 1st Quote',
      shortDesc: 'Understand the destination, cost & draft itinerary',
      fullDesc: 'Receive a transparent, comprehensive initial proposal detailing day-by-day routing, vetted accommodations, recommended experiences, and clean final pricing in your chosen currency.',
      icon: FileText,
      accent: 'from-blue-500 to-indigo-600'
    },
    {
      step: '03',
      title: 'Get Amended Quote',
      shortDesc: 'Refine and finalize every bespoke activity',
      fullDesc: 'Work with our operations desk to adjust room categories, swap private tours, add visa facilitation, or include VIP private chauffeur transfers until the itinerary is tailored to perfection.',
      icon: Sparkles,
      accent: 'from-purple-500 to-teal-600'
    },
    {
      step: '04',
      title: 'Make Payment & Book',
      shortDesc: 'Instant reservation & 24–48h confirmed voucher SLA',
      fullDesc: 'Process secure payment to lock in wholesale contracted allocations. Our on-ground dispatch team issues confirmed reservation vouchers within our guaranteed 24–48 hour operational SLA.',
      icon: ShieldCheck,
      accent: 'from-emerald-500 to-teal-600'
    },
    {
      step: '05',
      title: 'Travel',
      shortDesc: 'Enjoy memorable moments with 24/7 on-ground care',
      fullDesc: 'Your travelers enjoy stress-free, deeply authentic experiences backed by 24/7 multilingual ground dispatch, certified local guides, and immediate on-tour emergency assistance.',
      icon: Plane,
      accent: 'from-amber-500 to-emerald-600'
    }
  ];

  const founderMilestones = [
    {
      year: '2017',
      company: 'Gofro',
      badge: 'B2C Travel Tech • Backed by MakeMyTrip',
      description: 'Began the travel tech journey at Gofro, backed by MakeMyTrip. Immersed in high-energy startup culture, gaining firsthand mastery over customer travel behavior and technology-driven operations.'
    },
    {
      year: '2018–2023',
      company: 'TravClan',
      badge: 'B2B Travel Tech • Leo Capital Funded • LinkedIn Top 20 Startup',
      description: 'Joined TravClan as Business Lead, delving deeply into the operational mechanics of global travel. Spearheaded complex supply chain solutions across global destinations, building a robust supplier network that propelled TravClan to LinkedIn’s Top 20 Indian Startups list in 2024.'
    },
    {
      year: '2023–2024',
      company: 'Red Sand',
      badge: 'Dubai Destination Management Company',
      description: 'Served as Director of Growth at Red Sand, one of Dubai’s premier desert safari and destination management companies, driving international expansion, luxury branding, and direct partner alliances.'
    },
    {
      year: '2025–Present',
      company: 'TheUnbound',
      badge: 'Global Destination Management Company',
      description: 'Founded TheUnbound to empower young travel entrepreneurs and agents with direct contracted ground operations, authentic cultural experiences, and seamless travel logistics across Europe, the UK, and Japan.'
    }
  ];

  return (
    <div className="w-full pb-16 space-y-12 animate-in fade-in duration-200">
      {/* 1. Compact Hero Section */}
      <div className="w-full bg-[#061329] text-white relative overflow-hidden border-b border-slate-800">
        {/* Dot pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20" 
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-8 sm:pb-10 relative z-10 text-center flex flex-col items-center">
          {/* Eyebrow Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider text-teal-300 bg-teal-950/60 border border-teal-500/30 uppercase mb-4 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6] animate-pulse" />
            <span>ESTABLISHED IN 2025 • DESTINATION MANAGEMENT COMPANY</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-white leading-tight uppercase max-w-3xl mx-auto mb-3">
            DESTINATION MANAGEMENT SIMPLIFIED BY <span className="text-[#00C6A6]">INTELLIGENCE.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal mb-6">
            TheUnbound combines licensed ground operations, verified bilingual guide networks, and automated B2B quotation technology for modern travel advisors and tour operators worldwide.
          </p>

          {/* Action CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md mx-auto">
            {onSelectDestination && (
              <button
                id="about-explore-dest-btn"
                onClick={() => onSelectDestination('all')}
                className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
              >
                <span>EXPLORE DESTINATIONS</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}

            {onNavigateToBuilder && (
              <button
                id="about-partner-btn"
                onClick={onNavigateToBuilder}
                className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
              >
                <span>BECOME A PARTNER</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Unified Operational Trust Strip */}
        <HeroTrustStrip />
      </div>

      {/* 2. Main Body Content Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-16">
        {/* Breadcrumb / Back button */}
        {onBackToExplore && (
          <button
            onClick={onBackToExplore}
            className="inline-flex items-center space-x-2 text-slate-600 hover:text-slate-900 text-xs font-bold transition-colors cursor-pointer"
          >
            <Compass className="w-4 h-4 text-[#00C6A6]" />
            <span>← Back to Destination Explorer</span>
          </button>
        )}

      {/* Section: Founder & CEO Leadership */}
      <section className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm space-y-10">
        <div className="max-w-3xl space-y-2">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
            <Award className="w-3.5 h-3.5" />
            <span>Executive Leadership</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-sans text-slate-900 tracking-tight">
            Meet Our Founder & CEO
          </h2>
          <p className="text-sm text-slate-600 leading-relaxed">
            Built on nearly a decade of high-level B2B travel experience and a commitment to transform ordinary sightseeing into authentic, transformative journeys.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center bg-slate-50/80 rounded-3xl p-6 sm:p-8 border border-slate-200">
          {/* Founder Bio Details */}
          <div className="lg:col-span-8 space-y-6">
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-teal-600 to-emerald-400 text-white flex items-center justify-center font-black text-2xl shadow-md">
                MR
              </div>
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 font-sans">
                  Mohd Rizwi
                </h3>
                <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                  Founder & Chief Executive Officer
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  10+ Years in Travel B2B Sector • Ex-TravClan • Ex-Red Sand • Ex-Gofro
                </p>
              </div>
            </div>

            <div className="space-y-4 text-slate-700 text-sm leading-relaxed">
              <div className="relative pl-6 border-l-4 border-[#00C6A6] py-1 bg-white p-4 rounded-r-2xl border-y border-r border-slate-200">
                <Quote className="w-6 h-6 text-[#00C6A6]/30 absolute top-2 right-3" />
                <p className="italic text-slate-800 font-medium">
                  "We founded TheUnbound to transform tourists into true travelers, inspiring them to explore and deeply experience the world. With over 10 years in the travel B2B sector, I've driven significant contributions as a Business Lead at TravClan, recognized as one of LinkedIn's Top 20 Startups in 2024, and as Director of Growth at Red Sand, one of Dubai's largest desert safari operators."
                </p>
              </div>

              <p>
                "Now, our mission is to help Travel Agents deliver unique experiences and adventures to their guests. TheUnbound is built on nearly a decade of expertise and a vision to foster a community of unbound spirits."
              </p>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <span className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-700 shadow-xs">
                ✓ Ground Supply Chain Specialist
              </span>
              <span className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-700 shadow-xs">
                ✓ B2B Agent Community Advocate
              </span>
              <span className="px-3 py-1 bg-white rounded-lg border border-slate-200 text-xs font-bold text-slate-700 shadow-xs">
                ✓ Bespoke Multi-Country Routing
              </span>
            </div>
          </div>

          {/* Founder Executive Summary Card */}
          <div className="lg:col-span-4 bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 space-y-4 shadow-md">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800 text-xs">
              <span className="text-[#00E5C0] font-bold uppercase tracking-wider text-[10px]">Leadership Vision</span>
              <Globe2 className="w-4 h-4 text-slate-400" />
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-300 leading-relaxed font-light">
                "Our mission is to help explorers uncover new destinations and adventurers discover fresh horizons."
              </p>
              <div className="pt-2 border-t border-slate-800">
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Executive Office Contact</span>
                <a 
                  href="mailto:business@theunbound.in" 
                  className="text-xs text-[#00E5C0] hover:underline font-mono font-bold block mt-0.5"
                >
                  business@theunbound.in
                </a>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-800/80 border border-slate-700 text-[11px] text-slate-300">
              <span className="font-bold text-white block mb-1">Direct Agent Assistance</span>
              Connect directly with our leadership and senior operations leads for customized agency tie-ups and group contracts.
            </div>
          </div>
        </div>

        {/* Founder Journey Interactive Timeline */}
        <div className="space-y-6 pt-6 border-t border-slate-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-slate-900 font-sans">
                The Founder's Journey
              </h3>
              <p className="text-xs text-slate-500">
                A progressive roadmap of operational excellence: Gofro → TravClan → Red Sand → TheUnbound
              </p>
            </div>
            <span className="text-xs font-mono font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200 self-start sm:self-auto">
              2017 – 2026+ Track Record
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {founderMilestones.map((item, index) => (
              <div 
                key={index}
                className="bg-white p-5 rounded-2xl border border-slate-200 hover:border-teal-400 transition-all hover:shadow-md flex flex-col justify-between space-y-3 relative overflow-hidden group"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-700 group-hover:bg-[#00C6A6] group-hover:text-slate-950 transition-colors">
                      {item.year}
                    </span>
                    <span className="text-[10px] text-slate-400 font-bold">Step 0{index + 1}</span>
                  </div>
                  <h4 className="text-base font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                    {item.company}
                  </h4>
                  <span className="text-[10px] font-bold text-teal-700 block leading-tight">
                    {item.badge}
                  </span>
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Section: Strategic Vision & 4 Value Pillars */}
      <section className="space-y-8">
        <div className="bg-gradient-to-r from-slate-900 via-slate-950 to-teal-950 text-white p-8 sm:p-12 rounded-3xl border border-slate-800 shadow-xl space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <Compass className="w-3.5 h-3.5" />
            <span>Our Strategic Vision</span>
          </div>
          <h2 className="text-2xl sm:text-4xl font-black font-sans tracking-tight text-white max-w-3xl">
            "To become a leading European & Global DMC that crafts personalized travel experiences that unlock hidden destinations and immerse travelers in the diverse wonders of the world."
          </h2>
          <p className="text-sm text-slate-300 max-w-2xl font-light">
            We bridge the gap between complex ground operations and travel agents, offering turnkey destination solutions with end-to-end reliability.
          </p>
        </div>

        {/* Standardized Why TheUnbound Section */}
        <WhyTheUnbound onExploreProducts={onBackToExplore} />
      </section>

      {/* Section: Our Key Destination Hubs */}
      <section className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
              <Globe2 className="w-3.5 h-3.5" />
              <span>Core Geographic Footprint</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-black font-sans text-slate-900 tracking-tight">
              Our Primary Destinations
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 max-w-xl">
              TheUnbound makes planning your next vacation effortless. With our industry expertise and in-depth knowledge, we stand out as your perfect travel partner.
            </p>
          </div>
          {onSelectDestination && (
            <button
              onClick={() => onSelectDestination('all')}
              className="inline-flex items-center space-x-2 text-xs font-bold text-teal-700 hover:text-teal-800 cursor-pointer"
            >
              <span>View All Tours & Packages</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* United Kingdom */}
          <div 
            onClick={() => onSelectDestination && onSelectDestination('uk')}
            className="group cursor-pointer bg-slate-50 rounded-3xl border border-slate-200 hover:border-teal-500 transition-all p-6 space-y-4 hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-700 border border-blue-200 flex items-center justify-center font-black text-xl">
              🇬🇧
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                United Kingdom
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                London, Edinburgh, Cotswolds, Scottish Highlands, Bath, Oxford
              </p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Bespoke luxury touring featuring private chauffeur fleets, Blue Badge licensed guides, and historic country manor allocations.
            </p>
            <div className="pt-2 flex items-center text-xs font-bold text-teal-700 group-hover:translate-x-1 transition-transform">
              <span>Explore UK Hubs & Itineraries →</span>
            </div>
          </div>

          {/* Europe */}
          <div 
            onClick={() => onSelectDestination && onSelectDestination('europe')}
            className="group cursor-pointer bg-slate-50 rounded-3xl border border-slate-200 hover:border-teal-500 transition-all p-6 space-y-4 hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-700 border border-indigo-200 flex items-center justify-center font-black text-xl">
              🇪🇺
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                Europe (Schengen)
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                France, Italy, Switzerland, Netherlands, Spain, Germany
              </p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Seamless cross-border European journeys, alpine panoramic rail bookings, private skip-the-line museum docents, and curated gastronomic experiences.
            </p>
            <div className="pt-2 flex items-center text-xs font-bold text-teal-700 group-hover:translate-x-1 transition-transform">
              <span>Explore European Circuits →</span>
            </div>
          </div>

          {/* Japan */}
          <div 
            onClick={() => onSelectDestination && onSelectDestination('japan')}
            className="group cursor-pointer bg-slate-50 rounded-3xl border border-slate-200 hover:border-teal-500 transition-all p-6 space-y-4 hover:shadow-md"
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-700 border border-rose-200 flex items-center justify-center font-black text-xl">
              🇯🇵
            </div>
            <div>
              <h3 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors">
                Japan
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Tokyo, Kyoto, Osaka, Mt. Fuji, Hokkaido, Hiroshima, Nara
              </p>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed">
              Authentic Japanese hospitality with traditional ryokans, private onsens, bullet train luggage forwardings, and bilingual local coordinators.
            </p>
            <div className="pt-2 flex items-center text-xs font-bold text-teal-700 group-hover:translate-x-1 transition-transform">
              <span>Explore Japan Programs →</span>
            </div>
          </div>
        </div>
      </section>

      {/* Section: 5-Step Work-Flow */}
      <section className="bg-slate-950 text-white rounded-3xl p-8 sm:p-12 border border-slate-800 shadow-xl space-y-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-[#00C6A6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-2xl space-y-2 relative z-10">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <Zap className="w-3.5 h-3.5" />
            <span>Turnkey Operations Model</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black font-sans tracking-tight text-white">
            Our 5-Step Seamless Work-Flow
          </h2>
          <p className="text-xs sm:text-sm text-slate-400">
            "Let us know your requirement and leave everything on us."
          </p>
        </div>

        {/* Stepper Navigation */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 relative z-10">
          {workflowSteps.map((stepItem, idx) => {
            const stepNum = idx + 1;
            const isCurrent = activeWorkflowStep === stepNum;
            const StepIcon = stepItem.icon;

            return (
              <button
                key={stepNum}
                onClick={() => setActiveWorkflowStep(stepNum)}
                className={`text-left p-4 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                  isCurrent
                    ? 'bg-slate-800/95 border-[#00C6A6] shadow-lg shadow-[#00C6A6]/10'
                    : 'bg-slate-900/60 border-slate-800 hover:bg-slate-900 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-black font-mono px-2 py-0.5 rounded ${
                    isCurrent ? 'bg-[#00C6A6] text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {stepItem.step}
                  </span>
                  <StepIcon className={`w-4 h-4 ${isCurrent ? 'text-[#00E5C0]' : 'text-slate-500'}`} />
                </div>
                <div>
                  <h4 className={`text-xs font-bold ${isCurrent ? 'text-white' : 'text-slate-300'}`}>
                    {stepItem.title}
                  </h4>
                  <p className="text-[10px] text-slate-400 line-clamp-2 mt-0.5">
                    {stepItem.shortDesc}
                  </p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Active Step Detailed Showcase */}
        {(() => {
          const current = workflowSteps[activeWorkflowStep - 1];
          const CurrentIcon = current.icon;
          return (
            <div className="bg-slate-900/90 rounded-2xl p-6 border border-slate-800 space-y-3 relative z-10">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#00C6A6]/20 text-[#00E5C0] flex items-center justify-center font-bold">
                  <CurrentIcon className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-mono text-[#00E5C0] font-bold block">
                    STEP {current.step} OF 05
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-white">
                    {current.title}: {current.shortDesc}
                  </h3>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pl-1">
                {current.fullDesc}
              </p>
            </div>
          );
        })()}
      </section>

      {/* Section: Official Registered Corporate Credentials & Direct Contact */}
      <section className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Contact Details from PDF */}
          <div className="lg:col-span-6 space-y-6">
            <div className="space-y-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200">
                <Building2 className="w-3.5 h-3.5" />
                <span>Official Operations HQ</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black font-sans text-slate-900 tracking-tight">
                Corporate Credentials & Contact
              </h2>
              <p className="text-xs sm:text-sm text-slate-600">
                Unleash your wild heart and become the unbound. Connect directly with our team for contracts, rate sheets, and custom quotes.
              </p>
            </div>

            <div className="space-y-3 text-xs sm:text-sm">
              <div className="flex items-start space-x-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <MapPin className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Registered Address</span>
                  <span className="font-bold text-slate-900">
                    A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi 110076, India
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <a 
                  href="tel:+919811654959"
                  className="flex items-start space-x-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-colors"
                >
                  <Phone className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Direct Phone</span>
                    <span className="font-bold text-slate-900 font-mono">+91-9811654959</span>
                    <span className="text-[10px] text-emerald-600 block font-medium">WhatsApp Active</span>
                  </div>
                </a>

                <a 
                  href="mailto:sales@theunbound.in"
                  className="flex items-start space-x-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200 hover:border-teal-400 transition-colors"
                >
                  <Mail className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-[10px] text-slate-400 uppercase font-bold block">Official Inquiries</span>
                    <span className="font-bold text-slate-900 font-mono">sales@theunbound.in</span>
                    <span className="text-[10px] text-slate-500 block">business@theunbound.in</span>
                  </div>
                </a>
              </div>

              <div className="flex items-start space-x-3 p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                <Globe2 className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold block">Official Web Portal</span>
                  <span className="font-bold text-slate-900 font-mono">www.theunbound.in</span>
                  <span className="text-[10px] text-slate-500 block">Registered Trade Entity: Unbound Experiences India Pvt Ltd</span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Fast B2B Partner Connection Form */}
          <div className="lg:col-span-6 bg-slate-900 text-white rounded-3xl p-6 sm:p-8 border border-slate-800 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black text-white">
                  Join Our B2B Agent Community
                </h3>
                <p className="text-xs text-slate-400">
                  Request custom group quotes or agency partnership onboardings.
                </p>
              </div>
              <Sparkles className="w-5 h-5 text-[#00E5C0]" />
            </div>

            {quickMessageSent ? (
              <div className="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
                <h4 className="text-base font-bold text-white">Thank You for Connecting!</h4>
                <p className="text-xs text-slate-300">
                  Our destination desk has received your request. A senior specialist will reach out within 2 hours with our wholesale portfolio and quotation guidelines.
                </p>
                <button
                  onClick={() => setQuickMessageSent(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-200 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Send Another Inquiry
                </button>
              </div>
            ) : (
              <form onSubmit={handleQuickLeadSubmit} className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-300">Your Name / Agency</label>
                    <input
                      type="text"
                      value={agentName}
                      onChange={(e) => setAgentName(e.target.value)}
                      placeholder="e.g. Travel Wonders / John Doe"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C6A6]"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-300">Email Address</label>
                    <input
                      type="email"
                      value={agentEmail}
                      onChange={(e) => setAgentEmail(e.target.value)}
                      placeholder="agent@agency.com"
                      className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C6A6]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase font-bold text-slate-300">Requirement / Destination Interests</label>
                  <textarea
                    value={agentRequirement}
                    onChange={(e) => setAgentRequirement(e.target.value)}
                    rows={3}
                    placeholder="Tell us about your upcoming group, FIT inquiry, or partnership questions..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#00C6A6]"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-3 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black text-xs rounded-xl transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Submit Inquiry to Operations Desk</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {/* Bottom Floating/Closing CTA Bar */}
      <div className="p-6 bg-slate-100 rounded-3xl border border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-2xl bg-teal-600 text-white flex items-center justify-center">
            <Heart className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-black text-slate-900">Thank You for Choosing TheUnbound</h4>
            <p className="text-xs text-slate-500">Plan like a Tourist, Explore like a Traveler.</p>
          </div>
        </div>
        <div className="flex items-center space-x-3">
          {onNavigateToBuilder && (
            <button
              onClick={onNavigateToBuilder}
              className="px-4 py-2 rounded-xl bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-bold text-xs cursor-pointer"
            >
              Start a Quote
            </button>
          )}
          {onNavigateToContact && (
            <button
              onClick={onNavigateToContact}
              className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-300 font-bold text-xs cursor-pointer"
            >
              Full Contact Hub
            </button>
          )}
        </div>
      </div>
    </div>
  </div>
  );
};
