/**
 * Authoritative Centralised Destination Visibility & B2B Access Control Engine
 *
 * Isomorphic single source of truth used by both Frontend (React/Vite services,
 * contexts, catalogs, configurators, quote builder) and Backend (Express `/api/b2b/*`).
 *
 * MANDATORY BUSINESS RULE:
 * - A destination is visible and accessible in the B2B Agent Portal ONLY when its
 *   authoritative status is strictly `ACTIVE` (case-insensitive).
 * - Any non-active status (`INACTIVE`, `COMING_SOON`, `DRAFT`, `ARCHIVED`, `DISABLED`,
 *   `DELETED`, `UNPUBLISHED`, missing, null, or unrecognized) MUST be completely
 *   excluded from the B2B Agent Portal.
 * - `COMING_SOON` MUST behave identically to `INACTIVE` in B2B Portal.
 * - Unresolvable / orphan items fail closed unless explicitly flagged as active global services
 *   while at least one active destination exists in the portal.
 */

export interface DestinationLike {
  id: string;
  slug?: string;
  name?: string;
  country?: string;
  code?: string;
  legacyId?: string;
  regionId?: string;
  region?: string;
  status?: string | null;
  visibilityStatus?: string | null;
  isActive?: boolean;
  isDeleted?: boolean;
  deleted?: boolean;
  isPublished?: boolean;
}

export interface CityHubLike {
  id: string;
  slug?: string;
  name?: string;
  legacyId?: string;
  destinationId?: string;
  destinationName?: string;
  regionId?: string;
  regionName?: string;
  status?: string | null;
  isActive?: boolean;
  isDeleted?: boolean;
  deleted?: boolean;
}

export interface DestinationVisibilityIndex {
  allDestinationsById: Map<string, DestinationLike>;
  activeDestinations: DestinationLike[];
  activeDestinationIds: Set<string>;
  nonActiveDestinationIds: Set<string>;
  keyToDestinationId: Map<string, string>;
  hubByKey: Map<string, CityHubLike>;
  hasAnyActiveDestination: boolean;
}

const KNOWN_ALIAS_GROUPS: string[][] = [
  ['dest-japan', 'dst-jpn', 'jp', 'jpn', 'japan'],
  ['dest-uk', 'dst-uk', 'uk', 'gb', 'gbr', 'united kingdom', 'great britain', 'britain', 'england', 'scotland'],
  ['dest-europe', 'dst-eur', 'eur', 'eu', 'europe', 'schengen', 'france', 'italy', 'switzerland', 'spain', 'netherlands'],
  ['dest-dubai', 'dest-uae', 'dst-uae', 'uae', 'dubai', 'abu dhabi', 'dubai & uae', 'united arab emirates'],
  ['dest-thailand', 'dst-tha', 'thailand', 'bangkok', 'phuket'],
  ['dest-singapore', 'dst-sgp', 'singapore'],
  ['dest-bali', 'dest-indonesia', 'dst-idn', 'bali', 'indonesia'],
  ['dest-vietnam', 'dst-vnm', 'vietnam', 'hanoi', 'ho chi minh'],
  ['dest-maldives', 'dst-mdv', 'maldives'],
  ['dest-south-korea', 'dest-korea', 'dst-kor', 'south korea', 'korea', 'seoul'],
];

const NON_ACTIVE_ENTITY_STATUSES = new Set([
  'INACTIVE',
  'COMING_SOON',
  'DRAFT',
  'ARCHIVED',
  'DISABLED',
  'DELETED',
  'UNPUBLISHED',
  'HIDDEN',
  'SUSPENDED',
]);

function normalizeKey(value: unknown): string {
  if (typeof value !== 'string') return '';
  return value.trim().toLowerCase();
}

export function normalizeDestinationStatus(
  statusOrDest?: string | null | Pick<DestinationLike, 'status' | 'visibilityStatus'>
): string {
  if (!statusOrDest) return '';
  if (typeof statusOrDest === 'string') {
    return statusOrDest.trim().toUpperCase();
  }
  const primary = typeof statusOrDest.status === 'string' ? statusOrDest.status.trim().toUpperCase() : '';
  if (primary) return primary;
  const legacy = typeof statusOrDest.visibilityStatus === 'string' ? statusOrDest.visibilityStatus.trim().toUpperCase() : '';
  return legacy;
}

