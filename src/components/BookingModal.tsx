import React, { useState } from 'react';
import { Product, Quotation, CurrencyCode, User, Booking, BookingItem, B2BPackage } from '../types';
import { AppDatabase } from '../services/db';
import { useAuth } from '../context/AuthContext';
import { useQuotation } from '../context/QuotationContext';
import { formatCurrency, calculateProductPrice, convertCurrency } from '../services/pricingEngine';
import { googleCalendarAutomation } from '../services/googleCalendarAutomationService';
import { 
  X, 
  ShieldCheck, 
  Calendar, 
  Users, 
  Clock, 
  Mail, 
  Phone, 
  UserCheck, 
  Building2, 
  FileText, 
  Plane, 
  MapPin, 
  Send,
  AlertCircle,
  CheckCircle2,
  Sparkles,
  Hotel,
  Car
} from 'lucide-react';

interface BookingModalProps {
  isOpen?: boolean;
  onClose: () => void;
  product?: Product | null;
  quotation?: Quotation | null;
  packageItem?: B2BPackage | null;
  currentUser?: User | null;
  currency?: CurrencyCode;
  onBookingComplete: (booking: Booking) => void;
}

export const BookingModal: React.FC<BookingModalProps> = ({
  isOpen = true,
  onClose,
  product,
  quotation,
  packageItem,
  currentUser: propUser,
  currency: propCurrency,
  onBookingComplete
}) => {
  const { user: authUser } = useAuth();
  const { currency: quoteCurrency } = useQuotation();
  const currentUser = propUser || authUser;
  const currency = propCurrency || quotation?.currency || packageItem?.currency || quoteCurrency || 'USD';

  const db = AppDatabase.getInstance();

  // For single product / package booking state
  const [travelDate, setTravelDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 14);
    return d.toISOString().split('T')[0];
  });
  const [adults, setAdults] = useState<number>(2);
  const [children, setChildren] = useState<number>(0);
  const [infants, setInfants] = useState<number>(0);
  const [selectedAddonIds, setSelectedAddonIds] = useState<string[]>([]);

  // Customer Contact Fields
  const [leadTravelerName, setLeadTravelerName] = useState<string>(
    quotation?.clientName || currentUser?.name || ''
  );
  const [email, setEmail] = useState<string>(
    quotation?.clientEmail || currentUser?.email || ''
  );
  const [phone, setPhone] = useState<string>('+91-');
  const [bookerName, setBookerName] = useState<string>(
    currentUser?.name || quotation?.agentName || ''
  );
  const [agencyName, setAgencyName] = useState<string>(
    currentUser?.agencyName || quotation?.clientCompany || ''
  );
  const [agentRefNumber, setAgentRefNumber] = useState<string>(
    quotation ? quotation.quoteNumber : ''
  );
  const [flightDetails, setFlightDetails] = useState<string>('');
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  if (!isOpen || (!product && !quotation && !packageItem)) return null;

  const isB2BAgent = currentUser && (currentUser.role === 'B2B_AGENT' || currentUser.role === 'AGENT' || currentUser.role === 'ADMIN');

  // Calculate pricing for package
  const packageBaseNetUSD = packageItem?.baseNetCostUSD || 2500;
  const packageRetailUSD = packageItem?.suggestedSellingPriceUSD || Math.round(packageBaseNetUSD * 1.3);
  const packageB2BUSD = Math.round(packageBaseNetUSD * (1 + (packageItem?.pricingConfiguration?.b2bMarkupPercent || 12) / 100));

  const packagePerPaxPriceUSD = isB2BAgent ? packageB2BUSD : packageRetailUSD;
  const packagePerPaxPrice = convertCurrency(packagePerPaxPriceUSD, 'USD', currency);
  const packagePerPaxNet = convertCurrency(packageBaseNetUSD, 'USD', currency);

  const packageTotalAmount = (packagePerPaxPrice * adults) + (packagePerPaxPrice * 0.75 * children);
  const packageTotalNetCost = (packagePerPaxNet * adults) + (packagePerPaxNet * 0.75 * children);

  // Calculate pricing for single product
  const singleProductCalculation = product ? calculateProductPrice(product, {
    productId: product.id,
    adults,
    children,
    infants,
    travelDate,
    targetCurrency: currency,
    selectedAddonIds,
    pricingTier: currentUser?.role === 'B2B_AGENT' ? 'B2B' : 'B2C'
  }) : null;

  // Calculate totals
  const totalAmount = quotation
    ? quotation.totalSellingPrice
    : packageItem
    ? packageTotalAmount
    : singleProductCalculation?.finalTotalSellingPrice || 0;

  const totalNetCost = quotation
    ? quotation.totalNetCost
    : packageItem
    ? packageTotalNetCost
    : singleProductCalculation?.totalNetCost || 0;

  const handleToggleAddon = (addonId: string) => {
    setSelectedAddonIds(prev => 
      prev.includes(addonId) ? prev.filter(id => id !== addonId) : [...prev, addonId]
    );
  };

  const handleSubmitBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!leadTravelerName.trim()) {
      setErrorMessage('Please enter the Lead Traveler name.');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid contact email for booking confirmation.');
      return;
    }
    if (!phone.trim() || phone.length < 7) {
      setErrorMessage('Please enter a valid phone or WhatsApp contact number.');
      return;
    }

    setIsSubmitting(true);

    try {
      let bookingItems: BookingItem[] = [];
      let travelStartDate = travelDate;
      let travelEndDate = travelDate;

      if (quotation) {
        // Items from quotation
        const qItems = quotation.items || [];
        bookingItems = qItems.map(item => ({
          id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku,
          destinationName: item.product.destinationName,
          city: item.product.city,
          category: item.product.category,
          travelDate: item.travelDate,
          adults: item.pax.adults,
          children: item.pax.children,
          infants: item.pax.infants,
          totalPax: item.pax.adults + item.pax.children + item.pax.infants,
          selectedAddonNames: item.selectedAddonIds?.map(aid => 
            item.product.addons?.find(a => a.id === aid)?.name || aid
          ),
          unitNetPrice: item.calculation.totalNetCost,
          unitSellingPrice: item.calculation.finalTotalSellingPrice,
          totalPrice: item.calculation.finalTotalSellingPrice,
          currency: quotation.currency
        }));

        if (qItems.length > 0) {
          const dates = qItems.map(i => i.travelDate).filter(Boolean).sort();
          if (dates.length > 0) {
            travelStartDate = dates[0];
            travelEndDate = dates[dates.length - 1];
          }
        }
      } else if (packageItem) {
        // Items from Ready-Made Package
        const durationNights = packageItem.durationNights || (packageItem.durationDays - 1);
        const startD = new Date(travelDate);
        const endD = new Date(startD.getTime() + durationNights * 86400000);
        travelEndDate = endD.toISOString().split('T')[0];

        bookingItems = [{
          id: `item-pkg-${packageItem.id}-${Date.now()}`,
          productId: packageItem.id,
          productName: `Ready-Made Circuit: ${packageItem.title}`,
          productSku: `PKG-${(packageItem.destinationName || 'GLOBAL').slice(0, 3).toUpperCase()}-${packageItem.durationDays}D`,
          destinationName: packageItem.destinationName,
          city: packageItem.routeSummary?.[0] || packageItem.destinationName,
          category: 'Ready-Made Tour Package',
          travelDate,
          adults,
          children,
          infants,
          totalPax: adults + children + infants,
          unitNetPrice: packagePerPaxNet,
          unitSellingPrice: packagePerPaxPrice,
          totalPrice: packageTotalAmount,
          currency
        }];
      } else if (product && singleProductCalculation) {
        // Items from single product
        const selectedAddonNames = product.addons
          ?.filter(a => selectedAddonIds.includes(a.id))
          .map(a => a.name);

        bookingItems = [{
          id: `item-${Date.now()}`,
          productId: product.id,
          productName: product.name,
          productSku: product.sku,
          destinationName: product.destinationName,
          city: product.city,
          category: product.category,
          travelDate,
          adults,
          children,
          infants,
          totalPax: adults + children + infants,
          selectedAddonNames,
          unitNetPrice: singleProductCalculation.totalNetCost,
          unitSellingPrice: singleProductCalculation.finalTotalSellingPrice,
          totalPrice: singleProductCalculation.finalTotalSellingPrice,
          currency
        }];
      }

      // Create and dispatch the booking
      const newBooking = db.createBooking({
        sourceType: quotation ? 'QUOTATION' : packageItem ? 'PACKAGE' : 'PRODUCT_DIRECT',
        quoteId: quotation?.id,
        quoteNumber: quotation?.quoteNumber,
        destinationName: packageItem?.destinationName || product?.destinationName || quotation?.destinationName,
        customer: {
          leadTravelerName: leadTravelerName.trim(),
          bookerName: bookerName.trim() || undefined,
          email: email.trim(),
          phone: phone.trim(),
          agencyName: agencyName.trim() || undefined,
          agentRefNumber: agentRefNumber.trim() || undefined,
          flightDetails: flightDetails.trim() || undefined,
          pickupLocation: pickupLocation.trim() || undefined,
          specialRequests: specialRequests.trim() || undefined
        },
        items: bookingItems,
        currency: quotation ? quotation.currency : currency,
        totalAmount,
        totalNetCost,
        travelStartDate,
        travelEndDate
      }, currentUser);

      // Trigger automated 12-hour ground operations confirmation SLA via Google Calendar Automation Service
      try {
        await googleCalendarAutomation.triggerBookingConfirmationSLA(newBooking, currentUser);
      } catch (gcalErr) {
        console.debug('Google Calendar SLA automation note:', gcalErr);
      }

      setIsSubmitting(false);
      onBookingComplete(newBooking);
    } catch (err: any) {
      console.error('Booking submission error:', err);
      setErrorMessage('Failed to submit booking. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Modal Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 flex items-center justify-between shrink-0 border-b-2 border-[#00C6A6]">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
              <Send className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00E5C0] bg-white/10 px-2 py-0.5 rounded-md">
                  {packageItem ? 'Package Reservation Desk' : 'DMC Reservation Desk'}
                </span>
                <span className="text-[10px] text-slate-400 font-semibold">24–48h Ground Update SLA</span>
              </div>
              <h2 className="text-xl font-bold font-sans mt-0.5 text-white">
                {quotation 
                  ? `Book Entire Quotation (${quotation.quoteNumber})` 
                  : packageItem 
                  ? `Book Circuit: ${packageItem.title}`
                  : `Book Service: ${product?.name}`}
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            id="close-booking-modal-btn"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 24-48 Hour Notice Banner */}
        <div className="bg-emerald-50 border-b border-emerald-200 px-5 py-3 flex items-center justify-between text-xs shrink-0">
          <div className="flex items-center space-x-2 text-emerald-900 font-medium">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>
              <strong>Automated Notification:</strong> An instant confirmation email will be sent to both you and TheUnbound DMC Team. Your confirmed travel voucher will be updated in <strong>24–48 hours</strong>.
            </span>
          </div>
        </div>

        {/* Modal Body / Scroll Area */}
        <form onSubmit={handleSubmitBooking} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {errorMessage && (
            <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Product / Package / Itinerary Summary Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center space-x-1.5">
                <FileText className="w-3.5 h-3.5 text-[#008972]" />
                <span>Selected Reservation Itinerary</span>
              </span>
              <span className="text-xs font-mono font-bold text-slate-700">
                {quotation 
                  ? `${quotation.items?.length || 0} Products Included` 
                  : packageItem
                  ? `${packageItem.durationNights || packageItem.durationDays - 1}N / ${packageItem.durationDays}D Circuit`
                  : `SKU: ${product?.sku}`}
              </span>
            </div>

            {/* If Package Item: Summary and highlights */}
            {packageItem && (
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 rounded-md bg-[#008972] text-white text-[10px] font-black uppercase">
                      {packageItem.destinationName}
                    </span>
                    <span className="text-xs font-bold text-slate-900">
                      {packageItem.title}
                    </span>
                  </div>
                  <span className="text-xs font-mono font-bold text-[#008972]">
                    {formatCurrency(packagePerPaxPrice, currency)} <span className="text-[10px] text-slate-400 font-sans font-normal">/ pax</span>
                  </span>
                </div>

                {packageItem.routeSummary && packageItem.routeSummary.length > 0 && (
                  <div className="text-[11px] text-slate-600 flex items-center space-x-1 overflow-x-auto py-1">
                    <span className="font-semibold text-slate-400 shrink-0">Circuit:</span>
                    {packageItem.routeSummary.map((r, i) => (
                      <React.Fragment key={i}>
                        <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[10px] font-medium text-slate-700 shrink-0">{r}</span>
                        {i < packageItem.routeSummary.length - 1 && <span className="text-slate-400 font-bold shrink-0">→</span>}
                      </React.Fragment>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* If Single Product or Package: Configuration inputs (Travel Date, Pax) */}
            {(product || packageItem) && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-[#008972]" />
                    <span>Travel Start Date</span>
                  </label>
                  <input
                    type="date"
                    value={travelDate}
                    onChange={(e) => setTravelDate(e.target.value)}
                    min={new Date().toISOString().split('T')[0]}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-[#008972]" />
                    <span>Adults (12+ yrs)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={adults}
                    onChange={(e) => setAdults(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Children (2-11 yrs)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="50"
                    value={children}
                    onChange={(e) => setChildren(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center space-x-1">
                    <Users className="w-3.5 h-3.5 text-slate-400" />
                    <span>Infants (&lt;2 yrs)</span>
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="20"
                    value={infants}
                    onChange={(e) => setInfants(Math.max(0, parseInt(e.target.value) || 0))}
                    className="w-full bg-white border border-slate-200 rounded-xl p-2 text-xs font-semibold text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                  />
                </div>
              </div>
            )}

            {/* Addons Selection if single product */}
            {product?.addons && (product.addons || []).length > 0 && (
              <div className="pt-2 border-t border-slate-200">
                <span className="text-[11px] font-bold text-slate-700 block mb-2">
                  Optional Product Add-ons & Upgrades:
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {(product.addons || []).map((addon) => {
                    const isSelected = selectedAddonIds.includes(addon.id);
                    return (
                      <div
                        key={addon.id}
                        onClick={() => handleToggleAddon(addon.id)}
                        className={`p-2.5 rounded-xl border text-xs cursor-pointer transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        <div>
                          <span>{addon.name}</span>
                          <span className="block text-[10px] text-slate-500 font-normal">
                            +{formatCurrency(addon.pricePerPax, currency)} / pax
                          </span>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="w-4 h-4 text-[#008972] rounded-md focus:ring-0 cursor-pointer"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* If Quotation: List of quotation items */}
            {quotation && (
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                  {quotation.items.map((item, idx) => (
                    <div key={idx} className="bg-white p-2.5 rounded-xl border border-slate-200 text-xs flex items-center justify-between">
                      <div>
                        <span className="font-bold text-slate-900">{item.product.name}</span>
                        <span className="block text-[10px] text-slate-500">
                          📅 {item.travelDate} • 📍 {item.product.destinationName} • 👥 {item.pax.adults + item.pax.children} Pax
                        </span>
                      </div>
                      <span className="font-mono font-bold text-slate-900">
                        {formatCurrency(item.calculation.finalTotalSellingPrice, quotation.currency)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Total Pricing Box */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl flex items-center justify-between">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#00E5C0] block">
                  Total Quoted Price
                </span>
                <span className="text-xs text-slate-300">
                  Taxes, private guide & ground services included
                </span>
              </div>
              <div className="text-right">
                <span className="text-xl font-black font-mono text-[#00E5C0]">
                  {formatCurrency(totalAmount, quotation ? quotation.currency : currency)}
                </span>
              </div>
            </div>
          </div>

          {/* Traveler & Contact Information Section */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
              <UserCheck className="w-4 h-4 text-[#008972]" />
              <span>Contact & Traveler Details</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Lead Traveler Full Name *
                </label>
                <input
                  type="text"
                  value={leadTravelerName}
                  onChange={(e) => setLeadTravelerName(e.target.value)}
                  placeholder="e.g. Johnathan Smith"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Confirmation Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@agency.com"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:ring-1 focus:ring-[#00C6A6]"
                />
                <span className="text-[10px] text-slate-500 mt-0.5 block">
                  Booking receipt & 24-48h updates will be dispatched here.
                </span>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Phone / WhatsApp (with Country Code) *
                </label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91-9811654959"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 font-semibold focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Travel Agency / Booker Name (Optional)
                </label>
                <input
                  type="text"
                  value={agencyName}
                  onChange={(e) => setAgencyName(e.target.value)}
                  placeholder="e.g. Luxury Journeys Ltd"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>
          </div>

          {/* Logistics & Special Requirements */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-900 flex items-center space-x-2">
              <Plane className="w-4 h-4 text-[#008972]" />
              <span>Ground Logistics & Special Requests (Optional)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Flight Numbers & Arrival Times
                </label>
                <input
                  type="text"
                  value={flightDetails}
                  onChange={(e) => setFlightDetails(e.target.value)}
                  placeholder="e.g. JL 043 arriving NRT 14:30"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Hotel Pickup / Meeting Point
                </label>
                <input
                  type="text"
                  value={pickupLocation}
                  onChange={(e) => setPickupLocation(e.target.value)}
                  placeholder="e.g. Aman Tokyo Lobby or Heathrow Terminal 3"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Special Requests / Dietary / Accessibility Requirements
              </label>
              <textarea
                value={specialRequests}
                onChange={(e) => setSpecialRequests(e.target.value)}
                placeholder="Vegetarian meals, child booster seat, English/Spanish bilingual guide preferred..."
                rows={2}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-900 focus:ring-1 focus:ring-[#00C6A6]"
              />
            </div>
          </div>

          {/* Guarantee Security Seal */}
          <div className="p-4 rounded-2xl bg-slate-100 border border-slate-200 flex items-start space-x-3 text-xs">
            <ShieldCheck className="w-5 h-5 text-[#008972] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-bold text-slate-900 block">
                TheUnbound Direct DMC Operational Protocol
              </span>
              <p className="text-slate-600 text-[11px] leading-relaxed">
                By submitting this booking request, our ground operations desk immediately reserves roster allotments. An automated confirmation receipt will be dispatched to <strong>{email || 'your email'}</strong> and <strong>sales@theunbound.in</strong>. Your official voucher and final status will be updated within 24–48 hours.
              </p>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-2 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              id="submit-booking-action-btn"
              className="px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center space-x-2 cursor-pointer"
            >
              <Send className={`w-4 h-4 text-[#00E5C0] ${isSubmitting ? 'animate-pulse' : ''}`} />
              <span>{isSubmitting ? 'Submitting & Dispatching Emails...' : 'Submit Booking Request'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
