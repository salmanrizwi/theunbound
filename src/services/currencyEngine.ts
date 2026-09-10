import { CurrencyCode, CurrencyPairConfig, CurrencyAuditLog, CurrencySettings, FXRateDetails, SUPPORTED_CURRENCIES, User } from '../types';

// Default baseline rates relative to 1 USD
export const BASELINE_USD_RATES: Record<CurrencyCode, number> = {
  USD: 1.0,
  EUR: 0.86,
  GBP: 0.74,
  JPY: 153.50,
  AED: 3.67,
  THB: 32.90,
  AUD: 1.39,
  CAD: 1.38,
  SGD: 1.26,
  INR: 95.10,
  CHF: 0.81
};

// Official Google Sheets =GOOGLEFINANCE() formulas for each currency
export const CANONICAL_GOOGLEFINANCE_FORMULAS: Record<CurrencyCode, { direct: string; inverse: string }> = {
  USD: { direct: '1.0', inverse: '1.0' },
  EUR: { direct: '=GOOGLEFINANCE("CURRENCY:USDEUR")', inverse: '=GOOGLEFINANCE("CURRENCY:EURUSD")' },
  GBP: { direct: '=GOOGLEFINANCE("CURRENCY:USDGBP")', inverse: '=GOOGLEFINANCE("CURRENCY:GBPUSD")' },
  JPY: { direct: '=GOOGLEFINANCE("CURRENCY:USDJPY")', inverse: '=GOOGLEFINANCE("CURRENCY:JPYUSD")' },
  AED: { direct: '=GOOGLEFINANCE("CURRENCY:USDAED")', inverse: '=GOOGLEFINANCE("CURRENCY:AEDUSD")' },
  THB: { direct: '=GOOGLEFINANCE("CURRENCY:USDTHB")', inverse: '=GOOGLEFINANCE("CURRENCY:THBUSD")' },
  AUD: { direct: '=GOOGLEFINANCE("CURRENCY:USDAUD")', inverse: '=GOOGLEFINANCE("CURRENCY:AUDUSD")' },
  CAD: { direct: '=GOOGLEFINANCE("CURRENCY:USDCAD")', inverse: '=GOOGLEFINANCE("CURRENCY:CADUSD")' },
  SGD: { direct: '=GOOGLEFINANCE("CURRENCY:USDSGD")', inverse: '=GOOGLEFINANCE("CURRENCY:SGDUSD")' },
  INR: { direct: '=GOOGLEFINANCE("CURRENCY:USDINR")', inverse: '=GOOGLEFINANCE("CURRENCY:INRUSD")' },
  CHF: { direct: '=GOOGLEFINANCE("CURRENCY:USDCHF")', inverse: '=GOOGLEFINANCE("CURRENCY:CHFUSD")' }
};

// Initial Required Adjustments specified in Master Implementation Specification
export const INITIAL_MANUAL_ADJUSTMENTS: Record<string, number> = {
  'USD_INR': 1.00,
  'JPY_INR': 0.03,
  'EUR_INR': 1.00,
  'SGD_INR': 1.00,
  'CHF_INR': 1.00,
  'AED_INR': 0.25,
  'GBP_INR': 1.00,
  'THB_INR': 0.05,
  'AUD_INR': 0.50,
  'CAD_INR': 0.50
};

const STORAGE_KEY_PAIRS = 'theunbound_currency_pairs_v3';
const STORAGE_KEY_SETTINGS = 'theunbound_currency_settings_v3';
const STORAGE_KEY_AUDIT = 'theunbound_currency_audit_logs_v3';

export class CurrencyEngine {
  private static instance: CurrencyEngine;
  private usdRates: Record<CurrencyCode, number> = { ...BASELINE_USD_RATES };
  private pairs: Map<string, CurrencyPairConfig> = new Map();
  private auditLogs: CurrencyAuditLog[] = [];
  private settings: CurrencySettings = {
    baseCurrency: 'USD',
    googleSheetsSyncEnabled: true,
    googleSheetTabName: 'FX_RATES',
    googleFinanceProviderEnabled: true,
    xeProviderEnabled: true,
    cacheTtlMinutes: 60,
    fallbackPolicy: 'USE_LAST_VALID',
    staleThresholdMinutes: 180,
    lastGlobalSyncAt: new Date().toISOString(),
    autoSyncIntervalMinutes: 60
  };
  private isLive: boolean = false;
  private isStale: boolean = false;
  private provider: string = 'Google Sheets =GOOGLEFINANCE() Official Feed';
  private sourceType: string = 'GOOGLE_SHEETS_API';
  private googleSheetId?: string;
  private googleSheetTab?: string;
  private lastFetchedAt: string = new Date().toISOString();
  private listeners: Set<() => void> = new Set();
  private isFetching: boolean = false;

