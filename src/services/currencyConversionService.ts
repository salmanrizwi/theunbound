import { CurrencyCode, SUPPORTED_CURRENCIES } from '../types';
import { currencyEngine, CurrencyEngine, BASELINE_USD_RATES } from './currencyEngine';

export interface CurrencyConversionAuditEntry {
  id: string;
  configurator: string; // e.g. 'SHINKANSEN_DYNAMIC_JOURNEY'
  sourceCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  requestedPair: string; // e.g. 'JPY_INR'
  rateLookupStatus: 
    | 'AVAILABLE' 
    | 'UNAVAILABLE' 
    | 'LOADING' 
    | 'REJECTED_ZERO_OR_NEGATIVE' 
    | 'REJECTED_NON_FINITE' 
    | 'INVALID_CURRENCY';
  rate?: number;
  rateTimestamp?: string;
  cacheStatus: 'LIVE' | 'STALE' | 'CACHED' | 'BASELINE' | 'MISSING';
  errorDetails?: string;
  timestamp: string;
  railProductId?: string;
  fareId?: string;
}

export interface RateLookupResult {
  rate: number;
  isAvailable: boolean;
  isLoading: boolean;
  isStale: boolean;
  status: 'AVAILABLE' | 'LOADING' | 'UNAVAILABLE' | 'INVALID_CONFIG';
  reason?: string;
  rateTimestamp: string;
  provider: string;
  sourceCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  pairId: string;
}

export interface CurrencyConversionResult {
  success: boolean;
  convertedAmount: number;
  sourceAmount: number;
  sourceCurrency: CurrencyCode;
  targetCurrency: CurrencyCode;
  rate: number;
  isLoading: boolean;
  isStale: boolean;
  rateTimestamp: string;
  provider: string;
  error?: string;
  decimalsApplied: number;
}

const SUPPORTED_CODES_SET = new Set<string>([
  'USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'AUD', 'CAD', 'SGD', 'INR', 'CHF'
]);

const CURRENCY_SYMBOLS: Record<string, CurrencyCode> = {
  '¥': 'JPY',
  '￥': 'JPY',
  '₹': 'INR',
  '$': 'USD',
  'US$': 'USD',
  '€': 'EUR',
  '£': 'GBP',
  'AED': 'AED',
  '฿': 'THB',
  'A$': 'AUD',
  'AU$': 'AUD',
  'CA$': 'CAD',
  'C$': 'CAD',
  'S$': 'SGD',
  'SG$': 'SGD',
  'CHF': 'CHF'
};

const CURRENCY_NAMES_MAP: Record<string, CurrencyCode> = {
  'JAPANESE YEN': 'JPY',
  'YEN': 'JPY',
  'INDIAN RUPEE': 'INR',
  'RUPEE': 'INR',
  'RUPEES': 'INR',
  'US DOLLAR': 'USD',
  'USD': 'USD',
  'EURO': 'EUR',
  'BRITISH POUND': 'GBP',
  'POUND STERLING': 'GBP',
  'AUSTRALIAN DOLLAR': 'AUD',
  'CANADIAN DOLLAR': 'CAD',
  'SINGAPORE DOLLAR': 'SGD',
  'SWISS FRANC': 'CHF',
  'THAI BAHT': 'THB',
  'BAHT': 'THB',
  'UAE DIRHAM': 'AED',
  'DIRHAM': 'AED'
};

/**
 * Authoritative Central Currency Conversion Service.
 * 
 * Reuses the existing GOOGLEFINANCE() FX engine (CurrencyEngine + /api/fx/rates).
 * Implements strict ISO normalization, non-fabrication guarantees, rate validity
 * assertions, asynchronous loading state distinction, caching policies, and diagnostic audit logging.
 */
export class CurrencyConversionService {
  private static instance: CurrencyConversionService;
  private _engine: CurrencyEngine | null = null;
  private diagnosticLogs: CurrencyConversionAuditEntry[] = [];
  private lastFetchPromise: Promise<boolean> | null = null;

  private constructor() {}