/**
 * Strict destination status check: returns true ONLY if normalized status === 'ACTIVE'.
 */
export function isDestinationStatusActive(status?: string | null): boolean {
  if (typeof status !== 'string') return false;
  return status.trim().toUpperCase() === 'ACTIVE';
}

/**
 * Checks whether a Destination record is strictly Active for the B2B Agent Portal.
 * Fails closed on missing status, non-ACTIVE status (including COMING_SOON, DRAFT, INACTIVE, ARCHIVED, DISABLED),
 * tombstones, or deleted flags.
 */
export function isDestinationActive(
  dest?: DestinationLike | null,
  deletedIds?: Set<string>
): boolean {
  if (!dest || !dest.id) return false;
  if (dest.isDeleted === true || dest.deleted === true) return false;

  if (deletedIds) {
    if (
      deletedIds.has(dest.id) ||
      (dest.slug && deletedIds.has(dest.slug)) ||
      deletedIds.has(`Destination_${dest.id}`)
    ) {
      return false;
    }
  }

  const normalizedStatus = typeof dest.status === 'string' ? dest.status.trim().toUpperCase() : '';
  if (!isDestinationStatusActive(normalizedStatus)) {
    return false;
  }

  // If visibilityStatus or isActive explicitly contradicts active status, guard safely
  // Note: when CMS updates status -> ACTIVE, db.saveDestination keeps isActive & visibilityStatus synced.
  if (dest.isActive === false) {
    return false;
  }
  const vis = typeof dest.visibilityStatus === 'string' ? dest.visibilityStatus.trim().toUpperCase() : '';
  if (vis && vis !== 'ACTIVE' && vis !== 'LIVE') {
    return false;
  }

  return true;
}

function registerAliasKeys(
  map: Map<string, string>,
  destId: string,
  keys: Array<unknown>,
  includeCountryAliases: boolean = true
): void {
  const candidates = new Set<string>();
  for (const k of keys) {
    const norm = normalizeKey(k);
    if (norm) candidates.add(norm);
  }

  if (includeCountryAliases) {
    for (const group of KNOWN_ALIAS_GROUPS) {
      if (group.some(alias => candidates.has(alias))) {
        group.forEach(alias => candidates.add(alias));
      }
    }
  }

  candidates.forEach(candidate => {
    if (!map.has(candidate)) {
      map.set(candidate, destId);
    }
  });
}

/**
 * Builds an authoritative lookup index mapping destination IDs, slugs, names,
 * countries, legacy IDs, canonical aliases, and city hubs to destination IDs.
 */
export function buildDestinationVisibilityIndex(
  destinations: DestinationLike[] = [],
  cityHubs: CityHubLike[] = [],
  deletedIds?: Set<string>
): DestinationVisibilityIndex {
  const allDestinationsById = new Map<string, DestinationLike>();
  const activeDestinations: DestinationLike[] = [];
  const activeDestinationIds = new Set<string>();
  const nonActiveDestinationIds = new Set<string>();
  const keyToDestinationId = new Map<string, string>();
  const hubByKey = new Map<string, CityHubLike>();

  for (const dest of destinations) {
    if (!dest || !dest.id) continue;
    if (dest.slug === 'all') continue;

    allDestinationsById.set(dest.id, dest);
    const active = isDestinationActive(dest, deletedIds);
    if (active) {
      activeDestinations.push(dest);
      activeDestinationIds.add(dest.id);
    } else {
      nonActiveDestinationIds.add(dest.id);
    }

    registerAliasKeys(keyToDestinationId, dest.id, [
      dest.id,
      dest.slug,
      dest.name,
      dest.country,
      dest.code,
      dest.legacyId,
    ]);
  }

  for (const hub of cityHubs) {
    if (!hub || !hub.id) continue;
    const keys = [hub.id, hub.slug, hub.name, hub.legacyId]
      .map(normalizeKey)
      .filter(Boolean);
    keys.forEach(k => {
      if (!hubByKey.has(k)) {
        hubByKey.set(k, hub);
      }
    });
  }

  return {
    allDestinationsById,
    activeDestinations,
    activeDestinationIds,
    nonActiveDestinationIds,
    keyToDestinationId,
    hubByKey,
    hasAnyActiveDestination: activeDestinations.length > 0,
  };
}

