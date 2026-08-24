export interface SheetTabDefinition {
  tabName: string;
  description: string;
  columns: {
    name: string;
    type: 'string' | 'number' | 'date' | 'enum' | 'array' | 'boolean';
    required: boolean;
    sampleValue: string;
    description: string;
  }[];
}

export const GOOGLE_SHEETS_SCHEMA: SheetTabDefinition[] = [
  {
    tabName: 'PRODUCTS',
    description: 'Master travel product inventory containing operational, content, and baseline rate specifications.',
    columns: [
      { name: 'Product ID', type: 'string', required: true, sampleValue: 'TYO-PVT-001', description: 'Unique stable SKU identifier' },
      { name: 'Destination', type: 'string', required: true, sampleValue: 'Japan', description: 'Destination region / country' },
      { name: 'Country', type: 'string', required: true, sampleValue: 'Japan', description: 'Sovereign country name' },
      { name: 'City', type: 'string', required: true, sampleValue: 'Tokyo', description: 'City or province' },
      { name: 'Product Type', type: 'string', required: true, sampleValue: 'Private Day Tour', description: 'Type classification' },
      { name: 'Product Name', type: 'string', required: true, sampleValue: 'Tokyo Modern & Edo Heritage Tour', description: 'Display title' },
      { name: 'Short Description', type: 'string', required: true, sampleValue: 'Full-day luxury tour with chauffeur...', description: '1-2 sentence overview' },
      { name: 'Long Description', type: 'string', required: false, sampleValue: 'Explore the contrasting facets...', description: 'Full marketing and itinerary copy' },
      { name: 'Supplier', type: 'string', required: true, sampleValue: 'Nippon Luxury Transit', description: 'Contracted supplier name' },
      { name: 'Supplier Product Code', type: 'string', required: false, sampleValue: 'NLT-TYO-VIP8H', description: 'Supplier internal code' },
      { name: 'Category', type: 'enum', required: true, sampleValue: 'Private Tours', description: 'Hotels, Activities, Transfers, Tours, etc.' },
      { name: 'Subcategory', type: 'string', required: false, sampleValue: 'Full-Day Custom Excursion', description: 'Subcategory tag' },
      { name: 'Duration', type: 'string', required: true, sampleValue: '8 Hours', description: 'Duration format (e.g. 8 Hours, 3 Days)' },
      { name: 'Operating Days', type: 'array', required: true, sampleValue: 'Mon, Tue, Wed, Thu, Fri, Sat, Sun', description: 'Comma-separated days' },
      { name: 'Operating Hours', type: 'string', required: false, sampleValue: '09:00 - 17:00', description: 'Operating window' },
      { name: 'Adult Net Price', type: 'number', required: true, sampleValue: '42000', description: 'Confidential net supplier cost per adult' },
      { name: 'Child Net Price', type: 'number', required: false, sampleValue: '22000', description: 'Confidential net cost per child' },
      { name: 'Infant Net Price', type: 'number', required: false, sampleValue: '0', description: 'Net cost per infant (0-2 yrs)' },
      { name: 'Currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'USD, EUR, GBP, JPY' },
      { name: 'Default Markup %', type: 'number', required: true, sampleValue: '20', description: 'DMC default markup margin' },
      { name: 'Tax %', type: 'number', required: true, sampleValue: '10', description: 'Local destination tax rate' },
      { name: 'Commission %', type: 'number', required: false, sampleValue: '10', description: 'Travel agent commission tier' },
      { name: 'Selling Price', type: 'number', required: false, sampleValue: '55440', description: 'Calculated baseline published rate' },
      { name: 'Season', type: 'enum', required: false, sampleValue: 'All Year', description: 'High, Low, Shoulder, All Year' },
      { name: 'Validity From', type: 'date', required: true, sampleValue: '2025-01-01', description: 'ISO date YYYY-MM-DD' },
      { name: 'Validity To', type: 'date', required: true, sampleValue: '2026-12-31', description: 'ISO date YYYY-MM-DD' },
      { name: 'Minimum Pax', type: 'number', required: true, sampleValue: '1', description: 'Minimum passenger threshold' },
      { name: 'Maximum Pax', type: 'number', required: true, sampleValue: '6', description: 'Max passenger capacity' },
      { name: 'Availability', type: 'enum', required: true, sampleValue: 'INSTANT', description: 'INSTANT, ON_REQUEST, LIMITED' },
      { name: 'Booking Required Days', type: 'number', required: true, sampleValue: '2', description: 'Advance booking cutoff in days' },
      { name: 'Cancellation Policy', type: 'string', required: true, sampleValue: '100% refund up to 72h prior', description: 'Terms of cancellation' },
      { name: 'Inclusions', type: 'array', required: true, sampleValue: 'Toyota Alphard, Private Guide, Tolls', description: 'Semicolon-separated list' },
      { name: 'Exclusions', type: 'array', required: false, sampleValue: 'Client meals; Gratuities', description: 'Semicolon-separated list' },
      { name: 'Images', type: 'array', required: true, sampleValue: 'https://images.unsplash.com/...', description: 'Pipe or comma-separated image URLs' },
      { name: 'Video URL', type: 'string', required: false, sampleValue: 'https://youtube.com/...', description: 'Video showcase link' },
      { name: 'Location', type: 'string', required: true, sampleValue: 'Central Tokyo, Japan', description: 'Address / district string' },
      { name: 'Latitude', type: 'number', required: false, sampleValue: '35.6762', description: 'Geo coordinate' },
      { name: 'Longitude', type: 'number', required: false, sampleValue: '139.6503', description: 'Geo coordinate' },
      { name: 'Status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE, ARCHIVED, DRAFT' },
      { name: 'Last Updated', type: 'date', required: true, sampleValue: '2026-08-20', description: 'Timestamp of last modification' }
    ]
  },
  {
    tabName: 'PRICING RULES',
    description: 'Dynamic pricing tiers, seasonal markups, agency overrides, and tax matrices.',
    columns: [
      { name: 'Rule ID', type: 'string', required: true, sampleValue: 'RULE-JP-HIGH-01', description: 'Unique pricing rule identifier' },
      { name: 'Product ID / Wildcard', type: 'string', required: true, sampleValue: 'TYO-PVT-001', description: 'Product ID or * for all in destination' },
      { name: 'Pax Type', type: 'enum', required: true, sampleValue: 'ADULT', description: 'ADULT, CHILD, INFANT, GROUP_TIER' },
      { name: 'Base Markup %', type: 'number', required: true, sampleValue: '20', description: 'Base markup applied over net cost' },
      { name: 'Agency Tier Commission %', type: 'number', required: true, sampleValue: '10', description: 'Commission returned to booking agent' },
      { name: 'Destination Tax %', type: 'number', required: true, sampleValue: '10', description: 'Compulsory VAT/GST' },
      { name: 'Fixed DMC Service Fee', type: 'number', required: false, sampleValue: '3000', description: 'Fixed handling fee in local currency' },
      { name: 'Season Multiplier', type: 'number', required: false, sampleValue: '1.15', description: 'High season multiplier (1.0 = normal)' },
      { name: 'Currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Settlement currency' },
      { name: 'Validity', type: 'string', required: true, sampleValue: '2025-01-01 to 2026-12-31', description: 'Effective date range' }
    ]
  },
  {
    tabName: 'DESTINATIONS',
    description: 'Destination metadata, marketing highlights, seasonal advisory, and imagery.',
    columns: [
      { name: 'Destination ID', type: 'string', required: true, sampleValue: 'dest-japan', description: 'Unique destination slug identifier' },
      { name: 'Country', type: 'string', required: true, sampleValue: 'Japan', description: 'Country' },
      { name: 'Destination Name', type: 'string', required: true, sampleValue: 'Japan', description: 'Display name' },
      { name: 'Slug', type: 'string', required: true, sampleValue: 'japan', description: 'URL route slug' },
      { name: 'Hero Image', type: 'string', required: true, sampleValue: 'https://images.unsplash.com/...', description: 'Banner image link' },
      { name: 'Tagline', type: 'string', required: true, sampleValue: 'Precision, heritage...', description: 'Punchy positioning statement' },
      { name: 'Description', type: 'string', required: true, sampleValue: 'Bespoke DMC solutions...', description: 'Full destination summary' },
      { name: 'Best Time To Visit', type: 'string', required: true, sampleValue: 'March–May & October–November', description: 'Weather advisory' },
      { name: 'Highlights', type: 'array', required: true, sampleValue: 'Mt. Fuji; Kyoto Gion; Tokyo Tsukiji', description: 'Semicolon separated list' },
      { name: 'Status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE or COMING_SOON' }
    ]
  },
  {
    tabName: 'SUPPLIERS',
    description: 'Contracted ground operators, transport companies, and guide agencies.',
    columns: [
      { name: 'Supplier ID', type: 'string', required: true, sampleValue: 'sup-jp-01', description: 'Unique supplier ID' },
      { name: 'Supplier Name', type: 'string', required: true, sampleValue: 'Nippon Luxury Transit', description: 'Legal supplier trade name' },
      { name: 'Country', type: 'string', required: true, sampleValue: 'Japan', description: 'Country of registration' },
      { name: 'Destination', type: 'string', required: true, sampleValue: 'Japan', description: 'Operating territory' },
      { name: 'Contact Person', type: 'string', required: true, sampleValue: 'Kenji Takahashi', description: 'Account manager' },
      { name: 'Email', type: 'string', required: true, sampleValue: 'ops@nipponluxurytransit.jp', description: 'Booking dispatch email' },
      { name: 'Phone', type: 'string', required: true, sampleValue: '+81 3 5555 0192', description: 'Emergency 24/7 hotline' },
      { name: 'Website', type: 'string', required: false, sampleValue: 'https://nipponluxurytransit.jp', description: 'Supplier portal' },
      { name: 'Currency', type: 'enum', required: true, sampleValue: 'JPY', description: 'Invoicing currency' },
      { name: 'Contract Status', type: 'enum', required: true, sampleValue: 'ACTIVE', description: 'ACTIVE, PENDING_RENEWAL, UNDER_REVIEW' },
      { name: 'Payment Terms', type: 'string', required: true, sampleValue: 'Net 30 Days from service date', description: 'Credit terms' },
      { name: 'Cancellation Terms', type: 'string', required: true, sampleValue: 'Full refund > 72 hours prior', description: 'Contracted cancellation policy' }
    ]
  }
];

export function generateSampleCsv(tabName: string): string {
  const schema = GOOGLE_SHEETS_SCHEMA.find(s => s.tabName === tabName);
  if (!schema) return '';
  const headers = schema.columns.map(c => `"${c.name}"`).join(',');
  const sampleRow = schema.columns.map(c => `"${c.sampleValue.replace(/"/g, '""')}"`).join(',');
  return `${headers}\n${sampleRow}`;
}
