import { EmailCampaignConfig } from '../types';

export const INITIAL_CAMPAIGNS: EmailCampaignConfig[] = [
  {
    id: 'camp-01',
    campaignType: 'BOOKING_CONFIRMATION',
    name: 'Instant Booking & 24–48h SLA Notice',
    description: 'Triggered immediately when a buyer, B2B agent, or team member registers a confirmed booking.',
    isEnabled: true,
    subject: 'Booking Confirmation: {{Booking Reference}} — Ground Services Allocated',
    templateHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0f172a; padding: 24px; color: #ffffff; text-align: center;">
    <h1 style="color: #00C6A6; margin: 0; font-size: 24px;">Booking Confirmation</h1>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">GROUND OPERATIONS DESK</p>
  </div>
  <div style="padding: 24px;">
    <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Booking Received & Locked: {{Booking Reference}}</h2>
    <p>Dear <strong>{{Customer Name}}</strong>,</p>
    <p>We are delighted to confirm that your booking request for <strong>{{Destination}}</strong> has been locked with our local DMC operations fleet.</p>
    
    <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin: 20px 0;">
      <p style="margin: 4px 0;"><strong>Travel Date:</strong> {{Travel Date}}</p>
      <p style="margin: 4px 0;"><strong>Total Value:</strong> {{Amount}}</p>
      <p style="margin: 4px 0;"><strong>Status:</strong> 24–48h Ground Update SLA In Progress</p>
    </div>

    <p style="color: #64748b; font-size: 13px;">Our destination operations controller is currently finalizing your licensed bilingual guide allocations and executive vehicle dispatch.</p>
    
    <div style="text-align: center; margin: 24px 0;">
      <a href="{{Booking Link}}" style="background-color: #00C6A6; color: #0f172a; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block;">View Booking Status</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b;">
    Destination Management & Ground Operations. All rights reserved.
  </div>
</div>
    `,
    senderName: 'Operations Desk',
    senderEmail: 'operations@theunbound.in',
    triggerCondition: 'On successful booking creation',
    delayHours: 0,
    dynamicVariables: ['{{Customer Name}}', '{{Booking Reference}}', '{{Destination}}', '{{Travel Date}}', '{{Amount}}', '{{Booking Link}}'],
    sentCount: 142,
    lastDispatchedAt: '2026-08-23T18:40:00Z'
  },
  {
    id: 'camp-02',
    campaignType: 'SAVED_QUOTE_REMINDER',
    name: 'Saved Quote Rate Guarantee Expiry Reminder',
    description: 'Sent to agents or buyers who have saved a quote but have not booked within 48 hours.',
    isEnabled: true,
    subject: 'Action Needed: Your Quoted Itinerary {{Quote Number}} Rate Guarantee',
    templateHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0f172a; padding: 24px; color: #ffffff; text-align: center;">
    <h1 style="color: #00C6A6; margin: 0; font-size: 24px;">Tariff Guarantee</h1>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">WHOLESALE GROUND CONTRACTS</p>
  </div>
  <div style="padding: 24px;">
    <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Your Saved Quote: {{Quote Number}}</h2>
    <p>Dear <strong>{{Customer Name}}</strong>,</p>
    <p>Your saved wholesale quotation for <strong>{{Destination}}</strong> (Total: <strong>{{Amount}}</strong>) is currently locked under our 14-day price guarantee.</p>
    <p>Ground resources for your travel dates ({{Travel Date}}) are experiencing high seasonal demand. Convert your quote into a confirmed booking now to ensure guide and vehicle allotment.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{{Quote Link}}" style="background-color: #00C6A6; color: #0f172a; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block;">Review & Confirm Itinerary</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b;">
    Destination Management & Ground Operations. All rights reserved.
  </div>
</div>
    `,
    senderName: 'Partner Concierge',
    senderEmail: 'partners@theunbound.in',
    triggerCondition: '48 hours after quote saved without booking',
    delayHours: 48,
    dynamicVariables: ['{{Customer Name}}', '{{Quote Number}}', '{{Destination}}', '{{Travel Date}}', '{{Amount}}', '{{Quote Link}}'],
    sentCount: 89,
    lastDispatchedAt: '2026-08-22T10:15:00Z'
  },
  {
    id: 'camp-03',
    campaignType: 'DOWNLOADED_QUOTE_REMINDER',
    name: 'Downloaded PDF Quote Follow-Up',
    description: 'Triggered when a user exports/prints a PDF quote to assist with closing the sale.',
    isEnabled: true,
    subject: 'Questions on your downloaded PDF proposal for {{Destination}}?',
    templateHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0f172a; padding: 24px; color: #ffffff; text-align: center;">
    <h1 style="color: #00C6A6; margin: 0; font-size: 24px;">Proposal Follow-Up</h1>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">VIP GROUND CONCIERGE</p>
  </div>
  <div style="padding: 24px;">
    <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Follow-Up: {{Quote Number}}</h2>
    <p>Dear <strong>{{Customer Name}}</strong>,</p>
    <p>We noticed you recently downloaded the itemized itinerary PDF for your upcoming journey to <strong>{{Destination}}</strong>.</p>
    <p>Do you need custom route adjustments, specialized vehicle upgrades (e.g. Mercedes Maybach / Alphard Executive), or custom dietary accommodations? Our senior destination managers are on standby to assist.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{{Quote Link}}" style="background-color: #00C6A6; color: #0f172a; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block;">Speak with Destination Specialist</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b;">
    Destination Management & Ground Operations. All rights reserved.
  </div>
</div>
    `,
    senderName: 'Marcus Vance (Senior Destination Lead)',
    senderEmail: 'marcus.vance@theunbound.in',
    triggerCondition: '24 hours after PDF quote download',
    delayHours: 24,
    dynamicVariables: ['{{Customer Name}}', '{{Quote Number}}', '{{Destination}}', '{{Quote Link}}'],
    sentCount: 64,
    lastDispatchedAt: '2026-08-23T11:00:00Z'
  },
  {
    id: 'camp-04',
    campaignType: 'FIRST_BOOKING_REMINDER',
    name: 'New Registered Partner First Booking Welcome',
    description: 'Sent to newly registered B2B agencies and buyers who have not yet submitted their first booking.',
    isEnabled: true,
    subject: 'Your Account Registration Request — Wholesale Contract Ground Rates',
    templateHtml: `
<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1e293b; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
  <div style="background-color: #0f172a; padding: 24px; color: #ffffff; text-align: center;">
    <h1 style="color: #00C6A6; margin: 0; font-size: 24px;">Partner Registration</h1>
    <p style="margin: 4px 0 0 0; font-size: 12px; color: #94a3b8;">B2B TRAVEL AGENT ONBOARDING</p>
  </div>
  <div style="padding: 24px;">
    <h2 style="font-size: 18px; color: #0f172a; margin-top: 0;">Welcome to Partner Network</h2>
    <p>Dear <strong>{{Customer Name}}</strong>,</p>
    <p>Thank you for creating your partner account. Your agency is now verified to access contracted wholesale ground rates across Japan, the UK, Europe, and Southeast Asia.</p>
    <p>Ready to build your first client proposal? Explore our live catalog of licensed private guides, luxury MPV transfers, and skip-the-line VIP passes.</p>
    <div style="text-align: center; margin: 24px 0;">
      <a href="{{Booking Link}}" style="background-color: #00C6A6; color: #0f172a; font-weight: bold; text-decoration: none; padding: 12px 24px; border-radius: 8px; display: inline-block;">Launch B2B Quotation Studio</a>
    </div>
  </div>
  <div style="background-color: #f1f5f9; padding: 16px; text-align: center; font-size: 11px; color: #64748b;">
    Destination Management & Ground Operations. All rights reserved.
  </div>
</div>
    `,
    senderName: 'Agency Partnerships Team',
    senderEmail: 'partnerships@theunbound.in',
    triggerCondition: '72 hours after account creation without a booking',
    delayHours: 72,
    dynamicVariables: ['{{Customer Name}}', '{{Booking Link}}'],
    sentCount: 112,
    lastDispatchedAt: '2026-08-21T16:20:00Z'
  }
];