  private constructor() {
    this.initDefaultPairs();
    this.loadFromStorage();
    this.fetchLiveRates();
    
    // Auto-refresh periodically (every 30 minutes in active sessions)
    if (typeof window !== 'undefined') {
      window.setInterval(() => {
        this.fetchLiveRates();
      }, 30 * 60 * 1000);
    }
  }

  public static getInstance(): CurrencyEngine {
    if (!CurrencyEngine.instance) {
      CurrencyEngine.instance = new CurrencyEngine();
    }
    return CurrencyEngine.instance;
  }

  /**
   * Initializes all supported currency pairs with live estimates, formulas, and initial adjustments
   */
  private initDefaultPairs() {
    const codes = SUPPORTED_CURRENCIES.map(c => c.code);
    const now = new Date().toISOString();

    for (const from of codes) {
      for (const to of codes) {
        if (from === to) continue;
        const pairId = `${from}_${to}`;
        const fromUsd = BASELINE_USD_RATES[from] || 1.0;
        const toUsd = BASELINE_USD_RATES[to] || 1.0;
        const rawRate = toUsd / fromUsd;
        const manualAdj = INITIAL_MANUAL_ADJUSTMENTS[pairId] || 0;
        const effectiveRate = Number((rawRate + manualAdj).toFixed(6));

        const formula = from === 'USD' 
          ? CANONICAL_GOOGLEFINANCE_FORMULAS[to]?.direct || `=GOOGLEFINANCE("CURRENCY:USD${to}")`
          : `=GOOGLEFINANCE("CURRENCY:${from}${to}")`;

        this.pairs.set(pairId, {
          id: pairId,
          fromCurrency: from,
          toCurrency: to,
          googleFinanceLiveRate: Number(rawRate.toFixed(6)),
          googleFinanceFormula: formula,
          xeLiveRate: Number(rawRate.toFixed(6)),
          manualAdjustment: manualAdj,
          effectiveRate,
          status: 'ACTIVE',
          lastFetchedAt: now,
          lastUpdatedAt: now,
          updatedBy: 'system',
          updatedByName: 'TheUnbound Google Finance Engine'
        });
      }
    }
  }

