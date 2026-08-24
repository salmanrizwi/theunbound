import React from 'react';
import { 
  FileText, 
  ShieldCheck, 
  AlertCircle, 
  CheckCircle2, 
  Scale, 
  Globe2, 
  Calendar, 
  CreditCard, 
  Building2 
} from 'lucide-react';

export const TermsOfPolicyPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <Scale className="w-3.5 h-3.5" />
            <span>Legal Governance & Contract Protocols</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight text-white">
            Terms of Policy & DMC Ground Agreement
          </h1>

          <p className="text-xs sm:text-sm text-slate-300">
            Last Updated: August 2026 • Governing Entity: TheUnbound Destination Management Company
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        {/* Intro */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#008972]" />
            <span>1. Preamble & Operating Parties</span>
          </h2>
          <p>
            This agreement is entered into between <strong className="text-slate-900">TheUnbound</strong> ("DMC", "We", "Our", or "Company"), located at <span className="font-semibold text-slate-900">A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India</span>, and any authorized B2B travel agency, corporate buyer, or individual traveler ("Client", "Agent", or "Guest") utilizing our ground tour products, transfers, private guiding, and bespoke itineraries across Japan, the United Kingdom, and Europe.
          </p>
        </section>

        {/* Quotation & Price Validity */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#008972]" />
            <span>2. Quotations, Pricing & 14-Day Rate Guarantees</span>
          </h2>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li>
              <strong className="text-slate-900">Validity Window:</strong> All official B2B wholesale quotations and customized group proposals issued through our system remain locked and guaranteed for <span className="font-bold text-emerald-800">fourteen (14) calendar days</span> from the date of generation.
            </li>
            <li>
              <strong className="text-slate-900">Currency & Exchange Rates:</strong> Quotations are generated in the agreed billing currency (USD, JPY, GBP, EUR, INR). Fluctuations exceeding 5% prior to deposit confirmation may result in adjusted wholesale tariffs.
            </li>
            <li>
              <strong className="text-slate-900">Inclusions:</strong> All quotations explicitly itemize local city taxes, VAT, national park admissions, and chauffeur vehicle allowances as detailed on the itinerary document.
            </li>
          </ul>
        </section>

        {/* Booking Confirmation & Payment Schedule */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-[#008972]" />
            <span>3. Booking Confirmation & Payment Protocols</span>
          </h2>
          <p>
            A booking is formally confirmed once TheUnbound issues a confirmed ground operations voucher following receipt of the required deposit:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Standard FIT Bookings</span>
              <p className="text-xs text-slate-600">
                25% non-refundable deposit upon confirmation; 75% final balance due 30 days prior to ground arrival.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Charter & High-Peak Bookings</span>
              <p className="text-xs text-slate-600">
                50% deposit upon confirmation for cherry blossom season (Japan), Royal Ascot / Wimbledon (UK), or high summer charters.
              </p>
            </div>
          </div>
        </section>

        {/* Ground Operations & Supplier Roster */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#008972]" />
            <span>4. Supplier Allocation & Ground Resource Execution</span>
          </h2>
          <p>
            TheUnbound reserves the right to assign certified, English-speaking professional guides, vetted chauffeurs, and luxury transport partners matching the contracted specifications. In the unforeseen event of equipment maintenance or certified guide unavailability, an equivalent or upgraded tier resource will be dispatched at no extra cost to the partner.
          </p>
        </section>

        {/* Force Majeure */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-[#008972]" />
            <span>5. Force Majeure & Severe Weather Exceptions</span>
          </h2>
          <p>
            Neither party shall be liable for failure to perform ground obligations if prevented by acts of God, typhoons, volcanic activity, natural disasters, epidemics, civil unrest, or official governmental transit shutdowns. In such instances, TheUnbound will negotiate immediate supplier credits and rebooking waivers to protect client investments.
          </p>
        </section>

        {/* Contact info footer */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-bold text-slate-700">For Legal Inquiries & Contract Amendments:</p>
          <p>TheUnbound DMC Legal Desk • Email: <a href="mailto:sales@theunbound.in" className="text-[#008972] font-semibold underline">sales@theunbound.in</a> • Landline: <a href="tel:01141185542" className="text-slate-700 font-semibold underline">011-41185542</a> • Mobile: +91-9811654959, +91-9718894959</p>
        </div>
      </div>
    </div>
  );
};
