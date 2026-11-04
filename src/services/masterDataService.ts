import { MasterRegion, Destination, DestinationRegionItem, CityHub, Product } from '../types';
import { AppDatabase } from './db';
import { envService } from './environment';
import { INITIAL_MASTER_REGIONS } from '../data/initialRegions';
import { DESTINATIONS } from '../data/destinations';
import { INITIAL_CITY_HUBS } from '../data/initialCityHubs';

export interface HierarchyValidationResult {
  valid: boolean;
  error?: string;
  code?:
    | 'INVALID_REGION'
    | 'INVALID_DESTINATION'
    | 'INVALID_HUB'
    | 'DESTINATION_REGION_MISMATCH'
    | 'HUB_DESTINATION_MISMATCH'
    | 'HUB_REGION_MISMATCH'
    | 'MISSING_REQUIRED_FIELDS';
  region?: DestinationRegionItem | MasterRegion;
  destinationRegion?: DestinationRegionItem;
  destination?: Destination;
  hub?: CityHub;
}

export interface LegacyMasterMapping {
  legacyIdOrCode: string;
  canonicalId: string;
  type: 'MASTER_REGION' | 'REGION' | 'DESTINATION' | 'HUB';
  description: string;
}

/**
 * Authoritative explicit mapping lookup table for legacy system codes.
 * Maps legacy identifiers to the actual canonical Firestore document IDs.
 * Never infers relationships from substring or fuzzy text matching.
 */
