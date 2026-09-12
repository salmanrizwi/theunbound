import { 
  LeadStageConfig, 
  LeadPipelineStageId, 
  TravelLead, 
  LeadScoreFactor, 
  Booking, 
  BookingProgressStage, 
  OperationsCalendarEvent, 
  PaymentSchedule, 
  BookingFinancialProfitability,
  Supplier,
  SupplierRequest
} from '../types';

/**
 * 15 Odoo-Style CRM Pipeline Stages with SLA hours, win probabilities, and default statuses
 */
export const DEFAULT_LEAD_STAGES: LeadStageConfig[] = [
  {
    id: 'NEW_ENQUIRY',
    name: 'New Enquiry',
    order: 1,
    color: '#6366F1', // Indigo
    probability: 10,
    slaDurationHours: 4,
    isActive: true,
    defaultLeadStatus: 'NEW'
  },
  {
    id: 'CONTACTED',
    name: 'Contacted',
    order: 2,
    color: '#3B82F6', // Blue
    probability: 20,
    slaDurationHours: 12,
    isActive: true,
    defaultLeadStatus: 'CONTACTED'
  },
  {
    id: 'QUALIFICATION_REQUIRED',
    name: 'Qualification Required',
    order: 3,
    color: '#EC4899', // Pink
    probability: 30,
    slaDurationHours: 24,
    isActive: true,
    defaultLeadStatus: 'QUALIFIED'
  },
  {
    id: 'REQUIREMENTS_COLLECTED',
    name: 'Requirements Collected',
    order: 4,
    color: '#8B5CF6', // Purple
    probability: 40,
    slaDurationHours: 24,
    isActive: true,
    defaultLeadStatus: 'QUALIFIED'
  },
  {
    id: 'PLANNING_IN_PROGRESS',
    name: 'Planning in Progress',
    order: 5,
    color: '#14B8A6', // Teal
    probability: 50,
    slaDurationHours: 36,
    isActive: true,
    defaultLeadStatus: 'QUOTE_CREATED'
  },
  {
    id: 'QUOTE_DRAFTED',
    name: 'Quote Drafted',
    order: 6,
    color: '#06B6D4', // Cyan
    probability: 60,
    slaDurationHours: 24,
    isActive: true,
    defaultLeadStatus: 'QUOTE_CREATED'
  },
  {
    id: 'QUOTE_SENT',
    name: 'Quote Sent',
    order: 7,
    color: '#0EA5E9', // Sky
    probability: 70,
    slaDurationHours: 48,
    isActive: true,
    defaultLeadStatus: 'QUOTED'
  },
  {
    id: 'FOLLOW_UP_REQUIRED',
    name: 'Follow-up Required',
    order: 8,
    color: '#F59E0B', // Amber
    probability: 70,
    slaDurationHours: 48,
    isActive: true,
    defaultLeadStatus: 'FOLLOW_UP'
  },
  {
    id: 'NEGOTIATION',
    name: 'Negotiation',
    order: 9,
    color: '#D97706', // Warm Amber
    probability: 80,
    slaDurationHours: 72,
    isActive: true,
    defaultLeadStatus: 'FOLLOW_UP'
  },
  {
    id: 'BOOKING_EXPECTED',
    name: 'Booking Expected',
    order: 10,
    color: '#10B981', // Emerald
    probability: 90,
    slaDurationHours: 48,
    isActive: true,
    defaultLeadStatus: 'BOOKING_SUBMITTED'
  },
  {
    id: 'BOOKING_CONFIRMED',
    name: 'Booking Confirmed',
    order: 11,
    color: '#059669', // Deep Emerald
    probability: 95,
    slaDurationHours: 24,
    isActive: true,
    defaultLeadStatus: 'CONFIRMED'
  },
  {
    id: 'WON',
    name: 'Won',
    order: 12,
    color: '#047857', // Forest
    probability: 100,
    isActive: true,
    isWon: true,
    defaultLeadStatus: 'WON'
  },
  {
    id: 'LOST',
    name: 'Lost',
    order: 13,
    color: '#EF4444', // Red
    probability: 0,
    isActive: true,
    isLost: true,
    defaultLeadStatus: 'LOST'
  },
  {
    id: 'ON_HOLD',
    name: 'On Hold',
    order: 14,
    color: '#64748B', // Slate
    probability: 25,
    isActive: true,
    defaultLeadStatus: 'FOLLOW_UP'
  },
  {
    id: 'INVALID_OR_DUPLICATE',
    name: 'Invalid or Duplicate',
    order: 15,
    color: '#94A3B8', // Muted Slate
    probability: 0,
    isActive: true,
    isLost: true,
    defaultLeadStatus: 'ARCHIVED'
  }
];

