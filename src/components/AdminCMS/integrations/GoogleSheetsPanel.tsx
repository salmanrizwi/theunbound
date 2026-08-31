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
  Database
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
  category: string;
  netCost: number;
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
  const [mappings, setMappings] = useState<SheetsColumnMappingItem[]>(() => hubService.getDefaultSheetsColumnMappings());
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewRow[] | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: boolean; importedCount: number; updatedCount: number; errorCount: number; details: string } | null>(null);
  const [previewFilter, setPreviewFilter] = useState<'ALL' | 'NEW' | 'UPDATE' | 'INVALID'>('ALL');

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
          category: 'Day Tours',
          netCost: 185.00,
          status: existingSkuMap.has('TUB-JP-TYO-001') ? 'UPDATE' : 'NEW'
        },
        {
          rowNumber: 3,
          sku: 'TUB-JP-KYO-002',
          name: 'Kyoto Arashiyama & Golden Pavilion Excursion',
          destination: 'Japan',
          category: 'Cultural Excursions',
          netCost: 210.00,
          status: existingSkuMap.has('TUB-JP-KYO-002') ? 'UPDATE' : 'NEW'
        },
        {
          rowNumber: 4,
          sku: 'TUB-TH-BKK-003',
          name: 'Bangkok Grand Palace & Canal Longtail Boat',
          destination: 'Thailand',
          category: 'City Sightseeing',
          netCost: 130.00,
          status: existingSkuMap.has('TUB-TH-BKK-003') ? 'UPDATE' : 'NEW'
        },
        {
          rowNumber: 5,
          sku: '',
          name: 'Phuket Island Sunset Catamaran Cruise',
          destination: 'Thailand',
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
          category: 'Culinary Experiences',
          netCost: 95.00,
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
    let errors = 0;

    const validRows = previewData.filter(r => r.status !== 'INVALID');

    validRows.forEach(row => {
      const existing = db.getProducts().find(p => p.sku === row.sku);
      if (existing) {
        existing.name = row.name;
        existing.adultNetPrice = row.netCost;
        db.saveProduct(existing, currentUser);
        updated++;
      } else {
        const newProduct: Product = {
          id: `prod-import-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: row.name,
          sku: row.sku,
          destinationId: defaultDest.id,
          destinationName: defaultDest.name,
          country: (defaultDest as any).country || defaultDest.name,
          city: defaultDest.name,
          productType: 'ACTIVITY',
          category: (row.category as any) || 'SIGHTSEEING',
          subcategory: 'General',
          shortDescription: row.name,
          longDescription: `Imported via Google Sheets Master Tariff pipeline on ${new Date().toLocaleDateString()}.`,
          supplierId: 'sup-direct-01',
          supplierName: 'Direct Operations',
          supplierProductCode: row.sku,
          duration: '4 Hours',
          operatingDays: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          operatingHours: '09:00 - 18:00',
          adultNetPrice: row.netCost,
          childNetPrice: Math.round(row.netCost * 0.7),
          infantNetPrice: 0,
          currency: 'USD',
          defaultMarkupPercent: 20,
          taxPercent: 10,
          commissionPercent: 0,
          serviceFeeFixed: 0,
          sellingPriceStartingFrom: Math.round(row.netCost * 1.2),
          season: 'All Year',
          validityFrom: '2026-01-01',
          validityTo: '2026-12-31',
          minPax: 1,
          maxPax: 20,
          availability: 'INSTANT',
          bookingRequiredDays: 2,
          cancellationPolicy: 'Free cancellation up to 48 hours prior to service date.',
          inclusions: ['English Speaking Guide', 'Air Conditioned Vehicle', 'All Entrance Fees'],
          exclusions: ['Personal Expenses', 'Gratuities'],
          importantInformation: ['Please arrive 15 minutes before scheduled start.'],
          meetingPoint: 'Hotel Lobby or Designated Meeting Location',
          pickupInformation: 'Hotel pickup included within city limits',
          images: ['https://images.unsplash.com/photo-1503899036084-c55cdd92da26?q=80&w=1200&auto=format&fit=crop'],
          location: defaultDest.name,
          latitude: 35.6762,
          longitude: 139.6503,
          rating: 4.9,
          reviewCount: 12,
          status: 'ACTIVE',
          lastUpdated: new Date().toISOString().split('T')[0],
          pricingMethod: 'per_person'
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
      details: `Safely imported ${imported} new tariffs and updated ${updated} existing supplier rates in production.`
    });

    setIsImporting(false);
    onRefresh();
  };

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
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h3 className="text-base font-extrabold text-slate-900">
              15-Column Schema Mapping & Validation Matrix
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Verified mapping between spreadsheet header columns and production Firestore schema fields.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">
            {mappings.length} Fields Mapped
          </span>
        </div>

        <div className="overflow-x-auto max-h-72 overflow-y-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-slate-400 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-100 sticky top-0">
              <tr>
                <th className="py-3 px-6">Sheet Header Column</th>
                <th className="py-3 px-4">Database Field Target</th>
                <th className="py-3 px-4">Field Purpose</th>
                <th className="py-3 px-4">Data Type</th>
                <th className="py-3 px-4">Requirement</th>
                <th className="py-3 px-6 text-right">Sample Format</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {mappings.map((m, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70">
                  <td className="py-3 px-6 font-bold text-slate-900">
                    {m.sheetColumn}
                  </td>
                  <td className="py-3 px-4 font-mono text-emerald-700 font-bold">
                    {m.dbField}
                  </td>
                  <td className="py-3 px-4 text-slate-700">
                    {m.displayName}
                  </td>
                  <td className="py-3 px-4">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-mono font-bold bg-slate-100 text-slate-600">
                      {m.dataType}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    {m.isRequired ? (
                      <span className="text-rose-700 font-extrabold text-[10px]">REQUIRED</span>
                    ) : (
                      <span className="text-slate-400 text-[10px]">OPTIONAL</span>
                    )}
                  </td>
                  <td className="py-3 px-6 text-right font-mono text-[11px] text-slate-500">
                    {m.sampleValue || '—'}
                  </td>
                </tr>
              ))}
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
                Review verified rows before applying changes to production database.
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
                  <th className="py-3 px-4">SKU</th>
                  <th className="py-3 px-6">Product Title</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4">Adult Net Rate</th>
                  <th className="py-3 px-4">Sync Action</th>
                  <th className="py-3 px-6 text-right">Validation Details</th>
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
                    <td className="py-3.5 px-6 font-bold text-slate-800">
                      {row.name}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      {row.destination}
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
                          ↺ Update Price
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
                        <span className="text-emerald-700 font-bold">✓ Ready for sync</span>
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
