import { Booking, SentEmailRecord, Quotation, CommunicationAuditLog, CommunicationEventType } from '../types';
import { formatCurrency } from './pricingEngine';
import { 
  buildQuoteCommunicationPayload, 
  buildBookingCommunicationPayload, 
  formatProposalEmailFromPayload,
  generateContextualEmailSubject 
} from './communicationDataBuilder';
import { AppDatabase } from './db';

function base64UrlEncode(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export class EmailNotificationService {
  private static instance: EmailNotificationService;

  public static getInstance(): EmailNotificationService {
    if (!EmailNotificationService.instance) {
      EmailNotificationService.instance = new EmailNotificationService();
    }
    return EmailNotificationService.instance;
  }

  /**
   * Executes live email dispatch via Google Workspace Gmail API v1 endpoint.
   * Mandate: Tracks comprehensive CommunicationAuditLog on every dispatch attempt,
   * never masks failures, and records exact delivery status.
   */
  public async sendViaGmailApi(
    to: string, 
    subject: string, 
    htmlBody: string,
    meta?: {
      quoteId?: string;
      bookingId?: string;
      leadId?: string;
      recipientType?: 'BUYER' | 'B2B_AGENT' | 'DMC_OPS' | 'ADMIN' | 'SUPPLIER';
      eventType?: CommunicationEventType;
      sentBy?: string;
      sentByName?: string;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const db = AppDatabase.getInstance();
    const communicationId = `comm-email-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const eventType: CommunicationEventType = meta?.eventType || (meta?.quoteId ? 'QUOTE_EMAIL_SENT' : 'BOOKING_EMAIL_SENT');
    const recipientType = meta?.recipientType || (meta?.quoteId ? 'BUYER' : 'DMC_OPS');

    try {
      const storedToken = typeof window !== 'undefined' ? (sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token')) : null;
      const idempotencyKey = `${meta?.quoteId || meta?.bookingId || meta?.leadId || to}-${eventType}-${Date.now()}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (storedToken) {
        headers['Authorization'] = `Bearer ${storedToken}`;
      }

      // Dispatch through secure backend integration proxy
      const res = await fetch('/api/integrations/gmail/send', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          to,
          subject,
          htmlBody,
          meta: {
            quoteId: meta?.quoteId,
            bookingId: meta?.bookingId,
            leadId: meta?.leadId,
            recipientType,
            eventType,
            idempotencyKey,
            sentBy: meta?.sentBy,
            sentByName: meta?.sentByName
          }
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        const err = data.error || data.details || `Gmail dispatch failed (${res.status})`;
        db.saveCommunicationAuditLog({
          id: `audit-${Date.now()}`,
          communicationId,
          quoteId: meta?.quoteId,
          bookingId: meta?.bookingId,
          leadId: meta?.leadId,
          recipientEmail: to,
          recipientType,
          channel: 'EMAIL',
          eventType,
          templateVersion: '1.0.0-standard',
          sentAt: new Date().toISOString(),
          sentBy: meta?.sentBy,
          sentByName: meta?.sentByName,
          deliveryStatus: 'FAILED',
          failureReason: err
        });
        return { success: false, error: err };
      }

      db.saveCommunicationAuditLog({
        id: `audit-${Date.now()}`,
        communicationId,
        quoteId: meta?.quoteId,
        bookingId: meta?.bookingId,
        leadId: meta?.leadId,
        recipientEmail: to,
        recipientType,
        channel: 'EMAIL',
        eventType,
        templateVersion: '1.0.0-standard',
        sentAt: data.sentAt || new Date().toISOString(),
        sentBy: meta?.sentBy,
        sentByName: meta?.sentByName,
        deliveryStatus: 'SUCCESS'
      });

      return { success: true, messageId: data.messageId };
    } catch (err: any) {
      const errorMsg = err?.message || 'Network error executing Gmail API';
      db.saveCommunicationAuditLog({
        id: `audit-${Date.now()}`,
        communicationId,
        quoteId: meta?.quoteId,
        bookingId: meta?.bookingId,
        leadId: meta?.leadId,
        recipientEmail: to,
        recipientType,
        channel: 'EMAIL',
        eventType,
        templateVersion: '1.0.0-standard',
        sentAt: new Date().toISOString(),
        sentBy: meta?.sentBy,
        sentByName: meta?.sentByName,
        deliveryStatus: 'FAILED',
        failureReason: errorMsg
      });
      return { success: false, error: errorMsg };
    }
  }

  /**
   * Generates production emails for a newly submitted booking derived from authoritative communication model
   */
  public generateBookingEmails(booking: Booking): SentEmailRecord[] {
    const sentAt = new Date().toISOString();
    const clientEmail = booking.customer.email || 'traveler@example.com';
    const dmcEmail = 'sales@theunbound.in';
    const payload = buildBookingCommunicationPayload(booking, 'BUYER');

    const clientSubject = generateContextualEmailSubject('NEW_BOOKING', {
      destination: payload.destination,
      bookingRef: payload.bookingReference,
      customerName: payload.customer.name,
      travelDate: payload.travelDates
    });
    
    const dmcSubject = `[URGENT 24-48H SLA] New Ground Booking [${payload.bookingReference}] — ${payload.customer.name} (${payload.destination}) — ${payload.formattedTotalPrice}`;

    const clientHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 28px 24px; text-align: left; border-bottom: 3px solid #00C6A6;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-transform: uppercase;">Booking Confirmation</h1>
              <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #00E5C0;">Ground Operations Desk</p>
            </div>
            <div style="text-align: right; background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
              <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; display: block; font-weight: 700;">Booking Reference</span>
              <span style="font-family: monospace; font-size: 14px; font-weight: 700; color: #ffffff;">${payload.bookingReference}</span>
            </div>
          </div>
        </div>

        <!-- 24-48 Hour SLA Prominent Notice Banner -->
        <div style="background-color: #f0fdf4; border-left: 4px solid #008972; padding: 18px 24px; margin: 20px 24px; border-radius: 0 12px 12px 0;">
          <div>
            <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: #008972; text-transform: uppercase; letter-spacing: 0.5px;">
              ✓ Booking Request Submitted Successfully
            </p>
            <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #166534; font-weight: 500;">
              Your booking has been received and logged in our ground dispatch queue. Our operations team is verifying hotel all-clear and chauffeur allocations. <strong>Your confirmed travel voucher and status will be updated within 24–48 hours.</strong>
            </p>
          </div>
        </div>

        <!-- Reservation Context -->
        <div style="padding: 0 24px 20px 24px;">
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            Dear <strong>${payload.customer.name || 'Valued Partner'}</strong>,
          </p>

          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
              Trip & Passenger Summary
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; width: 35%;">Destination:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${payload.destination}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Travel Dates:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${payload.travelDates}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Lead Traveler:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${payload.customer.name}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Total Travelers:</td>
                <td style="padding: 4px 0; font-weight: 600; color: #0f172a;">${payload.travelers.displayText}</td>
              </tr>
              ${payload.customer.agencyName ? `
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Booking Agency:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #008972;">${payload.customer.agencyName} ${payload.customer.agentRef ? `(Ref: ${payload.customer.agentRef})` : ''}</td>
              </tr>` : ''}
            </table>
          </div>

          <!-- Services Breakdown -->
          <h3 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
            Booked Ground Services (${payload.bookedItems.length} Inclusions)
          </h3>
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            ${payload.bookedItems.map(item => `
              <div style="padding: 10px 14px; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-size: 12px;">
                <div>
                  <strong style="color: #0f172a;">${item.name}</strong>
                  <div style="font-size: 11px; color: #64748b;">${item.category} • ${item.destination} • ${item.date || 'Scheduled Itinerary'}</div>
                </div>
                <div style="text-align: right; font-weight: 700; color: #008972;">
                  ${item.formattedPrice}
                </div>
              </div>
            `).join('')}
          </div>

          <!-- Total Investment -->
          <div style="background-color: #0f172a; border-radius: 12px; padding: 18px 20px; color: #ffffff; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; display: block;">Total Booking Investment</span>
              <span style="font-size: 11px; color: #00E5C0;">Payment Status: <strong>${payload.paymentStatus}</strong></span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 22px; font-weight: 900; color: #00E5C0; font-family: monospace;">${payload.formattedTotalPrice}</span>
            </div>
          </div>
        </div>
      </div>
    `;

    const dmcHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #0f172a;">
        <div style="background-color: #0f172a; padding: 24px; border-bottom: 3px solid #e11d48;">
          <h1 style="margin: 0; font-size: 20px; color: #ffffff; font-weight: 800;">Operations Dispatch Queue</h1>
          <p style="margin: 4px 0 0 0; font-size: 12px; color: #fda4af; text-transform: uppercase; font-weight: 700;">Action Required: Supplier Allotment & Chauffeur Assignment</p>
        </div>
        <div style="padding: 24px;">
          <p style="font-size: 14px;"><strong>Booking Reference:</strong> ${payload.bookingReference}</p>
          <p style="font-size: 14px;"><strong>Client Name:</strong> ${payload.customer.name}</p>
          <p style="font-size: 14px;"><strong>Destination:</strong> ${payload.destination}</p>
          <p style="font-size: 14px;"><strong>Total Value:</strong> ${payload.formattedTotalPrice}</p>
          <p style="font-size: 14px;"><strong>SLA Target:</strong> 24–48 Hours to issue confirmed service voucher.</p>
        </div>
      </div>
    `;

    return [
      {
        recipient: clientEmail,
        recipientType: 'CLIENT_AGENT',
        subject: clientSubject,
        bodySnippet: `Thank you for your booking. Your booking reference is ${payload.bookingReference}. Your status will be updated in 24-48 Hrs.`,
        fullHtml: clientHtml,
        sentAt,
        status: 'DELIVERED'
      },
      {
        recipient: dmcEmail,
        recipientType: 'DMC_OPS',
        subject: dmcSubject,
        bodySnippet: `New booking submitted by ${payload.customer.name} (${payload.bookingReference}). Total: ${payload.formattedTotalPrice}. 24-48h SLA active.`,
        fullHtml: dmcHtml,
        sentAt,
        status: 'DELIVERED'
      }
    ];
  }

  /**
   * Generates client-facing quotation proposal email using authoritative Communication Payload
   * Complete Day-Wise Plan, Accommodation, Experiences, Transfers, Pricing, and Inclusions/Exclusions
   */
  public generateQuotationProposalEmail(
    quote: Quotation, 
    agentInfo?: { name?: string; agencyName?: string; email?: string; phone?: string; logoUrl?: string }
  ): SentEmailRecord {
    const sentAt = new Date().toISOString();
    const recipient = quote.clientEmail || 'client@example.com';
    
    // Build single authoritative payload
    const payload = buildQuoteCommunicationPayload(quote, {
      role: 'BUYER',
      senderBranding: {
        name: agentInfo?.name,
        agency: agentInfo?.agencyName,
        email: agentInfo?.email,
        phone: agentInfo?.phone,
        logoUrl: agentInfo?.logoUrl
      }
    });

    const subject = generateContextualEmailSubject('QUOTE_READY', {
      destination: payload.tripSummary.destination,
      duration: payload.tripSummary.durationText,
      quoteRef: payload.quoteId,
      customerName: payload.preparedFor.name
    });

    const { htmlBody, textBody } = formatProposalEmailFromPayload(payload);

    return {
      recipient,
      recipientType: 'CLIENT_AGENT',
      subject,
      bodySnippet: textBody.substring(0, 160) + '...',
      fullHtml: htmlBody,
      sentAt,
      status: 'DELIVERED'
    };
  }
}