/**
 * 15 Customer-Facing Booking Progress Stages
 */
export interface CustomerProgressStageDef {
  stage: BookingProgressStage;
  stepNumber: number;
  label: string;
  customerTitle: string;
  customerDescription: string;
  color: string;
  isTerminal?: boolean;
}

export const CUSTOMER_PROGRESS_STAGES: CustomerProgressStageDef[] = [
  {
    stage: 'ENQUIRY_RECEIVED',
    stepNumber: 1,
    label: 'Enquiry Received',
    customerTitle: 'Enquiry Received & Logged',
    customerDescription: 'Your travel inquiry has been received and entered into our itinerary planning system.',
    color: '#6366F1'
  },
  {
    stage: 'REQUIREMENTS_REVIEW',
    stepNumber: 2,
    label: 'Under Review',
    customerTitle: 'Requirements Under Specialist Review',
    customerDescription: 'A destination specialist is reviewing your travel dates, passenger requirements, and hotel tier.',
    color: '#3B82F6'
  },
  {
    stage: 'PROPOSAL_PREPARING',
    stepNumber: 3,
    label: 'Proposal Preparing',
    customerTitle: 'Crafting Custom Proposal',
    customerDescription: 'We are assembling the ideal hotels, transfers, and sightseeing options with ground partners.',
    color: '#8B5CF6'
  },
  {
    stage: 'PROPOSAL_SENT',
    stepNumber: 4,
    label: 'Proposal Sent',
    customerTitle: 'Quotation Proposal Shared',
    customerDescription: 'Your custom itinerary proposal with transparent price breakdowns is available for review.',
    color: '#0EA5E9'
  },
  {
    stage: 'BOOKING_REQUEST_RECEIVED',
    stepNumber: 5,
    label: 'Booking Requested',
    customerTitle: 'Booking Request Received',
    customerDescription: 'Your booking request has been confirmed by your travel advisor and dispatched to operations.',
    color: '#06B6D4'
  },
  {
    stage: 'BOOKING_PROCESSING',
    stepNumber: 6,
    label: 'Under Processing',
    customerTitle: 'Booking Under Processing',
    customerDescription: 'Operations team has initiated allotment locks and reservation matching across destinations.',
    color: '#14B8A6'
  },
  {
    stage: 'SUPPLIER_CONFIRMATION_IN_PROGRESS',
    stepNumber: 7,
    label: 'Supplier Confirmations',
    customerTitle: 'Securing Ground Partners',
    customerDescription: 'Contracted hotels, licensed transport providers, and activity curators are securing allocations.',
    color: '#F59E0B'
  },
  {
    stage: 'PAYMENT_PENDING',
    stepNumber: 8,
    label: 'Payment Pending',
    customerTitle: 'Payment Schedule Active',
    customerDescription: 'Deposit or invoice settlement requested to guarantee supplier allotments and ticket issuance.',
    color: '#EAB308'
  },
  {
    stage: 'DOCUMENTS_PENDING',
    stepNumber: 9,
    label: 'Documents Pending',
    customerTitle: 'Passenger Documentation Required',
    customerDescription: 'Please ensure passport copies, visa documents, and passenger manifests are fully uploaded.',
    color: '#D97706'
  },
  {
    stage: 'PARTIALLY_CONFIRMED',
    stepNumber: 10,
    label: 'Partially Confirmed',
    customerTitle: 'Key Services Confirmed',
    customerDescription: 'Major elements (hotels/flights) confirmed; final vouchers and local transfers being finalized.',
    color: '#84CC16'
  },
  {
    stage: 'BOOKING_CONFIRMED',
    stepNumber: 11,
    label: 'Booking Confirmed',
    customerTitle: '100% Confirmed by Operations',
    customerDescription: 'All hotels, ground transport, activities, and logistics are fully confirmed and guaranteed.',
    color: '#10B981'
  },
  {
    stage: 'VOUCHERS_READY',
    stepNumber: 12,
    label: 'Vouchers Ready',
    customerTitle: 'Vouchers & Travel Docs Ready',
    customerDescription: 'Official hotel vouchers, tour passes, transfer details, and emergency contacts are ready to download.',
    color: '#059669'
  },
  {
    stage: 'TRAVEL_SUPPORT_ACTIVE',
    stepNumber: 13,
    label: 'Travel Support Active',
    customerTitle: 'Active Trip & 24/7 Concierge',
    customerDescription: 'Our on-ground operations desk and 24/7 traveler support line are live for your journey.',
    color: '#047857'
  },
  {
    stage: 'TRIP_COMPLETED',
    stepNumber: 14,
    label: 'Trip Completed',
    customerTitle: 'Journey Completed',
    customerDescription: 'Thank you for traveling with TheUnbound. We hope your travel memories were unforgettable.',
    color: '#0F766E',
    isTerminal: true
  },
  {
    stage: 'CANCELLED',
    stepNumber: 15,
    label: 'Cancelled',
    customerTitle: 'Booking Cancelled',
    customerDescription: 'This reservation has been cancelled. Any eligible refund is processed per policy.',
    color: '#EF4444',
    isTerminal: true
  }
];