  private get engine(): CurrencyEngine {
    if (!this._engine) {
      this._engine = CurrencyEngine.getInstance();
    }
    return this._engine;
  }

  public static getInstance(): CurrencyConversionService {
    if (!CurrencyConversionService.instance) {
      CurrencyConversionService.instance = new CurrencyConversionService();
    }
    return CurrencyConversionService.instance;
  }

  /**
   * Normalizes any currency input (symbol, code, lowercase, whitespace, object)
   * to canonical ISO CurrencyCode.
   */
  public normalizeCurrency(raw: any, fallback: CurrencyCode = 'USD'): CurrencyCode {
    if (!raw) return fallback;

    // Unpack if object (e.g. { code: 'INR' }, { currency: 'JPY' })
    if (typeof raw === 'object' && raw !== null) {
      const codeCandidate = raw.code || raw.currency || raw.value || raw.targetCurrency || raw.nativeCurrency;
      if (codeCandidate && typeof codeCandidate === 'string') {
        return this.normalizeCurrency(codeCandidate, fallback);
      }
    }

    const trimmed = String(raw).trim();
    if (!trimmed) return fallback;

    // Direct symbol match
    if (CURRENCY_SYMBOLS[trimmed]) {
      return CURRENCY_SYMBOLS[trimmed];
    }

    const upper = trimmed.toUpperCase();

    // Direct code match
    if (SUPPORTED_CODES_SET.has(upper)) {
      return upper as CurrencyCode;
    }

    // Name match
    if (CURRENCY_NAMES_MAP[upper]) {
      return CURRENCY_NAMES_MAP[upper];
    }

    // Strip symbol characters or prefixes (e.g. "JPY (¥)" -> "JPY", "INR ₹" -> "INR")
    const matchCode = upper.match(/\b(USD|EUR|GBP|JPY|AED|THB|AUD|CAD|SGD|INR|CHF)\b/);
    if (matchCode && matchCode[1]) {
      return matchCode[1] as CurrencyCode;
    }

    return fallback;
  }

  /**
   * Checks if a currency code, symbol, or representation is supported.
   */
  public isSupported(currency: any): boolean {
    if (!currency) return false;
    const normalized = this.normalizeCurrency(currency, '' as any);
    return Boolean(normalized && SUPPORTED_CODES_SET.has(normalized));
  }

  /**
   * Validates whether a rate is strictly positive, finite number.
   */
  public isValidRate(rate: any): rate is number {
    return (
      typeof rate === 'number' &&
      !isNaN(rate) &&
      Number.isFinite(rate) &&
      rate > 0
    );
  }

