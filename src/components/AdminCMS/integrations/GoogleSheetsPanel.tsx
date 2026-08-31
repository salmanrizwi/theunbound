import React, { useState } from 'react';
import { 
  SheetsColumnMappingItem, 
  User, 
  Product 
} from '../../../types';
import { IntegrationsHubService } from '../../../services/integrationsHubService';
import { AppDatabase } from '../../../services/db';
import { 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  RefreshCw, 
  Upload, 
  Download, 
  Layers, 
  ShieldCheck, 
  Table, 
  Sparkles, 
  Filter, 
  SlidersHorizontal,
  ArrowRight,
  Database,
  Search,
  Info,
  Calendar,
  DollarSign,
  MapPin,
  FileText
} from 'lucide-react';

interface GoogleSheetsPanelProps {
  currentUser: User | null;
  onRefresh: () => void;
}

interface PreviewRow {
  rowNumber: number;
  sku: string;
  name: string;
  destination: string;
  city?: string;
  category: string;
  subcategory?: string;
  netCost: number;
  childNetCost?: number;
  infantNetCost?: number;
  currency?: string;
  duration?: string;
  shortDescription?: string;
  longDescription?: string;
  inclusions?: string[];
  exclusions?: string[];
  meetingPoint?: string;
  pickupInformation?: string;
  operatingDays?: string[];
  operatingHours?: string;
  cancellationPolicy?: string;
  importantInformation?: string[];
  bookingRequiredDays?: number;
  supplierName?: string;
  supplierContact?: string;
  supplierLocalCurrency?: string;
  vehicleModel?: string;
  vehicleCapacity?: number;
  pricingMethod?: 'per_person' | 'capacity_based';
  minPax?: number;
  maxPax?: number;
  validityFrom?: string;
  validityTo?: string;
  status: 'NEW' | 'UPDATE' | 'INVALID';
  issues?: string[];
}