/**
 * Transparent Multi-Factor Lead Scoring Algorithm
 * Returns score (0 - 100) and clear factor breakdown
 */
export function calculateTransparentLeadScore(lead: Partial<TravelLead>): {
  totalScore: number;
  factors: LeadScoreFactor[];
} {
  const factors: LeadScoreFactor[] = [];

  // Factor 1: Destination Relevance (Max 20 pts)
  if (lead.destinationId && lead.destinationName) {
    factors.push({
      factor: 'Target Destination Defined',
      points: 20,
      maxPoints: 20,
      explanation: `Explicit destination specified: ${lead.destinationName}`
    });
  } else {
    factors.push({
      factor: 'Target Destination Defined',
      points: 5,
      maxPoints: 20,
      explanation: 'Open or unspecified destination inquiry'
    });
  }

  // Factor 2: Travel Dates Proximity & Completeness (Max 20 pts)
  if (lead.travelStartDate || (lead.travelDates && !lead.travelDates.includes('Flexible'))) {
    factors.push({
      factor: 'Concrete Travel Dates',
      points: 20,
      maxPoints: 20,
      explanation: `Specific dates scheduled: ${lead.travelDates || lead.travelStartDate}`
    });
  } else if (lead.travelDates) {
    factors.push({
      factor: 'Concrete Travel Dates',
      points: 10,
      maxPoints: 20,
      explanation: 'Flexible travel timeframe indicated'
    });
  } else {
    factors.push({
      factor: 'Concrete Travel Dates',
      points: 0,
      maxPoints: 20,
      explanation: 'No travel dates provided yet'
    });
  }

  // Factor 3: Passenger Count & Volume (Max 20 pts)
  const totalPax = (lead.paxAdults || 0) + (lead.paxChildren || 0);
  if (totalPax >= 8) {
    factors.push({
      factor: 'Party Size / High-Yield Group',
      points: 20,
      maxPoints: 20,
      explanation: `Large group of ${totalPax} travelers (high yield potential)`
    });
  } else if (totalPax >= 2) {
    factors.push({
      factor: 'Party Size / Standard FIT',
      points: 15,
      maxPoints: 20,
      explanation: `Standard travel party of ${totalPax} passengers`
    });
  } else if (totalPax === 1) {
    factors.push({
      factor: 'Party Size / Solo Traveler',
      points: 10,
      maxPoints: 20,
      explanation: 'Single traveler booking inquiry'
    });
  } else {
    factors.push({
      factor: 'Party Size / Not Specified',
      points: 5,
      maxPoints: 20,
      explanation: 'Passenger headcount not specified'
    });
  }

  // Factor 4: Budget Clarity & Commercial Value (Max 20 pts)
  if ((lead.estimatedBudget && lead.estimatedBudget > 0) || (lead.expectedRevenue && lead.expectedRevenue > 0)) {
    const val = lead.expectedRevenue || lead.estimatedBudget || 0;
    const pts = val > 5000 ? 20 : val > 2000 ? 15 : 10;
    factors.push({
      factor: 'Budget & Commercial Clarity',
      points: pts,
      maxPoints: 20,
      explanation: `Clear budget defined (${lead.currency || 'EUR'} ${val.toLocaleString()})`
    });
  } else {
    factors.push({
      factor: 'Budget & Commercial Clarity',
      points: 5,
      maxPoints: 20,
      explanation: 'Budget has not been stated yet'
    });
  }

  // Factor 5: Channel Quality & Account Trust (Max 20 pts)
  if (lead.b2bAgentId || lead.userType === 'B2B_AGENT') {
    factors.push({
      factor: 'Verified B2B Partner Agency',
      points: 20,
      maxPoints: 20,
      explanation: `Verified contracted agency partner (${lead.agencyName || 'Contracted Partner'})`
    });
  } else if (lead.source === 'BOOKING_SUBMISSION' || lead.source === 'QUOTATION_SAVED') {
    factors.push({
      factor: 'High-Intent Digital Funnel',
      points: 18,
      maxPoints: 20,
      explanation: 'Generated via quotation configuration / booking flow'
    });
  } else if (lead.phone && lead.email) {
    factors.push({
      factor: 'Complete Contact Details',
      points: 12,
      maxPoints: 20,
      explanation: 'Both valid phone and email provided'
    });
  } else {
    factors.push({
      factor: 'Incomplete Contact Channel',
      points: 5,
      maxPoints: 20,
      explanation: 'Partial contact information'
    });
  }

  const totalScore = Math.min(100, factors.reduce((sum, f) => sum + f.points, 0));
  return { totalScore, factors };
}

