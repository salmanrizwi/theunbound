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
  Building2,
  Lock
} from 'lucide-react';

export const TermsOfPolicyPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <Scale className="w-3.5 h-3.5" />
            <span>Commercial Contract & Operating Governance</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight text-white">
            Terms of Service & DMC Ground Agreement
          </h1>

          <p className="text-xs sm:text-sm text-slate-300">
            Effective Date: August 2026 • Governing Legal Entity: Unbound Experiences India Pvt Ltd
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        {/* Section 1: Preamble & Operating Parties */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#008972]" />
            <span>1. Preamble & Operating Parties</span>
          </h2>
          <p>
            These Terms of Service ("Agreement", "Terms") constitute a legally binding contract between <strong className="text-slate-900">Unbound Experiences India Pvt Ltd</strong> ("TheUnbound", "DMC", "We", "Us", or "Company"), located at <span className="font-semibold text-slate-900">A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India</span>, and any authorized B2B travel agency, corporate buyer, tour operator, or individual traveler ("Client", "Partner", "Booker", or "Guest") utilizing our ground tour products, chauffeur transfers, private guiding, hotel allotments, rail passes, and bespoke itineraries across Japan, the United Kingdom, and Europe.
          </p>
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs font-mono text-slate-500">
            Corporate Identification: [CORPORATE_IDENTIFICATION_NUMBER_CIN] • Goods and Services Tax: [GSTIN]
          </div>
        </section>

        {/* Section 2: Scope of Ground DMC Services */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Globe2 className="w-5 h-5 text-[#008972]" />
            <span>2. Scope of Services & Consular Facilitation Disclaimer</span>
          </h2>
          <p>
            TheUnbound acts as a specialized wholesale Destination Management Company coordinating ground transport, licensed regional guides, experiential activities, and hotel arrangements.
          </p>
          <div className="p-4 rounded-2xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 space-y-2">
            <div className="font-bold flex items-center space-x-2 text-amber-950">
              <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
              <span>Important Consular Visa Disclaimer</span>
            </div>
            <p className="leading-relaxed">
              Where TheUnbound provides visa assistance (such as Japan Tourist E-Visa checklists, UK Standard Visitor Visa templates, or Schengen appointment guidance), our role is strictly limited to administrative document collation and advisory facilitation. The decision to grant, delay, or deny any travel visa or transit permit rests exclusively with the sovereign government, embassy, high commission, or consulate concerned. TheUnbound assumes no liability for consular delays, visa refusals, or associated non-refundable losses.
            </p>
          </div>
        </section>

        {/* Section 3: Quotations & 14-Day Rate Guarantees */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Calendar className="w-5 h-5 text-[#008972]" />
            <span>3. Quotations, Pricing & 14-Day Rate Guarantees</span>
          </h2>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong className="text-slate-900">14-Day Price Lock:</strong> Official wholesale B2B proposals and customized quotations issued through our platform remain locked and guaranteed for <span className="font-bold text-emerald-800">fourteen (14) calendar days</span> from the timestamp of generation.
            </li>
            <li>
              <strong className="text-slate-900">Currency & Exchange Rates:</strong> Quotations may be billed in USD, JPY, GBP, EUR, or INR. In the event of extraordinary currency devaluations exceeding 5% between quotation generation and deposit settlement, TheUnbound reserves the right to adjust wholesale tariffs to reflect actual interbank settlement costs.
            </li>
            <li>
              <strong className="text-slate-900">Statutory Taxes & Inclusions:</strong> Unless otherwise stated in writing, all itemized quotations explicitly specify applicable local VAT, city tourist taxes, guide allowances, and vehicle highway tolls.
            </li>
          </ul>
        </section>

        {/* Section 4: Booking Confirmation & Payment Protocols */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CreditCard className="w-5 h-5 text-[#008972]" />
            <span>4. Booking Confirmation & Payment Protocols</span>
          </h2>
          <p>
            A booking is formally confirmed only when TheUnbound issues an official Ground Operations Voucher following receipt of the designated deposit:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider text-[#008972]">Standard FIT & Private Group Tours</span>
              <p className="text-xs text-slate-600">
                <strong>25% deposit</strong> upon voucher confirmation; <strong>75% balance</strong> due no later than thirty (30) days prior to the first scheduled ground service.
              </p>
            </div>
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block text-xs uppercase tracking-wider text-[#008972]">Peak Seasons & Yacht/Vehicle Charters</span>
              <p className="text-xs text-slate-600">
                <strong>50% deposit</strong> upon confirmation for high-peak dates (e.g. Japan Cherry Blossom / Sakura, Golden Week, Royal Ascot, Wimbledon, New Year's) and private yacht/coach charters.
              </p>
            </div>
          </div>
        </section>

        {/* Section 5: Supplier Allocation & Substitutions */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#008972]" />
            <span>5. Ground Supplier Allocation & Service Quality</span>
          </h2>
          <p>
            TheUnbound reserves the right to allocate licensed chauffeurs, certified English-speaking guides, and vetted transport fleets that satisfy our quality standards. If an allocated resource becomes unavailable due to mechanical failure or guide illness, TheUnbound guarantees an equivalent or upgraded tier replacement at no additional charge to the client.
          </p>
        </section>

        {/* Section 6: Force Majeure */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-[#008972]" />
            <span>6. Force Majeure & Severe Weather Exceptions</span>
          </h2>
          <p>
            Neither party shall be liable for non-performance or delays resulting from acts of God, earthquakes, typhoons, volcanic eruptions, epidemics, government transit shutdowns, war, or civil disturbance. In such events, TheUnbound will actively negotiate supplier waivers, rebooking credits, and alternative ground logistics to protect our partners' capital.
          </p>
        </section>

        {/* Section 7: Intellectual Property */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Lock className="w-5 h-5 text-[#008972]" />
            <span>7. Intellectual Property & Confidential B2B Tariffs</span>
          </h2>
          <p>
            All custom itinerary designs, wholesale price sheets, portal software, brand marks, and technical systems are the proprietary intellectual property of <strong className="text-slate-900">Unbound Experiences India Pvt Ltd</strong>. B2B travel partners agree to treat wholesale net tariffs as strictly confidential commercial information and refrain from publicly displaying wholesale net rates without authorized retail markup.
          </p>
        </section>

        {/* Section 8: Governing Law & Jurisdiction */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Scale className="w-5 h-5 text-[#008972]" />
            <span>8. Governing Law & Dispute Resolution</span>
          </h2>
          <p>
            This Agreement shall be governed by and construed in accordance with the substantive laws of <strong className="text-slate-900">India</strong>. Any dispute, controversy, or claim arising out of or relating to this Agreement shall be referred to and finally resolved by arbitration in New Delhi, India, under the Indian Arbitration and Conciliation Act, 1996. The courts situated at <strong className="text-slate-900">New Delhi, India</strong> shall possess exclusive territorial jurisdiction over any legal proceedings.
          </p>
        </section>

        {/* Contact info footer */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
          <p className="font-bold text-slate-700">Legal Department & Contract Inquiries:</p>
          <p>
            Unbound Experiences India Pvt Ltd • Address: A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India • Email: <a href="mailto:business@theunbound.in" className="text-[#008972] font-semibold underline">business@theunbound.in</a> • Operations: <a href="mailto:sales@theunbound.in" className="text-[#008972] font-semibold underline">sales@theunbound.in</a>
          </p>
          <p>
            Phone: Landline 011-41185542 • Mobile: +91-9811654959, +91-9718894959
          </p>
        </div>
      </div>
    </div>
  );
};
