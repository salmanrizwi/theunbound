import { MasterSheetTabName, CurrencyCode } from '../types';

export type CanonicalFieldType = 'string' | 'number' | 'boolean' | 'date' | 'enum' | 'array' | 'json';

export interface CanonicalColumnDefinition {
  name: string;
  key: string;
  type: CanonicalFieldType;
  required: boolean;
  sampleValue: string;
  description: string;
  allowedValues?: string[];
  foreignKeyTab?: string;
  foreignKeyColumn?: string;
  entityField?: string;
}

export interface CanonicalRelationshipDefinition {
  sourceField: string;
  targetSchemaId: string;
  targetField: string;
  label: string;
  required: boolean;
}

export interface CanonicalModuleSchema {
  schemaId: string;
  schemaVersion: string;
  module: string;
  entity: string;
  canonicalTabName: string;
  supportedAliases: string[];
  displayName: string;
  description: string;
  hierarchyLevel: number; // 0: Instructions, 1: Master Reference, 2: Primary Inventory
  primaryKey: string;
  firestoreCollection: string;
  columns: CanonicalColumnDefinition[];
  relationships: CanonicalRelationshipDefinition[];
  sampleRows: string[][];
  demoRows: string[][];
}

export class CanonicalSchemaRegistry {
  private static schemas: Map<string, CanonicalModuleSchema> = new Map();

  static {
    CanonicalSchemaRegistry.initializeSchemas();
  }