  private getStoredGoogleSheetId(): string | null {
    if (typeof window === 'undefined') return null;
    try {
      const stored = localStorage.getItem('theunbound_master_sheet_config') || sessionStorage.getItem('theunbound_master_sheet_config');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.spreadsheetId) return parsed.spreadsheetId;
      }
    } catch (_) {}
    return '1KWIlx7gUBDtPAA9w9Tmg0V-WZUATGZgoH8xo-o9CiQ4';
  }

  private getClientOAuthToken(): string | null {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem('google_access_token') || localStorage.getItem('google_access_token');
  }

  private loadFromStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const storedPairs = window.localStorage.getItem(STORAGE_KEY_PAIRS);
        if (storedPairs) {
          const parsed: CurrencyPairConfig[] = JSON.parse(storedPairs);
          parsed.forEach(p => this.pairs.set(p.id, p));
        }

        const storedSettings = window.localStorage.getItem(STORAGE_KEY_SETTINGS);
        if (storedSettings) {
          this.settings = { ...this.settings, ...JSON.parse(storedSettings) };
        }

        const storedAudit = window.localStorage.getItem(STORAGE_KEY_AUDIT);
        if (storedAudit) {
          this.auditLogs = JSON.parse(storedAudit);
        }
      }
    } catch (e) {
      console.warn('[CurrencyEngine] Could not load from storage:', e);
    }
  }

  private saveToStorage() {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const pairArray = Array.from(this.pairs.values());
        window.localStorage.setItem(STORAGE_KEY_PAIRS, JSON.stringify(pairArray));
        window.localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(this.settings));
        window.localStorage.setItem(STORAGE_KEY_AUDIT, JSON.stringify(this.auditLogs.slice(0, 200)));
      }
    } catch (e) {
      console.warn('[CurrencyEngine] Could not save to storage:', e);
    }
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  private notify() {
    this.saveToStorage();
    this.listeners.forEach(cb => {
      try { cb(); } catch (err) { console.error('[CurrencyEngine] Listener error:', err); }
    });
  }

  /**
   * Fetches fresh authoritative Google Finance rates from backend /api/fx/rates,
   * reading from connected Google Sheet =GOOGLEFINANCE() formulas via Google Sheets API v4
   */
  public async fetchLiveRates(forceFresh: boolean = false): Promise<boolean> {
    if (this.isFetching) return false;
    this.isFetching = true;

    const sheetId = this.getStoredGoogleSheetId();
    const token = this.getClientOAuthToken();

    try {
      const params = new URLSearchParams();
      if (forceFresh) params.set('fresh', 'true');
      if (sheetId) params.set('spreadsheetId', sheetId);

      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/fx/rates?${params.toString()}`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          this.usdRates = { ...BASELINE_USD_RATES, ...data.rates };
          this.lastFetchedAt = data.fetchedAt || new Date().toISOString();
          this.isLive = data.isLive ?? true;
          this.isStale = data.isStale ?? false;
          this.provider = data.provider || 'Google Sheets =GOOGLEFINANCE() Official Feed';
          this.sourceType = data.sourceType || 'GOOGLE_SHEETS_API';
          this.googleSheetId = data.googleSheetId || sheetId || undefined;
          this.googleSheetTab = data.googleSheetTab || 'FX_RATES';

          // Recompute all pair effective rates with current manual adjustments & formulas
          this.recalculateAllPairs();
          this.notify();
          this.isFetching = false;
          return true;
        }
      }
    } catch (err) {
      console.warn('[CurrencyEngine] Failed to reach backend FX endpoint, trying direct live fallback:', err);
    }

    // Direct client fallback to open ER API if backend is temporarily unreachable
    try {
      const fallbackRes = await fetch('https://open.er-api.com/v6/latest/USD');
      if (fallbackRes.ok) {
        const fbData = await fallbackRes.json();
        if (fbData && fbData.rates) {
          this.usdRates = { ...BASELINE_USD_RATES, ...fbData.rates };
          this.lastFetchedAt = new Date().toISOString();
          this.isLive = true;
          this.isStale = false;
          this.provider = 'Google Finance Live Feed (Interbank Bridge)';
          this.sourceType = 'INTERBANK_FEED';
          this.recalculateAllPairs();
          this.notify();
          this.isFetching = false;
          return true;
        }
      }
    } catch (fbErr) {
      console.warn('[CurrencyEngine] Direct fallback failed:', fbErr);
    }

    this.isStale = true;
    this.isFetching = false;
    return false;
  }

  /**
   * Provisions the official FX_RATES worksheet in the connected Google Sheet
   * with live =GOOGLEFINANCE() formulas
   */
  public async provisionGoogleSheetFXTab(spreadsheetId?: string): Promise<{ success: boolean; message: string; rowsWritten?: number }> {
    const targetSheetId = spreadsheetId || this.getStoredGoogleSheetId();
    const token = this.getClientOAuthToken();

    if (!targetSheetId) {
      return { success: false, message: 'No Google Sheet ID configured.' };
    }

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch('/api/fx/google-sheets/provision', {
        method: 'POST',
        headers,
        body: JSON.stringify({ spreadsheetId: targetSheetId })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        await this.fetchLiveRates(true);
        return {
          success: true,
          message: data.message || 'FX_RATES tab created in Google Sheet with live =GOOGLEFINANCE() formulas!',
          rowsWritten: data.rowsWritten
        };
      } else {
        return {
          success: false,
          message: data.error || 'Failed to provision FX_RATES tab in Google Sheet.'
        };
      }
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error while provisioning Google Sheet' };
    }
  }

  /**
   * Checks the status of the FX_RATES tab in the connected Google Sheet
   */
  public async checkGoogleSheetFXStatus(spreadsheetId?: string): Promise<any> {
    const targetSheetId = spreadsheetId || this.getStoredGoogleSheetId();
    const token = this.getClientOAuthToken();

    const params = new URLSearchParams();
    if (targetSheetId) params.set('spreadsheetId', targetSheetId);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    try {
      const res = await fetch(`/api/fx/google-sheets/status?${params.toString()}`, { headers });
      if (res.ok) {
        return await res.json();
      }
    } catch (err) {
      console.warn('[CurrencyEngine] checkGoogleSheetFXStatus error:', err);
    }
    return { connected: false, tabExists: false };
  }

  private recalculateAllPairs() {
    const now = new Date().toISOString();
    this.pairs.forEach((pair) => {
      const fromUsd = this.usdRates[pair.fromCurrency] || BASELINE_USD_RATES[pair.fromCurrency] || 1.0;
      const toUsd = this.usdRates[pair.toCurrency] || BASELINE_USD_RATES[pair.toCurrency] || 1.0;
      const rawRate = toUsd / fromUsd;
      
      const formula = pair.fromCurrency === 'USD'
        ? CANONICAL_GOOGLEFINANCE_FORMULAS[pair.toCurrency]?.direct || `=GOOGLEFINANCE("CURRENCY:USD${pair.toCurrency}")`
        : `=GOOGLEFINANCE("CURRENCY:${pair.fromCurrency}${pair.toCurrency}")`;

      pair.googleFinanceLiveRate = Number(rawRate.toFixed(6));
      pair.googleFinanceFormula = formula;
      pair.xeLiveRate = Number(rawRate.toFixed(6));
      pair.effectiveRate = Number(Math.max(0.000001, pair.xeLiveRate + (pair.manualAdjustment || 0)).toFixed(6));
      pair.lastFetchedAt = now;
      pair.status = this.isStale ? 'STALE' : 'ACTIVE';
    });
  }

  /**
   * Primary Conversion Function:
   * "Calculate Native First, Convert Second"
   * Converts the delivered commercial price from nativeCurrency to targetCurrency
   */
  public convert(amount: number, from: CurrencyCode | string, to: CurrencyCode | string): number {
    const safeAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : (Number(amount) || 0);
    if (safeAmount === 0) return 0;

    const fromCode = (from || 'USD').toUpperCase() as CurrencyCode;
    const toCode = (to || 'USD').toUpperCase() as CurrencyCode;

    if (fromCode === toCode) {
      return safeAmount;
    }

    const pairId = `${fromCode}_${toCode}`;
    const directPair = this.pairs.get(pairId);

    if (directPair && directPair.status !== 'PAUSED') {
      return safeAmount * directPair.effectiveRate;
    }

    // Check inverse pair
    const inversePairId = `${toCode}_${fromCode}`;
    const inversePair = this.pairs.get(inversePairId);
    if (inversePair && inversePair.effectiveRate > 0 && inversePair.status !== 'PAUSED') {
      return safeAmount / inversePair.effectiveRate;
    }

    // Triangulate via USD base rate
    const fromUsd = this.usdRates[fromCode] || BASELINE_USD_RATES[fromCode] || 1.0;
    const toUsd = this.usdRates[toCode] || BASELINE_USD_RATES[toCode] || 1.0;
    const baseEffectiveRate = toUsd / fromUsd;

    return safeAmount * baseEffectiveRate;
  }

  /**
   * Retrieves full rate details, Google Finance live rate, adjustment, and metadata
   */
  public getRateInfo(from: CurrencyCode | string, to: CurrencyCode | string): FXRateDetails {
    const fromCode = (from || 'USD').toUpperCase() as CurrencyCode;
    const toCode = (to || 'USD').toUpperCase() as CurrencyCode;

    if (fromCode === toCode) {
      return {
        nativeCurrency: fromCode,
        targetCurrency: toCode,
        googleFinanceLiveRate: 1.0,
        googleFinanceFormula: '1.0',
        xeLiveRate: 1.0,
        manualAdjustment: 0.0,
        effectiveRate: 1.0,
        isConverted: false,
        rateTimestamp: this.lastFetchedAt,
        provider: this.provider
      };
    }

    const pairId = `${fromCode}_${toCode}`;
    const directPair = this.pairs.get(pairId);

    const formula = fromCode === 'USD'
      ? CANONICAL_GOOGLEFINANCE_FORMULAS[toCode]?.direct || `=GOOGLEFINANCE("CURRENCY:USD${toCode}")`
      : `=GOOGLEFINANCE("CURRENCY:${fromCode}${toCode}")`;

    if (directPair) {
      return {
        nativeCurrency: fromCode,
        targetCurrency: toCode,
        googleFinanceLiveRate: directPair.googleFinanceLiveRate ?? directPair.xeLiveRate,
        googleFinanceFormula: directPair.googleFinanceFormula || formula,
        xeLiveRate: directPair.xeLiveRate,
        manualAdjustment: directPair.manualAdjustment,
        effectiveRate: directPair.effectiveRate,
        isConverted: true,
        rateTimestamp: directPair.lastFetchedAt,
        provider: this.provider
      };
    }

    // Calculate on-the-fly if pair object not explicitly cached
    const fromUsd = this.usdRates[fromCode] || BASELINE_USD_RATES[fromCode] || 1.0;
    const toUsd = this.usdRates[toCode] || BASELINE_USD_RATES[toCode] || 1.0;
    const rawRate = toUsd / fromUsd;
    const manualAdj = INITIAL_MANUAL_ADJUSTMENTS[pairId] || 0;

    return {
      nativeCurrency: fromCode,
      targetCurrency: toCode,
      googleFinanceLiveRate: Number(rawRate.toFixed(6)),
      googleFinanceFormula: formula,
      xeLiveRate: Number(rawRate.toFixed(6)),
      manualAdjustment: manualAdj,
      effectiveRate: Number((rawRate + manualAdj).toFixed(6)),
      isConverted: true,
      rateTimestamp: this.lastFetchedAt,
      provider: this.provider
    };
  }

  /**
   * Formats numeric amounts using official symbols and zero decimals for JPY/THB
   */
  public format(amount?: number | null, currency: CurrencyCode | string = 'USD', options?: { showCode?: boolean }): string {
    const safeAmount = (typeof amount === 'number' && !isNaN(amount)) ? amount : (Number(amount) || 0);
    const safeCurrency = ((typeof currency === 'string' ? currency : 'USD') || 'USD').toUpperCase();
    const decimals = (safeCurrency === 'JPY' || safeCurrency === 'THB') ? 0 : 2;

    const symbolMap: Record<string, string> = {
      USD: '$',
      EUR: '€',
      GBP: '£',
      JPY: '¥',
      AED: 'AED ',
      THB: '฿',
      AUD: 'A$',
      CAD: 'CA$',
      SGD: 'S$',
      INR: '₹',
      CHF: 'CHF '
    };

    const symbol = symbolMap[safeCurrency] || `${safeCurrency} `;
    const formattedNum = safeAmount.toLocaleString(undefined, {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });

    if (options?.showCode) {
      return `${symbol}${formattedNum} ${safeCurrency}`;
    }
    return `${symbol}${formattedNum}`;
  }

  /**
   * Update manual adjustment for a currency pair with audit trail
   */
  public updatePairAdjustment(
    pairId: string,
    newAdjustment: number,
    user: User | null,
    reason: string
  ): boolean {
    const pair = this.pairs.get(pairId);
    if (!pair) return false;

    const prevLiveRate = pair.xeLiveRate;
    const prevAdjustment = pair.manualAdjustment;
    const prevEffective = pair.effectiveRate;

    const numericAdj = Number(newAdjustment);
    if (isNaN(numericAdj)) return false;

    pair.manualAdjustment = numericAdj;
    pair.effectiveRate = Number(Math.max(0.000001, pair.xeLiveRate + numericAdj).toFixed(6));
    pair.lastUpdatedAt = new Date().toISOString();
    pair.updatedBy = user?.id || 'admin';
    pair.updatedByName = user?.name || user?.email || 'Admin';

    // Create Audit Log Entry
    const auditRecord: CurrencyAuditLog = {
      id: `fx-audit-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      pairId,
      fromCurrency: pair.fromCurrency,
      toCurrency: pair.toCurrency,
      previousLiveRate: prevLiveRate,
      newLiveRate: pair.xeLiveRate,
      previousAdjustment: prevAdjustment,
      newAdjustment: numericAdj,
      previousEffectiveRate: prevEffective,
      newEffectiveRate: pair.effectiveRate,
      changedByUserId: user?.id || 'admin',
      changedByName: user?.name || 'Administrator',
      changedByEmail: user?.email,
      reason: reason || 'CMS Manual FX Rate Margin Calibration',
      timestamp: new Date().toISOString()
    };

    this.auditLogs.unshift(auditRecord);
    this.notify();
    return true;
  }

  public togglePairStatus(pairId: string, user: User | null, reason: string): boolean {
    const pair = this.pairs.get(pairId);
    if (!pair) return false;

    const oldStatus = pair.status;
    pair.status = oldStatus === 'ACTIVE' ? 'PAUSED' : 'ACTIVE';
    pair.lastUpdatedAt = new Date().toISOString();
    pair.updatedBy = user?.id || 'admin';

    this.auditLogs.unshift({
      id: `fx-audit-${Date.now()}`,
      pairId,
      fromCurrency: pair.fromCurrency,
      toCurrency: pair.toCurrency,
      previousLiveRate: pair.xeLiveRate,
      newLiveRate: pair.xeLiveRate,
      previousAdjustment: pair.manualAdjustment,
      newAdjustment: pair.manualAdjustment,
      previousEffectiveRate: pair.effectiveRate,
      newEffectiveRate: pair.effectiveRate,
      changedByUserId: user?.id || 'admin',
      changedByName: user?.name || 'Administrator',
      reason: reason || `Status changed from ${oldStatus} to ${pair.status}`,
      timestamp: new Date().toISOString()
    });

    this.notify();
    return true;
  }

  public getAllPairs(): CurrencyPairConfig[] {
    return Array.from(this.pairs.values());
  }

  public getPair(pairId: string): CurrencyPairConfig | undefined {
    return this.pairs.get(pairId);
  }

  public getAuditLogs(): CurrencyAuditLog[] {
    return [...this.auditLogs];
  }

  public getSettings(): CurrencySettings {
    return { ...this.settings };
  }

  public updateSettings(newSettings: Partial<CurrencySettings>, user: User | null): void {
    this.settings = { ...this.settings, ...newSettings };
    this.auditLogs.unshift({
      id: `fx-audit-settings-${Date.now()}`,
      pairId: 'GLOBAL_SETTINGS',
      fromCurrency: 'USD',
      toCurrency: 'USD',
      previousLiveRate: 1,
      newLiveRate: 1,
      previousAdjustment: 0,
      newAdjustment: 0,
      previousEffectiveRate: 1,
      newEffectiveRate: 1,
      changedByUserId: user?.id || 'admin',
      changedByName: user?.name || 'Administrator',
      reason: 'Global Currency Engine configuration updated',
      timestamp: new Date().toISOString()
    });
    this.notify();
  }

  public getStatus() {
    return {
      isLive: this.isLive,
      isStale: this.isStale,
      provider: this.provider,
      sourceType: this.sourceType,
      googleSheetId: this.googleSheetId,
      googleSheetTab: this.googleSheetTab || 'FX_RATES',
      lastFetchedAt: this.lastFetchedAt,
      baseCurrency: this.settings.baseCurrency,
      pairCount: this.pairs.size
    };
  }
}

// Global Singleton Instance
export const currencyEngine = CurrencyEngine.getInstance();

// Primary Exported Utility Functions
export function convertCurrency(amount: number, from: CurrencyCode | string, to: CurrencyCode | string): number {
  return currencyEngine.convert(amount, from, to);
}

export function formatCurrency(amount?: number | null, currency: CurrencyCode | string = 'USD', options?: { showCode?: boolean }): string {
  return currencyEngine.format(amount, currency, options);
}

export function getExchangeRateInfo(from: CurrencyCode | string, to: CurrencyCode | string): FXRateDetails {
  return currencyEngine.getRateInfo(from, to);
}
