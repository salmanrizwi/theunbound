import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppDatabase } from '../../services/db';
import { 
  Product, 
  Hotel, 
  Destination, 
  CityHub, 
  TravelLead, 
  Quotation, 
  Booking, 
  User, 
  BlogArticle, 
  Promotion 
} from '../../types';
import { 
  Search, 
  X, 
  Package, 
  Hotel as HotelIcon, 
  Compass, 
  Layers, 
  Users, 
  FileText, 
  CalendarCheck, 
  UserCheck, 
  BookOpen, 
  Megaphone, 
  ArrowRight, 
  Clock 
} from 'lucide-react';

export interface SearchResultItem {
  id: string;
  title: string;
  subtitle: string;
  entityType: 'PRODUCT' | 'HOTEL' | 'DESTINATION' | 'HUB' | 'LEAD' | 'QUOTE' | 'BOOKING' | 'USER' | 'BLOG' | 'PROMOTION';
  moduleSection: string;
  subTab?: string;
  badge?: string;
  record?: any;
}

interface CMSGlobalSearchProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate: (section: string, subTab?: string, recordId?: string) => void;
}

export const CMSGlobalSearch: React.FC<CMSGlobalSearchProps> = ({
  isOpen,
  onClose,
  onNavigate
}) => {
  const [query, setQuery] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const db = AppDatabase.getInstance();

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
    }
  }, [isOpen]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const searchResults = useMemo<SearchResultItem[]>(() => {
    const cleanQ = query.trim().toLowerCase();
    if (!cleanQ) return [];

    const results: SearchResultItem[] = [];

    // 1. Products
    const products = db.getProducts();
    products.forEach(p => {
      if (
        p.name.toLowerCase().includes(cleanQ) ||
        p.category.toLowerCase().includes(cleanQ) ||
        p.city.toLowerCase().includes(cleanQ) ||
        p.country.toLowerCase().includes(cleanQ)
      ) {
        results.push({
          id: p.id,
          title: p.name,
          subtitle: `${p.category} • ${p.city}, ${p.country} • Rate: ${p.currency} ${p.adultNetPrice}`,
          entityType: 'PRODUCT',
          moduleSection: 'PRODUCT_MANAGEMENT',
          subTab: 'PRODUCTS',
          badge: p.status,
          record: p
        });
      }
    });

    // 2. Hotels
    const hotels = db.getHotels();
    hotels.forEach(h => {
      if (
        h.name.toLowerCase().includes(cleanQ) ||
        h.cityName.toLowerCase().includes(cleanQ) ||
        h.country.toLowerCase().includes(cleanQ) ||
        h.code.toLowerCase().includes(cleanQ)
      ) {
        results.push({
          id: h.id,
          title: h.name,
          subtitle: `${h.starRating}★ ${(h.propertyType || 'HOTEL').replace('_', ' ')} • ${h.cityName} • from ${h.currency} ${h.startingNetPrice}/nt`,
          entityType: 'HOTEL',
          moduleSection: 'HOTEL_MANAGEMENT',
          subTab: 'HOTELS',
          badge: h.status,
          record: h
        });
      }
    });

    // 3. Destinations
    const destinations = db.getDestinations();
    destinations.forEach(d => {
      if (
        d.name.toLowerCase().includes(cleanQ) ||
        d.country.toLowerCase().includes(cleanQ) ||
        d.tagline.toLowerCase().includes(cleanQ)
      ) {
        results.push({
          id: d.id,
          title: d.name,
          subtitle: `Country: ${d.country} • Currency: ${d.currency} • ${d.cities?.length || 0} Hubs`,
          entityType: 'DESTINATION',
          moduleSection: 'DESTINATION_MANAGEMENT',
          subTab: 'DESTINATIONS',
          badge: d.status,
          record: d
        });
      }
    });

    // 4. City Hubs
    const hubs = db.getCityHubs();
    hubs.forEach(hb => {
      if (
        hb.name.toLowerCase().includes(cleanQ) ||
        hb.destinationName.toLowerCase().includes(cleanQ) ||
        hb.tagline.toLowerCase().includes(cleanQ)
      ) {
        results.push({
          id: hb.id,
          title: hb.name,
          subtitle: `City Hub in ${hb.destinationName} • ${hb.productCount} Products • ${hb.hotelCount} Hotels`,
          entityType: 'HUB',
          moduleSection: 'DESTINATION_MANAGEMENT',
          subTab: 'CITIES',
          badge: hb.status,
          record: hb
        });
      }
    });

    // 5. Leads
    const leads = db.getLeads();
    leads.forEach(l => {
      if (
        l.contactName.toLowerCase().includes(cleanQ) ||
        l.email.toLowerCase().includes(cleanQ) ||
        l.leadNumber.toLowerCase().includes(cleanQ) ||
        (l.agencyName && l.agencyName.toLowerCase().includes(cleanQ))
      ) {
        results.push({
          id: l.id,
          title: `${l.contactName} (${l.leadNumber})`,
          subtitle: `${l.agencyName ? l.agencyName + ' • ' : ''}${l.destinationName || 'Destination'} • Budget: ${l.currency} ${l.estimatedBudget || 0}`,
          entityType: 'LEAD',
          moduleSection: 'LEAD_MANAGEMENT',
          subTab: 'LEADS',
          badge: l.status,
          record: l
        });
      }
    });

    // 6. Quotations
    const quotes = db.getAllSavedQuotes();
    quotes.forEach(q => {
      if (
        q.quoteNumber.toLowerCase().includes(cleanQ) ||
        q.clientName.toLowerCase().includes(cleanQ) ||
        q.agentName.toLowerCase().includes(cleanQ) ||
        q.destination.toLowerCase().includes(cleanQ)
      ) {
        results.push({
          id: q.id,
          title: `${q.quoteNumber} — ${q.clientName}`,
          subtitle: `${q.destination} • Agent: ${q.agentName} • Total: ${q.currency} ${(q.totalSellingPrice || 0).toLocaleString()}`,
          entityType: 'QUOTE',
          moduleSection: 'LEAD_MANAGEMENT',
          subTab: 'QUOTES',
          badge: q.status,
          record: q
        });
      }
    });

    // 7. Bookings
    const bookings = db.getAllBookings();
    bookings.forEach(b => {
      if (
        b.bookingReference.toLowerCase().includes(cleanQ) ||
        b.customer.leadTravelerName.toLowerCase().includes(cleanQ) ||
        b.customer.email.toLowerCase().includes(cleanQ) ||
        (b.customer.agencyName && b.customer.agencyName.toLowerCase().includes(cleanQ))
      ) {
        results.push({
          id: b.id,
          title: `${b.bookingReference} — ${b.customer.leadTravelerName}`,
          subtitle: `${b.items?.length || 0} Services • Travel: ${b.travelStartDate} • Total: ${b.currency} ${(b.totalAmount || 0).toLocaleString()}`,
          entityType: 'BOOKING',
          moduleSection: 'BOOKING_MANAGEMENT',
          subTab: 'BOOKINGS',
          badge: b.status,
          record: b
        });
      }
    });

    // 8. Users
    const users = db.getUsers();
    users.forEach(u => {
      if (
        u.name.toLowerCase().includes(cleanQ) ||
        u.email.toLowerCase().includes(cleanQ) ||
        (u.agencyName && u.agencyName.toLowerCase().includes(cleanQ))
      ) {
        results.push({
          id: u.id,
          title: u.name,
          subtitle: `${u.role} • ${u.email} • ${u.agencyName || 'Direct'}`,
          entityType: 'USER',
          moduleSection: 'ACCOUNT_MANAGEMENT',
          subTab: 'USERS_ACCESS',
          badge: u.approvalStatus || 'APPROVED',
          record: u
        });
      }
    });

    // 9. Blogs
    const blogs = db.getBlogs();
    blogs.forEach(bg => {
      if (
        bg.title.toLowerCase().includes(cleanQ) ||
        bg.category.toLowerCase().includes(cleanQ) ||
        bg.author.toLowerCase().includes(cleanQ)
      ) {
        results.push({
          id: bg.id,
          title: bg.title,
          subtitle: `Category: ${bg.category} • Author: ${bg.author} • ${bg.readTimeMinutes} min read`,
          entityType: 'BLOG',
          moduleSection: 'PAGE_MANAGEMENT',
          subTab: 'BLOGS',
          badge: bg.status,
          record: bg
        });
      }
    });

    // 10. Promotions
    const promotions = db.getPromotions();
    promotions.forEach(pr => {
      if (
        pr.title.toLowerCase().includes(cleanQ) ||
        pr.description.toLowerCase().includes(cleanQ) ||
        (pr.promoCode && pr.promoCode.toLowerCase().includes(cleanQ))
      ) {
        results.push({
          id: pr.id,
          title: pr.title,
          subtitle: `Code: ${pr.promoCode || 'N/A'} • Discount: ${pr.discountValue}${pr.discountType === 'PERCENTAGE' ? '%' : ' ' + (pr.currency || 'USD')}`,
          entityType: 'PROMOTION',
          moduleSection: 'MARKETING_MANAGEMENT',
          subTab: 'PROMOTIONS',
          badge: pr.isActive ? 'ACTIVE' : 'INACTIVE',
          record: pr
        });
      }
    });

    return results.slice(0, 20);
  }, [query, db]);

  if (!isOpen) return null;

  const getEntityIcon = (type: SearchResultItem['entityType']) => {
    switch (type) {
      case 'PRODUCT': return Package;
      case 'HOTEL': return HotelIcon;
      case 'DESTINATION': return Compass;
      case 'HUB': return Layers;
      case 'LEAD': return Users;
      case 'QUOTE': return FileText;
      case 'BOOKING': return CalendarCheck;
      case 'USER': return UserCheck;
      case 'BLOG': return BookOpen;
      case 'PROMOTION': return Megaphone;
      default: return Search;
    }
  };

  const handleSelectResult = (item: SearchResultItem) => {
    onNavigate(item.moduleSection, item.subTab, item.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 px-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[80vh]">
        {/* Search Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center space-x-3 bg-slate-50">
          <Search className="w-5 h-5 text-[#008972] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search across Products, Hotels, Destinations, Hubs, Leads, Quotes, Bookings, Users..."
            className="w-full bg-transparent text-slate-900 placeholder:text-slate-400 text-sm sm:text-base font-medium outline-hidden"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <button 
            onClick={onClose}
            className="px-2.5 py-1 text-xs font-bold text-slate-500 hover:text-slate-800 bg-slate-200/80 rounded-lg"
          >
            ESC
          </button>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-3 space-y-1.5 flex-1 divide-y divide-slate-100">
          {query.trim() === '' ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <Search className="w-10 h-10 mx-auto text-slate-300 opacity-80" />
              <p className="text-sm font-semibold text-slate-600">Type to search across TheUnbound DMC</p>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                Quickly locate product inventory, contracted hotels, leads, active quotes, bookings, users, and content.
              </p>
            </div>
          ) : searchResults.length === 0 ? (
            <div className="py-12 text-center text-slate-400 space-y-2">
              <p className="text-sm font-semibold text-slate-600">No matching records found for "{query}"</p>
              <p className="text-xs text-slate-400">Try searching by SKU, booking reference, customer name, hotel, or city.</p>
            </div>
          ) : (
            <div className="space-y-1.5 pt-1">
              <div className="px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                Found {searchResults.length} Match{searchResults.length === 1 ? '' : 'es'}:
              </div>
              {searchResults.map((item) => {
                const Icon = getEntityIcon(item.entityType);
                return (
                  <button
                    key={`${item.entityType}-${item.id}`}
                    onClick={() => handleSelectResult(item)}
                    className="w-full text-left p-3 rounded-2xl hover:bg-slate-50 transition-all flex items-center justify-between group border border-transparent hover:border-slate-200"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-[#008972]/10 group-hover:text-[#008972] text-slate-600 flex items-center justify-center shrink-0 transition-colors">
                        <Icon className="w-5 h-5" />
                      </div>
                      <div className="min-w-0 pr-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 group-hover:text-[#008972]">
                            {item.entityType}
                          </span>
                          {item.badge && (
                            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                              {item.badge}
                            </span>
                          )}
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-slate-900 truncate">
                          {item.title}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {item.subtitle}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center space-x-1.5 text-xs font-bold text-slate-400 group-hover:text-[#008972] shrink-0 pl-2">
                      <span className="hidden sm:inline">Jump</span>
                      <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer Quick Keys */}
        <div className="p-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500 px-4">
          <span>Search index spans 10 entities in real-time.</span>
          <span>Press <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-slate-700 font-mono text-[10px]">ESC</kbd> to exit</span>
        </div>
      </div>
    </div>
  );
};
