import { 
  CampaignEvent, 
  CampaignEventType, 
  CampaignAnalyticsSummary, 
  CampaignDateFilter, 
  CampaignDailyTrend,
  CampaignPlacementStats,
  CampaignCTAStats,
  Promotion,
  PromotionPlacement
} from '../types';
import { AppDatabase } from './db';

// Privacy-conscious session identifier management
const SESSION_KEY = 'theunbound_campaign_sess_id';
const ATTRIBUTION_KEY = 'theunbound_active_campaign_attribution';
const DEDUPLICATION_SESSION_PREFIX = 'theunbound_viewed_promo_';

export interface ActiveCampaignAttribution {
  campaignId: string;
  placement: string;
  ctaId?: string;
  ctaText?: string;
  timestamp: string;
  destinationId?: string;
  promoCode?: string;
}

export class CampaignAnalyticsService {
  private static instance: CampaignAnalyticsService;

  public static getInstance(): CampaignAnalyticsService {
    if (!CampaignAnalyticsService.instance) {
      CampaignAnalyticsService.instance = new CampaignAnalyticsService();
    }
    return CampaignAnalyticsService.instance;
  }

  /**
   * Retrieves or creates an anonymous session identifier stored in sessionStorage
   * strictly adhering to privacy standards (no PII or IP stored).
   */
  public getSessionId(): string {
    if (typeof window === 'undefined') return 'server_session';
    try {
      let sess = sessionStorage.getItem(SESSION_KEY);
      if (!sess) {
        sess = `sess_${Date.now().toString(36)}_${Math.random().toString(36).substring(2, 9)}`;
        sessionStorage.setItem(SESSION_KEY, sess);
      }
      return sess;
    } catch {
      return `sess_${Date.now().toString(36)}`;
    }
  }

  /**
   * Gets current active campaign attribution from session
   */
  public getActiveAttribution(): ActiveCampaignAttribution | null {
    if (typeof window === 'undefined') return null;
    try {
      const raw = sessionStorage.getItem(ATTRIBUTION_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      // Valid for 24 hours of session activity
      const ageHours = (Date.now() - new Date(parsed.timestamp).getTime()) / (1000 * 60 * 60);
      if (ageHours > 24) {
        sessionStorage.removeItem(ATTRIBUTION_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }

  /**
   * Sets active campaign attribution when a CTA or link is clicked
   */
  public setAttribution(attribution: ActiveCampaignAttribution): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attribution));
    } catch (e) {
      console.debug('Failed to write campaign attribution to session:', e);
    }
  }

  /**
   * Clears active attribution
   */
  public clearAttribution(): void {
    if (typeof window === 'undefined') return;
    try {
      sessionStorage.removeItem(ATTRIBUTION_KEY);
    } catch {}
  }

  /**
   * Records a genuine campaign VIEW (impression).
   * Deduplicates per component render and session to avoid inflated counts.
   */
  public trackView(
    campaignId: string, 
    placement: PromotionPlacement | string,
    metadata?: Record<string, any>
  ): void {
    if (!campaignId) return;

    // Check if campaign is active
    const db = AppDatabase.getInstance();
    const promo = db.getPromotions().find(p => p.id === campaignId);
    if (!promo || !promo.isActive || promo.isArchived || promo.status === 'PAUSED' || promo.status === 'ARCHIVED') {
      return;
    }

    const sessionId = this.getSessionId();
    const dedupKey = `${DEDUPLICATION_SESSION_PREFIX}${campaignId}_${placement}`;

    // Deduplication check in session
    if (typeof window !== 'undefined') {
      try {
        const alreadyTrackedInSession = sessionStorage.getItem(dedupKey);
        if (alreadyTrackedInSession) {
          // Already recorded this view in this session
          return;
        }
        sessionStorage.setItem(dedupKey, Date.now().toString());
      } catch {}
    }

    const currentUser = db.getCurrentUser();
    db.recordCampaignEvent({
      campaignId,
      eventType: 'VIEW',
      placement,
      sessionId,
      userId: currentUser?.id,
      destinationId: promo.destinationId || metadata?.destinationId,
      metadata
    });
  }

