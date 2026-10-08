import React from 'react';
import { 
  HelpCircle, 
  X, 
  BookOpen, 
  Database, 
  ShieldCheck, 
  Key, 
  Mail, 
  Calendar, 
  FileSpreadsheet, 
  Layers,
  Code
} from 'lucide-react';

interface TechnicalGlossaryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GlossaryEntry {
  term: string;
  category: 'DATABASE' | 'INTEGRATION' | 'GOVERNANCE' | 'SECURITY';
  businessExplanation: string;
  technicalExplanation: string;
  example: string;
}

export const TechnicalGlossaryModal: React.FC<TechnicalGlossaryModalProps> = ({
  isOpen,
  onClose
}) => {
  if (!isOpen) return null;

  const entries: GlossaryEntry[] = [
    {
      term: 'Firestore Collection',
      category: 'DATABASE',
      businessExplanation: 'A master directory or table in our cloud database that stores all items of a single type (e.g. all Tours, all Hotels, all Bookings).',
      technicalExplanation: 'A named container of JSON documents in Google Cloud Firestore NoSQL architecture.',
      example: 'The "products" collection contains all individual tour and ground activity documents.'
    },
    {
      term: 'Document ID (Primary Key)',
      category: 'DATABASE',
      businessExplanation: 'The unique alphanumeric tracking code assigned to a single record so it can never be confused with another.',
      technicalExplanation: 'The unique document path identifier within a Firestore collection (e.g. "prod-jp-tyo-001").',
      example: 'Hotel "Aman Tokyo" has ID "hotel-aman-tokyo-881".'
    },
    {
      term: 'Foreign Key / Relational Reference',
      category: 'DATABASE',
      businessExplanation: 'The digital link between two related items, like connecting a tour product to the city and destination where it takes place.',
      technicalExplanation: 'A field on a document storing the primary key ID of another document in a different collection.',
      example: 'A product has "destinationId: japan", linking it to the Japan destination document.'
    },
    {
      term: 'Orphan Record',
      category: 'DATABASE',
      businessExplanation: 'A record whose parent or linked item was deleted or never existed, leaving it detached and invisible in the catalog.',
      technicalExplanation: 'A document containing a dangling foreign key reference to a non-existent document ID.',
      example: 'A room rate referencing a hotel ID that was archived or removed.'
    },
    {
      term: 'Schema Invariant',
      category: 'GOVERNANCE',
      businessExplanation: 'A mandatory quality and commercial rule that data must obey to prevent pricing errors or broken proposals.',
      technicalExplanation: 'A deterministic business logic constraint (e.g. adultNetPrice > 0, SKU length > 3).',
      example: 'A product cannot have a selling price lower than its supplier net cost.'
    },
    {
      term: 'OAuth 2.0 Bearer Token',
      category: 'SECURITY',
      businessExplanation: 'A secure, temporary digital badge that lets TheUnbound dispatch emails via Gmail and schedule calendar tasks without storing passwords.',
      technicalExplanation: 'A JSON Web Token (JWT) issued by Google Identity Services granting scoped API authorization.',
      example: 'The token authorizes "https://www.googleapis.com/auth/gmail.send" for official booking vouchers.'
    },
    {
      term: 'Service Level Agreement (SLA)',
      category: 'INTEGRATION',
      businessExplanation: 'Guaranteed operational response timelines (e.g. 24-48h booking confirmation, 12h driver and guide task assignment).',
      technicalExplanation: 'Automated chronological timers that schedule Google Calendar events and alert ops managers when deadlines approach.',
      example: 'When a booking is confirmed, an SLA task is dispatched to the DMC ops queue due in 12 hours.'
    },
    {
      term: 'Currency & FX Conversion Engine',
      category: 'INTEGRATION',
      businessExplanation: 'The automated engine that evaluates live interbank foreign exchange rates via Google Sheets =GOOGLEFINANCE().',
      technicalExplanation: 'Evaluates official =GOOGLEFINANCE() currency pair formulas and applies configured agent/client markup rules in real-time.',
      example: 'Currency rates for JPY, EUR, USD, and INR are evaluated live via Google Finance for all client quotation calculations.'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-4xl rounded-3xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-800 rounded-xl text-[#00E5C0]">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-extrabold text-white">
                Technical & Business Architecture Glossary
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Clear business explanations and technical definitions for all database, API, and integration terms.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Glossary Body */}
        <div className="p-6 overflow-y-auto space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {entries.map((entry, idx) => (
              <div key={idx} className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-900 text-sm">
                    {entry.term}
                  </h4>
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-slate-200/80 text-slate-700">
                    {entry.category}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="bg-white p-2.5 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold uppercase text-emerald-700 block">Plain Business Meaning:</span>
                    <p className="text-slate-700 font-medium leading-relaxed">{entry.businessExplanation}</p>
                  </div>

                  <div className="bg-slate-900 p-2.5 rounded-xl text-slate-300 font-mono text-[11px] space-y-1">
                    <span className="text-[9px] font-bold uppercase text-[#00E5C0] block">Technical Architecture:</span>
                    <p className="text-slate-200 leading-relaxed">{entry.technicalExplanation}</p>
                  </div>

                  <div className="text-[11px] text-slate-500 italic pt-1">
                    <strong>Example:</strong> {entry.example}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <span>TheUnbound DMC Admin Reference &bull; Version 2.4</span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            Close Glossary
          </button>
        </div>
      </div>
    </div>
  );
};
