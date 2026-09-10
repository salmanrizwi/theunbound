import React from 'react';
import { 
  ShieldCheck, 
  Lock, 
  Eye, 
  Database, 
  UserCheck, 
  FileCheck, 
  Building2, 
  Globe2,
  AlertCircle,
  Mail,
  Scale
} from 'lucide-react';

export const PrivacyPolicyPage: React.FC = () => {
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-10 animate-in fade-in duration-200">
      {/* Header */}
      <div className="bg-slate-900 rounded-3xl p-8 sm:p-10 text-white relative overflow-hidden shadow-xl border border-slate-800">
        <div className="max-w-2xl relative z-10 space-y-3">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full text-xs font-bold bg-[#00C6A6]/20 text-[#00E5C0] border border-[#00C6A6]/30">
            <Lock className="w-3.5 h-3.5" />
            <span>GDPR, UK Data Protection Act & India DPDP Act 2023 Compliant</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold font-sans tracking-tight text-white">
            Privacy Policy & Data Protection
          </h1>

          <p className="text-xs sm:text-sm text-slate-300">
            Effective Date: August 2026 • Legal Entity: Unbound Experiences India Pvt Ltd
          </p>
        </div>
      </div>

      {/* Main Content Sections */}
      <div className="bg-white rounded-3xl p-6 sm:p-10 border border-slate-200 shadow-xs space-y-8 text-xs sm:text-sm text-slate-700 leading-relaxed">
        {/* Section 1: Entity & Introduction */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Building2 className="w-5 h-5 text-[#008972]" />
            <span>1. Data Controller & Corporate Information</span>
          </h2>
          <p>
            This Privacy Policy sets out how <strong className="text-slate-900">Unbound Experiences India Pvt Ltd</strong> ("TheUnbound", "we", "our", or "us"), operating as a specialized Destination Management Company (DMC), collects, processes, protects, and retains personal data when you use our web portal, API endpoints, quotation tools, and ground tour services across Japan, the United Kingdom, and Europe.
          </p>
          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1">
            <p><strong className="text-slate-900">Registered Office:</strong> A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India</p>
            <p><strong className="text-slate-900">Corporate Email:</strong> <a href="mailto:business@theunbound.in" className="text-[#008972] font-semibold underline">business@theunbound.in</a></p>
            <p><strong className="text-slate-900">Operations & Booking Inquiries:</strong> <a href="mailto:sales@theunbound.in" className="text-[#008972] font-semibold underline">sales@theunbound.in</a></p>
            <p className="text-[11px] text-slate-500 font-mono pt-1">Corporate Registration: [CORPORATE_IDENTIFICATION_NUMBER_CIN] • Tax ID: [GSTIN]</p>
          </div>
        </section>

        {/* Section 2: Personal Data We Collect */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Eye className="w-5 h-5 text-[#008972]" />
            <span>2. Categories of Personal Data Collected</span>
          </h2>
          <p>
            We collect personal data directly from you when you register an account, build a custom quotation, submit an inquiry, or book an itinerary:
          </p>
          <ul className="list-disc pl-5 space-y-2 text-slate-600">
            <li>
              <strong className="text-slate-900">B2B Trade Partner Credentials:</strong> Name, agency brand, official business email, telephone/WhatsApp number, physical business address, job title, and professional accreditation identifiers (e.g., IATA, ABTA, or tax code).
            </li>
            <li>
              <strong className="text-slate-900">Traveler Identity & Logistics:</strong> Full passenger names as per passport, flight details, pickup/drop-off locations, rooming lists, and emergency contact numbers required for private chauffeur dispatch, train ticketing, and hotel reservations.
            </li>
            <li>
              <strong className="text-slate-900">Special Category & Dietary Data:</strong> With your explicit consent, dietary restrictions (e.g., halal, kosher, allergies) and mobility/accessibility requirements to guarantee guest safety and accommodation.
            </li>
            <li>
              <strong className="text-slate-900">Financial & Transaction Information:</strong> Quotation histories, B2B wholesale invoice numbers, payment receipts, and transaction reference codes. <em>We do not store complete payment card numbers or CVVs on our servers.</em>
            </li>
            <li>
              <strong className="text-slate-900">Technical & Storage Data:</strong> IP addresses, browser types, session timestamps, and strictly necessary local storage keys used for authentication and session management.
            </li>
          </ul>
        </section>

        {/* Section 3: Legal Basis for Processing */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Scale className="w-5 h-5 text-[#008972]" />
            <span>3. Legal Grounds for Processing (GDPR & DPDP Act 2023)</span>
          </h2>
          <p>
            We process your personal data under the following lawful bases:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Performance of Contract</span>
              <p className="text-xs text-slate-600">
                Processing bookings, dispatching chauffeurs, issuing train vouchers, and securing hotel allotments.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Legal Compliance</span>
              <p className="text-xs text-slate-600">
                Complying with statutory invoicing, taxation, anti-money laundering, and consular regulatory requirements.
              </p>
            </div>
            <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 space-y-1">
              <span className="font-bold text-slate-900 block">Legitimate Interests / Consent</span>
              <p className="text-xs text-slate-600">
                Responding to inquiries, vetting B2B partner applications, and honoring cookie preferences.
              </p>
            </div>
          </div>
        </section>

        {/* Section 4: Data Sharing & International Transfers */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Globe2 className="w-5 h-5 text-[#008972]" />
            <span>4. Ground Supplier Sharing & International Transfers</span>
          </h2>
          <p>
            Because TheUnbound delivers ground operations in international destinations (including Japan, the United Kingdom, and Schengen European nations), traveler logistics details are transferred strictly to contracted, vetted ground partners:
          </p>
          <ul className="list-disc pl-5 space-y-1.5 text-slate-600">
            <li><strong className="text-slate-900">Vetted Chauffeurs & Transport Fleets:</strong> Passenger names, flight arrival times, and pickup addresses for seamless airport meet-and-greets.</li>
            <li><strong className="text-slate-900">Certified Regional Guides:</strong> Guest names and spoken language preferences for customized private touring.</li>
            <li><strong className="text-slate-900">Hotels & Ryokans:</strong> Rooming lists and dietary notifications for check-in compliance.</li>
            <li><strong className="text-slate-900">Cloud Infrastructure:</strong> Google Cloud Platform (Firestore database hosting) and Google Workspace (Sheets/Gmail operations), operating under strict Data Processing Agreements (DPAs).</li>
          </ul>
          <p className="text-xs text-slate-600 pt-1">
            <strong>Zero Data Sales:</strong> We do NOT sell, rent, monetize, or trade client personal data or traveler lists to third-party advertisers or data brokers under any circumstances.
          </p>
        </section>

        {/* Section 5: Data Retention Periods */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Database className="w-5 h-5 text-[#008972]" />
            <span>5. Data Retention Protocols</span>
          </h2>
          <p>
            We retain personal data only for as long as necessary to fulfill the purposes for which it was collected:
          </p>
          <ul className="list-disc pl-5 space-y-1 text-slate-600">
            <li><strong className="text-slate-900">Confirmed Booking & Invoicing Records:</strong> Retained for seven (7) years in accordance with statutory accounting and tax compliance laws.</li>
            <li><strong className="text-slate-900">Inquiry & Proposal Data:</strong> Retained for twenty-four (24) months to facilitate re-quotes and itinerary adjustments, or until consent is revoked.</li>
            <li><strong className="text-slate-900">B2B Agent Accounts:</strong> Retained for the duration of the commercial relationship or until an account closure request is processed.</li>
          </ul>
          <p className="text-[11px] text-slate-400 font-mono">
            [RETENTION_POLICY_NOTE: Confirm any custom client retention or accelerated deletion intervals with legal counsel].
          </p>
        </section>

        {/* Section 6: Data Subject Rights */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <UserCheck className="w-5 h-5 text-[#008972]" />
            <span>6. Your Legal Rights (GDPR, UK DPA & India DPDP)</span>
          </h2>
          <p>
            Depending on your location, you hold comprehensive rights over your personal data:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-0.5">Right to Access & Rectification</span>
              <p className="text-xs text-slate-600">Request a copy of your personal data and rectify inaccurate records.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-0.5">Right to Erasure ("Right to be Forgotten")</span>
              <p className="text-xs text-slate-600">Request deletion of personal data where legal retention obligations do not apply.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-0.5">Right to Restrict & Object</span>
              <p className="text-xs text-slate-600">Object to processing based on legitimate interests or request processing restrictions.</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
              <span className="font-bold text-slate-900 block mb-0.5">Right to Data Portability</span>
              <p className="text-xs text-slate-600">Receive your personal data in a structured, machine-readable format.</p>
            </div>
          </div>
          <p className="text-xs text-slate-600 pt-1">
            To exercise any of these rights, email us at <a href="mailto:business@theunbound.in" className="text-[#008972] font-semibold underline">business@theunbound.in</a> with the subject line "Data Subject Rights Request". We respond to all verified requests within thirty (30) calendar days.
          </p>
        </section>

        {/* Section 7: Security & Encryption */}
        <section className="space-y-3">
          <h2 className="text-base sm:text-lg font-bold text-slate-900 flex items-center space-x-2">
            <ShieldCheck className="w-5 h-5 text-[#008972]" />
            <span>7. Technical Security & Encryption Standards</span>
          </h2>
          <p>
            All web traffic, API calls, and Firestore communications are encrypted in transit using industry-standard TLS 1.3 / SSL 256-bit protocols. Database storage is secured with Google Cloud Platform's AES-256 encryption at rest. Internal access to traveler personal data is strictly role-restricted to authorized operations personnel.
          </p>
        </section>

        {/* Section 8: Grievance Officer & Contact */}
        <div className="pt-4 border-t border-slate-200 text-xs text-slate-500 space-y-2">
          <h3 className="font-bold text-slate-800 text-sm">Grievance Redressal Officer (India DPDP Act 2023 Compliance)</h3>
          <p>
            In accordance with the India Digital Personal Data Protection Act 2023 and Information Technology rules, the designated Grievance Officer is:
          </p>
          <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
            <p><strong className="text-slate-800">Designation:</strong> Data Protection & Grievance Redressal Officer</p>
            <p><strong className="text-slate-800">Legal Entity:</strong> Unbound Experiences India Pvt Ltd</p>
            <p><strong className="text-slate-800">Official Address:</strong> A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India</p>
            <p><strong className="text-slate-800">Email:</strong> <a href="mailto:business@theunbound.in" className="text-[#008972] font-semibold underline">business@theunbound.in</a> • CC: <a href="mailto:sales@theunbound.in" className="text-[#008972] font-semibold underline">sales@theunbound.in</a></p>
            <p><strong className="text-slate-800">Landline:</strong> 011-41185542 • <strong className="text-slate-800">Mobile:</strong> +91-9811654959, +91-9718894959</p>
            <p className="text-[11px] text-slate-400 font-mono pt-0.5">[GRIEVANCE_OFFICER_NAME: Specify name of designated officer prior to formal regulatory filing]</p>
          </div>
        </div>
      </div>
    </div>
  );
};
