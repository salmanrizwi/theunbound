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
  tabName: MasterSheetTabName | 'INSTRUCTIONS';
  displayName: string;
  description: string;
  hierarchyLevel: number; // 1: Macro Region, 2: Destination, 3: Hub, 4: Core Entity, 5: Rates & Sub-entities, 6: Packages
  parentTab?: MasterSheetTabName;
  primaryKey: string;
  columns: SheetColumnDefinition[];
  sampleRows: string[][];
}

export const MASTER_SHEETS_TAB_DEFINITIONS: MasterSheetTabDefinition[] = [
  // ----------------------------------------------------
  // 0. INSTRUCTIONS TAB
  // ----------------------------------------------------
  {
    tabName: 'INSTRUCTIONS',
    displayName: '0. Master Instructions & Rules',
    description: 'Guidelines, foreign key hierarchy rules, allowed values, and data entry best practices.',
    hierarchyLevel: 0,
    primaryKey: 'rule_id',
    columns: [
      { name: 'Rule ID', key: 'rule_id', type: 'string', required: true, sampleValue: 'RULE-01', description: 'Instruction ID' },
      { name: 'Category', key: 'category', type: 'string', required: true, sampleValue: 'Hierarchy Rules', description: 'Rule classification' },
      { name: 'Rule Name', key: 'rule_name', type: 'string', required: true, sampleValue: 'Strict Hierarchical Relationships', description: 'Core policy' },
      { name: 'Description & Guidance', key: 'guidance', type: 'string', required: true, sampleValue: 'Region -> Destination -> Hub -> Child items. Always use permanent IDs.', description: 'Detailed guidance for admin data entry' }
    ],
    sampleRows: [
      ['RULE-01', 'Hierarchy Structure', 'Region -> Destination -> Hub', 'Every Destination must link to a valid region_id in REGIONS tab. Every Hub must link to a valid destination_id in DESTINATIONS tab. Products, Hotels, Visas, and Transfers must link to their valid parent IDs.'],
      ['RULE-02', 'Permanent ID Policy', 'Stable Unique IDs', 'Never use display names as relationship keys. If a hotel or product name changes in the future, its ID (e.g. HTL-TYO-001) remains stable. Never alter existing IDs when updating inventory.'],
      ['RULE-03', 'Safe Deactivation', 'Do Not Delete Silently', 'If an item is discontinued, set its status to Inactive or Archived instead of deleting rows. Historical quotations reference these IDs.'],
      ['RULE-04', 'Commercial Pricing Independence', 'Pricing Engine Integrity', 'Master rate sheets feed adult_nett, child_nett, markup_buyer, markup_agent, and taxes. Final selling price calculations are executed by the platform pricing engine.'],
      ['RULE-05', 'Date Formats', 'ISO Standard YYYY-MM-DD', 'All validity dates (validity_from, validity_to) must follow the format YYYY-MM-DD (e.g. 2026-01-01 to 2026-12-31).'],
      ['RULE-06', 'Import Sequence', 'Strict Top-Down Order', 'Import Order: 1. REGIONS -> 2. DESTINATIONS -> 3. HUBS -> 4. PRODUCTS / HOTELS / VISA / TRANSFER_ROUTES -> 5. RATES & ROOMS -> 6. PACKAGES.']
    ]
  },

  // ----------------------------------------------------
  // 1. REGIONS TAB (Tier 1: Macro Regions)
  // ----------------------------------------------------
  {
    tabName: 'REGIONS',
    displayName: '1. Macro Regions (REGIONS)',
    description: 'Top-tier geographic territories grouping destinations (e.g. East Asia, Western Europe, Middle East).',
    hierarchyLevel: 1,
    primaryKey: 'region_id',
    columns: [
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Unique stable Region ID (e.g. REG-001, REG-EAST-ASIA)' },
      { name: 'region_name', key: 'region_name', type: 'string', required: true, sampleValue: 'East Asia', description: 'Display name of the Macro Region' },
      { name: 'slug', key: 'slug', type: 'string', required: true, sampleValue: 'east-asia', description: 'URL route slug' },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Default currency code (USD, EUR, GBP, JPY, AED, THB)', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Status: Active / Coming Soon / Inactive', allowedValues: ['Active', 'Coming Soon', 'Inactive', 'ACTIVE', 'COMING_SOON', 'INACTIVE'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Ordering sequence in UI' },
      { name: 'description', key: 'description', type: 'string', required: false, sampleValue: 'Premier destinations across Japan and East Asia with bespoke ground operations.', description: 'Overview text' },
      { name: 'image_url', key: 'image_url', type: 'string', required: false, sampleValue: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200', description: 'Hero banner image URL' },
      { name: 'created_at', key: 'created_at', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Creation date' },
      { name: 'updated_at', key: 'updated_at', type: 'date', required: false, sampleValue: '2026-08-20', description: 'Last modified date' }
    ],
    sampleRows: [
      ['REG-001', 'East Asia', 'east-asia', 'JPY', 'Active', '1', 'Premier destinations across Japan and East Asia with bespoke ground operations.', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200', '2026-01-01', '2026-08-20'],
      ['REG-002', 'Western Europe & UK', 'western-europe', 'EUR', 'Active', '2', 'Luxury chauffeur circuits, private estates, and accredited docents across UK and France.', 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200', '2026-01-01', '2026-08-20'],
      ['REG-003', 'Middle East', 'middle-east', 'AED', 'Active', '3', 'VIP desert logistics, luxury MPV airport fleets, and private yacht charters.', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200', '2026-01-01', '2026-08-20'],
      ['REG-004', 'Southeast Asia', 'southeast-asia', 'THB', 'Active', '4', 'Direct island charters, wellness retreats, and authentic private cultural touring.', 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1200', '2026-01-01', '2026-08-20']
    ]
  },

  // ----------------------------------------------------
  // 2. DESTINATIONS TAB (Tier 2: Countries / Operating Territories)
  // ----------------------------------------------------
  {
    tabName: 'DESTINATIONS',
    displayName: '2. Destinations (DESTINATIONS)',
    description: 'Countries or territories belonging to a Region (e.g. Japan, United Kingdom, France, UAE, Thailand).',
    hierarchyLevel: 2,
    parentTab: 'REGIONS',
    primaryKey: 'destination_id',
    columns: [
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Unique stable Destination ID (e.g. DST-JPN, DST-UK)' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Foreign key to REGIONS tab (e.g. REG-001)', foreignKeyTab: 'REGIONS', foreignKeyColumn: 'region_id' },
      { name: 'destination_name', key: 'destination_name', type: 'string', required: true, sampleValue: 'Japan', description: 'Display name of the Destination' },
      { name: 'country_name', key: 'country_name', type: 'string', required: true, sampleValue: 'Japan', description: 'Sovereign country name' },
      { name: 'slug', key: 'slug', type: 'string', required: true, sampleValue: 'japan', description: 'URL route slug' },
      { name: 'base_currency', key: 'base_currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Base operating currency', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Status: Active / Coming Soon / Inactive', allowedValues: ['Active', 'Coming Soon', 'Inactive', 'ACTIVE', 'COMING_SOON', 'INACTIVE'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Ordering sequence in UI' },
      { name: 'hero_image_url', key: 'hero_image_url', type: 'string', required: false, sampleValue: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200', description: 'Banner image link' },
      { name: 'description', key: 'description', type: 'string', required: false, sampleValue: 'Bespoke ground DMC solutions across Tokyo, Kyoto, Osaka, and Hakone.', description: 'Destination overview' },
      { name: 'timezone', key: 'timezone', type: 'string', required: false, sampleValue: 'Asia/Tokyo', description: 'Timezone identifier (e.g. Asia/Tokyo, Europe/London)' },
      { name: 'default_markup_buyer', key: 'default_markup_buyer', type: 'number', required: false, sampleValue: '20', description: 'Default retail buyer markup % (e.g. 20)' },
      { name: 'default_markup_agent', key: 'default_markup_agent', type: 'number', required: false, sampleValue: '15', description: 'Default B2B wholesale agent markup % (e.g. 15)' }
    ],
    sampleRows: [
      ['DST-JPN', 'REG-001', 'Japan', 'Japan', 'japan', 'JPY', 'Active', '1', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200', 'Bespoke ground DMC solutions across Tokyo, Kyoto, Osaka, and Hakone.', 'Asia/Tokyo', '20', '15'],
      ['DST-UK', 'REG-002', 'United Kingdom', 'United Kingdom', 'uk', 'GBP', 'Active', '2', 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200', 'Private chauffeur tours, Cotswolds manor estates, and London VIP access.', 'Europe/London', '25', '18'],
      ['DST-FRA', 'REG-002', 'France', 'France', 'france', 'EUR', 'Active', '3', 'https://images.unsplash.com/photo-1502602898657-3e91760cbb34?q=80&w=1200', 'Luxury Paris museum docents, French Riviera charters, and bespoke gastronomy.', 'Europe/Paris', '25', '18'],
      ['DST-UAE', 'REG-003', 'United Arab Emirates', 'United Arab Emirates', 'dubai', 'AED', 'Active', '4', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200', 'VIP Mercedes V-Class airport transfers, Burj Al Arab suites, and luxury desert camps.', 'Asia/Dubai', '20', '15'],
      ['DST-THA', 'REG-004', 'Thailand', 'Thailand', 'thailand', 'THB', 'Active', '5', 'https://images.unsplash.com/photo-1552465011-b4e21bf6e79a?q=80&w=1200', 'Private speedboat island charters, Phuket luxury villas, and Bangkok heritage.', 'Asia/Bangkok', '20', '15']
    ]
  },

  // ----------------------------------------------------
  // 3. HUBS TAB (Tier 3: Operational Cities / Hubs)
  // ----------------------------------------------------
  {
    tabName: 'HUBS',
    displayName: '3. City Hubs (HUBS)',
    description: 'Operational gateway cities, islands, and resort areas inside a Destination (e.g. Tokyo, Kyoto, London, Dubai).',
    hierarchyLevel: 3,
    parentTab: 'DESTINATIONS',
    primaryKey: 'hub_id',
    columns: [
      { name: 'hub_id', key: 'hub_id', type: 'string', required: true, sampleValue: 'HUB-TYO', description: 'Unique stable Hub ID (e.g. HUB-TYO, HUB-KYO, HUB-LON)' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Foreign key to DESTINATIONS tab (e.g. DST-JPN)', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'hub_name', key: 'hub_name', type: 'string', required: true, sampleValue: 'Tokyo', description: 'Display name of the City / Hub' },
      { name: 'hub_type', key: 'hub_type', type: 'enum', required: true, sampleValue: 'City', description: 'City / Resort / Island / Area / Transit Hub', allowedValues: ['City', 'Resort', 'Island', 'Area', 'Transit Hub'] },
      { name: 'country', key: 'country', type: 'string', required: true, sampleValue: 'Japan', description: 'Country name' },
      { name: 'latitude', key: 'latitude', type: 'number', required: false, sampleValue: '35.6762', description: 'Geo coordinate' },
      { name: 'longitude', key: 'longitude', type: 'number', required: false, sampleValue: '139.6503', description: 'Geo coordinate' },
      { name: 'airport_code', key: 'airport_code', type: 'string', required: false, sampleValue: 'HND / NRT', description: 'Primary airport codes (e.g. HND / NRT, LHR)' },
      { name: 'railway_station', key: 'railway_station', type: 'string', required: false, sampleValue: 'Tokyo Central Station', description: 'Main rail terminal' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active / Archived / Inactive', allowedValues: ['Active', 'Archived', 'Inactive', 'ACTIVE', 'ARCHIVED', 'INACTIVE'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Display order in City Hub selector' }
    ],
    sampleRows: [
      ['HUB-TYO', 'DST-JPN', 'Tokyo', 'City', 'Japan', '35.6762', '139.6503', 'HND / NRT', 'Tokyo Central Station', 'Active', '1'],
      ['HUB-KYO', 'DST-JPN', 'Kyoto', 'City', 'Japan', '35.0116', '135.7681', 'KIX / ITM', 'Kyoto Shinkansen Station', 'Active', '2'],
      ['HUB-OSA', 'DST-JPN', 'Osaka', 'City', 'Japan', '34.6937', '135.5023', 'KIX', 'Shin-Osaka Station', 'Active', '3'],
      ['HUB-HAK', 'DST-JPN', 'Hakone & Mt Fuji', 'Resort', 'Japan', '35.2323', '139.1069', 'HND', 'Hakone-Yumoto Station', 'Active', '4'],
      ['HUB-LON', 'DST-UK', 'London', 'City', 'United Kingdom', '51.5074', '-0.1278', 'LHR / LGW', 'London St Pancras / Paddington', 'Active', '1'],
      ['HUB-EDI', 'DST-UK', 'Edinburgh & Highlands', 'City', 'United Kingdom', '55.9533', '-3.1883', 'EDI', 'Edinburgh Waverley', 'Active', '2'],
      ['HUB-PAR', 'DST-FRA', 'Paris', 'City', 'France', '48.8566', '2.3522', 'CDG / ORY', 'Gare de Lyon / Gare du Nord', 'Active', '1'],
      ['HUB-DXB', 'DST-UAE', 'Dubai', 'City', 'United Arab Emirates', '25.2048', '55.2708', 'DXB / DWC', 'Dubai Metro Union', 'Active', '1'],
      ['HUB-HKT', 'DST-THA', 'Phuket & Krabi', 'Island', 'Thailand', '7.8804', '98.3923', 'HKT', 'Phuket Bus Terminal 2', 'Active', '1'],
      ['HUB-BKK', 'DST-THA', 'Bangkok', 'City', 'Thailand', '13.7563', '100.5018', 'BKK / DMK', 'Krung Thep Aphiwat Central', 'Active', '2']
    ]
  },

  // ----------------------------------------------------
  // 4. PRODUCTS TAB (Tier 4: Master Products & Tours)
  // ----------------------------------------------------
  {
    tabName: 'PRODUCTS',
    displayName: '4. Master Products (PRODUCTS)',
    description: 'Master catalog of Day Tours, Activities, Rail, Private Yacht, and Cultural Excursions.',
    hierarchyLevel: 4,
    parentTab: 'HUBS',
    primaryKey: 'product_id',
    columns: [
      { name: 'product_id', key: 'product_id', type: 'string', required: true, sampleValue: 'PRD-TYO-001', description: 'Unique stable SKU (e.g. PRD-TYO-001)' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Foreign key to REGIONS', foreignKeyTab: 'REGIONS', foreignKeyColumn: 'region_id' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Foreign key to DESTINATIONS', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'hub_id', key: 'hub_id', type: 'string', required: true, sampleValue: 'HUB-TYO', description: 'Foreign key to HUBS', foreignKeyTab: 'HUBS', foreignKeyColumn: 'hub_id' },
      { name: 'product_category', key: 'product_category', type: 'enum', required: true, sampleValue: 'Day Tours', description: 'Day Tours / Activities / Private Yacht / Rail / Sightseeing / Guide', allowedValues: ['Day Tours', 'Activities', 'Private Yacht', 'Rail', 'Sightseeing', 'Guide', 'Transfers', 'Cruises'] },
      { name: 'product_name', key: 'product_name', type: 'string', required: true, sampleValue: 'Tokyo Modern & Edo Heritage Private Tour', description: 'Display title' },
      { name: 'supplier_name', key: 'supplier_name', type: 'string', required: true, sampleValue: 'Nippon Luxury Transit', description: 'Contracted ground supplier' },
      { name: 'supplier_code', key: 'supplier_code', type: 'string', required: false, sampleValue: 'NLT-TYO-VIP8H', description: 'Supplier internal reference code' },
      { name: 'description', key: 'description', type: 'string', required: true, sampleValue: 'Full-day luxury tour with private chauffeur and certified English docent.', description: 'Full marketing description' },
      { name: 'duration', key: 'duration', type: 'string', required: true, sampleValue: '8 Hours', description: 'Duration (e.g. 8 Hours, 3 Hours, Half Day)' },
      { name: 'operating_days', key: 'operating_days', type: 'array', required: true, sampleValue: 'Mon, Tue, Wed, Thu, Fri, Sat, Sun', description: 'Comma-separated days' },
      { name: 'start_time', key: 'start_time', type: 'string', required: false, sampleValue: '09:00', description: 'Start time (HH:mm)' },
      { name: 'end_time', key: 'end_time', type: 'string', required: false, sampleValue: '17:00', description: 'End time (HH:mm)' },
      { name: 'meeting_point', key: 'meeting_point', type: 'string', required: false, sampleValue: 'Hotel Lobby Pick-up in Central Tokyo', description: 'Location instructions' },
      { name: 'pickup_available', key: 'pickup_available', type: 'boolean', required: false, sampleValue: 'TRUE', description: 'TRUE or FALSE' },
      { name: 'dropoff_available', key: 'dropoff_available', type: 'boolean', required: false, sampleValue: 'TRUE', description: 'TRUE or FALSE' },
      { name: 'cancellation_policy', key: 'cancellation_policy', type: 'string', required: true, sampleValue: '100% refund up to 72h prior to service', description: 'Cancellation terms' },
      { name: 'child_policy', key: 'child_policy', type: 'string', required: false, sampleValue: 'Children aged 3-11 qualify for child tariff', description: 'Child conditions' },
      { name: 'infant_policy', key: 'infant_policy', type: 'string', required: false, sampleValue: 'Infants under 2 travel complimentary on lap', description: 'Infant conditions' },
      { name: 'age_min', key: 'age_min', type: 'number', required: false, sampleValue: '0', description: 'Minimum age' },
      { name: 'age_max', key: 'age_max', type: 'number', required: false, sampleValue: '99', description: 'Maximum age' },
      { name: 'height_requirement', key: 'height_requirement', type: 'string', required: false, sampleValue: 'None', description: 'Physical requirements' },
      { name: 'weight_requirement', key: 'weight_requirement', type: 'string', required: false, sampleValue: 'None', description: 'Weight limitations' },
      { name: 'capacity_type', key: 'capacity_type', type: 'enum', required: true, sampleValue: 'per_person', description: 'per_person / capacity_based / fixed_stay', allowedValues: ['per_person', 'capacity_based', 'fixed_stay'] },
      { name: 'max_capacity', key: 'max_capacity', type: 'number', required: true, sampleValue: '6', description: 'Maximum passenger capacity' },
      { name: 'vehicle_model', key: 'vehicle_model', type: 'string', required: false, sampleValue: 'Toyota Alphard Executive MPV', description: 'Vehicle / vessel type if applicable' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active / Archived / Draft / Inactive', allowedValues: ['Active', 'Archived', 'Draft', 'Inactive', 'ACTIVE', 'ARCHIVED', 'DRAFT', 'INACTIVE'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Sequence order' }
    ],
    sampleRows: [
      ['PRD-TYO-001', 'REG-001', 'DST-JPN', 'HUB-TYO', 'Day Tours', 'Tokyo Modern & Edo Heritage Private Tour', 'Nippon Luxury Transit', 'NLT-TYO-VIP8H', 'Full-day luxury tour with private chauffeur and certified English docent exploring Senso-ji, Meiji Shrine, and Ginza.', '8 Hours', 'Mon, Tue, Wed, Thu, Fri, Sat, Sun', '09:00', '17:00', 'Hotel Lobby Pick-up in Central Tokyo', 'TRUE', 'TRUE', '100% refund up to 72h prior to service', 'Children aged 3-11 qualify for child tariff', 'Infants under 2 travel complimentary', '0', '99', 'None', 'None', 'per_person', '6', 'Toyota Alphard Executive MPV', 'Active', '1'],
      ['PRD-KYO-002', 'REG-001', 'DST-JPN', 'HUB-KYO', 'Activities', 'Private Authentic Tea Ceremony with Grand Master', 'Kyoto Heritage Guild', 'KHG-TEA-02', 'Exclusive traditional tea ceremony hosted by an Omotesenke Grand Master in an authentic tatami tearoom with matcha whisking.', '2.5 Hours', 'Mon, Tue, Wed, Thu, Fri, Sat, Sun', '10:00', '12:30', 'Gion Courtyard Tea Pavilion, Kyoto', 'FALSE', 'FALSE', '100% refund up to 48h prior', 'Ages 6+ welcome with adult accompaniment', 'Not recommended for infants', '6', '99', 'None', 'None', 'per_person', '8', 'N/A', 'Active', '2'],
      ['PRD-LON-003', 'REG-002', 'DST-UK', 'HUB-LON', 'Day Tours', 'London Royal Palaces & Tower VIP Experience', 'British Heritage Chauffeurs', 'BHC-LON-ROYAL', 'Chauffeur-driven executive exploration of Tower of London, Buckingham Palace, and Westminster with Blue Badge guide.', '7 Hours', 'Mon, Wed, Fri, Sat', '09:30', '16:30', 'Central London Hotel Lobby', 'TRUE', 'TRUE', '100% refund up to 72h prior', 'Standard child concession available', 'Infants free of charge', '0', '99', 'None', 'None', 'per_person', '6', 'Mercedes V-Class Extra Long', 'Active', '3'],
      ['PRD-DXB-004', 'REG-003', 'DST-UAE', 'HUB-DXB', 'Activities', 'Private Desert Conservation Safari & Gourmet Dining', 'Emirates VIP Logistics', 'EVIP-DSF-01', 'Private vintage Land Rover wildlife drive across Dubai Desert Conservation Reserve followed by a 6-course royal dinner.', '6 Hours', 'Mon, Tue, Wed, Thu, Fri, Sat, Sun', '15:30', '21:30', 'Dubai Hotel Lobby', 'TRUE', 'TRUE', '100% refund up to 48h prior', 'Child tariff applies for ages 5-11', 'Infants under 5 not permitted on dune drive', '5', '99', 'None', 'None', 'capacity_based', '6', 'Land Rover Defender Safari', 'Active', '4'],
      ['PRD-HKT-005', 'REG-004', 'DST-THA', 'HUB-HKT', 'Private Yacht', 'Private Phi Phi & Bamboo Island Speedboat Charter', 'Andaman Luxury Marine', 'ALM-YCH-35FT', 'Bespoke private marine charter across Maya Bay, Pileh Lagoon, and pristine Bamboo Island with gourmet beach lunch.', '8.5 Hours', 'Mon, Tue, Wed, Thu, Fri, Sat, Sun', '08:00', '16:30', 'Royal Phuket Marina Pier 4', 'TRUE', 'TRUE', '100% refund up to 48h prior', 'Children must wear life jackets at all times', 'Not recommended for infants under 1 year', '1', '85', 'None', 'None', 'capacity_based', '12', 'Custom 35ft Twin Yamaha Speedboat', 'Active', '5']
    ]
  },

  // ----------------------------------------------------
  // 5. PRODUCT_PRICING TAB (Tier 5: Product Rates)
  // ----------------------------------------------------
  {
    tabName: 'PRODUCT_PRICING',
    displayName: '5. Product Pricing & Rates (PRODUCT_PRICING)',
    description: 'Net supplier costs, date validity windows, child/infant tiers, and markup parameters for Products.',
    hierarchyLevel: 5,
    parentTab: 'PRODUCTS',
    primaryKey: 'pricing_id',
    columns: [
      { name: 'pricing_id', key: 'pricing_id', type: 'string', required: true, sampleValue: 'PRC-TYO-001-STD', description: 'Unique rate identifier (e.g. PRC-TYO-001-STD)' },
      { name: 'product_id', key: 'product_id', type: 'string', required: true, sampleValue: 'PRD-TYO-001', description: 'Foreign key linking to PRODUCTS tab', foreignKeyTab: 'PRODUCTS', foreignKeyColumn: 'product_id' },
      { name: 'rate_type', key: 'rate_type', type: 'string', required: true, sampleValue: 'Standard', description: 'Rate tier: Standard / Peak / Off-Peak / Festive' },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'validity_from', key: 'validity_from', type: 'date', required: true, sampleValue: '2026-01-01', description: 'ISO date YYYY-MM-DD' },
      { name: 'validity_to', key: 'validity_to', type: 'date', required: true, sampleValue: '2026-12-31', description: 'ISO date YYYY-MM-DD' },
      { name: 'adult_nett', key: 'adult_nett', type: 'number', required: true, sampleValue: '42000', description: 'Confidential net supplier cost per adult' },
      { name: 'child_nett', key: 'child_nett', type: 'number', required: false, sampleValue: '22000', description: 'Confidential net cost per child' },
      { name: 'cwb_nett', key: 'cwb_nett', type: 'number', required: false, sampleValue: '22000', description: 'Child with bed net cost (if applicable)' },
      { name: 'cnb_nett', key: 'cnb_nett', type: 'number', required: false, sampleValue: '12000', description: 'Child no bed net cost (if applicable)' },
      { name: 'infant_nett', key: 'infant_nett', type: 'number', required: false, sampleValue: '0', description: 'Infant net cost (0-2 yrs)' },
      { name: 'fixed_cost', key: 'fixed_cost', type: 'number', required: false, sampleValue: '0', description: 'Fixed vehicle / guide booking fee' },
      { name: 'per_person_cost', key: 'per_person_cost', type: 'number', required: false, sampleValue: '42000', description: 'Per passenger charge' },
      { name: 'markup_buyer', key: 'markup_buyer', type: 'number', required: true, sampleValue: '20', description: 'Retail Buyer markup % (e.g. 20)' },
      { name: 'markup_agent', key: 'markup_agent', type: 'number', required: true, sampleValue: '15', description: 'B2B Wholesale Agent markup % (e.g. 15)' },
      { name: 'tax_percentage', key: 'tax_percentage', type: 'number', required: true, sampleValue: '10', description: 'Compulsory VAT/GST %' },
      { name: 'supplier_name', key: 'supplier_name', type: 'string', required: true, sampleValue: 'Nippon Luxury Transit', description: 'Contracted supplier' },
      { name: 'supplier_rate_reference', key: 'supplier_rate_reference', type: 'string', required: false, sampleValue: 'RATE-2026-NLT-01', description: 'Supplier contract reference' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active or Inactive', allowedValues: ['Active', 'Inactive', 'ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['PRC-TYO-001-STD', 'PRD-TYO-001', 'Standard', 'JPY', '2026-01-01', '2026-12-31', '42000', '22000', '22000', '12000', '0', '0', '42000', '20', '15', '10', 'Nippon Luxury Transit', 'RATE-2026-NLT-01', 'Active'],
      ['PRC-KYO-002-STD', 'PRD-KYO-002', 'Standard', 'JPY', '2026-01-01', '2026-12-31', '25000', '12500', '12500', '6000', '0', '0', '25000', '20', '15', '10', 'Kyoto Heritage Guild', 'RATE-2026-KHG-02', 'Active'],
      ['PRC-LON-003-STD', 'PRD-LON-003', 'Standard', 'GBP', '2026-01-01', '2026-12-31', '380', '190', '190', '95', '0', '0', '380', '25', '18', '20', 'British Heritage Chauffeurs', 'RATE-2026-BHC-03', 'Active'],
      ['PRC-DXB-004-STD', 'PRD-DXB-004', 'Standard', 'AED', '2026-01-01', '2026-12-31', '650', '325', '325', '150', '0', '500', '650', '20', '15', '5', 'Emirates VIP Logistics', 'RATE-2026-EVIP-04', 'Active'],
      ['PRC-HKT-005-STD', 'PRD-HKT-005', 'Standard', 'THB', '2026-01-01', '2026-12-31', '18500', '9250', '9250', '4000', '0', '18500', '0', '25', '18', '7', 'Andaman Luxury Marine', 'RATE-2026-ALM-05', 'Active']
    ]
  },

  // ----------------------------------------------------
  // 6. PRODUCT_CAPACITY TAB (Tier 5: Vehicle & Yacht Capacities)
  // ----------------------------------------------------
  {
    tabName: 'PRODUCT_CAPACITY',
    displayName: '6. Product Capacity Models (PRODUCT_CAPACITY)',
    description: 'Vehicle models, passenger thresholds, and fixed charter costs for capacity-based inventory.',
    hierarchyLevel: 5,
    parentTab: 'PRODUCTS',
    primaryKey: 'capacity_id',
    columns: [
      { name: 'product_id', key: 'product_id', type: 'string', required: true, sampleValue: 'PRD-TYO-001', description: 'Foreign key linking to PRODUCTS tab', foreignKeyTab: 'PRODUCTS', foreignKeyColumn: 'product_id' },
      { name: 'capacity_id', key: 'capacity_id', type: 'string', required: true, sampleValue: 'CAP-TYO-001-MPV', description: 'Unique capacity tier ID' },
      { name: 'capacity', key: 'capacity', type: 'number', required: true, sampleValue: '6', description: 'Maximum passenger capacity' },
      { name: 'vehicle_model', key: 'vehicle_model', type: 'string', required: true, sampleValue: 'Toyota Alphard Executive MPV (6 Pax)', description: 'Vehicle or vessel model' },
      { name: 'fixed_nett_cost', key: 'fixed_nett_cost', type: 'number', required: true, sampleValue: '65000', description: 'Fixed total net cost for this capacity tier' }
    ],
    sampleRows: [
      ['PRD-TYO-001', 'CAP-TYO-001-MPV', '6', 'Toyota Alphard Executive MPV (6 Pax)', '65000'],
      ['PRD-TYO-001', 'CAP-TYO-001-VAN', '9', 'Toyota HiAce Grand Cabin (9 Pax)', '82000'],
      ['PRD-LON-003', 'CAP-LON-003-VCLASS', '6', 'Mercedes-Benz V-Class Extra Long (6 Pax)', '750'],
      ['PRD-DXB-004', 'CAP-DXB-004-DEF', '6', 'Land Rover Defender Safari (6 Pax)', '1200'],
      ['PRD-HKT-005', 'CAP-HKT-005-SPDBOAT', '12', 'Custom 35ft Twin Yamaha Speedboat (12 Pax)', '18500']
    ]
  },

  // ----------------------------------------------------
  // 7. HOTELS TAB (Tier 4: Master Hotels & Ryokans)
  // ----------------------------------------------------
  {
    tabName: 'HOTELS',
    displayName: '7. Master Hotels (HOTELS)',
    description: 'Contracted luxury hotels, boutique resorts, and traditional ryokans.',
    hierarchyLevel: 4,
    parentTab: 'HUBS',
    primaryKey: 'hotel_id',
    columns: [
      { name: 'hotel_id', key: 'hotel_id', type: 'string', required: true, sampleValue: 'HTL-TYO-001', description: 'Unique stable Hotel ID (e.g. HTL-TYO-001)' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Foreign key to REGIONS', foreignKeyTab: 'REGIONS', foreignKeyColumn: 'region_id' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Foreign key to DESTINATIONS', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'hub_id', key: 'hub_id', type: 'string', required: true, sampleValue: 'HUB-TYO', description: 'Foreign key to HUBS', foreignKeyTab: 'HUBS', foreignKeyColumn: 'hub_id' },
      { name: 'hotel_name', key: 'hotel_name', type: 'string', required: true, sampleValue: 'Hoshinoya Tokyo Luxury Ryokan', description: 'Hotel display name' },
      { name: 'star_rating', key: 'star_rating', type: 'number', required: true, sampleValue: '5', description: 'Star rating: 3, 4, or 5' },
      { name: 'hotel_category', key: 'hotel_category', type: 'enum', required: true, sampleValue: 'RYOKAN', description: 'LUXURY_HOTEL / BOUTIQUE_RESORT / RYOKAN / BUSINESS_HOTEL / VILLA_CHALET', allowedValues: ['LUXURY_HOTEL', 'BOUTIQUE_RESORT', 'RYOKAN', 'BUSINESS_HOTEL', 'VILLA_CHALET'] },
      { name: 'address', key: 'address', type: 'string', required: true, sampleValue: '1-9-1 Otemachi, Chiyoda-ku, Tokyo, Japan', description: 'Physical street address' },
      { name: 'latitude', key: 'latitude', type: 'number', required: false, sampleValue: '35.6875', description: 'Geo coordinate' },
      { name: 'longitude', key: 'longitude', type: 'number', required: false, sampleValue: '139.7645', description: 'Geo coordinate' },
      { name: 'description', key: 'description', type: 'string', required: true, sampleValue: 'Award-winning 5-star contemporary ryokan in the heart of Tokyo featuring natural hot spring onsen.', description: 'Hotel overview' },
      { name: 'official_website', key: 'official_website', type: 'string', required: false, sampleValue: 'https://hoshinoya.com/tokyo/en/', description: 'Website URL' },
      { name: 'contact', key: 'contact', type: 'string', required: false, sampleValue: '+81 50 3786 1144 | concierge@hoshinoya.jp', description: 'Direct contact info' },
      { name: 'check_in', key: 'check_in', type: 'string', required: false, sampleValue: '15:00', description: 'Standard check-in time' },
      { name: 'check_out', key: 'check_out', type: 'string', required: false, sampleValue: '12:00', description: 'Standard check-out time' },
      { name: 'cancellation_policy', key: 'cancellation_policy', type: 'string', required: true, sampleValue: 'Free cancellation up to 14 days prior to check-in', description: 'Cancellation rules' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'PUBLISHED', description: 'PUBLISHED / DRAFT / UNPUBLISHED / ARCHIVED', allowedValues: ['PUBLISHED', 'DRAFT', 'UNPUBLISHED', 'ARCHIVED', 'Active', 'Inactive'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Display order' }
    ],
    sampleRows: [
      ['HTL-TYO-001', 'REG-001', 'DST-JPN', 'HUB-TYO', 'Hoshinoya Tokyo Luxury Ryokan', '5', 'RYOKAN', '1-9-1 Otemachi, Chiyoda-ku, Tokyo, Japan', '35.6875', '139.7645', 'Award-winning 5-star contemporary ryokan in the heart of Tokyo featuring natural hot spring onsen.', 'https://hoshinoya.com/tokyo/en/', '+81 50 3786 1144 | concierge@hoshinoya.jp', '15:00', '12:00', 'Free cancellation up to 14 days prior to check-in', 'PUBLISHED', '1'],
      ['HTL-KYO-002', 'REG-001', 'DST-JPN', 'HUB-KYO', 'The Ritz-Carlton Kyoto', '5', 'LUXURY_HOTEL', 'Kamogawa Nijo-Ohashi Hotori, Nakagyo-ku, Kyoto', '35.0135', '135.7725', 'Tranquil luxury sanctuary along the banks of the Kamogawa River with Michelin-starred dining.', 'https://www.ritzcarlton.com/kyoto', '+81 75 746 5555', '15:00', '12:00', 'Free cancellation up to 7 days prior', 'PUBLISHED', '2'],
      ['HTL-LON-003', 'REG-002', 'DST-UK', 'HUB-LON', 'The Ritz London Luxury Palace', '5', 'LUXURY_HOTEL', '150 Piccadilly, St. James\'s, London W1J 9BR', '51.5071', '-0.1417', 'Iconic British landmark luxury hotel with Michelin dining and legendary afternoon tea.', 'https://www.theritzlondon.com', '+44 20 7493 8181', '15:00', '11:00', 'Free cancellation up to 48 hours prior', 'PUBLISHED', '3'],
      ['HTL-DXB-004', 'REG-003', 'DST-UAE', 'HUB-DXB', 'Burj Al Arab Jumeirah Dubai', '5', 'LUXURY_HOTEL', 'Jumeirah Beach Road, Dubai, UAE', '25.1412', '55.1852', 'The world’s most iconic ultra-luxury all-suite hotel on a private island with chauffeur Rolls-Royce.', 'https://www.jumeirah.com', '+971 4 301 7777', '15:00', '12:00', 'Free cancellation up to 7 days prior', 'PUBLISHED', '4']
    ]
  },

  // ----------------------------------------------------
  // 8. HOTEL_ROOMS TAB (Tier 5: Room Categories)
  // ----------------------------------------------------
  {
    tabName: 'HOTEL_ROOMS',
    displayName: '8. Hotel Room Types (HOTEL_ROOMS)',
    description: 'Room categories, bed layouts, and maximum occupancy rules linked to each Hotel.',
    hierarchyLevel: 5,
    parentTab: 'HOTELS',
    primaryKey: 'room_id',
    columns: [
      { name: 'room_id', key: 'room_id', type: 'string', required: true, sampleValue: 'ROOM-TYO-001-DLX', description: 'Unique Room ID (e.g. ROOM-TYO-001-DLX)' },
      { name: 'hotel_id', key: 'hotel_id', type: 'string', required: true, sampleValue: 'HTL-TYO-001', description: 'Foreign key to HOTELS tab', foreignKeyTab: 'HOTELS', foreignKeyColumn: 'hotel_id' },
      { name: 'room_name', key: 'room_name', type: 'string', required: true, sampleValue: 'Yuri Deluxe King', description: 'Room category name' },
      { name: 'room_category', key: 'room_category', type: 'string', required: true, sampleValue: 'Deluxe Suite', description: 'Classification (e.g. Deluxe Suite, Executive Room)' },
      { name: 'max_adults', key: 'max_adults', type: 'number', required: true, sampleValue: '2', description: 'Maximum adults (e.g. 2)' },
      { name: 'max_cwb', key: 'max_cwb', type: 'number', required: false, sampleValue: '1', description: 'Max children with extra bed (e.g. 1)' },
      { name: 'max_cnb', key: 'max_cnb', type: 'number', required: false, sampleValue: '1', description: 'Max children sharing bed (e.g. 1)' },
      { name: 'max_infants', key: 'max_infants', type: 'number', required: false, sampleValue: '1', description: 'Max infants on cot (e.g. 1)' },
      { name: 'extra_bed_allowed', key: 'extra_bed_allowed', type: 'boolean', required: true, sampleValue: 'TRUE', description: 'TRUE or FALSE' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active or Inactive', allowedValues: ['Active', 'Inactive', 'ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['ROOM-TYO-001-DLX', 'HTL-TYO-001', 'Yuri Deluxe King', 'Deluxe Suite', '2', '1', '1', '1', 'TRUE', 'Active'],
      ['ROOM-TYO-001-EXE', 'HTL-TYO-001', 'Kiku Executive Suite', 'Executive Suite', '3', '1', '1', '1', 'TRUE', 'Active'],
      ['ROOM-KYO-002-DLX', 'HTL-KYO-002', 'Deluxe Kamogawa River View', 'Deluxe Room', '2', '1', '1', '1', 'TRUE', 'Active'],
      ['ROOM-LON-003-SUP', 'HTL-LON-003', 'Superior Queen Room', 'Superior Room', '2', '0', '1', '1', 'FALSE', 'Active'],
      ['ROOM-DXB-004-STE', 'HTL-DXB-004', 'Deluxe One-Bedroom Suite', 'Luxury Suite', '3', '1', '1', '1', 'TRUE', 'Active']
    ]
  },

  // ----------------------------------------------------
  // 9. HOTEL_MEAL_PLANS TAB (Tier 5: Meal Codes)
  // ----------------------------------------------------
  {
    tabName: 'HOTEL_MEAL_PLANS',
    displayName: '9. Hotel Meal Plans (HOTEL_MEAL_PLANS)',
    description: 'Contracted meal plans (RO, BB, HB, FB, AI) for each Hotel.',
    hierarchyLevel: 5,
    parentTab: 'HOTELS',
    primaryKey: 'meal_plan_id',
    columns: [
      { name: 'meal_plan_id', key: 'meal_plan_id', type: 'string', required: true, sampleValue: 'MP-TYO-001-BB', description: 'Unique Meal Plan ID (e.g. MP-TYO-001-BB)' },
      { name: 'hotel_id', key: 'hotel_id', type: 'string', required: true, sampleValue: 'HTL-TYO-001', description: 'Foreign key to HOTELS tab', foreignKeyTab: 'HOTELS', foreignKeyColumn: 'hotel_id' },
      { name: 'meal_code', key: 'meal_code', type: 'enum', required: true, sampleValue: 'BB', description: 'RO (Room Only) / BB or CP (Breakfast) / HB or MAP (Half Board) / FB or AP (Full Board) / AI (All Inclusive)', allowedValues: ['RO', 'BB', 'HB', 'FB', 'AI', 'CP', 'MAP', 'AP'] },
      { name: 'meal_name', key: 'meal_name', type: 'string', required: true, sampleValue: 'Gourmet Japanese Breakfast Included', description: 'Display name' },
      { name: 'description', key: 'description', type: 'string', required: false, sampleValue: 'Full traditional seasonal kaiseki breakfast served in-room or dining lounge.', description: 'Meal plan inclusions' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active or Inactive', allowedValues: ['Active', 'Inactive', 'ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['MP-TYO-001-RO', 'HTL-TYO-001', 'RO', 'Room Only', 'Accommodation only without meals.', 'Active'],
      ['MP-TYO-001-BB', 'HTL-TYO-001', 'BB', 'Japanese Kaiseki Breakfast Included', 'Full traditional seasonal kaiseki breakfast.', 'Active'],
      ['MP-KYO-002-BB', 'HTL-KYO-002', 'BB', 'Buffet Breakfast & Artisanal Coffee', 'Lavish international and Kyoto organic breakfast buffet.', 'Active'],
      ['MP-LON-003-BB', 'HTL-LON-003', 'BB', 'English Breakfast in Palm Court', 'Traditional British breakfast.', 'Active'],
      ['MP-DXB-004-BB', 'HTL-DXB-004', 'BB', 'Al Iwan International Buffet Breakfast', 'Lavish international gourmet buffet breakfast.', 'Active']
    ]
  },

  // ----------------------------------------------------
  // 10. HOTEL_RATES TAB (Tier 5: Per-Night Hotel Rates)
  // ----------------------------------------------------
  {
    tabName: 'HOTEL_RATES',
    displayName: '10. Hotel Nightly Rates (HOTEL_RATES)',
    description: 'Contracted per-night net tariffs by Hotel, Room, Meal Plan, and Validity Window.',
    hierarchyLevel: 5,
    parentTab: 'HOTELS',
    primaryKey: 'hotel_rate_id',
    columns: [
      { name: 'hotel_rate_id', key: 'hotel_rate_id', type: 'string', required: true, sampleValue: 'HRATE-TYO-001-01', description: 'Unique Hotel Rate ID (e.g. HRATE-TYO-001-01)' },
      { name: 'hotel_id', key: 'hotel_id', type: 'string', required: true, sampleValue: 'HTL-TYO-001', description: 'Foreign key to HOTELS tab', foreignKeyTab: 'HOTELS', foreignKeyColumn: 'hotel_id' },
      { name: 'room_id', key: 'room_id', type: 'string', required: true, sampleValue: 'ROOM-TYO-001-DLX', description: 'Foreign key to HOTEL_ROOMS tab', foreignKeyTab: 'HOTEL_ROOMS', foreignKeyColumn: 'room_id' },
      { name: 'meal_plan_id', key: 'meal_plan_id', type: 'string', required: true, sampleValue: 'MP-TYO-001-BB', description: 'Foreign key to HOTEL_MEAL_PLANS tab', foreignKeyTab: 'HOTEL_MEAL_PLANS', foreignKeyColumn: 'meal_plan_id' },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'USD', description: 'Settlement currency', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'validity_from', key: 'validity_from', type: 'date', required: true, sampleValue: '2026-01-01', description: 'ISO date YYYY-MM-DD' },
      { name: 'validity_to', key: 'validity_to', type: 'date', required: true, sampleValue: '2026-12-31', description: 'ISO date YYYY-MM-DD' },
      { name: 'nights_min', key: 'nights_min', type: 'number', required: false, sampleValue: '1', description: 'Minimum night stay' },
      { name: 'adult_nett', key: 'adult_nett', type: 'number', required: true, sampleValue: '750', description: 'Per-night Double Occupancy Net Cost' },
      { name: 'cwb_nett', key: 'cwb_nett', type: 'number', required: false, sampleValue: '150', description: 'Child with extra bed net cost' },
      { name: 'cnb_nett', key: 'cnb_nett', type: 'number', required: false, sampleValue: '80', description: 'Child sharing bed net cost' },
      { name: 'infant_nett', key: 'infant_nett', type: 'number', required: false, sampleValue: '0', description: 'Infant net cost' },
      { name: 'extra_bed_nett', key: 'extra_bed_nett', type: 'number', required: false, sampleValue: '150', description: 'Extra adult bed net cost' },
      { name: 'breakfast_nett', key: 'breakfast_nett', type: 'number', required: false, sampleValue: '0', description: 'Breakfast cost if separate' },
      { name: 'supplement', key: 'supplement', type: 'number', required: false, sampleValue: '0', description: 'Weekend or seasonal supplement' },
      { name: 'cancellation_policy', key: 'cancellation_policy', type: 'string', required: false, sampleValue: 'Free cancellation up to 14 days prior', description: 'Rate cancellation rule' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active or Inactive', allowedValues: ['Active', 'Inactive', 'ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['HRATE-TYO-001-01', 'HTL-TYO-001', 'ROOM-TYO-001-DLX', 'MP-TYO-001-BB', 'USD', '2026-01-01', '2026-12-31', '1', '750', '150', '80', '0', '150', '0', '0', 'Free cancellation up to 14 days prior', 'Active'],
      ['HRATE-TYO-001-02', 'HTL-TYO-001', 'ROOM-TYO-001-EXE', 'MP-TYO-001-BB', 'USD', '2026-01-01', '2026-12-31', '1', '1150', '200', '100', '0', '200', '0', '0', 'Free cancellation up to 14 days prior', 'Active'],
      ['HRATE-KYO-002-01', 'HTL-KYO-002', 'ROOM-KYO-002-DLX', 'MP-KYO-002-BB', 'USD', '2026-01-01', '2026-12-31', '1', '820', '160', '90', '0', '160', '0', '0', 'Free cancellation up to 7 days prior', 'Active'],
      ['HRATE-LON-003-01', 'HTL-LON-003', 'ROOM-LON-003-SUP', 'MP-LON-003-BB', 'USD', '2026-01-01', '2026-12-31', '1', '850', '180', '90', '0', '180', '0', '0', 'Free cancellation up to 48 hours prior', 'Active'],
      ['HRATE-DXB-004-01', 'HTL-DXB-004', 'ROOM-DXB-004-STE', 'MP-DXB-004-BB', 'USD', '2026-01-01', '2026-12-31', '1', '1650', '300', '150', '0', '300', '0', '0', 'Free cancellation up to 7 days prior', 'Active']
    ]
  },

  // ----------------------------------------------------
  // 11. VISA TAB (Tier 4: Visa Products & Checklists)
  // ----------------------------------------------------
  {
    tabName: 'VISA',
    displayName: '11. Visa Services (VISA)',
    description: 'Visa assistance, documentation requirements, and processing types for each Destination.',
    hierarchyLevel: 4,
    parentTab: 'DESTINATIONS',
    primaryKey: 'visa_id',
    columns: [
      { name: 'visa_id', key: 'visa_id', type: 'string', required: true, sampleValue: 'VISA-JPN-001', description: 'Unique stable Visa ID (e.g. VISA-JPN-001)' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Foreign key to REGIONS', foreignKeyTab: 'REGIONS', foreignKeyColumn: 'region_id' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Foreign key to DESTINATIONS', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'visa_type', key: 'visa_type', type: 'string', required: true, sampleValue: 'Tourist E-Visa (Single Entry)', description: 'Type classification' },
      { name: 'nationality', key: 'nationality', type: 'string', required: true, sampleValue: 'Eligible E-Visa Passports', description: 'Target nationality' },
      { name: 'processing_type', key: 'processing_type', type: 'enum', required: true, sampleValue: 'Standard', description: 'Standard / Express', allowedValues: ['Standard', 'Express'] },
      { name: 'processing_days', key: 'processing_days', type: 'number', required: true, sampleValue: '5', description: 'Working days for issuance' },
      { name: 'validity', key: 'validity', type: 'string', required: true, sampleValue: '90 Days from issuance', description: 'Visa validity period' },
      { name: 'stay_duration', key: 'stay_duration', type: 'string', required: true, sampleValue: 'Up to 30 Days', description: 'Permitted duration of stay' },
      { name: 'entry_type', key: 'entry_type', type: 'enum', required: true, sampleValue: 'SINGLE_ENTRY', description: 'SINGLE_ENTRY / MULTIPLE_ENTRY / DOUBLE_ENTRY', allowedValues: ['SINGLE_ENTRY', 'MULTIPLE_ENTRY', 'DOUBLE_ENTRY'] },
      { name: 'documentation', key: 'documentation', type: 'array', required: true, sampleValue: 'Passport Copy (6m validity); Confirmed Flights; Hotel Vouchers; Bank Statements (3m)', description: 'Semicolon-separated checklist' },
      { name: 'service_description', key: 'service_description', type: 'string', required: true, sampleValue: 'End-to-end embassy appointment, biometric coordination, document vetting, and fast-track submission.', description: 'Scope of service' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active or Inactive', allowedValues: ['Active', 'Inactive', 'ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['VISA-JPN-001', 'REG-001', 'DST-JPN', 'Tourist E-Visa (Single Entry)', 'Eligible E-Visa Passports', 'Standard', '5', '90 Days from issuance', 'Up to 30 Days', 'SINGLE_ENTRY', 'Passport Copy (6m validity); Confirmed Flight Booking; Hotel Confirmation Vouchers; 3 Months Bank Statements', 'Complete document verification, digital eVisa filing, and embassy status tracking.', 'Active'],
      ['VISA-UK-002', 'REG-002', 'DST-UK', 'Standard Visitor Visa (6 Months)', 'All Eligible Nationalities', 'Standard', '15', '6 Months Multiple Entry', 'Up to 180 Days', 'MULTIPLE_ENTRY', 'Original Passport; Employment Letter; 6 Months Bank Statements; Detailed Travel Itinerary; Proof of Accommodation', 'Full UKVI dossier preparation, VFS priority appointment booking, and visa consultation.', 'Active'],
      ['VISA-UAE-003', 'REG-003', 'DST-UAE', 'Tourist E-Visa 30 Days (Single Entry)', 'All Nationalities Eligible', 'Express', '2', '60 Days from issuance', 'Up to 30 Days', 'SINGLE_ENTRY', 'Passport Bio Page Scan; Passport Photo with White Background; Confirmed Return Air Tickets', 'Instant UAE immigration system lodgement with 24-48 hour guaranteed approval SLA.', 'Active'],
      ['VISA-THA-004', 'REG-004', 'DST-THA', 'Tourist E-Visa on Arrival (EVOA)', 'Eligible Nationalities', 'Express', '1', '30 Days from arrival', 'Up to 15 Days', 'SINGLE_ENTRY', 'Passport Bio Page; Hotel Voucher; Return Air Ticket', 'Pre-approved express eVisa on arrival bypassing airport customs queues.', 'Active']
    ]
  },

  // ----------------------------------------------------
  // 12. VISA_RATES TAB (Tier 5: Visa Rates & Fees)
  // ----------------------------------------------------
  {
    tabName: 'VISA_RATES',
    displayName: '12. Visa Pricing & Rates (VISA_RATES)',
    description: 'Embassy fees, DMC service fees, and wholesale margins for Visa services.',
    hierarchyLevel: 5,
    parentTab: 'VISA',
    primaryKey: 'visa_rate_id',
    columns: [
      { name: 'visa_rate_id', key: 'visa_rate_id', type: 'string', required: true, sampleValue: 'VRATE-JPN-001', description: 'Unique rate ID (e.g. VRATE-JPN-001)' },
      { name: 'visa_id', key: 'visa_id', type: 'string', required: true, sampleValue: 'VISA-JPN-001', description: 'Foreign key to VISA tab', foreignKeyTab: 'VISA', foreignKeyColumn: 'visa_id' },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'USD', description: 'Settlement currency', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'validity_from', key: 'validity_from', type: 'date', required: true, sampleValue: '2026-01-01', description: 'ISO date YYYY-MM-DD' },
      { name: 'validity_to', key: 'validity_to', type: 'date', required: true, sampleValue: '2026-12-31', description: 'ISO date YYYY-MM-DD' },
      { name: 'adult_nett', key: 'adult_nett', type: 'number', required: true, sampleValue: '25', description: 'Embassy consular net fee per adult' },
      { name: 'child_nett', key: 'child_nett', type: 'number', required: false, sampleValue: '25', description: 'Embassy consular fee per child' },
      { name: 'infant_nett', key: 'infant_nett', type: 'number', required: false, sampleValue: '0', description: 'Embassy fee per infant' },
      { name: 'service_fee', key: 'service_fee', type: 'number', required: true, sampleValue: '35', description: 'DMC processing & filing service fee' },
      { name: 'markup_buyer', key: 'markup_buyer', type: 'number', required: true, sampleValue: '15', description: 'Buyer markup %' },
      { name: 'markup_agent', key: 'markup_agent', type: 'number', required: true, sampleValue: '10', description: 'B2B agent markup %' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active or Inactive', allowedValues: ['Active', 'Inactive', 'ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['VRATE-JPN-001', 'VISA-JPN-001', 'USD', '2026-01-01', '2026-12-31', '25', '25', '0', '35', '15', '10', 'Active'],
      ['VRATE-UK-002', 'VISA-UK-002', 'USD', '2026-01-01', '2026-12-31', '145', '145', '0', '75', '15', '10', 'Active'],
      ['VRATE-UAE-003', 'VISA-UAE-003', 'USD', '2026-01-01', '2026-12-31', '95', '95', '0', '25', '15', '10', 'Active'],
      ['VRATE-THA-004', 'VISA-THA-004', 'USD', '2026-01-01', '2026-12-31', '60', '60', '0', '20', '15', '10', 'Active']
    ]
  },

  // ----------------------------------------------------
  // 13. TRANSFER_ROUTES TAB (Tier 4: Airport & Intercity Transfers)
  // ----------------------------------------------------
  {
    tabName: 'TRANSFER_ROUTES',
    displayName: '13. Transfer Routes (TRANSFER_ROUTES)',
    description: 'Airport arrivals, departures, intercity transfers, and point-to-point private logistics.',
    hierarchyLevel: 4,
    parentTab: 'DESTINATIONS',
    primaryKey: 'route_id',
    columns: [
      { name: 'route_id', key: 'route_id', type: 'string', required: true, sampleValue: 'TRF-TYO-HND-001', description: 'Unique stable Route ID (e.g. TRF-TYO-HND-001)' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Foreign key to DESTINATIONS', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'from_hub_id', key: 'from_hub_id', type: 'string', required: true, sampleValue: 'HUB-TYO', description: 'Starting hub ID (Foreign key to HUBS)', foreignKeyTab: 'HUBS', foreignKeyColumn: 'hub_id' },
      { name: 'to_hub_id', key: 'to_hub_id', type: 'string', required: true, sampleValue: 'HUB-TYO', description: 'Ending hub ID (Foreign key to HUBS)', foreignKeyTab: 'HUBS', foreignKeyColumn: 'hub_id' },
      { name: 'route_name', key: 'route_name', type: 'string', required: true, sampleValue: 'Tokyo Haneda Airport -> Tokyo City Hotels', description: 'Display name of transfer route' },
      { name: 'transfer_type', key: 'transfer_type', type: 'enum', required: true, sampleValue: 'AIRPORT_ARRIVAL', description: 'AIRPORT_ARRIVAL / AIRPORT_DEPARTURE / INTERCITY / POINT_TO_POINT / PORT_TRANSFER', allowedValues: ['AIRPORT_ARRIVAL', 'AIRPORT_DEPARTURE', 'INTERCITY', 'POINT_TO_POINT', 'PORT_TRANSFER'] },
      { name: 'vehicle_type', key: 'vehicle_type', type: 'string', required: true, sampleValue: 'Toyota Alphard Executive MPV (6 Pax)', description: 'Vehicle model & capacity' },
      { name: 'max_capacity', key: 'max_capacity', type: 'number', required: true, sampleValue: '6', description: 'Max passenger seating' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active or Inactive', allowedValues: ['Active', 'Inactive', 'ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['TRF-TYO-HND-001', 'DST-JPN', 'HUB-TYO', 'HUB-TYO', 'Tokyo Haneda Airport -> Tokyo City Hotels Arrival Transfer', 'AIRPORT_ARRIVAL', 'Toyota Alphard Executive MPV (6 Pax)', '6', 'Active'],
      ['TRF-TYO-NRT-002', 'DST-JPN', 'HUB-TYO', 'HUB-TYO', 'Tokyo Narita Airport -> Tokyo City Hotels Arrival Transfer', 'AIRPORT_ARRIVAL', 'Toyota HiAce Grand Cabin (9 Pax)', '9', 'Active'],
      ['TRF-TYO-HAK-003', 'DST-JPN', 'HUB-TYO', 'HUB-HAK', 'Tokyo City Hotels -> Hakone Ryokan Intercity Chauffeur', 'INTERCITY', 'Toyota Alphard Executive MPV (6 Pax)', '6', 'Active'],
      ['TRF-LON-LHR-004', 'DST-UK', 'HUB-LON', 'HUB-LON', 'London Heathrow Airport -> Central London Hotels VIP Arrival', 'AIRPORT_ARRIVAL', 'Mercedes-Benz V-Class Extra Long (6 Pax)', '6', 'Active'],
      ['TRF-DXB-AIR-005', 'DST-UAE', 'HUB-DXB', 'HUB-DXB', 'Dubai Airport (DXB) -> Dubai Hotels VIP Chauffeur Transfer', 'AIRPORT_ARRIVAL', 'Mercedes-Benz V-Class Luxury (6 Pax)', '6', 'Active']
    ]
  },

  // ----------------------------------------------------
  // 14. TRANSFER_RATES TAB (Tier 5: Transfer Rates & Vehicle Pricing)
  // ----------------------------------------------------
  {
    tabName: 'TRANSFER_RATES',
    displayName: '14. Transfer Rates & Vehicle Pricing (TRANSFER_RATES)',
    description: 'Fixed vehicle/route net tariffs for private and SIC transfers.',
    hierarchyLevel: 5,
    parentTab: 'TRANSFER_ROUTES',
    primaryKey: 'transfer_rate_id',
    columns: [
      { name: 'transfer_rate_id', key: 'transfer_rate_id', type: 'string', required: true, sampleValue: 'TRATE-TYO-001', description: 'Unique rate ID (e.g. TRATE-TYO-001)' },
      { name: 'route_id', key: 'route_id', type: 'string', required: true, sampleValue: 'TRF-TYO-HND-001', description: 'Foreign key to TRANSFER_ROUTES tab', foreignKeyTab: 'TRANSFER_ROUTES', foreignKeyColumn: 'route_id' },
      { name: 'rate_type', key: 'rate_type', type: 'enum', required: true, sampleValue: 'PRIVATE', description: 'PRIVATE / SIC / VIP', allowedValues: ['PRIVATE', 'SIC', 'VIP'] },
      { name: 'vehicle', key: 'vehicle', type: 'string', required: true, sampleValue: 'Toyota Alphard Executive MPV', description: 'Vehicle model' },
      { name: 'capacity', key: 'capacity', type: 'number', required: true, sampleValue: '6', description: 'Max passenger capacity' },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Settlement currency', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'nett_cost', key: 'nett_cost', type: 'number', required: true, sampleValue: '28000', description: 'Fixed total net cost for the vehicle transfer' }
    ],
    sampleRows: [
      ['TRATE-TYO-001', 'TRF-TYO-HND-001', 'PRIVATE', 'Toyota Alphard Executive MPV', '6', 'JPY', '28000'],
      ['TRATE-TYO-002', 'TRF-TYO-NRT-002', 'PRIVATE', 'Toyota HiAce Grand Cabin', '9', 'JPY', '42000'],
      ['TRATE-TYO-003', 'TRF-TYO-HAK-003', 'PRIVATE', 'Toyota Alphard Executive MPV', '6', 'JPY', '58000'],
      ['TRATE-LON-004', 'TRF-LON-LHR-004', 'PRIVATE', 'Mercedes-Benz V-Class Extra Long', '6', 'GBP', '220'],
      ['TRATE-DXB-005', 'TRF-DXB-AIR-005', 'PRIVATE', 'Mercedes-Benz V-Class Luxury', '6', 'AED', '550']
    ]
  },

  // ----------------------------------------------------
  // 15. PACKAGES TAB (Tier 6: Multi-Day Curated Circuits)
  // ----------------------------------------------------
  {
    tabName: 'PACKAGES',
    displayName: '15. Curated Circuits (PACKAGES)',
    description: 'Multi-day ready-to-book itineraries combining hotels, day tours, and private transfers.',
    hierarchyLevel: 6,
    parentTab: 'DESTINATIONS',
    primaryKey: 'package_id',
    columns: [
      { name: 'package_id', key: 'package_id', type: 'string', required: true, sampleValue: 'PKG-JPN-001', description: 'Unique stable Package ID (e.g. PKG-JPN-001)' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'REG-001', description: 'Foreign key to REGIONS', foreignKeyTab: 'REGIONS', foreignKeyColumn: 'region_id' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'Foreign key to DESTINATIONS', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'package_name', key: 'package_name', type: 'string', required: true, sampleValue: 'Classic Golden Route Japan Luxury Circuit', description: 'Package display title' },
      { name: 'description', key: 'description', type: 'string', required: true, sampleValue: '7-Day bespoke private luxury journey through Tokyo, Hakone onsen, and Kyoto shrines with private chauffeur.', description: 'Comprehensive package overview' },
      { name: 'nights', key: 'nights', type: 'number', required: true, sampleValue: '6', description: 'Total nights (e.g. 6)' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active / Draft / Archived / Inactive', allowedValues: ['Active', 'Draft', 'Archived', 'Inactive', 'ACTIVE', 'DRAFT', 'ARCHIVED', 'INACTIVE'] },
      { name: 'image_url', key: 'image_url', type: 'string', required: false, sampleValue: 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200', description: 'Hero banner image link' },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Display priority' }
    ],
    sampleRows: [
      ['PKG-JPN-001', 'REG-001', 'DST-JPN', 'Classic Golden Route Japan Luxury Circuit', '7-Day bespoke private luxury journey through Tokyo, Hakone onsen, and Kyoto shrines with private chauffeur.', '6', 'Active', 'https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?q=80&w=1200', '1'],
      ['PKG-UK-002', 'REG-002', 'DST-UK', 'Quintessential Britain: London & Cotswolds Manors', '6-Day luxury British heritage tour featuring private manor stays, historic palace access, and Mercedes chauffeur.', '5', 'Active', 'https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?q=80&w=1200', '2'],
      ['PKG-DXB-003', 'REG-003', 'DST-UAE', 'Emirates Ultra Luxury & Desert Escape', '5-Day VIP Dubai immersion featuring Burj Al Arab suite, private desert conservation camp, and yacht charter.', '4', 'Active', 'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?q=80&w=1200', '3']
    ]
  },

  // ----------------------------------------------------
  // 16. PACKAGE_ITEMS TAB (Tier 6: Package Day-Wise Line Items)
  // ----------------------------------------------------
  {
    tabName: 'PACKAGE_ITEMS',
    displayName: '16. Package Line Items (PACKAGE_ITEMS)',
    description: 'Day-by-day item allocations (products, hotels, transfers, rail) for curated packages.',
    hierarchyLevel: 6,
    parentTab: 'PACKAGES',
    primaryKey: 'package_item_id',
    columns: [
      { name: 'package_item_id', key: 'package_item_id', type: 'string', required: true, sampleValue: 'PKGITEM-001', description: 'Unique line item ID (e.g. PKGITEM-001)' },
      { name: 'package_id', key: 'package_id', type: 'string', required: true, sampleValue: 'PKG-JPN-001', description: 'Foreign key to PACKAGES tab', foreignKeyTab: 'PACKAGES', foreignKeyColumn: 'package_id' },
      { name: 'day_number', key: 'day_number', type: 'number', required: true, sampleValue: '1', description: 'Day slot number (e.g. 1, 2, 3)' },
      { name: 'hub_id', key: 'hub_id', type: 'string', required: true, sampleValue: 'HUB-TYO', description: 'Foreign key to HUBS tab', foreignKeyTab: 'HUBS', foreignKeyColumn: 'hub_id' },
      { name: 'item_type', key: 'item_type', type: 'enum', required: true, sampleValue: 'transfer', description: 'product / hotel / transfer / rail / activity / guide', allowedValues: ['product', 'hotel', 'transfer', 'rail', 'activity', 'guide'] },
      { name: 'item_id', key: 'item_id', type: 'string', required: true, sampleValue: 'TRF-TYO-HND-001', description: 'Foreign key to matching entity table (Product SKU, Hotel ID, Transfer Route ID)' },
      { name: 'quantity', key: 'quantity', type: 'number', required: true, sampleValue: '1', description: 'Quantity multiplier' },
      { name: 'remarks', key: 'remarks', type: 'string', required: false, sampleValue: 'VIP Haneda Arrival Meet & Greet with luggage assistance', description: 'Operational notes' }
    ],
    sampleRows: [
      ['PKGITEM-001', 'PKG-JPN-001', '1', 'HUB-TYO', 'transfer', 'TRF-TYO-HND-001', '1', 'VIP Haneda Arrival Meet & Greet with luggage assistance'],
      ['PKGITEM-002', 'PKG-JPN-001', '1', 'HUB-TYO', 'hotel', 'HTL-TYO-001', '1', 'Hoshinoya Tokyo Yuri Deluxe Suite Check-in'],
      ['PKGITEM-003', 'PKG-JPN-001', '2', 'HUB-TYO', 'product', 'PRD-TYO-001', '1', 'Tokyo Modern & Edo Heritage Full-Day Private Tour'],
      ['PKGITEM-004', 'PKG-JPN-001', '3', 'HUB-KYO', 'product', 'PRD-KYO-002', '1', 'Private Authentic Tea Ceremony in Gion, Kyoto']
    ]
  }
];

// Helper to get schema by tab name
export function getTabSchemaByName(tabName: string): MasterSheetTabDefinition | undefined {
  const cleanName = tabName.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return MASTER_SHEETS_TAB_DEFINITIONS.find(t => 
    t.tabName.toUpperCase() === cleanName || 
    t.displayName.toUpperCase().includes(cleanName)
  );
}

// Helper to get all header strings for a given tab
export function getMasterSheetHeaders(tabName: string): string[] {
  const schema = getTabSchemaByName(tabName);
  return schema ? schema.columns.map(c => c.name) : [];
}

// Helper to generate downloadable sample CSV text for a specific tab
export function generateSampleCsv(tabName: string): string {
  const schema = getTabSchemaByName(tabName);
  if (!schema) return '';
  const headers = schema.columns.map(c => `"${c.name}"`).join(',');
  const sampleRows = schema.sampleRows.map(r => r.map(c => `"${(c || '').replace(/"/g, '""')}"`).join(','));
  return `${headers}\n${sampleRows.join('\n')}`;
}

// Helper to generate a multi-tab workbook dictionary or complete CSV bundle
export function generateAllTabsCsvBundle(): Record<string, string> {
  const bundle: Record<string, string> = {};
  for (const tab of MASTER_SHEETS_TAB_DEFINITIONS) {
    bundle[tab.tabName] = generateSampleCsv(tab.tabName);
  }
  return bundle;
}

/**
 * Approved canonical 16-worksheet column headers for TheUnbound production schema.
 */
export const CANONICAL_SCHEMA_HEADERS: Record<MasterSheetTabName, string[]> = {
  REGIONS: ['region_id', 'region_name', 'slug', 'description', 'status', 'sort_order', 'seo_title', 'seo_description'],
  DESTINATIONS: ['destination_id', 'region_id', 'destination_name', 'slug', 'country', 'currency', 'description', 'hero_image_url', 'tagline', 'best_time', 'recommended_duration', 'status', 'sort_order', 'seo_title', 'seo_description'],
  HUBS: ['hub_id', 'destination_id', 'hub_name', 'slug', 'hub_type', 'description', 'latitude', 'longitude', 'status', 'sort_order', 'seo_title', 'seo_description'],
  PRODUCTS: ['product_id', 'destination_id', 'hub_id', 'product_category', 'product_name', 'slug', 'description', 'supplier_name', 'duration', 'meeting_point', 'status', 'is_featured', 'sort_order', 'seo_title', 'seo_description'],
  PRODUCT_PRICING: ['product_pricing_id', 'product_id', 'currency', 'nett_cost', 'buyer_markup_pct', 'b2b_markup_pct', 'selling_price_override', 'valid_from', 'valid_to', 'status'],
  PRODUCT_CAPACITY: ['product_capacity_id', 'product_id', 'capacity', 'vehicle_or_yacht_model', 'capacity_notes', 'status'],
  HOTELS: ['hotel_id', 'destination_id', 'hub_id', 'hotel_name', 'slug', 'category', 'star_rating', 'address', 'latitude', 'longitude', 'nearest_airport', 'nearest_railway_station', 'description', 'status', 'is_featured', 'seo_title', 'seo_description'],
  HOTEL_ROOMS: ['room_id', 'hotel_id', 'room_name', 'room_type', 'max_adults', 'max_children', 'max_infants', 'max_occupancy', 'available_rooms', 'status'],
  HOTEL_MEAL_PLANS: ['meal_plan_id', 'hotel_id', 'meal_plan_code', 'meal_plan_name', 'description', 'status'],
  HOTEL_RATES: ['hotel_rate_id', 'hotel_id', 'room_id', 'meal_plan_id', 'currency', 'rate_type', 'nett_cost', 'buyer_markup_pct', 'b2b_markup_pct', 'selling_price_override', 'valid_from', 'valid_to', 'min_nights', 'status'],
  VISA: ['visa_id', 'destination_id', 'visa_name', 'visa_type', 'nationality_scope', 'description', 'processing_time', 'validity', 'status', 'seo_title', 'seo_description'],
  VISA_RATES: ['visa_rate_id', 'visa_id', 'currency', 'nett_cost', 'buyer_markup_pct', 'b2b_markup_pct', 'selling_price_override', 'valid_from', 'valid_to', 'status'],
  TRANSFER_ROUTES: ['transfer_route_id', 'destination_id', 'from_hub_id', 'to_hub_id', 'route_name', 'distance_km', 'estimated_duration_minutes', 'status'],
  TRANSFER_RATES: ['transfer_rate_id', 'transfer_route_id', 'capacity', 'vehicle_model', 'currency', 'nett_cost', 'buyer_markup_pct', 'b2b_markup_pct', 'selling_price_override', 'valid_from', 'valid_to', 'status'],
  PACKAGES: ['package_id', 'destination_id', 'package_name', 'slug', 'duration_nights', 'duration_days', 'description', 'package_type', 'status', 'is_featured', 'seo_title', 'seo_description'],
  PACKAGE_ITEMS: ['package_item_id', 'package_id', 'day_number', 'item_type', 'item_id', 'hub_id', 'sequence', 'notes', 'is_optional', 'status']
};

/**
 * Approved canonical ordering for processing and sheets layout
 */
export const CANONICAL_TAB_PROCESSING_ORDER: MasterSheetTabName[] = [
  'REGIONS',
  'DESTINATIONS',
  'HUBS',
  'PRODUCTS',
  'PRODUCT_PRICING',
  'PRODUCT_CAPACITY',
  'HOTELS',
  'HOTEL_ROOMS',
  'HOTEL_MEAL_PLANS',
  'HOTEL_RATES',
  'VISA',
  'VISA_RATES',
  'TRANSFER_ROUTES',
  'TRANSFER_RATES',
  'PACKAGES',
  'PACKAGE_ITEMS'
];

/**
 * Generates an authentic .xlsx workbook containing exactly the canonical 16 worksheets.
 * Each worksheet contains the approved column headers and schema.
 * Blank templates are provided without mock/fake production records.
 */
export function generateCanonicalExcelWorkbookBlob(): Blob {
  const wb = XLSX.utils.book_new();

  for (const tabName of CANONICAL_TAB_PROCESSING_ORDER) {
    const headers = CANONICAL_SCHEMA_HEADERS[tabName] || [];
    const ws = XLSX.utils.aoa_to_sheet([headers]);
    XLSX.utils.book_append_sheet(wb, ws, tabName);
  }

  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  return new Blob([wbout], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  });
}