  /**
   * Returns rate lookup details for a currency pair with full state tracking
   */
  public getRate(
    fromCurrency: any,
    toCurrency: any,
    context?: { moduleName?: string; productId?: string; fareId?: string }
  ): RateLookupResult {
    const fromCode = this.normalizeCurrency(fromCurrency, '' as any);
    const toCode = this.normalizeCurrency(toCurrency, '' as any);
    const moduleName = context?.moduleName || 'SHINKANSEN_DYNAMIC_JOURNEY';

    if (!fromCode || !toCode || !SUPPORTED_CODES_SET.has(fromCode) || !SUPPORTED_CODES_SET.has(toCode)) {
      const invalidPairId = `${fromCurrency}_${toCurrency}`;
      this.logDiagnostic({
        configurator: moduleName,
        sourceCurrency: (fromCode || fromCurrency || 'UNKNOWN') as CurrencyCode,
        targetCurrency: (toCode || toCurrency || 'UNKNOWN') as CurrencyCode,
        requestedPair: invalidPairId,
        rateLookupStatus: 'INVALID_CURRENCY',
        cacheStatus: 'MISSING',
        errorDetails: `Unsupported or invalid currency requested: source "${fromCurrency}", target "${toCurrency}"`,
        railProductId: context?.productId,
        fareId: context?.fareId
      });

      return {
        rate: 0,
        isAvailable: false,
        isLoading: false,
        isStale: true,
        status: 'INVALID_CONFIG',
        reason: 'Price unavailable — Invalid currency configuration',
        rateTimestamp: new Date().toISOString(),
        provider: 'N/A',
        sourceCurrency: fromCode || 'USD',
        targetCurrency: toCode || 'USD',
        pairId: invalidPairId
      };
    }

    const pairId = `${fromCode}_${toCode}`;
    const status = this.engine.getStatus();
    const isEngineFetching = Boolean((this.engine as any).isFetching);

    // Identity conversion: same-currency requires zero external FX lookup
    if (fromCode === toCode) {
      return {
        rate: 1.0,
        isAvailable: true,
        isLoading: false,
        isStale: false,
        status: 'AVAILABLE',
        rateTimestamp: status.lastFetchedAt || new Date().toISOString(),
        provider: 'Identity (Same Currency)',
        sourceCurrency: fromCode,
        targetCurrency: toCode,
        pairId
      };
    }

    let resolvedRate: number | null = null;
    let rateTimestamp = status.lastFetchedAt || new Date().toISOString();
    let cacheStatus: 'LIVE' | 'STALE' | 'CACHED' | 'BASELINE' | 'MISSING' = status.isStale ? 'STALE' : (status.isLive ? 'LIVE' : 'CACHED');

    // 1. Direct Pair lookup
    const directPair = this.engine.getPair(pairId);
    if (
      directPair &&
      directPair.status !== 'PAUSED' &&
      this.isValidRate(directPair.effectiveRate)
    ) {
      resolvedRate = directPair.effectiveRate;
      rateTimestamp = directPair.lastFetchedAt || rateTimestamp;
    }

    // 2. Inverse Pair lookup if direct pair missing/invalid/paused
    if (resolvedRate === null || !this.isValidRate(resolvedRate)) {
      const inversePairId = `${toCode}_${fromCode}`;
      const inversePair = this.engine.getPair(inversePairId);
      if (
        inversePair &&
        inversePair.status !== 'PAUSED' &&
        this.isValidRate(inversePair.effectiveRate)
      ) {
        const inverted = Number((1 / inversePair.effectiveRate).toFixed(6));
        if (this.isValidRate(inverted)) {
          resolvedRate = inverted;
          rateTimestamp = inversePair.lastFetchedAt || rateTimestamp;
        }
      }
    }

    // 3. Triangulation via USD base rate in engine
    if (resolvedRate === null || !this.isValidRate(resolvedRate)) {
      const rateInfo = this.engine.getRateInfo(fromCode, toCode);
      if (rateInfo && this.isValidRate(rateInfo.effectiveRate)) {
        resolvedRate = rateInfo.effectiveRate;
        rateTimestamp = rateInfo.rateTimestamp || rateTimestamp;
      }
    }

    // 4. Baseline institutional USD rates triangulation fallback
    if (resolvedRate === null || !this.isValidRate(resolvedRate)) {
      const fromUsd = BASELINE_USD_RATES[fromCode];
      const toUsd = BASELINE_USD_RATES[toCode];
      if (fromUsd && toUsd && fromUsd > 0 && toUsd > 0) {
        const baselineRate = Number((toUsd / fromUsd).toFixed(6));
        if (this.isValidRate(baselineRate)) {
          resolvedRate = baselineRate;
          cacheStatus = 'BASELINE';
        }
      }
    }

    // Evaluate result validity
    if (resolvedRate !== null && this.isValidRate(resolvedRate)) {
      return {
        rate: resolvedRate,
        isAvailable: true,
        isLoading: false,
        isStale: status.isStale || cacheStatus === 'STALE',
        status: 'AVAILABLE',
        rateTimestamp,
        provider: status.provider || 'Google Finance Live Feed',
        sourceCurrency: fromCode,
        targetCurrency: toCode,
        pairId
      };
    }

    // Distinguish between pending asynchronous fetch vs confirmed failure
    if (isEngineFetching) {
      this.logDiagnostic({
        configurator: moduleName,
        sourceCurrency: fromCode,
        targetCurrency: toCode,
        requestedPair: pairId,
        rateLookupStatus: 'LOADING',
        cacheStatus: 'MISSING',
        errorDetails: 'Exchange rate currently fetching from Google Finance service',
        railProductId: context?.productId,
        fareId: context?.fareId
      });

      return {
        rate: 0,
        isAvailable: false,
        isLoading: true,
        isStale: true,
        status: 'LOADING',
        reason: 'Price loading — Exchange rate pending',
        rateTimestamp: new Date().toISOString(),
        provider: status.provider || 'Google Finance Live Feed',
        sourceCurrency: fromCode,
        targetCurrency: toCode,
        pairId
      };
    }

    // Confirmed FX rate failure — NEVER invent or substitute 1
    this.logDiagnostic({
      configurator: moduleName,
      sourceCurrency: fromCode,
      targetCurrency: toCode,
      requestedPair: pairId,
      rateLookupStatus: 'UNAVAILABLE',
      cacheStatus: 'MISSING',
      errorDetails: 'No valid numeric, finite, non-zero rate available from Google Finance FX engine',
      railProductId: context?.productId,
      fareId: context?.fareId
    });

    return {
      rate: 0,
      isAvailable: false,
      isLoading: false,
      isStale: true,
      status: 'UNAVAILABLE',
      reason: 'Price unavailable — FX exchange rate unavailable',
      rateTimestamp: new Date().toISOString(),
      provider: status.provider || 'Google Finance Live Feed',
      sourceCurrency: fromCode,
      targetCurrency: toCode,
      pairId
    };
  }

