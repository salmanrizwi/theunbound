import { 
  AiPlannerActivityEvent, 
  AiPlannerActivityAction, 
  TravelLead, 
  User, 
  AiPlannerOptionPlan, 
  AiPlannerStructuredRequirements, 
  CurrencyCode 
} from '../types';
import { AppDatabase } from './db';

/**
 * AI PLANNER ACTIVITY TRACKING & CRM LEAD INTEGRATION SERVICE
 */

export function generateAlphanumericLeadId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Non-ambiguous 6-char alphanumeric
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export class AiPlannerTrackingService {
  private static instance: AiPlannerTrackingService;
  private db: AppDatabase;
  private storageKey = 'theunbound_ai_planner_activities';

  private constructor() {
    this.db = AppDatabase.getInstance();
  }

  public static getInstance(): AiPlannerTrackingService {
    if (!AiPlannerTrackingService.instance) {
      AiPlannerTrackingService.instance = new AiPlannerTrackingService();
    }
    return AiPlannerTrackingService.instance;
  }

  /**
   * Log an AI Planner telemetry / activity event.
   */
  public logActivity(
    action: AiPlannerActivityAction,
    user: User | null,
    details?: {
      quoteId?: string;
      leadId?: string;
      destination?: string;
      pax?: number;
      nights?: number;
      totalSellingPrice?: number;
      currency?: CurrencyCode;
      additional?: Record<string, any>;
    }
  ): AiPlannerActivityEvent {
    const event: AiPlannerActivityEvent = {
      id: `act-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      userId: user?.id || 'anonymous-user',
      userName: user ? `${user.firstName} ${user.lastName}` : 'Guest Agent',
      userRole: user?.role || 'B2B_AGENT',
      quoteId: details?.quoteId,
      leadId: details?.leadId,
      timestamp: new Date().toISOString(),
      action,
      source: 'AI_PLANNER',
      destination: details?.destination,
      pax: details?.pax,
      nights: details?.nights,
      totalSellingPrice: details?.totalSellingPrice,
      currency: details?.currency,
      details: details?.additional
    };

    try {
      const stored = this.getActivities();
      stored.unshift(event);
      // Keep latest 200 events
      if (stored.length > 200) {
        stored.splice(200);
      }
      localStorage.setItem(this.storageKey, JSON.stringify(stored));
      
      // Also log to AppDatabase standard audit ledger
      this.db.logAudit(
        user,
        'SYSTEM_EVENT' as any,
        'AI_PLANNER',
        event.id,
        `AI Planner: ${action.replace(/_/g, ' ')} for ${details?.destination || 'Trip'} (User: ${event.userName})`
      );
    } catch (e) {
      console.warn('Failed to persist AI Planner activity event:', e);
    }

    return event;
  }

  /**
   * Retrieve all activity events
   */
  public getActivities(): AiPlannerActivityEvent[] {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Error reading AI Planner activity storage:', e);
    }
    return [];
  }

  /**
   * Automatically create or update a CRM Travel Lead from an AI Planner proposal.
   */
  public createOrUpdateLeadFromAiPlan(
    plan: AiPlannerOptionPlan,
    requirements: AiPlannerStructuredRequirements,
    user: User | null,
    quoteId?: string
  ): TravelLead {
    const timestamp = new Date().toISOString();
    const leadCode = generateAlphanumericLeadId();
    const clientName = requirements.clientName || 'VIP Traveler';
    const clientEmail = requirements.clientEmail || `${clientName.toLowerCase().replace(/\s+/g, '.')}@client.example.com`;
    const clientPhone = requirements.clientPhone || '+1 (555) 019-2831';

    const newLead: TravelLead = {
      id: `lead-${leadCode}`,
      leadNumber: `LED-${leadCode}`,
      contactName: clientName,
      email: clientEmail,
      phone: clientPhone,
      companyName: user?.companyName || user?.agencyName || 'B2B Travel Partner',
      agencyName: user?.agencyName || user?.companyName,
      assignedStaffId: user?.id,
      assignedStaffName: user?.name || (user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'Unassigned'),
      source: 'QUOTATION_SAVED',
      status: 'QUALIFIED',
      priority: 'HIGH',
      estimatedBudget: plan.totalSellingPrice,
      currency: plan.currency,
      destinationName: plan.destinationName,
      destinationId: plan.destinationId,
      paxAdults: requirements.travelers.adults.value,
      paxChildren: requirements.travelers.children.value,
      paxInfants: requirements.travelers.infants.value,
      travelStartDate: requirements.travelDates.startDate.value || timestamp.split('T')[0],
      travelDates: requirements.travelDates.startDate.value || timestamp.split('T')[0],
      numberOfNights: requirements.duration.nights.value,
      travelRequirements: `AI Planner generated ${plan.badge} itinerary (${plan.routeSummary.join(' → ')})`,
      quoteId: quoteId,
      notes: [
        {
          id: `note-${Date.now()}`,
          authorId: user?.id || 'ai-planner',
          authorName: 'TheUnbound AI Planner',
          text: `AI Planner generated ${plan.badge} itinerary (${plan.routeSummary.join(' → ')}) for ${requirements.travelers.adults.value} Adults. Total Estimated Selling: ${plan.currency} ${plan.totalSellingPrice.toLocaleString()}.`,
          timestamp
        }
      ],
      timeline: [
        {
          id: `tl-${Date.now()}`,
          type: 'CUSTOM_ACTIVITY',
          title: 'AI Planner Itinerary Drafted',
          description: `Generated ${plan.title} with ${plan.items.length} curated inventory items.`,
          timestamp,
          performedBy: user?.name || 'TheUnbound AI Planner'
        }
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
      lastActivityAt: timestamp
    };

    const savedLead = this.db.saveLead(newLead, user);

    this.logActivity('AI_PLAN_SAVED', user, {
      quoteId,
      leadId: savedLead.id,
      destination: plan.destinationName,
      pax: requirements.travelers.adults.value + requirements.travelers.children.value,
      nights: requirements.duration.nights.value,
      totalSellingPrice: plan.totalSellingPrice,
      currency: plan.currency
    });

    return savedLead;
  }

  /**
   * Analytics Metrics for Admin CMS
   */
  public getAnalyticsMetrics(): {
    totalPlansGenerated: number;
    totalOpenedInQuoteBuilder: number;
    totalQuotesSaved: number;
    conversionRatePercent: number;
    topDestinations: { name: string; count: number }[];
    recentEvents: AiPlannerActivityEvent[];
  } {
    const events = this.getActivities();
    const generated = events.filter(e => e.action === 'AI_PLAN_GENERATED' || e.action === 'AI_PLAN_REGENERATED').length;
    const openedInBuilder = events.filter(e => e.action === 'AI_PLAN_OPENED_IN_QUOTE_BUILDER').length;
    const quotesSaved = events.filter(e => e.action === 'AI_PLAN_SAVED' || e.action === 'QUOTE_GENERATED').length;

    const conversionRate = generated > 0 ? Math.round((openedInBuilder / generated) * 100) : 0;

    const destCounts: Record<string, number> = {};
    events.forEach(e => {
      if (e.destination) {
        destCounts[e.destination] = (destCounts[e.destination] || 0) + 1;
      }
    });

    const topDestinations = Object.entries(destCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalPlansGenerated: generated,
      totalOpenedInQuoteBuilder: openedInBuilder,
      totalQuotesSaved: quotesSaved,
      conversionRatePercent: conversionRate,
      topDestinations,
      recentEvents: events.slice(0, 20)
    };
  }
}