/**
 * Calculates financial profitability & margin for a booking
 */
export function calculateBookingProfitability(booking: Booking): BookingFinancialProfitability {
  const sellingPrice = booking.totalAmount || 0;
  
  // Calculate sourcing costs across items or allocated suppliers
  let totalSupplierCost = 0;
  if (booking.totalNetCost && booking.totalNetCost > 0) {
    totalSupplierCost = booking.totalNetCost;
  } else if (booking.supplierTotalCost && booking.supplierTotalCost > 0) {
    totalSupplierCost = booking.supplierTotalCost;
  } else if (booking.items && booking.items.length > 0) {
    totalSupplierCost = booking.items.reduce((acc, item) => {
      const net = (item.unitNetPrice || (item.unitSellingPrice * 0.8)) * (item.totalPax || 1);
      return acc + net;
    }, 0);
  } else {
    // Default estimated 80% cost (20% margin)
    totalSupplierCost = Math.round(sellingPrice * 0.8);
  }

  const grossMarginAmount = Math.max(0, sellingPrice - totalSupplierCost);
  const grossMarginPercent = sellingPrice > 0 ? Math.round((grossMarginAmount / sellingPrice) * 100) : 0;
  
  // Agency commission if booked by B2B agent (e.g. 5-10% of selling)
  const agencyCommissionAmount = booking.customer?.agencyName ? Math.round(sellingPrice * 0.05) : 0;
  const netProfitAmount = Math.max(0, grossMarginAmount - agencyCommissionAmount);
  const netProfitMarginPercent = sellingPrice > 0 ? Math.round((netProfitAmount / sellingPrice) * 100) : 0;

  return {
    bookingId: booking.id,
    bookingReference: booking.bookingReference,
    sellingPrice,
    totalSupplierCost,
    grossMarginAmount,
    grossMarginPercent,
    agencyCommissionAmount,
    netProfitAmount,
    netProfitMarginPercent,
    currency: booking.currency || 'EUR'
  };
}

/**
 * Generates operations calendar events across all bookings
 */
