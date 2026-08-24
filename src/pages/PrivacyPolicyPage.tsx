import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  Database, 
  UserCheck, 
  FileCheck, 
  Building2, 
  Globe2 
} from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <Lock className="w-3.5 h-3.5" />
            <span>Data Protection & GDPR / International Compliance</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight text-white">
            Privacy Policy & Data Security
          </h1>

          <p className="text-xs sm:text-sm text-slate-300">
            Effective Date: August 2026 • TheUnbound Destination Management Company
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        {/* Section 1 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Eye className="w-5 h-5 text-[#008972]" />
            <span>1. Information We Collect</span>
          </h2>
          <p>
            At <strong className="text-slate-900">TheUnbound</strong>, safeguarding the privacy of our travel agents, corporate partners, and traveling guests is fundamental. We collect only information essential to dispatching luxury travel services:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong className="text-slate-900">Agent & Account Information:</strong> Name, agency brand, business email, telephone numbers, and billing preferences.</li>
            <li><strong className="text-slate-900">Traveler Logistics Details:</strong> Passport names, flight numbers, dietary requirements, and mobility needs required for private transfers, guide coordination, and hotel check-in.</li>
            <li><strong className="text-slate-900">Transaction & Quotation Records:</strong> Itinerary history, SKU selections, quote timestamps, and payment transaction IDs.</li>
          </ul>
        </section>

        {/* Section 2 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Database className="w-5 h-5 text-[#008972]" />
            <span>2. How We Use and Process Your Data</span>
          </h2>
          <p>
            Collected data is utilized strictly to:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Service Execution</span>
              <p className="text-xs text-slate-600">Dispatching private vehicles, ticketing trains (Shinkansen/Eurostar), and reserving VIP experiences.</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">24/7 Safety Dispatch</span>
              <p className="text-xs text-slate-600">Contacting clients during itinerary updates or emergency in-destination logistics.</p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-1">Financial Reconciliation</span>
              <p className="text-xs text-slate-600">Issuing formal B2B wholesale invoices, VAT receipts, and commission settlements.</p>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-[#008972]" />
            <span>3. Sharing with Ground Suppliers</span>
          </h2>
          <p>
            We share only relevant traveler details with vetted suppliers on our roster (e.g. providing passenger names to private chauffeurs, hotel concierges, and certified regional guides). We never sell, lease, or monetize client personal data to third-party marketers under any circumstances.
          </p>
        </section>

        {/* Section 4 */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#008972]" />
            <span>4. Security & Data Retention</span>
          </h2>
          <p>
            All quote data, API tokens, and operational records are transmitted via SSL/TLS 256-bit encryption. Access is restricted exclusively to authorized operations leads at TheUnbound.
          </p>
        </section>

        {/* Contact info footer */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-1">
          <p className="font-bold text-slate-700">Data Protection Officer:</p>
          <p>TheUnbound Privacy Compliance • Address: A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India • Email: <a href="mailto:sales@theunbound.in" className="text-[#008972] font-semibold underline">sales@theunbound.in</a></p>
        </div>
      </div>
    </div>
  );
};
