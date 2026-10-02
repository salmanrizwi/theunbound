import { DynamicModulePresetId } from '../types';
import { CanonicalSchemaRegistry, CanonicalModuleSchema } from './canonicalSchemaRegistry';

export type ModulePresetId = DynamicModulePresetId;

export interface ModulePresetDefinition {
  id: DynamicModulePresetId;
  name: string;
  shortName: string;
  description: string;
  schemaVersion: string;
  moduleType: 'ALL' | 'PRODUCTS' | 'HOTELS' | 'VISA' | 'RAIL';
  requiredSchemaIds: string[];
  optionalSchemaIds: string[];
  icon: string;
  themeColor: string;
  badgeText: string;
  relationshipsSummary: string[];
  syncStrategy: {
    safeUpsert: boolean;
    dependencyResolution: boolean;
    recalculateCounts: boolean;
    supportsIncremental: boolean;
  };
}

export class ModulePresetRegistry {
  private static presets: Map<DynamicModulePresetId, ModulePresetDefinition> = new Map();

  static {
    ModulePresetRegistry.initializePresets();
  }

  private static initializePresets() {
    // ----------------------------------------------------
    // 1. ALL CANONICAL PRESET
    // ----------------------------------------------------
    this.registerPreset({
      id: 'all_canonical',
      name: 'All Canonical Modules',
      shortName: 'All Canonical',
      description: 'Synchronizes all registered canonical modules across TheUnbound (Products, Hotels, Visa/Ancillaries, Japan Rail Dynamic, Packages, and Master Data).',
      schemaVersion: 'v1.0.0',
      moduleType: 'ALL',
      requiredSchemaIds: [
        'master_data',
        'products_catalog',
        'hotels_allotments',
        'visa_ancillaries',
        'japan_rail_dynamic',
        'packages_catalog'
      ],
      optionalSchemaIds: ['instructions'],
      icon: 'Layers',
      themeColor: '#00C6A6',
      badgeText: 'Full Suite',
      relationshipsSummary: [
        'Master Reference -> Products & Hotels',
        'Master Reference -> Rail Stations & Routes',
        'Master Reference -> Visa & Ancillaries',
        'Products & Hotels -> Packages'
      ],
      syncStrategy: {
        safeUpsert: true,
        dependencyResolution: true,
        recalculateCounts: true,
        supportsIncremental: true
      }
    });

    // ----------------------------------------------------
    // 2. PRODUCTS CATALOG PRESET
    // ----------------------------------------------------
    this.registerPreset({
      id: 'products_catalog',
      name: 'Products Catalog',
      shortName: 'Products',
      description: 'Synchronize the complete single-row canonical Product Catalog (Private Tours, Group Tours, Tickets, Transfers, Guides, Restaurants, Private Yachts, and Tiered Capacity Pricing).',
      schemaVersion: 'v1.0.0',
      moduleType: 'PRODUCTS',
      requiredSchemaIds: ['products_catalog'],
      optionalSchemaIds: ['master_data', 'instructions'],
      icon: 'Compass',
      themeColor: '#3B82F6',
      badgeText: 'Inventory',
      relationshipsSummary: [
        'Products -> Region, Destination, Hub (Master Data)',
        'Products -> Supplier (Master Data)',
        'Products -> Recommended Upsells'
      ],
      syncStrategy: {
        safeUpsert: true,
        dependencyResolution: true,
        recalculateCounts: true,
        supportsIncremental: true
      }
    });

    // ----------------------------------------------------
    // 3. HOTELS & ALLOTMENTS PRESET
    // ----------------------------------------------------
    this.registerPreset({
      id: 'hotels_allotments',
      name: 'Hotels & Allotments',
      shortName: 'Hotels',
      description: 'Synchronize the complete hotel inventory, room categories, meal plans, occupancy rules, native currencies, and per-night wholesale rates.',
      schemaVersion: 'v1.0.0',
      moduleType: 'HOTELS',
      requiredSchemaIds: ['hotels_allotments'],
      optionalSchemaIds: ['master_data', 'instructions'],
      icon: 'Hotel',
      themeColor: '#8B5CF6',
      badgeText: 'Accommodations',
      relationshipsSummary: [
        'Hotels -> Destination & Hub (Master Data)',
        'Hotels -> Supplier (Master Data)',
        'Hotels -> Room Types & Meal Plans'
      ],
      syncStrategy: {
        safeUpsert: true,
        dependencyResolution: true,
        recalculateCounts: true,
        supportsIncremental: true
      }
    });

    // ----------------------------------------------------
    // 4. VISA & ANCILLARIES PRESET
    // ----------------------------------------------------
    this.registerPreset({
      id: 'visa_ancillaries',
      name: 'Visa & Ancillaries',
      shortName: 'Visa & Ancillaries',
      description: 'Synchronize canonical Visa Services, Travel Protection & Medical Coverage, VIP Ground Services, and 5G Connectivity plans.',
      schemaVersion: 'v1.0.0',
      moduleType: 'VISA',
      requiredSchemaIds: ['visa_ancillaries'],
      optionalSchemaIds: ['master_data', 'instructions'],
      icon: 'ShieldCheck',
      themeColor: '#F59E0B',
      badgeText: 'Services',
      relationshipsSummary: [
        'Visa -> Destination & Supplier',
        'Ancillaries -> Service Groups (VIP Ground, Travel Protection, 5G Connectivity)'
      ],
      syncStrategy: {
        safeUpsert: true,
        dependencyResolution: true,
        recalculateCounts: true,
        supportsIncremental: true
      }
    });

    // ----------------------------------------------------
    // 5. JAPAN RAIL DYNAMIC PRESET
    // ----------------------------------------------------
    this.registerPreset({
      id: 'japan_rail_dynamic',
      name: 'Japan Rail Dynamic',
      shortName: 'Japan Rail',
      description: 'Synchronize Shinkansen routes, origin/destination stations, services, and dynamic Commercial Master Products (ORDINARY_RESERVED & GREEN_RESERVED).',
      schemaVersion: 'v1.0.0',
      moduleType: 'RAIL',
      requiredSchemaIds: ['japan_rail_dynamic'],
      optionalSchemaIds: ['master_data', 'instructions'],
      icon: 'Zap',
      themeColor: '#EC4899',
      badgeText: 'Dynamic Rail',
      relationshipsSummary: [
        'Rail Route -> Origin Station & Destination Station (Master Data)',
        'Rail Journey -> Commercial Master Products (Ordinary Reserved & Green Reserved)'
      ],
      syncStrategy: {
        safeUpsert: true,
        dependencyResolution: true,
        recalculateCounts: true,
        supportsIncremental: true
      }
    });
  }

  public static registerPreset(preset: ModulePresetDefinition): void {
    this.presets.set(preset.id, preset);
  }

  public static getPreset(presetId: DynamicModulePresetId): ModulePresetDefinition | undefined {
    return this.presets.get(presetId);
  }

  public static getAllPresets(): ModulePresetDefinition[] {
    return Array.from(this.presets.values());
  }

  /**
   * Returns all canonical schemas needed for this preset (required + optional).
   */
  public static getSchemasForPreset(presetId: DynamicModulePresetId, includeOptional: boolean = true): CanonicalModuleSchema[] {
    const preset = this.getPreset(presetId);
    if (!preset) return CanonicalSchemaRegistry.getAllSchemas();

    const ids = new Set<string>(preset.requiredSchemaIds);
    if (includeOptional) {
      preset.optionalSchemaIds.forEach(id => ids.add(id));
    }

    const result: CanonicalModuleSchema[] = [];
    for (const id of ids) {
      const schema = CanonicalSchemaRegistry.getSchema(id);
      if (schema) result.push(schema);
    }
    return result.sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);
  }
}
