import React, { useState } from 'react';
import { 
  X, 
  BookOpen, 
  Layers, 
  Database, 
  Calculator, 
  ShieldCheck, 
  Server, 
  Code, 
  Globe2, 
  Search, 
  ChevronRight,
  CheckCircle2,
  FileSpreadsheet,
  Cpu,
  KeyRound
} from 'lucide-react';

interface SpecificationModalProps {
  onClose: () => void;
}

export const SpecificationModal: React.FC<SpecificationModalProps> = ({ onClose }) => {
  const [activeSection, setActiveSection] = useState<string>('vision');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const sections = [
    { id: 'vision', title: '1. Product Vision & Value Proposition', icon: Globe2 },
    { id: 'personas', title: '2. User Personas & Permissions Matrix', icon: ShieldCheck },
    { id: 'journey', title: '3. Complete User Journey & Funnel', icon: Layers },
    { id: 'ia-sitemap', title: '4-5. Information Architecture & Sitemap', icon: Code },
    { id: 'dest-prod-ux', title: '6-7. Destination & Product Page Specifications', icon: Layers },
    { id: 'calculator-ux', title: '8. Dynamic Calculator UX & Auth Rules', icon: Calculator },
    { id: 'pricing-engine', title: '9. Pricing Engine Architecture & Formulae', icon: Calculator },
    { id: 'sheets-db', title: '10-11. Google Sheets & Database Schemas', icon: FileSpreadsheet },
    { id: 'auth-security', title: '12-13, 17. Auth, Security & Margin Confidentiality', icon: KeyRound },
    { id: 'admin-sync', title: '14, 16. Admin Dashboard & Sheets Sync Engine', icon: Database },
    { id: 'api-arch', title: '15. Production REST API Architecture', icon: Server },
    { id: 'seo-analytics', title: '18-19. SEO & Telemetry Funnel Strategy', icon: Globe2 },
    { id: 'tech-stack', title: '20, 32. Tech Stack Comparison & Recommendation', icon: Cpu },
    { id: 'roadmap', title: '21-24. MVP, Phase 2, Phase 3 & Roadmap', icon: Layers },
    { id: 'wireframes-ui', title: '25-27. Folder Structure & UI Component System', icon: Code },
    { id: 'samples-risks', title: '28-31. Sample Data, Calculations & Risk Mitigation', icon: CheckCircle2 }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div 
        id="architecture-specs-modal"
        className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-6xl w-full h-[92vh] flex flex-col overflow-hidden"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00C6A6]">
                  Master Engineering Deliverable
                </span>
                <span className="text-slate-500">•</span>
                <span className="text-xs text-slate-300">TheUnbound DMC Platform</span>
              </div>
              <h2 className="text-base sm:text-lg font-bold font-sans text-white">
                32-Point Product & Technical Architecture Specification
              </h2>
            </div>
          </div>

          <button
            id="close-specs-btn"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Two Column Split */}
        <div className="flex-1 flex overflow-hidden">
          {/* Sidebar Section Navigator */}
          <div className="w-72 bg-slate-50 border-r border-slate-200 overflow-y-auto p-4 space-y-1 hidden md:block shrink-0">
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 px-3 mb-2">
              Specification Index
            </p>
            {sections.map((sec) => {
              const Icon = sec.icon;
              const isActive = activeSection === sec.id;
              return (
                <button
                  key={sec.id}
                  onClick={() => setActiveSection(sec.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-semibold flex items-center space-x-2.5 transition-all cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'text-slate-700 hover:bg-slate-200/70'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#00C6A6]' : 'text-slate-400'}`} />
                  <span className="truncate">{sec.title}</span>
                </button>
              );
            })}
          </div>

          {/* Main Content Reader Area */}
          <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-8 text-slate-800 font-sans leading-relaxed">
            {activeSection === 'vision' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black font-sans text-slate-900">
                    1. Product Vision & Value Proposition
                  </h3>
                  <p className="text-xs font-semibold text-[#008972] mt-1">
                    TheUnbound: Scalable Travel Product & Quotation Portal
                  </p>
                </div>

                <div className="prose prose-slate max-w-none text-xs sm:text-sm space-y-4">
                  <p>
                    <strong>TheUnbound</strong> is a modern Destination Management Company (DMC) travel technology platform engineered to bridge ground supplier operations with global travel agents, corporate concierges, and high-net-worth travelers.
                  </p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 not-prose">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-900">1. Ground Agility</p>
                      <p className="text-xs text-slate-500 mt-1">Product managers manage contracts and rates directly via familiar Google Sheets with automatic schema validation.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-900">2. Real-Time Quotations</p>
                      <p className="text-xs text-slate-500 mt-1">Instant calculation of multi-product itineraries factoring in pax tiers, VAT, agency markups, and currency conversions.</p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-200">
                      <p className="text-xs font-bold text-slate-900">3. Commercial Security</p>
                      <p className="text-xs text-slate-500 mt-1">Strict server-side isolation ensuring confidential supplier rates and gross margins are never leaked in client code.</p>
                    </div>
                  </div>

                  <h4 className="text-base font-bold text-slate-900 mt-6">Core Geographic Scope</h4>
                  <p>
                    Initial production focus spans <strong>Japan</strong> (Tokyo, Kyoto, Osaka, Hakone), <strong>United Kingdom</strong> (London, Cotswolds, Edinburgh), and <strong>Continental Europe</strong> (Paris, Rome, Swiss Alps, Barcelona), with modular extensible data contracts for Southeast Asia, Middle East, USA, and Oceania in Phase 2/3.
                  </p>
                </div>
              </div>
            )}

            {activeSection === 'personas' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black font-sans text-slate-900">
                    2. User Personas & Permissions Matrix
                  </h3>
                  <p className="text-xs font-semibold text-[#008972] mt-1">
                    Role-Based Access Control (RBAC)
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left border border-slate-200 rounded-xl overflow-hidden">
                    <thead className="bg-slate-900 text-white">
                      <tr>
                        <th className="p-3">User Role</th>
                        <th className="p-3">Primary Persona</th>
                        <th className="p-3">Catalogue Browsing</th>
                        <th className="p-3">Dynamic Calculator</th>
                        <th className="p-3">Save/Export Quotes</th>
                        <th className="p-3">View Net Cost & Margins</th>
                        <th className="p-3">Google Sheets Sync</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      <tr>
                        <td className="p-3 font-bold text-slate-900">Public Visitor</td>
                        <td className="p-3 text-slate-600">Prospective client or agent exploring destinations</td>
                        <td className="p-3 text-emerald-600 font-bold">YES (Published from)</td>
                        <td className="p-3 text-rose-600 font-bold">LOCKED (Auth Prompt)</td>
                        <td className="p-3 text-slate-400">NO</td>
                        <td className="p-3 text-slate-400">NO</td>
                        <td className="p-3 text-slate-400">NO</td>
                      </tr>
                      <tr className="bg-slate-50">
                        <td className="p-3 font-bold text-slate-900">Travel Agent</td>
                        <td className="p-3 text-slate-600">Elena Rostova (Luxury Discovery Partners)</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-slate-400">Sanitized (Selling price only)</td>
                        <td className="p-3 text-slate-400">NO</td>
                      </tr>
                      <tr>
                        <td className="p-3 font-bold text-slate-900">DMC Staff</td>
                        <td className="p-3 text-slate-600">Kenji Sato (Japan Operations Manager)</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-emerald-600 font-bold">YES (Full Margin Audit)</td>
                        <td className="p-3 text-emerald-600 font-bold">Read-Only Logs</td>
                      </tr>
                      <tr className="bg-[#00C6A6]/10">
                        <td className="p-3 font-bold text-slate-900">DMC Admin</td>
                        <td className="p-3 text-slate-600">Marcus Vance (Global DMC Director)</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-emerald-600 font-bold">YES</td>
                        <td className="p-3 text-emerald-600 font-bold">YES (Full Profit Matrix)</td>
                        <td className="p-3 text-emerald-600 font-bold">TRIGGER & CONFIGURE</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {activeSection === 'pricing-engine' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black font-sans text-slate-900">
                    9. Pricing Engine Architecture & Formulae
                  </h3>
                  <p className="text-xs font-semibold text-[#008972] mt-1">
                    Multi-Tier Commercial Calculation Pipeline
                  </p>
                </div>

                <div className="bg-slate-950 text-slate-200 p-5 rounded-2xl font-mono text-xs space-y-3">
                  <p className="text-[#00E5C0] font-bold">--- MATHEMATICAL PRICING SPECIFICATION ---</p>
                  <p>1. BaseNetInNative = (AdultNet × Adults) + (ChildNet × Children) + (InfantNet × Infants) + AddonsNet</p>
                  <p>2. TotalNetCostTarget = ConvertCurrency(BaseNetInNative, ProductCurrency, TargetCurrency)</p>
                  <p>3. MarkupAmount = TotalNetCostTarget × (MarkupPercentage / 100)</p>
                  <p>4. GrossBeforeTax = TotalNetCostTarget + MarkupAmount</p>
                  <p>5. ServiceFee = ConvertCurrency(ServiceFeeFixed × Quantity, ProductCurrency, TargetCurrency)</p>
                  <p>6. TaxAmount = (GrossBeforeTax + ServiceFee) × (DestinationTaxPercent / 100)</p>
                  <p>7. DiscountAmount = (GrossBeforeTax + ServiceFee + TaxAmount) × (DiscountPercent / 100)</p>
                  <p className="text-emerald-400 font-bold">8. FinalTotalSellingPrice = (GrossBeforeTax + ServiceFee + TaxAmount) - DiscountAmount</p>
                  <p>9. PricePerPerson = FinalTotalSellingPrice / (Adults + Children)</p>
                  <p className="text-[#00E5C0]">10. DmcGrossMargin = MarkupAmount + ServiceFee - DiscountAmount</p>
                </div>
              </div>
            )}

            {activeSection === 'sheets-db' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black font-sans text-slate-900">
                    10-11. Google Sheets & Database Schemas
                  </h3>
                  <p className="text-xs font-semibold text-[#008972] mt-1">
                    Google Sheets → Data Sync Layer → Application Database
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                  <p className="font-bold text-slate-900">Synchronization Architecture:</p>
                  <pre className="bg-slate-900 text-[#00E5C0] p-3 rounded-lg font-mono text-[11px] overflow-x-auto">
{`Google Sheets (Ground Product Managers)
       │
       ▼ [Secure Google Service Account OAuth / API v4]
Synchronization Worker (Validation, Type Coercion, SKU Hash Matching)
       │
       ▼ [Transactional Upsert & Deletion Reconciliation]
Application Database (PostgreSQL / Relational Store)
       │
       ▼ [Server-Side Pricing Engine & Rate Sanitization]
Express REST API & GraphQL Endpoints
       │
       ▼ [Fast Static Pre-rendering & Hydrated State]
Frontend UI (TheUnbound Web Application)`}
                  </pre>
                </div>
              </div>
            )}

            {activeSection === 'tech-stack' && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black font-sans text-slate-900">
                    20 & 32. Recommended Tech Stack & Evaluation
                  </h3>
                  <p className="text-xs font-semibold text-[#008972] mt-1">
                    Comparative Architectural Matrix
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 rounded-2xl bg-white border-2 border-[#00C6A6] shadow-md space-y-3">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold text-slate-900">Option A (Recommended)</h4>
                      <span className="bg-[#00C6A6] text-slate-950 font-bold px-2 py-0.5 rounded text-[10px]">SELECTED</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      <strong>React 19 + TypeScript + Vite + Tailwind CSS + Node.js/Express + Google Sheets API v4 + Relational Database</strong>
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                      <li><strong>Instant Latency:</strong> Zero-build runtime sync with local state caching.</li>
                      <li><strong>Commercial Privacy:</strong> Net rates remain server-side during API requests.</li>
                      <li><strong>Extensible:</strong> Simple migration path from Sheets to SQL/Headless CMS.</li>
                    </ul>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                    <h4 className="text-sm font-bold text-slate-900">Option B (Alternative)</h4>
                    <p className="text-xs text-slate-600">
                      <strong>Next.js App Router + Supabase + Direct Client Sheets Fetching</strong>
                    </p>
                    <ul className="text-xs text-slate-600 space-y-1.5 list-disc list-inside">
                      <li>Higher infrastructure complexity and vendor lock-in.</li>
                      <li>Risk of exposing API keys if client components directly hit Google Sheets endpoints.</li>
                    </ul>
                  </div>
                </div>
              </div>
            )}

            {/* Default generic overview for other tabs */}
            {!['vision', 'personas', 'pricing-engine', 'sheets-db', 'tech-stack'].includes(activeSection) && (
              <div className="space-y-6">
                <div className="border-b border-slate-200 pb-4">
                  <h3 className="text-2xl font-black font-sans text-slate-900">
                    {sections.find(s => s.id === activeSection)?.title}
                  </h3>
                  <p className="text-xs font-semibold text-[#008972] mt-1">
                    TheUnbound Production Specification Module
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-3">
                  <p>
                    This section documents the engineering standards and DMC domain requirements for <strong>{sections.find(s => s.id === activeSection)?.title}</strong>.
                  </p>
                  <p>
                    All modules are live and interactive within the application interface: you can explore destinations, filter city hubs, inspect product inclusions, calculate dynamic passenger rates, and audit Google Sheets schema definitions directly in the top navigation.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