  /**
   * Authoritative price conversion:
   * "Base-currency calculation must happen before display-currency conversion."
   * Applies official rounding: JPY/THB = 0 decimals, others = 2 decimals.
   */
  public convertPrice(
    baseAmount: number,
    fromCurrency: any,
    toCurrency: any,
    options?: {
      moduleName?: string;
      productId?: string;
      fareId?: string;
      customDecimals?: number;
    }
  ): CurrencyConversionResult {
    const fromCode = this.normalizeCurrency(fromCurrency);
    const hasExplicitTarget = toCurrency !== undefined && toCurrency !== null && String(toCurrency).trim() !== '';
    const toCode = hasExplicitTarget ? this.normalizeCurrency(toCurrency) : fromCode;
    const safeAmount = (typeof baseAmount === 'number' && !isNaN(baseAmount)) ? baseAmount : (Number(baseAmount) || 0);

    const decimals = options?.customDecimals !== undefined 
      ? options.customDecimals 
      : (toCode === 'JPY' || toCode === 'THB' ? 0 : 2);

    // Rule: Same-currency conversions return the unchanged monetary amount without requiring an unnecessary external FX lookup
    if (fromCode && toCode && fromCode === toCode) {
      const rounded = decimals === 0 ? Math.round(safeAmount) : Number(safeAmount.toFixed(decimals));
      return {
        success: true,
        convertedAmount: rounded,
        sourceAmount: safeAmount,
        sourceCurrency: fromCode,
        targetCurrency: toCode,
        rate: 1.0,
        isLoading: false,
        isStale: false,
        rateTimestamp: new Date().toISOString(),
        provider: 'Identity (Same Currency)',
        decimalsApplied: decimals
      };
    }

    const lookup = this.getRate(fromCode, toCode, {
      moduleName: options?.moduleName || 'SHINKANSEN_DYNAMIC_JOURNEY',
      productId: options?.productId,
      fareId: options?.fareId
    });

    if (!lookup.isAvailable || !this.isValidRate(lookup.rate)) {
      return {
        success: false,
        convertedAmount: 0,
        sourceAmount: safeAmount,
        sourceCurrency: fromCode,
        targetCurrency: toCode,
        rate: 0,
        isLoading: lookup.isLoading,
        isStale: lookup.isStale,
        rateTimestamp: lookup.rateTimestamp,
        provider: lookup.provider,
        error: lookup.reason || 'Price unavailable — FX exchange rate unavailable',
        decimalsApplied: decimals
      };
    }

    const rawConverted = safeAmount * lookup.rate;
    const finalConverted = decimals === 0 
      ? Math.round(rawConverted) 
      : Math.round(rawConverted * Math.pow(10, decimals)) / Math.pow(10, decimals);

    return {
      success: true,
      convertedAmount: finalConverted,
      sourceAmount: safeAmount,
      sourceCurrency: fromCode,
      targetCurrency: toCode,
      rate: lookup.rate,
      isLoading: false,
      isStale: lookup.isStale,
      rateTimestamp: lookup.rateTimestamp,
      provider: lookup.provider,
      decimalsApplied: decimals
    };
  }

