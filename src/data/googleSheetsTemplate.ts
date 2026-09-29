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
      { name: 'meal', key: 'meal', type: 'string', required: false, sampleValue: 'Lunch', description: 'Meal type for Restaurants (Breakfast, Lunch, Dinner)' },
      { name: 'passenger_type', key: 'passenger_type', type: 'string', required: false, sampleValue: 'Adult', description: 'Passenger classification (Adult, Child, Infant)' },
      { name: 'language', key: 'language', type: 'string', required: false, sampleValue: 'English', description: 'Language specialization for Guide inventory' },
      { name: 'duration_hours', key: 'duration_hours', type: 'number', required: false, sampleValue: '4', description: 'Minimum duration commitment in hours' },
      { name: 'markup_buyer', key: 'markup_buyer', type: 'number', required: true, sampleValue: '20', description: 'Retail Buyer markup % (e.g. 20)' },
      { name: 'markup_agent', key: 'markup_agent', type: 'number', required: true, sampleValue: '15', description: 'B2B Wholesale Agent markup % (e.g. 15)' },
      { name: 'tax_percentage', key: 'tax_percentage', type: 'number', required: true, sampleValue: '10', description: 'Compulsory VAT/GST %' },
      { name: 'service_charge', key: 'service_charge', type: 'number', required: false, sampleValue: '0', description: 'Service charge amount' },
      { name: 'final_price', key: 'final_price', type: 'number', required: false, sampleValue: '51240', description: 'Pre-calculated final selling price' },
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
    description: 'Product-specific capacity rules mapping passenger ranges to required vehicle counts and commercial pricing.',
    hierarchyLevel: 5,
    parentTab: 'PRODUCTS',
    primaryKey: 'capacity_id',
    columns: [
      { name: 'product_id', key: 'product_id', type: 'string', required: true, sampleValue: 'PRD-TYO-TRANSFER', description: 'Foreign key linking to PRODUCTS tab', foreignKeyTab: 'PRODUCTS', foreignKeyColumn: 'product_id' },
      { name: 'capacity_id', key: 'capacity_id', type: 'string', required: true, sampleValue: 'CAP-TRN-ALPHARD-01', description: 'Unique capacity tier ID' },
      { name: 'category', key: 'category', type: 'string', required: true, sampleValue: 'Transfers', description: 'Product Category (Transfers, Private Tours, Private Yacht)' },
      { name: 'fleet_id', key: 'fleet_id', type: 'string', required: true, sampleValue: 'VEH-ALPHARD-01', description: 'Operational Fleet Vehicle or Yacht ID' },
      { name: 'pax_from', key: 'pax_from', type: 'number', required: true, sampleValue: '1', description: 'Minimum passenger threshold (Min Pax)' },
      { name: 'pax_to', key: 'pax_to', type: 'number', required: true, sampleValue: '3', description: 'Maximum passenger threshold (Max Pax)' },
      { name: 'vehicle_count', key: 'vehicle_count', type: 'number', required: true, sampleValue: '1', description: 'Required count of vehicles for this passenger range' },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Currency code', allowedValues: ['JPY', 'USD', 'EUR', 'GBP', 'THB', 'AED', 'INR', 'AUD', 'CHF', 'CAD', 'SGD'] },
      { name: 'supplier_nett', key: 'supplier_nett', type: 'number', required: true, sampleValue: '18000', description: 'Authoritative supplier base nett cost for this capacity tier' },
      { name: 'nett_price', key: 'nett_price', type: 'number', required: false, sampleValue: '18000', description: 'Legacy alias for supplier nett cost' },
      { name: 'margin', key: 'margin', type: 'number', required: true, sampleValue: '20', description: 'Commercial markup percentage (e.g. 20)' },
      { name: 'tax', key: 'tax', type: 'number', required: true, sampleValue: '10', description: 'VAT / Tax percentage (e.g. 10)' },
      { name: 'service_charge', key: 'service_charge', type: 'number', required: false, sampleValue: '0', description: 'Fixed service charge amount' },
      { name: 'final_price', key: 'final_price', type: 'number', required: false, sampleValue: '21960', description: 'Delivered commercial selling price' },
      { name: 'vehicle_model', key: 'vehicle_model', type: 'string', required: false, sampleValue: 'Toyota Alphard Executive MPV', description: 'Descriptive vehicle or yacht model' },
      { name: 'effective_from', key: 'effective_from', type: 'string', required: false, sampleValue: '2026-01-01', description: 'Validity start date (YYYY-MM-DD)' },
      { name: 'effective_to', key: 'effective_to', type: 'string', required: false, sampleValue: '2026-12-31', description: 'Validity end date (YYYY-MM-DD)' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'Active', description: 'Active or Inactive', allowedValues: ['Active', 'Inactive', 'ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['PRD-TYO-TRANSFER', 'CAP-TRN-ALPHARD-01', 'Transfers', 'VEH-ALPHARD-01', '1', '3', '1', 'JPY', '18000', '20', '10', '0', '21960', 'Toyota Alphard Executive MPV (1-3 Pax)', 'Active'],
      ['PRD-TYO-TRANSFER', 'CAP-TRN-ALPHARD-02', 'Transfers', 'VEH-ALPHARD-01', '4', '6', '2', 'JPY', '36000', '20', '10', '0', '43920', 'Toyota Alphard Executive MPV (4-6 Pax -> 2 Vehicles)', 'Active'],
      ['PRD-TYO-001', 'CAP-TYO-TOUR-01', 'Private Tours', 'VEH-ALPHARD-01', '1', '6', '1', 'JPY', '42000', '20', '10', '0', '51240', 'Toyota Alphard Executive MPV (1-6 Pax Tour)', 'Active'],
      ['PRD-TYO-001', 'CAP-TYO-TOUR-02', 'Private Tours', 'VEH-ALPHARD-01', '7', '12', '2', 'JPY', '84000', '20', '10', '0', '102480', 'Toyota Alphard Executive MPV (7-12 Pax Tour -> 2 Vehicles)', 'Active'],
      ['PRD-HKT-005', 'CAP-HKT-YACHT-01', 'Private Yacht', 'YACHT-AZIMUT-66', '1', '10', '1', 'THB', '150000', '20', '7', '0', '182100', 'Azimut 66 Luxury Flybridge Yacht Charter', 'Active']
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
  // 13. TRAVEL_PROTECTION TAB (Tier 4: Insurance & Medical)
  // ----------------------------------------------------
  {
    tabName: 'TRAVEL_PROTECTION',
    displayName: '13. Travel Protection & Medical (TRAVEL_PROTECTION)',
    description: 'International travel insurance, emergency medical cover, trip interruption, and consular compliant protection plans.',
    hierarchyLevel: 4,
    parentTab: 'DESTINATIONS',
    primaryKey: 'protection_id',
    columns: [
      { name: 'protection_id', key: 'protection_id', type: 'string', required: true, sampleValue: 'PROT-GLB-COMP-01', description: 'Unique stable Protection Plan ID' },
      { name: 'service_name', key: 'service_name', type: 'string', required: true, sampleValue: 'Worldwide Comprehensive Platinum Shield', description: 'Display Plan Name' },
      { name: 'provider', key: 'provider', type: 'string', required: true, sampleValue: 'Allianz Global Assistance', description: 'Insurance Underwriter / Provider' },
      { name: 'coverage_area', key: 'coverage_area', type: 'string', required: true, sampleValue: 'Worldwide incl. US/Canada', description: 'Jurisdiction or geographic zone' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: false, sampleValue: 'dest-japan', description: 'Destination FK if country-specific' },
      { name: 'medical_coverage_amount', key: 'medical_coverage_amount', type: 'number', required: true, sampleValue: '500000', description: 'Medical coverage limit in currency' },
      { name: 'emergency_assistance_included', key: 'emergency_assistance_included', type: 'boolean', required: true, sampleValue: 'TRUE', description: 'TRUE or FALSE' },
      { name: 'evacuation_coverage_amount', key: 'evacuation_coverage_amount', type: 'number', required: false, sampleValue: '250000', description: 'Evacuation & repatriation limit' },
      { name: 'trip_cancellation_amount', key: 'trip_cancellation_amount', type: 'number', required: false, sampleValue: '10000', description: 'Cancellation limit' },
      { name: 'baggage_loss_amount', key: 'baggage_loss_amount', type: 'number', required: false, sampleValue: '3000', description: 'Luggage loss reimbursement' },
      { name: 'validity_days_max', key: 'validity_days_max', type: 'number', required: true, sampleValue: '45', description: 'Maximum trip days covered' },
      { name: 'eligibility_age_min', key: 'eligibility_age_min', type: 'number', required: false, sampleValue: '0', description: 'Minimum age eligibility' },
      { name: 'eligibility_age_max', key: 'eligibility_age_max', type: 'number', required: false, sampleValue: '85', description: 'Maximum age eligibility' },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'USD', description: 'Currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'net_cost_per_day', key: 'net_cost_per_day', type: 'number', required: false, sampleValue: '4.5', description: 'Per day net cost' },
      { name: 'net_cost_per_trip', key: 'net_cost_per_trip', type: 'number', required: true, sampleValue: '35', description: 'Per trip fixed net cost' },
      { name: 'selling_price_per_day', key: 'selling_price_per_day', type: 'number', required: false, sampleValue: '7.0', description: 'Per day selling price' },
      { name: 'selling_price_per_trip', key: 'selling_price_per_trip', type: 'number', required: true, sampleValue: '55', description: 'Per trip selling price' },
      { name: 'inclusions', key: 'inclusions', type: 'array', required: true, sampleValue: 'USD 500,000 Medical Cover; USD 250,000 Evacuation; 24/7 Helpline', description: 'Semicolon-separated inclusions' },
      { name: 'customer_description', key: 'customer_description', type: 'string', required: true, sampleValue: 'Premium global travel protection with cashless claims.', description: 'Client overview' },
      { name: 'terms', key: 'terms', type: 'string', required: false, sampleValue: 'Covers emergency hospitalization, delayed transit, and COVID treatment.', description: 'Policy terms & conditions' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE / INACTIVE / ARCHIVED', allowedValues: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Display sequence' }
    ],
    sampleRows: [
      ['PROT-GLB-COMP-01', 'Worldwide Comprehensive Platinum Shield', 'Allianz Global Assistance', 'Worldwide incl. US/Canada', '', '500000', 'TRUE', '250000', '10000', '3000', '45', '0', '85', 'USD', '4.5', '35', '7.0', '55', 'USD 500,000 Medical Cover; USD 250,000 Evacuation; 24/7 Helpline', 'Premium global travel protection with cashless claims.', 'Covers emergency hospitalization, delayed transit, and COVID treatment.', 'ACTIVE', '1'],
      ['PROT-GLB-STD-02', 'Worldwide Classic Leisure Shield', 'Allianz Global Assistance', 'Worldwide excl. US/Canada', '', '250000', 'TRUE', '100000', '5000', '1500', '30', '0', '75', 'USD', '2.8', '22', '4.5', '38', 'USD 250,000 Medical Cover; USD 100,000 Evacuation; USD 5,000 Interruption', 'Essential medical emergency and luggage protection for leisure touring.', 'Covers accidental injury, acute illness, and delayed transit.', 'ACTIVE', '2'],
      ['PROT-EU-SCHENGEN-03', 'European Schengen Visa Compliant Shield', 'AXA Assistance Schengen', 'Schengen (29 European Nations)', 'dest-europe', '50000', 'TRUE', '50000', '2500', '1000', '90', '0', '80', 'USD', '2.0', '18', '3.5', '30', 'EUR 30,000 / USD 50,000 Consular compliant medical cover; Zero deductible', 'Official embassy-approved Schengen travel insurance certificate.', 'Fully compliant with EU Regulation (EC) No 810/2009.', 'ACTIVE', '3'],
      ['PROT-ASIA-REG-04', 'Asia Regional Explorer Shield', 'Sompo Japan / Care Health', 'Asia Regional (Japan, Thailand, UAE, Singapore)', 'dest-japan', '100000', 'TRUE', '50000', '3000', '1000', '21', '0', '75', 'USD', '1.8', '14', '3.0', '25', 'USD 100,000 Asian regional hospitalization; Cashless hospital admission', 'Tailored Asian holiday coverage including street food digestive cover.', 'Specialized low-tariff protection policy for Far East vacation circuits.', 'ACTIVE', '4']
    ]
  },

  // ----------------------------------------------------
  // 14. VIP_GROUND TAB (Tier 4: Airport & Station Concierge)
  // ----------------------------------------------------
  {
    tabName: 'VIP_GROUND',
    displayName: '14. VIP Ground & Concierge (VIP_GROUND)',
    description: 'VIP airport fast track, meet-and-greet, luxury chauffeur airport escorts, and train station porterage.',
    hierarchyLevel: 4,
    parentTab: 'DESTINATIONS',
    primaryKey: 'vip_id',
    columns: [
      { name: 'vip_id', key: 'vip_id', type: 'string', required: true, sampleValue: 'VIP-TYO-NRT-01', description: 'Unique stable VIP Service ID' },
      { name: 'name', key: 'name', type: 'string', required: true, sampleValue: 'Tokyo Narita (NRT) Airside VIP Meet & Fast Track', description: 'Service Name' },
      { name: 'service_type', key: 'service_type', type: 'enum', required: true, sampleValue: 'MEET_AND_GREET', description: 'MEET_AND_GREET / VIP_TRANSFER / CHAUFFEUR / FAST_TRACK / LOUNGE_ACCESS / PORTERAGE / CONCIERGE', allowedValues: ['MEET_AND_GREET', 'VIP_TRANSFER', 'CHAUFFEUR', 'FAST_TRACK', 'LOUNGE_ACCESS', 'PORTERAGE', 'CONCIERGE'] },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'DST-JPN', description: 'FK to DESTINATIONS tab', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'hub_id', key: 'hub_id', type: 'string', required: false, sampleValue: 'HUB-TYO', description: 'FK to HUBS tab', foreignKeyTab: 'HUBS', foreignKeyColumn: 'hub_id' },
      { name: 'supplier_name', key: 'supplier_name', type: 'string', required: true, sampleValue: 'Nippon Luxury Transit Concierge', description: 'Contracted VIP Ground Supplier' },
      { name: 'pricing_type', key: 'pricing_type', type: 'enum', required: true, sampleValue: 'PER_PAX', description: 'PER_PAX / PER_VEHICLE / FIXED', allowedValues: ['PER_PAX', 'PER_VEHICLE', 'FIXED'] },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'USD', description: 'Settlement Currency', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'net_cost', key: 'net_cost', type: 'number', required: true, sampleValue: '140', description: 'Confidential net supplier cost' },
      { name: 'default_markup_percent', key: 'default_markup_percent', type: 'number', required: true, sampleValue: '25', description: 'Default commercial markup %' },
      { name: 'selling_price', key: 'selling_price', type: 'number', required: true, sampleValue: '175', description: 'Final published selling price' },
      { name: 'badge', key: 'badge', type: 'string', required: false, sampleValue: 'Fast Track Gate Escort', description: 'Marketing feature badge' },
      { name: 'short_desc', key: 'short_desc', type: 'string', required: true, sampleValue: 'Dedicated tarmac gate greeting with golf buggy transfer and express customs escort.', description: 'Brief description' },
      { name: 'long_desc', key: 'long_desc', type: 'string', required: false, sampleValue: 'Our certified multilingual docent meets passengers immediately at the aircraft jet bridge with a personalized name board.', description: 'Full service specification' },
      { name: 'inclusions', key: 'inclusions', type: 'array', required: true, sampleValue: 'Jet bridge greeting; Express customs clearance; Porter service; Curbside handover', description: 'Semicolon-separated inclusions' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE / INACTIVE / ARCHIVED', allowedValues: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Sequence order' }
    ],
    sampleRows: [
      ['VIP-TYO-NRT-01', 'Tokyo Narita (NRT) Airside VIP Meet & Fast Track', 'MEET_AND_GREET', 'DST-JPN', 'HUB-TYO', 'Nippon Luxury Transit Concierge', 'PER_PAX', 'USD', '140', '25', '175', 'Fast Track Gate Escort', 'Dedicated tarmac gate greeting with golf buggy transfer and express customs escort.', 'Personalized jet bridge greeting and escort through fast track.', 'Personalized jet bridge greeting; Express customs clearance; Porter service; Curbside handover', 'ACTIVE', '1'],
      ['VIP-TYO-HND-02', 'Tokyo Haneda (HND) VIP Chauffeur & Curbside Greeting', 'VIP_TRANSFER', 'DST-JPN', 'HUB-TYO', 'Tokyo Executive Chauffeur Guild', 'PER_VEHICLE', 'USD', '180', '22', '220', 'Executive MPV', 'Mercedes S-Class or Toyota Alphard luxury MPV airport transfer with white-glove driver.', 'Seamless luxury arrival experience with certified chauffeur.', 'Flight tracking with 90-min wait time; Luxury Toyota Alphard; Tolls & parking included', 'ACTIVE', '2'],
      ['VIP-DXB-MA-03', 'Dubai International (DXB) Ahlan VIP Lounge & Escort', 'LOUNGE_ACCESS', 'DST-UAE', 'HUB-DXB', 'Emirates VIP Logistics', 'PER_PAX', 'USD', '95', '20', '115', 'VIP Lounge Entry', 'Exclusive Ahlan arrival lounge access, immigration fast track, and flower bouquet.', 'Arrive in Dubai with access to Ahlan private reception lounge.', 'Private immigration counter; Ahlan Lounge buffet; Dedicated porter', 'ACTIVE', '3'],
      ['VIP-KYO-STN-04', 'Kyoto Station Shinkansen Platform VIP Porterage & Concierge', 'PORTERAGE', 'DST-JPN', 'HUB-KYO', 'Kyoto Hospitality Desk', 'FIXED', 'USD', '45', '30', '60', 'Station Porter Escort', 'Train platform meet-and-assist, bullet train seat escort, and hotel luggage delivery.', 'Meet concierge directly on Shinkansen platform.', 'Platform door greeting; Station-to-hotel luggage forwarding; Private transfer escort', 'ACTIVE', '4']
    ]
  },

  // ----------------------------------------------------
  // 15. CONNECTIVITY TAB (Tier 4: 5G eSIM & Roaming)
  // ----------------------------------------------------
  {
    tabName: 'CONNECTIVITY',
    displayName: '15. 5G Connectivity & eSIM (CONNECTIVITY)',
    description: 'International eSIM profiles, high-speed regional data bundles, and physical SIM inventory.',
    hierarchyLevel: 4,
    primaryKey: 'connectivity_id',
    columns: [
      { name: 'connectivity_id', key: 'connectivity_id', type: 'string', required: true, sampleValue: 'ESIM-ASIA-10GB', description: 'Unique stable Connectivity Plan ID' },
      { name: 'name', key: 'name', type: 'string', required: true, sampleValue: '5G Regional eSIM - Asia 14 Destinations (10GB / 15 Days)', description: 'Plan Name' },
      { name: 'type', key: 'type', type: 'enum', required: true, sampleValue: 'ESIM', description: 'ESIM / PHYSICAL_SIM', allowedValues: ['ESIM', 'PHYSICAL_SIM'] },
      { name: 'coverage_zone', key: 'coverage_zone', type: 'string', required: true, sampleValue: 'Japan, Thailand, Singapore, UAE, South Korea + 8 Countries', description: 'Eligible countries / roaming area' },
      { name: 'data_allowance', key: 'data_allowance', type: 'string', required: true, sampleValue: '10GB High-Speed 5G', description: 'Data quota specification' },
      { name: 'validity_days', key: 'validity_days', type: 'number', required: true, sampleValue: '15', description: 'Plan duration in days' },
      { name: 'network_speed', key: 'network_speed', type: 'string', required: true, sampleValue: '5G Ultra Wideband / 4G LTE', description: 'Carrier speed tier' },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'USD', description: 'Currency code', allowedValues: ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'SGD', 'CHF', 'INR', 'AUD', 'CAD'] },
      { name: 'net_cost', key: 'net_cost', type: 'number', required: true, sampleValue: '12', description: 'Confidential net supplier cost' },
      { name: 'selling_price', key: 'selling_price', type: 'number', required: true, sampleValue: '18', description: 'Final published selling price' },
      { name: 'inclusions', key: 'inclusions', type: 'array', required: true, sampleValue: 'Instant QR-code delivery; Zero physical SIM swapping; Personal hotspot enabled', description: 'Semicolon-separated features' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE / INACTIVE / ARCHIVED', allowedValues: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Display order' }
    ],
    sampleRows: [
      ['ESIM-ASIA-10GB', '5G Regional eSIM - Asia 14 Destinations (10GB / 15 Days)', 'ESIM', 'Japan, Thailand, Singapore, UAE, South Korea + 8 Countries', '10GB High-Speed 5G', '15', '5G Ultra Wideband / 4G LTE', 'USD', '12', '18', 'Instant QR-code delivery; Zero physical SIM swapping; Personal hotspot enabled', 'ACTIVE', '1'],
      ['ESIM-ASIA-UNLIM', '5G Regional eSIM - Asia Unlimited (Unlimited Data / 10 Days)', 'ESIM', 'Japan, Singapore, Thailand, UAE, Vietnam, Malaysia', 'Unlimited 5G Data', '10', '5G Uncapped', 'USD', '20', '32', 'Truly uncapped 5G speeds; Operates on tier-1 carriers; Instant automated provisioning', 'ACTIVE', '2'],
      ['ESIM-GLB-20GB', '5G Global Elite eSIM - 140 Countries (20GB / 30 Days)', 'ESIM', 'Global 140 Countries (Japan, UK, Schengen, UAE, USA, APAC)', '20GB High-Speed 5G', '30', '5G / 4G LTE Multi-Network', 'USD', '32', '48', 'Seamless multi-country roaming; 30 days validity; Priority routing on national carriers', 'ACTIVE', '3'],
      ['ESIM-JPN-5GB', '5G Japan Express Local eSIM (5GB / 7 Days)', 'ESIM', 'Japan Nationwide (NTT Docomo 5G)', '5GB High-Speed 5G', '7', 'NTT Docomo 5G Native', 'USD', '8', '14', 'Native Japanese IP routing; Ideal for short Shinkansen circuit tours; Hotspot enabled', 'ACTIVE', '4']
    ]
  },

  // ----------------------------------------------------
  // 16. TRANSFER_ROUTES TAB (Tier 4: Airport & Intercity Transfers)
  // ----------------------------------------------------
  {
    tabName: 'TRANSFER_ROUTES',
    displayName: '16. Transfer Routes (TRANSFER_ROUTES)',
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
  },

  // ----------------------------------------------------
  // 17. FX_RATES TAB (=GOOGLEFINANCE Live Engine)
  // ----------------------------------------------------
  {
    tabName: 'FX_RATES',
    displayName: '17. Multi-Currency Live Rates (=GOOGLEFINANCE)',
    description: 'Live institutional FX rates powered by native Google Sheets =GOOGLEFINANCE() formulas and read via official Google Sheets API.',
    hierarchyLevel: 4,
    primaryKey: 'pair_id',
    columns: [
      { name: 'pair_id', key: 'pair_id', type: 'string', required: true, sampleValue: 'USD_INR', description: 'Unique stable Currency Pair ID (e.g. USD_INR, USD_EUR)' },
      { name: 'from_currency', key: 'from_currency', type: 'string', required: true, sampleValue: 'USD', description: 'Base ISO Currency Code' },
      { name: 'to_currency', key: 'to_currency', type: 'string', required: true, sampleValue: 'INR', description: 'Target ISO Currency Code' },
      { name: 'currency_name', key: 'currency_name', type: 'string', required: true, sampleValue: 'Indian Rupee', description: 'Currency Display Name' },
      { name: 'googlefinance_formula', key: 'googlefinance_formula', type: 'string', required: true, sampleValue: '=GOOGLEFINANCE("CURRENCY:USDINR")', description: 'Official Google Sheets =GOOGLEFINANCE() formula for USD to Target' },
      { name: 'live_rate', key: 'live_rate', type: 'number', required: true, sampleValue: '95.11', description: 'Evaluated live exchange rate returned by Google Finance' },
      { name: 'inverse_formula', key: 'inverse_formula', type: 'string', required: false, sampleValue: '=GOOGLEFINANCE("CURRENCY:INRUSD")', description: 'Official Google Sheets =GOOGLEFINANCE() formula for Target to USD' },
      { name: 'inverse_rate', key: 'inverse_rate', type: 'number', required: false, sampleValue: '0.0105', description: 'Evaluated live inverse rate' },
      { name: 'manual_adjustment', key: 'manual_adjustment', type: 'number', required: false, sampleValue: '0.00', description: 'CMS manual spread adjustment (+/-)' },
      { name: 'effective_rate', key: 'effective_rate', type: 'string', required: false, sampleValue: '=F10+I10', description: 'Formula or sum of live rate + manual adjustment' },
      { name: 'last_synced_at', key: 'last_synced_at', type: 'string', required: false, sampleValue: '=NOW()', description: 'Last sync timestamp formula' }
    ],
    sampleRows: [
      ['USD_EUR', 'USD', 'EUR', 'Euro', '=GOOGLEFINANCE("CURRENCY:USDEUR")', '0.8592', '=GOOGLEFINANCE("CURRENCY:EURUSD")', '1.1639', '0.00', '=F2+I2', '=NOW()'],
      ['USD_GBP', 'USD', 'GBP', 'British Pound', '=GOOGLEFINANCE("CURRENCY:USDGBP")', '0.7378', '=GOOGLEFINANCE("CURRENCY:GBPUSD")', '1.3554', '0.00', '=F3+I3', '=NOW()'],
      ['USD_JPY', 'USD', 'JPY', 'Japanese Yen', '=GOOGLEFINANCE("CURRENCY:USDJPY")', '153.24', '=GOOGLEFINANCE("CURRENCY:JPYUSD")', '0.0065', '0.00', '=F4+I4', '=NOW()'],
      ['USD_AED', 'USD', 'AED', 'UAE Dirham', '=GOOGLEFINANCE("CURRENCY:USDAED")', '3.6725', '=GOOGLEFINANCE("CURRENCY:AEDUSD")', '0.2723', '0.00', '=F5+I5', '=NOW()'],
      ['USD_THB', 'USD', 'THB', 'Thai Baht', '=GOOGLEFINANCE("CURRENCY:USDTHB")', '32.85', '=GOOGLEFINANCE("CURRENCY:THBUSD")', '0.0304', '0.00', '=F6+I6', '=NOW()'],
      ['USD_AUD', 'USD', 'AUD', 'Australian Dollar', '=GOOGLEFINANCE("CURRENCY:USDAUD")', '1.3860', '=GOOGLEFINANCE("CURRENCY:AUDUSD")', '0.7215', '0.00', '=F7+I7', '=NOW()'],
      ['USD_CAD', 'USD', 'CAD', 'Canadian Dollar', '=GOOGLEFINANCE("CURRENCY:USDCAD")', '1.3780', '=GOOGLEFINANCE("CURRENCY:CADUSD")', '0.7257', '0.00', '=F8+I8', '=NOW()'],
      ['USD_SGD', 'USD', 'SGD', 'Singapore Dollar', '=GOOGLEFINANCE("CURRENCY:USDSGD")', '1.2640', '=GOOGLEFINANCE("CURRENCY:SGDUSD")', '0.7911', '0.00', '=F9+I9', '=NOW()'],
      ['USD_INR', 'USD', 'INR', 'Indian Rupee', '=GOOGLEFINANCE("CURRENCY:USDINR")', '95.11', '=GOOGLEFINANCE("CURRENCY:INRUSD")', '0.0105', '0.00', '=F10+I10', '=NOW()'],
      ['USD_CHF', 'USD', 'CHF', 'Swiss Franc', '=GOOGLEFINANCE("CURRENCY:USDCHF")', '0.8086', '=GOOGLEFINANCE("CURRENCY:CHFUSD")', '1.2367', '0.00', '=F11+I11', '=NOW()']
    ]
  },

  // ----------------------------------------------------
  // 18. RAIL_STATIONS TAB (Japan Rail Stations Master)
  // ----------------------------------------------------
  {
    tabName: 'RAIL_STATIONS',
    displayName: '18. Japan Rail Stations (RAIL_STATIONS)',
    description: 'Master Shinkansen and express train stations across Japan network (Tokyo, Kyoto, Shin-Osaka, Nagoya, etc.).',
    hierarchyLevel: 3,
    parentTab: 'DESTINATIONS',
    primaryKey: 'station_id',
    columns: [
      { name: 'station_id', key: 'station_id', type: 'string', required: true, sampleValue: 'JP-ST-TOKYO', description: 'Unique stable Station ID (e.g. JP-ST-TOKYO, JP-ST-KYOTO)' },
      { name: 'station_code', key: 'station_code', type: 'string', required: true, sampleValue: 'TYO', description: '3-letter official station code' },
      { name: 'station_name', key: 'station_name', type: 'string', required: true, sampleValue: 'Tokyo', description: 'English display name' },
      { name: 'station_name_local', key: 'station_name_local', type: 'string', required: false, sampleValue: '東京', description: 'Kanji / local script name' },
      { name: 'country', key: 'country', type: 'string', required: true, sampleValue: 'Japan', description: 'Country name' },
      { name: 'region_id', key: 'region_id', type: 'string', required: true, sampleValue: 'reg-east-asia', description: 'FK to REGIONS tab', foreignKeyTab: 'REGIONS', foreignKeyColumn: 'region_id' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'dest-japan', description: 'FK to DESTINATIONS tab', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'hub_id', key: 'hub_id', type: 'string', required: false, sampleValue: 'hub-tokyo', description: 'FK to HUBS tab', foreignKeyTab: 'HUBS', foreignKeyColumn: 'hub_id' },
      { name: 'city', key: 'city', type: 'string', required: true, sampleValue: 'Tokyo', description: 'City name' },
      { name: 'rail_operator', key: 'rail_operator', type: 'string', required: true, sampleValue: 'JR Central', description: 'JR Operating Company (JR Central, JR West, JR East, JR Kyushu)' },
      { name: 'latitude', key: 'latitude', type: 'number', required: false, sampleValue: '35.681236', description: 'GPS Latitude' },
      { name: 'longitude', key: 'longitude', type: 'number', required: false, sampleValue: '139.767125', description: 'GPS Longitude' },
      { name: 'timezone', key: 'timezone', type: 'string', required: false, sampleValue: 'Asia/Tokyo', description: 'IANA Timezone' },
      { name: 'shinkansen_line', key: 'shinkansen_line', type: 'string', required: false, sampleValue: 'Tokaido Shinkansen', description: 'Main Shinkansen Line' },
      { name: 'is_major_hub', key: 'is_major_hub', type: 'boolean', required: false, sampleValue: 'TRUE', description: 'TRUE if principal interchange station' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE / INACTIVE / ARCHIVED', allowedValues: ['ACTIVE', 'INACTIVE', 'ARCHIVED'] },
      { name: 'display_order', key: 'display_order', type: 'number', required: false, sampleValue: '1', description: 'Ordering sequence' }
    ],
    sampleRows: [
      ['JP-ST-TOKYO', 'TYO', 'Tokyo', '東京', 'Japan', 'reg-east-asia', 'dest-japan', 'hub-tokyo', 'Tokyo', 'JR Central', '35.681236', '139.767125', 'Asia/Tokyo', 'Tokaido Shinkansen', 'TRUE', 'ACTIVE', '1'],
      ['JP-ST-SHIN-OSAKA', 'OSA', 'Shin-Osaka', '新大阪', 'Japan', 'reg-east-asia', 'dest-japan', 'hub-osaka', 'Osaka', 'JR Central / JR West', '34.733481', '135.500109', 'Asia/Tokyo', 'Tokaido / Sanyo Shinkansen', 'TRUE', 'ACTIVE', '2'],
      ['JP-ST-KYOTO', 'KYO', 'Kyoto', '京都', 'Japan', 'reg-east-asia', 'dest-japan', 'hub-kyoto', 'Kyoto', 'JR Central / JR West', '34.985849', '135.758767', 'Asia/Tokyo', 'Tokaido Shinkansen', 'TRUE', 'ACTIVE', '3'],
      ['JP-ST-NAGOYA', 'NGO', 'Nagoya', '名古屋', 'Japan', 'reg-east-asia', 'dest-japan', 'hub-nagoya', 'Nagoya', 'JR Central', '35.170915', '136.881537', 'Asia/Tokyo', 'Tokaido Shinkansen', 'TRUE', 'ACTIVE', '4'],
      ['JP-ST-HIROSHIMA', 'HIJ', 'Hiroshima', '広島', 'Japan', 'reg-east-asia', 'dest-japan', 'hub-hiroshima', 'Hiroshima', 'JR West', '34.397667', '132.475306', 'Asia/Tokyo', 'Sanyo Shinkansen', 'TRUE', 'ACTIVE', '5'],
      ['JP-ST-HAKATA', 'FUK', 'Hakata (Fukuoka)', '博多', 'Japan', 'reg-east-asia', 'dest-japan', 'hub-fukuoka', 'Fukuoka', 'JR West / JR Kyushu', '33.590033', '130.420658', 'Asia/Tokyo', 'Sanyo / Kyushu Shinkansen', 'TRUE', 'ACTIVE', '6']
    ]
  },

  // ----------------------------------------------------
  // 19. RAIL_ROUTES TAB (Japan Rail Connected Segments)
  // ----------------------------------------------------
  {
    tabName: 'RAIL_ROUTES',
    displayName: '19. Japan Rail Routes (RAIL_ROUTES)',
    description: 'City-pair route segments and travel characteristics across the Shinkansen network.',
    hierarchyLevel: 4,
    parentTab: 'RAIL_STATIONS',
    primaryKey: 'route_id',
    columns: [
      { name: 'route_id', key: 'route_id', type: 'string', required: true, sampleValue: 'JP-RT-TOKYO-KYOTO', description: 'Unique stable Route ID (e.g. JP-RT-TOKYO-KYOTO)' },
      { name: 'origin_station_id', key: 'origin_station_id', type: 'string', required: true, sampleValue: 'JP-ST-TOKYO', description: 'FK to RAIL_STATIONS tab', foreignKeyTab: 'RAIL_STATIONS', foreignKeyColumn: 'station_id' },
      { name: 'destination_station_id', key: 'destination_station_id', type: 'string', required: true, sampleValue: 'JP-ST-KYOTO', description: 'FK to RAIL_STATIONS tab', foreignKeyTab: 'RAIL_STATIONS', foreignKeyColumn: 'station_id' },
      { name: 'origin_station_name', key: 'origin_station_name', type: 'string', required: true, sampleValue: 'Tokyo', description: 'Origin Station Display Name' },
      { name: 'destination_station_name', key: 'destination_station_name', type: 'string', required: true, sampleValue: 'Kyoto', description: 'Destination Station Display Name' },
      { name: 'destination_id', key: 'destination_id', type: 'string', required: true, sampleValue: 'dest-japan', description: 'FK to DESTINATIONS tab', foreignKeyTab: 'DESTINATIONS', foreignKeyColumn: 'destination_id' },
      { name: 'rail_operator', key: 'rail_operator', type: 'string', required: true, sampleValue: 'JR Central / JR West / smartEX', description: 'Ticketing and Operating Authority' },
      { name: 'distance_km', key: 'distance_km', type: 'number', required: false, sampleValue: '513.6', description: 'Kilometer track distance' },
      { name: 'duration_minutes', key: 'duration_minutes', type: 'number', required: false, sampleValue: '135', description: 'Average express travel time in minutes' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE / INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['JP-RT-TOKYO-KYOTO', 'JP-ST-TOKYO', 'JP-ST-KYOTO', 'Tokyo', 'Kyoto', 'dest-japan', 'JR Central / JR West / smartEX', '513.6', '135', 'ACTIVE'],
      ['JP-RT-TOKYO-SHIN-OSAKA', 'JP-ST-TOKYO', 'JP-ST-SHIN-OSAKA', 'Tokyo', 'Shin-Osaka', 'dest-japan', 'JR Central / JR West / smartEX', '552.6', '150', 'ACTIVE'],
      ['JP-RT-TOKYO-NAGOYA', 'JP-ST-TOKYO', 'JP-ST-NAGOYA', 'Tokyo', 'Nagoya', 'dest-japan', 'JR Central / smartEX', '366.0', '96', 'ACTIVE'],
      ['JP-RT-TOKYO-HIROSHIMA', 'JP-ST-TOKYO', 'JP-ST-HIROSHIMA', 'Tokyo', 'Hiroshima', 'dest-japan', 'JR Central / JR West', '894.2', '235', 'ACTIVE'],
      ['JP-RT-SHIN-OSAKA-KYOTO', 'JP-ST-SHIN-OSAKA', 'JP-ST-KYOTO', 'Shin-Osaka', 'Kyoto', 'dest-japan', 'JR Central / JR West', '39.0', '15', 'ACTIVE'],
      ['JP-RT-SHIN-OSAKA-HAKATA', 'JP-ST-SHIN-OSAKA', 'JP-ST-HAKATA', 'Shin-Osaka', 'Hakata', 'dest-japan', 'JR West / JR Kyushu', '622.3', '150', 'ACTIVE']
    ]
  },

  // ----------------------------------------------------
  // 20. RAIL_SERVICES TAB (Japan Rail Timetable & Trains)
  // ----------------------------------------------------
  {
    tabName: 'RAIL_SERVICES',
    displayName: '20. Japan Rail Services (RAIL_SERVICES)',
    description: 'Authoritative train schedules, service classes (Nozomi, Hikari, Kodama, Mizuho, Sakura), and operating frequencies.',
    hierarchyLevel: 4,
    parentTab: 'RAIL_ROUTES',
    primaryKey: 'service_id',
    columns: [
      { name: 'service_id', key: 'service_id', type: 'string', required: true, sampleValue: 'SRV-TYO-OSA-NZ1', description: 'Unique stable Service ID (e.g. SRV-TYO-OSA-NZ1)' },
      { name: 'operator_id', key: 'operator_id', type: 'string', required: false, sampleValue: 'JR-CENTRAL', description: 'Operator ID' },
      { name: 'service_name', key: 'service_name', type: 'string', required: true, sampleValue: 'Nozomi 1 Super Express', description: 'Train Name & Run' },
      { name: 'service_type', key: 'service_type', type: 'enum', required: true, sampleValue: 'NOZOMI', description: 'Service Type Group', allowedValues: ['NOZOMI', 'HIKARI', 'KODAMA', 'MIZUHO', 'SAKURA', 'TSUBAME'] },
      { name: 'train_number', key: 'train_number', type: 'string', required: false, sampleValue: '1A', description: 'Train Number' },
      { name: 'origin_station_id', key: 'origin_station_id', type: 'string', required: true, sampleValue: 'JP-ST-TOKYO', description: 'FK to RAIL_STATIONS tab', foreignKeyTab: 'RAIL_STATIONS', foreignKeyColumn: 'station_id' },
      { name: 'destination_station_id', key: 'destination_station_id', type: 'string', required: true, sampleValue: 'JP-ST-SHIN-OSAKA', description: 'FK to RAIL_STATIONS tab', foreignKeyTab: 'RAIL_STATIONS', foreignKeyColumn: 'station_id' },
      { name: 'route_id', key: 'route_id', type: 'string', required: false, sampleValue: 'JP-RT-TOKYO-SHIN-OSAKA', description: 'FK to RAIL_ROUTES tab', foreignKeyTab: 'RAIL_ROUTES', foreignKeyColumn: 'route_id' },
      { name: 'departure_time', key: 'departure_time', type: 'string', required: true, sampleValue: '06:00', description: 'Departure time (HH:mm)' },
      { name: 'arrival_time', key: 'arrival_time', type: 'string', required: true, sampleValue: '08:28', description: 'Arrival time (HH:mm)' },
      { name: 'duration_minutes', key: 'duration_minutes', type: 'number', required: false, sampleValue: '148', description: 'Travel duration in minutes' },
      { name: 'operating_days', key: 'operating_days', type: 'string', required: false, sampleValue: 'Mon;Tue;Wed;Thu;Fri;Sat;Sun', description: 'Operating days separated by semicolons' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE / INACTIVE / SUSPENDED', allowedValues: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
      { name: 'effective_from', key: 'effective_from', type: 'date', required: false, sampleValue: '2026-01-01', description: 'Timetable effective start date' },
      { name: 'effective_to', key: 'effective_to', type: 'date', required: false, sampleValue: '2026-12-31', description: 'Timetable effective end date' }
    ],
    sampleRows: [
      ['SRV-TYO-OSA-NZ1', 'JR-CENTRAL', 'Nozomi 1 Super Express', 'NOZOMI', '1A', 'JP-ST-TOKYO', 'JP-ST-SHIN-OSAKA', 'JP-RT-TOKYO-SHIN-OSAKA', '06:00', '08:28', '148', 'Mon;Tue;Wed;Thu;Fri;Sat;Sun', 'ACTIVE', '2026-01-01', '2026-12-31'],
      ['SRV-TYO-KYO-HK1', 'JR-CENTRAL', 'Hikari 501 Express', 'HIKARI', '501A', 'JP-ST-TOKYO', 'JP-ST-KYOTO', 'JP-RT-TOKYO-KYOTO', '06:33', '09:12', '159', 'Mon;Tue;Wed;Thu;Fri;Sat;Sun', 'ACTIVE', '2026-01-01', '2026-12-31'],
      ['SRV-TYO-NGO-NZ3', 'JR-CENTRAL', 'Nozomi 3 Super Express', 'NOZOMI', '3A', 'JP-ST-TOKYO', 'JP-ST-NAGOYA', 'JP-RT-TOKYO-NAGOYA', '06:15', '07:51', '96', 'Mon;Tue;Wed;Thu;Fri;Sat;Sun', 'ACTIVE', '2026-01-01', '2026-12-31'],
      ['SRV-OSA-HKT-MZ1', 'JR-WEST', 'Mizuho 601 Super Express', 'MIZUHO', '601A', 'JP-ST-SHIN-OSAKA', 'JP-ST-HAKATA', 'JP-RT-SHIN-OSAKA-HAKATA', '06:06', '08:34', '148', 'Mon;Tue;Wed;Thu;Fri;Sat;Sun', 'ACTIVE', '2026-01-01', '2026-12-31']
    ]
  },

  // ----------------------------------------------------
  // 21. RAIL_FARES TAB (Commercial Rates & Pricing Formula)
  // ----------------------------------------------------
  {
    tabName: 'RAIL_FARES',
    displayName: '21. Japan Rail Fares & Pricing (RAIL_FARES)',
    description: 'Authoritative point-to-point fares governing Nett Cost + Margin + Tax + Service Charge = Final Selling Price.',
    hierarchyLevel: 5,
    parentTab: 'RAIL_ROUTES',
    primaryKey: 'rail_fare_id',
    columns: [
      { name: 'rail_fare_id', key: 'rail_fare_id', type: 'string', required: true, sampleValue: 'FARE-TYO-KYO-ORD-RES', description: 'Unique stable Rail Fare ID' },
      { name: 'route_id', key: 'route_id', type: 'string', required: true, sampleValue: 'JP-RT-TOKYO-KYOTO', description: 'FK to RAIL_ROUTES tab', foreignKeyTab: 'RAIL_ROUTES', foreignKeyColumn: 'route_id' },
      { name: 'origin_station_id', key: 'origin_station_id', type: 'string', required: true, sampleValue: 'JP-ST-TOKYO', description: 'FK to RAIL_STATIONS tab', foreignKeyTab: 'RAIL_STATIONS', foreignKeyColumn: 'station_id' },
      { name: 'destination_station_id', key: 'destination_station_id', type: 'string', required: true, sampleValue: 'JP-ST-KYOTO', description: 'FK to RAIL_STATIONS tab', foreignKeyTab: 'RAIL_STATIONS', foreignKeyColumn: 'station_id' },
      { name: 'product_id', key: 'product_id', type: 'enum', required: true, sampleValue: 'RAIL-JP-ORD-RESERVED', description: 'Rail Product ID', allowedValues: ['RAIL-JP-ORD-RESERVED', 'RAIL-JP-GREEN-RESERVED'] },
      { name: 'car_type', key: 'car_type', type: 'enum', required: true, sampleValue: 'Ordinary', description: 'Ordinary or Green Car', allowedValues: ['Ordinary', 'Green'] },
      { name: 'seat_type', key: 'seat_type', type: 'enum', required: true, sampleValue: 'Reserved', description: 'Reserved or Non-Reserved', allowedValues: ['Reserved', 'Non-Reserved'] },
      { name: 'fare_type', key: 'fare_type', type: 'string', required: false, sampleValue: 'Standard', description: 'Standard / Express / Discount' },
      { name: 'passenger_type', key: 'passenger_type', type: 'enum', required: true, sampleValue: 'ADULT', description: 'ADULT or CHILD (ADT/CWB)', allowedValues: ['ADULT', 'CHILD', 'ADT', 'CWB', 'CNB', 'INF'] },
      { name: 'currency', key: 'currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Currency Code', allowedValues: ['JPY', 'USD', 'EUR', 'GBP', 'AED', 'SGD', 'THB'] },
      { name: 'nett_price', key: 'nett_price', type: 'number', required: true, sampleValue: '13320', description: 'Base Authoritative Supplier Cost in JPY' },
      { name: 'margin_type', key: 'margin_type', type: 'enum', required: true, sampleValue: 'PERCENTAGE', description: 'PERCENTAGE or FIXED', allowedValues: ['PERCENTAGE', 'FIXED'] },
      { name: 'margin_value', key: 'margin_value', type: 'number', required: true, sampleValue: '15', description: 'Commercial Margin Value (% or fixed JPY)' },
      { name: 'tax_type', key: 'tax_type', type: 'enum', required: false, sampleValue: 'PERCENTAGE', description: 'PERCENTAGE / FIXED / NOT_APPLICABLE', allowedValues: ['PERCENTAGE', 'FIXED', 'NOT_APPLICABLE'] },
      { name: 'tax_value', key: 'tax_value', type: 'number', required: false, sampleValue: '10', description: 'Tax Rate (% or fixed JPY)' },
      { name: 'service_charge_type', key: 'service_charge_type', type: 'enum', required: false, sampleValue: 'FIXED', description: 'PERCENTAGE / FIXED / NOT_APPLICABLE', allowedValues: ['PERCENTAGE', 'FIXED', 'NOT_APPLICABLE'] },
      { name: 'service_charge_value', key: 'service_charge_value', type: 'number', required: false, sampleValue: '500', description: 'Service charge value in JPY' },
      { name: 'final_price', key: 'final_price', type: 'number', required: true, sampleValue: '15818', description: 'Calculated Selling Price (Nett + Margin + Tax + Service Charge)' },
      { name: 'effective_from', key: 'effective_from', type: 'date', required: true, sampleValue: '2026-01-01', description: 'Rate validity start date' },
      { name: 'effective_to', key: 'effective_to', type: 'date', required: true, sampleValue: '2026-12-31', description: 'Rate validity end date' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE / INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE'] }
    ],
    sampleRows: [
      ['FARE-TYO-KYO-ORD-ADT', 'JP-RT-TOKYO-KYOTO', 'JP-ST-TOKYO', 'JP-ST-KYOTO', 'RAIL-JP-ORD-RESERVED', 'Ordinary', 'Reserved', 'Standard', 'ADULT', 'JPY', '13320', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '500', '15818', '2026-01-01', '2026-12-31', 'ACTIVE'],
      ['FARE-TYO-KYO-ORD-CHD', 'JP-RT-TOKYO-KYOTO', 'JP-ST-TOKYO', 'JP-ST-KYOTO', 'RAIL-JP-ORD-RESERVED', 'Ordinary', 'Reserved', 'Standard', 'CHILD', 'JPY', '6660', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '250', '7909', '2026-01-01', '2026-12-31', 'ACTIVE'],
      ['FARE-TYO-KYO-GRN-ADT', 'JP-RT-TOKYO-KYOTO', 'JP-ST-TOKYO', 'JP-ST-KYOTO', 'RAIL-JP-GREEN-RESERVED', 'Green', 'Reserved', 'Standard', 'ADULT', 'JPY', '19040', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '500', '22396', '2026-01-01', '2026-12-31', 'ACTIVE'],
      ['FARE-TYO-OSA-ORD-ADT', 'JP-RT-TOKYO-SHIN-OSAKA', 'JP-ST-TOKYO', 'JP-ST-SHIN-OSAKA', 'RAIL-JP-ORD-RESERVED', 'Ordinary', 'Reserved', 'Standard', 'ADULT', 'JPY', '13870', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '500', '16451', '2026-01-01', '2026-12-31', 'ACTIVE'],
      ['FARE-TYO-OSA-GRN-ADT', 'JP-RT-TOKYO-SHIN-OSAKA', 'JP-ST-TOKYO', 'JP-ST-SHIN-OSAKA', 'RAIL-JP-GREEN-RESERVED', 'Green', 'Reserved', 'Standard', 'ADULT', 'JPY', '19590', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '500', '23029', '2026-01-01', '2026-12-31', 'ACTIVE'],
      ['FARE-TYO-NGO-ORD-ADT', 'JP-RT-TOKYO-NAGOYA', 'JP-ST-TOKYO', 'JP-ST-NAGOYA', 'RAIL-JP-ORD-RESERVED', 'Ordinary', 'Reserved', 'Standard', 'ADULT', 'JPY', '10560', 'PERCENTAGE', '15', 'PERCENTAGE', '10', 'FIXED', '500', '12644', '2026-01-01', '2026-12-31', 'ACTIVE']
    ]
  },

  // ----------------------------------------------------
  // 22. RAIL_CLASS_RULES TAB (Seasonality & Calendar Rules)
  // ----------------------------------------------------
  {
    tabName: 'RAIL_CLASS_RULES',
    displayName: '22. Japan Rail Season Calendar & Rules (RAIL_CLASS_RULES)',
    description: 'smartEX official seasonal surcharge rules, holiday calendars, and dynamic pricing multipliers.',
    hierarchyLevel: 5,
    primaryKey: 'season_id',
    columns: [
      { name: 'season_id', key: 'season_id', type: 'string', required: true, sampleValue: 'SEAS-2026-PEAK-GW', description: 'Unique stable Season Rule ID' },
      { name: 'season_type', key: 'season_type', type: 'enum', required: true, sampleValue: 'PEAK_HIGH', description: 'Season Type Classification', allowedValues: ['REGULAR', 'LOW', 'HIGH', 'PEAK_HIGH', 'HOLIDAY', 'SPECIAL'] },
      { name: 'title', key: 'title', type: 'string', required: true, sampleValue: 'Golden Week Peak High Season 2026', description: 'Season Name / Description' },
      { name: 'start_date', key: 'start_date', type: 'date', required: true, sampleValue: '2026-04-25', description: 'Start Date (YYYY-MM-DD)' },
      { name: 'end_date', key: 'end_date', type: 'date', required: true, sampleValue: '2026-05-06', description: 'End Date (YYYY-MM-DD)' },
      { name: 'adult_adjustment_jpy', key: 'adult_adjustment_jpy', type: 'number', required: true, sampleValue: '400', description: 'Adult Tariff Adjustment in JPY (+400, +200, 0, -200)' },
      { name: 'child_adjustment_jpy', key: 'child_adjustment_jpy', type: 'number', required: true, sampleValue: '200', description: 'Child Tariff Adjustment in JPY (+200, +100, 0, -100)' },
      { name: 'pricing_multiplier', key: 'pricing_multiplier', type: 'number', required: false, sampleValue: '1.0', description: 'Dynamic multiplier ratio (default 1.0)' },
      { name: 'priority', key: 'priority', type: 'number', required: false, sampleValue: '10', description: 'Resolution precedence during overlapping calendar dates' },
      { name: 'status', key: 'status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE / INACTIVE', allowedValues: ['ACTIVE', 'INACTIVE'] },
      { name: 'notes', key: 'notes', type: 'string', required: false, sampleValue: 'smartEX official nationwide Golden Week peak surcharge window', description: 'Operational notes' }
    ],
    sampleRows: [
      ['SEAS-2026-REG', 'REGULAR', 'Regular Baseline Season 2026', '2026-01-01', '2026-12-31', '0', '0', '1.0', '1', 'ACTIVE', 'Authoritative JR baseline tariff'],
      ['SEAS-2026-PEAK-GW', 'PEAK_HIGH', 'Golden Week Peak High Season 2026', '2026-04-25', '2026-05-06', '400', '200', '1.0', '10', 'ACTIVE', 'smartEX official nationwide Golden Week peak surcharge window'],
      ['SEAS-2026-HIGH-OBON', 'HIGH', 'Obon Summer High Season 2026', '2026-08-08', '2026-08-17', '200', '100', '1.0', '8', 'ACTIVE', 'Summer peak homecoming period'],
      ['SEAS-2026-LOW-JAN', 'LOW', 'Winter Low Season 2026', '2026-01-16', '2026-02-28', '-200', '-100', '1.0', '5', 'ACTIVE', 'Winter low season discount window'],
      ['SEAS-2026-PEAK-NY', 'PEAK_HIGH', 'New Year Peak Season 2026', '2026-12-26', '2026-12-31', '400', '200', '1.0', '10', 'ACTIVE', 'Year-end holiday travel window']
    ]
  }
];

// Helper to get schema by tab name
export function getTabSchemaByName(tabName: string): MasterSheetTabDefinition | undefined {
  const cleanName = tabName.trim().toUpperCase().replace(/[\s-]+/g, '_');
  return MASTER_SHEETS_TAB_DEFINITIONS.find(t => 
    t.tabName.toUpperCase() === cleanName || 
    t.displayName.toUpperCase().includes(cleanName) ||
    (cleanName === 'PROTECTION' && t.tabName === 'TRAVEL_PROTECTION') ||
    (cleanName === 'VIP_SERVICES' && t.tabName === 'VIP_GROUND') ||
    (cleanName === 'CONNECTIVITY_PLANS' && t.tabName === 'CONNECTIVITY') ||
    (cleanName === 'ESIM' && t.tabName === 'CONNECTIVITY')
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
 * Approved canonical 25-worksheet column headers for TheUnbound production schema.
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
  TRAVEL_PROTECTION: ['protection_id', 'service_name', 'provider', 'coverage_area', 'destination_id', 'medical_coverage_amount', 'emergency_assistance_included', 'evacuation_coverage_amount', 'trip_cancellation_amount', 'baggage_loss_amount', 'validity_days_max', 'eligibility_age_min', 'eligibility_age_max', 'currency', 'net_cost_per_day', 'net_cost_per_trip', 'selling_price_per_day', 'selling_price_per_trip', 'inclusions', 'customer_description', 'terms', 'status', 'display_order'],
  VIP_GROUND: ['vip_id', 'name', 'service_type', 'destination_id', 'hub_id', 'supplier_name', 'pricing_type', 'currency', 'net_cost', 'default_markup_percent', 'selling_price', 'badge', 'short_desc', 'long_desc', 'inclusions', 'status', 'display_order'],
  CONNECTIVITY: ['connectivity_id', 'name', 'type', 'coverage_zone', 'data_allowance', 'validity_days', 'network_speed', 'currency', 'net_cost', 'selling_price', 'inclusions', 'status', 'display_order'],
  TRANSFER_ROUTES: ['transfer_route_id', 'destination_id', 'from_hub_id', 'to_hub_id', 'route_name', 'distance_km', 'estimated_duration_minutes', 'status'],
  TRANSFER_RATES: ['transfer_rate_id', 'transfer_route_id', 'capacity', 'vehicle_model', 'currency', 'nett_cost', 'buyer_markup_pct', 'b2b_markup_pct', 'selling_price_override', 'valid_from', 'valid_to', 'status'],
  PACKAGES: ['package_id', 'destination_id', 'package_name', 'slug', 'duration_nights', 'duration_days', 'description', 'package_type', 'status', 'is_featured', 'seo_title', 'seo_description'],
  PACKAGE_ITEMS: ['package_item_id', 'package_id', 'day_number', 'item_type', 'item_id', 'hub_id', 'sequence', 'notes', 'is_optional', 'status'],
  FX_RATES: ['pair_id', 'from_currency', 'to_currency', 'currency_name', 'googlefinance_formula', 'live_rate', 'inverse_formula', 'inverse_rate', 'manual_adjustment', 'effective_rate', 'last_synced_at'],
  RAIL_STATIONS: ['station_id', 'station_code', 'station_name', 'station_name_local', 'country', 'region_id', 'destination_id', 'hub_id', 'city', 'rail_operator', 'latitude', 'longitude', 'timezone', 'shinkansen_line', 'is_major_hub', 'status', 'display_order'],
  RAIL_ROUTES: ['route_id', 'origin_station_id', 'destination_station_id', 'origin_station_name', 'destination_station_name', 'destination_id', 'rail_operator', 'distance_km', 'duration_minutes', 'status'],
  RAIL_SERVICES: ['service_id', 'operator_id', 'service_name', 'service_type', 'train_number', 'origin_station_id', 'destination_station_id', 'route_id', 'departure_time', 'arrival_time', 'duration_minutes', 'operating_days', 'status', 'effective_from', 'effective_to'],
  RAIL_FARES: ['rail_fare_id', 'route_id', 'origin_station_id', 'destination_station_id', 'product_id', 'car_type', 'seat_type', 'fare_type', 'passenger_type', 'currency', 'nett_price', 'margin_type', 'margin_value', 'tax_type', 'tax_value', 'service_charge_type', 'service_charge_value', 'final_price', 'effective_from', 'effective_to', 'status'],
  RAIL_CLASS_RULES: ['season_id', 'season_type', 'title', 'start_date', 'end_date', 'adult_adjustment_jpy', 'child_adjustment_jpy', 'pricing_multiplier', 'priority', 'status', 'notes']
};

/**
 * Authoritative Canonical Master Workbook Tab Registry (Exactly 25 tabs)
 */
export const EXPECTED_MASTER_TAB_COUNT = 25;

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
  'TRAVEL_PROTECTION',
  'VIP_GROUND',
  'CONNECTIVITY',
  'TRANSFER_ROUTES',
  'TRANSFER_RATES',
  'PACKAGES',
  'PACKAGE_ITEMS',
  'FX_RATES',
  'RAIL_STATIONS',
  'RAIL_ROUTES',
  'RAIL_SERVICES',
  'RAIL_FARES',
  'RAIL_CLASS_RULES'
];

export const MASTER_WORKBOOK_TABS = CANONICAL_TAB_PROCESSING_ORDER;

/**
 * Generates an authentic .xlsx workbook containing exactly the canonical worksheets.
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

