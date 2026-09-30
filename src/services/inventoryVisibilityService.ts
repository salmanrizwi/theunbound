import { useState, useEffect, useMemo } from 'react';
import { 
  Destination, 
  CityHub, 
  Product, 
  Hotel, 
  B2BPackage, 
  TransferRoute, 
  VisaProduct 
} from '../types';
import { AppDatabase } from './db';
import { matchesDestination, matchesHub } from './destinationRelevanceService';

export type ComputedEntityVisibilityStatus = 'LIVE' | 'COMING_SOON' | 'HIDDEN';

export interface DestinationInventoryCounts {
  totalActiveInventory: number;
  products: number;
  hotels: number;
  packages: number;
  transfers: number;
  visas: number;
}

export interface HubInventoryCounts {
  totalActiveInventory: number;
  products: number;
  hotels: number;
  packages: number;
  transfers: number;
}

type VisibilityChangeListener = () => void;

/**
 * InventoryVisibilityService
 * 
 * Authoritative system service enforcing real-time production visibility rules:
 * 1. Single Authoritative Inventory Visibility Rule: Destinations and Hubs are visible
 *    only when current production status and qualifying active inventory qualify them.
 * 2. LIVE destinations and hubs must have active, qualifying inventory.
 * 3. COMING SOON destinations and hubs must be explicitly configured as COMING_SOON.
 * 4. Empty/zero-inventory destinations without explicit COMING_SOON status are HIDDEN.
 * 5. No orphan hubs; hubs inherit destination validity and require qualifying hub inventory.
 * 6. Admin users can view all non-deleted records with their computed visibility status.
 * 7. Real-time cache invalidation on any inventory mutation or deletion.
 */
export class InventoryVisibilityService {
  private static instance: InventoryVisibilityService | null = null;
  private listeners: Set<VisibilityChangeListener> = new Set();
  private db: AppDatabase;
  private version: number = 0;

  private constructor() {
    this.db = AppDatabase.getInstance();
    // Subscribe to underlying database updates to re-evaluate visibility
    this.db.subscribe(() => {
      this.notifyInventoryChanged();
    });
  }

  public static getInstance(): InventoryVisibilityService {
    if (!InventoryVisibilityService.instance) {
      InventoryVisibilityService.instance = new InventoryVisibilityService();
    }
    return InventoryVisibilityService.instance;
  }

