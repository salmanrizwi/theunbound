import React, { useState } from 'react';
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
  ExternalLink
} from 'lucide-react';

export const ContactUsPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [company, setCompany] = useState('');
  const [destinationInterest, setDestinationInterest] = useState('Japan');
  const [subject, setSubject] = useState('B2B Partnership & Ground Contract Inquiry');
  const [message, setMessage] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
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

            <div className="space-y-5">
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
                    A-46, Kanchan Kunj, Madanpur Khadar Extn-2
                  </p>
                  <p className="text-xs text-slate-500">
                    New Delhi, India
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
                    href="mailto:sales@theunbound.in" 
                    className="text-xs sm:text-sm font-bold text-slate-900 hover:text-[#008972] transition-colors block font-mono"
                  >
                    sales@theunbound.in
                  </a>
                  <p className="text-[11px] text-slate-500">
                    Average response time: &lt; 2 business hours
                  </p>
                </div>
              </div>

              {/* Phone Numbers */}
              <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="w-9 h-9 rounded-xl bg-emerald-100/60 flex items-center justify-center text-[#008972] shrink-0 mt-0.5">
                  <PhoneCall className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                    Official Head Office Landline & Mobile
                  </span>
                  
                  <div className="pt-0.5 space-y-1.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide w-16">Landline:</span>
                      <a 
                        href="tel:01141185542" 
                        className="text-xs sm:text-sm font-bold text-[#008972] hover:underline transition-colors block font-mono"
                      >
                        011-41185542
                      </a>
                    </div>

                    <div className="flex items-center space-x-2">
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide w-16">Mobile:</span>
                      <div className="flex flex-wrap gap-x-2 gap-y-1">
                        <a 
                          href="tel:+919811654959" 
                          className="text-xs sm:text-sm font-bold text-slate-900 hover:text-[#008972] transition-colors block font-mono"
                        >
                          +91-9811654959
                        </a>
                        <span className="text-slate-300">•</span>
                        <a 
                          href="tel:+919718894959" 
                          className="text-xs sm:text-sm font-bold text-slate-900 hover:text-[#008972] transition-colors block font-mono"
                        >
                          +91-9718894959
                        </a>
                      </div>
                    </div>
                  </div>

                  <p className="text-[11px] text-slate-500 pt-1">
                    Monday to Saturday: 09:00 - 20:00 IST • Instant WhatsApp & Telephony
                  </p>
                </div>
              </div>

              {/* 24/7 Operations Duty */}
              <div className="flex items-start space-x-3.5 p-4 rounded-2xl bg-slate-900 text-white">
                <div className="w-9 h-9 rounded-xl bg-[#00C6A6]/20 flex items-center justify-center text-[#00E5C0] shrink-0 mt-0.5">
                  <Headphones className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-[#00E5C0] block">
                    24/7 Ground Emergency Dispatch
                  </span>
                  <p className="text-xs text-slate-300 leading-relaxed">
                    Live guide dispatch, airport emergency transfers, and in-destination traveler assistance.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Regional Desks */}
          <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-xs space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Regional Operations Hubs
            </h3>
            
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-900 block">Japan Hub</span>
                <span className="text-[10px] text-slate-500">Tokyo & Kyoto</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-900 block">UK Hub</span>
                <span className="text-[10px] text-slate-500">London & Edinburgh</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="font-bold text-slate-900 block">Europe Hub</span>
                <span className="text-[10px] text-slate-500">Paris & Zurich</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive Inquiry Form */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-xs space-y-6">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Send Direct Message or RFP
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Whether you are a B2B travel agent requesting contracted tariffs or a direct client planning a private group journey, our operations team will respond promptly.
              </p>
            </div>

            {isSubmitted ? (
              <div className="p-8 text-center space-y-4 bg-emerald-50 rounded-2xl border border-emerald-200 animate-in fade-in">
                <div className="w-14 h-14 rounded-full bg-[#008972] text-white flex items-center justify-center mx-auto shadow-md">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div className="space-y-1">
                  <h3 className="text-lg font-bold text-slate-900">Inquiry Received Successfully</h3>
                  <p className="text-xs text-slate-600 max-w-md mx-auto">
                    Thank you, {name || 'Partner'}. A senior DMC operations specialist from TheUnbound has received your request and will contact you at <span className="font-bold font-mono text-slate-900">{email || 'your email'}</span> shortly.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setIsSubmitted(false);
                    setMessage('');
                  }}
                  className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
                >
                  Send Another Message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Your Name / Travel Planner *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Elena Rostova"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Email Address *
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="elena@luxurydiscovery.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Phone / WhatsApp Number
                    </label>
                    <input
                      type="tel"
                      placeholder="+44 20 7946 0912"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Agency / Corporate Entity
                    </label>
                    <input
                      type="text"
                      placeholder="Luxury Discovery Travel Partners"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Primary Destination
                    </label>
                    <select
                      value={destinationInterest}
                      onChange={(e) => setDestinationInterest(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    >
                      <option value="Japan">Japan (Tokyo, Kyoto, Osaka, Hokkaido)</option>
                      <option value="United Kingdom">United Kingdom (London, Scotland, Cotswolds)</option>
                      <option value="Europe">Continental Europe (France, Switzerland, Italy)</option>
                      <option value="Multi-Destination">Multi-Destination Package</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">
                      Inquiry Subject
                    </label>
                    <select
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                    >
                      <option value="B2B Partnership & Ground Contract Inquiry">B2B Partnership & Tariff Contract</option>
                      <option value="Custom Group Itinerary Proposal">Custom Group Itinerary Proposal</option>
                      <option value="Roster & Guide Allocation Request">Roster & Guide Allocation Request</option>
                      <option value="Active Booking Assistance">Active Booking Assistance</option>
                      <option value="General Information">General Information</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Your Requirements & Itinerary Notes *
                  </label>
                  <textarea
                    required
                    rows={4}
                    placeholder="Provide details on tentative travel dates, estimated pax count, preferred hotel tier, vehicle specifications, or specific private experiences needed..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 text-xs text-slate-900 focus:bg-white focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="w-full sm:w-auto px-8 py-3 bg-[#00C6A6] hover:bg-[#008972] text-slate-950 font-extrabold rounded-xl text-xs transition-all shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 cursor-pointer"
                  >
                    <Send className="w-4 h-4" />
                    <span>Submit Inquiry to TheUnbound DMC</span>
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
