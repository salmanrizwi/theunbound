import React, { useState, useEffect } from 'react';
import { 
  Mail, 
  Phone, 
  PhoneCall, 
  MapPin, 
  Send, 
  CheckCircle2, 
  Clock, 
  Globe2, 
  MessageSquare, 
  Building2, 
  ShieldCheck,
  Headphones,
  ExternalLink,
  Sparkles,
  Plane,
  Cpu,
  ArrowRight
} from 'lucide-react';
import { AppDatabase } from '../services/db';
import { TravelLead, SitePagesConfig } from '../types';
import { navigateTo } from '../services/portalRouter';
import { HeroTrustStrip } from '../components/Hero/HeroTrustStrip';
import { FinalCTA } from '../components/FinalCTA';

export const ContactUsPage: React.FC = () => {
  const db = AppDatabase.getInstance();
  const [siteConfig, setSiteConfig] = useState<SitePagesConfig>(() => db.getSitePagesConfig());

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [destinationInterest, setDestinationInterest] = useState('Japan');
  const [subject, setSubject] = useState('B2B Partnership & Ground Contract Inquiry');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  useEffect(() => {
    return db.subscribe(() => {
      setSiteConfig(db.getSitePagesConfig());
    });
  }, []);

  const contactData = siteConfig.contact || {
    primaryEmail: 'sales@theunbound.in',
    supportEmail: 'operations@theunbound.in',
    primaryPhone: '+91 98765 43210',
    emergencyPhone: '+81 3 555 0199',
    officeAddress: 'A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India',
    businessHours: 'Monday - Saturday: 09:00 - 20:00 IST / 24x7 On-Tour Emergency'
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    const newLead: TravelLead = {
      id: `lead-contact-${Date.now()}`,
      leadNumber: `LED-MSG-${Math.floor(1000 + Math.random() * 9000)}`,
      contactName: name.trim(),
      email: email.trim(),
      phone: phone.trim() || '',
      agencyName: company.trim() || 'Direct Traveler',
      source: 'CONTACT_FORM',
      status: 'NEW',
      assignedStaffId: 'staff-01',
      assignedStaffName: 'Inbound Operations Desk',
      destinationId: destinationInterest.toLowerCase(),
      destinationName: destinationInterest,
      travelDates: 'Upcoming 2026',
      paxAdults: 2,
      paxChildren: 0,
      estimatedBudget: 5000,
      currency: 'USD',
      travelRequirements: `[${subject}] ${message.trim()}`,
      notes: [
        {
          id: `note-${Date.now()}`,
          authorName: 'Website Contact Form',
          text: `Contact message submitted: "${message.trim()}"`,
          timestamp: new Date().toISOString()
        }
      ],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.saveLead(newLead, null);
    setIsSubmitted(true);
  };

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
            <span>ESTABLISHED IN 2025 • THEUNBOUND OPERATIONS & TRADE DESK</span>
          </div>

          {/* Main Headline */}
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-black font-sans tracking-tight text-white leading-tight uppercase max-w-3xl mx-auto mb-3">
            GROUND OPERATIONS & <span className="text-[#00C6A6]">PARTNERSHIP DESK.</span>
          </h1>

          {/* Subtitle */}
          <p className="text-xs sm:text-sm md:text-base text-slate-300 max-w-2xl mx-auto leading-relaxed font-normal mb-6">
            Connect directly with TheUnbound Destination Management operations for bespoke FIT proposals, wholesale contracted tariffs, guide allocations, and 24/7 on-tour emergency dispatch.
          </p>

          {/* Action CTA Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3 w-full max-w-md mx-auto">
            <button
              id="contact-send-inquiry-btn"
              onClick={() => {
                const el = document.getElementById('contact-form-section');
                if (el) el.scrollIntoView({ behavior: 'smooth' });
              }}
              className="px-6 py-2.5 rounded-xl bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 text-xs sm:text-sm font-bold transition-all shadow-md cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
            >
              <span>SEND AN INQUIRY</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              id="contact-partner-btn"
              onClick={() => navigateTo('/b2b/quote-builder')}
              className="px-6 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white border border-white/20 text-xs sm:text-sm font-semibold transition-all cursor-pointer flex items-center justify-center space-x-2 active:scale-95"
            >
              <span>B2B QUOTATION STUDIO</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-12">
        {/* Main Grid: Contact Cards + Contact Form */}
        <div id="contact-form-section" className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Official Contact Channels */}
        <div className="lg:col-span-5 space-y-6">
          {/* Primary Office Contact Card */}
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
              <Building2 className="w-5 h-5 text-[#008972]" />
              <span>Headquarters & Operational Office</span>
            </h2>

            <div className="space-y-4">
              {/* Address */}
              <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/60 flex items-center justify-center text-[#008972] shrink-0 mt-0.5">
                  <MapPin className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Registered Address
                  </span>
                  <p className="text-xs sm:text-sm font-semibold text-slate-900 leading-relaxed">
                    {contactData.officeAddress}
                  </p>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/60 flex items-center justify-center text-[#008972] shrink-0 mt-0.5">
                  <Mail className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Sales & Quotation Inquiries
                  </span>
                  <a 
                    href={`mailto:${contactData.primaryEmail}`} 
                    className="text-xs sm:text-sm font-bold text-slate-900 hover:text-[#008972] transition-colors block font-mono"
                  >
                    {contactData.primaryEmail}
                  </a>
                  <p className="text-[11px] text-slate-500">
                    Average response SLA: 2–4 hours during business days
                  </p>
                </div>
              </div>

              {/* Support Phone */}
              <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/60 flex items-center justify-center text-[#008972] shrink-0 mt-0.5">
                  <Phone className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Operations Desk Phone
                  </span>
                  <a 
                    href={`tel:${(contactData.primaryPhone || '').replace(/\s+/g, '')}`} 
                    className="text-xs sm:text-sm font-bold text-slate-900 hover:text-[#008972] transition-colors block font-mono"
                  >
                    {contactData.primaryPhone}
                  </a>
                  <p className="text-[11px] text-slate-500">
                    {contactData.businessHours}
                  </p>
                </div>
              </div>

              {/* 24/7 Ground Emergency */}
              <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-emerald-50/50 border border-emerald-200/60">
                <div className="w-9 h-9 rounded-xl bg-[#008972] flex items-center justify-center text-white shrink-0 mt-0.5">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#008972] block">
                    24/7 On-Tour Ground Emergency Hotline
                  </span>
                  <p className="text-xs sm:text-sm font-mono font-bold text-slate-900">
                    {contactData.emergencyPhone}
                  </p>
                  <p className="text-[11px] text-slate-600">
                    Direct dispatch for active travelers currently in destination
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Lead Capture Form */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs">
            {isSubmitted ? (
              <div className="py-12 text-center space-y-4 animate-in fade-in">
                <div className="w-16 h-16 bg-emerald-100 text-[#008972] rounded-full flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 font-sans">
                  Inquiry Dispatched Successfully!
                </h3>
                <p className="text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
                  Thank you, <strong>{name}</strong>. Your inquiry has been routed directly to our destination specialists. We have created CRM Lead record and will reply with tariffs and itinerary details within 2–4 hours.
                </p>
                <div className="pt-4">
                  <button
                    onClick={() => {
                      setIsSubmitted(false);
                      setMessage('');
                    }}
                    className="px-6 py-2.5 bg-slate-900 text-white text-xs font-bold rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
                  >
                    Submit Another Inquiry
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
                    <MessageSquare className="w-5 h-5 text-[#008972]" />
                    <span>Send Us a Proposal Request or Question</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    Fill in your requirements below. Inquiries are instantly captured into our ground operations CRM.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Your Full Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Eleanor Vance"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Official Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. eleanor@horizonluxurytravel.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Phone / WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. +1 415 555 2671"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Agency / Company Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Horizon Travel London"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Target Destination
                    </label>
                    <select
                      value={destinationInterest}
                      onChange={(e) => setDestinationInterest(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    >
                      <option value="Japan">Japan (Tokyo, Kyoto, Osaka, Mt. Fuji)</option>
                      <option value="United Kingdom">United Kingdom (London, Scotland, Cotswolds)</option>
                      <option value="Europe">Europe (France, Italy, Switzerland, Greece)</option>
                      <option value="Multi-Destination">Multi-Destination Bespoke Package</option>
                    </select>
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Inquiry Category
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    >
                      <option value="B2B Partnership & Ground Contract Inquiry">B2B Partnership & Contract Rates</option>
                      <option value="Custom Group Itinerary Proposal">Custom FIT / Group Itinerary Proposal</option>
                      <option value="Hotel & Ryokan Allotments">Hotel & Ryokan Allotment Request</option>
                      <option value="Private Chauffeur & Charter Fleet">Private Chauffeur & Charter Fleet</option>
                      <option value="General Support">General Support / Operational Question</option>
                    </select>
                  </div>
                </div>

                <div className="text-xs">
                  <label className="block font-bold text-slate-700 mb-1">
                    Your Requirements / Travel Brief *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide details about dates, number of guests, preferred luxury tier, special guide languages, or dietary specifications..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div className="pt-2 flex items-center justify-between">
                  <div className="flex items-center space-x-1 text-[11px] text-slate-400">
                    <ShieldCheck className="w-3.5 h-3.5 text-[#008972]" />
                    <span>Instant CRM logging & 100% data privacy guarantee</span>
                  </div>

                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#00C6A6] hover:bg-[#00b296] text-slate-950 font-bold text-xs rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer active:scale-95"
                  >
                    <Send className="w-4 h-4" />
                    <span>Send Proposal Request</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Final Conversion Section */}
      <div className="pt-4 sm:pt-8">
        <FinalCTA
          title="EXPAND YOUR DESTINATION CAPABILITIES"
          subtitle="Partner with TheUnbound for licensed DMC operations, contracted wholesale hotel allocations, and instant customized agent quotes."
          primaryButtonText="BECOME A TRADE PARTNER"
          primaryButtonLink="/b2b/quote-builder"
        />
      </div>
    </div>
  </div>
  );
};