  /**
   * Subscribe to visibility and inventory calculation changes.
   */
  public subscribe(listener: VisibilityChangeListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Triggers re-computation across all listeners (Home page, B2B Portal, Quote Builder).
   */
  public notifyInventoryChanged(): void {
    this.version++;
    this.listeners.forEach(fn => {
      try {
        fn();
      } catch (err) {
        console.error('[InventoryVisibilityService] Listener error:', err);
      }
    });
  }

  public getVersion(): number {
    return this.version;
  }

  // ==========================================
  // ACTIVE INVENTORY EVALUATION
  // ==========================================

  public getActiveProducts(): Product[] {
    const deletedSet = this.db.getDeletedEntityIds();
    return this.db.getProducts().filter(p => {
      if (!p || !p.id) return false;
      if (deletedSet.has(p.id) || (p.sku && deletedSet.has(p.sku))) return false;
      if ((p as any).isDeleted === true || (p as any).status === 'DELETED') return false;
      // Active product statuses
      const status = (p.status || 'ACTIVE').toUpperCase();
      return status === 'ACTIVE' || status === 'PUBLISHED' || status === 'LIVE';
    });
  }

  public getActiveHotels(): Hotel[] {
    const deletedSet = this.db.getDeletedEntityIds();
    return this.db.getHotels().filter(h => {
      if (!h || !h.id) return false;
      if (deletedSet.has(h.id) || (h.code && deletedSet.has(h.code))) return false;
      if ((h as any).isDeleted === true || (h as any).status === 'DELETED') return false;
      const status = (h.status || 'ACTIVE').toUpperCase();
      return status === 'ACTIVE' || status === 'PUBLISHED' || status === 'LIVE';
    });
  }

  public getActivePackages(): B2BPackage[] {
    const deletedSet = this.db.getDeletedEntityIds();
    return this.db.getB2BPackages().filter(pkg => {
      if (!pkg || !pkg.id) return false;
      if (deletedSet.has(pkg.id)) return false;
      if ((pkg as any).isDeleted === true || (pkg as any).status === 'DELETED') return false;
      const status = (pkg.status || 'PUBLISHED').toUpperCase();
      return status === 'PUBLISHED' || status === 'ACTIVE' || status === 'LIVE' || pkg.isPublished === true;
    });
  }

  public getActiveTransferRoutes(): TransferRoute[] {
    const deletedSet = this.db.getDeletedEntityIds();
    return this.db.getTransferRoutes().filter(tr => {
      if (!tr || !tr.id) return false;
      if (deletedSet.has(tr.id)) return false;
      if ((tr as any).isDeleted === true || (tr as any).status === 'DELETED') return false;
      const status = (tr.status || 'ACTIVE').toUpperCase();
      return status !== 'INACTIVE' && status !== 'ARCHIVED';
    });
  }

  public getActiveVisas(): VisaProduct[] {
    const deletedSet = this.db.getDeletedEntityIds();
    return this.db.getVisas().filter(v => {
      if (!v || !v.id) return false;
      if (deletedSet.has(v.id)) return false;
      if ((v as any).isDeleted === true || (v as any).status === 'DELETED') return false;
      const status = (v.status || 'ACTIVE').toUpperCase();
      return status !== 'INACTIVE' && status !== 'ARCHIVED';
    });
  }

  // ==========================================
  // INVENTORY COUNT BREAKDOWNS
  // ==========================================

  public getDestinationInventoryCounts(destinationIdOrSlug: string): DestinationInventoryCounts {
    if (!destinationIdOrSlug) {
      return { totalActiveInventory: 0, products: 0, hotels: 0, packages: 0, transfers: 0, visas: 0 };
    }

    const allDests = this.db.getDestinations();
    const dest = allDests.find(d => 
      d.id === destinationIdOrSlug || 
      d.slug === destinationIdOrSlug || 
      d.name?.toLowerCase() === destinationIdOrSlug.toLowerCase()
    );

    const destId = dest?.id || destinationIdOrSlug;
    const destName = dest?.name || destinationIdOrSlug;
    const destCountry = dest?.country || destName;

    // Count active products
    const activeProducts = this.getActiveProducts().filter(p => 
      p.destinationId === destId || 
      matchesDestination(destName, p.destinationId, p.destinationName, p.country) ||
      matchesDestination(destId, p.destinationId, p.destinationName, p.country)
    );

    // Count active hotels
    const activeHotels = this.getActiveHotels().filter(h => 
      h.destinationId === destId || 
      matchesDestination(destName, h.destinationId, h.destinationName, h.country) ||
      matchesDestination(destId, h.destinationId, h.destinationName, h.country)
    );

    // Count active packages
    const activePackages = this.getActivePackages().filter(pkg => 
      pkg.destinationId === destId || 
      matchesDestination(destName, pkg.destinationId, pkg.destinationName) ||
      matchesDestination(destId, pkg.destinationId, pkg.destinationName)
    );

    // Count active transfers
    const activeTransfers = this.getActiveTransferRoutes().filter(tr => 
      tr.destinationId === destId || 
      matchesDestination(destName, tr.destinationId) ||
      matchesDestination(destId, tr.destinationId)
    );

    // Count active visas
    const activeVisas = this.getActiveVisas().filter(v => 
      v.destinationId === destId || 
      matchesDestination(destCountry, v.destinationId, undefined, v.country) ||
      matchesDestination(destName, v.destinationId, undefined, v.country)
    );

    const total = activeProducts.length + activeHotels.length + activePackages.length + activeTransfers.length + activeVisas.length;

    return {
      totalActiveInventory: total,
      products: activeProducts.length,
      hotels: activeHotels.length,
      packages: activePackages.length,
      transfers: activeTransfers.length,
      visas: activeVisas.length
    };
  }

  public getHubInventoryCounts(hubId: string): HubInventoryCounts {
    if (!hubId) {
      return { totalActiveInventory: 0, products: 0, hotels: 0, packages: 0, transfers: 0 };
    }

    const hubs = this.db.getCityHubs();
    const hub = hubs.find(h => h.id === hubId || h.slug === hubId);
    const hId = hub?.id || hubId;
    const hName = hub?.name || '';

    // Active products for hub
    const activeProducts = this.getActiveProducts().filter(p => 
      p.hubId === hId || 
      matchesHub(hName, p.hubId, p.city, (p as any).cityId) ||
      matchesHub(hId, p.hubId, p.city, (p as any).cityId)
    );

    // Active hotels for hub
    const activeHotels = this.getActiveHotels().filter(h => 
      h.hubId === hId || 
      h.cityId === hId || 
      matchesHub(hName, h.hubId, h.cityName, h.cityId) ||
      matchesHub(hId, h.hubId, h.cityName, h.cityId)
    );

    // Active packages that include this hub
    const activePackages = this.getActivePackages().filter(pkg => 
      (pkg.hubIds && pkg.hubIds.includes(hId)) ||
      (hName && pkg.routeSummary && pkg.routeSummary.some(r => r.toLowerCase().includes(hName.toLowerCase()))) ||
      (pkg.routeHubs && pkg.routeHubs.some(rh => rh.hubId === hId || (hName && rh.hubName?.toLowerCase() === hName.toLowerCase())))
    );

    // Active transfers to/from this hub
    const activeTransfers = this.getActiveTransferRoutes().filter(tr => 
      tr.fromHubId === hId || tr.toHubId === hId
    );

    const total = activeProducts.length + activeHotels.length + activePackages.length + activeTransfers.length;

    return {
      totalActiveInventory: total,
      products: activeProducts.length,
      hotels: activeHotels.length,
      packages: activePackages.length,
      transfers: activeTransfers.length
    };
  }

  // ==========================================
  // COMPUTED STATUS LOGIC
  // ==========================================

  /**
   * Authoritative Destination Computed Status
   * 
   * Rules:
   * 1. If tombstoned, deleted, or explicitly marked ARCHIVED or INACTIVE -> 'HIDDEN'
   * 2. If explicitly configured as COMING_SOON -> 'COMING_SOON'
   * 3. If configured as LIVE or ACTIVE:
   *    - Must have at least 1 active inventory item (product/hotel/package/transfer/visa).
   *    - If active inventory > 0 -> 'LIVE'
   *    - If active inventory === 0 -> 'HIDDEN' (Zero inventory does not qualify as LIVE,
   *      and must not be inferred as COMING_SOON unless explicitly marked).
   */
  public getDestinationComputedStatus(dest: Destination): ComputedEntityVisibilityStatus {
    if (!dest || !dest.id) return 'HIDDEN';

    const deletedSet = this.db.getDeletedEntityIds();
    if (deletedSet.has(dest.id) || (dest.slug && deletedSet.has(dest.slug))) {
      return 'HIDDEN';
    }

    if ((dest as any).isDeleted === true || (dest as any).status === 'DELETED') {
      return 'HIDDEN';
    }

    const rawStatus = ((dest as any).visibilityStatus || dest.status || 'ACTIVE').toUpperCase();

    if (rawStatus === 'ARCHIVED' || rawStatus === 'INACTIVE' || rawStatus === 'DRAFT' || rawStatus === 'DISABLED') {
      return 'HIDDEN';
    }

    if (rawStatus === 'COMING_SOON') {
      return 'COMING_SOON';
    }

    // When status is LIVE or ACTIVE, verify active inventory qualification
    const counts = this.getDestinationInventoryCounts(dest.id);
    if (counts.totalActiveInventory > 0) {
      return 'LIVE';
    }

    // Zero active inventory -> cannot be shown as LIVE on public / B2B portals
    return 'HIDDEN';
  }

  /**
   * Authoritative Hub Computed Status
   * 
   * Rules:
   * 1. Hub must not be tombstoned or marked DELETED/ARCHIVED/INACTIVE.
   * 2. Hub must have a valid, non-hidden parent destination (no orphan hubs).
   * 3. If explicitly marked COMING_SOON -> 'COMING_SOON'
   * 4. If LIVE or ACTIVE:
   *    - Requires active inventory tied directly to this hub (or parent active products).
   *    - If hub inventory > 0 -> 'LIVE'
   *    - If hub inventory === 0 -> 'HIDDEN'
   */
  public getHubComputedStatus(hub: CityHub, parentDest?: Destination): ComputedEntityVisibilityStatus {
    if (!hub || !hub.id) return 'HIDDEN';

    const deletedSet = this.db.getDeletedEntityIds();
    if (deletedSet.has(hub.id) || (hub.slug && deletedSet.has(hub.slug))) {
      return 'HIDDEN';
    }

    if ((hub as any).isDeleted === true || (hub as any).status === 'DELETED') {
      return 'HIDDEN';
    }

    const rawStatus = (hub.status || 'ACTIVE').toUpperCase();
    if (rawStatus === 'ARCHIVED' || rawStatus === 'INACTIVE' || rawStatus === 'DRAFT' || rawStatus === 'DISABLED') {
      return 'HIDDEN';
    }

    // Check parent destination (no orphan hubs allowed in public/B2B views)
    const resolvedParent = parentDest || this.db.getDestinations().find(d => 
      d.id === hub.destinationId || 
      d.slug === hub.destinationId || 
      d.name?.toLowerCase() === hub.destinationName?.toLowerCase()
    );

    if (!resolvedParent) {
      return 'HIDDEN'; // Orphan hub without valid parent destination
    }

    const parentStatus = this.getDestinationComputedStatus(resolvedParent);
    if (parentStatus === 'HIDDEN') {
      return 'HIDDEN'; // Hub of hidden destination is hidden
    }

    if (rawStatus === 'COMING_SOON') {
      return 'COMING_SOON';
    }

    // For LIVE status, verify active hub inventory
    const hubCounts = this.getHubInventoryCounts(hub.id);
    if (hubCounts.totalActiveInventory > 0) {
      return 'LIVE';
    }

    return 'HIDDEN';
  }

  // ==========================================
  // CATALOG RETRIEVAL (ROLE-AWARE)
  // ==========================================

  private isAdminRole(role?: string): boolean {
    if (!role) return false;
    const r = role.toUpperCase();
    return r === 'ADMIN' || r === 'SUPER_ADMIN' || r === 'MASTER_ADMIN' || r === 'TEAM_MEMBER' || r === 'DMC_STAFF';
  }

  /**
   * Returns destinations eligible for display.
   * - Public / Buyer / Agent: only LIVE and COMING_SOON destinations with inventory backing.
   * - Admin: all non-deleted destinations (for internal management).
   */
  public getVisibleDestinations(userRole?: string): Destination[] {
    const deletedSet = this.db.getDeletedEntityIds();
    const all = this.db.getDestinations().filter(d => 
      !deletedSet.has(d.id) && 
      !(d.slug && deletedSet.has(d.slug)) && 
      !(d as any).isDeleted && 
      (d as any).status !== 'DELETED'
    );

    if (this.isAdminRole(userRole)) {
      return all;
    }

    return all.filter(d => {
      const status = this.getDestinationComputedStatus(d);
      return status === 'LIVE' || status === 'COMING_SOON';
    });
  }

  /**
   * Returns only LIVE destinations (with active inventory).
   */
  public getLiveDestinations(userRole?: string): Destination[] {
    return this.getVisibleDestinations(userRole).filter(d => 
      this.getDestinationComputedStatus(d) === 'LIVE'
    );
  }

  /**
   * Returns only COMING SOON destinations (explicitly marked).
   */
  public getComingSoonDestinations(userRole?: string): Destination[] {
    return this.getVisibleDestinations(userRole).filter(d => 
      this.getDestinationComputedStatus(d) === 'COMING_SOON'
    );
  }

  /**
   * Returns eligible hubs for a destination (or across all destinations).
   * Excludes orphan hubs, hubs of hidden destinations, and zero-inventory hubs.
   */
  public getVisibleHubs(destinationIdOrSlug?: string, userRole?: string): CityHub[] {
    const deletedSet = this.db.getDeletedEntityIds();
    const allHubs = this.db.getCityHubs().filter(h => 
      !deletedSet.has(h.id) && 
      !(h.slug && deletedSet.has(h.slug)) && 
      !(h as any).isDeleted && 
      (h as any).status !== 'DELETED'
    );

    const allDests = this.db.getDestinations();

    let filteredHubs = allHubs;
    if (destinationIdOrSlug && destinationIdOrSlug !== 'all') {
      const targetDest = allDests.find(d => 
        d.id === destinationIdOrSlug || 
        d.slug === destinationIdOrSlug || 
        (d.name || '').toLowerCase() === (destinationIdOrSlug || '').toLowerCase()
      );
      const destId = targetDest?.id || destinationIdOrSlug;
      const destName = targetDest?.name || destinationIdOrSlug;

      filteredHubs = allHubs.filter(h => 
        h.destinationId === destId || 
        h.destinationName?.toLowerCase() === destName.toLowerCase() ||
        matchesDestination(destinationIdOrSlug, h.destinationId, h.destinationName)
      );
    }

    if (this.isAdminRole(userRole)) {
      return filteredHubs;
    }

    return filteredHubs.filter(hub => {
      const parent = allDests.find(d => d.id === hub.destinationId || d.name?.toLowerCase() === hub.destinationName?.toLowerCase());
      const status = this.getHubComputedStatus(hub, parent);
      return status === 'LIVE' || status === 'COMING_SOON';
    });
  }

  /**
   * Checks whether a destination is eligible for public/agent display.
   */
  public isDestinationEligible(destination: Destination, userRole?: string): boolean {
    if (this.isAdminRole(userRole)) return true;
    const status = this.getDestinationComputedStatus(destination);
    return status === 'LIVE' || status === 'COMING_SOON';
  }

  /**
   * Checks whether a hub is eligible for public/agent display.
   */
  public isHubEligible(hub: CityHub, parentDest?: Destination, userRole?: string): boolean {
    if (this.isAdminRole(userRole)) return true;
    const status = this.getHubComputedStatus(hub, parentDest);
    return status === 'LIVE' || status === 'COMING_SOON';
  }
}

export const inventoryVisibilityService = InventoryVisibilityService.getInstance();

/**
 * React Hook: useInventoryVisibility
 * 
 * Provides reactive visible destinations, hubs, and status helpers.
 * Re-evaluates whenever Firestore or AppDatabase inventory changes.
 */
export function useInventoryVisibility(options?: { destinationSlug?: string; userRole?: string }) {
  const service = InventoryVisibilityService.getInstance();
  const [version, setVersion] = useState(() => service.getVersion());

  useEffect(() => {
    return service.subscribe(() => {
      setVersion(service.getVersion());
    });
  }, [service]);

  const visibleDestinations = useMemo(() => {
    return service.getVisibleDestinations(options?.userRole);
  }, [service, version, options?.userRole]);

  const liveDestinations = useMemo(() => {
    return service.getLiveDestinations(options?.userRole);
  }, [service, version, options?.userRole]);

  const comingSoonDestinations = useMemo(() => {
    return service.getComingSoonDestinations(options?.userRole);
  }, [service, version, options?.userRole]);

  const visibleHubs = useMemo(() => {
    return service.getVisibleHubs(options?.destinationSlug, options?.userRole);
  }, [service, version, options?.destinationSlug, options?.userRole]);

  return {
    version,
    visibleDestinations,
    liveDestinations,
    comingSoonDestinations,
    visibleHubs,
    getDestinationStatus: (dest: Destination) => service.getDestinationComputedStatus(dest),
    getHubStatus: (hub: CityHub, parent?: Destination) => service.getHubComputedStatus(hub, parent),
    getDestinationInventoryCounts: (destIdOrSlug: string) => service.getDestinationInventoryCounts(destIdOrSlug),
    getHubInventoryCounts: (hubId: string) => service.getHubInventoryCounts(hubId),
    notifyInventoryChanged: () => service.notifyInventoryChanged()
  };
}