/**
 * Resolves an arbitrary destination token (id, slug, name, country, alias)
 * to a canonical destination ID in the index.
 */
export function resolveDestinationIdToken(
  token: unknown,
  index: DestinationVisibilityIndex
): string | undefined {
  const norm = normalizeKey(token);
  if (!norm) return undefined;

  const direct = index.keyToDestinationId.get(norm);
  if (direct) return direct;

  // Handle composite/prefixed labels like "Kyoto, Japan" or "Japan - Tokyo"
  for (const [key, destId] of index.keyToDestinationId.entries()) {
    if (key.length >= 3 && (norm === key || norm.includes(key))) {
      // Avoid accidental substring false positives on short words unless delimited
      const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const boundary = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
      if (boundary.test(norm)) {
        return destId;
      }
    }
  }

  // Fallback to known alias groups even if destination ID uses custom prefix
  for (const group of KNOWN_ALIAS_GROUPS) {
    if (group.includes(norm)) {
      for (const alias of group) {
        const mapped = index.keyToDestinationId.get(alias);
        if (mapped) return mapped;
      }
    }
  }

  return undefined;
}

export function resolveHubParentDestinationId(
  hubOrKey: CityHubLike | string | undefined,
  index: DestinationVisibilityIndex
): string | undefined {
  if (!hubOrKey) return undefined;

  let hub: CityHubLike | undefined;
  if (typeof hubOrKey === 'string') {
    const key = normalizeKey(hubOrKey);
    if (!key) return undefined;
    hub = index.hubByKey.get(key);
    if (!hub) {
      // Sometimes a hub token actually contains destination name (e.g. "Tokyo")
      for (const h of index.hubByKey.values()) {
        if (normalizeKey(h.name) === key || normalizeKey(h.id) === key || normalizeKey(h.slug) === key) {
          hub = h;
          break;
        }
      }
    }
  } else {
    hub = hubOrKey;
  }

  if (!hub) return undefined;
  return (
    resolveDestinationIdToken(hub.destinationId, index) ||
    resolveDestinationIdToken(hub.destinationName, index)
  );
}

function isOwnEntityStatusNonActive(entity: any): boolean {
  if (!entity || typeof entity !== 'object') return true;
  if (entity.isDeleted === true || entity.deleted === true) return true;
  if (entity.isActive === false) return true;

  const st = typeof entity.status === 'string' ? entity.status.trim().toUpperCase() : '';
  if (st && NON_ACTIVE_ENTITY_STATUSES.has(st)) {
    return true;
  }
  const vis = typeof entity.visibilityStatus === 'string' ? entity.visibilityStatus.trim().toUpperCase() : '';
  if (vis && NON_ACTIVE_ENTITY_STATUSES.has(vis)) {
    return true;
  }
  return false;
}

function isTombstoned(id?: string, slug?: string, deletedIds?: Set<string>): boolean {
  if (!deletedIds) return false;
  if (id && deletedIds.has(id)) return true;
  if (slug && deletedIds.has(slug)) return true;
  return false;
}

/**
 * Checks whether a City Hub is active AND its parent destination is strictly ACTIVE.
 */
export function isCityHubActiveForB2B(
  hub: CityHubLike | null | undefined,
  index: DestinationVisibilityIndex,
  deletedIds?: Set<string>
): boolean {
  if (!hub || !hub.id) return false;
  if (isTombstoned(hub.id, hub.slug, deletedIds)) return false;
  if (isOwnEntityStatusNonActive(hub)) return false;

  const st = typeof hub.status === 'string' ? hub.status.trim().toUpperCase() : '';
  if (st && st !== 'ACTIVE' && st !== 'LIVE' && st !== 'PUBLISHED') {
    return false;
  }

  const parentDestId = resolveHubParentDestinationId(hub, index);
  if (!parentDestId) return false;
  return index.activeDestinationIds.has(parentDestId);
}