  /**
   * Records a genuine campaign CLICK when user clicks a CTA button or promo code.
   */
  public trackClick(
    campaignId: string,
    placement: PromotionPlacement | string,
    ctaId: string,
    ctaText: string,
    metadata?: Record<string, any>
  ): void {
    if (!campaignId) return;

    const db = AppDatabase.getInstance();
    const promo = db.getPromotions().find(p => p.id === campaignId);
    if (!promo || promo.isArchived || promo.status === 'PAUSED' || promo.status === 'ARCHIVED') {
      return;
    }

    const sessionId = this.getSessionId();
    const currentUser = db.getCurrentUser();

    // Store active attribution for journey tracking
    this.setAttribution({
      campaignId,
      placement,
      ctaId,
      ctaText,
      timestamp: new Date().toISOString(),
      destinationId: promo.destinationId || metadata?.destinationId,
      promoCode: promo.promoCode
    });

    db.recordCampaignEvent({
      campaignId,
      eventType: 'CLICK',
      placement,
      ctaId,
      ctaText,
      sessionId,
      userId: currentUser?.id,
      destinationId: promo.destinationId || metadata?.destinationId,
      metadata
    });
  }

  /**
   * Tracks a product/package view in journey if attribution exists
   */
  public trackProductView(productId: string, destinationId?: string, metadata?: Record<string, any>): void {
    const attr = this.getActiveAttribution();
    if (!attr) return;

    const db = AppDatabase.getInstance();
    const sessionId = this.getSessionId();
    const currentUser = db.getCurrentUser();

    db.recordCampaignEvent({
      campaignId: attr.campaignId,
      eventType: 'PRODUCT_VIEW',
      placement: attr.placement,
      productId,
      destinationId: destinationId || attr.destinationId,
      sessionId,
      userId: currentUser?.id,
      metadata
    });
  }

  /**
   * Tracks quotation creation attribution
   */
  public trackQuoteCreated(quotationId: string, value: number, currency: string, destinationId?: string): void {
    const attr = this.getActiveAttribution();
    if (!attr) return;

    const db = AppDatabase.getInstance();
    const sessionId = this.getSessionId();
    const currentUser = db.getCurrentUser();

    db.recordCampaignEvent({
      campaignId: attr.campaignId,
      eventType: 'QUOTE_CREATED',
      placement: attr.placement,
      quotationId,
      bookingValue: value,
      currency,
      destinationId: destinationId || attr.destinationId,
      sessionId,
      userId: currentUser?.id
    });
  }

  /**
   * Tracks booking creation attribution
   */
  public trackBookingCreated(bookingId: string, value: number, currency: string, campaignIdOverride?: string): void {
    const attr = this.getActiveAttribution();
    const targetCampaignId = campaignIdOverride || attr?.campaignId;
    if (!targetCampaignId) return;

    const db = AppDatabase.getInstance();
    const sessionId = this.getSessionId();
    const currentUser = db.getCurrentUser();

    db.recordCampaignEvent({
      campaignId: targetCampaignId,
      eventType: 'BOOKING_CREATED',
      placement: attr?.placement || 'BANNER',
      bookingId,
      bookingValue: value,
      currency,
      sessionId,
      userId: currentUser?.id
    });
  }

  /**
   * Computes filtered campaign analytics dynamically based on actual stored events.
   * Never fabricates, estimates, or seeds random numbers.
   */
  public computeAnalytics(
    promotions: Promotion[],
    events: CampaignEvent[],
    dateFilter: CampaignDateFilter,
    customStartDate?: string,
    customEndDate?: string
  ): {
    summaries: CampaignAnalyticsSummary[];
    aggregate: {
      totalViews: number;
      uniqueViews: number;
      totalClicks: number;
      uniqueClicks: number;
      overallCtr: number | null;
      totalQuotes: number;
      totalBookings: number;
      overallConversionRate: number | null;
      totalRevenue: number;
    };
  } {
    // 1. Determine Date Range Filter Bounds
    const now = new Date();
    let filterStart: Date;
    let filterEnd: Date = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    switch (dateFilter) {
      case 'TODAY':
        filterStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        break;
      case 'YESTERDAY': {
        const y = new Date(now);
        y.setDate(y.getDate() - 1);
        filterStart = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 0, 0, 0, 0);
        filterEnd = new Date(y.getFullYear(), y.getMonth(), y.getDate(), 23, 59, 59, 999);
        break;
      }
      case 'LAST_7_DAYS': {
        filterStart = new Date(now);
        filterStart.setDate(filterStart.getDate() - 6);
        filterStart.setHours(0, 0, 0, 0);
        break;
      }
      case 'LAST_30_DAYS': {
        filterStart = new Date(now);
        filterStart.setDate(filterStart.getDate() - 29);
        filterStart.setHours(0, 0, 0, 0);
        break;
      }
      case 'THIS_MONTH':
        filterStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        break;
      case 'PREVIOUS_MONTH':
        filterStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        filterEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
        break;
      case 'CUSTOM':
        if (customStartDate) {
          filterStart = new Date(customStartDate + 'T00:00:00');
        } else {
          filterStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        }
        if (customEndDate) {
          filterEnd = new Date(customEndDate + 'T23:59:59');
        }
        break;
      default:
        filterStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    }

