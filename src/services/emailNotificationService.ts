import { Booking, SentEmailRecord } from '../types';
import { formatCurrency } from './pricingEngine';

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
   * Executes live email dispatch via Google Workspace Gmail API v1 endpoint
   */
  public async sendViaGmailApi(to: string, subject: string, htmlBody: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const storedToken = sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token');
      if (!storedToken) {
        return { success: false, error: 'NO_AUTH_TOKEN' };
      }

      const emailLines = [
        `To: ${to}`,
        `Subject: =?utf-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
        `MIME-Version: 1.0`,
        `Content-Type: text/html; charset=utf-8`,
        ``,
        htmlBody
      ];

      const raw = base64UrlEncode(emailLines.join('\r\n'));

      const res = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${storedToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw })
      });

      if (!res.ok) {
        const errText = await res.text();
        return { success: false, error: `Gmail API error (${res.status}): ${errText}` };
      }

      const data = await res.json();
      return { success: true, messageId: data.id };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Network error executing Gmail API' };
    }
  }

  /**
   * Generates and dispatches production emails for a newly submitted booking:
   * 1. Official Acknowledgement Email to Traveler / B2B Agent (with 24-48 hour update SLA notice)
   * 2. Internal Operations Dossier Email to TheUnbound DMC Team (sales@theunbound.in / ops@theunbound.in)
   */
  public generateBookingEmails(booking: Booking): SentEmailRecord[] {
    const sentAt = new Date().toISOString();
    const formattedDate = new Date().toLocaleString('en-US', {
      dateStyle: 'full',
      timeStyle: 'short'
    });

    const clientEmail = booking.customer.email || 'traveler@example.com';
    const dmcEmail = 'sales@theunbound.in';

    // -------------------------------------------------------------
    // 1. CLIENT / AGENT OFFICIAL ACKNOWLEDGEMENT EMAIL
    // -------------------------------------------------------------
    const clientSubject = `Booking Received [${booking.bookingReference}] - TheUnbound DMC Ground Operations`;
    
    const clientHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #0f172a; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 28px 24px; text-align: left; border-bottom: 3px solid #00C6A6;">
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <div>
              <h1 style="margin: 0; font-size: 26px; font-weight: 900; letter-spacing: -0.5px; color: #ffffff; text-transform: lowercase;">theunbound</h1>
              <p style="margin: 4px 0 0 0; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; color: #00E5C0;">Destination Management Company Ltd.</p>
            </div>
            <div style="text-align: right; background: rgba(255,255,255,0.1); padding: 8px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15);">
              <span style="font-size: 10px; text-transform: uppercase; color: #94a3b8; display: block; font-weight: 700;">Booking Reference</span>
              <span style="font-family: monospace; font-size: 14px; font-weight: 700; color: #ffffff;">${booking.bookingReference}</span>
            </div>
          </div>
        </div>

        <!-- 24-48 Hour SLA Prominent Notice Banner -->
        <div style="background-color: #f0fdf4; border-left: 4px solid #008972; padding: 18px 24px; margin: 20px 24px; border-radius: 0 12px 12px 0;">
          <div style="display: flex; align-items: flex-start;">
            <div>
              <p style="margin: 0 0 4px 0; font-size: 14px; font-weight: 800; color: #008972; text-transform: uppercase; letter-spacing: 0.5px;">
                ✓ Booking Request Submitted Successfully
              </p>
              <p style="margin: 0; font-size: 13px; line-height: 1.6; color: #166534; font-weight: 500;">
                Your booking has been received and logged in our ground dispatch queue. Our operations team is verifying guide rosters and luxury vehicle allotments. <strong>Your confirmed travel voucher and status will be updated within 24–48 hours.</strong>
              </p>
            </div>
          </div>
        </div>

        <!-- Greeting & Summary -->
        <div style="padding: 0 24px 20px 24px;">
          <p style="font-size: 14px; line-height: 1.6; color: #334155; margin: 0 0 16px 0;">
            Dear <strong>${booking.customer.leadTravelerName || booking.customer.bookerName || 'Valued Partner'}</strong>,
          </p>
          <p style="font-size: 13px; line-height: 1.6; color: #475569; margin: 0 0 20px 0;">
            Thank you for booking with <strong>TheUnbound Destination Management Company</strong>. Below is your official booking dossier containing all scheduled ground arrangements and itinerary inclusions.
          </p>

          <!-- Booker Details Card -->
          <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 24px;">
            <h3 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
              Reservation & Contact Information
            </h3>
            <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
              <tr>
                <td style="padding: 4px 0; color: #64748b; width: 35%;">Lead Traveler / Group:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #0f172a;">${booking.customer.leadTravelerName}</td>
              </tr>
              ${booking.customer.agencyName ? `
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Booking Agency:</td>
                <td style="padding: 4px 0; font-weight: 700; color: #008972;">${booking.customer.agencyName} ${booking.customer.agentRefNumber ? `(Ref: ${booking.customer.agentRefNumber})` : ''}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Email Address:</td>
                <td style="padding: 4px 0; font-family: monospace; color: #0f172a;">${booking.customer.email}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Phone / WhatsApp:</td>
                <td style="padding: 4px 0; font-family: monospace; color: #0f172a;">${booking.customer.phone}</td>
              </tr>
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Submission Timestamp:</td>
                <td style="padding: 4px 0; color: #0f172a;">${formattedDate}</td>
              </tr>
              ${booking.customer.flightDetails ? `
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Flight / Arrival Info:</td>
                <td style="padding: 4px 0; color: #0f172a;">${booking.customer.flightDetails}</td>
              </tr>` : ''}
              ${booking.customer.pickupLocation ? `
              <tr>
                <td style="padding: 4px 0; color: #64748b;">Pickup Address:</td>
                <td style="padding: 4px 0; color: #0f172a;">${booking.customer.pickupLocation}</td>
              </tr>` : ''}
            </table>
          </div>

          <!-- Booked Services Table -->
          <h3 style="margin: 0 0 12px 0; font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #64748b;">
            Itemized Ground Services (${booking.items.length})
          </h3>
          <div style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; margin-bottom: 24px;">
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 12px;">
              <thead>
                <tr style="background-color: #f1f5f9; border-bottom: 1px solid #cbd5e1;">
                  <th style="padding: 10px 14px; font-weight: 700; color: #475569;">Service & Destination</th>
                  <th style="padding: 10px 14px; font-weight: 700; color: #475569;">Date & Pax</th>
                  <th style="padding: 10px 14px; font-weight: 700; color: #475569; text-align: right;">Total (${booking.currency})</th>
                </tr>
              </thead>
              <tbody>
                ${booking.items.map((item, i) => `
                  <tr style="border-bottom: ${i === booking.items.length - 1 ? 'none' : '1px solid #f1f5f9'};">
                    <td style="padding: 12px 14px;">
                      <div style="font-weight: 700; color: #0f172a; font-size: 13px;">${item.productName}</div>
                      <div style="color: #64748b; font-size: 11px; margin-top: 2px;">
                        <span style="font-family: monospace; color: #008972; font-weight: 600;">${item.productSku}</span> • ${item.destinationName} (${item.city}) • ${item.category}
                      </div>
                      ${item.selectedAddonNames && item.selectedAddonNames.length > 0 ? `
                        <div style="font-size: 10px; color: #0284c7; margin-top: 3px;">+ Addons: ${item.selectedAddonNames.join(', ')}</div>
                      ` : ''}
                    </td>
                    <td style="padding: 12px 14px; color: #334155;">
                      <div style="font-weight: 600;">📅 ${item.travelDate}</div>
                      <div style="font-size: 11px; color: #64748b;">${item.adults} Adults ${item.children ? `• ${item.children} Ch` : ''} ${item.infants ? `• ${item.infants} Inf` : ''}</div>
                    </td>
                    <td style="padding: 12px 14px; text-align: right; font-weight: 800; color: #0f172a; font-family: monospace; font-size: 13px;">
                      ${formatCurrency(item.totalPrice, item.currency)}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Total Summary Card -->
          <div style="background-color: #0f172a; border-radius: 12px; padding: 18px 20px; color: #ffffff; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="font-size: 11px; text-transform: uppercase; color: #94a3b8; font-weight: 700; letter-spacing: 1px; display: block;">Total Quoted Amount</span>
              <span style="font-size: 11px; color: #00E5C0;">Includes all contracted taxes, park fees & private services</span>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 24px; font-weight: 900; color: #00E5C0; font-family: monospace;">
                ${formatCurrency(booking.totalAmount, booking.currency)}
              </span>
            </div>
          </div>

          <!-- What Happens Next Section -->
          <div style="border-top: 1px solid #e2e8f0; padding-top: 20px; margin-bottom: 20px;">
            <h4 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 800; text-transform: uppercase; color: #0f172a; letter-spacing: 0.5px;">
              What Happens in the Next 24–48 Hours?
            </h4>
            <ol style="margin: 0; padding-left: 20px; font-size: 12px; line-height: 1.7; color: #475569;">
              <li><strong>Roster & Guide Allocation:</strong> Our local destination leads in Tokyo, London, and Paris assign your dedicated certified tour guide and private luxury chauffeur.</li>
              <li><strong>Final Confirmation Voucher:</strong> A formal Operations Voucher with meeting points, emergency dispatch numbers, and driver name-board details will be emailed to you within 24–48 hours.</li>
              <li><strong>24/7 Ground Assistance:</strong> For urgent adjustments before departure, reach out via our direct landline or WhatsApp hotline below.</li>
            </ol>
          </div>
        </div>

        <!-- Official Footer -->
        <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 20px 24px; text-align: center; font-size: 11px; color: #64748b;">
          <p style="margin: 0 0 6px 0; font-weight: 700; color: #334155;">TheUnbound Destination Management Company Ltd.</p>
          <p style="margin: 0 0 6px 0;">
            A-46, Kanchan Kunj, Madanpur Khadar Extn-2, New Delhi, India • Email: <a href="mailto:sales@theunbound.in" style="color: #008972; font-weight: 600; text-decoration: none;">sales@theunbound.in</a>
          </p>
          <p style="margin: 0; font-family: monospace; color: #475569;">
            Landline: <strong>011-41185542</strong> • Mobile / WhatsApp: <strong>+91-9811654959, +91-9718894959</strong>
          </p>
        </div>
      </div>
    `;

    // -------------------------------------------------------------
    // 2. THEUNBOUND DMC INTERNAL OPERATIONS NOTIFICATION EMAIL
    // -------------------------------------------------------------
    const dmcSubject = `🚨 NEW BOOKING DISPATCH: [${booking.bookingReference}] - ${booking.customer.leadTravelerName} (${formatCurrency(booking.totalAmount, booking.currency)})`;

    const dmcHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 640px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; color: #0f172a;">
        <!-- Header -->
        <div style="background-color: #0f172a; padding: 20px 24px; border-bottom: 3px solid #f59e0b;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <span style="background: #f59e0b; color: #0f172a; font-size: 10px; font-weight: 800; padding: 2px 8px; border-radius: 4px; text-transform: uppercase;">
                Incoming Ground Booking Action Required
              </span>
              <h2 style="margin: 6px 0 0 0; color: #ffffff; font-size: 20px; font-weight: 800;">
                TheUnbound Operations Queue
              </h2>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 11px; color: #94a3b8;">SLA Deadline:</span>
              <span style="font-size: 13px; font-weight: 800; color: #f59e0b; display: block; font-family: monospace;">24-48 Hours</span>
            </div>
          </div>
        </div>

        <!-- Body -->
        <div style="padding: 20px 24px;">
          <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 12px; color: #92400e;">
            <strong>Action Required:</strong> Please check local partner availability, guide rosters, and confirm reservations in Japan/UK/Europe within 24-48 hours.
          </div>

          <!-- Customer Dossier -->
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 12px;">
            <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Client & Agent Details</h4>
            <p style="margin: 0 0 4px 0;"><strong>Booking Ref:</strong> <span style="font-family: monospace;">${booking.bookingReference}</span></p>
            <p style="margin: 0 0 4px 0;"><strong>Lead Traveler:</strong> ${booking.customer.leadTravelerName}</p>
            ${booking.customer.agencyName ? `<p style="margin: 0 0 4px 0;"><strong>Agency:</strong> ${booking.customer.agencyName} (Agent Ref: ${booking.customer.agentRefNumber || 'N/A'})</p>` : ''}
            <p style="margin: 0 0 4px 0;"><strong>Email:</strong> <a href="mailto:${booking.customer.email}">${booking.customer.email}</a></p>
            <p style="margin: 0 0 4px 0;"><strong>Phone:</strong> ${booking.customer.phone}</p>
            ${booking.customer.flightDetails ? `<p style="margin: 0 0 4px 0;"><strong>Flight Details:</strong> ${booking.customer.flightDetails}</p>` : ''}
            ${booking.customer.pickupLocation ? `<p style="margin: 0 0 4px 0;"><strong>Pickup / Hotel:</strong> ${booking.customer.pickupLocation}</p>` : ''}
            ${booking.customer.specialRequests ? `<p style="margin: 0 0 4px 0;"><strong>Special Notes:</strong> <em>${booking.customer.specialRequests}</em></p>` : ''}
          </div>

          <!-- Services to Dispatch -->
          <h4 style="margin: 0 0 8px 0; font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 700;">Services to Dispatch (${booking.items.length})</h4>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 16px;">
            ${booking.items.map(item => `
              <tr style="border-bottom: 1px solid #e2e8f0;">
                <td style="padding: 8px 0;">
                  <strong>${item.productName}</strong> (${item.productSku})<br/>
                  <span style="color: #64748b; font-size: 11px;">📍 ${item.destinationName} / ${item.city} • 📅 ${item.travelDate} • 👥 ${item.totalPax} Pax</span>
                </td>
                <td style="padding: 8px 0; text-align: right; font-weight: 700; font-family: monospace;">
                  ${formatCurrency(item.totalPrice, item.currency)}
                </td>
              </tr>
            `).join('')}
          </table>

          <div style="background: #0f172a; color: white; padding: 12px 16px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 12px; font-weight: 700;">Total Quoted Value:</span>
            <span style="font-size: 16px; font-weight: 900; color: #00E5C0; font-family: monospace;">${formatCurrency(booking.totalAmount, booking.currency)}</span>
          </div>
        </div>
      </div>
    `;

    return [
      {
        recipient: clientEmail,
        recipientType: 'CLIENT_AGENT',
        subject: clientSubject,
        bodySnippet: `Thank you for booking with TheUnbound DMC. Your booking reference is ${booking.bookingReference}. Your booking has been submitted and will be updated in 24-48 Hrs.`,
        fullHtml: clientHtml,
        sentAt,
        status: 'DELIVERED'
      },
      {
        recipient: dmcEmail,
        recipientType: 'DMC_OPS',
        subject: dmcSubject,
        bodySnippet: `New booking submitted by ${booking.customer.leadTravelerName || clientEmail} (${booking.bookingReference}). Total: ${formatCurrency(booking.totalAmount, booking.currency)}. 24-48h SLA active.`,
        fullHtml: dmcHtml,
        sentAt,
        status: 'DELIVERED'
      }
    ];
  }
}