/**
 * Checks whether a Region (DestinationRegionItem or MasterRegion) has an ACTIVE destination.
 */
export function isRegionActiveForB2B(
  region: any,
  index: DestinationVisibilityIndex,
  deletedIds?: Set<string>
): boolean {
  if (!region || !region.id) return false;
  if (isTombstoned(region.id, region.slug, deletedIds)) return false;
  if (isOwnEntityStatusNonActive(region)) return false;

  // DestinationRegionItem (child of a single Destination)
  if (region.destinationId || region.destinationName) {
    const parentDestId =
      resolveDestinationIdToken(region.destinationId, index) ||
      resolveDestinationIdToken(region.destinationName, index);
    if (!parentDestId) return false;
    return index.activeDestinationIds.has(parentDestId);
  }

  // MasterRegion: visible in B2B only if at least one ACTIVE destination belongs to it
  const regKeys = new Set(
    [region.id, region.code, region.slug, region.name, region.legacyId]
      .map(normalizeKey)
      .filter(Boolean)
  );
  return index.activeDestinations.some(dest => {
    const destRegKeys = [dest.regionId, dest.region].map(normalizeKey).filter(Boolean);
    return destRegKeys.some(k => regKeys.has(k));
  });
}

function isRailLikeProduct(product: any): boolean {
  if (!product) return false;
  const cat = normalizeKey(product.category || product.productType || product.serviceType || '');
  const id = normalizeKey(product.id || '');
  const sku = normalizeKey(product.sku || '');
  const name = normalizeKey(product.name || product.title || '');
  return (
    product.isRail === true ||
    cat.includes('rail') ||
    cat.includes('shinkansen') ||
    id.startsWith('rail-jp-') ||
    sku.startsWith('rail-jp-') ||
    name.includes('shinkansen') ||
    name.includes('jr pass')
  );
}

/**
 * Checks whether a Product (tour, activity, transfer, ticket, guide, yacht, ferry, rail, restaurant)
 * is active AND mapped exclusively to ACTIVE destination(s) for the B2B Agent Portal.
 */
