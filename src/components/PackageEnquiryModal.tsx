import React, { useState } from 'react';
import { B2BPackage, CurrencyCode, User } from '../types';
import { AppDatabase } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { formatCurrency, convertCurrency } from '../services/pricingEngine';
import { 
  X, 
  Send, 
  CheckCircle2, 
  MapPin, 
  Calendar, 
  Users, 
  Mail, 
  Phone, 
  User as UserIcon, 
  Sparkles, 
  Clock, 
  Hotel, 
  Car, 
  MessageSquare,
  ShieldCheck,
  PhoneCall
} from 'lucide-react';

interface PackageEnquiryModalProps {
  packageItem: B2BPackage;
  onClose: () => void;
  currency?: CurrencyCode;
}

export const PackageEnquiryModal: React.FC<PackageEnquiryModalProps> = ({
  packageItem,
  onClose,
  currency = 'USD'
}) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [phone, setPhone] = useState('+91-');
  const [travelMonth, setTravelMonth] = useState('');
  const [adults, setAdults] = useState(2);
  const [children, setChildren] = useState(0);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [submittedLeadNumber, setSubmittedLeadNumber] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const durationText = `${packageItem.durationNights || (packageItem.durationDays - 1)}N / ${packageItem.durationDays}D`;
  const baseNet = packageItem.baseNetCostUSD || 2500;
  const retailPriceUSD = packageItem.suggestedSellingPriceUSD || Math.round(baseNet * 1.3);
  const displayPrice = convertCurrency(retailPriceUSD, 'USD', currency);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!name.trim()) {
      setErrorMessage('Please enter your full name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (!phone.trim() || phone.length < 7) {
      setErrorMessage('Please enter a valid contact phone or WhatsApp number.');
      return;
    }

    setIsSubmitting(true);

    try {
      const requirements = [
        `Enquiry for Ready-Made Package: ${packageItem.title} (${durationText})`,
        `Route: ${(packageItem.routeSummary || []).join(' → ')}`,
        `Preferred Travel Period: ${travelMonth || 'Flexible'}`,
        `Travelers: ${adults} Adults, ${children} Children`,
        `Package Starting Price: ${formatCurrency(displayPrice, currency)} / pax`,
        message.trim() ? `Customer Notes: ${message.trim()}` : ''
      ].filter(Boolean).join('\n');

      const lead = db.captureLeadFromSource({
        contactName: name.trim(),
        email: email.trim(),
        phone: phone.trim(),
        source: 'PACKAGE_INQUIRY',
        destinationName: packageItem.destinationName,
        travelDates: travelMonth || 'Flexible / Upcoming Season',
        estimatedBudget: displayPrice * adults,
        travelRequirements: requirements
      }, user || null);

      setSubmittedLeadNumber(lead.leadNumber);
      setIsSubmitting(false);
      setIsSubmitted(true);
    } catch (err) {
      console.error('Failed to submit package enquiry:', err);
      setErrorMessage('Unable to submit your enquiry right now. Please try again or reach us directly.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl sm:rounded-3xl max-w-xl w-full my-auto shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[94dvh] sm:max-h-[90vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b border-slate-800">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#008972] text-white flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-[#00C6A6] bg-[#00C6A6]/10 px-2 py-0.5 rounded-md">
                  Package Enquiry
                </span>
                <span className="text-xs text-slate-400 font-semibold">
                  {packageItem.destinationName}
                </span>
              </div>
              <h3 className="text-base font-black text-white mt-0.5 line-clamp-1">
                {packageItem.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Content */}
        {isSubmitted ? (
          <div className="p-6 overflow-y-auto space-y-5 flex-1 modal-body-scroll text-xs">
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-50 text-[#008972] mx-auto flex items-center justify-center border-2 border-emerald-200 shadow-sm">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h4 className="text-lg font-black text-slate-900">Enquiry Received Successfully!</h4>
                <p className="text-xs text-slate-600 mt-1 max-w-md mx-auto">
                  Thank you, <strong>{name}</strong>. Our dedicated {packageItem.destinationName} destination specialist has received your inquiry for <strong>{packageItem.title}</strong>.
                </p>
                {submittedLeadNumber && (
                  <div className="mt-3 inline-block px-3 py-1 bg-slate-100 rounded-xl text-xs font-mono font-bold text-slate-700">
                    Reference ID: {submittedLeadNumber}
                  </div>
                )}
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 text-left space-y-2 text-xs text-slate-700">
                <div className="flex items-center space-x-2 text-slate-900 font-bold">
                  <Clock className="w-4 h-4 text-[#008972]" />
                  <span>What happens next?</span>
                </div>
                <ul className="space-y-1.5 text-slate-600 pl-6 list-disc text-[11px]">
                  <li>Our ground operations team will review seasonal hotel allotments and private transit routes.</li>
                  <li>You will receive a personalized tour proposal and quotation at <strong>{email}</strong> within 4 to 12 business hours.</li>
                  <li>For urgent departure queries, you can also reach our 24/7 hotline at <strong>+91-9811654959</strong>.</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all cursor-pointer"
              >
                Close & Return to Tour Circuits
              </button>
            </div>
          </div>
        ) : (
            <form onSubmit={handleSubmit} className="flex-1 flex flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 modal-body-scroll text-xs">
                {/* Package Summary Card */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-2xl flex items-center justify-between text-xs">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-extrabold text-slate-900">{packageItem.title}</span>
                  </div>
                  <div className="flex items-center space-x-3 text-[11px] text-slate-500">
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-[#008972]" />
                      <span>{durationText}</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <MapPin className="w-3.5 h-3.5 text-[#008972]" />
                      <span>{packageItem.destinationName}</span>
                    </span>
                  </div>
                </div>

                <div className="text-right shrink-0 pl-2">
                  <span className="text-[10px] text-slate-400 font-bold uppercase block">Starting From</span>
                  <span className="text-sm font-black text-slate-900 font-mono">
                    {formatCurrency(displayPrice, currency)}
                  </span>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              {/* Form Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Your Full Name *
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. Alexander Wright"
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#008972] outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@example.com"
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#008972] outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Phone / WhatsApp Number *
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+91-9876543210"
                      required
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#008972] outline-none font-medium"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Preferred Travel Month / Dates
                  </label>
                  <div className="relative">
                    <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      value={travelMonth}
                      onChange={(e) => setTravelMonth(e.target.value)}
                      placeholder="e.g. October 2026 / Autumn"
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#008972] outline-none font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Guest Counts */}
              <div className="grid grid-cols-2 gap-3.5">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Adults (12+ yrs)</label>
                  <select
                    value={adults}
                    onChange={(e) => setAdults(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold outline-none"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(n => (
                      <option key={n} value={n}>{n} {n === 1 ? 'Adult' : 'Adults'}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Children (2-11 yrs)</label>
                  <select
                    value={children}
                    onChange={(e) => setChildren(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 font-bold outline-none"
                  >
                    {[0, 1, 2, 3, 4, 5].map(n => (
                      <option key={n} value={n}>{n} Children</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Special Notes */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">
                  Custom Preferences or Questions (Optional)
                </label>
                <textarea
                  rows={3}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Mention any specific rooming preferences (e.g. Twin beds, Ryokan onsen suite), dietary requirements, or flight timings..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:bg-white focus:border-[#008972] outline-none leading-relaxed"
                />
              </div>

                {/* Security & Response Guarantee */}
                <div className="flex items-center space-x-2 text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl border border-slate-200/80">
                  <ShieldCheck className="w-4 h-4 text-[#008972] shrink-0" />
                  <span>Direct DMC Contract Rates • 100% Verified Accommodations • No spam policy</span>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-4 sm:px-6 py-3 border-t border-slate-200 bg-slate-50 shrink-0 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer text-center active:scale-95"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-5 sm:px-6 py-2.5 rounded-xl bg-[#008972] hover:bg-[#007360] active:bg-[#005f50] text-white text-xs font-black transition-all cursor-pointer shadow-xs flex items-center justify-center space-x-2 disabled:opacity-50 active:scale-95"
                >
                  <Send className="w-4 h-4" />
                  <span>{isSubmitting ? 'Sending Enquiry...' : 'Submit Package Enquiry'}</span>
                </button>
              </div>
            </form>
          )}
      </div>
    </div>
  );
};