  private static initializeSchemas() {
    // ----------------------------------------------------
    // 0. INSTRUCTIONS SCHEMA
    // ----------------------------------------------------
    this.registerSchema({
      schemaId: 'instructions',
      schemaVersion: 'v1.0.0',
      module: 'governance',
      entity: 'InstructionRule',
      canonicalTabName: 'INSTRUCTIONS',
      supportedAliases: ['INSTRUCTIONS', 'README', 'INSTRUCTION', 'GUIDELINES', 'README_INSTRUCTIONS'],
      displayName: '0. Instructions & Governance',
      description: 'Master guidelines, permanent ID policies, and data entry rules.',
      hierarchyLevel: 0,
      primaryKey: 'rule_id',
      firestoreCollection: 'system_instructions',
      columns: [
        { name: 'rule_id', key: 'rule_id', type: 'string', required: true, sampleValue: 'RULE-01', description: 'Rule identifier', entityField: 'ruleId' },
        { name: 'category', key: 'category', type: 'string', required: true, sampleValue: 'Hierarchy Rules', description: 'Rule classification', entityField: 'category' },
        { name: 'rule_name', key: 'rule_name', type: 'string', required: true, sampleValue: 'Preset Schema Sync', description: 'Core rule name', entityField: 'ruleName' },
        { name: 'guidance', key: 'guidance', type: 'string', required: true, sampleValue: 'Use module presets to synchronize specific inventory domains safely.', description: 'Detailed guidance text', entityField: 'guidance' }
      ],
      relationships: [],
      sampleRows: [
        ['RULE-01', 'Schema Architecture', 'Dynamic Module Presets', 'Select the specific module preset for your workbook. No fixed 25-tab layout is assumed.'],
        ['RULE-02', 'Permanent ID Policy', 'Stable Unique Keys', 'Never use display names as keys. Always use permanent IDs (e.g. DST-JPN, HUB-TOKYO, SUP001, PROD-001, HTL-001).'],
        ['RULE-03', 'Pricing Engine Integrity', 'Native Currency & Nett Rates', 'Enter native currency and supplier_nett. B2B rates and client pricing are calculated dynamically.']
      ],
      demoRows: [
        ['DEMO-01', 'Demo Rule', 'DEMO ONLY - Instructions Demo', 'This is a sample demonstration instruction for schema verification.']
      ]
    });

    // ----------------------------------------------------
    // 1. MASTER DATA SCHEMA (Reference Entities)
    // ----------------------------------------------------
    this.registerSchema({
      schemaId: 'master_data',
      schemaVersion: 'v1.0.0',
      module: 'master_data',
      entity: 'MasterReferenceEntity',
      canonicalTabName: 'MASTER_DATA',
      supportedAliases: ['MASTER_DATA', 'MASTERDATA', 'MASTER DATA', 'REFERENCES', 'MASTER_ENTITIES'],
      displayName: '1. Master Reference Data',
      description: 'Canonical reference layer for Regions, Destinations, Hubs, Suppliers, and Rail Stations.',
      hierarchyLevel: 1,
      primaryKey: 'entity_id',
      firestoreCollection: 'master_entities',
      columns: [
        { name: 'entity_type', key: 'entity_type', type: 'enum', required: true, sampleValue: 'destination', description: 'Entity classification', allowedValues: ['region', 'destination', 'hub', 'supplier', 'station'], entityField: 'entityType' },
        { name: 'entity_id', key: 'entity_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Unique permanent entity ID', entityField: 'entityId' },
        { name: 'code', key: 'code', type: 'string', required: true, sampleValue: 'TYO', description: 'Short code or slug', entityField: 'code' },
        { name: 'name', key: 'name', type: 'string', required: true, sampleValue: 'Japan', description: 'Canonical display name', entityField: 'name' },
        { name: 'parent_id', key: 'parent_id', type: 'string', required: false, sampleValue: 'REG-001', description: 'Parent entity ID (e.g. region for destination, destination for hub)', entityField: 'parentId' },
        { name: 'country', key: 'country', type: 'string', required: false, sampleValue: 'Japan', description: 'Sovereign country name', entityField: 'country' },
        { name: 'currency', key: 'currency', type: 'enum', required: false, sampleValue: 'JPY', description: 'Operating native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'], entityField: 'currency' },
        { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'], entityField: 'status' },
        { name: 'description', key: 'description', type: 'string', required: false, sampleValue: 'Master destination operations.', description: 'Overview description', entityField: 'description' }
      ],
      relationships: [
        { sourceField: 'parent_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Parent Entity', required: false }
      ],
      sampleRows: [
        ['region', 'REG-001', 'EAST-ASIA', 'East Asia', '', 'Japan', 'JPY', 'ACTIVE', 'East Asia Macro Region.'],
        ['destination', 'DST-JPN', 'TYO', 'Japan', 'REG-001', 'Japan', 'JPY', 'ACTIVE', 'Japan Ground Operations.'],
        ['hub', 'HUB-TOKYO', 'TOKYO', 'Tokyo', 'DST-JPN', 'Japan', 'JPY', 'ACTIVE', 'Greater Tokyo Capital Hub.'],
        ['hub', 'HUB-KYOTO', 'KYOTO', 'Kyoto', 'DST-JPN', 'Japan', 'JPY', 'ACTIVE', 'Kyoto Cultural Hub.'],
        ['supplier', 'SUP001', 'SUP-JAPAN-DMC', 'TheUnbound Japan Ground Operations', 'DST-JPN', 'Japan', 'JPY', 'ACTIVE', 'Licensed DMC Ground Operator.'],
        ['station', 'STN-TOKYO', 'TYO-STN', 'Tokyo Station', 'HUB-TOKYO', 'Japan', 'JPY', 'ACTIVE', 'Central Shinkansen Terminal Tokyo.'],
        ['station', 'STN-OSAKA', 'OSA-STN', 'Shin-Osaka Station', 'HUB-KYOTO', 'Japan', 'JPY', 'ACTIVE', 'Kansai Shinkansen Terminal Osaka.']
      ],
      demoRows: [
        ['destination', 'DEMO-DST-001', 'DEMO-DST', 'DEMO ONLY - Sample Destination', 'REG-001', 'Japan', 'JPY', 'ACTIVE', 'Demonstration destination record.']
      ]
    });

    // ----------------------------------------------------
    // 2. PRODUCTS SCHEMA (Core Products Catalog)
    // ----------------------------------------------------
    this.registerSchema({
      schemaId: 'products_catalog',
      schemaVersion: 'v1.0.0',
      module: 'products',
      entity: 'Product',
      canonicalTabName: 'PRODUCTS',
      supportedAliases: ['PRODUCTS', 'PRODUCTS_CATALOG', 'PRODUCT_CATALOG', 'PRODUCTS CATALOG', 'PRODUCT', 'TOURS_AND_ACTIVITIES'],
      displayName: '2. Products Catalog',
      description: 'Single-row canonical products catalog (Private Tours, Group Tours, Tickets, Transfers, Guides, Restaurants, Private Yachts).',
      hierarchyLevel: 2,
      primaryKey: 'product_id',
      firestoreCollection: 'products',
      columns: [
        { name: 'product_id', key: 'product_id', type: 'string', required: true, sampleValue: 'PROD-001', description: 'Unique permanent Product ID', entityField: 'id' },
        { name: 'product_code', key: 'product_code', type: 'string', required: true, sampleValue: 'PRD-TYO-001', description: 'Short product reference code', entityField: 'productCode' },
        { name: 'product_name', key: 'product_name', type: 'string', required: true, sampleValue: 'Tokyo Private Highlights & Tea Ceremony', description: 'Official product title', entityField: 'name' },
        { name: 'category', key: 'category', type: 'enum', required: true, sampleValue: 'Private Tour', description: 'Product Category', allowedValues: ['Private Tour', 'Group Tour', 'Ticket', 'Transfer', 'Guide', 'Restaurant', 'Private Yacht', 'Ferry', 'Ferries'], entityField: 'category' },
        { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Parent Region ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'regionId' },
        { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Parent Destination ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'destinationId' },
        { name: 'hub_id', key: 'hub_id', type: 'string', required: true, sampleValue: 'HUB-TOKYO', description: 'Parent Hub ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'cityHubId' },
        { name: 'supplier_id', key: 'supplier_id', type: 'string', required: true, sampleValue: 'SUP001', description: 'Supplier ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'supplierId' },
        { name: 'short_description', key: 'short_description', type: 'string', required: false, sampleValue: 'Full-day chauffeured tour with licensed guide.', description: 'Brief summary', entityField: 'shortDescription' },
        { name: 'description', key: 'description', type: 'string', required: false, sampleValue: 'Explore Meiji Shrine, Tsukiji, and authentic tea ceremony.', description: 'Detailed description', entityField: 'description' },
        { name: 'inclusions', key: 'inclusions', type: 'string', required: false, sampleValue: 'Private Chauffeured Alphard|Licensed Guide|Tea Ceremony Entrance', description: 'Pipe-separated inclusions', entityField: 'inclusions' },
        { name: 'exclusions', key: 'exclusions', type: 'string', required: false, sampleValue: 'Personal Purchases|Lunch', description: 'Pipe-separated exclusions', entityField: 'exclusions' },
        { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Native supplier currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'], entityField: 'currency' },
        { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '66000', description: 'Confidential net cost in native currency', entityField: 'costPrice' },
        { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'marginType' },
        { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '15', description: 'B2B margin percentage or fixed value', entityField: 'margin' },
        { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'taxType' },
        { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax percentage', entityField: 'tax' },
        { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'serviceFeeType' },
        { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '0', description: 'Service fee amount', entityField: 'serviceFee' },
        { name: 'capacity_or_unit_rule', key: 'capacity_or_unit_rule', type: 'string', required: false, sampleValue: '1-6 Pax per Vehicle', description: 'Capacity or unit rule', entityField: 'capacityRule' },
        { name: 'upsell_product_ids', key: 'upsell_product_ids', type: 'string', required: false, sampleValue: 'PROD-002|PROD-003', description: 'Pipe-separated recommended upsell product IDs', entityField: 'upsellProductIds' },
        { name: 'capacity_tiers_json', key: 'capacity_tiers_json', type: 'string', required: false, sampleValue: '[{"minPassengers":1,"maxPassengers":3,"vehicleId":"VEH-ALPHARD","supplierNett":50000},{"minPassengers":4,"maxPassengers":6,"vehicleId":"VEH-ALPHARD","supplierNett":66000}]', description: 'JSON capacity tiers', entityField: 'capacityTiers' },
        { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'], entityField: 'status' },
        { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)', entityField: 'effectiveFrom' },
        { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)', entityField: 'effectiveTo' }
      ],
      relationships: [
        { sourceField: 'region_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Region Reference', required: true },
        { sourceField: 'destination_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Destination Reference', required: true },
        { sourceField: 'hub_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Hub Reference', required: true },
        { sourceField: 'supplier_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Supplier Reference', required: true }
      ],
      sampleRows: [
        ['PROD-001', 'PRD-TYO-001', 'Tokyo Private Highlights & Tea Ceremony', 'Private Tour', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', 'Full-day chauffeured tour with licensed guide.', 'Explore Meiji Shrine, Tsukiji Outer Market, and Asakusa private tea house.', 'Private Alphard|Licensed English Guide|Tea Ceremony Entrance', 'Personal Purchases|Lunch', 'JPY', '66000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', '1-6 Pax per Vehicle', 'PROD-002', '[{"minPassengers":1,"maxPassengers":3,"vehicleId":"VEH-ALPHARD","supplierNett":50000},{"minPassengers":4,"maxPassengers":6,"vehicleId":"VEH-ALPHARD","supplierNett":66000}]', 'ACTIVE', '2026-01-01', '2026-12-31'],
        ['PROD-002', 'PRD-TYO-TRF', 'Tokyo Haneda Airport Private Alphard Transfer', 'Transfer', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', 'VIP Private Haneda Airport Arrival & Hotel Transfer.', 'Chauffeured Toyota Alphard transfer directly from Haneda Airport to central Tokyo hotel.', 'Toyota Alphard|60 Mins Flight Delay Buffer|Driver Meet & Greet', 'Extra Waiting Time', 'JPY', '28000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', '1-3 Pax + Luggage', '', '[{"minPassengers":1,"maxPassengers":3,"vehicleId":"VEH-ALPHARD","supplierNett":28000}]', 'ACTIVE', '2026-01-01', '2026-12-31']
      ],
      demoRows: [
        ['DEMO-PROD-01', 'DEMO-PRD-01', 'DEMO ONLY - Sample Tour Experience', 'Private Tour', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', 'Demo tour description.', 'Detailed demo itinerary overview.', 'Demo Inclusions', 'Demo Exclusions', 'JPY', '50000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', '1-4 Pax', '', '', 'ACTIVE', '2026-01-01', '2026-12-31']
      ]
    });

    // ----------------------------------------------------
    // 3. HOTELS & ALLOTMENTS SCHEMA
    // ----------------------------------------------------
    this.registerSchema({
      schemaId: 'hotels_allotments',
      schemaVersion: 'v1.0.0',
      module: 'hotels',
      entity: 'Hotel',
      canonicalTabName: 'HOTELS',
      supportedAliases: ['HOTELS', 'HOTEL_ALLOTMENTS', 'HOTELS_AND_ALLOTMENTS', 'HOTELS_ALLOTMENTS', 'HOTEL', 'ACCOMMODATIONS'],
      displayName: '3. Hotels & Accommodations',
      description: 'Single-row canonical hotels catalog with room categories, meal plans, occupancy, and per-night wholesale rates.',
      hierarchyLevel: 2,
      primaryKey: 'hotel_id',
      firestoreCollection: 'hotels',
      columns: [
        { name: 'hotel_id', key: 'hotel_id', type: 'string', required: true, sampleValue: 'HTL-001', description: 'Unique permanent Hotel ID', entityField: 'id' },
        { name: 'hotel_code', key: 'hotel_code', type: 'string', required: true, sampleValue: 'HTL-TYO-AMAN', description: 'Short hotel code', entityField: 'code' },
        { name: 'hotel_name', key: 'hotel_name', type: 'string', required: true, sampleValue: 'Aman Tokyo', description: 'Official hotel property name', entityField: 'name' },
        { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Parent Region ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'regionId' },
        { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Parent Destination ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'destinationId' },
        { name: 'hub_id', key: 'hub_id', type: 'string', required: true, sampleValue: 'HUB-TOKYO', description: 'Parent Hub ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'cityHubId' },
        { name: 'supplier_id', key: 'supplier_id', type: 'string', required: true, sampleValue: 'SUP001', description: 'Supplier ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'supplierId' },
        { name: 'star_rating', key: 'star_rating', type: 'number', required: true, sampleValue: '5', description: 'Property star rating (1 to 5)', entityField: 'starRating' },
        { name: 'address', key: 'address', type: 'string', required: false, sampleValue: 'The Otemachi Tower, 1-5-6 Otemachi, Chiyoda-ku, Tokyo', description: 'Full physical address', entityField: 'address' },
        { name: 'category', key: 'category', type: 'string', required: false, sampleValue: '5-Star Luxury', description: 'Hotel tier or brand category', entityField: 'category' },
        { name: 'room_type', key: 'room_type', type: 'string', required: true, sampleValue: 'Deluxe Suite', description: 'Room category name', entityField: 'roomType' },
        { name: 'meal_plan', key: 'meal_plan', type: 'string', required: false, sampleValue: 'Breakfast Included', description: 'Included meal plan', entityField: 'mealPlan' },
        { name: 'occupancy', key: 'occupancy', type: 'string', required: false, sampleValue: '2 Adults', description: 'Standard max room occupancy', entityField: 'occupancy' },
        { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Contracted native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'], entityField: 'currency' },
        { name: 'supplier_nett_per_night', key: 'supplier_nett_per_night', type: 'number', required: true, sampleValue: '140000', description: 'Confidential net cost per room per night', entityField: 'basePricePerNight' },
        { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'marginType' },
        { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '15', description: 'B2B margin percentage or fixed value', entityField: 'margin' },
        { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'taxType' },
        { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax percentage', entityField: 'tax' },
        { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'serviceFeeType' },
        { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '0', description: 'Service fee amount', entityField: 'serviceFee' },
        { name: 'images', key: 'images', type: 'string', required: false, sampleValue: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200', description: 'Pipe-separated image URLs', entityField: 'images' },
        { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'], entityField: 'status' },
        { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)', entityField: 'effectiveFrom' },
        { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)', entityField: 'effectiveTo' }
      ],
      relationships: [
        { sourceField: 'region_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Region Reference', required: true },
        { sourceField: 'destination_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Destination Reference', required: true },
        { sourceField: 'hub_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Hub Reference', required: true },
        { sourceField: 'supplier_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Supplier Reference', required: true }
      ],
      sampleRows: [
        ['HTL-001', 'HTL-TYO-AMAN', 'Aman Tokyo', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', '5', 'The Otemachi Tower, 1-5-6 Otemachi, Chiyoda-ku, Tokyo', '5-Star Luxury', 'Deluxe Suite', 'Breakfast Included', '2 Adults', 'JPY', '140000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200', 'ACTIVE', '2026-01-01', '2026-12-31']
      ],
      demoRows: [
        ['DEMO-HTL-01', 'DEMO-HTL', 'DEMO ONLY - Sample Luxury Hotel', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', '5', 'Sample Hotel Address, Tokyo', '5-Star Luxury', 'Demo Room', 'Breakfast Included', '2 Adults', 'JPY', '100000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', '', 'ACTIVE', '2026-01-01', '2026-12-31']
      ]
    });

    // ----------------------------------------------------
    // 4. VISA & ANCILLARIES SCHEMA
    // ----------------------------------------------------
    this.registerSchema({
      schemaId: 'visa_ancillaries',
      schemaVersion: 'v1.0.0',
      module: 'visa_ancillaries',
      entity: 'VisaProduct',
      canonicalTabName: 'VISA_ANCILLARY',
      supportedAliases: ['VISA_ANCILLARY', 'VISA_AND_ANCILLARY', 'VISA_ANCILLARIES', 'VISA', 'ANCILLARY', 'VISA_SERVICES'],
      displayName: '4. Visa & Ancillary Services',
      description: 'Single-row canonical services catalog (Visa Assistance, Travel Protection, VIP Ground Services, 5G Connectivity).',
      hierarchyLevel: 2,
      primaryKey: 'service_id',
      firestoreCollection: 'visas',
      columns: [
        { name: 'service_id', key: 'service_id', type: 'string', required: true, sampleValue: 'VSA-JPN-01', description: 'Unique permanent Service ID', entityField: 'id' },
        { name: 'service_code', key: 'service_code', type: 'string', required: true, sampleValue: 'VISA-JAPAN-EVISA', description: 'Short service code', entityField: 'code' },
        { name: 'service_name', key: 'service_name', type: 'string', required: true, sampleValue: 'Japan Tourist eVisa Processing & Facilitation', description: 'Official service title', entityField: 'title' },
        { name: 'service_group', key: 'service_group', type: 'enum', required: true, sampleValue: 'VISA', description: 'Service Group classification', allowedValues: ['VISA', 'TRAVEL_PROTECTION', 'VIP_GROUND', 'CONNECTIVITY'], entityField: 'serviceGroup' },
        { name: 'service_type', key: 'service_type', type: 'string', required: false, sampleValue: 'Tourist Visa', description: 'Specific sub-type or category', entityField: 'visaType' },
        { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Parent Region ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'regionId' },
        { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Parent Destination ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'destinationId' },
        { name: 'hub_id', key: 'hub_id', type: 'string', required: false, sampleValue: 'HUB-TOKYO', description: 'Parent Hub ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'cityHubId' },
        { name: 'supplier_id', key: 'supplier_id', type: 'string', required: true, sampleValue: 'SUP001', description: 'Supplier ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'supplierId' },
        { name: 'coverage_or_scope', key: 'coverage_or_scope', type: 'string', required: false, sampleValue: 'Single Entry Tourist Visa (up to 90 Days)', description: 'Coverage, scope, or plan parameters', entityField: 'coverage' },
        { name: 'requirements_summary', key: 'requirements_summary', type: 'string', required: false, sampleValue: 'Valid Passport (6+ Months)|Passport Photo|Flight Reservation', description: 'Pipe-separated document checklist', entityField: 'requirements' },
        { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'USD', description: 'Native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'], entityField: 'currency' },
        { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '35', description: 'Confidential net cost', entityField: 'costPrice' },
        { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'marginType' },
        { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '15', description: 'B2B margin percentage or fixed value', entityField: 'margin' },
        { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'taxType' },
        { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '0', description: 'Tax percentage', entityField: 'tax' },
        { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'serviceFeeType' },
        { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '5', description: 'Service fee amount', entityField: 'serviceFee' },
        { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'], entityField: 'status' },
        { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)', entityField: 'effectiveFrom' },
        { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)', entityField: 'effectiveTo' }
      ],
      relationships: [
        { sourceField: 'region_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Region Reference', required: true },
        { sourceField: 'destination_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Destination Reference', required: true },
        { sourceField: 'supplier_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Supplier Reference', required: true }
      ],
      sampleRows: [
        ['VSA-JPN-01', 'VISA-JAPAN-EVISA', 'Japan Tourist eVisa Processing & Facilitation', 'VISA', 'Tourist Visa', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', 'Single Entry Tourist Visa (up to 90 Days)', 'Valid Passport (6+ Months)|Passport Photo|Flight Reservation', 'USD', '35', 'PERCENTAGE', '15', 'PERCENTAGE', '0', 'FIXED', '5', 'ACTIVE', '2026-01-01', '2026-12-31'],
        ['ANC-INS-01', 'INS-GOLD-GLOBAL', 'Comprehensive Travel Protection & Medical Gold Plan', 'TRAVEL_PROTECTION', 'Medical & Trip Insurance', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', '$50,000 Emergency Medical + $100,000 Evacuation + Trip Cancellation', 'Age 1-75 Years|World-wide Coverage', 'USD', '25', 'PERCENTAGE', '20', 'PERCENTAGE', '0', 'FIXED', '0', 'ACTIVE', '2026-01-01', '2026-12-31'],
        ['ANC-ESIM-01', 'ESIM-JPN-15D', 'Japan 15-Day Unlimited 5G eSIM', 'CONNECTIVITY', 'eSIM Data Plan', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', '15 Days Unlimited High-Speed 5G Data across Japan (SoftBank/NTT Docomo)', 'eSIM Compatible Smartphone', 'USD', '18', 'PERCENTAGE', '20', 'PERCENTAGE', '0', 'FIXED', '0', 'ACTIVE', '2026-01-01', '2026-12-31']
      ],
      demoRows: [
        ['DEMO-VSA-01', 'DEMO-VISA', 'DEMO ONLY - Sample Visa Service', 'VISA', 'Tourist Visa', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', 'Demo Visa Scope', 'Demo Checklist', 'USD', '30', 'PERCENTAGE', '15', 'PERCENTAGE', '0', 'FIXED', '0', 'ACTIVE', '2026-01-01', '2026-12-31']
      ]
    });

    // ----------------------------------------------------
    // 5. JAPAN RAIL DYNAMIC SCHEMA
    // ----------------------------------------------------
    this.registerSchema({
      schemaId: 'japan_rail_dynamic',
      schemaVersion: 'v1.0.0',
      module: 'rail',
      entity: 'RailJourney',
      canonicalTabName: 'RAIL',
      supportedAliases: ['RAIL', 'JAPAN_RAIL_DYNAMIC', 'JAPAN_RAIL', 'SHINKANSEN', 'RAILS', 'RAIL_JOURNEYS'],
      displayName: '5. Japan Rail Dynamic',
      description: 'Single-row Shinkansen routes, services, and commercial product fares (Ordinary Reserved & Green Reserved).',
      hierarchyLevel: 2,
      primaryKey: 'rail_id',
      firestoreCollection: 'rail_rates',
      columns: [
        { name: 'rail_id', key: 'rail_id', type: 'string', required: true, sampleValue: 'RAIL-TYO-KIX-01', description: 'Unique permanent Rail ID', entityField: 'id' },
        { name: 'route_code', key: 'route_code', type: 'string', required: true, sampleValue: 'TKA-TYO-OSA', description: 'Route code', entityField: 'routeCode' },
        { name: 'route_name', key: 'route_name', type: 'string', required: true, sampleValue: 'Tokaido Shinkansen (Tokyo to Shin-Osaka)', description: 'Route display title', entityField: 'routeName' },
        { name: 'origin_station_id', key: 'origin_station_id', type: 'string', required: true, sampleValue: 'STN-TOKYO', description: 'Origin Station ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'originStationId' },
        { name: 'origin_station_name', key: 'origin_station_name', type: 'string', required: true, sampleValue: 'Tokyo Station', description: 'Origin Station display name', entityField: 'originStationName' },
        { name: 'destination_station_id', key: 'destination_station_id', type: 'string', required: true, sampleValue: 'STN-OSAKA', description: 'Destination Station ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'destinationStationId' },
        { name: 'destination_station_name', key: 'destination_station_name', type: 'string', required: true, sampleValue: 'Shin-Osaka Station', description: 'Destination Station display name', entityField: 'destinationStationName' },
        { name: 'commercial_product', key: 'commercial_product', type: 'enum', required: true, sampleValue: 'GREEN_RESERVED', description: 'Authoritative commercial master product type', allowedValues: ['ORDINARY_RESERVED', 'GREEN_RESERVED'], entityField: 'commercialProduct' },
        { name: 'service_name', key: 'service_name', type: 'string', required: false, sampleValue: 'Nozomi Shinkansen Express', description: 'Express train service name', entityField: 'serviceName' },
        { name: 'travel_class', key: 'travel_class', type: 'string', required: false, sampleValue: 'Green Car Reserved', description: 'Class description', entityField: 'travelClass' },
        { name: 'duration_minutes', key: 'duration_minutes', type: 'number', required: false, sampleValue: '150', description: 'Journey duration in minutes', entityField: 'durationMinutes' },
        { name: 'passenger_type', key: 'passenger_type', type: 'string', required: false, sampleValue: 'Adult', description: 'Passenger tier (Adult / Child)', entityField: 'passengerType' },
        { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'], entityField: 'currency' },
        { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '14720', description: 'Confidential net supplier cost in JPY', entityField: 'supplierNett' },
        { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'marginType' },
        { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '10', description: 'B2B margin percentage or fixed value', entityField: 'margin' },
        { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'taxType' },
        { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax percentage', entityField: 'tax' },
        { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'serviceFeeType' },
        { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '0', description: 'Service fee amount', entityField: 'serviceFee' },
        { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'], entityField: 'status' }
      ],
      relationships: [
        { sourceField: 'origin_station_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Origin Station Reference', required: true },
        { sourceField: 'destination_station_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Destination Station Reference', required: true }
      ],
      sampleRows: [
        ['RAIL-TYO-KIX-01', 'TKA-TYO-OSA', 'Tokaido Shinkansen (Tokyo to Shin-Osaka)', 'STN-TOKYO', 'Tokyo Station', 'STN-OSAKA', 'Shin-Osaka Station', 'GREEN_RESERVED', 'Nozomi Express', 'Green Car Reserved', '150', 'Adult', 'JPY', '19270', 'PERCENTAGE', '10', 'PERCENTAGE', '10', 'FIXED', '0', 'ACTIVE'],
        ['RAIL-TYO-KIX-02', 'TKA-TYO-OSA', 'Tokaido Shinkansen (Tokyo to Shin-Osaka)', 'STN-TOKYO', 'Tokyo Station', 'STN-OSAKA', 'Shin-Osaka Station', 'ORDINARY_RESERVED', 'Nozomi Express', 'Ordinary Reserved', '150', 'Adult', 'JPY', '14720', 'PERCENTAGE', '10', 'PERCENTAGE', '10', 'FIXED', '0', 'ACTIVE']
      ],
      demoRows: [
        ['DEMO-RAIL-01', 'DEMO-ROUT-01', 'DEMO ONLY - Sample Rail Route', 'STN-TOKYO', 'Tokyo Station', 'STN-OSAKA', 'Shin-Osaka Station', 'ORDINARY_RESERVED', 'Demo Express', 'Ordinary Reserved', '120', 'Adult', 'JPY', '12000', 'PERCENTAGE', '10', 'PERCENTAGE', '10', 'FIXED', '0', 'ACTIVE']
      ]
    });

    // ----------------------------------------------------
    // 6. PACKAGES SCHEMA (Curated Wholesale Itineraries)
    // ----------------------------------------------------
    this.registerSchema({
      schemaId: 'packages_catalog',
      schemaVersion: 'v1.0.0',
      module: 'packages',
      entity: 'B2BPackage',
      canonicalTabName: 'PACKAGES',
      supportedAliases: ['PACKAGES', 'PACKAGE_CATALOG', 'PACKAGES_CATALOG', 'ITINERARIES', 'PACKAGE'],
      displayName: '6. Packages Catalog',
      description: 'Single-row canonical packages linking products, hotels, and hubs into complete wholesale itineraries.',
      hierarchyLevel: 2,
      primaryKey: 'package_id',
      firestoreCollection: 'packages',
      columns: [
        { name: 'package_id', key: 'package_id', type: 'string', required: true, sampleValue: 'PKG-JPN-01', description: 'Unique permanent Package ID', entityField: 'id' },
        { name: 'package_code', key: 'package_code', type: 'string', required: true, sampleValue: 'PKG-TOKYO-KYOTO-7N', description: 'Short reference code', entityField: 'packageCode' },
        { name: 'package_name', key: 'package_name', type: 'string', required: true, sampleValue: 'Classic Golden Route: Tokyo & Kyoto Discovery', description: 'Official package title', entityField: 'title' },
        { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Parent Region ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id', entityField: 'regionId' },
        { name: 'destination_ids', key: 'destination_ids', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Pipe-separated Destination IDs', entityField: 'destinations' },
        { name: 'hub_ids', key: 'hub_ids', type: 'string', required: true, sampleValue: 'HUB-TOKYO|HUB-KYOTO', description: 'Pipe-separated Hub IDs', entityField: 'hubs' },
        { name: 'duration_nights', key: 'duration_nights', type: 'number', required: true, sampleValue: '7', description: 'Total itinerary duration in nights', entityField: 'durationNights' },
        { name: 'summary', key: 'summary', type: 'string', required: false, sampleValue: '7-Night Curated Journey combining luxury, rail, and tours.', description: 'Brief summary', entityField: 'summary' },
        { name: 'included_product_ids', key: 'included_product_ids', type: 'string', required: false, sampleValue: 'PROD-001|PROD-002|PROD-003|RAIL-TYO-KIX-01', description: 'Pipe-separated Product IDs', entityField: 'includedProducts' },
        { name: 'hotel_ids', key: 'hotel_ids', type: 'string', required: false, sampleValue: 'HTL-001|HTL-002', description: 'Pipe-separated Hotel IDs', entityField: 'includedHotels' },
        { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'], entityField: 'currency' },
        { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '450000', description: 'Confidential net cost per person', entityField: 'costPrice' },
        { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'marginType' },
        { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '15', description: 'B2B margin percentage or fixed value', entityField: 'margin' },
        { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'taxType' },
        { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax percentage', entityField: 'tax' },
        { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'], entityField: 'serviceFeeType' },
        { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '0', description: 'Service fee amount', entityField: 'serviceFee' },
        { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'], entityField: 'status' },
        { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)', entityField: 'effectiveFrom' },
        { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)', entityField: 'effectiveTo' }
      ],
      relationships: [
        { sourceField: 'region_id', targetSchemaId: 'master_data', targetField: 'entity_id', label: 'Region Reference', required: true }
      ],
      sampleRows: [
        ['PKG-JPN-01', 'PKG-TOKYO-KYOTO-7N', 'Classic Golden Route: Tokyo & Kyoto Luxury Discovery', 'REG-001', 'DST-JPN', 'HUB-TOKYO|HUB-KYOTO', '7', '7-Night Curated Journey combining 5-Star luxury, Shinkansen Green Car transfers, and private guided touring.', 'PROD-001|PROD-002|PROD-003|RAIL-TYO-KIX-01', 'HTL-001|HTL-002', 'JPY', '450000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', 'ACTIVE', '2026-01-01', '2026-12-31']
      ],
      demoRows: [
        ['DEMO-PKG-01', 'DEMO-PKG', 'DEMO ONLY - Sample Package Itinerary', 'REG-001', 'DST-JPN', 'HUB-TOKYO', '5', 'Demo package description.', '', '', 'JPY', '300000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', 'ACTIVE', '2026-01-01', '2026-12-31']
      ]
    });
  }

  public static registerSchema(schema: CanonicalModuleSchema): void {
    this.schemas.set(schema.schemaId, schema);
  }

  public static getSchema(schemaId: string): CanonicalModuleSchema | undefined {
    return this.schemas.get(schemaId);
  }

  public static getAllSchemas(): CanonicalModuleSchema[] {
    return Array.from(this.schemas.values()).sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);
  }

  /**
   * Find a schema that matches a sheet tab name by canonical name or alias.
   */
  public static findSchemaBySheetName(sheetName: string): CanonicalModuleSchema | undefined {
    const rawClean = sheetName.trim();
    const normalized = rawClean.toUpperCase().replace(/[\s_-]+/g, '_');

    for (const schema of this.schemas.values()) {
      if (schema.canonicalTabName === normalized || schema.schemaId === normalized.toLowerCase()) {
        return schema;
      }
      for (const alias of schema.supportedAliases) {
        const normAlias = alias.trim().toUpperCase().replace(/[\s_-]+/g, '_');
        if (normAlias === normalized || rawClean.toLowerCase() === alias.toLowerCase()) {
          return schema;
        }
      }
    }
    return undefined;
  }
}