export function isProductActiveForB2B(
  product: any,
  index: DestinationVisibilityIndex,
  deletedIds?: Set<string>
): boolean {
  if (!product || !product.id) return false;
  if (isTombstoned(product.id, product.slug, deletedIds)) return false;
  if (isOwnEntityStatusNonActive(product)) return false;

  const st = typeof product.status === 'string' ? product.status.trim().toUpperCase() : '';
  if (st && st !== 'ACTIVE' && st !== 'PUBLISHED' && st !== 'LIVE') {
    return false;
  }

  // Japan Rail guard: Shinkansen / JR products belong to Japan
  if (isRailLikeProduct(product)) {
    const japanId = resolveDestinationIdToken('japan', index) || resolveDestinationIdToken('dest-japan', index);
    if (!japanId || !index.activeDestinationIds.has(japanId)) {
      return false;
    }
  }

  const resolvedDestIds = new Set<string>();
  let hasExplicitUnresolvedRef = false;

  const directTokens = [
    product.destinationId,
    product.destination,
    product.destinationName,
    product.destinationSlug,
    product.country,
  ];
  for (const token of directTokens) {
    const norm = normalizeKey(token);
    if (!norm) continue;
    const resolved = resolveDestinationIdToken(norm, index);
    if (resolved) {
      resolvedDestIds.add(resolved);
    } else if (token === product.destinationId && norm.startsWith('dest-')) {
      hasExplicitUnresolvedRef = true;
    }
  }

  if (Array.isArray(product.destinationIds)) {
    for (const dId of product.destinationIds) {
      if (!dId) continue;
      const resolved = resolveDestinationIdToken(dId, index);
      if (resolved) resolvedDestIds.add(resolved);
      else hasExplicitUnresolvedRef = true;
    }
  }

  const hubTokens = [
    product.hubId,
    product.cityHubId,
    product.cityId,
    product.city,
    product.fromHubId,
    product.toHubId,
    ...(Array.isArray(product.hubIds) ? product.hubIds : []),
  ];
  for (const hToken of hubTokens) {
    if (!hToken) continue;
    const parentDest = resolveHubParentDestinationId(String(hToken), index);
    if (parentDest) resolvedDestIds.add(parentDest);
  }

  if (hasExplicitUnresolvedRef || resolvedDestIds.size === 0) {
    return false;
  }

  for (const destId of resolvedDestIds) {
    if (!index.activeDestinationIds.has(destId)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether a Hotel / Ryokan is active AND mapped to an ACTIVE destination.
 */
export function isHotelActiveForB2B(
  hotel: any,
  index: DestinationVisibilityIndex,
  deletedIds?: Set<string>
): boolean {
  if (!hotel || !hotel.id) return false;
  if (isTombstoned(hotel.id, hotel.slug, deletedIds)) return false;
  if (isOwnEntityStatusNonActive(hotel)) return false;

  const st = typeof hotel.status === 'string' ? hotel.status.trim().toUpperCase() : '';
  if (st && st !== 'ACTIVE' && st !== 'PUBLISHED' && st !== 'LIVE') {
    return false;
  }

  const resolvedDestIds = new Set<string>();
  const directTokens = [
    hotel.destinationId,
    hotel.destination,
    hotel.destinationName,
    hotel.country,
  ];
  for (const token of directTokens) {
    const resolved = resolveDestinationIdToken(token, index);
    if (resolved) resolvedDestIds.add(resolved);
  }

  const hubTokens = [hotel.hubId, hotel.cityHubId, hotel.cityId, hotel.city];
  for (const hToken of hubTokens) {
    const parentDest = resolveHubParentDestinationId(hToken, index);
    if (parentDest) resolvedDestIds.add(parentDest);
  }

  if (resolvedDestIds.size === 0) {
    return false;
  }

  for (const destId of resolvedDestIds) {
    if (!index.activeDestinationIds.has(destId)) {
      return false;
    }
  }

  return true;
}

/**
 * Checks whether a Transfer Route is active AND its destination & hubs are ACTIVE.
 */
export function isTransferRouteActiveForB2B(
  route: any,
  index: DestinationVisibilityIndex,
  deletedIds?: Set<string>
): boolean {
  if (!route || !route.id) return false;
  if (isTombstoned(route.id, route.slug, deletedIds)) return false;
  if (isOwnEntityStatusNonActive(route)) return false;

  const st = typeof route.status === 'string' ? route.status.trim().toUpperCase() : '';
  if (st && st !== 'ACTIVE' && st !== 'PUBLISHED' && st !== 'LIVE') {
    return false;
  }

  const resolvedDestIds = new Set<string>();
  const directDest =
    resolveDestinationIdToken(route.destinationId, index) ||
    resolveDestinationIdToken(route.destinationName, index) ||
    resolveDestinationIdToken(route.country, index);
  if (directDest) resolvedDestIds.add(directDest);

  const fromDest = resolveHubParentDestinationId(route.fromHubId || route.fromHub, index);
  if (fromDest) resolvedDestIds.add(fromDest);

  const toDest = resolveHubParentDestinationId(route.toHubId || route.toHub, index);
  if (toDest) resolvedDestIds.add(toDest);

  if (resolvedDestIds.size === 0) return false;
  for (const destId of resolvedDestIds) {
    if (!index.activeDestinationIds.has(destId)) {
      return false;
    }
  }
  return true;
}

/**
 * Checks whether a Visa product or Destination Ancillary service (Travel Protection,
 * VIP Ground, Connectivity/eSIM, etc.) is active AND mapped to ACTIVE destination(s).
 */
export function isVisaOrAncillaryActiveForB2B(
  item: any,
  index: DestinationVisibilityIndex,
  deletedIds?: Set<string>
): boolean {
  if (!item || !item.id) return false;
  if (isTombstoned(item.id, item.slug, deletedIds)) return false;
  if (isOwnEntityStatusNonActive(item)) return false;

  const st = typeof item.status === 'string' ? item.status.trim().toUpperCase() : '';
  if (st && st !== 'ACTIVE' && st !== 'PUBLISHED' && st !== 'LIVE') {
    return false;
  }

  const resolvedDestIds = new Set<string>();
  let hadSpecificUnresolvedDest = false;

  const tokens = [
    item.destinationId,
    item.destination,
    item.destinationName,
    item.country,
    item.coverageZone,
    item.coverageArea,
  ];

  let isExplicitlyGlobal = false;
  for (const tok of tokens) {
    const norm = normalizeKey(tok);
    if (!norm) continue;
    if (norm === 'global' || norm === 'worldwide' || norm === 'all' || norm === 'all destinations' || norm === 'international') {
      isExplicitlyGlobal = true;
      continue;
    }
    const resolved = resolveDestinationIdToken(norm, index);
    if (resolved) {
      resolvedDestIds.add(resolved);
    } else if (tok === item.destinationId || tok === item.country) {
      // Specific country or destinationId that did not resolve to any active destination
      hadSpecificUnresolvedDest = true;
    }
  }

  const multiDestLists = [
    ...(Array.isArray(item.applicableDestinationIds) ? item.applicableDestinationIds : []),
    ...(Array.isArray(item.applicableDestinations) ? item.applicableDestinations : []),
    ...(Array.isArray(item.destinationIds) ? item.destinationIds : []),
  ];

  for (const dToken of multiDestLists) {
    const norm = normalizeKey(dToken);
    if (!norm) continue;
    if (norm === 'global' || norm === 'worldwide' || norm === 'all') {
      isExplicitlyGlobal = true;
      continue;
    }
    const resolved = resolveDestinationIdToken(norm, index);
    if (resolved) {
      resolvedDestIds.add(resolved);
    } else {
      hadSpecificUnresolvedDest = true;
    }
  }

  if (resolvedDestIds.size > 0) {
    // If multi-destination visa/ancillary (e.g. coverage across active + inactive), require ALL mapped known destinations to be active OR check strict rule:
    // For safety & prompt compliance: no non-active destination inventory may be exposed
    for (const destId of resolvedDestIds) {
      if (!index.activeDestinationIds.has(destId)) {
        return false;
      }
    }
    if (hadSpecificUnresolvedDest) {
      // Fail closed if explicit destinationId/country is unresolved alongside others
      return false;
    }
    return true;
  }

  // If no destination resolved, only allow if explicitly Global AND at least 1 active destination exists
  if (isExplicitlyGlobal && !hadSpecificUnresolvedDest && index.hasAnyActiveDestination) {
    return true;
  }

  return false;
}

/**
 * Checks whether a Ready-Made B2B Package is visible to B2B Agents:
 * - Package itself must be PUBLISHED and not deleted/hidden
 * - Primary destination AND every multi-destination/hub referenced in routeHubs,
 *   orderedHubs, hubIds, or itinerary must resolve to ACTIVE destinations.
 */
export function isPackageActiveForB2B(
  pkg: any,
  index: DestinationVisibilityIndex,
  deletedIds?: Set<string>
): boolean {
  if (!pkg || !pkg.id) return false;
  if (isTombstoned(pkg.id, pkg.slug, deletedIds)) return false;
  if (isOwnEntityStatusNonActive(pkg)) return false;

  const st = typeof pkg.status === 'string' ? pkg.status.trim().toUpperCase() : '';
  if (st !== 'PUBLISHED' && st !== 'ACTIVE' && st !== 'LIVE') {
    return false;
  }

  const resolvedDestIds = new Set<string>();
  let hasExplicitUnresolvedDest = false;

  const directTokens = [
    pkg.destinationId,
    pkg.destinationName,
    pkg.destination,
    pkg.country,
  ];
  for (const tok of directTokens) {
    const norm = normalizeKey(tok);
    if (!norm) continue;
    const resolved = resolveDestinationIdToken(norm, index);
    if (resolved) {
      resolvedDestIds.add(resolved);
    } else if (tok === pkg.destinationId && norm.startsWith('dest-')) {
      hasExplicitUnresolvedDest = true;
    }
  }

  const multiDestLists = [
    ...(Array.isArray(pkg.destinationIds) ? pkg.destinationIds : []),
    ...(Array.isArray(pkg.applicableDestinationIds) ? pkg.applicableDestinationIds : []),
  ];
  for (const tok of multiDestLists) {
    if (!tok) continue;
    const resolved = resolveDestinationIdToken(tok, index);
    if (resolved) resolvedDestIds.add(resolved);
    else hasExplicitUnresolvedDest = true;
  }

  const hubTokens: any[] = [
    ...(Array.isArray(pkg.hubIds) ? pkg.hubIds : []),
    ...(Array.isArray(pkg.routeHubs) ? pkg.routeHubs : []),
    ...(Array.isArray(pkg.orderedHubs) ? pkg.orderedHubs : []),
    ...(Array.isArray(pkg.cityHubIds) ? pkg.cityHubIds : []),
  ];

  if (Array.isArray(pkg.itinerary)) {
    for (const day of pkg.itinerary) {
      if (!day) continue;
      if (day.destinationId) {
        const resolved = resolveDestinationIdToken(day.destinationId, index);
        if (resolved) resolvedDestIds.add(resolved);
        else hasExplicitUnresolvedDest = true;
      }
      if (day.hubId) hubTokens.push(day.hubId);
      if (day.cityHubId) hubTokens.push(day.cityHubId);
      if (day.cityHubName) hubTokens.push(day.cityHubName);
      if (day.city) hubTokens.push(day.city);
    }
  }

  for (const h of hubTokens) {
    if (!h) continue;
    if (typeof h === 'object') {
      if (h.destinationId) {
        const resolved = resolveDestinationIdToken(h.destinationId, index);
        if (resolved) resolvedDestIds.add(resolved);
        else hasExplicitUnresolvedDest = true;
      }
      const key = h.hubId || h.id || h.slug || h.cityHubName || h.name;
      const parentDest = resolveHubParentDestinationId(String(key || ''), index);
      if (parentDest) resolvedDestIds.add(parentDest);
    } else {
      const parentDest = resolveHubParentDestinationId(String(h), index);
      if (parentDest) resolvedDestIds.add(parentDest);
    }
  }

  if (hasExplicitUnresolvedDest || resolvedDestIds.size === 0) {
    return false;
  }

  for (const destId of resolvedDestIds) {
    if (!index.activeDestinationIds.has(destId)) {
      return false;
    }
  }

  return true;
}

/**
 * Ensures pagination counts (totalCount, totalPages) and slices are calculated
 * strictly AFTER eligibility filtering, preventing leaked counts or partial pages.
 */
export interface PaginatedVisibilityResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasMore: boolean;
}

export function paginateAfterEligibility<T>(
  rawItems: T[],
  isEligible: (item: T) => boolean,
  page: number = 1,
  pageSize: number = 24
): PaginatedVisibilityResult<T> {
  const eligible = (rawItems || []).filter(isEligible);
  const totalCount = eligible.length;
  const safePageSize = Math.max(1, Math.floor(pageSize || 24));
  const totalPages = Math.max(1, Math.ceil(totalCount / safePageSize));
  const safePage = Math.min(Math.max(1, Math.floor(page || 1)), totalPages);
  const offset = (safePage - 1) * safePageSize;

  return {
    items: eligible.slice(offset, offset + safePageSize),
    totalCount,
    page: safePage,
    pageSize: safePageSize,
    totalPages,
    hasMore: safePage < totalPages,
  };
}

/**
 * Analyzes an existing saved/draft quotation against current destination statuses
 * WITHOUT modifying, deleting, or repricing historical records.
 * Used to flag draft quotations for review if a destination became non-active.
 */
export interface QuotationDestinationReviewResult {
  requiresReview: boolean;
  isFinalizedHistorical: boolean;
  affectedDestinations: Array<{ id: string; name: string; status: string }>;
  affectedItemIds: string[];
  affectedRouteHubIds: string[];
  summaryMessage: string;
}

const FINALIZED_QUOTE_STATUSES = new Set([
  'APPROVED',
  'ACCEPTED',
  'CONVERTED',
  'CONFIRMED',
  'BOOKING_SUBMITTED',
  'SENT',
  'SENT_TO_CLIENT',
  'LOCKED',
]);

export function analyzeQuotationDestinationEligibility(
  quote: {
    status?: string;
    destination?: string;
    destinationId?: string;
    routeHubs?: Array<any>;
    items?: Array<any>;
  } | null | undefined,
  index: DestinationVisibilityIndex
): QuotationDestinationReviewResult {
  if (!quote) {
    return {
      requiresReview: false,
      isFinalizedHistorical: false,
      affectedDestinations: [],
      affectedItemIds: [],
      affectedRouteHubIds: [],
      summaryMessage: '',
    };
  }

  const qStatus = typeof quote.status === 'string' ? quote.status.trim().toUpperCase() : 'DRAFT';
  const isFinalizedHistorical = FINALIZED_QUOTE_STATUSES.has(qStatus);

  const affectedDestMap = new Map<string, { id: string; name: string; status: string }>();
  const affectedItemIds: string[] = [];
  const affectedRouteHubIds: string[] = [];

  const checkDestToken = (tok: unknown): string | undefined => {
    const destId = resolveDestinationIdToken(tok, index);
    if (destId && !index.activeDestinationIds.has(destId)) {
      const dest = index.allDestinationsById.get(destId);
      affectedDestMap.set(destId, {
        id: destId,
        name: dest?.name || String(tok || destId),
        status: normalizeDestinationStatus(dest) || 'INACTIVE',
      });
      return destId;
    }
    return undefined;
  };

  checkDestToken(quote.destinationId);
  checkDestToken(quote.destination);

  if (Array.isArray(quote.routeHubs)) {
    for (const rh of quote.routeHubs) {
      if (!rh) continue;
      const dId =
        resolveDestinationIdToken(rh.destinationId, index) ||
        resolveHubParentDestinationId(rh.hubId || rh.id || rh.cityHubName, index);
      if (dId && !index.activeDestinationIds.has(dId)) {
        const dest = index.allDestinationsById.get(dId);
        affectedDestMap.set(dId, {
          id: dId,
          name: dest?.name || dId,
          status: normalizeDestinationStatus(dest) || 'INACTIVE',
        });
        if (rh.hubId || rh.id) {
          affectedRouteHubIds.push(String(rh.hubId || rh.id));
        }
      }
    }
  }

  if (Array.isArray(quote.items)) {
    for (const item of quote.items) {
      if (!item) continue;
      const prod = item.product || item;
      const dId =
        resolveDestinationIdToken(prod.destinationId, index) ||
        resolveDestinationIdToken(prod.destinationName, index) ||
        resolveDestinationIdToken(prod.destination, index) ||
        resolveDestinationIdToken(prod.country, index) ||
        resolveHubParentDestinationId(prod.hubId || prod.city, index);

      if (dId && !index.activeDestinationIds.has(dId)) {
        const dest = index.allDestinationsById.get(dId);
        affectedDestMap.set(dId, {
          id: dId,
          name: dest?.name || prod.destinationName || prod.country || dId,
          status: normalizeDestinationStatus(dest) || 'INACTIVE',
        });
        if (item.id || prod.id) {
          affectedItemIds.push(String(item.id || prod.id));
        }
      }
    }
  }

  const affectedDestinations = Array.from(affectedDestMap.values());
  const requiresReview = affectedDestinations.length > 0 || affectedItemIds.length > 0;
  const names = affectedDestinations.map(d => `${d.name} (${d.status})`).join(', ');

  const summaryMessage = requiresReview
    ? isFinalizedHistorical
      ? `Historical record preserved: Destination ${names} is currently non-active for new quotes.`
      : `Destination Inactive — Review Required: ${names}. Existing line items remain preserved, but new items from non-active destinations cannot be added.`
    : '';

  return {
    requiresReview,
    isFinalizedHistorical,
    affectedDestinations,
    affectedItemIds,
    affectedRouteHubIds,
    summaryMessage,
  };
}