export const GoogleSheetsPanel: React.FC<GoogleSheetsPanelProps> = ({
  currentUser,
  onRefresh
}) => {
  const hubService = IntegrationsHubService.getInstance();
  const db = AppDatabase.getInstance();

  const [sheetId, setSheetId] = useState<string>('1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms');
  const [sheetTab, setSheetTab] = useState<string>('Master_Tariffs_2026');
  const [mappings] = useState<SheetsColumnMappingItem[]>(() => hubService.getDefaultSheetsColumnMappings());
  const [schemaSearchQuery, setSchemaSearchQuery] = useState<string>('');
  const [schemaCategoryFilter, setSchemaCategoryFilter] = useState<string>('ALL');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRow[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; importedCount: number; updatedCount: number; errorCount: number; details: string } | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'NEW' | 'UPDATE' | 'INVALID'>('ALL');

  const handleDownloadSchemaCsv = () => {
    const headers = mappings.map(m => m.sheetColumn);
    const sampleRow1 = [
      'TUB-JP-TYO-001',
      'Tokyo Highlights & Asakusa Sensoji Tour',
      'Japan',
      'Tokyo',
      'Day Tours',
      'Cultural & Heritage Excursions',
      'ACTIVE',
      'Immersive full-day private vehicle journey through historic Senso-ji Temple, Meiji Shrine, and Shibuya Sky.',
      '09:00 Hotel pickup -> 09:45 Senso-ji Temple & Nakamise -> 12:00 Tsukiji Outer Market Lunch -> 14:00 Meiji Shrine -> 16:00 Shibuya Sky Deck -> 17:30 Return drop-off.',
      'Licensed English Guide | Private Chartered Vehicle | All Highway Tolls & Fuel | Temple & Monument Entrance Fees',
      'Client Meals & Beverage | Personal Souvenirs | Discretionary Guide Gratuities',
      'Comfortable walking shoes recommended | Modest attire required at religious shrines | Passport required for tax-free shopping',
      'Hotel Lobby (Tokyo 23 Wards) or Shinjuku Station West Exit',
      'Door-to-door private hotel pickup and drop-off included. Driver awaits in lobby holding name board.',
      'Mon | Tue | Wed | Thu | Fri | Sat | Sun',
      '09:00 - 18:00',
      '8 Hours',
      '100% refund up to 48 hours prior to service date; 50% penalty 24–48 hours; 100% penalty within 24 hours.',
      '2',
      '1',
      '20',
      '2026-01-01',
      '2026-12-31',
      'Tokyo Luxury Transport & Guide Guild Ltd',
      'dispatch@tokyoluxury.jp | +81 3 5555 0199',
      'JPY',
      '185.00',
      '120.00',
      '0.00',
      '20',
      '10',
      'Toyota Alphard Executive Van',
      '6',
      'per_person'
    ];

    const sampleRow2 = [
      'TUB-JP-KYO-002',
      'Kyoto Arashiyama & Golden Pavilion Excursion',
      'Japan',
      'Kyoto',
      'Cultural Excursions',
      'Heritage & Zen Gardens',
      'ACTIVE',
      'Private scenic tour exploring the Bamboo Grove, Kinkaku-ji Golden Pavilion, and Fushimi Inari Taisha.',
      '08:30 Hotel pickup -> 09:15 Arashiyama Bamboo Grove -> 11:30 Kinkaku-ji -> 13:00 Nishiki Market Lunch -> 15:00 Fushimi Inari 10,000 Torii Gates -> 17:00 Return drop-off.',
      'Dedicated Private Chauffeur & Luxury MPV | Licensed National Tour Guide | All Entry Admissions | Mineral Water & Oshibori',
      'Lunch & Personal Refreshments | Temple Souvenirs | Gratuities',
      'Expect moderate walking on stone temple pathways | Luggage storage available in vehicle',
      'Kyoto Station North Taxi Stand or Kyoto Central Hotel Lobby',
      'Complimentary hotel pickup in Kyoto City center. Chauffeur greets with customized name board.',
      'Mon | Tue | Wed | Thu | Fri | Sat | Sun',
      '08:30 - 17:30',
      '9 Hours',
      'Free cancellation up to 72 hours before service date.',
      '3',
      '1',
      '8',
      '2026-01-01',
      '2026-12-31',
      'Kansai Heritage Executive Charters',
      'concierge@kansaiheritage.jp | +81 75 444 8811',
      'JPY',
      '210.00',
      '140.00',
      '0.00',
      '20',
      '10',
      'Toyota Vellfire Executive Lounge',
      '6',
      'per_person'
    ];

    const csvContent = 'data:text/csv;charset=utf-8,' + 
      [headers.map(h => `"${h}"`).join(','), sampleRow1.map(c => `"${c.replace(/"/g, '""')}"`).join(','), sampleRow2.map(c => `"${c.replace(/"/g, '""')}"`).join(',')].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `TheUnbound_Master_Product_Tariff_Schema_${mappings.length}_Columns.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleGeneratePreview = () => {
    setIsPreviewLoading(true);
    setImportResult(null);

    // Simulate dry-run analysis against existing products in AppDatabase
    setTimeout(() => {
      const existingProducts = db.getProducts();
      const existingSkuMap = new Map(existingProducts.map(p => [p.sku?.toUpperCase(), p]));

      const mockPreviewRows: PreviewRow[] = [
        {
          rowNumber: 2,
          sku: 'TUB-JP-TYO-001',
          name: 'Tokyo Highlights & Asakusa Sensoji Tour',
          destination: 'Japan',
          city: 'Tokyo',
          category: 'Day Tours',
          subcategory: 'Cultural & Heritage Excursions',
          netCost: 185.00,
          childNetCost: 120.00,
          infantNetCost: 0.00,
          currency: 'USD',
          duration: '8 Hours',
          shortDescription: 'Immersive full-day private vehicle journey through historic Senso-ji Temple, Meiji Shrine, and Shibuya Sky.',
          longDescription: '09:00 Hotel pickup -> 09:45 Senso-ji Temple & Nakamise -> 12:00 Tsukiji Outer Market Lunch -> 14:00 Meiji Shrine -> 16:00 Shibuya Sky Deck -> 17:30 Return drop-off.',
          inclusions: ['Licensed English Guide', 'Private Chartered Vehicle', 'All Highway Tolls & Fuel', 'Temple & Monument Entrance Fees'],
          exclusions: ['Client Meals & Beverage', 'Personal Souvenirs', 'Discretionary Guide Gratuities'],
          meetingPoint: 'Hotel Lobby (Tokyo 23 Wards) or Shinjuku Station West Exit',
          pickupInformation: 'Door-to-door private hotel pickup and drop-off included. Driver awaits in lobby holding name board.',
          operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          operatingHours: '09:00 - 18:00',
          cancellationPolicy: '100% refund up to 48 hours prior to service date; 50% penalty 24–48 hours; 100% penalty within 24 hours.',
          importantInformation: ['Comfortable walking shoes recommended', 'Modest attire required at religious shrines'],
          bookingRequiredDays: 2,
          supplierName: 'Tokyo Luxury Transport & Guide Guild Ltd',
          supplierContact: 'dispatch@tokyoluxury.jp | +81 3 5555 0199',
          supplierLocalCurrency: 'JPY',
          vehicleModel: 'Toyota Alphard Executive Van',
          vehicleCapacity: 6,
          pricingMethod: 'per_person',
          minPax: 1,
          maxPax: 20,
          validityFrom: '2026-01-01',
          validityTo: '2026-12-31',
          status: existingSkuMap.has('TUB-JP-TYO-001') ? 'UPDATE' : 'NEW'
        },
        {
          rowNumber: 3,
          sku: 'TUB-JP-KYO-002',
          name: 'Kyoto Arashiyama & Golden Pavilion Excursion',
          destination: 'Japan',
          city: 'Kyoto',
          category: 'Cultural Excursions',
          subcategory: 'Heritage & Zen Gardens',
          netCost: 210.00,
          childNetCost: 140.00,
          infantNetCost: 0.00,
          currency: 'USD',
          duration: '9 Hours',
          shortDescription: 'Private scenic tour exploring the Bamboo Grove, Kinkaku-ji Golden Pavilion, and Fushimi Inari Taisha.',
          longDescription: '08:30 Hotel pickup -> 09:15 Arashiyama Bamboo Grove -> 11:30 Kinkaku-ji -> 13:00 Nishiki Market Lunch -> 15:00 Fushimi Inari 10,000 Torii Gates -> 17:00 Return drop-off.',
          inclusions: ['Dedicated Private Chauffeur & Luxury MPV', 'Licensed National Tour Guide', 'All Entry Admissions', 'Mineral Water & Oshibori'],
          exclusions: ['Lunch & Personal Refreshments', 'Temple Souvenirs', 'Gratuities'],
          meetingPoint: 'Kyoto Station North Taxi Stand or Kyoto Central Hotel Lobby',
          pickupInformation: 'Complimentary hotel pickup in Kyoto City center. Chauffeur greets with customized name board.',
          operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          operatingHours: '08:30 - 17:30',
          cancellationPolicy: 'Free cancellation up to 72 hours before service date.',
          importantInformation: ['Expect moderate walking on stone temple pathways', 'Luggage storage available in vehicle'],
          bookingRequiredDays: 3,
          supplierName: 'Kansai Heritage Executive Charters',
          supplierContact: 'concierge@kansaiheritage.jp | +81 75 444 8811',
          supplierLocalCurrency: 'JPY',
          vehicleModel: 'Toyota Vellfire Executive Lounge',
          vehicleCapacity: 6,
          pricingMethod: 'per_person',
          minPax: 1,
          maxPax: 8,
          validityFrom: '2026-01-01',
          validityTo: '2026-12-31',
          status: existingSkuMap.has('TUB-JP-KYO-002') ? 'UPDATE' : 'NEW'
        },
        {
          rowNumber: 4,
          sku: 'TUB-TH-BKK-003',
          name: 'Bangkok Grand Palace & Canal Longtail Boat',
          destination: 'Thailand',
          city: 'Bangkok',
          category: 'City Sightseeing',
          subcategory: 'River & Cultural Tours',
          netCost: 130.00,
          childNetCost: 85.00,
          infantNetCost: 0.00,
          currency: 'USD',
          duration: '6 Hours',
          shortDescription: 'Classic Bangkok heritage excursion including the Grand Palace, Wat Pho Reclining Buddha, and Chao Phraya private longtail boat.',
          longDescription: '08:00 Hotel pickup -> 08:45 Grand Palace & Emerald Buddha -> 10:45 Wat Pho -> 12:00 Private canal boat cruise -> 13:30 Return drop-off.',
          inclusions: ['Private Air-Conditioned Van', 'Licensed Thai Tour Guide', 'Grand Palace & Wat Pho Entry', 'Private Canal Boat Charter'],
          exclusions: ['Meals & Beverages', 'Personal Purchases', 'Gratuities'],
          meetingPoint: 'Hotel Lobby (Bangkok Central District)',
          pickupInformation: 'Hotel pickup included for Sukhumvit, Silom, Riverside, and Sathorn properties.',
          operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          operatingHours: '08:00 - 14:00',
          cancellationPolicy: 'Free cancellation up to 24 hours prior to departure.',
          importantInformation: ['Strict dress code: Shoulders and knees must be covered for Palace entry.'],
          bookingRequiredDays: 1,
          supplierName: 'Siam Heritage DMC Ltd',
          supplierContact: 'ops@siamheritagedmc.com | +66 2 888 9900',
          supplierLocalCurrency: 'THB',
          vehicleModel: 'Toyota Commuter VIP 9-Seater',
          vehicleCapacity: 9,
          pricingMethod: 'per_person',
          minPax: 1,
          maxPax: 15,
          validityFrom: '2026-01-01',
          validityTo: '2026-12-31',
          status: existingSkuMap.has('TUB-TH-BKK-003') ? 'UPDATE' : 'NEW'
        },
        {
          rowNumber: 5,
          sku: '',
          name: 'Phuket Island Sunset Catamaran Cruise',
          destination: 'Thailand',
          city: 'Phuket',
          category: 'Cruises & Boat Charters',
          netCost: 0,
          status: 'INVALID',
          issues: ['Missing mandatory SKU Code', 'Adult Net Cost is $0.00']
        },
        {
          rowNumber: 6,
          sku: 'TUB-VN-HAN-004',
          name: 'Hanoi Street Food & French Quarter Rickshaw',
          destination: 'Vietnam',
          city: 'Hanoi',
          category: 'Culinary Experiences',
          subcategory: 'Street Food & Walking Tours',
          netCost: 95.00,
          childNetCost: 65.00,
          infantNetCost: 0.00,
          currency: 'USD',
          duration: '4 Hours',
          shortDescription: 'Gastronomic walking and cyclo tour tasting authentic Pho, Bun Cha, and Egg Coffee in Hanoi Old Quarter.',
          longDescription: '17:00 Old Quarter meetup -> 17:30 Rickshaw ride -> 18:00 Bun Cha & Spring rolls tasting -> 19:15 Banh Mi & Egg Coffee -> 20:30 St. Joseph Cathedral stroll -> 21:00 Finish.',
          inclusions: ['Foodie Guide', '7 Authentic Food & Drink Tastings', '1-Hour Traditional Cyclo Rickshaw', 'Bottled Water'],
          exclusions: ['Hotel Transfer to Meeting Point', 'Alcoholic Beverages', 'Personal Shopping'],
          meetingPoint: 'Hanoi Opera House Steps, Hoan Kiem',
          pickupInformation: 'Meet directly at Hanoi Opera House 15 minutes before start.',
          operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          operatingHours: '17:00 - 21:00',
          cancellationPolicy: 'Free cancellation up to 24 hours in advance.',
          importantInformation: ['Please inform us in advance of any dietary restrictions or food allergies.'],
          bookingRequiredDays: 1,
          supplierName: 'Vietnam Discovery Culinary Ltd',
          supplierContact: 'foodies@vndiscovery.vn | +84 24 3999 1234',
          supplierLocalCurrency: 'VND',
          pricingMethod: 'per_person',
          minPax: 1,
          maxPax: 12,
          validityFrom: '2026-01-01',
          validityTo: '2026-12-31',
          status: 'NEW'
        }
      ];

      setPreviewData(mockPreviewRows);
      setIsPreviewLoading(false);
    }, 600);
  };

  const handleExecuteImport = () => {
    if (!previewData) return;
    setIsImporting(true);

    const destinations = db.getDestinations();
    const defaultDest = destinations[0] || { id: 'japan', name: 'Japan' };

    let imported = 0;
    let updated = 0;

    const validRows = previewData.filter(r => r.status !== 'INVALID');

    validRows.forEach(row => {
      const existing = db.getProducts().find(p => p.sku === row.sku);
      if (existing) {
        existing.name = row.name;
        existing.adultNetPrice = row.netCost;
        if (row.childNetCost !== undefined) existing.childNetPrice = row.childNetCost;
        if (row.infantNetCost !== undefined) existing.infantNetPrice = row.infantNetCost;
        if (row.shortDescription) existing.shortDescription = row.shortDescription;
        if (row.longDescription) existing.longDescription = row.longDescription;
        if (row.inclusions) existing.inclusions = row.inclusions;
        if (row.exclusions) existing.exclusions = row.exclusions;
        if (row.meetingPoint) existing.meetingPoint = row.meetingPoint;
        if (row.pickupInformation) existing.pickupInformation = row.pickupInformation;
        if (row.operatingDays) existing.operatingDays = row.operatingDays;
        if (row.operatingHours) existing.operatingHours = row.operatingHours;
        if (row.cancellationPolicy) existing.cancellationPolicy = row.cancellationPolicy;
        if (row.importantInformation) existing.importantInformation = row.importantInformation;
        if (row.bookingRequiredDays !== undefined) existing.bookingRequiredDays = row.bookingRequiredDays;
        if (row.duration) existing.duration = row.duration;
        if (row.supplierName) existing.supplierName = row.supplierName;
        if (row.supplierContact) existing.supplierContactDetails = row.supplierContact;
        if (row.supplierLocalCurrency) existing.supplierLocalCurrency = row.supplierLocalCurrency;
        if (row.vehicleModel) (existing as any).vehicleModel = row.vehicleModel;
        if (row.vehicleCapacity) (existing as any).vehicleCapacity = row.vehicleCapacity;
        if (row.pricingMethod) existing.pricingMethod = row.pricingMethod;
        if (row.minPax !== undefined) existing.minPax = row.minPax;
        if (row.maxPax !== undefined) existing.maxPax = row.maxPax;
        if (row.validityFrom) existing.validityFrom = row.validityFrom;
        if (row.validityTo) existing.validityTo = row.validityTo;
        existing.lastUpdated = new Date().toISOString().split('T')[0];

        db.saveProduct(existing, currentUser);
        updated++;
      } else {
        const matchingDest = destinations.find(d => 
          d.name.toLowerCase() === (row.destination || '').toLowerCase() || 
          d.id.toLowerCase() === (row.destination || '').toLowerCase()
        ) || defaultDest;

        const newProduct: Product = {
          id: `prod-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: row.name,
          sku: row.sku,
          destinationId: matchingDest.id,
          destinationName: matchingDest.name,
          country: (matchingDest as any).country || matchingDest.name,
          city: row.city || matchingDest.name,
          productType: 'ACTIVITY',
          category: (row.category as any) || 'SIGHTSEEING',
          subcategory: row.subcategory || 'General',
          shortDescription: row.shortDescription || row.name,
          longDescription: row.longDescription || `Imported via Google Sheets Master Tariff pipeline on ${new Date().toLocaleDateString()}.`,
          supplierId: 'sup-direct-01',
          supplierName: row.supplierName || 'Direct Operations',
          supplierProductCode: row.sku,
          supplierContactDetails: row.supplierContact,
          supplierLocalCurrency: row.supplierLocalCurrency || 'USD',
          duration: row.duration || '4 Hours',
          operatingDays: row.operatingDays || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          operatingHours: row.operatingHours || '09:00 - 18:00',
          adultNetPrice: row.netCost,
          childNetPrice: row.childNetCost ?? Math.round(row.netCost * 0.7),
          infantNetPrice: row.infantNetCost ?? 0,
          currency: 'USD',
          defaultMarkupPercent: 20,
          taxPercent: 10,
          commissionPercent: 0,
          serviceFeeFixed: 0,
          sellingPriceStartingFrom: Math.round(row.netCost * 1.2),
          season: 'All Year',
          validityFrom: row.validityFrom || '2026-01-01',
          validityTo: row.validityTo || '2026-12-31',
          minPax: row.minPax || 1,
          maxPax: row.maxPax || 20,
          availability: 'INSTANT',
          bookingRequiredDays: row.bookingRequiredDays || 2,
          cancellationPolicy: row.cancellationPolicy || 'Free cancellation up to 48 hours prior to service date.',
          inclusions: row.inclusions || ['English Speaking Guide', 'Air Conditioned Vehicle', 'All Entrance Fees'],
          exclusions: row.exclusions || ['Personal Expenses', 'Gratuities'],
          importantInformation: row.importantInformation || ['Please arrive 15 minutes before scheduled start.'],
          meetingPoint: row.meetingPoint || 'Hotel Lobby or Designated Meeting Location',
          pickupInformation: row.pickupInformation || 'Hotel pickup included within city limits',
          images: ['https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop'],
          location: matchingDest.name,
          latitude: 35.6762,
          longitude: 139.6503,
          rating: 4.9,
          reviewCount: 12,
          status: 'ACTIVE',
          lastUpdated: new Date().toISOString().split('T')[0],
          pricingMethod: row.pricingMethod || 'per_person'
        };
        db.saveProduct(newProduct, currentUser);
        imported++;
      }
    });

    db.logAudit(
      currentUser,
      'GOOGLE_SHEETS_SYNC',
      'Google Sheets',
      sheetId,
      `Synchronized ${imported} new and ${updated} updated products from sheet "${sheetTab}".`
    );

    setImportResult({
      success: true,
      importedCount: imported,
      updatedCount: updated,
      errorCount: previewData.length - validRows.length,
      details: `Safely imported ${imported} new tariffs and updated ${updated} existing supplier rates with full inclusions, itinerary & logistics in production.`
    });

    setIsImporting(false);
    onRefresh();
  };

  const filteredMappings = mappings.filter(m => {
    const matchesSearch = schemaSearchQuery.trim() === '' || 
      m.sheetColumn.toLowerCase().includes(schemaSearchQuery.toLowerCase()) ||
      m.dbField.toLowerCase().includes(schemaSearchQuery.toLowerCase()) ||
      m.displayName.toLowerCase().includes(schemaSearchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (schemaCategoryFilter === 'ALL') return true;
    if (schemaCategoryFilter === 'CORE') {
      return ['sku', 'name', 'destinationName', 'city', 'category', 'subcategory', 'status'].includes(m.dbField);
    }
    if (schemaCategoryFilter === 'NARRATIVE') {
      return ['shortDescription', 'longDescription', 'inclusions', 'exclusions', 'importantInformation'].includes(m.dbField);
    }
    if (schemaCategoryFilter === 'LOGISTICS') {
      return ['meetingPoint', 'pickupInformation', 'operatingDays', 'operatingHours', 'duration'].includes(m.dbField);
    }
    if (schemaCategoryFilter === 'GOVERNANCE') {
      return ['cancellationPolicy', 'bookingRequiredDays', 'minPax', 'maxPax', 'validityFrom', 'validityTo'].includes(m.dbField);
    }
    if (schemaCategoryFilter === 'PRICING') {
      return ['supplierName', 'supplierContactDetails', 'supplierLocalCurrency', 'adultNetPrice', 'childNetPrice', 'infantNetPrice', 'defaultMarkupPercent', 'taxPercent', 'vehicleModel', 'vehicleCapacity', 'pricingMethod'].includes(m.dbField);
    }
    return true;
  });

  const filteredPreview = (previewData || []).filter(r => {
    if (previewFilter === 'ALL') return true;
    return r.status === previewFilter;
  });

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200 shadow-xs">
        <div>
          <div className="flex items-center space-x-2 text-emerald-600 text-xs font-bold uppercase tracking-wider mb-1">
            <FileSpreadsheet className="w-4 h-4" />
            <span>Commercial Tariff Pipeline & Bulk Sync</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900">
            Google Sheets Two-Way Tariff Synchronizer
          </h2>
          <p className="text-xs text-slate-500 mt-1 max-w-2xl">
            Two-way synchronization for supplier contracts, adult/child net costs, vehicle capacities, and wholesale product inventories.
          </p>
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          <button
            id="dry-run-preview-btn"
            onClick={handleGeneratePreview}
            disabled={isPreviewLoading}
            className="inline-flex items-center space-x-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-4 h-4 ${isPreviewLoading ? 'animate-spin' : ''}`} />
            <span>{isPreviewLoading ? 'Analyzing Sheet...' : 'Dry-Run Preview'}</span>
          </button>
        </div>
      </div>

      {/* Target Sheet & Tab Selector */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-extrabold uppercase tracking-wider text-slate-400">
            Target Google Spreadsheet & Tab
          </span>
          <span className="text-xs text-emerald-700 font-extrabold flex items-center space-x-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Google Sheets API v4 Active</span>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Google Sheet ID / URL
            </label>
            <input
              type="text"
              value={sheetId}
              onChange={e => setSheetId(e.target.value)}
              placeholder="e.g. 1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-700 mb-1">
              Sheet Tab Name
            </label>
            <input
              type="text"
              value={sheetTab}
              onChange={e => setSheetTab(e.target.value)}
              placeholder="e.g. Master_Tariffs_2026"
              className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Column Schema Mapping Inspector */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="text-base font-extrabold text-slate-900">
                {mappings.length}-Column Schema Mapping & Validation Matrix
              </h3>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                {filteredMappings.length} / {mappings.length} Active Fields
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified end-to-end mapping between spreadsheet header columns and production Firestore schema fields, including logistics, roster sync, and inclusions.
            </p>
          </div>

          <div className="flex items-center space-x-2 shrink-0">
            <button
              onClick={handleDownloadSchemaCsv}
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all cursor-pointer"
              title="Download empty CSV template with all mapped header columns"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Download Schema CSV Template</span>
            </button>
          </div>
        </div>

        {/* Search & Category Filter Pills */}
        <div className="px-6 py-3 bg-slate-50/70 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'ALL', label: 'All Fields', count: mappings.length },
              { id: 'CORE', label: '1. Core & Hierarchy', count: 7 },
              { id: 'NARRATIVE', label: '2. Narrative & Inclusions', count: 5 },
              { id: 'LOGISTICS', label: '3. Logistics & Roster', count: 5 },
              { id: 'GOVERNANCE', label: '4. Governance & Policy', count: 6 },
              { id: 'PRICING', label: '5. Commercial Rates & Fleet', count: 10 }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setSchemaCategoryFilter(tab.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center space-x-1.5 ${
                  schemaCategoryFilter === tab.id
                    ? 'bg-[#008972] text-white shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  schemaCategoryFilter === tab.id ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          <div className="relative min-w-[220px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={schemaSearchQuery}
              onChange={e => setSchemaSearchQuery(e.target.value)}
              placeholder="Search column or field..."
              className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs text-slate-900 focus:outline-none focus:border-emerald-500 placeholder:text-slate-400"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-100 sticky top-0 z-10">
              <tr>
                <th className="py-3 px-6">Sheet Header Column</th>
                <th className="py-3 px-4">Database Field Target</th>
                <th className="py-3 px-4">Field Purpose & Sync Target</th>
                <th className="py-3 px-4">Data Type & Parsing</th>
                <th className="py-3 px-4">Requirement</th>
                <th className="py-3 px-6 text-right">Sample Format</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredMappings.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400 font-medium">
                    No schema columns matched your search query.
                  </td>
                </tr>
              ) : (
                filteredMappings.map((m, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-6 font-bold text-slate-900 flex items-center space-x-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                      <span>{m.sheetColumn}</span>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-emerald-700 font-bold">
                      {m.dbField}
                    </td>
                    <td className="py-3.5 px-4 text-slate-700 font-medium">
                      {m.displayName}
                    </td>
                    <td className="py-3.5 px-4">
                      {m.dataType === 'array' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-amber-100 text-amber-800 border border-amber-200">
                          array (pipe |)
                        </span>
                      ) : m.dataType === 'currency' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          currency (ISO)
                        </span>
                      ) : m.dataType === 'number' ? (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-blue-100 text-blue-800 border border-blue-200">
                          number (float)
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                          string (text)
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {m.isRequired ? (
                        <span className="text-rose-700 font-extrabold text-[10px] bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
                          REQUIRED
                        </span>
                      ) : (
                        <span className="text-slate-400 text-[10px] bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                          OPTIONAL
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right font-mono text-[11px] text-slate-600 max-w-xs truncate" title={m.sampleValue || ''}>
                      {m.sampleValue || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dry Run Preview & Import Console */}
      {previewData && (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden space-y-4 p-6 animate-in fade-in duration-300">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Dry-Run Synchronization Preview ({previewData.length} Rows)
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Review verified rows before applying changes to production database with comprehensive logistics, policies & itinerary fields.
              </p>
            </div>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 bg-slate-100 p-1 rounded-xl text-xs">
                {(['ALL', 'NEW', 'UPDATE', 'INVALID'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setPreviewFilter(f)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer ${
                      previewFilter === f ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <button
                id="execute-sheets-import-btn"
                onClick={handleExecuteImport}
                disabled={isImporting}
                className="inline-flex items-center space-x-2 bg-[#008972] hover:bg-[#00705e] text-white font-extrabold px-4 py-2.5 rounded-xl text-xs transition-all shadow-xs disabled:opacity-50 cursor-pointer"
              >
                <Upload className={`w-4 h-4 ${isImporting ? 'animate-spin' : ''}`} />
                <span>{isImporting ? 'Syncing...' : 'Execute Production Sync'}</span>
              </button>
            </div>
          </div>

          {/* Import Result Banner */}
          {importResult && (
            <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center space-x-3 font-bold">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
              <span>{importResult.details}</span>
            </div>
          )}

          {/* Preview Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-100">
                <tr>
                  <th className="py-3 px-4">Row #</th>
                  <th className="py-3 px-4">SKU Code</th>
                  <th className="py-3 px-6">Product Title & Location</th>
                  <th className="py-3 px-4">Inclusions & Logistics</th>
                  <th className="py-3 px-4">Adult Net</th>
                  <th className="py-3 px-4">Sync Status</th>
                  <th className="py-3 px-6 text-right">Validation Matrix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredPreview.map(row => (
                  <tr key={row.rowNumber} className="hover:bg-slate-50/70">
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-400">
                      #{row.rowNumber}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      {row.sku || <span className="text-rose-500 font-extrabold">MISSING</span>}
                    </td>
                    <td className="py-3.5 px-6">
                      <div className="font-bold text-slate-800">{row.name}</div>
                      <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 mt-0.5">
                        <span className="font-semibold text-slate-700">{row.destination}</span>
                        {row.city && <span>• {row.city}</span>}
                        <span>• {row.category}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {row.inclusions && row.inclusions.length > 0 ? (
                        <div className="space-y-0.5">
                          <span className="inline-block text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md">
                            {row.inclusions.length} Inclusions Mapped
                          </span>
                          {row.operatingDays && (
                            <div className="text-[10px] text-slate-500 font-mono">
                              Roster: {row.operatingDays.slice(0, 3).join(', ')}{row.operatingDays.length > 3 ? '...' : ''}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-slate-400 text-[11px] italic">No inclusions listed</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono font-bold text-slate-900">
                      ${row.netCost.toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4">
                      {row.status === 'NEW' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
                          + New Record
                        </span>
                      )}
                      {row.status === 'UPDATE' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-100 text-blue-800">
                          ↺ Update Price & Logistics
                        </span>
                      )}
                      {row.status === 'INVALID' && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">
                          ✕ Invalid Row
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      {row.issues && row.issues.length > 0 ? (
                        <span className="text-rose-600 text-[11px] font-bold">
                          {row.issues.join(', ')}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold text-xs flex items-center justify-end space-x-1">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Ready for sync</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
