import { MasterSheetTabName } from '../types';
import * as XLSX from 'xlsx';

export interface SheetColumnDefinition {
  name: string;
  key: string;
  type: 'string' | 'number' | 'date' | 'enum' | 'array' | 'boolean';
  required: boolean;
  sampleValue: string;
  description: string;
  allowedValues?: string[];
  foreignKeyTab?: MasterSheetTabName;
  foreignKeyColumn?: string;
}

export interface MasterSheetTabDefinition {
  tabName: MasterSheetTabName;
  displayName: string;
  description: string;
  hierarchyLevel: number; // 0: Instructions, 1: Master Data, 2: Module Primary
  parentTab?: MasterSheetTabName;
  primaryKey: string;
  columns: SheetColumnDefinition[];
  sampleRows: string[][];
}

export const MASTER_SHEETS_TAB_DEFINITIONS: MasterSheetTabDefinition[] = [
  // ----------------------------------------------------
  // 0. INSTRUCTIONS TAB (README)
  // ----------------------------------------------------
  {
    tabName: 'INSTRUCTIONS',
    displayName: '0. README & Instructions',
    description: 'Master guidelines, stable ID policies, allowed category values, and data entry rules.',
    hierarchyLevel: 0,
    primaryKey: 'rule_id',
    columns: [
      { name: 'rule_id', key: 'rule_id', type: 'string', required: true, sampleValue: 'RULE-01', description: 'Instruction ID' },
      { name: 'category', key: 'category', type: 'string', required: true, sampleValue: 'Hierarchy Rules', description: 'Rule classification' },
      { name: 'rule_name', key: 'rule_name', type: 'string', required: true, sampleValue: '5 Canonical Module Tabs', description: 'Core policy' },
      { name: 'guidance', key: 'guidance', type: 'string', required: true, sampleValue: 'Use Products, Hotels, Visa and Ancillary, Rail, and Packages for primary data entry. Master Data contains canonical IDs.', description: 'Detailed guidance for admin data entry' }
    ],
    sampleRows: [
      ['RULE-01', '5 Canonical Module Tabs', 'Simplified Data Entry', 'Use the 5 primary tabs (Products, Hotels, Visa and Ancillary, Rail, Packages) for one-row-per-record business entry.'],
      ['RULE-02', 'Permanent ID Policy', 'Stable Unique Keys', 'Never use display names as relationship keys. Use permanent IDs (e.g. REG-001, DST-JPN, HUB-TOKYO, SUP001, PROD-001, HTL-001).'],
      ['RULE-03', 'Master Reference Data', 'Canonical Reference Layer', 'Add new Regions, Destinations, Hubs, Suppliers, or Stations in the Master Data tab prior to referencing their IDs.'],
      ['RULE-[#00C6A6]', 'Pricing Engine Integrity', 'Native Currency & Nett Rates', 'Enter native currency (e.g. JPY, USD, EUR) and supplier_nett. Final B2B selling prices are calculated dynamically by the Authoritative Pricing Engine.'],
      ['RULE-[#00C6A6]', 'Safe Upsert Behavior', 'No Destructive Deletions', 'Updating a row updates the canonical record in Firestore. Removing a row does not delete historical quotations or bookings.']
    ]
  },

  // ----------------------------------------------------
  // 1. MASTER DATA TAB (Regions, Destinations, Hubs, Suppliers, Stations)
  // ----------------------------------------------------
  {
    tabName: 'MASTER_DATA',
    displayName: '1. Master Data (Reference Entities)',
    description: 'Canonical master reference layer for Regions, Destinations, Hubs, Suppliers, and Rail Stations.',
    hierarchyLevel: 1,
    primaryKey: 'entity_id',
    columns: [
      { name: 'entity_type', key: 'entity_type', type: 'enum', required: true, sampleValue: 'destination', description: 'Entity classification (region, destination, hub, supplier, station)', allowedValues: ['region', 'destination', 'hub', 'supplier', 'station'] },
      { name: 'entity_id', key: 'entity_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Unique permanent ID (e.g. REG-001, DST-JPN, HUB-TOKYO, SUP001, STN-TOKYO)' },
      { name: 'code', key: 'code', type: 'string', required: true, sampleValue: 'TYO', description: 'Short code or slug' },
      { name: 'name', key: 'name', type: 'string', required: true, sampleValue: 'Japan', description: 'Canonical display name' },
      { name: 'parent_id', key: 'parent_id', type: 'string', required: false, sampleValue: 'REG-001', description: 'Parent entity ID (e.g. region_id for destination, destination_id for hub)' },
      { name: 'country', key: 'country', type: 'string', required: false, sampleValue: 'Japan', description: 'Sovereign country name' },
      { name: 'currency', key: 'currency', type: 'enum', required: false, sampleValue: 'JPY', description: 'Operating native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'] },
      { name: 'description', key: 'description', type: 'string', required: false, sampleValue: 'Master destination operational hub.', description: 'Overview text' }
    ],
    sampleRows: [
      ['region', 'REG-001', 'EAST-ASIA', 'East Asia', '', 'Japan', 'JPY', 'ACTIVE', 'Premier East Asia Macro Region.'],
      ['destination', 'DST-JPN', 'TYO', 'Japan', 'REG-001', 'Japan', 'JPY', 'ACTIVE', 'Japan Ground Operations.'],
      ['hub', 'HUB-TOKYO', 'TOKYO', 'Tokyo', 'DST-JPN', 'Japan', 'JPY', 'ACTIVE', 'Greater Tokyo Capital Hub.'],
      ['hub', 'HUB-KYOTO', 'KYOTO', 'Kyoto', 'DST-JPN', 'Japan', 'JPY', 'ACTIVE', 'Kyoto Cultural Hub.'],
      ['supplier', 'SUP001', 'SUP-JAPAN-DMC', 'TheUnbound Japan Ground Operations', 'DST-JPN', 'Japan', 'JPY', 'ACTIVE', 'Licensed DMC In-Destination Ground Operator.'],
      ['station', 'STN-TOKYO', 'TYO-STN', 'Tokyo Station', 'HUB-TOKYO', 'Japan', 'JPY', 'ACTIVE', 'Central Shinkansen Terminal Tokyo.'],
      ['station', 'STN-OSAKA', 'OSA-STN', 'Shin-Osaka Station', 'HUB-KYOTO', 'Japan', 'JPY', 'ACTIVE', 'Kansai Shinkansen Terminal Osaka.']
    ]
  },

  // ----------------------------------------------------
  // 2. PRODUCTS TAB (Products)
  // ----------------------------------------------------
  {
    tabName: 'PRODUCTS',
    displayName: '2. Products (Core Inventory & Services)',
    description: 'Single-row canonical products catalog (Private Tours, Group Tours, Tickets, Transfers, Guides, Restaurants, Private Yachts).',
    hierarchyLevel: 2,
    parentTab: 'MASTER_DATA',
    primaryKey: 'product_id',
    columns: [
      { name: 'product_id', key: 'product_id', type: 'string', required: true, sampleValue: 'PROD-001', description: 'Unique permanent Product ID (e.g. PROD-001, PRD-TYO-001)' },
      { name: 'product_code', key: 'product_code', type: 'string', required: true, sampleValue: 'PRD-TYO-001', description: 'Short product reference code' },
      { name: 'product_name', key: 'product_name', type: 'string', required: true, sampleValue: 'Tokyo Private Highlights & Tea Ceremony', description: 'Official product title' },
      { name: 'category', key: 'category', type: 'enum', required: true, sampleValue: 'Private Tour', description: 'Product Category', allowedValues: ['Private Tour', 'Group Tour', 'Ticket', 'Transfer', 'Guide', 'Restaurant', 'Private Yacht'] },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Parent Region ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Parent Destination ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'hub_id', key: 'hub_id', type: 'string', required: true, sampleValue: 'HUB-TOKYO', description: 'Parent Hub ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'supplier_id', key: 'supplier_id', type: 'string', required: true, sampleValue: 'SUP001', description: 'Supplier ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'short_description', key: 'short_description', type: 'string', required: false, sampleValue: 'Full-day private chauffeured tour with licensed English guide and tea ceremony.', description: 'Brief summary' },
      { name: 'description', key: 'description', type: 'string', required: false, sampleValue: 'Explore Meiji Shrine, Tsukiji Outer Market, and an authentic private tea ceremony in Asakusa.', description: 'Detailed itinerary description' },
      { name: 'inclusions', key: 'inclusions', type: 'string', required: false, sampleValue: 'Private Chauffeured Alphard|Licensed English Guide|Tea Ceremony Entrance|Hotel Pickup & Dropoff', description: 'Pipe-separated list of inclusions' },
      { name: 'exclusions', key: 'exclusions', type: 'string', required: false, sampleValue: 'Personal Purchases|Gratuities|Lunch', description: 'Pipe-separated list of exclusions' },
      { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Authoritative supplier native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '66000', description: 'Confidential supplier net cost in native currency' },
      { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '15', description: 'B2B agent margin percentage or fixed amount' },
      { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax rate or value' },
      { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '0', description: 'Service fee amount' },
      { name: 'capacity_or_unit_rule', key: 'capacity_or_unit_rule', type: 'string', required: false, sampleValue: '1-6 Pax per Vehicle', description: 'Capacity rule or unit rule description' },
      { name: 'upsell_product_ids', key: 'upsell_product_ids', type: 'string', required: false, sampleValue: 'PROD-002|PROD-003', description: 'Pipe-separated IDs of recommended upsell products' },
      { name: 'capacity_tiers_json', key: 'capacity_tiers_json', type: 'string', required: false, sampleValue: '[{"minPassengers":1,"maxPassengers":3,"vehicleId":"VEH-ALPHARD","supplierNett":50000},{"minPassengers":4,"maxPassengers":6,"vehicleId":"VEH-ALPHARD","supplierNett":66000}]', description: 'Optional JSON structured capacity tiers for vehicle/group scaling' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'] },
      { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)' },
      { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)' }
    ],
    sampleRows: [
      ['PROD-001', 'PRD-TYO-001', 'Tokyo Private Highlights & Tea Ceremony', 'Private Tour', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', 'Full-day chauffeured tour with licensed guide and tea ceremony.', 'Explore Meiji Shrine, Tsukiji Outer Market, and Asakusa private tea house.', 'Private Alphard|Licensed English Guide|Tea Ceremony Entrance', 'Personal Purchases|Lunch', 'JPY', '66000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', '1-6 Pax per Vehicle', 'PROD-002', '[{"minPassengers":1,"maxPassengers":3,"vehicleId":"VEH-ALPHARD","supplierNett":50000},{"minPassengers":4,"maxPassengers":6,"vehicleId":"VEH-ALPHARD","supplierNett":66000}]', 'ACTIVE', '2026-01-01', '2026-12-31'],
      ['PROD-002', 'PRD-TYO-TRF', 'Tokyo Haneda Airport Private Alphard Transfer', 'Transfer', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', 'VIP Private Haneda Airport Arrival & Hotel Transfer.', 'Chauffeured Toyota Alphard transfer directly from Haneda Airport to central Tokyo hotel.', 'Toyota Alphard|60 Mins Flight Delay Buffer|Driver Meet & Greet', 'Extra Waiting Time', 'JPY', '28000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', '1-3 Pax + Luggage', '', '[{"minPassengers":1,"maxPassengers":3,"vehicleId":"VEH-ALPHARD","supplierNett":28000}]', 'ACTIVE', '2026-01-01', '2026-12-31'],
      ['PROD-003', 'PRD-KYO-CUL', 'Kyoto Gion Evening Geisha District Private Walk', 'Private Tour', 'REG-001', 'DST-JPN', 'HUB-KYOTO', 'SUP001', 'Exclusive walking tour of historic Gion with accredited historian.', 'Wander through preserved machiya streets and learn Geiko culture with a licensed guide.', 'Licensed Cultural Historian Guide|Tea House Refreshments', 'Dinner|Transportation', 'JPY', '42000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', '1-8 Pax', '', '', 'ACTIVE', '2026-01-01', '2026-12-31']
    ]
  },

  // ----------------------------------------------------
  // 3. HOTELS TAB (Hotels & Accommodations)
  // ----------------------------------------------------
  {
    tabName: 'HOTELS',
    displayName: '3. Hotels (Accommodations & Rates)',
    description: 'Single-row canonical hotels catalog with room categories and per-night wholesale rates.',
    hierarchyLevel: 2,
    parentTab: 'MASTER_DATA',
    primaryKey: 'hotel_id',
    columns: [
      { name: 'hotel_id', key: 'hotel_id', type: 'string', required: true, sampleValue: 'HTL-001', description: 'Unique permanent Hotel ID (e.g. HTL-001, HTL-TYO-AMAN)' },
      { name: 'hotel_code', key: 'hotel_code', type: 'string', required: true, sampleValue: 'HTL-TYO-AMAN', description: 'Short hotel code' },
      { name: 'hotel_name', key: 'hotel_name', type: 'string', required: true, sampleValue: 'Aman Tokyo', description: 'Official hotel property name' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Parent Region ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Parent Destination ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'hub_id', key: 'hub_id', type: 'string', required: true, sampleValue: 'HUB-TOKYO', description: 'Parent Hub ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'supplier_id', key: 'supplier_id', type: 'string', required: true, sampleValue: 'SUP001', description: 'Supplier ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'star_rating', key: 'star_rating', type: 'number', required: true, sampleValue: '5', description: 'Property star rating (1 to 5)' },
      { name: 'address', key: 'address', type: 'string', required: false, sampleValue: 'The Otemachi Tower, 1-5-6 Otemachi, Chiyoda-ku, Tokyo', description: 'Full physical address' },
      { name: 'category', key: 'category', type: 'string', required: false, sampleValue: '5-Star Luxury', description: 'Hotel tier or brand category' },
      { name: 'room_type', key: 'room_type', type: 'string', required: true, sampleValue: 'Deluxe Suite', description: 'Room category name' },
      { name: 'meal_plan', key: 'meal_plan', type: 'string', required: false, sampleValue: 'Breakfast Included', description: 'Included meal plan' },
      { name: 'occupancy', key: 'occupancy', type: 'string', required: false, sampleValue: '2 Adults', description: 'Standard max room occupancy' },
      { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Contracted native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'supplier_nett_per_night', key: 'supplier_nett_per_night', type: 'number', required: true, sampleValue: '140000', description: 'Confidential net cost per room per night' },
      { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '15', description: 'B2B margin percentage or fixed amount' },
      { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax percentage' },
      { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '0', description: 'Service fee amount' },
      { name: 'images', key: 'images', type: 'string', required: false, sampleValue: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200', description: 'Pipe-separated image URLs' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'] },
      { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)' },
      { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)' }
    ],
    sampleRows: [
      ['HTL-001', 'HTL-TYO-AMAN', 'Aman Tokyo', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', '5', 'The Otemachi Tower, 1-5-6 Otemachi, Chiyoda-ku, Tokyo', '5-Star Luxury', 'Deluxe Suite', 'Breakfast Included', '2 Adults', 'JPY', '140000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', 'https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200', 'ACTIVE', '2026-01-01', '2026-12-31'],
      ['HTL-002', 'HTL-KYO-FSR', 'Four Seasons Hotel Kyoto', 'REG-001', 'DST-JPN', 'HUB-KYOTO', 'SUP001', '5', '445-3 Myohoin Maemachi, Higashiyama Ward, Kyoto', '5-Star Luxury', 'Premier Courtyard Room', 'Breakfast Included', '2 Adults', 'JPY', '125000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', 'https://images.unsplash.com/photo-1582719478250-c89cae4dc85b?q=80&w=1200', 'ACTIVE', '2026-01-01', '2026-12-31']
    ]
  },

  // ----------------------------------------------------
  // 4. VISA AND ANCILLARY TAB (Visa, Travel Protection, VIP Ground, Connectivity)
  // ----------------------------------------------------
  {
    tabName: 'VISA_ANCILLARY',
    displayName: '4. Visa & Ancillary Services',
    description: 'Single-row canonical services catalog (Visa Assistance, Travel Protection, VIP Ground Services, 5G Connectivity).',
    hierarchyLevel: 2,
    parentTab: 'MASTER_DATA',
    primaryKey: 'service_id',
    columns: [
      { name: 'service_id', key: 'service_id', type: 'string', required: true, sampleValue: 'VSA-JPN-01', description: 'Unique permanent Service ID (e.g. VSA-JPN-01, ANC-INS-01)' },
      { name: 'service_code', key: 'service_code', type: 'string', required: true, sampleValue: 'VISA-JAPAN-EVISA', description: 'Short service code' },
      { name: 'service_name', key: 'service_name', type: 'string', required: true, sampleValue: 'Japan Tourist eVisa Processing & Facilitation', description: 'Official service title' },
      { name: 'service_group', key: 'service_group', type: 'enum', required: true, sampleValue: 'VISA', description: 'Service Group classification', allowedValues: ['VISA', 'TRAVEL_PROTECTION', 'VIP_GROUND', 'CONNECTIVITY'] },
      { name: 'service_type', key: 'service_type', type: 'string', required: false, sampleValue: 'Tourist Visa', description: 'Specific sub-type or category' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Parent Region ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Parent Destination ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'hub_id', key: 'hub_id', type: 'string', required: false, sampleValue: 'HUB-TOKYO', description: 'Parent Hub ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'supplier_id', key: 'supplier_id', type: 'string', required: true, sampleValue: 'SUP001', description: 'Supplier ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'coverage_or_scope', key: 'coverage_or_scope', type: 'string', required: false, sampleValue: 'Single Entry Tourist Visa (up to 90 Days)', description: 'Coverage, scope, or plan parameters' },
      { name: 'requirements_summary', key: 'requirements_summary', type: 'string', required: false, sampleValue: 'Valid Passport (6+ Months)|Passport Photo|Flight Reservation', description: 'Pipe-separated checklist of required documents' },
      { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'USD', description: 'Native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '35', description: 'Confidential net cost' },
      { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '15', description: 'B2B margin percentage or fixed value' },
      { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '0', description: 'Tax percentage' },
      { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '5', description: 'Service fee amount' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'] },
      { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)' },
      { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)' }
    ],
    sampleRows: [
      ['VSA-JPN-01', 'VISA-JAPAN-EVISA', 'Japan Tourist eVisa Processing & Facilitation', 'VISA', 'Tourist Visa', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', 'Single Entry Tourist Visa (up to 90 Days)', 'Valid Passport (6+ Months)|Passport Photo|Flight Reservation', 'USD', '35', 'PERCENTAGE', '15', 'PERCENTAGE', '0', 'FIXED', '5', 'ACTIVE', '2026-01-01', '2026-12-31'],
      ['ANC-INS-01', 'INS-GOLD-GLOBAL', 'Comprehensive Travel Protection & Medical Gold Plan', 'TRAVEL_PROTECTION', 'Medical & Trip Insurance', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', '$50,000 Emergency Medical + $100,000 Evacuation + Trip Cancellation', 'Age 1-75 Years|World-wide Coverage', 'USD', '25', 'PERCENTAGE', '20', 'PERCENTAGE', '0', 'FIXED', '0', 'ACTIVE', '2026-01-01', '2026-12-31'],
      ['ANC-ESIM-01', 'ESIM-JPN-15D', 'Japan 15-Day Unlimited 5G eSIM', 'CONNECTIVITY', 'eSIM Data Plan', 'REG-001', 'DST-JPN', 'HUB-TOKYO', 'SUP001', '15 Days Unlimited High-Speed 5G Data across Japan (SoftBank/NTT Docomo)', 'eSIM Compatible Smartphone', 'USD', '18', 'PERCENTAGE', '20', 'PERCENTAGE', '0', 'FIXED', '0', 'ACTIVE', '2026-01-01', '2026-12-31']
    ]
  },

  // ----------------------------------------------------
  // 5. RAIL TAB (Japan Rail Journeys & Tariffs)
  // ----------------------------------------------------
  {
    tabName: 'RAIL',
    displayName: '5. Rail (Japan Shinkansen Journeys)',
    description: 'Single-row Shinkansen routes, services, and commercial product fares (Ordinary Reserved & Green Reserved).',
    hierarchyLevel: 2,
    parentTab: 'MASTER_DATA',
    primaryKey: 'rail_id',
    columns: [
      { name: 'rail_id', key: 'rail_id', type: 'string', required: true, sampleValue: 'RAIL-TYO-KIX-01', description: 'Unique permanent Rail ID (e.g. RAIL-TYO-KIX-01)' },
      { name: 'route_code', key: 'route_code', type: 'string', required: true, sampleValue: 'TKA-TYO-OSA', description: 'Route code' },
      { name: 'route_name', key: 'route_name', type: 'string', required: true, sampleValue: 'Tokaido Shinkansen (Tokyo to Shin-Osaka)', description: 'Route display title' },
      { name: 'origin_station_id', key: 'origin_station_id', type: 'string', required: true, sampleValue: 'STN-TOKYO', description: 'Origin Station ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'origin_station_name', key: 'origin_station_name', type: 'string', required: true, sampleValue: 'Tokyo Station', description: 'Origin Station display name' },
      { name: 'destination_station_id', key: 'destination_station_id', type: 'string', required: true, sampleValue: 'STN-OSAKA', description: 'Destination Station ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'destination_station_name', key: 'destination_station_name', type: 'string', required: true, sampleValue: 'Shin-Osaka Station', description: 'Destination Station display name' },
      { name: 'commercial_product', key: 'commercial_product', type: 'enum', required: true, sampleValue: 'GREEN_RESERVED', description: 'Authoritative commercial master product type', allowedValues: ['ORDINARY_RESERVED', 'GREEN_RESERVED'] },
      { name: 'service_name', key: 'service_name', type: 'string', required: false, sampleValue: 'Nozomi Shinkansen Express', description: 'Express train service name' },
      { name: 'travel_class', key: 'travel_class', type: 'string', required: false, sampleValue: 'Green Car Reserved', description: 'Class description' },
      { name: 'duration_minutes', key: 'duration_minutes', type: 'number', required: false, sampleValue: '150', description: 'Approximate journey duration in minutes' },
      { name: 'passenger_type', key: 'passenger_type', type: 'string', required: false, sampleValue: 'Adult', description: 'Passenger tier (Adult / Child)' },
      { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '14720', description: 'Confidential net supplier cost in JPY' },
      { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '10', description: 'B2B margin percentage or fixed value' },
      { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax percentage' },
      { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '0', description: 'Service fee amount' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'] }
    ],
    sampleRows: [
      ['RAIL-TYO-KIX-01', 'TKA-TYO-OSA', 'Tokaido Shinkansen (Tokyo to Shin-Osaka)', 'STN-TOKYO', 'Tokyo Station', 'STN-OSAKA', 'Shin-Osaka Station', 'GREEN_RESERVED', 'Nozomi Express', 'Green Car Reserved', '150', 'Adult', 'JPY', '19270', 'PERCENTAGE', '10', 'PERCENTAGE', '10', 'FIXED', '0', 'ACTIVE'],
      ['RAIL-TYO-KIX-02', 'TKA-TYO-OSA', 'Tokaido Shinkansen (Tokyo to Shin-Osaka)', 'STN-TOKYO', 'Tokyo Station', 'STN-OSAKA', 'Shin-Osaka Station', 'ORDINARY_RESERVED', 'Nozomi Express', 'Ordinary Reserved', '150', 'Adult', 'JPY', '14720', 'PERCENTAGE', '10', 'PERCENTAGE', '10', 'FIXED', '0', 'ACTIVE']
    ]
  },

  // ----------------------------------------------------
  // 6. PACKAGES TAB (Curated Wholesale Packages)
  // ----------------------------------------------------
  {
    tabName: 'PACKAGES',
    displayName: '6. Packages (Curated B2B Itineraries)',
    description: 'Single-row canonical packages linking products, hotels, and hubs.',
    hierarchyLevel: 2,
    parentTab: 'MASTER_DATA',
    primaryKey: 'package_id',
    columns: [
      { name: 'package_id', key: 'package_id', type: 'string', required: true, sampleValue: 'PKG-JPN-01', description: 'Unique permanent Package ID (e.g. PKG-JPN-01)' },
      { name: 'package_code', key: 'package_code', type: 'string', required: true, sampleValue: 'PKG-TOKYO-KYOTO-7N', description: 'Short reference code' },
      { name: 'package_name', key: 'package_name', type: 'string', required: true, sampleValue: 'Classic Golden Route: Tokyo & Kyoto Luxury Discovery', description: 'Official package title' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Parent Region ID', foreignKeyTab: 'MASTER_DATA', foreignKeyColumn: 'entity_id' },
      { name: 'destination_ids', key: 'destination_ids', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Pipe-separated Destination IDs' },
      { name: 'hub_ids', key: 'hub_ids', type: 'string', required: true, sampleValue: 'HUB-TOKYO|HUB-KYOTO', description: 'Pipe-separated Hub IDs' },
      { name: 'duration_nights', key: 'duration_nights', type: 'number', required: true, sampleValue: '7', description: 'Total itinerary duration in nights' },
      { name: 'summary', key: 'summary', type: 'string', required: false, sampleValue: '7-Night Curated Journey combining 5-Star luxury, Shinkansen Green Car transfers, and private guided touring.', description: 'Brief itinerary summary' },
      { name: 'included_product_ids', key: 'included_product_ids', type: 'string', required: false, sampleValue: 'PROD-001|PROD-002|PROD-003|RAIL-TYO-KIX-01', description: 'Pipe-separated Product IDs included in package' },
      { name: 'hotel_ids', key: 'hotel_ids', type: 'string', required: false, sampleValue: 'HTL-001|HTL-002', description: 'Pipe-separated Hotel IDs included in package' },
      { name: 'native_currency', key: 'native_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Native currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '450000', description: 'Confidential net cost per person' },
      { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'Margin calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'b2b_margin_value', key: 'b2b_margin_value', type: 'number', required: true, sampleValue: '15', description: 'B2B margin percentage or fixed value' },
      { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'Tax calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax percentage' },
      { name: 'service_fee_type', key: 'service_fee_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'Service fee calculation type', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'service_fee_value', key: 'service_fee_value', type: 'number', required: false, sampleValue: '0', description: 'Service fee amount' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'Status: ACTIVE or INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE', 'Active', 'Inactive'] },
      { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)' },
      { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)' }
    ],
    sampleRows: [
      ['PKG-JPN-01', 'PKG-TOKYO-KYOTO-7N', 'Classic Golden Route: Tokyo & Kyoto Luxury Discovery', 'REG-001', 'DST-JPN', 'HUB-TOKYO|HUB-KYOTO', '7', '7-Night Curated Journey combining 5-Star luxury, Shinkansen Green Car transfers, and private guided touring.', 'PROD-001|PROD-002|PROD-003|RAIL-TYO-KIX-01', 'HTL-001|HTL-002', 'JPY', '450000', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '0', 'ACTIVE', '2026-01-01', '2026-12-31']
    ]
  }
];

/**
 * Authoritative Canonical Master Workbook Tab Registry (7 Canonical Tabs)
 */
export const EXPECTED_MASTER_TAB_COUNT = 7;

/**
 * Canonical 7-Tab Workbook Processing Order
 */
export const CANONICAL_TAB_PROCESSING_ORDER: MasterSheetTabName[] = [
  'INSTRUCTIONS',
  'MASTER_DATA',
  'PRODUCTS',
  'HOTELS',
  'VISA_ANCILLARY',
  'RAIL',
  'PACKAGES'
];

export const MASTER_WORKBOOK_TABS = CANONICAL_TAB_PROCESSING_ORDER;

/**
 * Header lookup matrix per canonical tab
 */
export const CANONICAL_SCHEMA_HEADERS: Record<string, string[]> = {
  INSTRUCTIONS: ['rule_id', 'category', 'rule_name', 'guidance'],
  MASTER_DATA: ['entity_type', 'entity_id', 'code', 'name', 'parent_id', 'country', 'currency', 'status', 'description'],
  PRODUCTS: ['product_id', 'product_code', 'product_name', 'category', 'region_id', 'destination_id', 'hub_id', 'supplier_id', 'short_description', 'description', 'inclusions', 'exclusions', 'native_currency', 'supplier_nett', 'margin_type', 'b2b_margin_value', 'tax_type', 'tax_value', 'service_fee_type', 'service_fee_value', 'capacity_or_unit_rule', 'upsell_product_ids', 'capacity_tiers_json', 'status', 'effective_from', 'effective_to'],
  HOTELS: ['hotel_id', 'hotel_code', 'hotel_name', 'region_id', 'destination_id', 'hub_id', 'supplier_id', 'star_rating', 'address', 'category', 'room_type', 'meal_plan', 'occupancy', 'native_currency', 'supplier_nett_per_night', 'margin_type', 'b2b_margin_value', 'tax_type', 'tax_value', 'service_fee_type', 'service_fee_value', 'images', 'status', 'effective_from', 'effective_to'],
  VISA_ANCILLARY: ['service_id', 'service_code', 'service_name', 'service_group', 'service_type', 'region_id', 'destination_id', 'hub_id', 'supplier_id', 'coverage_or_scope', 'requirements_summary', 'native_currency', 'supplier_nett', 'margin_type', 'b2b_margin_value', 'tax_type', 'tax_value', 'service_fee_type', 'service_fee_value', 'status', 'effective_from', 'effective_to'],
  RAIL: ['rail_id', 'route_code', 'route_name', 'origin_station_id', 'origin_station_name', 'destination_station_id', 'destination_station_name', 'commercial_product', 'service_name', 'travel_class', 'duration_minutes', 'passenger_type', 'native_currency', 'supplier_nett', 'margin_type', 'b2b_margin_value', 'tax_type', 'tax_value', 'service_fee_type', 'service_fee_value', 'status'],
  PACKAGES: ['package_id', 'package_code', 'package_name', 'region_id', 'destination_ids', 'hub_ids', 'duration_nights', 'summary', 'included_product_ids', 'hotel_ids', 'native_currency', 'supplier_nett', 'margin_type', 'b2b_margin_value', 'tax_type', 'tax_value', 'service_fee_type', 'service_fee_value', 'status', 'effective_from', 'effective_to']
};

/**
 * Returns tab schema definition by name with alias support
 */
export function getTabSchemaByName(tabName: string): MasterSheetTabDefinition | undefined {
  const norm = tabName.trim().toUpperCase().replace(/[\s_-]+/g, '_');
  
  if (norm === 'INSTRUCTIONS' || norm === 'README' || norm.includes('INSTRUCTION') || norm.includes('README')) {
    return MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === 'INSTRUCTIONS');
  }
  if (norm === 'MASTER_DATA' || norm === 'MASTERDATA' || norm.includes('MASTER_DATA')) {
    return MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === 'MASTER_DATA');
  }
  if (norm === 'PRODUCTS' || norm === 'PRODUCT' || norm.includes('PRODUCT')) {
    return MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === 'PRODUCTS');
  }
  if (norm === 'HOTELS' || norm === 'HOTEL' || norm.includes('HOTEL')) {
    return MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === 'HOTELS');
  }
  if (norm === 'VISA_ANCILLARY' || norm === 'VISA_AND_ANCILLARY' || norm === 'VISA' || norm.includes('VISA') || norm.includes('ANCILLARY')) {
    return MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === 'VISA_ANCILLARY');
  }
  if (norm === 'RAIL' || norm === 'RAILS' || norm.includes('RAIL') || norm.includes('SHINKANSEN')) {
    return MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === 'RAIL');
  }
  if (norm === 'PACKAGES' || norm === 'PACKAGE' || norm.includes('PACKAGE')) {
    return MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === 'PACKAGES');
  }

  return MASTER_SHEETS_TAB_DEFINITIONS.find(t => t.tabName === tabName as MasterSheetTabName);
}

/**
 * Generates an authentic .xlsx workbook containing the canonical 7 worksheets.
 */
export function generateCanonicalExcelWorkbookBlob(): Blob {
  const wb = XLSX.utils.book_new();

  for (const tabDef of MASTER_SHEETS_TAB_DEFINITIONS) {
    const headers = tabDef.columns.map(c => c.key);
    const rows = [headers, ...tabDef.sampleRows];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Auto-fit column widths
    ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 16) }));
    
    XLSX.utils.book_append_sheet(wb, ws, tabDef.tabName);
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/**
 * Generates a sample CSV string for a given tab
 */
export function generateSampleCsv(tabName: string): string {
  const schema = getTabSchemaByName(tabName);
  if (!schema) return '';
  const headers = schema.columns.map(c => c.key);
  const rows = [headers, ...schema.sampleRows];
  return rows.map(r => r.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
}

/**
 * Generates a bundle of sample CSV strings for all tabs
 */
export function generateAllTabsCsvBundle(): Record<string, string> {
  const bundle: Record<string, string> = {};
  for (const tabDef of MASTER_SHEETS_TAB_DEFINITIONS) {
    bundle[tabDef.tabName] = generateSampleCsv(tabDef.tabName);
  }
  return bundle;
}

/**
 * Generates canonical Excel workbook blob with demo data
 */
export function generateCanonicalExcelWorkbookWithDemoDataBlob(_includeDemoData: boolean = true): Blob {
  return generateCanonicalExcelWorkbookBlob();
}
