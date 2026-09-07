import React, { useState, useEffect } from 'react';
import { AppDatabase } from '../services/db';
import { VisaProduct } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  FileText, 
  Search, 
  Clock, 
  CheckCircle2, 
  Download, 
  Globe2, 
  ShieldCheck, 
  CheckSquare, 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  DollarSign, 
  ArrowRight,
  Send,
  Sparkles,
  HelpCircle,
  Plane,
  Cpu
} from 'lucide-react';
import { navigateTo } from '../services/portalRouter';
import { HeroTrustStrip } from '../components/Hero/HeroTrustStrip';
import { FinalCTA } from '../components/FinalCTA';

export const VisaPage: React.FC = () => {
  const db = AppDatabase.getInstance();
  const { user } = useAuth();
  const [visas, setVisas] = useState<VisaProduct[]>(() => db.getVisas());
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState<string>('all');
  const [selectedVisa, setSelectedVisa] = useState<VisaProduct | null>(null);

  // Inquiry Form Modal
  const [inquiryModalVisa, setInquiryModalVisa] = useState<VisaProduct | null>(null);
  const [inquiryName, setInquiryName] = useState(user?.name || '');
  const [inquiryEmail, setInquiryEmail] = useState(user?.email || '');
  const [inquiryPhone, setInquiryPhone] = useState('');
  const [inquiryTravelers, setInquiryTravelers] = useState(2);
  const [inquiryTravelDate, setInquiryTravelDate] = useState('2026-06-15');
  const [inquiryNotes, setInquiryNotes] = useState('');
  const [inquirySubmitted, setInquirySubmitted] = useState(false);

  useEffect(() => {
    return db.subscribe(() => {
      setVisas(db.getVisas());
    });
  }, [db]);

  const countries = Array.from(new Set(visas.map(v => v.country)));

  const filteredVisas = visas.filter(v => {
    const matchesCountry = selectedCountry === 'all' || v.country.toLowerCase() === selectedCountry.toLowerCase();
    const matchesSearch = v.country.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.visaType.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          v.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCountry && matchesSearch && v.status === 'ACTIVE';
  });

  const handleDownloadChecklist = (visa: VisaProduct) => {
    const textContent = `=====================================================
THE UNBOUND DMC - OFFICIAL VISA DOCUMENT CHECKLIST
Country: ${visa.country}
Visa Category: ${visa.visaType}
Validity: ${visa.validityDays} Days | Max Stay: ${visa.stayDurationDays} Days
Processing Timeline: ${visa.processingTimeDays} Working Days
=====================================================

MANDATORY DOCUMENTS REQUIRED:
${(visa.documentsChecklist || []).map((doc, idx) => `[ ] ${idx + 1}. ${doc}`).join('\n')}

STEP-BY-STEP SUBMISSION PROCESS:
${(visa.submissionSteps || []).map((step, idx) => `Step ${idx + 1}: ${step}`).join('\n')}

IMPORTANT ELIGIBILITY GUIDELINES:
${(visa.eligibilityNotes || []).map((note, idx) => `* ${note}`).join('\n')}

FEE STRUCTURE:
- Official Consular / Embassy Fee: ${visa.currency} ${visa.embassyFee}
- DMC Scrutiny & Lodgement Fee: ${visa.currency} ${visa.serviceFee}
- Total Net Payable: ${visa.currency} ${visa.embassyFee + visa.serviceFee}

Support Desk: business@theunbound.in | Operations Team
=====================================================`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `TheUnbound_Visa_Checklist_${(visa.country || 'Destination').replace(/\s+/g, '_')}_${(visa.visaType || 'Visa').replace(/\s+/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSendInquiry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inquiryModalVisa) return;

    // Create lead in AppDatabase
    db.saveLead({
      id: `lead-visa-${Date.now()}`,
      leadNumber: `LED-VISA-${Date.now().toString().slice(-4)}`,
      contactName: inquiryName,
      email: inquiryEmail,
      phone: inquiryPhone,
      agencyName: user?.agencyName || 'Direct B2B Agent',
      destinationId: inquiryModalVisa.destinationId || 'dest-general',
      destinationName: inquiryModalVisa.country,
      paxAdults: inquiryTravelers,
      paxChildren: 0,
      travelDates: inquiryTravelDate,
      estimatedBudget: (inquiryModalVisa.embassyFee + inquiryModalVisa.serviceFee) * inquiryTravelers,
      currency: inquiryModalVisa.currency || 'USD',
      travelRequirements: `Visa Assistance Request for: ${inquiryModalVisa.visaType} (${inquiryModalVisa.country}). Additional notes: ${inquiryNotes}`,
      notes: [
        {
          id: `note-${Date.now()}`,
          authorName: user?.name || 'Visa Portal Submission',
          text: `Inquiry submitted for ${inquiryModalVisa.visaType}. Travel Date: ${inquiryTravelDate}, Travelers: ${inquiryTravelers}. Special Notes: ${inquiryNotes || 'None'}`,
          timestamp: new Date().toISOString()
        }
      ],
      source: 'VISA_PAGE',
      status: 'NEW',
      assignedStaffId: 'staff-visa-lead',
      assignedStaffName: 'Visa Operations Desk',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }, user);

    setInquirySubmitted(true);
    setTimeout(() => {
      setInquirySubmitted(false);
      setInquiryModalVisa(null);
    }, 2500);
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-16">
      {/* 1. Compact Unified Hero Section */}
      <div className="w-full bg-[#061329] text-white relative overflow-hidden border-b border-slate-800 mb-8 sm:mb-10">
        {/* Subtle dot matrix grid pattern */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-20" 
          style={{
            backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.2) 1px, transparent 1px)',
            backgroundSize: '20px 20px'
          }}
        />

        {/* Inner Hero Content Container */}
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 sm:pt-14 pb-8 sm:pb-10 relative z-10 text-center flex flex-col items-center">
          {/* Top Pill Tag */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[11px] font-bold tracking-wider text-teal-300 bg-teal-950/60 border border-teal-500/30 uppercase mb-4 shadow-xs">
            <span className="w-1.5 h-1.5 rounded-full bg-[#00C6A6] animate-pulse" />
            <span>ESTABLISHED IN 2025 • CONSULAR VERIFICATION & VISA OPERATIONS</span>
          </div>

          {/* Main Display Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-white leading-tight uppercase max-w-3xl mx-auto mb-3">
            GLOBAL VISA OPERATIONS SIMPLIFIED BY <span className="text-[#00C6A6]">INTELLIGENCE.</span>
          </h1>

          {/* Subheading */}
          <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal mb-6">
            Curated consular requirements, verified document checklists, fast-track processing, and dedicated B2B lodging assistance across Japan, UK, Schengen Europe, and Southeast Asia.
          </p>

          {/* Action CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md mx-auto">
            <button
              id="visa-explore-packages-btn"
              onClick={() => {
                const el = document.getElementById('visa-search-filter-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
            >
              <span>BROWSE VISA REQUIREMENTS</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="visa-partner-btn"
              onClick={() => navigateTo('/b2b/quote-builder')}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
            >
              <span>BECOME A PARTNER</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Unified Operational Trust Strip */}
        <HeroTrustStrip />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        {/* Search & Filter Bar */}
        <div id="visa-search-filter-section" className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search destination country, visa category, or processing criteria..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#008972]"
            />
          </div>

          <select
            value={selectedCountry}
            onChange={e => setSelectedCountry(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 bg-white"
          >
            <option value="all">All Destinations</option>
            {countries.map(c => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        {/* Visas Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredVisas.map(visa => (
            <div 
              key={visa.id} 
              className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between"
            >
              <div>
                <div className="h-44 relative overflow-hidden bg-slate-100">
                  <img
                    src={visa.heroImage}
                    alt={visa.country}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-transparent to-transparent" />
                  
                  <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-xs text-slate-900 text-[10px] font-bold px-2.5 py-1 rounded-full flex items-center space-x-1">
                    <Globe2 className="w-3 h-3 text-[#008972]" />
                    <span>{visa.country}</span>
                  </div>

                  <div className="absolute bottom-3 left-3 right-3 text-white">
                    <span className="text-[10px] uppercase font-bold tracking-wider text-[#00C6A6] block mb-0.5">
                      {visa.entryType ? visa.entryType.replace('_', ' ') : 'Standard'}
                    </span>
                    <h3 className="text-base font-bold leading-tight">
                      {visa.visaType}
                    </h3>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                    {visa.description}
                  </p>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Processing</span>
                      <span className="font-bold text-slate-800 flex items-center space-x-1 mt-0.5">
                        <Clock className="w-3.5 h-3.5 text-[#008972]" />
                        <span>{visa.processingTimeDays} Days</span>
                      </span>
                    </div>

                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Stay Window</span>
                      <span className="font-bold text-slate-800 block mt-0.5">
                        {visa.stayDurationDays} Days Stay
                      </span>
                    </div>
                  </div>

                  <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-emerald-800 block">Net Package Fee</span>
                      <span className="text-lg font-mono font-extrabold text-slate-900">
                        {visa.currency || 'USD'} {((Number(visa.embassyFee) || 0) + (Number(visa.serviceFee) || 0)).toLocaleString()}
                      </span>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      Embassy + Scrutiny
                    </span>
                  </div>

                  {/* Checklist snippet */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">
                      Documents Checklist ({(visa.documentsChecklist || []).length})
                    </span>
                    <ul className="text-xs text-slate-700 space-y-1">
                      {(visa.documentsChecklist || []).slice(0, 3).map((doc, idx) => (
                        <li key={idx} className="flex items-start space-x-1.5">
                          <CheckSquare className="w-3.5 h-3.5 text-[#008972] shrink-0 mt-0.5" />
                          <span className="line-clamp-1">{doc}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div className="p-5 pt-0 border-t border-slate-100 mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={() => handleDownloadChecklist(visa)}
                  className="flex items-center justify-center space-x-1.5 p-2.5 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5 text-[#00C6A6]" />
                  <span>Download Checklist</span>
                </button>

                <button
                  onClick={() => setInquiryModalVisa(visa)}
                  className="flex items-center justify-center space-x-1.5 p-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 text-xs font-bold transition-colors cursor-pointer shadow-xs active:scale-95"
                >
                  <span>Apply / Inquire</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Final Conversion Section */}
        <FinalCTA
          title="EXPEDITE YOUR CLIENT VISA PROCESSING"
          subtitle="Partner with TheUnbound consular operations for end-to-end embassy appointment scheduling, verified documentation vetting, and consolidated B2B billing."
          primaryButtonText="BECOME A TRADE PARTNER"
          primaryButtonLink="/b2b/quote-builder"
        />

        {/* Visa Inquiry Modal */}
        {inquiryModalVisa && (
          <div className="fixed inset-0 z-50 bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div>
                  <h3 className="text-base font-bold text-slate-900">
                    Visa Assistance: {inquiryModalVisa.country}
                  </h3>
                  <p className="text-xs text-slate-500">{inquiryModalVisa.visaType}</p>
                </div>
                <button
                  onClick={() => setInquiryModalVisa(null)}
                  className="text-slate-400 hover:text-slate-600 text-sm font-bold"
                >
                  ✕
                </button>
              </div>

              {inquirySubmitted ? (
                <div className="p-6 text-center space-y-3 bg-emerald-50 rounded-2xl border border-emerald-200">
                  <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
                  <h4 className="text-base font-bold text-emerald-900">Application Lead Submitted!</h4>
                  <p className="text-xs text-emerald-700">
                    Our consular operations desk will review your requirements and send official document submission forms within 2 working hours.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleSendInquiry} className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Lead Contact Name *
                    </label>
                    <input
                      type="text"
                      required
                      value={inquiryName}
                      onChange={e => setInquiryName(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                      placeholder="Agent or Traveler full name"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        required
                        value={inquiryEmail}
                        onChange={e => setInquiryEmail(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                        placeholder="agent@agency.com"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Phone / WhatsApp *
                      </label>
                      <input
                        type="tel"
                        required
                        value={inquiryPhone}
                        onChange={e => setInquiryPhone(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                        placeholder="+1 555 0192"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Number of Travelers
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={inquiryTravelers}
                        onChange={e => setInquiryTravelers(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 font-mono"
                      />
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                        Estimated Travel Date
                      </label>
                      <input
                        type="date"
                        value={inquiryTravelDate}
                        onChange={e => setInquiryTravelDate(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 uppercase tracking-wider mb-1">
                      Additional Notes / Special Requirements
                    </label>
                    <textarea
                      rows={2}
                      value={inquiryNotes}
                      onChange={e => setInquiryNotes(e.target.value)}
                      placeholder="e.g. Need hotel booking voucher, fast-track appointment, group travelers..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold rounded-xl transition-colors cursor-pointer shadow-xs flex items-center justify-center space-x-2 mt-2 active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Visa Request & Download Forms</span>
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