export function generateOperationsCalendarEvents(bookings: Booking[]): OperationsCalendarEvent[] {
  const events: OperationsCalendarEvent[] = [];

  bookings.forEach(b => {
    const custName = b.customer?.leadTravelerName || b.customer?.bookerName || 'Guest';
    const destination = b.items?.[0]?.destinationName || 'Destination';

    // 1. Check-In / Trip Start
    if (b.travelStartDate) {
      events.push({
        id: `evt-start-${b.id}`,
        type: 'CHECK_IN',
        title: `Trip Check-in: ${b.bookingReference}`,
        description: `Arrival of ${custName} (${b.passengers?.length || b.items?.[0]?.totalPax || 2} Pax) in ${destination}`,
        bookingId: b.id,
        bookingReference: b.bookingReference,
        customerName: custName,
        destination,
        date: b.travelStartDate,
        status: new Date(b.travelStartDate) < new Date() ? 'COMPLETED' : 'UPCOMING',
        priority: b.status === 'CONFIRMED' ? 'NORMAL' : 'HIGH',
        assignedStaffName: b.assignedTeamMemberName
      });
    }

    // 2. Check-Out / Trip End
    if (b.travelEndDate) {
      events.push({
        id: `evt-end-${b.id}`,
        type: 'CHECK_OUT',
        title: `Trip Departure: ${b.bookingReference}`,
        description: `Departure / check-out of ${custName} from ${destination}`,
        bookingId: b.id,
        bookingReference: b.bookingReference,
        customerName: custName,
        destination,
        date: b.travelEndDate,
        status: new Date(b.travelEndDate) < new Date() ? 'COMPLETED' : 'UPCOMING',
        priority: 'NORMAL',
        assignedStaffName: b.assignedTeamMemberName
      });
    }

    // 3. Payment Cutoff Date
    if (b.paymentCutoffDate) {
      const isPast = new Date(b.paymentCutoffDate) < new Date();
      const isPaid = b.paymentStatus === 'PAID';
      events.push({
        id: `evt-pay-${b.id}`,
        type: 'PAYMENT_CUTOFF',
        title: `Payment Cutoff: ${b.bookingReference}`,
        description: `Supplier payment cutoff for ${b.bookingReference} (${b.currency} ${b.totalAmount})`,
        bookingId: b.id,
        bookingReference: b.bookingReference,
        customerName: custName,
        destination,
        date: b.paymentCutoffDate,
        status: isPaid ? 'COMPLETED' : isPast ? 'OVERDUE' : 'DUE_SOON',
        priority: isPaid ? 'LOW' : isPast ? 'URGENT' : 'HIGH',
        assignedStaffName: b.assignedTeamMemberName
      });
    }

    // 4. Item-level service events (Flights, Hotels, Visas, Sightseeing)
    if (b.items) {
      b.items.forEach((item, idx) => {
        // Flight
        if (item.category?.toUpperCase() === 'FLIGHT' || item.serviceFlightDetails?.flightNumber) {
          events.push({
            id: `evt-flt-${b.id}-${idx}`,
            type: 'FLIGHT',
            title: `Flight: ${item.serviceFlightDetails?.airline || ''} ${item.serviceFlightDetails?.flightNumber || item.productName}`,
            description: `Flight for ${custName}: ${item.serviceFlightDetails?.departureAirport || 'DEP'} → ${item.serviceFlightDetails?.arrivalAirport || 'ARR'}`,
            bookingId: b.id,
            bookingReference: b.bookingReference,
            customerName: custName,
            destination: item.destinationName || destination,
            date: item.travelDate || b.travelStartDate,
            time: item.serviceFlightDetails?.departureTime,
            status: 'UPCOMING',
            priority: 'HIGH',
            assignedStaffName: b.assignedTeamMemberName
          });
        }

        // Visa Deadline
        if (item.category?.toUpperCase() === 'VISA' || item.serviceVisaDetails?.submissionDate) {
          const vDate = item.serviceVisaDetails?.appointmentDate || item.serviceVisaDetails?.submissionDate || item.travelDate;
          if (vDate) {
            events.push({
              id: `evt-vsa-${b.id}-${idx}`,
              type: 'VISA_DEADLINE',
              title: `Visa Appointment/Deadline: ${item.serviceVisaDetails?.country || destination}`,
              description: `Visa documentation for ${custName} (${item.serviceVisaDetails?.visaType || 'Tourist'})`,
              bookingId: b.id,
              bookingReference: b.bookingReference,
              customerName: custName,
              destination: item.destinationName || destination,
              date: vDate,
              status: item.serviceVisaDetails?.approvalStatus === 'APPROVED' ? 'COMPLETED' : 'DUE_SOON',
              priority: 'URGENT',
              assignedStaffName: b.assignedTeamMemberName
            });
          }
        }

        // Sightseeing / Transfer
        if (item.category?.toUpperCase() === 'TRANSFER' || item.category?.toUpperCase() === 'SIGHTSEEING') {
          events.push({
            id: `evt-act-${b.id}-${idx}`,
            type: item.category?.toUpperCase() === 'TRANSFER' ? 'TRANSFER' : 'SIGHTSEEING',
            title: `${item.category}: ${item.productName}`,
            description: `Service for ${custName} in ${item.city || destination}`,
            bookingId: b.id,
            bookingReference: b.bookingReference,
            customerName: custName,
            destination: item.destinationName || destination,
            date: item.travelDate || b.travelStartDate,
            time: item.serviceTime,
            status: item.supplierStatus === 'CONFIRMED_BY_SUPPLIER' ? 'COMPLETED' : 'UPCOMING',
            priority: 'NORMAL',
            assignedStaffName: b.assignedTeamMemberName
          });
        }
      });
    }
  });

  return events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
}
