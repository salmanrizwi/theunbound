import { EmailCampaignConfig } from '../types';

export const INITIAL_CAMPAIGNS: EmailCampaignConfig[] = [
  {
    id: 'trigger-user-registered',
    campaignType: 'USER_REGISTERED',
    triggerKey: 'USER_REGISTERED',
    name: 'New User Registration',
    description: 'Triggered immediately when a new eligible user or B2B travel partner completes account registration.',
    isEnabled: true,
    status: 'ACTIVE',
    isSystemTrigger: true,
    priority: 1,
    subject: 'Welcome to TheUnbound, {{user.firstName}} — Your Travel & Ground Operations Portal',
    preheaderText: 'Your account registration is verified. Explore contracted wholesale ground rates and custom itineraries.',
    templateHtml: `<div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1F2933; background-color: #FFFFFF; border: 1px solid #DDE8E6; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0F172A; padding: 28px 24px; border-bottom: 3px solid #00C6A6;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #00C6A6; text-transform: uppercase;">TheUnbound Partner &amp; Traveler Network</p>
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">Welcome to TheUnbound, {{user.firstName}}</h1>
  </div>
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; line-height: 1.6; color: #1F2933; margin-top: 0;">Dear <strong>{{user.firstName}} {{user.lastName}}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">Thank you for registering with <strong>TheUnbound</strong> ({{user.companyName}}). Your account (<span style="font-family: monospace; color: #1F2933;">{{user.email}}</span>) is now active on our centralized destination management platform.</p>
    <div style="background-color: #F8FAFA; border: 1px solid #DDE8E6; border-radius: 12px; padding: 16px; margin: 20px 0;">
      <p style="margin: 0 0 8px 0; font-size: 13px; font-weight: 700; color: #1F2933;">What You Can Do Next:</p>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: #5F6B73; line-height: 1.7;">
        <li>Build itemized multi-city quotations with real-time tariff calculations</li>
        <li>Access contracted private tours, luxury MPV chauffeurs, and Japan Rail passes</li>
        <li>Track 24–48h ground confirmation SLAs and official travel vouchers</li>
      </ul>
    </div>
    <div style="margin: 24px 0;">
      <a href="https://theunbound.in" style="background-color: #00C6A6; color: #0F172A; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">Access Your Portal Workspace</a>
    </div>
  </div>
  <div style="background-color: #F8FAFA; border-top: 1px solid #DDE8E6; padding: 16px 24px; font-size: 12px; color: #5F6B73;">
    TheUnbound Destination Management &amp; Ground Operations · <a href="mailto:business@theunbound.in" style="color: #008972; text-decoration: none;">business@theunbound.in</a>
  </div>
</div>`,
    senderName: 'TheUnbound Onboarding Desk',
    senderEmail: 'partnerships@theunbound.in',
    primaryRecipientRule: 'User Email',
    internalCopyRecipients: ['business@theunbound.in'],
    triggerCondition: 'Immediately on USER_REGISTERED event',
    timingMode: 'IMMEDIATE',
    delayHours: 0,
    delayValue: 0,
    delayUnit: 'MINUTES',
    dynamicVariables: [
      '{{user.firstName}}',
      '{{user.lastName}}',
      '{{user.email}}',
      '{{user.companyName}}',
      '{{agent.agencyName}}',
      '{{agent.agentName}}',
      '{{agent.agentEmail}}'
    ],
    templateVersion: 'v1.0',
    versionHistory: [
      {
        version: 'v1.0',
        subject: 'Welcome to TheUnbound, {{user.firstName}} — Your Travel & Ground Operations Portal',
        preheaderText: 'Your account registration is verified. Explore contracted wholesale ground rates and custom itineraries.',
        templateHtml: 'Initial system registration template',
        updatedAt: '2026-09-15T09:00:00Z',
        updatedBy: 'business@theunbound.in'
      }
    ],
    sentCount: 118,
    skippedCount: 2,
    failedCount: 0,
    updatedAt: '2026-10-01T10:30:00Z',
    lastDispatchedAt: '2026-10-07T16:20:00Z'
  },
  {
    id: 'trigger-quote-saved',
    campaignType: 'QUOTE_SAVED',
    triggerKey: 'QUOTE_SAVED',
    name: 'Saved Quote Reminder',
    description: 'Triggered when a user saves a quote/proposal but does not proceed with booking within the configured window. Automatically skipped if the quote converts to a booking.',
    isEnabled: true,
    status: 'ACTIVE',
    isSystemTrigger: true,
    priority: 2,
    subject: 'Your TheUnbound Quote {{quote.quoteReference}} for {{trip.destination}} Is Waiting for You',
    preheaderText: 'Lock in your guaranteed rates before {{quote.validUntil}} for {{trip.destination}}.',
    templateHtml: `<div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1F2933; background-color: #FFFFFF; border: 1px solid #DDE8E6; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0F172A; padding: 28px 24px; border-bottom: 3px solid #00C6A6;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #00C6A6; text-transform: uppercase;">Saved Proposal Rate Guarantee</p>
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">Quote {{quote.quoteReference}} — {{trip.destination}}</h1>
  </div>
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; line-height: 1.6; color: #1F2933; margin-top: 0;">Dear <strong>{{user.firstName}}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">Your saved quotation for <strong>{{trip.destination}}</strong> is currently held under our rate guarantee until <strong>{{quote.validUntil}}</strong>.</p>
    <div style="background-color: #F8FAFA; border: 1px solid #DDE8E6; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #1F2933;">
      <p style="margin: 4px 0;"><strong>Quote Reference:</strong> <span style="font-family: monospace;">{{quote.quoteReference}}</span></p>
      <p style="margin: 4px 0;"><strong>Destination:</strong> {{trip.destination}}</p>
      <p style="margin: 4px 0;"><strong>Travel Window:</strong> {{trip.startDate}} – {{trip.endDate}} ({{trip.passengerCount}} Pax)</p>
      <p style="margin: 4px 0;"><strong>Quoted Total:</strong> <span style="font-family: monospace; font-weight: 700; color: #008972;">{{quote.currency}} {{quote.total}}</span></p>
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #5F6B73;">Ground vehicles and bilingual guides experience high seasonal demand. Proceed to booking confirmation whenever you are ready to lock your allocation.</p>
    <div style="margin: 24px 0;">
      <a href="https://theunbound.in" style="background-color: #00C6A6; color: #0F172A; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">Review &amp; Confirm Quote {{quote.quoteReference}}</a>
    </div>
  </div>
  <div style="background-color: #F8FAFA; border-top: 1px solid #DDE8E6; padding: 16px 24px; font-size: 12px; color: #5F6B73;">
    TheUnbound Quotation Desk · <a href="mailto:sales@theunbound.in" style="color: #008972; text-decoration: none;">sales@theunbound.in</a>
  </div>
</div>`,
    senderName: 'TheUnbound Quotation Desk',
    senderEmail: 'partners@theunbound.in',
    primaryRecipientRule: 'Quote Owner Email',
    internalCopyRecipients: ['business@theunbound.in'],
    triggerCondition: 'Wait 24 Hours after QUOTE_SAVED → verify quote not booked/cancelled/expired',
    timingMode: 'DELAYED',
    delayHours: 24,
    delayValue: 24,
    delayUnit: 'HOURS',
    dynamicVariables: [
      '{{user.firstName}}',
      '{{user.lastName}}',
      '{{user.email}}',
      '{{user.companyName}}',
      '{{quote.quoteId}}',
      '{{quote.quoteReference}}',
      '{{quote.createdAt}}',
      '{{quote.validUntil}}',
      '{{quote.total}}',
      '{{quote.currency}}',
      '{{trip.destination}}',
      '{{trip.startDate}}',
      '{{trip.endDate}}',
      '{{trip.passengerCount}}',
      '{{agent.agencyName}}',
      '{{agent.agentName}}',
      '{{agent.agentEmail}}'
    ],
    templateVersion: 'v1.1',
    versionHistory: [
      {
        version: 'v1.1',
        subject: 'Your TheUnbound Quote {{quote.quoteReference}} for {{trip.destination}} Is Waiting for You',
        preheaderText: 'Lock in your guaranteed rates before {{quote.validUntil}} for {{trip.destination}}.',
        templateHtml: 'Updated with dynamic quote validity and passenger count summary',
        updatedAt: '2026-10-02T14:15:00Z',
        updatedBy: 'business@theunbound.in'
      }
    ],
    sentCount: 89,
    skippedCount: 31,
    failedCount: 0,
    updatedAt: '2026-10-02T14:15:00Z',
    lastDispatchedAt: '2026-10-07T10:15:00Z'
  },
  {
    id: 'trigger-quote-downloaded',
    campaignType: 'QUOTE_DOWNLOADED',
    triggerKey: 'QUOTE_DOWNLOADED',
    name: 'Downloaded Quote Reminder',
    description: 'Triggered when a user downloads a PDF quotation/proposal. Evaluates booking conversion status after the configured delay before sending.',
    isEnabled: true,
    status: 'ACTIVE',
    isSystemTrigger: true,
    priority: 3,
    subject: 'Follow-Up on Your Downloaded Proposal {{quote.quoteReference}} ({{trip.destination}})',
    preheaderText: 'Need route adjustments or vehicle upgrades on {{quote.quoteReference}}? Our destination specialists are ready to help.',
    templateHtml: `<div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1F2933; background-color: #FFFFFF; border: 1px solid #DDE8E6; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0F172A; padding: 28px 24px; border-bottom: 3px solid #00C6A6;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #00C6A6; text-transform: uppercase;">Proposal Concierge Follow-Up</p>
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">Proposal {{quote.quoteReference}} — {{trip.destination}}</h1>
  </div>
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; line-height: 1.6; color: #1F2933; margin-top: 0;">Dear <strong>{{user.firstName}}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">We noticed you recently downloaded the PDF itinerary proposal <strong style="font-family: monospace;">{{quote.quoteReference}}</strong> for <strong>{{trip.destination}}</strong> ({{trip.startDate}} – {{trip.endDate}}).</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">Whether you need custom day-by-day adjustments, executive vehicle upgrades, or split rooming allocations for your <strong>{{trip.passengerCount}} travelers</strong>, our ground operations desk is ready to assist.</p>
    <div style="background-color: #F8FAFA; border: 1px solid #DDE8E6; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #1F2933;">
      <p style="margin: 4px 0;"><strong>Proposal ID:</strong> <span style="font-family: monospace;">{{quote.quoteReference}}</span></p>
      <p style="margin: 4px 0;"><strong>Quoted Total:</strong> <span style="font-family: monospace; font-weight: 700; color: #008972;">{{quote.currency}} {{quote.total}}</span></p>
      <p style="margin: 4px 0;"><strong>Rate Valid Until:</strong> {{quote.validUntil}}</p>
    </div>
    <div style="margin: 24px 0;">
      <a href="https://theunbound.in" style="background-color: #00C6A6; color: #0F172A; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">Proceed to Booking or Request Adjustment</a>
    </div>
  </div>
  <div style="background-color: #F8FAFA; border-top: 1px solid #DDE8E6; padding: 16px 24px; font-size: 12px; color: #5F6B73;">
    TheUnbound Destination Specialists · <a href="mailto:sales@theunbound.in" style="color: #008972; text-decoration: none;">sales@theunbound.in</a>
  </div>
</div>`,
    senderName: 'Marcus Vance (Senior Destination Lead)',
    senderEmail: 'marcus.vance@theunbound.in',
    primaryRecipientRule: 'Quote Owner Email',
    internalCopyRecipients: ['business@theunbound.in'],
    triggerCondition: 'Wait 24 Hours after QUOTE_DOWNLOADED → verify quote not converted to booking',
    timingMode: 'DELAYED',
    delayHours: 24,
    delayValue: 24,
    delayUnit: 'HOURS',
    dynamicVariables: [
      '{{user.firstName}}',
      '{{user.lastName}}',
      '{{user.email}}',
      '{{user.companyName}}',
      '{{quote.quoteId}}',
      '{{quote.quoteReference}}',
      '{{quote.createdAt}}',
      '{{quote.validUntil}}',
      '{{quote.total}}',
      '{{quote.currency}}',
      '{{trip.destination}}',
      '{{trip.startDate}}',
      '{{trip.endDate}}',
      '{{trip.passengerCount}}',
      '{{agent.agencyName}}',
      '{{agent.agentName}}',
      '{{agent.agentEmail}}'
    ],
    templateVersion: 'v1.0',
    versionHistory: [
      {
        version: 'v1.0',
        subject: 'Follow-Up on Your Downloaded Proposal {{quote.quoteReference}} ({{trip.destination}})',
        preheaderText: 'Need route adjustments or vehicle upgrades on {{quote.quoteReference}}?',
        templateHtml: 'Initial PDF quote download follow-up template',
        updatedAt: '2026-09-20T11:00:00Z',
        updatedBy: 'business@theunbound.in'
      }
    ],
    sentCount: 64,
    skippedCount: 19,
    failedCount: 0,
    updatedAt: '2026-10-03T11:00:00Z',
    lastDispatchedAt: '2026-10-07T11:00:00Z'
  },
  {
    id: 'trigger-first-booking-welcome',
    campaignType: 'FIRST_BOOKING_COMPLETED',
    triggerKey: 'FIRST_BOOKING_COMPLETED',
    name: 'First Booking Welcome',
    description: 'Triggered strictly once per account/user upon their first successful booking submission. Enforces atomic idempotency so subsequent bookings never re-trigger.',
    isEnabled: true,
    status: 'ACTIVE',
    isSystemTrigger: true,
    priority: 1,
    subject: 'Congratulations on Your First Booking with TheUnbound ({{booking.bookingReference}})',
    preheaderText: 'Welcome to our active ground operations network. Your dedicated operations controller has been assigned.',
    templateHtml: `<div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1F2933; background-color: #FFFFFF; border: 1px solid #DDE8E6; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0F172A; padding: 28px 24px; border-bottom: 3px solid #00C6A6;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #00C6A6; text-transform: uppercase;">First Booking Milestone</p>
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">Thank You for Your First Booking!</h1>
  </div>
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; line-height: 1.6; color: #1F2933; margin-top: 0;">Dear <strong>{{user.firstName}} {{user.lastName}}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">Congratulations on submitting your first booking with <strong>TheUnbound</strong>! Our destination operations team is thrilled to manage your upcoming ground arrangements in <strong>{{trip.destination}}</strong>.</p>
    <div style="background-color: #F8FAFA; border: 1px solid #DDE8E6; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #1F2933;">
      <p style="margin: 4px 0;"><strong>Booking Reference:</strong> <span style="font-family: monospace; font-weight: 700;">{{booking.bookingReference}}</span></p>
      <p style="margin: 4px 0;"><strong>Booking Date:</strong> {{booking.bookingDate}}</p>
      <p style="margin: 4px 0;"><strong>Destination:</strong> {{trip.destination}} ({{trip.startDate}} – {{trip.endDate}})</p>
      <p style="margin: 4px 0;"><strong>Current Status:</strong> {{booking.status}}</p>
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #5F6B73;">As a verified partner, you have direct access to our 24/7 ground dispatch desk, itemized service vouchers, and live chauffeur/guide allocations.</p>
    <div style="margin: 24px 0;">
      <a href="https://theunbound.in" style="background-color: #00C6A6; color: #0F172A; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">View Booking {{booking.bookingReference}}</a>
    </div>
  </div>
  <div style="background-color: #F8FAFA; border-top: 1px solid #DDE8E6; padding: 16px 24px; font-size: 12px; color: #5F6B73;">
    TheUnbound Ground Operations Desk · <a href="mailto:operations@theunbound.in" style="color: #008972; text-decoration: none;">operations@theunbound.in</a>
  </div>
</div>`,
    senderName: 'Agency Partnerships & Operations',
    senderEmail: 'operations@theunbound.in',
    primaryRecipientRule: 'Booking/User Email',
    internalCopyRecipients: ['business@theunbound.in'],
    triggerCondition: 'Immediately on FIRST_BOOKING_COMPLETED (Strictly 1st booking per user account)',
    timingMode: 'IMMEDIATE',
    delayHours: 0,
    delayValue: 0,
    delayUnit: 'MINUTES',
    dynamicVariables: [
      '{{user.firstName}}',
      '{{user.lastName}}',
      '{{user.email}}',
      '{{user.companyName}}',
      '{{booking.bookingId}}',
      '{{booking.bookingReference}}',
      '{{booking.bookingDate}}',
      '{{booking.status}}',
      '{{trip.destination}}',
      '{{trip.startDate}}',
      '{{trip.endDate}}',
      '{{trip.passengerCount}}',
      '{{agent.agencyName}}',
      '{{agent.agentName}}',
      '{{agent.agentEmail}}'
    ],
    templateVersion: 'v1.0',
    versionHistory: [
      {
        version: 'v1.0',
        subject: 'Congratulations on Your First Booking with TheUnbound ({{booking.bookingReference}})',
        preheaderText: 'Welcome to our active ground operations network.',
        templateHtml: 'Initial first-booking milestone template',
        updatedAt: '2026-09-18T08:30:00Z',
        updatedBy: 'business@theunbound.in'
      }
    ],
    sentCount: 53,
    skippedCount: 84,
    failedCount: 0,
    updatedAt: '2026-10-04T09:45:00Z',
    lastDispatchedAt: '2026-10-07T14:10:00Z'
  },
  {
    id: 'trigger-booking-confirmation-sla',
    campaignType: 'BOOKING_CONFIRMATION_SLA',
    triggerKey: 'BOOKING_CONFIRMATION_SLA',
    name: 'Booking Confirmation SLA',
    description: 'Triggered when a submitted booking reaches the configured SLA threshold and remains awaiting confirmation. Automatically cancelled if confirmed or closed early.',
    isEnabled: true,
    status: 'ACTIVE',
    isSystemTrigger: true,
    priority: 1,
    subject: 'SLA Status Update: Booking {{booking.bookingReference}} ({{trip.destination}}) Ground Allocation',
    preheaderText: 'Your booking {{booking.bookingReference}} is in final ground verification with our local operations team.',
    templateHtml: `<div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1F2933; background-color: #FFFFFF; border: 1px solid #DDE8E6; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0F172A; padding: 28px 24px; border-bottom: 3px solid #00C6A6;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #00C6A6; text-transform: uppercase;">Booking Confirmation SLA Workflow</p>
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">SLA Update: {{booking.bookingReference}}</h1>
  </div>
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; line-height: 1.6; color: #1F2933; margin-top: 0;">Dear <strong>{{user.firstName}}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">We are providing a scheduled SLA status update regarding your booking <strong style="font-family: monospace;">{{booking.bookingReference}}</strong> for <strong>{{trip.destination}}</strong>.</p>
    <div style="background-color: #F8FAFA; border: 1px solid #DDE8E6; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #1F2933;">
      <p style="margin: 4px 0;"><strong>Booking Reference:</strong> <span style="font-family: monospace; font-weight: 700;">{{booking.bookingReference}}</span></p>
      <p style="margin: 4px 0;"><strong>Destination:</strong> {{trip.destination}}</p>
      <p style="margin: 4px 0;"><strong>Travel Dates:</strong> {{trip.startDate}} – {{trip.endDate}} ({{trip.passengerCount}} Pax)</p>
      <p style="margin: 4px 0;"><strong>Current Status:</strong> <span style="color: #D97706; font-weight: 700;">{{booking.status}}</span></p>
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #5F6B73;">Our ground dispatch controllers are completing final supplier and chauffeur confirmations. Your confirmed travel vouchers will be issued immediately upon sign-off.</p>
    <div style="margin: 24px 0;">
      <a href="https://theunbound.in" style="background-color: #00C6A6; color: #0F172A; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">Check Live Booking Status</a>
    </div>
  </div>
  <div style="background-color: #F8FAFA; border-top: 1px solid #DDE8E6; padding: 16px 24px; font-size: 12px; color: #5F6B73;">
    TheUnbound SLA Operations Desk · <a href="mailto:operations@theunbound.in" style="color: #008972; text-decoration: none;">operations@theunbound.in</a>
  </div>
</div>`,
    senderName: 'TheUnbound SLA Operations Desk',
    senderEmail: 'operations@theunbound.in',
    primaryRecipientRule: 'Booking Contact Email',
    internalCopyRecipients: ['business@theunbound.in', 'operations@theunbound.in'],
    triggerCondition: 'Configured 24h SLA check while booking status is PENDING_CONFIRMATION',
    timingMode: 'SLA',
    delayHours: 24,
    delayValue: 24,
    delayUnit: 'HOURS',
    slaConfig: {
      slaDuration: 24,
      slaUnit: 'HOURS',
      reminderTiming: 'At SLA threshold (24 Hours after submission)',
      eligibleStatuses: ['PENDING_CONFIRMATION', 'ON_HOLD'],
      excludedStatuses: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'CLOSED']
    },
    dynamicVariables: [
      '{{user.firstName}}',
      '{{user.lastName}}',
      '{{user.email}}',
      '{{user.companyName}}',
      '{{booking.bookingId}}',
      '{{booking.bookingReference}}',
      '{{booking.bookingDate}}',
      '{{booking.status}}',
      '{{trip.destination}}',
      '{{trip.startDate}}',
      '{{trip.endDate}}',
      '{{trip.passengerCount}}',
      '{{agent.agencyName}}',
      '{{agent.agentName}}',
      '{{agent.agentEmail}}'
    ],
    templateVersion: 'v1.2',
    versionHistory: [
      {
        version: 'v1.2',
        subject: 'SLA Status Update: Booking {{booking.bookingReference}} ({{trip.destination}}) Ground Allocation',
        preheaderText: 'Your booking {{booking.bookingReference}} is in final ground verification.',
        templateHtml: 'Standardized 24-hour SLA escalation & customer assurance template',
        updatedAt: '2026-10-05T12:00:00Z',
        updatedBy: 'business@theunbound.in'
      }
    ],
    sentCount: 142,
    skippedCount: 68,
    failedCount: 1,
    updatedAt: '2026-10-05T12:00:00Z',
    lastDispatchedAt: '2026-10-07T18:40:00Z'
  },
  {
    id: 'trigger-account-pending-verification',
    campaignType: 'ACCOUNT_PENDING_VERIFICATION',
    triggerKey: 'ACCOUNT_PENDING_VERIFICATION',
    name: 'New Registration — Account Under Verification',
    description: 'Triggered when a new user or B2B travel partner registers and their profile enters the verification review queue.',
    isEnabled: true,
    status: 'ACTIVE',
    isSystemTrigger: true,
    priority: 1,
    subject: 'Your TheUnbound Account Is Being Verified',
    preheaderText: 'We have received your registration and your account is currently being reviewed by our verification team.',
    templateHtml: `<div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1F2933; background-color: #FFFFFF; border: 1px solid #DDE8E6; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0F172A; padding: 28px 24px; border-bottom: 3px solid #00C6A6;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #00C6A6; text-transform: uppercase;">Partner Verification Desk</p>
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">Account Under Verification</h1>
  </div>
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; line-height: 1.6; color: #1F2933; margin-top: 0;">Hi <strong>{{user.firstName}}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">Thank you for registering with <strong>TheUnbound</strong>.</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">We've received your registration and your account is currently being reviewed by our verification team.</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">Once the verification process is complete, we'll notify you by email with the outcome and any next steps.</p>
    <div style="background-color: #F8FAFA; border: 1px solid #DDE8E6; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #1F2933;">
      <p style="margin: 4px 0;"><strong>Current Account Status:</strong> <span style="color: #D97706; font-weight: 700;">Pending Verification</span></p>
      <p style="margin: 4px 0;"><strong>Registered Agency:</strong> {{user.companyName}}</p>
      <p style="margin: 4px 0;"><strong>Account Email:</strong> {{user.email}}</p>
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #5F6B73;">Thank you for your patience. We look forward to welcoming you to TheUnbound's B2B travel partner network.</p>
  </div>
  <div style="background-color: #F8FAFA; border-top: 1px solid #DDE8E6; padding: 16px 24px; font-size: 12px; color: #5F6B73;">
    Best regards,<br/><strong>TheUnbound Verification Team</strong> · <a href="mailto:business@theunbound.in" style="color: #008972; text-decoration: none;">business@theunbound.in</a>
  </div>
</div>`,
    senderName: 'TheUnbound Verification Desk',
    senderEmail: 'verification@theunbound.in',
    primaryRecipientRule: 'User Email',
    internalCopyRecipients: ['business@theunbound.in'],
    triggerCondition: 'Immediately when user registers and enters PENDING verification queue',
    timingMode: 'IMMEDIATE',
    delayHours: 0,
    delayValue: 0,
    delayUnit: 'MINUTES',
    dynamicVariables: [
      '{{user.firstName}}',
      '{{user.lastName}}',
      '{{user.fullName}}',
      '{{user.email}}',
      '{{user.companyName}}',
      '{{company.name}}',
      '{{verification.status}}',
      '{{verification.nextSteps}}'
    ],
    templateVersion: 'v1.0',
    versionHistory: [
      {
        version: 'v1.0',
        subject: 'Your TheUnbound Account Is Being Verified',
        preheaderText: 'We have received your registration and your account is currently being reviewed by our verification team.',
        templateHtml: 'Initial pending verification acknowledgment template',
        updatedAt: '2026-10-06T10:00:00Z',
        updatedBy: 'business@theunbound.in'
      }
    ],
    sentCount: 42,
    skippedCount: 1,
    failedCount: 0,
    updatedAt: '2026-10-06T10:00:00Z',
    lastDispatchedAt: '2026-10-08T09:15:00Z'
  },
  {
    id: 'trigger-account-verification-approved',
    campaignType: 'ACCOUNT_VERIFICATION_APPROVED',
    triggerKey: 'ACCOUNT_VERIFICATION_APPROVED',
    name: 'Account Approved — Verification Successful',
    description: 'Triggered when an authorized Administrator approves a partner account and grants access to the portal.',
    isEnabled: true,
    status: 'ACTIVE',
    isSystemTrigger: true,
    priority: 1,
    subject: 'Welcome to TheUnbound — Your Account Is Approved!',
    preheaderText: 'Your B2B travel partner account is verified. Access wholesale rates and customized itineraries now.',
    templateHtml: `<div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1F2933; background-color: #FFFFFF; border: 1px solid #DDE8E6; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0F172A; padding: 28px 24px; border-bottom: 3px solid #00C6A6;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #00C6A6; text-transform: uppercase;">Partner Verification Desk</p>
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">Account Approved — Verification Successful</h1>
  </div>
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; line-height: 1.6; color: #1F2933; margin-top: 0;">Hi <strong>{{user.firstName}}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">Great news! Your <strong>TheUnbound</strong> B2B partner account has been successfully verified and approved.</p>
    <div style="background-color: #F8FAFA; border: 1px solid #DDE8E6; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #1F2933;">
      <p style="margin: 4px 0;"><strong>Account Status:</strong> <span style="color: #008972; font-weight: 700;">Verified &amp; Active</span></p>
      <p style="margin: 4px 0;"><strong>Company:</strong> {{user.companyName}}</p>
      <p style="margin: 4px 0;"><strong>Approved By:</strong> {{verification.reviewedBy}}</p>
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #5F6B73;">You now have full access to create wholesale quotations, book contracted DMC ground services, and manage traveler itineraries.</p>
    <div style="margin: 24px 0;">
      <a href="https://theunbound.in" style="background-color: #00C6A6; color: #0F172A; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">Log In to Your Partner Workspace</a>
    </div>
  </div>
  <div style="background-color: #F8FAFA; border-top: 1px solid #DDE8E6; padding: 16px 24px; font-size: 12px; color: #5F6B73;">
    Best regards,<br/><strong>TheUnbound Verification Team</strong> · <a href="mailto:business@theunbound.in" style="color: #008972; text-decoration: none;">business@theunbound.in</a>
  </div>
</div>`,
    senderName: 'TheUnbound Partner Operations',
    senderEmail: 'partnerships@theunbound.in',
    primaryRecipientRule: 'User Email',
    internalCopyRecipients: ['business@theunbound.in'],
    triggerCondition: 'Immediately upon Administrator account approval',
    timingMode: 'IMMEDIATE',
    delayHours: 0,
    delayValue: 0,
    delayUnit: 'MINUTES',
    dynamicVariables: [
      '{{user.firstName}}',
      '{{user.lastName}}',
      '{{user.fullName}}',
      '{{user.email}}',
      '{{user.companyName}}',
      '{{company.name}}',
      '{{verification.status}}',
      '{{verification.reviewedBy}}',
      '{{verification.reviewedAt}}'
    ],
    templateVersion: 'v1.0',
    versionHistory: [
      {
        version: 'v1.0',
        subject: 'Welcome to TheUnbound — Your Account Is Approved!',
        preheaderText: 'Your B2B travel partner account is verified. Access wholesale rates and customized itineraries now.',
        templateHtml: 'Initial account approval notification template',
        updatedAt: '2026-10-06T10:30:00Z',
        updatedBy: 'business@theunbound.in'
      }
    ],
    sentCount: 38,
    skippedCount: 0,
    failedCount: 0,
    updatedAt: '2026-10-06T10:30:00Z',
    lastDispatchedAt: '2026-10-08T09:45:00Z'
  },
  {
    id: 'trigger-account-verification-rejected',
    campaignType: 'ACCOUNT_VERIFICATION_REJECTED',
    triggerKey: 'ACCOUNT_VERIFICATION_REJECTED',
    name: 'Account Requires Additional Requirements',
    description: 'Triggered when an authorized Administrator requests additional verification documents or rejects the current submission.',
    isEnabled: true,
    status: 'ACTIVE',
    isSystemTrigger: true,
    priority: 1,
    subject: 'Action Required: Update Your TheUnbound Account Details',
    preheaderText: 'Additional verification documents or requirements are needed to approve your TheUnbound partner account.',
    templateHtml: `<div style="font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 0 auto; color: #1F2933; background-color: #FFFFFF; border: 1px solid #DDE8E6; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0F172A; padding: 28px 24px; border-bottom: 3px solid #E11D48;">
    <p style="margin: 0 0 4px 0; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; color: #FDA4AF; text-transform: uppercase;">Partner Verification Desk</p>
    <h1 style="margin: 0; font-size: 22px; font-weight: 800; color: #FFFFFF;">Action Required: Additional Requirements Needed</h1>
  </div>
  <div style="padding: 28px 24px;">
    <p style="font-size: 15px; line-height: 1.6; color: #1F2933; margin-top: 0;">Hi <strong>{{user.firstName}}</strong>,</p>
    <p style="font-size: 14px; line-height: 1.6; color: #5F6B73;">Thank you for registering with <strong>TheUnbound</strong>. Our partner verification team reviewed your submission, but we need additional details before your account can be approved.</p>
    <div style="background-color: #FFF1F2; border: 1px solid #FECDD3; border-radius: 12px; padding: 16px; margin: 20px 0; font-size: 13px; color: #1F2933;">
      <p style="margin: 4px 0;"><strong>Current Status:</strong> <span style="color: #E11D48; font-weight: 700;">Action Required / Rejected</span></p>
      <p style="margin: 4px 0;"><strong>Review Notes / Feedback:</strong></p>
      <div style="background-color: #FFFFFF; border: 1px solid #FECDD3; border-radius: 8px; padding: 10px 12px; margin-top: 6px; font-size: 13px; color: #9F1239;">
        {{verification.notes}}
      </div>
      <p style="margin: 10px 0 4px 0;"><strong>Requirements Needed:</strong></p>
      <div style="font-size: 12px; color: #4B5563; line-height: 1.6;">
        {{verification.requirementsList}}
      </div>
    </div>
    <p style="font-size: 13px; line-height: 1.6; color: #5F6B73;">Please reply directly to this email or update your company profile documents so we can complete your verification promptly.</p>
    <div style="margin: 24px 0;">
      <a href="https://theunbound.in" style="background-color: #00C6A6; color: #0F172A; font-weight: 700; font-size: 13px; text-decoration: none; padding: 12px 24px; border-radius: 10px; display: inline-block;">Update Account &amp; Verification Details</a>
    </div>
  </div>
  <div style="background-color: #F8FAFA; border-top: 1px solid #DDE8E6; padding: 16px 24px; font-size: 12px; color: #5F6B73;">
    Best regards,<br/><strong>TheUnbound Verification Desk</strong> · <a href="mailto:business@theunbound.in" style="color: #008972; text-decoration: none;">business@theunbound.in</a>
  </div>
</div>`,
    senderName: 'TheUnbound Verification Desk',
    senderEmail: 'verification@theunbound.in',
    primaryRecipientRule: 'User Email',
    internalCopyRecipients: ['business@theunbound.in'],
    triggerCondition: 'Immediately when Administrator rejects or requests additional requirements',
    timingMode: 'IMMEDIATE',
    delayHours: 0,
    delayValue: 0,
    delayUnit: 'MINUTES',
    dynamicVariables: [
      '{{user.firstName}}',
      '{{user.lastName}}',
      '{{user.fullName}}',
      '{{user.email}}',
      '{{user.companyName}}',
      '{{company.name}}',
      '{{verification.status}}',
      '{{verification.notes}}',
      '{{verification.rejectedReason}}',
      '{{verification.requirementsList}}',
      '{{verification.reviewedBy}}'
    ],
    templateVersion: 'v1.0',
    versionHistory: [
      {
        version: 'v1.0',
        subject: 'Action Required: Update Your TheUnbound Account Details',
        preheaderText: 'Additional verification documents or requirements are needed to approve your TheUnbound partner account.',
        templateHtml: 'Initial account rejection / action required notification template',
        updatedAt: '2026-10-06T11:00:00Z',
        updatedBy: 'business@theunbound.in'
      }
    ],
    sentCount: 11,
    skippedCount: 0,
    failedCount: 0,
    updatedAt: '2026-10-06T11:00:00Z',
    lastDispatchedAt: '2026-10-07T12:00:00Z'
  }
];

