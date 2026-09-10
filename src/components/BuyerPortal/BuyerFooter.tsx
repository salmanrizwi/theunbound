import React from 'react';
import { 
  Clock, 
  MapPin, 
  Mail, 
  PhoneCall, 
  Phone, 
  BookOpen, 
  FileText, 
  Lock, 
  RotateCcw, 
  ExternalLink,
  ShieldCheck,
  Cookie,
  Sliders
} from 'lucide-react';
import { Destination } from '../../types';
import { AppDatabase } from '../../services/db';

interface BuyerFooterProps {
  onSelectDestination: (slug: string) => void;
  onSelectTab: (tab: string) => void;
  onSelectCustomPage: (slug: string) => void;
}

export const BuyerFooter: React.FC<BuyerFooterProps> = ({
  onSelectDestination,
  onSelectTab,
  onSelectCustomPage
}) => {
  const db = AppDatabase.getInstance();
  const footerConfig = db.getFooterConfig();

  return (
    <footer className="bg-slate-950 text-white border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 lg:gap-12">
          {/* Brand & Mission */}
          <div className="md:col-span-4 lg:col-span-3 space-y-4">
            <span className="text-2xl font-black tracking-tight text-[#00C6A6] font-sans lowercase select-none">
              theunbound
            </span>
            <p className="text-xs text-slate-400 leading-relaxed">
              Global Destination Management Company (DMC) delivering verified wholesale ground handling, private VIP itineraries, and contractual guarantees across Japan, the United Kingdom, and Europe.
            </p>
            <div className="pt-2">
              <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-[#00C6A6]/10 text-[#00E5C0] border border-[#00C6A6]/20">
                <Clock className="w-3 h-3 text-[#00C6A6]" />
                <span>24–48h Direct Ground Confirmation</span>
              </span>
            </div>
          </div>

          {/* Dynamic CMS-Managed Columns or Fallbacks */}
          {(() => {
            const liveColumns = (footerConfig?.columns || db.getFooterColumns() || [])
              .filter(col => col.isVisible !== false && col.status !== 'INACTIVE')
              .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

            if (liveColumns.length > 0) {
              return (
                <div className={`md:col-span-5 lg:col-span-6 grid grid-cols-2 ${liveColumns.length >= 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-6`}>
                  {liveColumns.map((col) => {
                    const activeLinks = (col.links || [])
                      .filter(link => link.status !== 'INACTIVE')
                      .sort((a, b) => (a.displayOrder || 0) - (b.displayOrder || 0));

                    return (
                      <div key={col.id} className="space-y-3">
                        <div>
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                            {col.title}
                          </h4>
                          {col.description && (
                            <p className="text-[11px] text-slate-500 mt-0.5">{col.description}</p>
                          )}
                        </div>
                        <ul className="space-y-2 text-xs text-slate-400">
                          {activeLinks.map((link) => (
                            <li key={link.id}>
                              <button
                                onClick={() => {
                                  if (link.openIn === '_blank') {
                                    if (link.url.startsWith('http://') || link.url.startsWith('https://')) {
                                      window.open(link.url, '_blank', 'noopener,noreferrer');
                                    } else {
                                      window.open(link.url, '_blank');
                                    }
                                    return;
                                  }

                                  if (link.type === 'DESTINATION') {
                                    onSelectDestination(link.targetId || 'all');
                                  } else if (link.type === 'CUSTOM_PAGE') {
                                    onSelectCustomPage(link.targetId || 'about-theunbound');
                                  } else if (link.type === 'SYSTEM_VIEW') {
                                    if (link.targetId === 'visas') onSelectTab('VISAS');
                                    else if (link.targetId === 'contact') onSelectTab('CONTACT');
                                    else if (link.targetId === 'about') onSelectTab('ABOUT');
                                    else if (link.targetId === 'blogs') onSelectTab('BLOGS');
                                    else if (link.targetId === 'terms') onSelectTab('TERMS');
                                    else if (link.targetId === 'privacy') onSelectTab('PRIVACY');
                                    else if (link.targetId === 'refund') onSelectTab('REFUND');
                                    else onSelectDestination('all');
                                  } else if (link.url && (link.url.startsWith('mailto:') || link.url.startsWith('tel:'))) {
                                    window.location.href = link.url;
                                  } else if (link.url && (link.url.startsWith('http://') || link.url.startsWith('https://'))) {
                                    window.open(link.url, '_blank', 'noopener,noreferrer');
                                  } else if (link.url && link.url.startsWith('/')) {
                                    const rawSlug = link.url.replace(/^\//, '');
                                    const customPages = db.getCustomPages();
                                    if (customPages.some(p => p.slug === rawSlug)) {
                                      onSelectCustomPage(rawSlug);
                                    } else {
                                      onSelectDestination(rawSlug);
                                    }
                                  }
                                  window.scrollTo({ top: 0, behavior: 'smooth' });
                                }}
                                className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5 text-left group"
                              >
                                <span>{link.label}</span>
                                {link.openIn === '_blank' && (
                                  <ExternalLink className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity text-slate-500" />
                                )}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              );
            }

            // Default standard columns fallback
            return (
              <div className="md:col-span-5 lg:col-span-6 grid grid-cols-2 sm:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Core Destinations
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li>
                      <button 
                        onClick={() => onSelectDestination('all')}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>All Destinations (Global Overview)</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => onSelectDestination('japan')}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>Japan (Tokyo, Kyoto, Osaka, Mt. Fuji)</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => onSelectDestination('uk')}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>United Kingdom (London, Edinburgh, Highlands)</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => onSelectDestination('europe')}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>Europe (Paris, Rome, Amalfi, Swiss Alps)</span>
                      </button>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Consular & Visas
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li>
                      <button 
                        onClick={() => {
                          onSelectTab('VISAS');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>Japan Tourist E-Visa Checklist</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => {
                          onSelectTab('VISAS');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>UK Standard Visitor Visa Checklist</span>
                      </button>
                    </li>
                    <li>
                      <button 
                        onClick={() => {
                          onSelectTab('VISAS');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <span>Schengen Short-Stay Visa Requirements</span>
                      </button>
                    </li>
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Trust & Operations
                  </h4>
                  <ul className="space-y-2 text-xs text-slate-400">
                    <li>
                      <button
                        onClick={() => {
                          onSelectTab('CONTACT');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <Mail className="w-3 h-3 text-[#00C6A6]" />
                        <span>Contact Operations</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          onSelectTab('BLOGS');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <BookOpen className="w-3 h-3 text-[#00C6A6]" />
                        <span>Editorial & Insights</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          onSelectTab('TERMS');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <FileText className="w-3 h-3 text-[#00C6A6]" />
                        <span>Terms & Conditions</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          onSelectTab('PRIVACY');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <Lock className="w-3 h-3 text-[#00C6A6]" />
                        <span>Privacy Policy</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          onSelectTab('REFUND');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <RotateCcw className="w-3 h-3 text-[#00C6A6]" />
                        <span>Refund Policy</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          onSelectTab('COOKIES');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5"
                      >
                        <Cookie className="w-3 h-3 text-[#00C6A6]" />
                        <span>Cookie Policy</span>
                      </button>
                    </li>
                    <li>
                      <button
                        onClick={() => {
                          window.dispatchEvent(new CustomEvent('theunbound_open_cookie_preferences'));
                        }}
                        className="hover:text-[#00C6A6] transition-colors cursor-pointer flex items-center space-x-1.5 text-slate-400"
                        title="Manage your cookie and local storage consent preferences"
                      >
                        <Sliders className="w-3 h-3 text-[#00C6A6]" />
                        <span>Cookie Settings</span>
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            );
          })()}

          {/* Ground Operations Contact Details */}
          <div className="md:col-span-3 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Official Head Office
            </h4>
            <div className="space-y-2 text-xs text-slate-400">
              <p className="flex items-start space-x-2">
                <MapPin className="w-4 h-4 text-[#00C6A6] shrink-0 mt-0.5" />
                <span className="leading-snug">
                  A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi
                </span>
              </p>
              <p className="flex items-center space-x-2">
                <Mail className="w-4 h-4 text-[#00C6A6] shrink-0" />
                <a href="mailto:sales@theunbound.in" className="font-mono text-slate-300 hover:text-[#00C6A6] transition-colors">
                  sales@theunbound.in
                </a>
              </p>
              <div className="flex flex-col space-y-1.5 pt-0.5">
                <p className="flex items-center space-x-2">
                  <PhoneCall className="w-4 h-4 text-[#00C6A6] shrink-0" />
                  <span className="text-slate-400">Landline:</span>
                  <a href="tel:01141185542" className="font-mono font-semibold text-white hover:text-[#00C6A6] transition-colors">
                    011-41185542
                  </a>
                </p>
                <p className="flex items-center space-x-2">
                  <Phone className="w-4 h-4 text-[#00C6A6] shrink-0" />
                  <span className="text-slate-400">Mobile:</span>
                  <a href="tel:+919811654959" className="font-mono text-slate-300 hover:text-[#00C6A6] transition-colors">
                    +91-9811654959
                  </a>
                </p>
                <p className="flex items-center space-x-2 pl-6">
                  <a href="tel:+919718894959" className="font-mono text-slate-300 hover:text-[#00C6A6] transition-colors">
                    +91-9718894959
                  </a>
                </p>
              </div>
              <p className="text-[11px] text-slate-500 pt-1">
                24/7 Operations Ground Dispatch
              </p>
            </div>
          </div>
        </div>

        {/* Bottom Copyright & Status Bar */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500 pt-8 border-t border-slate-900">
          <div className="flex items-center space-x-2">
            <span>© 2026 Unbound Experiences India Pvt Ltd. All rights reserved.</span>
          </div>

          <div className="flex items-center space-x-4">
            <span className="flex items-center space-x-1.5 text-emerald-400">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Ground Operations Network: Operational (24-48h SLA)</span>
            </span>
            <span>•</span>
            <span>IATA / ASTA / PATA Verified</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