export const CANONICAL_LEGACY_MAPPINGS: Record<string, LegacyMasterMapping> = {
  // Macro Region Legacy Codes
  'reg-east-asia': { legacyIdOrCode: 'reg-east-asia', canonicalId: 'REG-001', type: 'MASTER_REGION', description: 'Legacy East Asia slug to Canonical REG-001' },
  'reg-001': { legacyIdOrCode: 'reg-001', canonicalId: 'REG-001', type: 'MASTER_REGION', description: 'Lowercase REG-001' },
  'reg_001': { legacyIdOrCode: 'reg_001', canonicalId: 'REG-001', type: 'MASTER_REGION', description: 'Underscore REG_001' },
  'reg-western-europe': { legacyIdOrCode: 'reg-western-europe', canonicalId: 'REG-002', type: 'MASTER_REGION', description: 'Legacy Western Europe to Canonical REG-002' },
  'reg-002': { legacyIdOrCode: 'reg-002', canonicalId: 'REG-002', type: 'MASTER_REGION', description: 'Lowercase REG-002' },
  'reg-middle-east': { legacyIdOrCode: 'reg-middle-east', canonicalId: 'REG-003', type: 'MASTER_REGION', description: 'Legacy Middle East to Canonical REG-003' },
  'reg-003': { legacyIdOrCode: 'reg-003', canonicalId: 'REG-003', type: 'MASTER_REGION', description: 'Lowercase REG-003' },
  'reg-southeast-asia': { legacyIdOrCode: 'reg-southeast-asia', canonicalId: 'REG-004', type: 'MASTER_REGION', description: 'Legacy Southeast Asia to Canonical REG-004' },
  'reg-004': { legacyIdOrCode: 'reg-004', canonicalId: 'REG-004', type: 'MASTER_REGION', description: 'Lowercase REG-004' },
  'reg-southern-europe': { legacyIdOrCode: 'reg-southern-europe', canonicalId: 'REG-005', type: 'MASTER_REGION', description: 'Southern Europe to REG-005' },
  'reg-005': { legacyIdOrCode: 'reg-005', canonicalId: 'REG-005', type: 'MASTER_REGION', description: 'Lowercase REG-005' },
  'reg-scandinavia': { legacyIdOrCode: 'reg-scandinavia', canonicalId: 'REG-006', type: 'MASTER_REGION', description: 'Scandinavia to REG-006' },
  'reg-006': { legacyIdOrCode: 'reg-006', canonicalId: 'REG-006', type: 'MASTER_REGION', description: 'Lowercase REG-006' },
  'reg-north-america': { legacyIdOrCode: 'reg-north-america', canonicalId: 'REG-007', type: 'MASTER_REGION', description: 'North America to REG-007' },
  'reg-007': { legacyIdOrCode: 'reg-007', canonicalId: 'REG-007', type: 'MASTER_REGION', description: 'Lowercase REG-007' },
  'reg-south-asia': { legacyIdOrCode: 'reg-south-asia', canonicalId: 'REG-008', type: 'MASTER_REGION', description: 'South Asia to REG-008' },
  'reg-008': { legacyIdOrCode: 'reg-008', canonicalId: 'REG-008', type: 'MASTER_REGION', description: 'Lowercase REG-008' },

  // Destination Legacy Codes -> Canonical Firestore Destination IDs
  'dest-japan': { legacyIdOrCode: 'dest-japan', canonicalId: 'DST-JPN', type: 'DESTINATION', description: 'Legacy dest-japan to Canonical DST-JPN' },
  'japan': { legacyIdOrCode: 'japan', canonicalId: 'DST-JPN', type: 'DESTINATION', description: 'Slug japan to Canonical DST-JPN' },
  'dst-jpn': { legacyIdOrCode: 'dst-jpn', canonicalId: 'DST-JPN', type: 'DESTINATION', description: 'Lowercase DST-JPN' },
  'dest-uk': { legacyIdOrCode: 'dest-uk', canonicalId: 'DST-UK', type: 'DESTINATION', description: 'Legacy dest-uk to Canonical DST-UK' },
  'united-kingdom': { legacyIdOrCode: 'united-kingdom', canonicalId: 'DST-UK', type: 'DESTINATION', description: 'Slug united-kingdom to Canonical DST-UK' },
  'uk': { legacyIdOrCode: 'uk', canonicalId: 'DST-UK', type: 'DESTINATION', description: 'Code uk to Canonical DST-UK' },
  'dst-uk': { legacyIdOrCode: 'dst-uk', canonicalId: 'DST-UK', type: 'DESTINATION', description: 'Lowercase DST-UK' },
  'dest-france': { legacyIdOrCode: 'dest-france', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Legacy dest-france to Canonical DST-FRA' },
  'dest-fra': { legacyIdOrCode: 'dest-fra', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Legacy dest-fra to Canonical DST-FRA' },
  'dest-europe': { legacyIdOrCode: 'dest-europe', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Europe to Canonical DST-FRA' },
  'europe': { legacyIdOrCode: 'europe', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Europe slug to Canonical DST-FRA' },
  'dst-fra': { legacyIdOrCode: 'dst-fra', canonicalId: 'DST-FRA', type: 'DESTINATION', description: 'Lowercase DST-FRA' },
  'dest-uae': { legacyIdOrCode: 'dest-uae', canonicalId: 'DST-UAE', type: 'DESTINATION', description: 'Legacy dest-uae to Canonical DST-UAE' },
  'dest-dubai': { legacyIdOrCode: 'dest-dubai', canonicalId: 'DST-UAE', type: 'DESTINATION', description: 'Legacy dest-dubai to Canonical DST-UAE' },
  'uae': { legacyIdOrCode: 'uae', canonicalId: 'DST-UAE', type: 'DESTINATION', description: 'Slug uae to Canonical DST-UAE' },
  'dst-uae': { legacyIdOrCode: 'dst-uae', canonicalId: 'DST-UAE', type: 'DESTINATION', description: 'Lowercase DST-UAE' },
  'dest-thailand': { legacyIdOrCode: 'dest-thailand', canonicalId: 'DST-THA', type: 'DESTINATION', description: 'Legacy dest-thailand to Canonical DST-THA' },
  'dest-tha': { legacyIdOrCode: 'dest-tha', canonicalId: 'DST-THA', type: 'DESTINATION', description: 'Legacy dest-tha to Canonical DST-THA' },
  'thailand': { legacyIdOrCode: 'thailand', canonicalId: 'DST-THA', type: 'DESTINATION', description: 'Slug thailand to Canonical DST-THA' },
  'dst-tha': { legacyIdOrCode: 'dst-tha', canonicalId: 'DST-THA', type: 'DESTINATION', description: 'Lowercase DST-THA' },
  'dst-mys': { legacyIdOrCode: 'dst-mys', canonicalId: 'dest-malaysia', type: 'DESTINATION', description: 'DST-MYS to Canonical dest-malaysia' },
  'malaysia': { legacyIdOrCode: 'malaysia', canonicalId: 'dest-malaysia', type: 'DESTINATION', description: 'Slug malaysia to Canonical dest-malaysia' },
  'dst-sgp': { legacyIdOrCode: 'dst-sgp', canonicalId: 'dest-singapore', type: 'DESTINATION', description: 'DST-SGP to Canonical dest-singapore' },
  'singapore': { legacyIdOrCode: 'singapore', canonicalId: 'dest-singapore', type: 'DESTINATION', description: 'Slug singapore to Canonical dest-singapore' },
  'dst-idn': { legacyIdOrCode: 'dst-idn', canonicalId: 'dest-indonesia', type: 'DESTINATION', description: 'DST-IDN to Canonical dest-indonesia' },
  'indonesia': { legacyIdOrCode: 'indonesia', canonicalId: 'dest-indonesia', type: 'DESTINATION', description: 'Slug indonesia to Canonical dest-indonesia' },
  'bali-indonesia': { legacyIdOrCode: 'bali-indonesia', canonicalId: 'dest-indonesia', type: 'DESTINATION', description: 'Slug bali-indonesia to Canonical dest-indonesia' },
  'dst-vnm': { legacyIdOrCode: 'dst-vnm', canonicalId: 'dest-vietnam', type: 'DESTINATION', description: 'DST-VNM to Canonical dest-vietnam' },
  'vietnam': { legacyIdOrCode: 'vietnam', canonicalId: 'dest-vietnam', type: 'DESTINATION', description: 'Slug vietnam to Canonical dest-vietnam' },

  // Hub Legacy Codes -> Canonical Firestore city_hubs Document IDs
  'hub-tyo': { legacyIdOrCode: 'hub-tyo', canonicalId: 'hub-tokyo', type: 'HUB', description: 'Legacy HUB-TYO to Canonical hub-tokyo' },
  'hub-tokyo': { legacyIdOrCode: 'hub-tokyo', canonicalId: 'hub-tokyo', type: 'HUB', description: 'Canonical hub-tokyo' },
  'tokyo': { legacyIdOrCode: 'tokyo', canonicalId: 'hub-tokyo', type: 'HUB', description: 'Slug tokyo to Canonical hub-tokyo' },
  'hub-kyo': { legacyIdOrCode: 'hub-kyo', canonicalId: 'hub-kyoto', type: 'HUB', description: 'Legacy HUB-KYO to Canonical hub-kyoto' },
  'hub-kyoto': { legacyIdOrCode: 'hub-kyoto', canonicalId: 'hub-kyoto', type: 'HUB', description: 'Canonical hub-kyoto' },
  'kyoto': { legacyIdOrCode: 'kyoto', canonicalId: 'hub-kyoto', type: 'HUB', description: 'Slug kyoto to Canonical hub-kyoto' },
  'hub-osa': { legacyIdOrCode: 'hub-osa', canonicalId: 'hub-osaka', type: 'HUB', description: 'Legacy HUB-OSA to Canonical hub-osaka' },
  'hub-osaka': { legacyIdOrCode: 'hub-osaka', canonicalId: 'hub-osaka', type: 'HUB', description: 'Canonical hub-osaka' },
  'osaka': { legacyIdOrCode: 'osaka', canonicalId: 'hub-osaka', type: 'HUB', description: 'Slug osaka to Canonical hub-osaka' },
  'hub-hak': { legacyIdOrCode: 'hub-hak', canonicalId: 'hub-hakone', type: 'HUB', description: 'Legacy HUB-HAK to Canonical hub-hakone' },
  'hub-hakone': { legacyIdOrCode: 'hub-hakone', canonicalId: 'hub-hakone', type: 'HUB', description: 'Canonical hub-hakone' },
  'hakone': { legacyIdOrCode: 'hakone', canonicalId: 'hub-hakone', type: 'HUB', description: 'Slug hakone to Canonical hub-hakone' },
  'hub-hiro': { legacyIdOrCode: 'hub-hiro', canonicalId: 'hub-hiroshima', type: 'HUB', description: 'Legacy HUB-HIRO to Canonical hub-hiroshima' },
  'hub-hij': { legacyIdOrCode: 'hub-hij', canonicalId: 'hub-hiroshima', type: 'HUB', description: 'Legacy HUB-HIJ to Canonical hub-hiroshima' },
  'hub-hiroshima': { legacyIdOrCode: 'hub-hiroshima', canonicalId: 'hub-hiroshima', type: 'HUB', description: 'Canonical hub-hiroshima' },
  'hiroshima': { legacyIdOrCode: 'hiroshima', canonicalId: 'hub-hiroshima', type: 'HUB', description: 'Slug hiroshima to Canonical hub-hiroshima' },
  'hub-ngo': { legacyIdOrCode: 'hub-ngo', canonicalId: 'hub-nagoya-chubu', type: 'HUB', description: 'Legacy HUB-NGO to Canonical hub-nagoya-chubu' },
  'hub-nagoya': { legacyIdOrCode: 'hub-nagoya', canonicalId: 'hub-nagoya-chubu', type: 'HUB', description: 'Legacy hub-nagoya to Canonical hub-nagoya-chubu' },
  'hub-nagoya-chubu': { legacyIdOrCode: 'hub-nagoya-chubu', canonicalId: 'hub-nagoya-chubu', type: 'HUB', description: 'Canonical hub-nagoya-chubu' },
  'nagoya': { legacyIdOrCode: 'nagoya', canonicalId: 'hub-nagoya-chubu', type: 'HUB', description: 'Slug nagoya to Canonical hub-nagoya-chubu' },
  'hub-spk': { legacyIdOrCode: 'hub-spk', canonicalId: 'hub-sapporo', type: 'HUB', description: 'Legacy HUB-SPK to Canonical hub-sapporo' },
  'hub-sapporo': { legacyIdOrCode: 'hub-sapporo', canonicalId: 'hub-sapporo', type: 'HUB', description: 'Canonical hub-sapporo' },
  'sapporo': { legacyIdOrCode: 'sapporo', canonicalId: 'hub-sapporo', type: 'HUB', description: 'Slug sapporo to Canonical hub-sapporo' },
  'hub-fuk': { legacyIdOrCode: 'hub-fuk', canonicalId: 'hub-fukuoka-kyushu', type: 'HUB', description: 'Legacy HUB-FUK to Canonical hub-fukuoka-kyushu' },
  'hub-fukuoka': { legacyIdOrCode: 'hub-fukuoka', canonicalId: 'hub-fukuoka-kyushu', type: 'HUB', description: 'Legacy hub-fukuoka to Canonical hub-fukuoka-kyushu' },
  'hub-fukuoka-kyushu': { legacyIdOrCode: 'hub-fukuoka-kyushu', canonicalId: 'hub-fukuoka-kyushu', type: 'HUB', description: 'Canonical hub-fukuoka-kyushu' },
  'fukuoka': { legacyIdOrCode: 'fukuoka', canonicalId: 'hub-fukuoka-kyushu', type: 'HUB', description: 'Slug fukuoka to Canonical hub-fukuoka-kyushu' },
  'hub-sdj': { legacyIdOrCode: 'hub-sdj', canonicalId: 'hub-sendai', type: 'HUB', description: 'Legacy HUB-SDJ to Canonical hub-sendai' },
  'hub-sendai': { legacyIdOrCode: 'hub-sendai', canonicalId: 'hub-sendai', type: 'HUB', description: 'Canonical hub-sendai' },
  'sendai': { legacyIdOrCode: 'sendai', canonicalId: 'hub-sendai', type: 'HUB', description: 'Slug sendai to Canonical hub-sendai' },
  'hub-fks': { legacyIdOrCode: 'hub-fks', canonicalId: 'hub-fukushima', type: 'HUB', description: 'Legacy HUB-FKS to Canonical hub-fukushima' },
  'hub-fukushima': { legacyIdOrCode: 'hub-fukushima', canonicalId: 'hub-fukushima', type: 'HUB', description: 'Canonical hub-fukushima' },
  'fukushima': { legacyIdOrCode: 'fukushima', canonicalId: 'hub-fukushima', type: 'HUB', description: 'Slug fukushima to Canonical hub-fukushima' },
  'hub-knz': { legacyIdOrCode: 'hub-knz', canonicalId: 'hub-kanazawa', type: 'HUB', description: 'Legacy HUB-KNZ to Canonical hub-kanazawa' },
  'hub-kmq': { legacyIdOrCode: 'hub-kmq', canonicalId: 'hub-kanazawa', type: 'HUB', description: 'Legacy HUB-KMQ to Canonical hub-kanazawa' },
  'hub-kanazawa': { legacyIdOrCode: 'hub-kanazawa', canonicalId: 'hub-kanazawa', type: 'HUB', description: 'Canonical hub-kanazawa' },
  'kanazawa': { legacyIdOrCode: 'kanazawa', canonicalId: 'hub-kanazawa', type: 'HUB', description: 'Slug kanazawa to Canonical hub-kanazawa' },
  'hub-yok': { legacyIdOrCode: 'hub-yok', canonicalId: 'hub-yokohama', type: 'HUB', description: 'Legacy HUB-YOK to Canonical hub-yokohama' },
  'hub-yokohama': { legacyIdOrCode: 'hub-yokohama', canonicalId: 'hub-yokohama', type: 'HUB', description: 'Canonical hub-yokohama' },
  'yokohama': { legacyIdOrCode: 'yokohama', canonicalId: 'hub-yokohama', type: 'HUB', description: 'Slug yokohama to Canonical hub-yokohama' },
  'hub-lon': { legacyIdOrCode: 'hub-lon', canonicalId: 'hub-london', type: 'HUB', description: 'Legacy HUB-LON to Canonical hub-london' },
  'hub-london': { legacyIdOrCode: 'hub-london', canonicalId: 'hub-london', type: 'HUB', description: 'Canonical hub-london' },
  'london': { legacyIdOrCode: 'london', canonicalId: 'hub-london', type: 'HUB', description: 'Slug london to Canonical hub-london' },
  'hub-edi': { legacyIdOrCode: 'hub-edi', canonicalId: 'hub-edinburgh', type: 'HUB', description: 'Legacy HUB-EDI to Canonical hub-edinburgh' },
  'hub-edinburgh': { legacyIdOrCode: 'hub-edinburgh', canonicalId: 'hub-edinburgh', type: 'HUB', description: 'Canonical hub-edinburgh' },
  'edinburgh': { legacyIdOrCode: 'edinburgh', canonicalId: 'hub-edinburgh', type: 'HUB', description: 'Slug edinburgh to Canonical hub-edinburgh' },
  'hub-par': { legacyIdOrCode: 'hub-par', canonicalId: 'hub-paris', type: 'HUB', description: 'Legacy HUB-PAR to Canonical hub-paris' },
  'hub-paris': { legacyIdOrCode: 'hub-paris', canonicalId: 'hub-paris', type: 'HUB', description: 'Canonical hub-paris' },
  'paris': { legacyIdOrCode: 'paris', canonicalId: 'hub-paris', type: 'HUB', description: 'Slug paris to Canonical hub-paris' },
  'hub-dxb': { legacyIdOrCode: 'hub-dxb', canonicalId: 'hub-dubai', type: 'HUB', description: 'Legacy HUB-DXB to Canonical hub-dubai' },
  'hub-dubai': { legacyIdOrCode: 'hub-dubai', canonicalId: 'hub-dubai', type: 'HUB', description: 'Canonical hub-dubai' },
  'dubai-city': { legacyIdOrCode: 'dubai-city', canonicalId: 'hub-dubai', type: 'HUB', description: 'Slug dubai-city to Canonical hub-dubai' },
  'hub-hkt': { legacyIdOrCode: 'hub-hkt', canonicalId: 'hub-phuket', type: 'HUB', description: 'Legacy HUB-HKT to Canonical hub-phuket' },
  'hub-phuket': { legacyIdOrCode: 'hub-phuket', canonicalId: 'hub-phuket', type: 'HUB', description: 'Canonical hub-phuket' },
  'phuket': { legacyIdOrCode: 'phuket', canonicalId: 'hub-phuket', type: 'HUB', description: 'Slug phuket to Canonical hub-phuket' },
  'hub-bkk': { legacyIdOrCode: 'hub-bkk', canonicalId: 'hub-bangkok', type: 'HUB', description: 'Legacy HUB-BKK to Canonical hub-bangkok' },
  'hub-bangkok': { legacyIdOrCode: 'hub-bangkok', canonicalId: 'hub-bangkok', type: 'HUB', description: 'Canonical hub-bangkok' },
  'bangkok': { legacyIdOrCode: 'bangkok', canonicalId: 'hub-bangkok', type: 'HUB', description: 'Slug bangkok to Canonical hub-bangkok' }
};

function toCanonicalMasterRegion(r: MasterRegion): MasterRegion {
  const cleanId = (r.id || '').trim().toLowerCase();
  const cleanSlug = (r.slug || '').trim().toLowerCase();
  const mapped = CANONICAL_LEGACY_MAPPINGS[cleanId] || CANONICAL_LEGACY_MAPPINGS[cleanSlug];
  const canonicalId = mapped?.type === 'MASTER_REGION' ? mapped.canonicalId : r.id;
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
  const canonicalId = mapped?.type === 'DESTINATION' ? mapped.canonicalId : d.id;

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

function toCanonicalDestinationRegion(r: DestinationRegionItem): DestinationRegionItem {
  const cleanDestId = (r.destinationId || '').trim().toLowerCase();
  const destMapped = CANONICAL_LEGACY_MAPPINGS[cleanDestId];
  const canonicalDestId = destMapped?.type === 'DESTINATION' ? destMapped.canonicalId : r.destinationId;
  return {
    ...r,
    destinationId: canonicalDestId
  };
}

function toCanonicalHub(h: CityHub): CityHub {
  const cleanId = (h.id || '').trim().toLowerCase();
  const mapped = CANONICAL_LEGACY_MAPPINGS[cleanId];
  const canonicalId = mapped?.type === 'HUB' ? mapped.canonicalId : h.id;

  const cleanDestId = (h.destinationId || '').trim().toLowerCase();
  const destMapped = CANONICAL_LEGACY_MAPPINGS[cleanDestId];
  const canonicalDestId = destMapped?.type === 'DESTINATION' ? destMapped.canonicalId : h.destinationId;

  return {
    ...h,
    id: canonicalId,
    destinationId: canonicalDestId,
    legacyId: h.id,
    legacyDestinationId: h.destinationId
  } as CityHub;
}

export interface GeographicalAuditReport {
  valid: boolean;
  duplicateDestinations: Array<{ id: string; name: string; duplicateOf: string }>;
  orphanedRegions: Array<{ id: string; name: string; destinationId: string; reason: string }>;
  orphanedHubs: Array<{ id: string; name: string; destinationId: string; regionId?: string; reason: string }>;
  unmappedProducts: Array<{ id: string; name: string; sku?: string; issues: string[] }>;
}

/**
 * SINGLE AUTHORITATIVE MASTER DATA SERVICE
 * Enforces the strict geographical hierarchy:
 * Destination -> Region -> Hub -> Products
 * Zero mock fallbacks in production (Section 15 & Section 16).
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
  // 1. DESTINATIONS ACCESS (TIER 1 OF GEOGRAPHICAL HIERARCHY)
  // ----------------------------------------------------

  /**
   * Retrieves all non-deleted Destinations from the authoritative database.
   */
  public getAllDestinations(): Destination[] {
    const db = AppDatabase.getInstance();
    const raw = db.getDestinations();
    const source = raw && raw.length > 0 ? raw : (envService.allowDemoData() ? DESTINATIONS : []);
    return source
      .filter(d => d && d.id && (d as any).status !== 'DELETED')
      .map(toCanonicalDestination);
  }

  /**
   * Retrieves currently active/visible Destinations from the authoritative database.
   */
  public getActiveDestinations(): Destination[] {
    return this.getAllDestinations().filter(d => d.status !== 'INACTIVE');
  }

  /**
   * Retrieves a Destination by its canonical ID or slug.
   * By default searches all non-deleted destinations so Admin CMS and validators can resolve inactive/coming-soon destinations.
   */
  public getDestinationById(destinationId?: string, includeInactive: boolean = true): Destination | undefined {
    if (!destinationId) return undefined;
    const cleanId = destinationId.trim();
    const cleanLower = cleanId.toLowerCase();
    const mapped = CANONICAL_LEGACY_MAPPINGS[cleanLower];
    const targetId = mapped?.type === 'DESTINATION' ? mapped.canonicalId : cleanId;
    const destinations = includeInactive ? this.getAllDestinations() : this.getActiveDestinations();
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
  public getDestinationBySlug(slug?: string, includeInactive: boolean = true): Destination | undefined {
    if (!slug) return undefined;
    const cleanSlug = slug.trim().toLowerCase();
    const destinations = includeInactive ? this.getAllDestinations() : this.getActiveDestinations();
    return destinations.find(d => (d.slug || '').toLowerCase() === cleanSlug || d.id.toLowerCase() === cleanSlug);
  }

  // ----------------------------------------------------
  // 2. DESTINATION REGIONS ACCESS (TIER 2: DESTINATION -> REGION)
  // ----------------------------------------------------

  /**
   * Retrieves all non-deleted Destination Regions from the authoritative database.
   */
  public getAllDestinationRegions(): DestinationRegionItem[] {
    const db = AppDatabase.getInstance();
    const raw = db.getRegions();
    return (raw || [])
      .filter(r => r && r.id && (r as any).status !== 'DELETED')
      .map(toCanonicalDestinationRegion);
  }

  /**
   * Retrieves all active Destination Regions from the authoritative database.
   */
  public getActiveDestinationRegions(): DestinationRegionItem[] {
    return this.getAllDestinationRegions().filter(r => r.status !== 'INACTIVE' && r.isActive !== false);
  }

  /**
   * Retrieves all Regions belonging to a specific Destination via actual destinationId relationship.
   */
  public getRegionsByDestinationId(destinationId?: string, includeInactive: boolean = true): DestinationRegionItem[] {
    if (!destinationId || !destinationId.trim()) return [];
    const resolvedDest = this.getDestinationById(destinationId, true);
    if (!resolvedDest) return [];
    const targetDestId = resolvedDest.id;
    const regions = includeInactive ? this.getAllDestinationRegions() : this.getActiveDestinationRegions();
    return regions
      .filter(r => r.destinationId === targetDestId)
      .sort((a, b) => (a.orderIndex || 0) - (b.orderIndex || 0));
  }

  /**
   * Retrieves a Destination Region by ID or slug.
   */
  public getDestinationRegionById(regionId?: string, includeInactive: boolean = true): DestinationRegionItem | undefined {
    if (!regionId) return undefined;
    const cleanId = regionId.trim();
    const cleanLower = cleanId.toLowerCase();
    const regions = includeInactive ? this.getAllDestinationRegions() : this.getActiveDestinationRegions();
    return regions.find(r =>
      r.id === cleanId ||
      r.id.toLowerCase() === cleanLower ||
      (r.slug && r.slug.toLowerCase() === cleanLower) ||
      (r.name && r.name.toLowerCase() === cleanLower)
    );
  }

  // ----------------------------------------------------
  // 2b. MACRO REGIONS ACCESS (COMPATIBILITY)
  // ----------------------------------------------------

  public getActiveRegions(): MasterRegion[] {
    const db = AppDatabase.getInstance();
    const raw = db.getMasterRegions();
    const source = raw && raw.length > 0 ? raw : (envService.allowDemoData() ? INITIAL_MASTER_REGIONS : []);
    return source
      .filter(r => r && r.id && r.status !== 'INACTIVE' && (r as any).status !== 'DELETED')
      .map(toCanonicalMasterRegion);
  }

  public getRegionById(regionId?: string): MasterRegion | undefined {
    if (!regionId) return undefined;
    const cleanId = regionId.trim();
    const cleanLower = cleanId.toLowerCase();
    const mapped = CANONICAL_LEGACY_MAPPINGS[cleanLower];
    const targetId = mapped?.type === 'MASTER_REGION' ? mapped.canonicalId : cleanId;
    const regions = this.getActiveRegions();
    const foundMacro = regions.find(r =>
      r.id === targetId ||
      r.id.toLowerCase() === cleanLower ||
      (r as any).legacyId === cleanId ||
      ((r as any).legacyId && (r as any).legacyId.toLowerCase() === cleanLower) ||
      (r.code && r.code.toLowerCase() === cleanLower) ||
      (r.slug && r.slug.toLowerCase() === cleanLower)
    );
    if (foundMacro) return foundMacro;

    // Also allow resolving DestinationRegionItem as a compatible region descriptor
    const destReg = this.getDestinationRegionById(cleanId, true);
    if (destReg) {
      return {
        id: destReg.id,
        name: destReg.name,
        code: destReg.id.toUpperCase(),
        slug: destReg.slug || destReg.id,
        status: (destReg.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE') as 'ACTIVE' | 'INACTIVE',
        isPublished: destReg.status !== 'INACTIVE',
        displayOrder: destReg.orderIndex || 1
      };
    }
    return undefined;
  }

  public getRegionBySlug(slug?: string): MasterRegion | undefined {
    if (!slug) return undefined;
    const cleanSlug = slug.trim().toLowerCase();
    const regions = this.getActiveRegions();
    return regions.find(r => (r.slug || '').toLowerCase() === cleanSlug);
  }

  public getDestinationsByRegionId(regionId?: string): Destination[] {
    if (!regionId || !regionId.trim()) return [];
    const cleanRegionId = regionId.trim();
    // First check if regionId is a DestinationRegionItem (child of a Destination)
    const destRegion = this.getDestinationRegionById(cleanRegionId, true);
    if (destRegion) {
      const parentDest = this.getDestinationById(destRegion.destinationId, true);
      return parentDest ? [parentDest] : [];
    }
    const resolvedRegion = this.getRegionById(cleanRegionId);
    if (!resolvedRegion) return [];
    const targetRegionId = resolvedRegion.id;
    const legacyRegionId = (resolvedRegion as any).legacyId;

    const destinations = this.getAllDestinations();
    return destinations.filter(d =>
      d.regionId === targetRegionId ||
      (legacyRegionId && d.regionId === legacyRegionId) ||
      (legacyRegionId && (d as any).legacyRegionId === legacyRegionId)
    );
  }

  // ----------------------------------------------------
  // 3. CITY HUBS ACCESS (TIER 3: DESTINATION -> REGION -> HUB)
  // ----------------------------------------------------

  /**
   * Retrieves all non-deleted City Hubs from the authoritative database.
   */
  public getAllHubs(): CityHub[] {
    const db = AppDatabase.getInstance();
    const raw = db.getCityHubs();
    const source = raw && raw.length > 0 ? raw : (envService.allowDemoData() ? INITIAL_CITY_HUBS : []);
    return source
      .filter(h => h && h.id && (h as any).status !== 'DELETED')
      .map(toCanonicalHub);
  }

  /**
   * Retrieves all active City Hubs from the authoritative database.
   */
  public getActiveHubs(): CityHub[] {
    return this.getAllHubs().filter(h => h.status !== 'ARCHIVED' && h.status !== 'INACTIVE' && h.isActive !== false);
  }

  /**
   * Retrieves City Hubs strictly belonging to a specific Destination via destinationId.
   */
  public getHubsByDestinationId(destinationId?: string, includeInactive: boolean = false): CityHub[] {
    if (!destinationId || !destinationId.trim()) return [];
    const resolvedDest = this.getDestinationById(destinationId, true);
    if (!resolvedDest) return [];
    const targetDestId = resolvedDest.id;

    const hubs = includeInactive ? this.getAllHubs() : this.getActiveHubs();
    return hubs.filter(h => h.destinationId === targetDestId);
  }

  /**
   * Retrieves City Hubs strictly belonging to a specific Region via regionId.
   */
  public getHubsByRegionId(regionId?: string, includeInactive: boolean = false): CityHub[] {
    if (!regionId || !regionId.trim()) return [];
    const cleanRegId = regionId.trim();
    const hubs = includeInactive ? this.getAllHubs() : this.getActiveHubs();

    // Check direct DestinationRegion match first (Destination -> Region -> Hub)
    const destReg = this.getDestinationRegionById(cleanRegId, true);
    if (destReg) {
      return hubs.filter(h => h.regionId === destReg.id && h.destinationId === destReg.destinationId);
    }

    // Fallback for macro MasterRegion IDs (e.g. REG-001)
    const validDests = this.getDestinationsByRegionId(cleanRegId);
    const validDestIds = new Set(validDests.map(d => d.id));
    return hubs.filter(h => validDestIds.has(h.destinationId));
  }

  /**
   * Retrieves a City Hub by its canonical ID or legacy alias.
   */
  public getHubById(hubId?: string, includeInactive: boolean = true): CityHub | undefined {
    if (!hubId) return undefined;
    const cleanId = hubId.trim();
    const cleanLower = cleanId.toLowerCase();
    const mapped = CANONICAL_LEGACY_MAPPINGS[cleanLower];
    const targetId = mapped?.type === 'HUB' ? mapped.canonicalId : cleanId;
    const hubs = includeInactive ? this.getAllHubs() : this.getActiveHubs();
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
  // 4. AUTHORITATIVE PRODUCT RETRIEVAL BY GEOGRAPHY
  // ----------------------------------------------------

  /**
   * Returns all products strictly associated with a Destination by ID.
   */
  public getProductsByDestinationId(destinationId?: string, onlyActive: boolean = true): Product[] {
    if (!destinationId || !destinationId.trim()) return [];
    const dest = this.getDestinationById(destinationId, true);
    if (!dest) return [];
    const db = AppDatabase.getInstance();
    const products = db.getProducts();
    return products.filter(p => {
      if (!p || (p as any).status === 'DELETED') return false;
      if (onlyActive && p.status !== 'ACTIVE') return false;
      const pDest = this.getDestinationById(p.destinationId, true);
      return pDest?.id === dest.id;
    });
  }

  /**
   * Returns all products strictly associated with a Region by ID.
   */
  public getProductsByRegionId(regionId?: string, onlyActive: boolean = true): Product[] {
    if (!regionId || !regionId.trim()) return [];
    const reg = this.getDestinationRegionById(regionId, true);
    if (!reg) return [];
    const validHubIdsInRegion = new Set(this.getHubsByRegionId(reg.id, true).map(h => h.id));
    const db = AppDatabase.getInstance();
    const products = db.getProducts();
    return products.filter(p => {
      if (!p || (p as any).status === 'DELETED') return false;
      if (onlyActive && p.status !== 'ACTIVE') return false;
      const pDest = this.getDestinationById(p.destinationId, true);
      if (pDest?.id !== reg.destinationId) return false;
      if (p.regionId === reg.id) return true;
      if (Array.isArray((p as any).regionIds) && (p as any).regionIds.includes(reg.id)) return true;
      // Check validated multi-hub references
      if (Array.isArray(p.hubIds) && p.hubIds.length > 0) {
        return p.hubIds.some(hid => {
          const resolvedHub = this.getHubById(hid, true);
          return resolvedHub ? validHubIdsInRegion.has(resolvedHub.id) : false;
        });
      }
      if (p.hubId) {
        const resolvedHub = this.getHubById(p.hubId, true);
        return resolvedHub ? validHubIdsInRegion.has(resolvedHub.id) : false;
      }
      return false;
    });
  }

  /**
   * Returns all products strictly associated with a City Hub by ID (primary hubId or validated hubIds array).
   */
  public getProductsByHubId(hubId?: string, onlyActive: boolean = true): Product[] {
    if (!hubId || !hubId.trim()) return [];
    const hub = this.getHubById(hubId, true);
    if (!hub) return [];
    const db = AppDatabase.getInstance();
    const products = db.getProducts();
    return products.filter(p => {
      if (!p || (p as any).status === 'DELETED') return false;
      if (onlyActive && p.status !== 'ACTIVE') return false;
      const pDest = this.getDestinationById(p.destinationId, true);
      if (pDest?.id !== hub.destinationId) return false;
      if (p.hubId) {
        const resolvedPrimary = this.getHubById(p.hubId, true);
        if (resolvedPrimary?.id === hub.id) return true;
      }
      if (Array.isArray(p.hubIds) && p.hubIds.length > 0) {
        return p.hubIds.some(hid => this.getHubById(hid, true)?.id === hub.id);
      }
      return false;
    });
  }

  // ----------------------------------------------------
  // 5. GEOGRAPHICAL RELATIONSHIP VALIDATION (Section 16.E)
  // ----------------------------------------------------

  /**
   * Validates that a Region belongs to an existing Destination.
   */
  public validateRegionRelationship(destinationId?: string): HierarchyValidationResult {
    if (!destinationId || !destinationId.trim()) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELDS',
        error: 'Parent Destination is required for every Region.'
      };
    }
    const destination = this.getDestinationById(destinationId, true);
    if (!destination) {
      return {
        valid: false,
        code: 'INVALID_DESTINATION',
        error: `Invalid Destination ID "${destinationId}". Region must reference an existing Destination.`
      };
    }
    return { valid: true, destination };
  }

  /**
   * Validates that a City Hub references an existing Destination and Region,
   * and that the Region belongs to the same Destination.
   */
  public validateHubRelationship(destinationId?: string, regionId?: string): HierarchyValidationResult {
    if (!destinationId || !destinationId.trim()) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELDS',
        error: 'Parent Destination is required for every City Hub.'
      };
    }
    if (!regionId || !regionId.trim()) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELDS',
        error: 'Parent Region is required for every City Hub.'
      };
    }
    const destination = this.getDestinationById(destinationId, true);
    if (!destination) {
      return {
        valid: false,
        code: 'INVALID_DESTINATION',
        error: `Invalid Destination ID "${destinationId}". City Hub must reference an existing Destination.`
      };
    }
    const destRegion = this.getDestinationRegionById(regionId, true);
    if (!destRegion) {
      return {
        valid: false,
        code: 'INVALID_REGION',
        error: `Invalid Region ID "${regionId}". City Hub must reference an existing Region.`
      };
    }
    if (destRegion.destinationId !== destination.id) {
      return {
        valid: false,
        code: 'DESTINATION_REGION_MISMATCH',
        error: `Hierarchy Mismatch: Region "${destRegion.name}" (${destRegion.id}) belongs to Destination "${destRegion.destinationId}", not "${destination.name}" (${destination.id}).`,
        destination,
        destinationRegion: destRegion
      };
    }
    return {
      valid: true,
      destination,
      destinationRegion: destRegion,
      region: this.getRegionById(destRegion.id)
    };
  }

  /**
   * Strict validation of the Geographical Hierarchy:
   * Destination -> Region -> Hub (-> Product)
   *
   * Verifies:
   * 1. Destination exists in destinations.
   * 2. Region exists in regions and belongs to Destination (region.destinationId === destination.id).
   * 3. Hub (and any hubIds) exists in city_hubs and belongs to Destination and Region.
   */
  public validateHierarchy(
    regionId?: string,
    destinationId?: string,
    hubId?: string,
    hubIds?: string[]
  ): HierarchyValidationResult {
    if (!destinationId || !destinationId.trim()) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELDS',
        error: 'Destination is required.'
      };
    }

    const destination = this.getDestinationById(destinationId, true);
    if (!destination) {
      return {
        valid: false,
        code: 'INVALID_DESTINATION',
        error: `Invalid Destination ID "${destinationId}". No Destination exists with this identifier.`
      };
    }

    const allHubIds = Array.from(
      new Set([
        ...(hubId && hubId.trim() ? [hubId.trim()] : []),
        ...(Array.isArray(hubIds) ? hubIds.map(h => (h || '').trim()).filter(Boolean) : [])
      ])
    );

    if (allHubIds.length === 0) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELDS',
        error: 'At least one valid City Hub is required for a product.'
      };
    }

    // Validate all associated hubs first
    const resolvedHubs: CityHub[] = [];
    for (const rawHId of allHubIds) {
      const h = this.getHubById(rawHId, true);
      if (!h) {
        return {
          valid: false,
          code: 'INVALID_HUB',
          error: `Invalid City Hub ID "${rawHId}". No City Hub exists with this identifier.`,
          destination
        };
      }
      if (h.destinationId !== destination.id) {
        return {
          valid: false,
          code: 'HUB_DESTINATION_MISMATCH',
          error: `Hierarchy Mismatch: City Hub "${h.name}" (${h.id}) belongs to Destination "${h.destinationId}", not selected Destination "${destination.name}" (${destination.id}).`,
          destination,
          hub: h
        };
      }
      resolvedHubs.push(h);
    }

    const primaryHub = resolvedHubs[0];

    // Resolve Region: check DestinationRegion first
    let destRegion = regionId ? this.getDestinationRegionById(regionId, true) : undefined;

    // If caller passed a Macro Region (e.g. REG-001) or omitted regionId, only allow if regionId was not an invalid unknown ID
    if (!destRegion && regionId && regionId.trim()) {
      const macroRegion = this.getActiveRegions().find(
        mr => mr.id.toLowerCase() === regionId.trim().toLowerCase() ||
              CANONICAL_LEGACY_MAPPINGS[regionId.trim().toLowerCase()]?.canonicalId === mr.id
      );
      if (macroRegion) {
        if (destination.regionId && destination.regionId !== macroRegion.id) {
          return {
            valid: false,
            code: 'DESTINATION_REGION_MISMATCH',
            error: `Hierarchy Mismatch: Destination "${destination.name}" (${destination.id}) does not belong to Region "${macroRegion.name}" (${macroRegion.id}).`,
            destination
          };
        }
        // Derive the DestinationRegion from the validated primaryHub
        if (primaryHub && primaryHub.regionId) {
          destRegion = this.getDestinationRegionById(primaryHub.regionId, true);
        }
      } else {
        return {
          valid: false,
          code: 'INVALID_REGION',
          error: `Invalid Region ID "${regionId}". No Region exists with this identifier.`,
          destination
        };
      }
    }

    if (!destRegion) {
      return {
        valid: false,
        code: 'MISSING_REQUIRED_FIELDS',
        error: 'A valid Region under the selected Destination is required.',
        destination
      };
    }

    // Verify Region belongs to Destination
    if (destRegion.destinationId !== destination.id) {
      return {
        valid: false,
        code: 'DESTINATION_REGION_MISMATCH',
        error: `Hierarchy Mismatch: Region "${destRegion.name}" (${destRegion.id}) belongs to Destination "${destRegion.destinationId}", not selected Destination "${destination.name}" (${destination.id}).`,
        destination,
        destinationRegion: destRegion
      };
    }

    // Verify primary Hub belongs to the selected Region (for single-hub products, or primary hub of multi-hub products)
    if (primaryHub.regionId && primaryHub.regionId !== destRegion.id) {
      // Check if any of the resolvedHubs belong to destRegion (in case of multi-hub product)
      const matchesAnyHubRegion = resolvedHubs.some(h => h.regionId === destRegion.id);
      if (!matchesAnyHubRegion) {
        return {
          valid: false,
          code: 'HUB_REGION_MISMATCH',
          error: `Hierarchy Mismatch: City Hub "${primaryHub.name}" (${primaryHub.id}) belongs to Region "${primaryHub.regionId}", not selected Region "${destRegion.name}" (${destRegion.id}).`,
          destination,
          destinationRegion: destRegion,
          hub: primaryHub
        };
      }
    }

    return {
      valid: true,
      destination,
      destinationRegion: destRegion,
      region: this.getRegionById(destRegion.id),
      hub: primaryHub
    };
  }

  // ----------------------------------------------------
  // 6. PRODUCT & SYSTEM GEOGRAPHICAL AUDIT (Section 16.G & Section 17)
  // ----------------------------------------------------

  /**
   * Audits an existing product's stored destination, region, and hub relationships.
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
    const destId = (product.destinationId || '').trim();
    const regId = (product.regionId || '').trim();
    const hubId = (product.hubId || '').trim();
    const hubIds = Array.isArray(product.hubIds) && product.hubIds.length > 0
      ? product.hubIds
      : (hubId ? [hubId] : []);

    const resolvedDest = destId ? this.getDestinationById(destId, true) : undefined;
    const resolvedReg = regId ? this.getDestinationRegionById(regId, true) : undefined;
    const resolvedPrimaryHub = hubId ? this.getHubById(hubId, true) : (hubIds[0] ? this.getHubById(hubIds[0], true) : undefined);

    let isLegacyMappingApplicable = false;

    if (!destId) {
      issues.push('Missing destinationId');
    } else if (!resolvedDest) {
      issues.push(`Nonexistent destinationId: "${destId}"`);
    } else if (destId !== resolvedDest.id) {
      isLegacyMappingApplicable = true;
    }

    if (!regId) {
      issues.push('Missing regionId');
    } else if (!resolvedReg) {
      issues.push(`Nonexistent regionId: "${regId}"`);
    } else if (resolvedDest && resolvedReg.destinationId !== resolvedDest.id) {
      issues.push(`Region "${resolvedReg.name}" (${resolvedReg.id}) belongs to destination "${resolvedReg.destinationId}", not "${resolvedDest.id}"`);
    }

    if (hubIds.length === 0) {
      issues.push('Missing hubId / hubIds');
    } else {
      for (const hId of hubIds) {
        const resolvedH = this.getHubById(hId, true);
        if (!resolvedH) {
          issues.push(`Nonexistent hubId: "${hId}"`);
        } else {
          if (hId !== resolvedH.id) {
            isLegacyMappingApplicable = true;
          }
          if (resolvedDest && resolvedH.destinationId !== resolvedDest.id) {
            issues.push(`Hub "${resolvedH.name}" (${resolvedH.id}) belongs to destination "${resolvedH.destinationId}", not "${resolvedDest.id}"`);
          }
          if (hubIds.length === 1 && resolvedReg && resolvedH.regionId !== resolvedReg.id) {
            issues.push(`Hub "${resolvedH.name}" (${resolvedH.id}) belongs to region "${resolvedH.regionId}", not "${resolvedReg.id}"`);
          }
        }
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      isLegacyMappingApplicable,
      canonicalRegionId: resolvedReg?.id || resolvedPrimaryHub?.regionId,
      canonicalDestinationId: resolvedDest?.id,
      canonicalHubId: resolvedPrimaryHub?.id
    };
  }

  /**
   * Performs a comprehensive audit of all Destinations, Regions, Hubs, and Products.
   */
  public auditAllGeographicalRelationships(): GeographicalAuditReport {
    const db = AppDatabase.getInstance();
    const rawDestinations = db.getDestinations();
    const rawRegions = db.getRegions();
    const rawHubs = db.getCityHubs();
    const rawProducts = db.getProducts();

    const duplicateDestinations: GeographicalAuditReport['duplicateDestinations'] = [];
    const seenDestNames = new Map<string, string>();
    const validDestIds = new Set<string>();

    for (const d of rawDestinations) {
      if (!d || (d as any).status === 'DELETED') continue;
      validDestIds.add(d.id);
      const key = (d.name || '').trim().toLowerCase();
      if (key && seenDestNames.has(key)) {
        duplicateDestinations.push({ id: d.id, name: d.name, duplicateOf: seenDestNames.get(key)! });
      } else if (key) {
        seenDestNames.set(key, d.id);
      }
    }

    const orphanedRegions: GeographicalAuditReport['orphanedRegions'] = [];
    const validRegionsMap = new Map<string, DestinationRegionItem>();
    for (const r of rawRegions) {
      if (!r || (r as any).status === 'DELETED') continue;
      if (!r.destinationId || !validDestIds.has(r.destinationId)) {
        orphanedRegions.push({
          id: r.id,
          name: r.name,
          destinationId: r.destinationId || '',
          reason: !r.destinationId ? 'Missing destinationId' : `References nonexistent destinationId "${r.destinationId}"`
        });
      } else {
        validRegionsMap.set(r.id, r);
      }
    }

    const orphanedHubs: GeographicalAuditReport['orphanedHubs'] = [];
    for (const h of rawHubs) {
      if (!h || (h as any).status === 'DELETED') continue;
      if (!h.destinationId || !validDestIds.has(h.destinationId)) {
        orphanedHubs.push({
          id: h.id,
          name: h.name,
          destinationId: h.destinationId || '',
          regionId: h.regionId,
          reason: !h.destinationId ? 'Missing destinationId' : `References nonexistent destinationId "${h.destinationId}"`
        });
      } else if (!h.regionId || !validRegionsMap.has(h.regionId)) {
        orphanedHubs.push({
          id: h.id,
          name: h.name,
          destinationId: h.destinationId,
          regionId: h.regionId,
          reason: !h.regionId ? 'Missing regionId' : `References nonexistent regionId "${h.regionId}"`
        });
      } else {
        const parentReg = validRegionsMap.get(h.regionId)!;
        if (parentReg.destinationId !== h.destinationId) {
          orphanedHubs.push({
            id: h.id,
            name: h.name,
            destinationId: h.destinationId,
            regionId: h.regionId,
            reason: `Region "${parentReg.name}" (${parentReg.id}) belongs to destination "${parentReg.destinationId}", not "${h.destinationId}"`
          });
        }
      }
    }

    const unmappedProducts: GeographicalAuditReport['unmappedProducts'] = [];
    for (const p of rawProducts) {
      if (!p || (p as any).status === 'DELETED') continue;
      const audit = this.auditProductHierarchy(p);
      if (!audit.valid) {
        unmappedProducts.push({
          id: p.id,
          name: p.name,
          sku: p.sku,
          issues: audit.issues
        });
      }
    }

    return {
      valid:
        duplicateDestinations.length === 0 &&
        orphanedRegions.length === 0 &&
        orphanedHubs.length === 0 &&
        unmappedProducts.length === 0,
      duplicateDestinations,
      orphanedRegions,
      orphanedHubs,
      unmappedProducts
    };
  }
}
