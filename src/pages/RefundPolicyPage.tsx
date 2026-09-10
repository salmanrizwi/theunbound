import React from 'react';
import { 
  RotateCcw, 
  CalendarCheck, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  CreditCard,
  Building2,
  Clock,
  ShieldCheck,
  Scale
} from 'lucide-react';

export const RefundPolicyPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Transparent Cancellation & Reimbursement Framework</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight text-white">
            Refund & Cancellation Policy
          </h1>

          <p className="text-xs sm:text-sm text-slate-300">
            Effective Date: August 2026 • Governing Legal Entity: Unbound Experiences India Pvt Ltd
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        {/* Intro */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#008972]" />
            <span>1. Policy Governance & Scope</span>
          </h2>
          <p>
            This Refund & Cancellation Policy governs all bookings confirmed with <strong className="text-slate-900">Unbound Experiences India Pvt Ltd</strong> ("TheUnbound"). We provide explicit cancellation milestones, refund schedules, and timelines to ensure complete clarity for our B2B travel agency partners, corporate buyers, and independent travelers.
          </p>
        </section>

        {/* Tier Matrix */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-[#008972]" />
            <span>2. Standard FIT & Private Tour Cancellation Schedule</span>
          </h2>
          <p>
            Cancellations must be communicated in writing via email to <strong className="text-slate-900">sales@theunbound.in</strong> (with CC to <strong className="text-slate-900">business@theunbound.in</strong>) by the authorized booking agent or principal lead traveler. The effective cancellation date is the timestamp of email receipt during business hours (IST).
          </p>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold">
                  <th className="p-3.5">Written Notice Received</th>
                  <th className="p-3.5">DMC Operational Retention Fee</th>
                  <th className="p-3.5">Eligible Refund Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3.5 font-bold text-slate-900">30 or more calendar days prior to ground arrival</td>
                  <td className="p-3.5 text-slate-600">5% administrative processing fee</td>
                  <td className="p-3.5 font-bold text-emerald-700">95% Full Refund</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900">15 to 29 calendar days prior to ground arrival</td>
                  <td className="p-3.5 text-slate-600">25% of total confirmed itinerary value</td>
                  <td className="p-3.5 font-bold text-emerald-700">75% Refund</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900">8 to 14 calendar days prior to ground arrival</td>
                  <td className="p-3.5 text-slate-600">50% of total confirmed itinerary value</td>
                  <td className="p-3.5 font-bold text-amber-700">50% Refund</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900">7 days or fewer / No-Show</td>
                  <td className="p-3.5 text-slate-600">100% of itinerary value</td>
                  <td className="p-3.5 font-bold text-rose-700">Non-refundable (0%)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Non-Refundable Items */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-[#008972]" />
            <span>3. Strictly Non-Refundable Supplier Inclusions</span>
          </h2>
          <p>
            The cancellation schedule applies to all standard ground logistics. However, certain contracted third-party components are 100% non-refundable immediately upon issuance, irrespective of the cancellation date:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li><strong className="text-slate-900">Issued High-Speed Rail Tickets:</strong> Shinkansen bullet train seat reservations, Japan Rail Passes, and Eurostar Premier tickets once ticketed.</li>
            <li><strong className="text-slate-900">Restricted Special Admission Permits:</strong> Imperial Villa permits (Kyoto), Ghibli Museum passes, private museum after-hours closures, and gala admission tickets.</li>
            <li><strong className="text-slate-900">Peak Season Hotel Guarantees:</strong> Non-refundable hotel deposits for high-peak events (Sakura cherry blossom season, Formula 1, Royal Ascot, New Year's eve).</li>
            <li><strong className="text-slate-900">Government Consular Visa Fees:</strong> Government application fees paid directly to foreign consular portals are non-refundable under all circumstances.</li>
          </ul>
        </section>

        {/* Refund Processing Timelines */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#008972]" />
            <span>4. Refund Processing Timelines & Disbursement</span>
          </h2>
          <p>
            All verified and approved refunds are processed within <strong className="text-slate-900">5 to 7 business days</strong> following written cancellation confirmation. In compliance with international anti-money laundering standards, funds are disbursed strictly via the original payment channel (B2B wire transfer or authorized payment gateway account).
          </p>
        </section>

        {/* Amendments */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-[#008972]" />
            <span>5. Date Transfers & Itinerary Amendments</span>
          </h2>
          <p>
            To accommodate client schedule changes, TheUnbound allows date transfers requested more than fourteen (14) days prior to arrival with zero administrative penalty, subject only to guide availability and seasonal accommodation rate adjustments.
          </p>
        </section>

        {/* Chargeback protocol */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Scale className="w-5 h-5 text-[#008972]" />
            <span>6. Payment Inquiries & Dispute Escalation</span>
          </h2>
          <p>
            B2B partners and travelers agree to contact TheUnbound Accounts & Finance directly at <a href="mailto:business@theunbound.in" className="text-[#008972] font-semibold underline">business@theunbound.in</a> to resolve any billing discrepancy before initiating a chargeback or payment stoppage with financial institutions.
          </p>
        </section>

        {/* Contact info footer */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1.5">
          <p className="font-bold text-slate-700">Accounts, Refunds & Dispute Department:</p>
          <p>
            Unbound Experiences India Pvt Ltd • Address: A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India • Corporate Desk: <a href="mailto:business@theunbound.in" className="text-[#008972] font-semibold underline">business@theunbound.in</a> • Operations Desk: <a href="mailto:sales@theunbound.in" className="text-[#008972] font-semibold underline">sales@theunbound.in</a>
          </p>
          <p className="text-[11px] text-slate-400 font-mono">
            CIN: [CORPORATE_IDENTIFICATION_NUMBER_CIN] • GSTIN: [GSTIN]
          </p>
        </div>
      </div>
    </div>
  );
};
