import { AppDatabase } from './db';
import { CalendarTask, TravelLead, Booking, BookingItem, User } from '../types';
import { marketingAutomationScheduler } from './marketingAutomationScheduler';

export class AutomaticTaskEngine {
  private static instance: AutomaticTaskEngine;
  private db: AppDatabase;

  private constructor() {
    this.db = AppDatabase.getInstance();
    this.initEventListeners();
  }

  public static getInstance(): AutomaticTaskEngine {
    if (!AutomaticTaskEngine.instance) {
      AutomaticTaskEngine.instance = new AutomaticTaskEngine();
    }
    return AutomaticTaskEngine.instance;
  }

  private initEventListeners() {
    // 1. Listen for Lead changes
    this.db.onLeadSaved((lead, user, isNew) => {
      if (isNew) {
        this.triggerLeadEvent('NEW_LEAD_CREATED', lead, user);
      }
    });

    // 2. Listen for Booking changes
    this.db.onBookingSaved((booking, user, isNew) => {
      if (isNew) {
        this.triggerBookingEvent('BOOKING_SUBMITTED', booking, user);
        marketingAutomationScheduler.onBookingCreated(booking, user).catch(() => {});
      } else {
        marketingAutomationScheduler.onBookingStatusChanged(booking);
      }
    });

    // 3. Listen for User Registration (USER_REGISTERED)
    this.db.onUserRegistered((user) => {
      marketingAutomationScheduler.onUserRegistered(user).catch(() => {});
    });

    // 4. Listen for Quotation Saved & Downloaded (QUOTE_SAVED & QUOTE_DOWNLOADED)
    this.db.onQuotationSaved((quote, user, _isNew, actionType) => {
      const isDownloaded =
        actionType === 'DOWNLOADED' ||
        actionType === 'PRINTED' ||
        quote.status === 'DOWNLOADED_PDF' ||
        quote.status === 'DOWNLOADED';
      if (isDownloaded) {
        marketingAutomationScheduler.onQuoteDownloaded(quote, user).catch(() => {});
      } else if (
        quote.status !== 'CONVERTED' &&
        quote.status !== 'BOOKED' &&
        quote.status !== 'CANCELLED' &&
        quote.status !== 'EXPIRED'
      ) {
        marketingAutomationScheduler.onQuoteSaved(quote, user).catch(() => {});
      }
    });
  }

  /**
   * Helper to verify if an automatic task with the same key already exists
   */
  private taskExists(autoKey: string): boolean {
    const tasks = this.db.getCalendarTasks();
    return tasks.some(t => t.autoTaskKey === autoKey || t.id === autoKey);
  }