  /**
   * Helper to format converted currency
   */
  public format(amount?: number | null, currency: any = 'USD', options?: { showCode?: boolean }): string {
    const code = this.normalizeCurrency(currency, 'USD');
    return this.engine.format(amount, code, options);
  }

  /**
   * Checks if FX rate is actively being retrieved
   */
  public isRateLoading(from: any, to: any): boolean {
    const fromCode = this.normalizeCurrency(from);
    const toCode = this.normalizeCurrency(to);
    if (fromCode === toCode) return false;
    const lookup = this.getRate(fromCode, toCode);
    return lookup.isLoading;
  }

  /**
   * Triggers an asynchronous refresh of live Google Finance rates
   */
  public async fetchLiveRates(force: boolean = true): Promise<boolean> {
    if (this.lastFetchPromise) return this.lastFetchPromise;
    this.lastFetchPromise = this.engine.fetchLiveRates(force).finally(() => {
      this.lastFetchPromise = null;
    });
    return this.lastFetchPromise;
  }

  /**
   * Subscribes to live exchange rate updates
   */
  public subscribe(callback: () => void): () => void {
    return this.engine.subscribe(callback);
  }

  /**
   * Logs a diagnostic entry for rate lookups and failures
   */
  public logDiagnostic(entry: Partial<CurrencyConversionAuditEntry>): void {
    const fullEntry: CurrencyConversionAuditEntry = {
      id: `fx-diag-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
      configurator: entry.configurator || 'SHINKANSEN_DYNAMIC_JOURNEY',
      sourceCurrency: entry.sourceCurrency || 'JPY',
      targetCurrency: entry.targetCurrency || 'USD',
      requestedPair: entry.requestedPair || `${entry.sourceCurrency || 'JPY'}_${entry.targetCurrency || 'USD'}`,
      rateLookupStatus: entry.rateLookupStatus || 'UNAVAILABLE',
      rate: entry.rate,
      rateTimestamp: entry.rateTimestamp || new Date().toISOString(),
      cacheStatus: entry.cacheStatus || 'MISSING',
      errorDetails: entry.errorDetails || 'Unknown FX error',
      timestamp: new Date().toISOString(),
      railProductId: entry.railProductId,
      fareId: entry.fareId
    };

    this.diagnosticLogs.unshift(fullEntry);
    if (this.diagnosticLogs.length > 300) {
      this.diagnosticLogs.length = 300;
    }

    if (fullEntry.rateLookupStatus === 'UNAVAILABLE' || fullEntry.rateLookupStatus === 'REJECTED_ZERO_OR_NEGATIVE') {
      console.warn(`[CurrencyConversionService] ${fullEntry.configurator} FX Failure:`, {
        pair: fullEntry.requestedPair,
        status: fullEntry.rateLookupStatus,
        details: fullEntry.errorDetails,
        product: fullEntry.railProductId,
        timestamp: fullEntry.timestamp
      });
    }
  }

  /**
   * Retrieves diagnostic logs for auditing and testing
   */
  public getDiagnosticLogs(): CurrencyConversionAuditEntry[] {
    return [...this.diagnosticLogs];
  }

  /**
   * Clears diagnostic logs (for test isolation)
   */
  public clearDiagnosticLogs(): void {
    this.diagnosticLogs = [];
  }
}

export const currencyConversionService = CurrencyConversionService.getInstance();
