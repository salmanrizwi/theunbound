import { AppDatabase } from './db';
import { Booking, Quotation, User } from '../types';

export interface GoogleTaskPayload {
  title: string;
  notes: string;
  due?: string; // ISO 8601 string
}

export interface GoogleTaskResponse {
  id: string;
  title: string;
  status: 'needsAction' | 'completed';
  due?: string;
  notes?: string;
  updated: string;
  selfLink?: string;
}

export class GoogleTasksService {
  private static instance: GoogleTasksService;
  private tasksQueue: GoogleTaskResponse[] = [];

  private constructor() {
    this.loadCachedTasks();
  }

  public static getInstance(): GoogleTasksService {
    if (!GoogleTasksService.instance) {
      GoogleTasksService.instance = new GoogleTasksService();
    }
    return GoogleTasksService.instance;
  }

  private loadCachedTasks() {
    try {
      const saved = localStorage.getItem('theunbound_google_tasks');
      if (saved) {
        this.tasksQueue = JSON.parse(saved);
      }
    } catch (e) {
      console.debug('Error loading cached google tasks', e);
    }
  }

  private persistTasks() {
    try {
      localStorage.setItem('theunbound_google_tasks', JSON.stringify(this.tasksQueue));
    } catch (e) {
      console.debug('Error saving google tasks', e);
    }
  }

  public getTasks(): GoogleTaskResponse[] {
    return [...this.tasksQueue];
  }

  /**
   * Dispatches task to Google Tasks API or logs into ground queue with 12h SLA
   */
  public async createTask(payload: GoogleTaskPayload): Promise<GoogleTaskResponse> {
    const task: GoogleTaskResponse = {
      id: `gtask-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      title: payload.title,
      notes: payload.notes,
      due: payload.due,
      status: 'needsAction',
      updated: new Date().toISOString()
    };

    // If an active OAuth access token is available, dispatch to Google Tasks v1 endpoint
    try {
      const storedToken = sessionStorage.getItem('google_access_token');
      if (storedToken) {
        const response = await fetch('https://tasks.googleapis.com/tasks/v1/lists/@default/tasks', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${storedToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            title: payload.title,
            notes: payload.notes,
            due: payload.due ? new Date(payload.due).toISOString() : undefined
          })
        });

        if (response.ok) {
          const apiData = await response.json();
          task.id = apiData.id || task.id;
          task.selfLink = apiData.selfLink;
        }
      }
    } catch (apiErr) {
      console.debug('Google Tasks API dispatch note (falling back to synchronized task storage):', apiErr);
    }

    this.tasksQueue.unshift(task);
    this.persistTasks();

    // Audit log
    const db = AppDatabase.getInstance();
    db.logAudit(
      null,
      'STATUS_UPDATED',
      'GoogleTasksQueue',
      task.id,
      `Scheduled Google Task: "${payload.title}" (Due: ${payload.due || 'Standard SLA'})`
    );

    return task;
  }

  /**
   * Automatically creates booking confirmation follow-up task due in 12 hours
   */
  public async scheduleBookingConfirmationTask(booking: Booking): Promise<GoogleTaskResponse> {
    const twelveHoursLater = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();
    
    return this.createTask({
      title: `Booking Confirmation Due in 12h: ${booking.bookingReference} (${booking.customer.leadTravelerName})`,
      notes: `Action Required for Ground Operations:
• Booking Reference: ${booking.bookingReference}
• Lead Traveler: ${booking.customer.leadTravelerName} (${booking.customer.email})
• Agency: ${booking.customer.agencyName || 'Direct Buyer'}
• Total Value: ${booking.currency} ${booking.totalAmount}
• Services Count: ${(booking.items || []).length} items
• Travel Date: ${booking.travelStartDate}

Checklist:
1. Contact local contracted transport/guide partners
2. Verify vehicle allocation & driver assignment
3. Send official confirmation voucher to ${booking.customer.email} before 12-hour deadline.`,
      due: twelveHoursLater
    });
  }

  /**
   * Automatically creates follow-up task when a PDF quotation is exported
   */
  public async schedulePdfQuoteFollowUpTask(quotation: Quotation, user: User | null): Promise<GoogleTaskResponse> {
    const twentyFourHoursLater = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    return this.createTask({
      title: `Follow Up on Downloaded PDF Quote: ${quotation.quoteNumber} (${quotation.clientName})`,
      notes: `Sales CRM Follow-Up:
• Quotation Ref: ${quotation.quoteNumber}
• Client / Agency: ${quotation.clientName} (${quotation.destination})
• Total Quoted: ${quotation.currency} ${quotation.totalSellingPrice}
• Quoted By: ${user?.name || 'Agent'} (${user?.email || 'N/A'})
• Created: ${quotation.createdAt ? new Date(quotation.createdAt).toLocaleDateString() : new Date().toLocaleDateString()}

Action:
• Check in with client regarding itinerary customisation, hotel upgrades, or booking confirmation.`,
      due: twentyFourHoursLater
    });
  }
}
