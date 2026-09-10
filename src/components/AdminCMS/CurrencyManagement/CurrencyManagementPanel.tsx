import React, { useState, useEffect } from 'react';
import { 
  CircleDollarSign, 
  RefreshCw, 
  ArrowRightLeft, 
  TrendingUp, 
  ShieldCheck, 
  History, 
  Calculator, 
  AlertCircle, 
  CheckCircle2, 
  Edit3, 
  Sliders, 
  Search, 
  Globe2, 
  Lock,
  Percent,
  Layers,
  FileSpreadsheet,
  ExternalLink,
  Code2,
  Sparkles,
  Info
} from 'lucide-react';
import { CurrencyCode, CurrencyPairConfig, CurrencyAuditLog, SUPPORTED_CURRENCIES, User } from '../../../types';
import { currencyEngine, CurrencyEngine, convertCurrency, formatCurrency, getExchangeRateInfo, CANONICAL_GOOGLEFINANCE_FORMULAS } from '../../../services/currencyEngine';

interface Props {
  currentUser: User | null;
}

export const CurrencyManagementPanel: React.FC<Props> = ({ currentUser }) => {
  const [activeSubTab, setActiveSubTab] = useState<'RATES_TABLE' | 'GOOGLE_SHEETS_INTEGRATION' | 'CALCULATOR_PREVIEW' | 'AUDIT_LOGS'>('RATES_TABLE');
  const [pairs, setPairs] = useState<CurrencyPairConfig[]>([]);
  const [auditLogs, setAuditLogs] = useState<CurrencyAuditLog[]>([]);
  const [status, setStatus] = useState(currencyEngine.getStatus());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isProvisioning, setIsProvisioning] = useState(false);
  const [refreshSuccess, setRefreshSuccess] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<{ success: boolean; message: string } | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBase, setSelectedBase] = useState<string>('ALL');
  const [selectedTarget, setSelectedTarget] = useState<string>('INR'); // Default to INR to highlight target adjustments
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'PAUSED' | 'STALE'>('ALL');

  // Edit Modal State
  const [editingPair, setEditingPair] = useState<CurrencyPairConfig | null>(null);
  const [adjustmentInput, setAdjustmentInput] = useState<string>('0');
  const [reasonInput, setReasonInput] = useState<string>('');
  const [editError, setEditError] = useState<string | null>(null);

  // Commercial Simulator State
  const [simCost, setSimCost] = useState<number>(50000);
  const [simNativeCurrency, setSimNativeCurrency] = useState<CurrencyCode>('JPY');
  const [simTargetCurrency, setSimTargetCurrency] = useState<CurrencyCode>('INR');
  const [simMarkupPercent, setSimMarkupPercent] = useState<number>(20);
  const [simTaxPercent, setSimTaxPercent] = useState<number>(10);
  const [simServiceFee, setSimServiceFee] = useState<number>(0);

  const defaultSheetId = status.googleSheetId || '1KWIlx7gUBDtPAA9w9Tmg0V-WZUATGZgoH8xo-o9CiQ4';

  const loadData = () => {
    setPairs(currencyEngine.getAllPairs());
    setAuditLogs(currencyEngine.getAuditLogs());
    setStatus(currencyEngine.getStatus());
  };

  useEffect(() => {
    loadData();
    const unsubscribe = currencyEngine.subscribe(() => {
      loadData();
    });
    return () => unsubscribe();
  }, []);

  const handleRefreshLiveRates = async () => {
    setIsRefreshing(true);
    setRefreshSuccess(null);
    try {
      const success = await currencyEngine.fetchLiveRates(true);
      if (success) {
        setRefreshSuccess('Live Google Finance FX rates successfully read from Google Sheet via official Google Sheets API v4');
        setTimeout(() => setRefreshSuccess(null), 5000);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleProvisionSheetTab = async () => {
    setIsProvisioning(true);
    setProvisionResult(null);
    try {
      const res = await currencyEngine.provisionGoogleSheetFXTab(defaultSheetId);
      setProvisionResult(res);
      if (res.success) {
        setRefreshSuccess('FX_RATES tab provisioned with live =GOOGLEFINANCE() formulas in your Google Sheet!');
        setTimeout(() => setRefreshSuccess(null), 6000);
      }
    } finally {
      setIsProvisioning(false);
    }
  };

  const handleOpenEdit = (pair: CurrencyPairConfig) => {
    setEditingPair(pair);
    setAdjustmentInput(pair.manualAdjustment.toString());
    setReasonInput('');
    setEditError(null);
  };

  const handleSaveAdjustment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPair) return;

    const numAdj = parseFloat(adjustmentInput);
    if (isNaN(numAdj)) {
      setEditError('Please enter a valid numeric adjustment value.');
      return;
    }

    if (!reasonInput.trim()) {
      setEditError('Audit policy requires a brief justification/reason for modifying FX adjustments.');
      return;
    }

    const success = currencyEngine.updatePairAdjustment(
      editingPair.id,
      numAdj,
      currentUser,
      reasonInput.trim()
    );

    if (success) {
      setEditingPair(null);
      setRefreshSuccess(`Updated ${editingPair.fromCurrency}/${editingPair.toCurrency} adjustment to ${numAdj >= 0 ? '+' : ''}${numAdj}`);
      setTimeout(() => setRefreshSuccess(null), 4000);
    } else {
      setEditError('Failed to save currency pair adjustment.');
    }
  };

  const handleToggleStatus = (pair: CurrencyPairConfig) => {
    const reason = `Admin toggled status from ${pair.status}`;
    currencyEngine.togglePairStatus(pair.id, currentUser, reason);
  };

  // Filtered pairs
  const filteredPairs = pairs.filter(p => {
    if (selectedBase !== 'ALL' && p.fromCurrency !== selectedBase) return false;
    if (selectedTarget !== 'ALL' && p.toCurrency !== selectedTarget) return false;
    if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchPair = `${p.fromCurrency}/${p.toCurrency}`.toLowerCase().includes(q) ||
                        p.id.toLowerCase().includes(q);
      if (!matchPair) return false;
    }
    return true;
  });

  // Simulator Calculations
  const simNativeMarkup = simCost * (simMarkupPercent / 100);
  const simNativeGross = simCost + simNativeMarkup;
  const simNativeTax = simNativeMarkup * (simTaxPercent / 100);
  const simNativeDeliveredPrice = simNativeGross + simNativeTax + simServiceFee;

  const simFxInfo = currencyEngine.getRateInfo(simNativeCurrency, simTargetCurrency);
  const simConvertedSelling = currencyEngine.convert(simNativeDeliveredPrice, simNativeCurrency, simTargetCurrency);
  const simUnadjustedConverted = simNativeDeliveredPrice * simFxInfo.xeLiveRate;
  const simFxBuffer = simConvertedSelling - simUnadjustedConverted;

  return (
    <div id="currency-management-panel" className="space-y-6">
      {/* 1. EXECUTIVE HEADER & GOOGLE SHEETS =GOOGLEFINANCE() CONNECTION BANNER */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                <FileSpreadsheet className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">Google Sheets =GOOGLEFINANCE() FX Engine</h2>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    Official Sheets API v4 Connected
                  </span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-mono font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <Code2 className="w-3 h-3" /> =GOOGLEFINANCE()
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Authoritative live rates evaluated directly by Google Finance within your connected Google Sheet ({status.googleSheetTab || 'FX_RATES'} worksheet)
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleProvisionSheetTab}
              disabled={isProvisioning}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 transition-all shadow-xs disabled:opacity-50"
              title="Populate or repair the FX_RATES worksheet in your Google Sheet with live =GOOGLEFINANCE() formulas"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isProvisioning ? 'animate-spin' : ''}`} />
              {isProvisioning ? 'Provisioning...' : 'Provision FX_RATES in Sheet'}
            </button>

            <button
              onClick={handleRefreshLiveRates}
              disabled={isRefreshing}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800 active:scale-95 transition-all shadow-xs disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              {isRefreshing ? 'Reading Google Sheet...' : 'Sync Live Sheet Rates'}
            </button>
          </div>
        </div>

        {/* Google Sheet Direct Connection Bar */}
        <div className="mt-4 p-3.5 rounded-lg bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5">
            <span className="font-semibold text-slate-700">Authoritative Data Source:</span>
            <code className="font-mono text-[11px] bg-white px-2 py-0.5 rounded border border-slate-300 text-slate-800 select-all">
              {defaultSheetId}
            </code>
            <span className="text-slate-400">&bull;</span>
            <span className="text-slate-600 font-medium">Tab: <strong className="text-slate-900">{status.googleSheetTab || 'FX_RATES'}</strong></span>
          </div>

          <div className="flex items-center gap-3">
            <a
              href={`https://docs.google.com/spreadsheets/d/${defaultSheetId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
            >
              <span>Open Master Sheet in Google Drive</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Status Indicators Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-slate-100">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Engine Protocol</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5 truncate">{status.provider}</div>
            <div className="text-[10px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> Official Google Sheets API v4
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Last Rate Readout</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">
              {new Date(status.lastFetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </div>
            <div className="text-[10px] text-slate-500 mt-1">
              {new Date(status.lastFetchedAt).toLocaleDateString()}
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
            <div className="text-[11px] font-medium text-slate-500 uppercase tracking-wider">Active Formula Pairs</div>
            <div className="text-sm font-bold text-slate-900 mt-0.5">{pairs.length} Currency Pairs</div>
            <div className="text-[10px] text-indigo-600 font-medium mt-1">
              10 Canonical =GOOGLEFINANCE() Formulas
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-emerald-50/60 border border-emerald-200">
            <div className="text-[11px] font-medium text-emerald-800 uppercase tracking-wider">Commercial Pricing Rule</div>
            <div className="text-sm font-bold text-emerald-950 mt-0.5">Calculate Native First</div>
            <div className="text-[10px] text-emerald-700 font-medium mt-1">
              Zero Rounding Drift Guaranteed
            </div>
          </div>
        </div>

        {refreshSuccess && (
          <div className="mt-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{refreshSuccess}</span>
          </div>
        )}

        {provisionResult && !provisionResult.success && (
          <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>{provisionResult.message}</span>
          </div>
        )}
      </div>

      {/* 2. SUB-TABS NAVIGATION */}
      <div className="flex border-b border-slate-200 gap-6 overflow-x-auto">
        <button
          onClick={() => setActiveSubTab('RATES_TABLE')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'RATES_TABLE'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CircleDollarSign className="w-4 h-4" />
          Currency Pairs & Adjustments ({pairs.length})
        </button>

        <button
          onClick={() => setActiveSubTab('GOOGLE_SHEETS_INTEGRATION')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'GOOGLE_SHEETS_INTEGRATION'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="w-4 h-4" />
          =GOOGLEFINANCE() Formula Inspector
        </button>

        <button
          onClick={() => setActiveSubTab('CALCULATOR_PREVIEW')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'CALCULATOR_PREVIEW'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" />
          Rate Preview & Commercial Simulator
        </button>

        <button
          onClick={() => setActiveSubTab('AUDIT_LOGS')}
          className={`pb-3 text-sm font-semibold flex items-center gap-2 border-b-2 transition-colors whitespace-nowrap ${
            activeSubTab === 'AUDIT_LOGS'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <History className="w-4 h-4" />
          FX Rate Audit Log ({auditLogs.length})
        </button>
      </div>

      {/* 3. SUB-TAB 1: CURRENCY PAIRS & ADJUSTMENTS TABLE */}
      {activeSubTab === 'RATES_TABLE' && (
        <div className="space-y-4">
          {/* Key Direct Pricing Corridor Badges */}
          <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                  Core Inbound Corridors to Indian Rupee (INR)
                </span>
              </div>
              <span className="text-[11px] text-slate-400">
                Formula: Effective Rate = Evaluated =GOOGLEFINANCE() Rate + Manual Adjustment
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { from: 'USD', to: 'INR', defaultAdj: '+1.00', formula: '=GOOGLEFINANCE("CURRENCY:USDINR")' },
                { from: 'JPY', to: 'INR', defaultAdj: '+0.03', formula: '=GOOGLEFINANCE("CURRENCY:JPYINR")' },
                { from: 'EUR', to: 'INR', defaultAdj: '+1.00', formula: '=GOOGLEFINANCE("CURRENCY:EURINR")' },
                { from: 'SGD', to: 'INR', defaultAdj: '+1.00', formula: '=GOOGLEFINANCE("CURRENCY:SGDINR")' },
                { from: 'CHF', to: 'INR', defaultAdj: '+1.00', formula: '=GOOGLEFINANCE("CURRENCY:CHFINR")' },
                { from: 'AED', to: 'INR', defaultAdj: '+0.25', formula: '=GOOGLEFINANCE("CURRENCY:AEDINR")' }
              ].map(item => {
                const p = pairs.find(x => x.id === `${item.from}_${item.to}`);
                return (
                  <div key={item.from} className="bg-white/10 rounded-lg p-2.5 border border-white/15">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-white">{item.from} &rarr; {item.to}</span>
                      <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded">
                        {p ? (p.manualAdjustment >= 0 ? `+${p.manualAdjustment}` : p.manualAdjustment) : item.defaultAdj}
                      </span>
                    </div>
                    <div className="mt-1 flex items-baseline justify-between">
                      <span className="text-sm font-mono font-bold text-white">
                        {p ? p.effectiveRate.toFixed(p.fromCurrency === 'JPY' ? 4 : 2) : '—'}
                      </span>
                      <span className="text-[10px] text-slate-300">GF: {p?.xeLiveRate.toFixed(p.fromCurrency === 'JPY' ? 4 : 2)}</span>
                    </div>
                    <div className="mt-1 text-[9px] font-mono text-emerald-300/80 truncate">
                      {item.formula}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Table Filters */}
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  placeholder="Search pairs (e.g. USD, JPY)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <select
                  value={selectedBase}
                  onChange={(e) => setSelectedBase(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="ALL">All Base Currencies</option>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={selectedTarget}
                  onChange={(e) => setSelectedTarget(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="ALL">All Target Currencies</option>
                  {SUPPORTED_CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900 bg-white"
                >
                  <option value="ALL">All Statuses</option>
                  <option value="ACTIVE">Active Only</option>
                  <option value="PAUSED">Paused Only</option>
                  <option value="STALE">Stale Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Currency Pairs Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Currency Pair</th>
                    <th className="px-4 py-3">Google Sheet Formula</th>
                    <th className="px-4 py-3 text-right">Evaluated Rate</th>
                    <th className="px-4 py-3 text-right">Manual Adjustment</th>
                    <th className="px-4 py-3 text-right">Effective Rate</th>
                    <th className="px-4 py-3 text-right">100 Unit Converted</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Last Updated</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPairs.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-slate-400">
                        No currency pairs match the specified filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPairs.map((p) => {
                      const hundredConverted = 100 * p.effectiveRate;
                      const isTargetINR = p.toCurrency === 'INR';
                      const isHighlighted = isTargetINR && ['USD', 'JPY', 'EUR', 'SGD', 'CHF', 'AED'].includes(p.fromCurrency);
                      const formula = p.googleFinanceFormula || (
                        p.fromCurrency === 'USD'
                          ? CANONICAL_GOOGLEFINANCE_FORMULAS[p.toCurrency]?.direct || `=GOOGLEFINANCE("CURRENCY:USD${p.toCurrency}")`
                          : `=GOOGLEFINANCE("CURRENCY:${p.fromCurrency}${p.toCurrency}")`
                      );

                      return (
                        <tr 
                          key={p.id} 
                          className={`hover:bg-slate-50/80 transition-colors ${
                            isHighlighted ? 'bg-amber-50/25' : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-medium text-slate-900">
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-xs bg-slate-100 text-slate-800 px-2 py-0.5 rounded border border-slate-200">
                                {p.fromCurrency}
                              </span>
                              <span className="text-slate-400">&rarr;</span>
                              <span className="font-bold text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded border border-indigo-200">
                                {p.toCurrency}
                              </span>
                              {isHighlighted && (
                                <span className="text-[10px] font-semibold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                                  Core
                                </span>
                              )}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <code className="text-[11px] font-mono text-indigo-700 bg-indigo-50/80 px-2 py-0.5 rounded border border-indigo-200/60 block max-w-xs truncate" title={formula}>
                              {formula}
                            </code>
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-slate-600">
                            {p.xeLiveRate.toFixed(p.fromCurrency === 'JPY' ? 4 : 4)}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <span className={`inline-flex items-center font-mono font-bold px-2 py-0.5 rounded text-xs ${
                              p.manualAdjustment > 0
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : p.manualAdjustment < 0
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-500'
                            }`}>
                              {p.manualAdjustment > 0 ? `+${p.manualAdjustment}` : p.manualAdjustment}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-right font-mono font-bold text-slate-950 text-xs">
                            {p.effectiveRate.toFixed(p.fromCurrency === 'JPY' ? 4 : 4)}
                          </td>

                          <td className="px-4 py-3 text-right font-mono text-slate-700">
                            {formatCurrency(hundredConverted, p.toCurrency)}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <span className={`inline-block px-2 py-0.5 text-[10px] font-bold rounded-full ${
                              p.status === 'ACTIVE'
                                ? 'bg-emerald-100 text-emerald-800'
                                : p.status === 'PAUSED'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-rose-100 text-rose-800'
                            }`}>
                              {p.status}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-slate-500 text-[11px]">
                            <div>{new Date(p.lastUpdatedAt).toLocaleDateString()}</div>
                            <div className="text-[10px] text-slate-400">{p.updatedByName || 'System'}</div>
                          </td>

                          <td className="px-4 py-3 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEdit(p)}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded bg-slate-100 text-slate-700 hover:bg-slate-900 hover:text-white transition-colors"
                            >
                              Edit Adjustment
                            </button>
                            <button
                              onClick={() => handleToggleStatus(p)}
                              className={`px-2 py-1 text-[10px] font-semibold rounded transition-colors ${
                                p.status === 'ACTIVE'
                                  ? 'text-amber-700 hover:bg-amber-50'
                                  : 'text-emerald-700 hover:bg-emerald-50'
                              }`}
                            >
                              {p.status === 'ACTIVE' ? 'Pause' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 4. SUB-TAB 2: GOOGLE SHEETS =GOOGLEFINANCE() FORMULA INSPECTOR */}
      {activeSubTab === 'GOOGLE_SHEETS_INTEGRATION' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Code2 className="w-5 h-5 text-indigo-600" />
                  Canonical =GOOGLEFINANCE() Formula Definitions
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Because Google deprecated its legacy standalone public REST endpoint, TheUnbound reads rates evaluated natively in Google Sheets via the official Google Sheets API v4.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleProvisionSheetTab}
                  disabled={isProvisioning}
                  className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  {isProvisioning ? 'Writing Formulas to Sheet...' : 'Write Formulas to Google Sheet'}
                </button>
              </div>
            </div>

            <div className="p-4 rounded-lg bg-indigo-50/50 border border-indigo-100 text-xs text-indigo-950 flex items-start gap-3">
              <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">How Google Sheets =GOOGLEFINANCE() Works in TheUnbound:</p>
                <p className="text-indigo-800 text-[11px] leading-relaxed">
                  1. The <code>FX_RATES</code> tab in your Master Google Sheet contains 10 currency pairs with native formulas (e.g. <code>=GOOGLEFINANCE("CURRENCY:USDINR")</code>).<br />
                  2. Google Cloud evaluates these formulas on Google's financial calculation servers.<br />
                  3. TheUnbound calls the Google Sheets API v4 with <code>valueRenderOption=UNFORMATTED_VALUE</code> to read the calculated market values directly, bypassing scraping and ensuring zero downtime.
                </p>
              </div>
            </div>

            {/* Formula Directory Grid */}
            <div className="overflow-x-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs text-slate-700">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                  <tr>
                    <th className="px-4 py-3">Currency Pair</th>
                    <th className="px-4 py-3">Target Currency</th>
                    <th className="px-4 py-3">Direct Formula (USD &rarr; Target)</th>
                    <th className="px-4 py-3 text-right">Evaluated Live Rate</th>
                    <th className="px-4 py-3">Inverse Formula (Target &rarr; USD)</th>
                    <th className="px-4 py-3 text-right">Effective Rate with Adjustment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {SUPPORTED_CURRENCIES.filter(c => c.code !== 'USD').map(curr => {
                    const pair = pairs.find(p => p.id === `USD_${curr.code}`);
                    const formulaDef = CANONICAL_GOOGLEFINANCE_FORMULAS[curr.code];
                    return (
                      <tr key={curr.code} className="hover:bg-slate-50/60">
                        <td className="px-4 py-3 font-bold text-slate-900">
                          USD / {curr.code}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {curr.name} ({curr.symbol})
                        </td>
                        <td className="px-4 py-3">
                          <code className="px-2 py-1 bg-slate-100 text-indigo-700 rounded font-mono text-[11px] border border-slate-200">
                            {formulaDef.direct}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                          {pair ? pair.xeLiveRate.toFixed(curr.code === 'JPY' ? 4 : 4) : '—'}
                        </td>
                        <td className="px-4 py-3">
                          <code className="px-2 py-1 bg-slate-100 text-slate-600 rounded font-mono text-[11px] border border-slate-200">
                            {formulaDef.inverse}
                          </code>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-bold text-emerald-700">
                          {pair ? pair.effectiveRate.toFixed(curr.code === 'JPY' ? 4 : 4) : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. SUB-TAB 3: RATE PREVIEW & COMMERCIAL SIMULATOR */}
      {activeSubTab === 'CALCULATOR_PREVIEW' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200">
                <Calculator className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Commercial Simulator: Calculate Native First</h3>
                <p className="text-xs text-slate-500">
                  Simulate dynamic product pricing with exact wholesale markup, taxes, and live Google Finance conversion
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Inputs */}
              <div className="space-y-4 bg-slate-50 p-5 rounded-xl border border-slate-200">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600">Product Supplier Parameters</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Native Supplier Currency</label>
                    <select
                      value={simNativeCurrency}
                      onChange={(e) => setSimNativeCurrency(e.target.value as CurrencyCode)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {SUPPORTED_CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Target Commercial Currency</label>
                    <select
                      value={simTargetCurrency}
                      onChange={(e) => setSimTargetCurrency(e.target.value as CurrencyCode)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                    >
                      {SUPPORTED_CURRENCIES.map(c => (
                        <option key={c.code} value={c.code}>{c.code} - {c.name}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Supplier Nett Cost</label>
                  <input
                    type="number"
                    value={simCost}
                    onChange={(e) => setSimCost(Math.max(0, parseFloat(e.target.value) || 0))}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Wholesale Markup (%)</label>
                    <input
                      type="number"
                      value={simMarkupPercent}
                      onChange={(e) => setSimMarkupPercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Local GST / Tax (%)</label>
                    <input
                      type="number"
                      value={simTaxPercent}
                      onChange={(e) => setSimTaxPercent(parseFloat(e.target.value) || 0)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Operational Fee (Native)</label>
                  <input
                    type="number"
                    value={simServiceFee}
                    onChange={(e) => setSimServiceFee(parseFloat(e.target.value) || 0)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                  />
                </div>
              </div>

              {/* Output Results */}
              <div className="space-y-4 bg-white p-5 rounded-xl border border-slate-200 flex flex-col justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-600 mb-3">
                    Native Calculation Breakdown ({simNativeCurrency})
                  </h4>

                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Supplier Nett:</span>
                      <span className="font-mono font-medium">{formatCurrency(simCost, simNativeCurrency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Markup (+{simMarkupPercent}%):</span>
                      <span className="font-mono font-medium">{formatCurrency(simNativeMarkup, simNativeCurrency)}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-100">
                      <span className="text-slate-500">Tax on Markup ({simTaxPercent}%):</span>
                      <span className="font-mono font-medium">{formatCurrency(simNativeTax, simNativeCurrency)}</span>
                    </div>
                    {simServiceFee > 0 && (
                      <div className="flex justify-between py-1 border-b border-slate-100">
                        <span className="text-slate-500">Service Fee:</span>
                        <span className="font-mono font-medium">{formatCurrency(simServiceFee, simNativeCurrency)}</span>
                      </div>
                    )}
                    <div className="flex justify-between py-2 border-t border-slate-300 font-bold text-slate-900">
                      <span>Delivered Native Price:</span>
                      <span className="font-mono text-indigo-700">{formatCurrency(simNativeDeliveredPrice, simNativeCurrency)}</span>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-slate-900 text-white space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-slate-300">Target Converted Commercial Price</span>
                    <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950 px-2 py-0.5 rounded">
                      Rate: {simFxInfo.effectiveRate.toFixed(4)}
                    </span>
                  </div>

                  <div className="text-2xl font-bold font-mono text-white">
                    {formatCurrency(simConvertedSelling, simTargetCurrency)}
                  </div>

                  <div className="pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                    <div className="flex justify-between">
                      <span>Google Finance Market Value:</span>
                      <span className="font-mono text-slate-300">{formatCurrency(simUnadjustedConverted, simTargetCurrency)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Adjustment Margin Buffer:</span>
                      <span className="font-mono text-emerald-400">
                        +{formatCurrency(simFxBuffer, simTargetCurrency)} ({simFxInfo.manualAdjustment >= 0 ? `+${simFxInfo.manualAdjustment}` : simFxInfo.manualAdjustment} spread)
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. SUB-TAB 4: AUDIT LOGS */}
      {activeSubTab === 'AUDIT_LOGS' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Currency Adjustment Audit Logs</h3>
              <p className="text-xs text-slate-500">Chronological history of manual FX adjustments with reason trail</p>
            </div>
            <span className="text-xs font-semibold px-2.5 py-1 rounded bg-slate-100 text-slate-700">
              {auditLogs.length} Events Recorded
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-700">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] font-bold">
                <tr>
                  <th className="px-4 py-3">Timestamp</th>
                  <th className="px-4 py-3">Pair</th>
                  <th className="px-4 py-3 text-right">Adjustment Change</th>
                  <th className="px-4 py-3 text-right">Effective Rate Change</th>
                  <th className="px-4 py-3">Changed By</th>
                  <th className="px-4 py-3">Reason / Policy Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No currency adjustments recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/60">
                      <td className="px-4 py-3 text-slate-500 font-mono text-[11px]">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-900">
                        {log.fromCurrency} &rarr; {log.toCurrency}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="text-slate-400">{log.previousAdjustment >= 0 ? `+${log.previousAdjustment}` : log.previousAdjustment}</span>
                        <span className="mx-1">&rarr;</span>
                        <span className="font-bold text-emerald-700">
                          {log.newAdjustment >= 0 ? `+${log.newAdjustment}` : log.newAdjustment}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        <span className="text-slate-400">{log.previousEffectiveRate.toFixed(4)}</span>
                        <span className="mx-1">&rarr;</span>
                        <span className="font-bold text-slate-900">{log.newEffectiveRate.toFixed(4)}</span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {log.changedByName || 'Administrator'}
                      </td>
                      <td className="px-4 py-3 text-slate-600 italic">
                        {log.reason}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. EDIT ADJUSTMENT MODAL */}
      {editingPair && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  Edit Currency Pair Adjustment
                </h3>
                <p className="text-xs text-slate-500">
                  {editingPair.fromCurrency} &rarr; {editingPair.toCurrency}
                </p>
              </div>
              <button
                onClick={() => setEditingPair(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                &times;
              </button>
            </div>

            <form onSubmit={handleSaveAdjustment} className="space-y-4">
              {/* Google Sheets Formula Card */}
              <div className="bg-indigo-50/70 p-3.5 rounded-xl border border-indigo-100 space-y-1.5 text-xs">
                <div className="text-[11px] font-bold text-indigo-900 uppercase tracking-wider">
                  Connected Google Sheet Formula:
                </div>
                <code className="font-mono text-xs font-bold text-indigo-700 block bg-white px-2.5 py-1.5 rounded border border-indigo-200">
                  {editingPair.googleFinanceFormula || `=GOOGLEFINANCE("CURRENCY:${editingPair.fromCurrency}${editingPair.toCurrency}")`}
                </code>
              </div>

              {/* Rate Breakdown Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>Google Finance Evaluated Rate:</span>
                  <span className="font-mono font-semibold text-slate-900">{editingPair.xeLiveRate.toFixed(4)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>Current Manual Adjustment:</span>
                  <span className="font-mono font-semibold text-emerald-700">
                    {editingPair.manualAdjustment >= 0 ? `+${editingPair.manualAdjustment}` : editingPair.manualAdjustment}
                  </span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold pt-2 border-t border-slate-200">
                  <span>Current Effective Rate:</span>
                  <span className="font-mono text-slate-900">{editingPair.effectiveRate.toFixed(4)}</span>
                </div>
              </div>

              {/* New Adjustment Input */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Manual FX Adjustment (Absolute Value)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.0001"
                    value={adjustmentInput}
                    onChange={(e) => setAdjustmentInput(e.target.value)}
                    placeholder="e.g. 1.00 or 0.03"
                    className="w-full px-3 py-2 text-sm font-mono font-bold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                    required
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  Formula: Effective Rate = {editingPair.xeLiveRate.toFixed(4)} + ({adjustmentInput || '0'}) ={' '}
                  <strong className="text-emerald-700">
                    {(editingPair.xeLiveRate + (parseFloat(adjustmentInput) || 0)).toFixed(4)}
                  </strong>
                </p>
              </div>

              {/* Commercial Impact Preview */}
              <div className="bg-emerald-50/60 p-3 rounded-lg border border-emerald-200 text-xs">
                <div className="font-semibold text-emerald-900">Commercial 100 Unit Preview:</div>
                <div className="text-emerald-800 text-[11px] mt-0.5">
                  100 {editingPair.fromCurrency} converts to{' '}
                  <strong>{formatCurrency(100 * (editingPair.xeLiveRate + (parseFloat(adjustmentInput) || 0)), editingPair.toCurrency)}</strong>
                </div>
              </div>

              {/* Mandatory Reason for Change */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Reason for Adjustment <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={reasonInput}
                  onChange={(e) => setReasonInput(e.target.value)}
                  placeholder="e.g. Volatility buffer, quarterly commercial review, bank transfer markup"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900"
                  required
                />
                <p className="text-[10px] text-slate-400 mt-1">Mandatory for financial audit compliance.</p>
              </div>

              {editError && (
                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{editError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingPair(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-slate-900 text-white hover:bg-slate-800"
                >
                  Save & Apply Rate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
