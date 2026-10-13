import { MasterRegion, Destination, CityHub, Product, CurrencyCode } from '../types';
import { AppDatabase } from './db';

export interface HierarchyValidationResult {
  valid: boolean;
  error?: string;
  code?: 'INVALID_REGION' | 'INVALID_DESTINATION' | 'INVALID_HUB' | 'DESTINATION_REGION_MISMATCH' | 'HUB_DESTINATION_MISMATCH' | 'MISSING_REQUIRED_FIELDS';
  region?: MasterRegion;
  destination?: Destination;
  hub?: CityHub;
}

export interface LegacyMasterMapping {
  legacyIdOrCode: string;
  canonicalId: string;
  type: 'REGION' | 'DESTINATION' | 'HUB';
  description: string;
}

/**
 * Authoritative explicit mapping lookup table for legacy / old system codes.
 * Conforms to Section 30: Explicit, verified mapping table — never infer relationships from text similarity.
 */
export const CANONICAL_LEGACY_MAPPINGS: Record<string, LegacyMasterMapping> = {
  // Region Legacy Codes
  'reg-east-asia': { legacyIdOrCode: 'reg-east-asia', canonicalId: 'REG-001', type: 'REGION', description: 'Legacy East Asia slug to Canonical REG-001' },
  'reg-001': { legacyIdOrCode: 'reg-001', canonicalId: 'REG-001', type: 'REGION', description: 'Lowercase REG-001' },
  'reg_001': { legacyIdOrCode: 'reg_001', canonicalId: 'REG-001', type: 'REGION', description: 'Underscore REG_001' },
  'asia': { legacyIdOrCode: 'asia', canonicalId: 'REG-001', type: 'REGION', description: 'Generic Asia identifier to Canonical East Asia REG-001' },
  'reg-asia': { legacyIdOrCode: 'reg-asia', canonicalId: 'REG-001', type: 'REGION', description: 'Legacy reg-asia to Canonical REG-001' },
  'reg-western-europe': { legacyIdOrCode: 'reg-western-europe', canonicalId: 'REG-002', type: 'REGION', description: 'Legacy Western Europe to Canonical REG-002' },
  'reg-002': { legacyIdOrCode: 'reg-002', canonicalId: 'REG-002', type: 'REGION', description: 'Lowercase REG-002' },
  'reg-middle-east': { legacyIdOrCode: 'reg-middle-east', canonicalId: 'REG-003', type: 'REGION', description: 'Legacy Middle East to Canonical REG-003' },
  'reg-003': { legacyIdOrCode: 'reg-003', canonicalId: 'REG-003', type: 'REGION', description: 'Lowercase REG-003' },
  'reg-southeast-asia': { legacyIdOrCode: 'reg-southeast-asia', canonicalId: 'REG-004', type: 'REGION', description: 'Legacy Southeast Asia to Canonical REG-004' },
  'reg-004': { legacyIdOrCode: 'reg-004', canonicalId: 'REG-004', type: 'REGION', description: 'Lowercase REG-004' },
  'reg-southern-europe': { legacyIdOrCode: 'reg-southern-europe', canonicalId: 'REG-005', type: 'REGION', description: 'Southern Europe to REG-005' },
  'reg-005': { legacyIdOrCode: 'reg-005', canonicalId: 'REG-005', type: 'REGION', description: 'Lowercase REG-005' },
  'reg-scandinavia': { legacyIdOrCode: 'reg-scandinavia', canonicalId: 'REG-006', type: 'REGION', description: 'Scandinavia to REG-006' },
  'reg-006': { legacyIdOrCode: 'reg-006', canonicalId: 'REG-006', type: 'REGION', description: 'Lowercase REG-006' },
  'reg-north-america': { legacyIdOrCode: 'reg-north-america', canonicalId: 'REG-007', type: 'REGION', description: 'North America to REG-007' },
  'reg-007': { legacyIdOrCode: 'reg-007', canonicalId: 'REG-007', type: 'REGION', description: 'Lowercase REG-007' },
  'reg-south-asia': { legacyIdOrCode: 'reg-south-asia', canonicalId: 'REG-008', type: 'REGION', description: 'South Asia to REG-008' },
  'reg-008': { legacyIdOrCode: 'reg-008', canonicalId: 'REG-008', type: 'REGION', description: 'Lowercase REG-008' },

  // Destination Legacy Codes
  'dest-japan': { legacyIdOrCode: 'dest-japan', canonicalId: 'DST-JPN', type: 'DESTINATION', description: 'Legacy dest-japan to Canonical DST-JPN' },
  'japan': { legacyIdOrCode: 'japan', canonicalId: 'DST-JPN', type: 'DESTINATION', description: 'Slug japan to Canonical DST-JPN' },
  'dst-jpn': { legacyIdOrCode: 'dst-jpn', canonicalId: 'DST-JPN', type: 'DESTINATION', description: 'Lowercase DST-JPN' },
  'dest-uk': { legacyIdOrCode: 'dest-uk', canonicalId: 'DST-UK', type: 'DESTINATION', description: 'Legacy dest-uk to Canonical DST-UK' },
  'united-kingdom': { legacyIdOrCode: 'united-kingdom', canonicalId: 'DST-UK', type: 'DESTINATION', description: 'Slug united-kingdom to Canonical DST-UK' },
  'uk': { legacyIdOrCode: 'uk', canonicalId: 'DST-UK', type: 'DESTINATION', description: 'Code uk to Canonical DST-UK' },
  'dst-uk': { legacyIdOrCode: 'dst-uk', canonicalId: 'DST-UK', type: 'DESTINATION', description: 'Lowercase DST-UK' },
  'dest-france': { legacyIdOrCode: 'dest-france', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Legacy dest-france to Canonical DST-FRA' },
  'dest-fra': { legacyIdOrCode: 'dest-fra', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Legacy dest-fra to Canonical DST-FRA' },
  'france': { legacyIdOrCode: 'france', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Slug france to Canonical DST-FRA' },
  'dest-europe': { legacyIdOrCode: 'dest-europe', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Europe to Canonical DST-FRA' },
  'europe': { legacyIdOrCode: 'europe', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Europe slug' },
  'dst-fra': { legacyIdOrCode: 'dst-fra', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Lowercase DST-FRA' },
  'dest-uae': { legacyIdOrCode: 'dest-uae', canonicalId: 'DST-UAE', type: 'DESTINATION', description: 'Legacy dest-uae to Canonical DST-UAE' },
  'dest-dubai': { legacyIdOrCode: 'dest-dubai', canonicalId: 'DST-UAE', type: 'DESTINATION', description: 'Legacy dest-dubai to Canonical DST-UAE' },
  'dubai': { legacyIdOrCode: 'dubai', canonicalId: 'DST-UAE', type: 'DESTINATION', description: 'Slug dubai to Canonical DST-UAE' },
  'dst-uae': { legacyIdOrCode: 'dst-uae', canonicalId: 'DST-UAE', type: 'DESTINATION', description: 'Lowercase DST-UAE' },
  'dest-thailand': { legacyIdOrCode: 'dest-thailand', canonicalId: 'DST-THA', type: 'DESTINATION', description: 'Legacy dest-thailand to Canonical DST-THA' },
  'dest-tha': { legacyIdOrCode: 'dest-tha', canonicalId: 'DST-THA', type: 'DESTINATION', description: 'Legacy dest-tha to Canonical DST-THA' },
  'thailand': { legacyIdOrCode: 'thailand', canonicalId: 'DST-THA', type: 'DESTINATION', description: 'Slug thailand to Canonical DST-THA' },
  'dst-tha': { legacyIdOrCode: 'dst-tha', canonicalId: 'DST-THA', type: 'DESTINATION', description: 'Lowercase DST-THA' },
  'dest-malaysia': { legacyIdOrCode: 'dest-malaysia', canonicalId: 'DST-MYS', type: 'DESTINATION', description: 'Malaysia to Canonical DST-MYS' },
  'malaysia': { legacyIdOrCode: 'malaysia', canonicalId: 'DST-MYS', type: 'DESTINATION', description: 'Slug malaysia to Canonical DST-MYS' },
  'dst-mys': { legacyIdOrCode: 'dst-mys', canonicalId: 'DST-MYS', type: 'DESTINATION', description: 'Lowercase DST-MYS' },
  'dest-singapore': { legacyIdOrCode: 'dest-singapore', canonicalId: 'DST-SGP', type: 'DESTINATION', description: 'Singapore to Canonical DST-SGP' },
  'singapore': { legacyIdOrCode: 'singapore', canonicalId: 'DST-SGP', type: 'DESTINATION', description: 'Slug singapore to Canonical DST-SGP' },
  'dst-sgp': { legacyIdOrCode: 'dst-sgp', canonicalId: 'DST-SGP', type: 'DESTINATION', description: 'Lowercase DST-SGP' },
  'dest-indonesia': { legacyIdOrCode: 'dest-indonesia', canonicalId: 'DST-IDN', type: 'DESTINATION', description: 'Indonesia to Canonical DST-IDN' },
  'bali': { legacyIdOrCode: 'bali', canonicalId: 'DST-IDN', type: 'DESTINATION', description: 'Slug bali to Canonical DST-IDN' },
  'bali-indonesia': { legacyIdOrCode: 'bali-indonesia', canonicalId: 'DST-IDN', type: 'DESTINATION', description: 'Slug bali-indonesia' },
  'dst-idn': { legacyIdOrCode: 'dst-idn', canonicalId: 'DST-IDN', type: 'DESTINATION', description: 'Lowercase DST-IDN' },
  'dest-vietnam': { legacyIdOrCode: 'dest-vietnam', canonicalId: 'DST-VNM', type: 'DESTINATION', description: 'Vietnam to Canonical DST-VNM' },
  'vietnam': { legacyIdOrCode: 'vietnam', canonicalId: 'DST-VNM', type: 'DESTINATION', description: 'Slug vietnam to Canonical DST-VNM' },
  'dst-vnm': { legacyIdOrCode: 'dst-vnm', canonicalId: 'DST-VNM', type: 'DESTINATION', description: 'Lowercase DST-VNM' },

  // Hub Legacy Codes
  'hub-tokyo': { legacyIdOrCode: 'hub-tokyo', canonicalId: 'HUB-TYO', type: 'HUB', description: 'Legacy hub-tokyo to Canonical HUB-TYO' },
  'tokyo': { legacyIdOrCode: 'tokyo', canonicalId: 'HUB-TYO', type: 'HUB', description: 'City name to Canonical HUB-TYO' },
  'hub-tyo': { legacyIdOrCode: 'hub-tyo', canonicalId: 'HUB-TYO', type: 'HUB', description: 'Lowercase HUB-TYO' },
  'hub-kyoto': { legacyIdOrCode: 'hub-kyoto', canonicalId: 'HUB-KYO', type: 'HUB', description: 'Legacy hub-kyoto to Canonical HUB-KYO' },
  'kyoto': { legacyIdOrCode: 'kyoto', canonicalId: 'HUB-KYO', type: 'HUB', description: 'City name to Canonical HUB-KYO' },
  'hub-kyo': { legacyIdOrCode: 'hub-kyo', canonicalId: 'HUB-KYO', type: 'HUB', description: 'Lowercase HUB-KYO' },
  'hub-osaka': { legacyIdOrCode: 'hub-osaka', canonicalId: 'HUB-OSA', type: 'HUB', description: 'Legacy hub-osaka to Canonical HUB-OSA' },
  'osaka': { legacyIdOrCode: 'osaka', canonicalId: 'HUB-OSA', type: 'HUB', description: 'City name to Canonical HUB-OSA' },
  'hub-osa': { legacyIdOrCode: 'hub-osa', canonicalId: 'HUB-OSA', type: 'HUB', description: 'Lowercase HUB-OSA' },
  'hub-hakone': { legacyIdOrCode: 'hub-hakone', canonicalId: 'HUB-HAK', type: 'HUB', description: 'Legacy hub-hakone to Canonical HUB-HAK' },
  'hakone': { legacyIdOrCode: 'hakone', canonicalId: 'HUB-HAK', type: 'HUB', description: 'City name to Canonical HUB-HAK' },
  'hub-hak': { legacyIdOrCode: 'hub-hak', canonicalId: 'HUB-HAK', type: 'HUB', description: 'Lowercase HUB-HAK' },
  'hub-hiroshima': { legacyIdOrCode: 'hub-hiroshima', canonicalId: 'HUB-HIRO', type: 'HUB', description: 'Legacy hub-hiroshima to Canonical HUB-HIRO' },
  'hiroshima': { legacyIdOrCode: 'hiroshima', canonicalId: 'HUB-HIRO', type: 'HUB', description: 'City name to Canonical HUB-HIRO' },
  'hub-hiro': { legacyIdOrCode: 'hub-hiro', canonicalId: 'HUB-HIRO', type: 'HUB', description: 'Lowercase HUB-HIRO' },
  'hub-london': { legacyIdOrCode: 'hub-london', canonicalId: 'HUB-LON', type: 'HUB', description: 'Legacy hub-london to Canonical HUB-LON' },
  'london': { legacyIdOrCode: 'london', canonicalId: 'HUB-LON', type: 'HUB', description: 'City name to Canonical HUB-LON' },
  'hub-lon': { legacyIdOrCode: 'hub-lon', canonicalId: 'HUB-LON', type: 'HUB', description: 'Lowercase HUB-LON' },
  'hub-edinburgh': { legacyIdOrCode: 'hub-edinburgh', canonicalId: 'HUB-EDI', type: 'HUB', description: 'Legacy hub-edinburgh to Canonical HUB-EDI' },
  'edinburgh': { legacyIdOrCode: 'edinburgh', canonicalId: 'HUB-EDI', type: 'HUB', description: 'City name to Canonical HUB-EDI' },
  'hub-edi': { legacyIdOrCode: 'hub-edi', canonicalId: 'HUB-EDI', type: 'HUB', description: 'Lowercase HUB-EDI' },
  'hub-paris': { legacyIdOrCode: 'hub-paris', canonicalId: 'HUB-PAR', type: 'HUB', description: 'Legacy hub-paris to Canonical HUB-PAR' },
  'paris': { legacyIdOrCode: 'paris', canonicalId: 'HUB-PAR', type: 'HUB', description: 'City name to Canonical HUB-PAR' },
  'hub-par': { legacyIdOrCode: 'hub-par', canonicalId: 'HUB-PAR', type: 'HUB', description: 'Lowercase HUB-PAR' },
  'hub-dubai': { legacyIdOrCode: 'hub-dubai', canonicalId: 'HUB-DXB', type: 'HUB', description: 'Legacy hub-dubai to Canonical HUB-DXB' },
  'dubai-city': { legacyIdOrCode: 'dubai-city', canonicalId: 'HUB-DXB', type: 'HUB', description: 'City name to Canonical HUB-DXB' },
  'hub-dxb': { legacyIdOrCode: 'hub-dxb', canonicalId: 'HUB-DXB', type: 'HUB', description: 'Lowercase HUB-DXB' },
  'hub-phuket': { legacyIdOrCode: 'hub-phuket', canonicalId: 'HUB-HKT', type: 'HUB', description: 'Legacy hub-phuket to Canonical HUB-HKT' },
  'phuket': { legacyIdOrCode: 'phuket', canonicalId: 'HUB-HKT', type: 'HUB', description: 'City name to Canonical HUB-HKT' },
  'hub-hkt': { legacyIdOrCode: 'hub-hkt', canonicalId: 'HUB-HKT', type: 'HUB', description: 'Lowercase HUB-HKT' },
  'hub-bangkok': { legacyIdOrCode: 'hub-bangkok', canonicalId: 'HUB-BKK', type: 'HUB', description: 'Legacy hub-bangkok to Canonical HUB-BKK' },
  'bangkok': { legacyIdOrCode: 'bangkok', canonicalId: 'HUB-BKK', type: 'HUB', description: 'City name to Canonical HUB-BKK' },
  'hub-bkk': { legacyIdOrCode: 'hub-bkk', canonicalId: 'HUB-BKK', type: 'HUB', description: 'Lowercase HUB-BKK' }
};

function toCanonicalRegion(r: MasterRegion): MasterRegion {
  const cleanId = (r.id || '').trim().toLowerCase();
  const cleanSlug = (r.slug || '').trim().toLowerCase();
  const mapped = CANONICAL_LEGACY_MAPPINGS[cleanId] || CANONICAL_LEGACY_MAPPINGS[cleanSlug];
  const canonicalId = mapped?.canonicalId || r.id;
  return {
    ...r,
    id: canonicalId,
    legacyId: r.id
  } as MasterRegion;
}

function toCanonicalDestination(d: Destination): Destination {
  const cleanId = (d.id || '').trim().toLowerCase();
  const cleanSlug = (d.slug || '').trim().toLowerCase();
  const mapped = CANONICAL_LEGACY_MAPPINGS[cleanId] || CANONICAL_LEGACY_MAPPINGS[cleanSlug];
  const canonicalId = mapped?.canonicalId || d.id;

  const cleanRegId = (d.regionId || '').trim().toLowerCase();
  const regMapped = CANONICAL_LEGACY_MAPPINGS[cleanRegId];
  const canonicalRegionId = regMapped?.canonicalId || d.regionId;

  return {
    ...d,
    id: canonicalId,
    regionId: canonicalRegionId,
    legacyId: d.id,
    legacyRegionId: d.regionId
  } as Destination;
}

function toCanonicalHub(h: CityHub): CityHub {
  const cleanId = (h.id || '').trim().toLowerCase();
  const cleanSlug = (h.slug || '').trim().toLowerCase();
  const cleanName = (h.name || '').trim().toLowerCase();
  const mapped = CANONICAL_LEGACY_MAPPINGS[cleanId] || CANONICAL_LEGACY_MAPPINGS[cleanSlug] || CANONICAL_LEGACY_MAPPINGS[cleanName];
  const canonicalId = mapped?.canonicalId || h.id;

  const cleanDestId = (h.destinationId || '').trim().toLowerCase();
  const destMapped = CANONICAL_LEGACY_MAPPINGS[cleanDestId];
  const canonicalDestId = destMapped?.canonicalId || h.destinationId;

  const cleanRegId = (h.regionId || '').trim().toLowerCase();
  const regMapped = CANONICAL_LEGACY_MAPPINGS[cleanRegId];
  const canonicalRegId = regMapped?.canonicalId || h.regionId;

  return {
    ...h,
    id: canonicalId,
    destinationId: canonicalDestId,
    regionId: canonicalRegId,
    legacyId: h.id,
    legacyDestinationId: h.destinationId
  } as CityHub;
}

/**
 * SINGLE AUTHORITATIVE MASTER DATA SERVICE
 * Governs all Region, Destination, and City Hub data access across CMS, Quote Builder, and Routing.
 * Prevents stale caches, mock data pollution, and relationship guessing.
 */
export class MasterDataService {
  private static instance: MasterDataService | null = null;

  private constructor() {}

  public static getInstance(): MasterDataService {
    if (!MasterDataService.instance) {
      MasterDataService.instance = new MasterDataService();
    }
    return MasterDataService.instance;
  }

  // ----------------------------------------------------
  // 1. REGIONS ACCESS
  // ----------------------------------------------------

  /**
   * Retrieves all currently active Master Regions from authoritative runtime database.
   */
  public getActiveRegions(): MasterRegion[] {
    const db = AppDatabase.getInstance();
    const raw = db.getMasterRegions();
    return raw
      .filter(r => r && r.id && r.status !== 'INACTIVE' && (r as any).status !== 'DELETED')
      .map(toCanonicalRegion);
  }

  /**
   * Retrieves a Master Region by its canonical ID.
   */
  public getRegionById(regionId?: string): MasterRegion | undefined {
    if (!regionId) return undefined;
    const cleanId = regionId.trim();
    const cleanLower = cleanId.toLowerCase();
    const mapped = CANONICAL_LEGACY_MAPPINGS[cleanLower];
    const targetId = mapped?.canonicalId || cleanId;
    const regions = this.getActiveRegions();
    return regions.find(r => 
      r.id === targetId || 
      r.id.toLowerCase() === cleanLower || 
      (r as any).legacyId === cleanId || 
      ((r as any).legacyId && (r as any).legacyId.toLowerCase() === cleanLower) ||
      (r.code && r.code.toLowerCase() === cleanLower) ||
      (r.slug && r.slug.toLowerCase() === cleanLower)
    );
  }

  /**
   * Retrieves a Master Region by URL slug.
   */
  public getRegionBySlug(slug?: string): MasterRegion | undefined {
    if (!slug) return undefined;
    const cleanSlug = slug.trim().toLowerCase();
    const regions = this.getActiveRegions();
    return regions.find(r => (r.slug || '').toLowerCase() === cleanSlug);
  }

  // ----------------------------------------------------
  // 2. DESTINATIONS ACCESS
  // ----------------------------------------------------

  /**
   * Retrieves all currently active Destinations from authoritative runtime database.
   */
  public getActiveDestinations(): Destination[] {
    const db = AppDatabase.getInstance();
    const raw = db.getDestinations();
    return raw
      .filter(d => d && d.id && d.status !== 'INACTIVE' && (d as any).status !== 'DELETED')
      .map(toCanonicalDestination);
  }

  /**
   * Retrieves all Destinations strictly belonging to a specific Master Region.
   * Does NOT return all destinations when regionId is blank.
   */
  public getDestinationsByRegionId(regionId?: string): Destination[] {
    if (!regionId || !regionId.trim()) return [];
    const cleanRegionId = regionId.trim();
    const resolvedRegion = this.getRegionById(cleanRegionId);
    if (!resolvedRegion) return [];
    const targetRegionId = resolvedRegion.id;
    const legacyRegionId = (resolvedRegion as any).legacyId;

    const destinations = this.getActiveDestinations();
    return destinations.filter(d => 
      d.regionId === targetRegionId || 
      (legacyRegionId && d.regionId === legacyRegionId) ||
      (legacyRegionId && (d as any).legacyRegionId === legacyRegionId)
    );
  }

  /**
   * Retrieves a Destination by its canonical ID.
   */
  public getDestinationById(destinationId?: string): Destination | undefined {
    if (!destinationId) return undefined;
    const cleanId = destinationId.trim();
    const cleanLower = cleanId.toLowerCase();
    const mapped = CANONICAL_LEGACY_MAPPINGS[cleanLower];
    const targetId = mapped?.canonicalId || cleanId;
    const destinations = this.getActiveDestinations();
    return destinations.find(d => 
      d.id === targetId || 
      d.id.toLowerCase() === cleanLower || 
      (d as any).legacyId === cleanId || 
      ((d as any).legacyId && (d as any).legacyId.toLowerCase() === cleanLower) ||
      (d.slug && d.slug.toLowerCase() === cleanLower) ||
      (d.country && d.country.toLowerCase() === cleanLower) ||
      (d.name && d.name.toLowerCase() === cleanLower)
    );
  }

  /**
   * Retrieves a Destination by URL slug.
   */
  public getDestinationBySlug(slug?: string): Destination | undefined {
    if (!slug) return undefined;
    const cleanSlug = slug.trim().toLowerCase();
    const destinations = this.getActiveDestinations();
    return destinations.find(d => (d.slug || '').toLowerCase() === cleanSlug);
  }

  // ----------------------------------------------------
  // 3. CITY HUBS ACCESS
  // ----------------------------------------------------

  /**
   * Retrieves all currently active City Hubs from authoritative runtime database.
   */
  public getActiveHubs(): CityHub[] {
    const db = AppDatabase.getInstance();
    const raw = db.getCityHubs();
    return raw
      .filter(h => h && h.id && h.status !== 'ARCHIVED' && (h as any).status !== 'DELETED')
      .map(toCanonicalHub);
  }

  /**
   * Retrieves City Hubs strictly belonging to a specific Destination.
   * Does NOT use fuzzy substring matching.
   */
  public getHubsByDestinationId(destinationId?: string): CityHub[] {
    if (!destinationId || !destinationId.trim()) return [];
    const cleanDestId = destinationId.trim();
    const resolvedDest = this.getDestinationById(cleanDestId);
    if (!resolvedDest) return [];
    const targetDestId = resolvedDest.id;
    const legacyDestId = (resolvedDest as any).legacyId;

    const hubs = this.getActiveHubs();
    return hubs.filter(h => 
      h.destinationId === targetDestId || 
      (legacyDestId && h.destinationId === legacyDestId) ||
      (legacyDestId && (h as any).legacyDestinationId === legacyDestId)
    );
  }

  /**
   * Retrieves City Hubs belonging to a Region through their parent Destinations.
   */
  public getHubsByRegionId(regionId?: string): CityHub[] {
    if (!regionId || !regionId.trim()) return [];
    const validDests = this.getDestinationsByRegionId(regionId);
    const validDestIds = new Set(validDests.map(d => d.id));
    const hubs = this.getActiveHubs();
    return hubs.filter(h => validDestIds.has(h.destinationId));
  }

  /**
   * Retrieves a City Hub by its canonical ID.
   */
  public getHubById(hubId?: string): CityHub | undefined {
    if (!hubId) return undefined;
    const cleanId = hubId.trim();
    const cleanLower = cleanId.toLowerCase();
    const mapped = CANONICAL_LEGACY_MAPPINGS[cleanLower];
    const targetId = mapped?.canonicalId || cleanId;
    const hubs = this.getActiveHubs();
    return hubs.find(h => 
      h.id === targetId || 
      h.id.toLowerCase() === cleanLower || 
      (h as any).legacyId === cleanId || 
      ((h as any).legacyId && (h as any).legacyId.toLowerCase() === cleanLower) ||
      (h.slug && h.slug.toLowerCase() === cleanLower) ||
      (h.name && h.name.toLowerCase() === cleanLower)
    );
  }

  // ----------------------------------------------------
  // 4. CANONICAL HIERARCHY VALIDATOR (Section 32)
  // ----------------------------------------------------

  /**
   * Strict validation of the 3-Tier Hierarchy:
   * Region (Tier 1) -> Destination (Tier 2) -> Hub (Tier 3)
   *
   * Verifies:
   * 1. Region exists in active master_regions.
   * 2. Destination exists in active destinations.
   * 3. Destination.regionId === Region.id.
   * 4. If Hub is provided, Hub exists in active city_hubs.
   * 5. If Hub is provided, Hub.destinationId === Destination.id.
   */
  public validateHierarchy(
    regionId?: string,
    destinationId?: string,
    hubId?: string
  ): HierarchyValidationResult {
    if (!regionId || !regionId.trim()) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELDS',
        error: 'Master Region (Tier 1) is required.'
      };
    }

    if (!destinationId || !destinationId.trim()) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELDS',
        error: 'Destination (Tier 2) is required.'
      };
    }

    const region = this.getRegionById(regionId);
    if (!region) {
      return {
        valid: false,
        code: 'INVALID_REGION',
        error: `Invalid Region ID "${regionId}". No active Master Region exists with this identifier.`
      };
    }

    const destination = this.getDestinationById(destinationId);
    if (!destination) {
      return {
        valid: false,
        code: 'INVALID_DESTINATION',
        error: `Invalid Destination ID "${destinationId}". No active Destination exists with this identifier.`
      };
    }

    // Verify Destination belongs to selected Region
    if (destination.regionId !== region.id) {
      return {
        valid: false,
        code: 'DESTINATION_REGION_MISMATCH',
        error: `Hierarchy Mismatch: Destination "${destination.name}" (${destination.id}) belongs to Region "${destination.regionId}", not selected Region "${region.name}" (${region.id}).`,
        region,
        destination
      };
    }

    // If Hub is provided, validate Hub belongs to selected Destination
    let hub: CityHub | undefined;
    if (hubId && hubId.trim()) {
      hub = this.getHubById(hubId);
      if (!hub) {
        return {
          valid: false,
          code: 'INVALID_HUB',
          error: `Invalid City Hub ID "${hubId}". No active City Hub exists with this identifier.`,
          region,
          destination
        };
      }

      if (hub.destinationId !== destination.id) {
        return {
          valid: false,
          code: 'HUB_DESTINATION_MISMATCH',
          error: `Hierarchy Mismatch: City Hub "${hub.name}" (${hub.id}) belongs to Destination "${hub.destinationId}", not selected Destination "${destination.name}" (${destination.id}).`,
          region,
          destination,
          hub
        };
      }
    }

    return {
      valid: true,
      region,
      destination,
      hub
    };
  }

  // ----------------------------------------------------
  // 5. PRODUCT AUDIT & REPAIR HELPER (Section 29)
  // ----------------------------------------------------

  /**
   * Audits an existing product's stored region, destination, and hub relationships.
   */
  public auditProductHierarchy(product: Partial<Product>): {
    valid: boolean;
    issues: string[];
    isLegacyMappingApplicable: boolean;
    canonicalRegionId?: string;
    canonicalDestinationId?: string;
    canonicalHubId?: string;
  } {
    const issues: string[] = [];
    const regId = product.regionId || '';
    const destId = product.destinationId || '';
    const hubId = product.hubId || '';

    let canonicalRegionId = this.getRegionById(regId)?.id;
    let canonicalDestinationId = this.getDestinationById(destId)?.id;
    let canonicalHubId = hubId ? this.getHubById(hubId)?.id : undefined;

    let isLegacyMappingApplicable = false;

    if (!regId) {
      issues.push('Missing regionId');
    } else if (!canonicalRegionId) {
      issues.push(`Unknown or inactive regionId: "${regId}"`);
    } else if (regId !== canonicalRegionId) {
      isLegacyMappingApplicable = true;
    }

    if (!destId) {
      issues.push('Missing destinationId');
    } else if (!canonicalDestinationId) {
      issues.push(`Unknown or inactive destinationId: "${destId}"`);
    } else if (destId !== canonicalDestinationId) {
      isLegacyMappingApplicable = true;
    }

    const isRail = product.category === 'Rail' || product.category === 'Rail / Shinkansen';

    if (isRail) {
      const hubIds = product.hubIds || (hubId ? [hubId] : []);
      for (const hId of hubIds) {
        const canonicalHId = hId ? this.getHubById(hId)?.id : undefined;
        if (!canonicalHId) {
          issues.push(`Unknown or inactive hubId in rail: "${hId}"`);
        } else {
          const hub = this.getHubById(canonicalHId);
          if (hub && canonicalDestinationId && hub.destinationId !== canonicalDestinationId) {
            issues.push(`Associated Hub ${hub.name} belongs to destination ${hub.destinationId}, but product specifies destination ${canonicalDestinationId}`);
          }
        }
      }
    } else {
      if (hubId) {
        if (!canonicalHubId) {
          issues.push(`Unknown or inactive hubId: "${hubId}"`);
        } else if (hubId !== canonicalHubId) {
          isLegacyMappingApplicable = true;
        }
      }

      if (canonicalDestinationId && canonicalHubId) {
        const hub = this.getHubById(canonicalHubId);
        if (hub && hub.destinationId !== canonicalDestinationId) {
          issues.push(`Hub ${hub.name} belongs to destination ${hub.destinationId}, but product specifies destination ${canonicalDestinationId}`);
        }
      }
    }

    // Check relationship integrity if both exist
    if (canonicalRegionId && canonicalDestinationId) {
      const dest = this.getDestinationById(canonicalDestinationId);
      if (dest && dest.regionId !== canonicalRegionId) {
        issues.push(`Destination ${dest.name} belongs to ${dest.regionId}, but product specifies region ${canonicalRegionId}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      isLegacyMappingApplicable,
      canonicalRegionId,
      canonicalDestinationId,
      canonicalHubId
    };
  }
}