    // 2. Filter events by timestamp
    const filteredEvents = events.filter(evt => {
      if (!evt.timestamp) return false;
      const t = new Date(evt.timestamp).getTime();
      return t >= filterStart.getTime() && t <= filterEnd.getTime();
    });

    // 3. Aggregate per campaign
    const summaries: CampaignAnalyticsSummary[] = promotions.map(promo => {
      const promoEvents = filteredEvents.filter(e => e.campaignId === promo.id);

      const viewEvents = promoEvents.filter(e => e.eventType === 'VIEW');
      const clickEvents = promoEvents.filter(e => e.eventType === 'CLICK');
      const quoteEvents = promoEvents.filter(e => e.eventType === 'QUOTE_CREATED');
      const bookingEvents = promoEvents.filter(e => e.eventType === 'BOOKING_CREATED');

      const totalViews = viewEvents.length;
      const uniqueViews = new Set(viewEvents.map(e => e.sessionId).filter(Boolean)).size;

      const totalClicks = clickEvents.length;
      const uniqueClicks = new Set(clickEvents.map(e => e.sessionId).filter(Boolean)).size;

      const quotesCount = quoteEvents.length;
      const bookingsCount = bookingEvents.length;

      // CTR Calculation (null if 0 views)
      const ctr = totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(2)) : null;

      // Conversion Rate (null if 0 clicks, otherwise Bookings / Clicks * 100)
      const conversionRate = totalClicks > 0 ? Number(((bookingsCount / totalClicks) * 100).toFixed(2)) : null;

      const revenueAttributed = bookingEvents.reduce((sum, b) => sum + (Number(b.bookingValue) || 0), 0);

      // Placements breakdown
      const placementsMap = new Map<string, { views: number; uniqueViews: Set<string>; clicks: number; uniqueClicks: Set<string> }>();
      
      promoEvents.forEach(e => {
        const pKey = e.placement || promo.displayPlacement || 'BANNER';
        if (!placementsMap.has(pKey)) {
          placementsMap.set(pKey, { views: 0, uniqueViews: new Set(), clicks: 0, uniqueClicks: new Set() });
        }
        const pStat = placementsMap.get(pKey)!;
        if (e.eventType === 'VIEW') {
          pStat.views++;
          if (e.sessionId) pStat.uniqueViews.add(e.sessionId);
        } else if (e.eventType === 'CLICK') {
          pStat.clicks++;
          if (e.sessionId) pStat.uniqueClicks.add(e.sessionId);
        }
      });

      const placementsBreakdown: CampaignPlacementStats[] = Array.from(placementsMap.entries()).map(([placement, data]) => ({
        placement,
        views: data.views,
        uniqueViews: data.uniqueViews.size,
        clicks: data.clicks,
        uniqueClicks: data.uniqueClicks.size,
        ctr: data.views > 0 ? Number(((data.clicks / data.views) * 100).toFixed(2)) : null
      })).sort((a, b) => b.clicks - a.clicks);

      // CTA breakdown
      const ctaMap = new Map<string, { ctaText: string; clicks: number; uniqueClicks: Set<string> }>();
      clickEvents.forEach(e => {
        const cId = e.ctaId || 'default_cta';
        const cText = e.ctaText || promo.ctaText || 'Learn More';
        if (!ctaMap.has(cId)) {
          ctaMap.set(cId, { ctaText: cText, clicks: 0, uniqueClicks: new Set() });
        }
        const cData = ctaMap.get(cId)!;
        cData.clicks++;
        if (e.sessionId) cData.uniqueClicks.add(e.sessionId);
      });

      const ctaBreakdown: CampaignCTAStats[] = Array.from(ctaMap.entries()).map(([ctaId, data]) => ({
        ctaId,
        ctaText: data.ctaText,
        clicks: data.clicks,
        uniqueClicks: data.uniqueClicks.size
      })).sort((a, b) => b.clicks - a.clicks);

      // Daily trends
      const dailyMap = new Map<string, { views: number; uniqueViews: Set<string>; clicks: number; uniqueClicks: Set<string>; quotes: number; bookings: number; revenue: number }>();
      
      // Seed days in date range for complete chronological chart
      const dayCursor = new Date(filterStart);
      while (dayCursor <= filterEnd) {
        const dStr = dayCursor.toISOString().split('T')[0];
        dailyMap.set(dStr, { views: 0, uniqueViews: new Set(), clicks: 0, uniqueClicks: new Set(), quotes: 0, bookings: 0, revenue: 0 });
        dayCursor.setDate(dayCursor.getDate() + 1);
      }

      promoEvents.forEach(e => {
        if (!e.timestamp) return;
        const dStr = e.timestamp.split('T')[0];
        if (!dailyMap.has(dStr)) {
          dailyMap.set(dStr, { views: 0, uniqueViews: new Set(), clicks: 0, uniqueClicks: new Set(), quotes: 0, bookings: 0, revenue: 0 });
        }
        const dStat = dailyMap.get(dStr)!;
        if (e.eventType === 'VIEW') {
          dStat.views++;
          if (e.sessionId) dStat.uniqueViews.add(e.sessionId);
        } else if (e.eventType === 'CLICK') {
          dStat.clicks++;
          if (e.sessionId) dStat.uniqueClicks.add(e.sessionId);
        } else if (e.eventType === 'QUOTE_CREATED') {
          dStat.quotes++;
        } else if (e.eventType === 'BOOKING_CREATED') {
          dStat.bookings++;
          dStat.revenue += Number(e.bookingValue) || 0;
        }
      });

      const dailyTrends: CampaignDailyTrend[] = Array.from(dailyMap.entries()).map(([date, dStat]) => ({
        date,
        views: dStat.views,
        uniqueViews: dStat.uniqueViews.size,
        clicks: dStat.clicks,
        uniqueClicks: dStat.uniqueClicks.size,
        ctr: dStat.views > 0 ? Number(((dStat.clicks / dStat.views) * 100).toFixed(2)) : null,
        quotes: dStat.quotes,
        bookings: dStat.bookings,
        revenue: dStat.revenue
      })).sort((a, b) => a.date.localeCompare(b.date));

      // Determine active status
      const todayStr = now.toISOString().split('T')[0];
      let resolvedStatus = promo.status || (promo.isActive ? 'ACTIVE' : 'PAUSED');
      if (promo.isArchived) {
        resolvedStatus = 'ARCHIVED';
      } else if (promo.status === 'PAUSED' || !promo.isActive) {
        resolvedStatus = 'PAUSED';
      } else if (promo.startDate && promo.startDate > todayStr) {
        resolvedStatus = 'SCHEDULED';
      } else if (promo.endDate && promo.endDate < todayStr) {
        resolvedStatus = 'EXPIRED';
      } else {
        resolvedStatus = 'ACTIVE';
      }

      return {
        campaignId: promo.id,
        campaignTitle: promo.title,
        status: resolvedStatus,
        startDate: promo.startDate,
        endDate: promo.endDate,
        views: totalViews,
        uniqueViews,
        clicks: totalClicks,
        uniqueClicks,
        ctr,
        quotesCount,
        bookingsCount,
        conversionRate,
        revenueAttributed,
        placementsBreakdown,
        ctaBreakdown,
        dailyTrends
      };
    });

    // 4. Compute Aggregate Totals
    const totalViews = summaries.reduce((sum, s) => sum + s.views, 0);
    const totalClicks = summaries.reduce((sum, s) => sum + s.clicks, 0);
    const totalQuotes = summaries.reduce((sum, s) => sum + s.quotesCount, 0);
    const totalBookings = summaries.reduce((sum, s) => sum + s.bookingsCount, 0);
    const totalRevenue = summaries.reduce((sum, s) => sum + s.revenueAttributed, 0);

    const allFilteredViewSessionIds = new Set(filteredEvents.filter(e => e.eventType === 'VIEW').map(e => e.sessionId).filter(Boolean));
    const allFilteredClickSessionIds = new Set(filteredEvents.filter(e => e.eventType === 'CLICK').map(e => e.sessionId).filter(Boolean));

    const overallCtr = totalViews > 0 ? Number(((totalClicks / totalViews) * 100).toFixed(2)) : null;
    const overallConversionRate = totalClicks > 0 ? Number(((totalBookings / totalClicks) * 100).toFixed(2)) : null;

    return {
      summaries,
      aggregate: {
        totalViews,
        uniqueViews: allFilteredViewSessionIds.size,
        totalClicks,
        uniqueClicks: allFilteredClickSessionIds.size,
        overallCtr,
        totalQuotes,
        totalBookings,
        overallConversionRate,
        totalRevenue
      }
    };
  }
}

export const campaignAnalytics = CampaignAnalyticsService.getInstance();
