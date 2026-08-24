import React from 'react';
import { 
  RotateCcw, 
  CalendarCheck, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  CreditCard,
  Building2,
  Clock
} from 'lucide-react';

export const RefundPolicyPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Transparent Cancellation & Refund Framework</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight text-white">
            Refund & Cancellation Policy
          </h1>

          <p className="text-xs sm:text-sm text-slate-300">
            Clear timelines, cancellation windows, and reimbursement terms for ground arrangements with TheUnbound DMC.
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        {/* Tier Matrix */}
        <section className="space-y-4">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-[#008972]" />
            <span>1. Standard FIT & Private Itinerary Cancellation Schedule</span>
          </h2>
          <p>
            Cancellations must be communicated in writing via email to <strong className="text-slate-900">sales@theunbound.in</strong> by the booking agent or principal lead. Refund percentages are calculated based on calendar days prior to the first scheduled service date:
          </p>

          <div className="overflow-x-auto border border-slate-200 rounded-2xl">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-900 font-bold">
                  <th className="p-3.5">Cancellation Notice Period</th>
                  <th className="p-3.5">DMC Cancellation Fee</th>
                  <th className="p-3.5">Eligible Refund Percentage</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="p-3.5 font-bold text-slate-900">30 or more days prior to arrival</td>
                  <td className="p-3.5 text-slate-600">Administrative processing fee (5%)</td>
                  <td className="p-3.5 font-bold text-emerald-700">95% Full Refund</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900">15 to 29 days prior to arrival</td>
                  <td className="p-3.5 text-slate-600">25% of total itinerary value</td>
                  <td className="p-3.5 font-bold text-emerald-700">75% Refund</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900">8 to 14 days prior to arrival</td>
                  <td className="p-3.5 text-slate-600">50% of total itinerary value</td>
                  <td className="p-3.5 font-bold text-amber-700">50% Refund</td>
                </tr>
                <tr>
                  <td className="p-3.5 font-bold text-slate-900">7 days or fewer / No Show</td>
                  <td className="p-3.5 text-slate-600">100% of itinerary value</td>
                  <td className="p-3.5 font-bold text-rose-700">Non-refundable</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Non-Refundable Items */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <AlertTriangle className="w-5 h-5 text-[#008972]" />
            <span>2. Strict Supplier Non-Refundable Inclusions</span>
          </h2>
          <p>
            Certain exclusive VIP reservations and transit products are issued under 100% non-refundable conditions upon issuance, regardless of cancellation notice:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li>Issued high-speed bullet train passes (e.g. JR Green Car passes, Eurostar Premier tickets).</li>
            <li>Restricted special admission permits (e.g. Kyoto Imperial Villa access, Ghibli Museum, private museum closures).</li>
            <li>Non-refundable luxury boutique hotel deposit policies during peak seasons.</li>
          </ul>
        </section>

        {/* Processing Timelines */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-[#008972]" />
            <span>3. Refund Processing Timelines & Methods</span>
          </h2>
          <p>
            All approved refunds are processed within <strong className="text-slate-900">5 to 7 business days</strong> following formal cancellation verification. Funds are returned strictly via the original transaction channel (B2B wire transfer or authorized payment gateway).
          </p>
        </section>

        {/* Modifications & Date Shifts */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-[#008972]" />
            <span>4. Itinerary Amendments & Date Transfers</span>
          </h2>
          <p>
            We strive to offer maximum flexibility for our partners. Date shifts requested more than 14 days prior to departure can usually be accommodated with zero penalty fees, subject only to guide availability and seasonal hotel rate differentials.
          </p>
        </section>

        {/* Contact info footer */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-bold text-slate-700">Refund Claims & Dispute Department:</p>
          <p>TheUnbound Accounts & Operations • Address: A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India • Email: <a href="mailto:sales@theunbound.in" className="text-[#008972] font-semibold underline">sales@theunbound.in</a> • Landline: <a href="tel:01141185542" className="text-slate-700 font-semibold underline">011-41185542</a> • Mobile: +91-9811654959, +91-9718894959</p>
        </div>
      </div>
    </div>
  );
};
