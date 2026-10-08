import React, { useState, useMemo } from 'react';
import { 
  QuoteItem, 
  CurrencyCode, 
  User, 
  Booking, 
  BookingItem, 
  BookingPassenger,
  AccommodationType
} from '../../types';
import { AppDatabase } from '../../services/db';
import { useAuth } from '../../context/AuthContext';
import { useQuotation } from '../../context/QuotationContext';
import { formatCurrency } from '../../services/pricingEngine';
import { googleCalendarAutomation } from '../../services/googleCalendarAutomationService';
import { 
  X, 
  CheckCircle2, 
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
  Hotel, 
  Car, 
  Compass, 
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Check,
  CreditCard,
  Luggage
} from 'lucide-react';

interface BookingSubmissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBackToCart: () => void;
  onBookingSuccess: (booking: Booking) => void;
}

export const BookingSubmissionModal: React.FC<BookingSubmissionModalProps> = ({
  isOpen,
  onClose,
  onBackToCart,
  onBookingSuccess
}) => {
  const { user } = useAuth();
  const { 
    items, 
    currency, 
    totalSellingPrice, 
    totalNetCost, 
    clearQuote,
    clientName,
    clientEmail,
    clientPhone,
    clientCompany,
    travelStartDate,
    travelEndDate,
    destination
  } = useQuotation();

  const db = AppDatabase.getInstance();

  // Active step in the submission wizard: 1 = Review Items, 2 = Customer Info, 3 = Passengers, 4 = Logistics & Submit
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);

  // Form State - Customer & Agency
  const [leadTravelerName, setLeadTravelerName] = useState<string>(
    clientName || ''
  );
  const [email, setEmail] = useState<string>(
    clientEmail || user?.email || ''
  );
  const [phone, setPhone] = useState<string>(
    clientPhone || '+91-'
  );
  const [agencyName, setAgencyName] = useState<string>(
    user?.agencyName || clientCompany || ''
  );
  const [agentName, setAgentName] = useState<string>(
    user?.name || ''
  );
  const [agentRefNumber, setAgentRefNumber] = useState<string>('');

  // Form State - Logistics & Special Requests
  const [flightDetails, setFlightDetails] = useState<string>('');
  const [pickupLocation, setPickupLocation] = useState<string>('');
  const [dropoffLocation, setDropoffLocation] = useState<string>('');
  const [specialRequests, setSpecialRequests] = useState<string>('');
  const [emergencyContact, setEmergencyContact] = useState<string>('');

  // Error and Submitting States
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  // Fetch saved B2B customers for instant autofill & CRM deduplication
  const savedCustomers = useMemo(() => {
    return user?.id ? db.getB2BCustomers(user.id) : [];
  }, [user?.id, db]);

  const handleSelectSavedCustomer = (customerId: string) => {
    if (!customerId) return;
    const found = savedCustomers.find(c => c.id === customerId);
    if (found) {
      handleLeadNameChange(found.name);
      if (found.email) setEmail(found.email);
      if (found.phone) setPhone(found.phone);
      if (found.company) setAgencyName(found.company);
    }
  };

  // Calculate Aggregated Pax from Cart Items
  const { maxAdults, maxChildren, maxInfants, totalPaxCount, earliestDate, latestDate, destinationsList } = useMemo(() => {
    let adults = 2;
    let children = 0;
    let infants = 0;
    const dates: string[] = [];
    const dests = new Set<string>();

    if (items.length > 0) {
      adults = Math.max(...items.map(i => i.pax.adults || 1));
      children = Math.max(...items.map(i => i.pax.children || 0));
      infants = Math.max(...items.map(i => i.pax.infants || 0));

      items.forEach(item => {
        const itemAny = item as any;
        if (item.travelDate) dates.push(item.travelDate);
        if (itemAny.hotelDetails?.checkInDate) dates.push(itemAny.hotelDetails.checkInDate);
        if (itemAny.hotelDetails?.checkOutDate) dates.push(itemAny.hotelDetails.checkOutDate);
        if (item.product.destinationName) dests.add(item.product.destinationName);
        if (item.product.city) dests.add(item.product.city);
      });
    }

    dates.sort();
    const todayStr = new Date().toISOString().split('T')[0];
    const eDate = dates.length > 0 ? dates[0] : (travelStartDate || todayStr);
    const lDate = dates.length > 0 ? dates[dates.length - 1] : (travelEndDate || eDate);

    return {
      maxAdults: Math.max(1, adults),
      maxChildren: children,
      maxInfants: infants,
      totalPaxCount: Math.max(1, adults) + children + infants,
      earliestDate: eDate,
      latestDate: lDate,
      destinationsList: Array.from(dests)
    };
  }, [items, travelStartDate, travelEndDate]);

  // Passengers State
  const [passengers, setPassengers] = useState<BookingPassenger[]>(() => {
    const initialPax: BookingPassenger[] = [];
    const count = Math.max(1, totalPaxCount || 2);

    for (let i = 1; i <= count; i++) {
      const isLead = i === 1;
      initialPax.push({
        id: `pax-${Date.now()}-${i}`,
        passengerNumber: i,
        firstName: isLead ? (leadTravelerName.split(' ')[0] || '') : '',
        lastName: isLead ? (leadTravelerName.split(' ').slice(1).join(' ') || '') : '',
        fullName: isLead ? leadTravelerName : '',
        gender: 'MALE',
        isLeadPax: isLead,
        nationality: 'Indian',
        phone: isLead ? phone : '',
        email: isLead ? email : '',
        passportNumber: '',
        passportExpiryDate: '',
        mealPreference: 'Standard',
        specialRequests: ''
      });
    }
    return initialPax;
  });

  // Sync lead passenger when leadTravelerName updates
  const handleLeadNameChange = (val: string) => {
    setLeadTravelerName(val);
    setPassengers(prev => {
      if (prev.length === 0) return prev;
      const updated = [...prev];
      const parts = val.trim().split(' ');
      updated[0] = {
        ...updated[0],
        firstName: parts[0] || '',
        lastName: parts.slice(1).join(' ') || '',
        fullName: val
      };
      return updated;
    });
  };

  const handleUpdatePassenger = (index: number, field: keyof BookingPassenger, value: any) => {
    setPassengers(prev => {
      const updated = [...prev];
      updated[index] = {
        ...updated[index],
        [field]: value
      };
      if (field === 'firstName' || field === 'lastName') {
        const fn = field === 'firstName' ? value : updated[index].firstName;
        const ln = field === 'lastName' ? value : updated[index].lastName;
        updated[index].fullName = `${fn} ${ln}`.trim();
        if (index === 0) {
          setLeadTravelerName(updated[index].fullName);
        }
      }
      return updated;
    });
  };

  const handleAddPassenger = () => {
    const nextNum = passengers.length + 1;
    setPassengers(prev => [
      ...prev,
      {
        id: `pax-${Date.now()}-${nextNum}`,
        passengerNumber: nextNum,
        firstName: '',
        lastName: '',
        fullName: '',
        gender: 'MALE',
        isLeadPax: false,
        nationality: 'Indian',
        passportNumber: '',
        passportExpiryDate: '',
        mealPreference: 'Standard',
        specialRequests: ''
      }
    ]);
  };

  const handleRemovePassenger = (index: number) => {
    if (index === 0) return; // Cannot remove lead passenger
    setPassengers(prev => prev.filter((_, idx) => idx !== index));
  };

  if (!isOpen) return null;

  // Validation before submission
  const validateSubmission = (): boolean => {
    setErrorMessage('');

    if (items.length === 0) {
      setErrorMessage('Your booking cart is empty. Please add products before submitting.');
      return false;
    }

    if (!leadTravelerName.trim()) {
      setErrorMessage('Please enter the Lead Traveler / Guest Name.');
      setCurrentStep(2);
      return false;
    }

    if (!email.trim() || !email.includes('@')) {
      setErrorMessage('Please enter a valid guest/client contact email.');
      setCurrentStep(2);
      return false;
    }

    if (!phone.trim() || phone.length < 7) {
      setErrorMessage('Please enter a valid phone or WhatsApp number.');
      setCurrentStep(2);
      return false;
    }

    return true;
  };

  // Submit Booking to Database
  const handleConfirmAndSubmitBooking = async () => {
    if (!validateSubmission()) return;

    setIsSubmitting(true);
    setErrorMessage('');

    try {
      // 1. Transform Cart Items into standard BookingItems
      const bookingItems: BookingItem[] = items.map((item, idx) => {
        const itemAny = item as any;
        const isHotel = !!item.accommodationType || item.isManualHotel || item.product.category?.toLowerCase().includes('hotel') || !!itemAny.hotelDetails;
        const isVisa = item.product.category?.toLowerCase().includes('visa') || !!itemAny.visaDetails;
        const isTransfer = item.product.category?.toLowerCase().includes('transfer') || !!itemAny.transferDetails;

        let category = item.product.category || 'Day Tour & Activity';
        if (isHotel) category = 'Hotel Accommodation';
        if (isVisa) category = 'Visa Processing';
        if (isTransfer) category = 'Ground Transfer';

        const serviceDate = item.travelDate || itemAny.hotelDetails?.checkInDate || earliestDate;

        let accommodationTypeVal: AccommodationType | undefined = undefined;
        if (item.accommodationType) {
          accommodationTypeVal = item.accommodationType;
        } else if (item.isManualHotel) {
          accommodationTypeVal = 'manual';
        } else if (isHotel) {
          accommodationTypeVal = 'master';
        }

        let supplierNotes = item.notes;
        if (itemAny.hotelDetails) {
          supplierNotes = `${itemAny.hotelDetails.nights || 1} Nights (${itemAny.hotelDetails.checkInDate || serviceDate} to ${itemAny.hotelDetails.checkOutDate || serviceDate}) • Room: ${itemAny.hotelDetails.roomName || 'Deluxe'} • Meal: ${itemAny.hotelDetails.mealPlan || 'BB'} • Rooms: ${itemAny.hotelDetails.roomsCount || 1}`;
        } else if (itemAny.visaDetails) {
          supplierNotes = `Visa Type: ${itemAny.visaDetails.visaType || 'Tourist'} • Nationality: ${itemAny.visaDetails.nationality || 'Indian'} • Applicants: ${itemAny.visaDetails.applicantsCount || 1} • Processing: ${itemAny.visaDetails.processingOption || 'Standard'}`;
        } else if (itemAny.transferDetails) {
          supplierNotes = `Vehicle: ${itemAny.transferDetails.vehicleType || 'Sedan'} • Pickup: ${itemAny.transferDetails.pickupLocation || 'Airport'} • Dropoff: ${itemAny.transferDetails.dropoffLocation || 'Hotel'} • Flight: ${itemAny.transferDetails.flightNumber || 'TBA'}`;
        }

        return {
          id: `item-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 5)}`,
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku || `TUB-${item.product.id.substring(0, 6).toUpperCase()}`,
          destinationName: item.product.destinationName || destination || 'Global',
          city: item.product.city || item.product.destinationName || '',
          category,
          travelDate: serviceDate,
          serviceDate,
          adults: item.pax.adults || 1,
          children: item.pax.children || 0,
          infants: item.pax.infants || 0,
          totalPax: (item.pax.adults || 1) + (item.pax.children || 0) + (item.pax.infants || 0),
          selectedAddonNames: item.selectedAddonIds?.map(aid => 
            item.product.addons?.find(a => a.id === aid)?.name || aid
          ),
          unitNetPrice: 0,
          unitSellingPrice: item.calculation.finalTotalSellingPrice,
          totalPrice: item.calculation.finalTotalSellingPrice,
          currency,
          supplierStatus: 'WAITING_FOR_SUPPLIER',
          accommodationType: accommodationTypeVal,
          supplierNotes
        };
      });

      // 2. Build Destination Name Summary
      const primaryDestination = destinationsList.length > 0 
        ? destinationsList.join(', ') 
        : (destination || 'Multi-Destination');

      // 3. Create Booking Record in Database
      const newBooking = db.createBooking({
        sourceType: 'B2B_PORTAL',
        destinationName: primaryDestination,
        customer: {
          leadTravelerName: leadTravelerName.trim(),
          bookerName: agentName.trim() || user?.name || undefined,
          email: email.trim(),
          phone: phone.trim(),
          agencyName: agencyName.trim() || user?.agencyName || undefined,
          agentRefNumber: agentRefNumber.trim() || undefined,
          flightDetails: flightDetails.trim() || undefined,
          pickupLocation: pickupLocation.trim() || undefined,
          specialRequests: [
            specialRequests.trim(),
            emergencyContact.trim() ? `Emergency Contact: ${emergencyContact.trim()}` : '',
            dropoffLocation.trim() ? `Drop-off: ${dropoffLocation.trim()}` : ''
          ].filter(Boolean).join(' | ') || undefined
        },
        items: bookingItems,
        currency,
        totalAmount: totalSellingPrice,
        totalNetCost,
        travelStartDate: earliestDate,
        travelEndDate: latestDate
      }, user);

      // 4. Attach Passengers & Enhanced Metadata
      newBooking.passengers = passengers.map((p, index) => ({
        ...p,
        passengerNumber: index + 1,
        isLeadPax: index === 0,
        fullName: p.fullName || `${p.firstName} ${p.lastName}`.trim() || (index === 0 ? leadTravelerName : `Passenger ${index + 1}`)
      }));

      newBooking.agentId = user?.id;
      newBooking.agentName = user?.name;
      newBooking.agentAgency = user?.agencyName || agencyName;

      // Save updated booking
      db.saveBooking(newBooking, user);

      // 5. Track in Lead Management CRM
      try {
        db.captureLeadFromSource({
          source: 'B2B_PARTNER',
          contactName: leadTravelerName.trim(),
          email: email.trim(),
          phone: phone.trim(),
          agencyName: agencyName.trim() || user?.agencyName || undefined,
          destinationName: primaryDestination,
          travelStartDate: earliestDate,
          travelEndDate: latestDate,
          paxAdults: maxAdults,
          paxChildren: maxChildren,
          paxInfants: maxInfants,
          currency,
          estimatedBudget: totalSellingPrice,
          bookingId: newBooking.id,
          bookingReference: newBooking.bookingReference,
          bookingValue: newBooking.totalAmount
        }, user);
      } catch (crmErr) {
        console.debug('Lead tracking note:', crmErr);
      }

      // 6. Trigger 12-hour Operations Confirmation SLA & Google Calendar notification
      try {
        await googleCalendarAutomation.triggerBookingConfirmationSLA(newBooking, user);
      } catch (gcalErr) {
        console.debug('Google Calendar SLA automation note:', gcalErr);
      }

      // 7. Clear the submitted active Cart
      clearQuote();

      setIsSubmitting(false);
      onBookingSuccess(newBooking);
    } catch (err: any) {
      console.error('Error submitting B2B booking:', err);
      setIsSubmitting(false);
      setErrorMessage(err.message || 'An error occurred while submitting your booking. Please try again.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-auto max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-5 sm:p-6 relative overflow-hidden shrink-0 border-b-2 border-[#00C6A6]">
          <div className="flex items-start justify-between relative z-10">
            <div className="flex items-center space-x-3.5">
              <div className="w-12 h-12 rounded-2xl bg-[#00C6A6]/20 border border-[#00C6A6]/40 flex items-center justify-center text-[#00E5C0]">
                <Send className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00E5C0] bg-white/10 px-2 py-0.5 rounded-md">
                    Direct B2B Booking
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {items.length} {items.length === 1 ? 'Product' : 'Products'}
                  </span>
                </div>
                <h2 className="text-2xl font-black font-sans mt-0.5 text-white">
                  Submit Booking Request
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Review selected cart items and enter guest details to confirm your reservation.
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-slate-400 hover:text-white p-2 rounded-xl hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Wizard Step Tabs */}
          <div className="flex items-center justify-between mt-6 pt-4 border-t border-slate-800 text-xs">
            {[
              { num: 1, label: '1. Cart Review' },
              { num: 2, label: '2. Customer Info' },
              { num: 3, label: '3. Passengers' },
              { num: 4, label: '4. Logistics & Review' },
            ].map((step) => {
              const isActive = currentStep === step.num;
              const isDone = currentStep > step.num;
              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num as any)}
                  className={`flex items-center space-x-2 px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer ${
                    isActive 
                      ? 'bg-[#00C6A6] text-slate-950 shadow-md shadow-[#00C6A6]/20' 
                      : isDone 
                      ? 'text-[#00E5C0] bg-slate-800 hover:bg-slate-700' 
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full text-[10px] font-black flex items-center justify-center ${
                    isActive ? 'bg-slate-950 text-[#00C6A6]' : isDone ? 'bg-[#00C6A6] text-slate-950' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {isDone ? '✓' : step.num}
                  </span>
                  <span className="hidden sm:inline">{step.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Error Alert Banner */}
        {errorMessage && (
          <div className="bg-rose-50 border-b border-rose-200 p-4 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2 font-medium">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
            <button
              onClick={() => setErrorMessage('')}
              className="text-rose-500 hover:text-rose-800 font-bold ml-2 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Scrollable Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">

          {/* STEP 1: CART ITEMS & READINESS REVIEW */}
          {currentStep === 1 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                    <Luggage className="w-5 h-5 text-[#00C6A6]" />
                    <span>Cart Items Readiness & Service Breakdown</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Verify all products and services queued for immediate booking dispatch.
                  </p>
                </div>
                <button
                  onClick={onBackToCart}
                  className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                >
                  ← Edit in Cart
                </button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {items.map((item, idx) => {
                  const itemAny = item as any;
                  const isHotel = !!item.accommodationType || item.isManualHotel || item.product.category?.toLowerCase().includes('hotel') || !!itemAny.hotelDetails;
                  const isVisa = item.product.category?.toLowerCase().includes('visa') || !!itemAny.visaDetails;
                  const isTransfer = item.product.category?.toLowerCase().includes('transfer') || !!itemAny.transferDetails;

                  return (
                    <div 
                      key={item.id || idx}
                      className="bg-slate-50 rounded-2xl p-4 border border-slate-200 hover:border-slate-300 transition-all flex flex-col md:flex-row md:items-center justify-between gap-4"
                    >
                      <div className="flex items-start space-x-3.5 flex-1 min-w-0">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                          isHotel ? 'bg-amber-100 text-amber-700' :
                          isVisa ? 'bg-teal-100 text-teal-700' :
                          isTransfer ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {isHotel ? <Hotel className="w-5 h-5" /> :
                           isVisa ? <FileText className="w-5 h-5" /> :
                           isTransfer ? <Car className="w-5 h-5" /> : <Compass className="w-5 h-5" />}
                        </div>

                        <div className="flex-1 min-w-0 space-y-1">
                          <div className="flex items-center space-x-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                              {isHotel ? 'Hotel Stay' : isVisa ? 'Visa Service' : isTransfer ? 'Transfer' : 'Activity / Tour'}
                            </span>
                            <span className="text-xs text-slate-500 font-medium">
                              {item.product.city || item.product.destinationName}
                            </span>
                          </div>

                          <h4 className="text-sm font-bold text-slate-900 truncate">
                            {item.product.name}
                          </h4>

                          {/* Specific configurations */}
                          {isHotel && itemAny.hotelDetails && (
                            <p className="text-[11px] text-amber-800 font-medium bg-amber-50/80 px-2 py-0.5 rounded-md inline-block">
                              {itemAny.hotelDetails.nights} Nights ({itemAny.hotelDetails.checkInDate} to {itemAny.hotelDetails.checkOutDate}) • {itemAny.hotelDetails.roomName || 'Deluxe'} • {itemAny.hotelDetails.mealPlan || 'Breakfast'} • {itemAny.hotelDetails.roomsCount || 1} Room(s)
                            </p>
                          )}

                          {isVisa && itemAny.visaDetails && (
                            <p className="text-[11px] text-teal-800 font-medium bg-teal-50/80 px-2 py-0.5 rounded-md inline-block">
                              {itemAny.visaDetails.visaType} • Nationality: {itemAny.visaDetails.nationality} • {itemAny.visaDetails.applicantsCount} Applicants • {itemAny.visaDetails.processingOption || 'Standard Processing'}
                            </p>
                          )}

                          {!isHotel && !isVisa && (
                            <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                              <span className="flex items-center space-x-1">
                                <Calendar className="w-3 h-3 text-slate-400" />
                                <span>{item.travelDate || 'Date Confirmed'}</span>
                              </span>
                              <span>•</span>
                              <span className="flex items-center space-x-1">
                                <Users className="w-3 h-3 text-slate-400" />
                                <span>{item.pax.adults} Adults {item.pax.children > 0 ? `, ${item.pax.children} Ch.` : ''}</span>
                              </span>
                              {item.selectedAddonIds && item.selectedAddonIds.length > 0 && (
                                <>
                                  <span>•</span>
                                  <span className="text-emerald-700 font-medium">
                                    +{item.selectedAddonIds.length} Add-ons
                                  </span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Item Price & Status Badge */}
                      <div className="flex items-center justify-between md:flex-col md:items-end md:justify-center border-t md:border-t-0 pt-2 md:pt-0 border-slate-200">
                        <span className="inline-flex items-center space-x-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                          <Check className="w-3 h-3" />
                          <span>Ready to Book</span>
                        </span>
                        <div className="text-right mt-1">
                          <span className="text-xs text-slate-400 block font-medium">Item Subtotal</span>
                          <span className="text-sm font-extrabold text-slate-900 font-mono">
                            {formatCurrency(item.calculation.finalTotalSellingPrice, currency)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Price Summary Banner */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center space-x-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold">
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-emerald-950 block">
                      Total Booking Value ({items.length} Services)
                    </span>
                    <span className="text-[11px] text-emerald-700 font-medium">
                      All taxes, fees & surcharges included
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-xl font-black text-slate-950 font-mono">
                    {formatCurrency(totalSellingPrice, currency)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: CUSTOMER & AGENCY INFO */}
          {currentStep === 2 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                  <UserCheck className="w-5 h-5 text-[#00C6A6]" />
                  <span>Lead Traveler & Booking Agency Details</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Enter the primary contact person for vouchers, updates, and on-ground coordination.
                </p>
              </div>

              {/* Authenticated Submitting Agent Attribution Banner */}
              {user && (
                <div className="p-3.5 rounded-2xl bg-teal-50/80 border border-teal-200/80 flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 rounded-xl bg-[#008f77] text-white flex items-center justify-center font-bold shrink-0">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-teal-950">
                        Submitting Partner Agent: {user.name}
                      </p>
                      <p className="text-[11px] text-teal-700 font-medium">
                        Agency: {user.agencyName || user.companyName || 'Independent Agent'} • Partner UID: <span className="font-mono">{user.id}</span>
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-full bg-teal-100 text-teal-800 font-extrabold text-[10px] uppercase tracking-wider shrink-0">
                    Auto-Linked Booker
                  </span>
                </div>
              )}

              {/* Instant Autofill from Saved CRM Customers (Prevents Duplicate Records) */}
              {savedCustomers.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="text-xs text-slate-600">
                    <span className="font-bold text-slate-800 block">Existing Client in CRM?</span>
                    <span className="text-[11px] text-slate-500">Autofill to sync traveler record without creating duplicates</span>
                  </div>
                  <select
                    onChange={(e) => handleSelectSavedCustomer(e.target.value)}
                    defaultValue=""
                    className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-bold text-slate-800 focus:outline-hidden focus:border-[#00C6A6] shrink-0"
                  >
                    <option value="">-- Choose Existing Client --</option>
                    {savedCustomers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.email ? `(${c.email})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Lead Traveler / Customer Name <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={leadTravelerName}
                    onChange={(e) => handleLeadNameChange(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Primary Contact Email <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="e.g. rajesh.sharma@example.com"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Phone / WhatsApp Contact <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+91-9876543210"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Agency / Company Name
                  </label>
                  <input
                    type="text"
                    value={agencyName}
                    onChange={(e) => setAgencyName(e.target.value)}
                    placeholder="e.g. Apex Luxury Voyages"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Booking Agent Name
                  </label>
                  <input
                    type="text"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                    placeholder="e.g. Agent Name"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Agent Reference / Internal File No. <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={agentRefNumber}
                    onChange={(e) => setAgentRefNumber(e.target.value)}
                    placeholder="e.g. APEX-2026-JP-084"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: PASSENGER MANIFEST */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                    <Users className="w-5 h-5 text-[#00C6A6]" />
                    <span>Passenger Manifest ({passengers.length} Guests)</span>
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure guest details for hotel room allocation, tour manifests, and visas.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleAddPassenger}
                  className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors cursor-pointer flex items-center space-x-1"
                >
                  <span>Add Guest</span>
                </button>
              </div>

              <div className="space-y-4">
                {passengers.map((pax, index) => (
                  <div
                    key={pax.id}
                    className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="w-6 h-6 rounded-full bg-slate-900 text-white text-xs font-black flex items-center justify-center">
                          {index + 1}
                        </span>
                        <span className="text-xs font-bold text-slate-900">
                          {index === 0 ? 'Lead Passenger (Primary Contact)' : `Passenger ${index + 1}`}
                        </span>
                        {index === 0 && (
                          <span className="text-[10px] font-extrabold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full">
                            Lead Guest
                          </span>
                        )}
                      </div>

                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePassenger(index)}
                          className="text-xs text-rose-500 hover:text-rose-700 font-bold cursor-pointer"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          First Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={pax.firstName}
                          onChange={(e) => handleUpdatePassenger(index, 'firstName', e.target.value)}
                          placeholder="e.g. Rajesh"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Last Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={pax.lastName}
                          onChange={(e) => handleUpdatePassenger(index, 'lastName', e.target.value)}
                          placeholder="e.g. Sharma"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Gender
                        </label>
                        <select
                          value={pax.gender}
                          onChange={(e) => handleUpdatePassenger(index, 'gender', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                        >
                          <option value="MALE">Male</option>
                          <option value="FEMALE">Female</option>
                          <option value="OTHER">Other</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Nationality
                        </label>
                        <input
                          type="text"
                          value={pax.nationality}
                          onChange={(e) => handleUpdatePassenger(index, 'nationality', e.target.value)}
                          placeholder="e.g. Indian"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Passport Number <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <input
                          type="text"
                          value={pax.passportNumber}
                          onChange={(e) => handleUpdatePassenger(index, 'passportNumber', e.target.value)}
                          placeholder="e.g. Z1234567"
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900 font-mono"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 mb-1">
                          Meal Preference
                        </label>
                        <select
                          value={pax.mealPreference}
                          onChange={(e) => handleUpdatePassenger(index, 'mealPreference', e.target.value)}
                          className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-white text-slate-900"
                        >
                          <option value="Standard">Standard / Any</option>
                          <option value="Vegetarian">Vegetarian</option>
                          <option value="Jain Vegetarian">Jain Vegetarian</option>
                          <option value="Vegan">Vegan</option>
                          <option value="Halal">Halal</option>
                          <option value="Gluten-Free">Gluten-Free</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: LOGISTICS & FINAL REVIEW */}
          {currentStep === 4 && (
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-black text-slate-900 flex items-center space-x-2">
                  <Plane className="w-5 h-5 text-[#00C6A6]" />
                  <span>Ground Logistics & Special Operations Remarks</span>
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Provide flight information and ground coordination preferences for swift dispatch.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Flight Details / Arrival Timings
                  </label>
                  <input
                    type="text"
                    value={flightDetails}
                    onChange={(e) => setFlightDetails(e.target.value)}
                    placeholder="e.g. SQ 638 (Arr 16:30 @ HND) / NH 880 (Dep 11:20)"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Pickup Location / Meeting Point
                  </label>
                  <input
                    type="text"
                    value={pickupLocation}
                    onChange={(e) => setPickupLocation(e.target.value)}
                    placeholder="e.g. Haneda Airport Terminal 3 Arrival Hall"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Special Requests / Dietary / Rooming Instructions
                  </label>
                  <textarea
                    rows={3}
                    value={specialRequests}
                    onChange={(e) => setSpecialRequests(e.target.value)}
                    placeholder="e.g. Non-smoking room, high floor, honeymoon anniversary cake, wheelchair assistance at airport transfer."
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 focus:outline-hidden focus:border-[#00C6A6] text-sm text-slate-900 bg-white"
                  />
                </div>
              </div>

              {/* Final Dossier Summary Card */}
              <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-4">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-extrabold uppercase tracking-widest text-[#00E5C0]">
                      Booking Dossier Preview
                    </span>
                    <h4 className="text-base font-bold text-white">
                      {leadTravelerName || 'Guest Reservation'} ({passengers.length} Pax)
                    </h4>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] font-bold text-slate-400 block">Total Due</span>
                    <span className="text-lg font-black text-[#00E5C0] font-mono">
                      {formatCurrency(totalSellingPrice, currency)}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-slate-400 block text-[11px]">Primary Contact</span>
                    <span className="font-bold text-white truncate block">{leadTravelerName || '—'}</span>
                    <span className="text-slate-400 text-[10px] truncate block">{email}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Travel Window</span>
                    <span className="font-bold text-white block">{earliestDate}</span>
                    <span className="text-slate-400 text-[10px] block">to {latestDate}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Services Queued</span>
                    <span className="font-bold text-white block">{items.length} Products</span>
                    <span className="text-slate-400 text-[10px] block">{destinationsList.slice(0, 2).join(', ')}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[11px]">Operations SLA</span>
                    <span className="font-bold text-emerald-400 block">24–48 Hours</span>
                    <span className="text-slate-400 text-[10px] block">Direct Dispatch</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer Controls */}
        <div className="bg-slate-50 px-6 py-4 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="flex items-center space-x-2 w-full sm:w-auto">
            <button
              type="button"
              onClick={onBackToCart}
              className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1"
            >
              <span>Back to Cart</span>
            </button>
          </div>

          <div className="flex items-center space-x-3 w-full sm:w-auto">
            {currentStep > 1 && (
              <button
                type="button"
                onClick={() => setCurrentStep(prev => (prev - 1) as any)}
                className="w-full sm:w-auto px-4 py-2.5 bg-white border border-slate-200 text-slate-800 hover:bg-slate-100 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center justify-center space-x-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            )}

            {currentStep < 4 ? (
              <button
                type="button"
                onClick={() => {
                  if (currentStep === 2 && !leadTravelerName.trim()) {
                    setErrorMessage('Please enter the Lead Traveler Name before continuing.');
                    return;
                  }
                  setErrorMessage('');
                  setCurrentStep(prev => (prev + 1) as any);
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center space-x-1.5 shadow-xs"
              >
                <span>Continue</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            ) : (
              <button
                id="btn-confirm-submit-booking"
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmAndSubmitBooking}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#00C6A6] hover:bg-[#00E5C0] text-slate-950 font-black rounded-xl text-xs transition-all cursor-pointer shadow-md shadow-[#00C6A6]/20 flex items-center justify-center space-x-2 disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                    <span>Processing Booking Submission...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>CONFIRM & SUBMIT BOOKING</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};