  /**
   * Automatic task triggers for Lead events
   */
  public triggerLeadEvent(
    event: 
      | 'NEW_LEAD_CREATED'
      | 'LEAD_MISSING_REQUIREMENTS'
      | 'QUOTE_GENERATED'
      | 'QUOTE_SENT'
      | 'QUOTE_DOWNLOADED'
      | 'QUOTE_SHARED_WHATSAPP'
      | 'QUOTE_REVISED'
      | 'LEAD_INACTIVE'
      | 'LEAD_CONVERTED'
      | 'TRAVEL_DATE_APPROACHING',
    lead: TravelLead,
    user?: User | null,
    metadata?: Record<string, any>
  ): CalendarTask | null {
    if (!lead || !lead.id) return null;

    const autoKey = `auto-lead-${(event || '').toLowerCase()}-${lead.id}`;
    // If idempotency check passes and task already created, do not duplicate
    if (this.taskExists(autoKey)) {
      return null;
    }

    const now = new Date();
    const timestamp = now.toISOString();

    let taskName = 'Follow up with lead';
    let description = `Follow up with customer ${lead.contactName}`;
    let hours = 24;
    let priority: CalendarTask['priority'] = 'HIGH';
    let importance: CalendarTask['importance'] = 'IMPORTANT';
    let assignedDepartment: CalendarTask['assignedDepartment'] = 'SALES';

    switch (event) {
      case 'NEW_LEAD_CREATED':
        taskName = 'Contact new enquiry';
        description = `Reach out to ${lead.contactName} to introduce TheUnbound, verify travel dates (${lead.travelDates || 'Flexible'}), destination (${lead.destinationName || 'Tour'}), and qualify budget.`;
        hours = 2;
        priority = 'URGENT';
        importance = 'URGENT';
        break;

      case 'LEAD_MISSING_REQUIREMENTS':
        taskName = 'Request missing information';
        description = `Contact ${lead.contactName} to collect missing pax counts, dietary restrictions, hotel preferences, or rooming arrangements.`;
        hours = 4;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        break;

      case 'QUOTE_GENERATED':
        taskName = 'Review and send quotation';
        description = `Quality check quotation for ${lead.contactName} (${lead.destinationName}). Verify margin and dispatch proposal.`;
        hours = 4;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        break;

      case 'QUOTE_SENT':
        taskName = 'Follow up with customer';
        description = `Follow up with ${lead.contactName} on the sent proposal. Ask if any itinerary items need customization.`;
        hours = 24;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        break;

      case 'QUOTE_DOWNLOADED':
        taskName = 'Follow up on downloaded quotation';
        description = `${lead.contactName} has downloaded the quotation PDF. Call or message now while purchase interest is peaked.`;
        hours = 2;
        priority = 'URGENT';
        importance = 'URGENT';
        break;

      case 'QUOTE_SHARED_WHATSAPP':
        taskName = 'Follow up after WhatsApp sharing';
        description = `Quotation link was shared with ${lead.contactName} on WhatsApp. Confirm receipt and answer questions.`;
        hours = 4;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        break;

      case 'QUOTE_REVISED':
        taskName = 'Confirm revised requirements';
        description = `Review updated quotation version with ${lead.contactName} and ensure revised cost is acceptable.`;
        hours = 12;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        break;

      case 'LEAD_INACTIVE':
        taskName = 'Review quiet lead';
        description = `Lead ${lead.leadNumber} has had no activity for over 48 hours. Re-engage ${lead.contactName} with fresh travel inspiration.`;
        hours = 48;
        priority = 'MEDIUM';
        importance = 'NORMAL';
        break;

      case 'LEAD_CONVERTED':
        taskName = 'Begin booking handover';
        description = `Lead confirmed! Coordinate with Operations & Reservations to initialize official booking file and reserve services.`;
        hours = 6;
        priority = 'URGENT';
        importance = 'URGENT';
        assignedDepartment = 'OPERATIONS';
        break;

      case 'TRAVEL_DATE_APPROACHING':
        taskName = 'Confirm final requirements';
        description = `Travel date approaching for ${lead.contactName}. Finalize special requests, arrival times, and guide coordination.`;
        hours = 24;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        break;
    }

    const dueMs = now.getTime() + hours * 3600 * 1000;
    const dueDate = new Date(dueMs).toISOString().split('T')[0];
    const dueTime = new Date(dueMs).toTimeString().slice(0, 5);

    const task: CalendarTask = {
      id: autoKey,
      taskId: autoKey,
      autoTaskKey: autoKey,
      title: taskName,
      taskName,
      description,
      status: 'TO_DO',
      priority,
      importance,
      category: 'CLIENT_FOLLOW_UP',
      assignedDepartment,
      assignedToName: lead.assignedStaffName || (lead as any).assignedToName || 'Sales Team',
      assignedToEmail: lead.assignedStaffEmail || (lead as any).assignedToEmail || 'sales@theunbound.in',
      assignedTo: lead.assignedStaffName || (lead as any).assignedToName || 'Sales Team',
      createdBy: user?.name || 'Automated Workflows',
      startDate: dueDate,
      startTime: dueTime,
      dueDate,
      dueTime,
      dueAt: new Date(dueMs).toISOString(),
      relatedEntityType: 'lead',
      relatedEntityId: lead.id,
      relatedEntityReference: lead.leadNumber,
      leadId: lead.id,
      leadNumber: lead.leadNumber,
      customerName: lead.contactName,
      customerEmail: lead.email,
      destination: lead.destinationName || (lead as any).destination,
      travelDate: lead.travelDates,
      targetRoute: `/admin/leads?id=${lead.id}`,
      source: 'automatic',
      isCustomerFacing: false,
      isInternal: true,
      isSyncedToGoogleCalendar: false,
      auditMetadata: {
        triggerEvent: event,
        ...metadata
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.db.saveCalendarTask(task, user || null);
    return task;
  }

  /**
   * Automatic task triggers for Booking events
   */
  public triggerBookingEvent(
    event:
      | 'BOOKING_SUBMITTED'
      | 'PAYMENT_PROOF_UPLOADED'
      | 'PAYMENT_PENDING'
      | 'PASSENGER_DOC_MISSING'
      | 'SUPPLIER_CONFIRMATION_PENDING'
      | 'SUPPLIER_CONFIRMATION_RECEIVED'
      | 'PAYMENT_CUTOFF_APPROACHING'
      | 'SERVICE_DATE_APPROACHING'
      | 'VOUCHER_GENERATED'
      | 'INVOICE_UPLOADED'
      | 'AMENDMENT_REQUESTED'
      | 'CANCELLATION_REQUESTED'
      | 'BOOKING_COMPLETED',
    booking: Booking,
    user?: User | null,
    metadata?: Record<string, any>
  ): CalendarTask | null {
    if (!booking || !booking.id) return null;

    const autoKey = `auto-booking-${(event || '').toLowerCase()}-${booking.id}${metadata?.itemId ? `-${metadata.itemId}` : ''}`;
    if (this.taskExists(autoKey)) {
      return null;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const custName = booking.customer?.leadTravelerName || (booking as any).customerName || 'Guest';
    const custEmail = booking.customer?.email || (booking as any).customerEmail || '';
    const assignedName = booking.assignedTeamMemberName || (booking as any).assignedStaffName || 'Operations Dispatch';
    const assignedEmail = 'ops@theunbound.in';

    let taskName = 'Booking task';
    let description = `Action needed on booking ${booking.bookingReference}`;
    let hours = 12;
    let priority: CalendarTask['priority'] = 'HIGH';
    let importance: CalendarTask['importance'] = 'IMPORTANT';
    let assignedDepartment: CalendarTask['assignedDepartment'] = 'OPERATIONS';
    let category: CalendarTask['category'] = 'OPERATIONS_SLA';

    switch (event) {
      case 'BOOKING_SUBMITTED':
        taskName = 'Review new booking';
        description = `Review new booking ${booking.bookingReference} for ${custName}. Verify passenger details, room requirements, and supplier allotments.`;
        hours = 4;
        priority = 'URGENT';
        importance = 'URGENT';
        break;

      case 'PAYMENT_PROOF_UPLOADED':
        taskName = 'Verify payment proof';
        description = `Payment receipt uploaded for booking ${booking.bookingReference}. Finance team must cross-reference bank transaction and issue receipt.`;
        hours = 2;
        priority = 'URGENT';
        importance = 'URGENT';
        assignedDepartment = 'FINANCE';
        category = 'PAYMENT_REMINDER';
        break;

      case 'PAYMENT_PENDING':
        taskName = 'Follow up on payment';
        description = `Balance payment pending for ${booking.bookingReference}. Send reminder invoice before deadline.`;
        hours = 12;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        assignedDepartment = 'FINANCE';
        category = 'PAYMENT_REMINDER';
        break;

      case 'PASSENGER_DOC_MISSING':
        taskName = 'Request missing document';
        description = `Passport copies or required travel documents are missing for passengers in booking ${booking.bookingReference}.`;
        hours = 24;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        category = 'VISA_SUBMISSION';
        break;

      case 'SUPPLIER_CONFIRMATION_PENDING':
        taskName = metadata?.productName ? `Contact supplier for ${metadata.productName}` : 'Contact supplier';
        description = `Follow up with supplier ${metadata?.supplierName || 'partner'} to secure confirmation voucher for ${booking.bookingReference}.`;
        hours = 6;
        priority = 'URGENT';
        importance = 'URGENT';
        assignedDepartment = 'GROUND_OPS';
        category = 'GROUND_DISPATCH';
        break;

      case 'SUPPLIER_CONFIRMATION_RECEIVED':
        taskName = 'Update booking status';
        description = `Supplier confirmation received. Update service vouchers and itinerary status for ${booking.bookingReference}.`;
        hours = 12;
        priority = 'MEDIUM';
        importance = 'NORMAL';
        break;

      case 'PAYMENT_CUTOFF_APPROACHING':
        taskName = 'Confirm supplier payment';
        description = `Supplier cancellation cutoff or deposit deadline approaching for ${booking.bookingReference}. Process vendor remittance.`;
        hours = 12;
        priority = 'URGENT';
        importance = 'URGENT';
        assignedDepartment = 'FINANCE';
        category = 'SUPPLIER_CUTOFF';
        break;

      case 'SERVICE_DATE_APPROACHING':
        taskName = 'Verify operational readiness';
        description = `Arrival in 48 hours for ${custName}. Re-verify driver dispatch, hotel pre-checkin, guide contact, and 24/7 helpline setup.`;
        hours = 24;
        priority = 'URGENT';
        importance = 'URGENT';
        assignedDepartment = 'GROUND_OPS';
        category = 'GROUND_DISPATCH';
        break;

      case 'VOUCHER_GENERATED':
        taskName = 'Send voucher';
        description = `Travel service vouchers ready for booking ${booking.bookingReference}. Dispatch welcome kit and vouchers to client.`;
        hours = 4;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        break;

      case 'INVOICE_UPLOADED':
        taskName = 'Send invoice';
        description = `Tax invoice generated for ${booking.bookingReference}. Send invoice copy to ${custName}.`;
        hours = 4;
        priority = 'HIGH';
        importance = 'IMPORTANT';
        assignedDepartment = 'FINANCE';
        break;

      case 'AMENDMENT_REQUESTED':
        taskName = 'Review amendment';
        description = `Amendment request received for ${booking.bookingReference}. Check supplier modification penalties and adjust itinerary.`;
        hours = 4;
        priority = 'URGENT';
        importance = 'URGENT';
        break;

      case 'CANCELLATION_REQUESTED':
        taskName = 'Review cancellation';
        description = `Cancellation request logged for ${booking.bookingReference}. Calculate cancellation charges according to terms and notify suppliers immediately.`;
        hours = 2;
        priority = 'URGENT';
        importance = 'URGENT';
        break;

      case 'BOOKING_COMPLETED':
        taskName = 'Close operational tasks';
        description = `Tour completed successfully! Collect guest feedback, finalize supplier billings, and archive operational files.`;
        hours = 24;
        priority = 'MEDIUM';
        importance = 'NORMAL';
        break;
    }

    const dueMs = now.getTime() + hours * 3600 * 1000;
    const dueDate = new Date(dueMs).toISOString().split('T')[0];
    const dueTime = new Date(dueMs).toTimeString().slice(0, 5);

    const task: CalendarTask = {
      id: autoKey,
      taskId: autoKey,
      autoTaskKey: autoKey,
      title: taskName,
      taskName,
      description,
      status: 'TO_DO',
      priority,
      importance,
      category,
      assignedDepartment,
      assignedToName: assignedName,
      assignedToEmail: assignedEmail,
      assignedTo: assignedName,
      createdBy: user?.name || 'Automated Operations',
      startDate: dueDate,
      startTime: dueTime,
      dueDate,
      dueTime,
      dueAt: new Date(dueMs).toISOString(),
      relatedEntityType: metadata?.itemId ? 'booking_item' : 'booking',
      relatedEntityId: metadata?.itemId || booking.id,
      relatedEntityReference: booking.bookingReference,
      bookingId: booking.id,
      bookingReference: booking.bookingReference,
      bookingItemId: metadata?.itemId,
      bookingItemName: metadata?.productName,
      serviceCategory: metadata?.category,
      supplierId: metadata?.supplierId,
      supplierName: metadata?.supplierName,
      leadId: booking.leadId,
      buyerId: booking.userId || (booking as any).buyerId,
      b2bAgentId: booking.agentId || (booking as any).b2bAgentId,
      customerName: custName,
      customerEmail: custEmail,
      destination: booking.destinationName || booking.destination,
      travelDate: booking.travelStartDate || (booking as any).travelDate,
      targetRoute: `/admin/bookings?id=${booking.id}`,
      source: metadata?.itemId ? 'booking_item_record' : 'booking_record',
      isCustomerFacing: false,
      isInternal: true,
      isSyncedToGoogleCalendar: false,
      auditMetadata: {
        triggerEvent: event,
        ...metadata
      },
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.db.saveCalendarTask(task, user || null);
    return task;
  }
}

export const automaticTaskEngine = AutomaticTaskEngine.getInstance();
