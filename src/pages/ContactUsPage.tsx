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
  Sparkles
} from 'lucide-react';
import { AppDatabase } from '../services/db';
import { TravelLead, SitePagesConfig } from '../types';

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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12 animate-in fade-in duration-200">
      {/* Page Hero */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-12 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="absolute top-0 right-0 w-96 h-96 bg-[#00C6A6]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
        
        <div className="max-w-3xl relative z-10 space-y-4">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <Globe2 className="w-3.5 h-3.5" />
            <span>TheUnbound Global DMC Network</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight text-white">
            Get in Touch with Our Ground Operations
          </h1>

          <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
            Connect directly with TheUnbound Destination Management Company for bespoke travel quotations, wholesale contracted tariffs, guide allocations, and operational support across Japan, United Kingdom, and Europe.
          </p>
        </div>
      </div>

      {/* Main Grid: Contact Cards + Contact Form */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
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
                    className="px-6 py-2.5 bg-[#008972] hover:bg-[#007460] text-white font-bold text-xs rounded-xl transition-all shadow-md flex items-center space-x-2 cursor-pointer"
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
    </div>
  );
};
