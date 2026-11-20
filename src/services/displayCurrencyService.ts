import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { CurrencyCode, SUPPORTED_CURRENCIES, User } from '../types';
import { CurrencyEngine } from './currencyEngine';
import { db as firestoreDb, auth as firebaseAuth } from './firebase';
import { pricingCache } from './pricingCache';

export const GLOBAL_DISPLAY_CURRENCY_STORAGE_KEY = 'theunbound_global_display_currency_v1';
export const GLOBAL_DISPLAY_CURRENCY_COLLECTION = 'systemSettings';
export const GLOBAL_DISPLAY_CURRENCY_DOC_ID = 'globalDisplayCurrency';

const VALID_CURRENCY_CODES = new Set<string>(SUPPORTED_CURRENCIES.map(c => c.code));

export const MASTER_ADMIN_EMAILS = [
  'business@theunbound.in',
  'admin@theunbound.com',
  'marcus@theunbound.in'
];

export interface GlobalDisplayCurrencyConfig {
  displayCurrency: CurrencyCode;
  updatedAt: string;
  updatedBy: string;
  updatedByName?: string;
  updatedByEmail?: string;
  updatedByRole?: 'ADMIN' | 'SUPER_ADMIN';
  fxSource?: string;
}

export type DisplayConversionStatus = 'OK' | 'IDENTITY' | 'UNAVAILABLE' | 'INVALID_AMOUNT';

export interface DisplayConversionResult {
  status: DisplayConversionStatus;
  originalAmount: number;
  sourceCurrency: CurrencyCode | string;
  targetCurrency: CurrencyCode;
  convertedAmount: number | null;
  exchangeRate: number | null;
  rateTimestamp?: string;
  fxSource?: string;
  formatted: string;
  nativeFormatted: string;
  isConverted: boolean;
  error?: string;
}

export interface AggregatedDisplayAmount {
  totalConverted: number;
  convertedCount: number;
  unavailableCount: number;
  hasUnavailableRates: boolean;
  unavailableCurrencies: string[];
  currency: CurrencyCode;
  formattedTotal: string;
}

export function isSupportedDisplayCurrency(code: any): code is CurrencyCode {
  return typeof code === 'string' && VALID_CURRENCY_CODES.has(code.trim().toUpperCase());
}

export function canUserEditDisplayCurrency(user: User | null | undefined): boolean {
  if (!user) return false;
  const role = String(user.role || '').toUpperCase();
  if (role === 'ADMIN' || role === 'SUPER_ADMIN') return true;
  const email = String(user.email || '').trim().toLowerCase();
  return Boolean(email && MASTER_ADMIN_EMAILS.includes(email));
}

export function getCurrencyPrecision(currency: CurrencyCode | string): number {
  const code = String(currency || 'USD').trim().toUpperCase();
  return code === 'JPY' || code === 'THB' ? 0 : 2;
}

export function roundAmountForCurrency(amount: number, currency: CurrencyCode | string): number {
  if (!Number.isFinite(amount)) return 0;
  const decimals = getCurrencyPrecision(currency);
  return decimals === 0 ? Math.round(amount) : Number(amount.toFixed(decimals));
}

export function formatDisplayMoney(
  amount: number | null | undefined,
  currency: CurrencyCode | string,
  options?: { showCode?: boolean; decimals?: number }
): string {
  if (amount === null || amount === undefined || !Number.isFinite(Number(amount))) {
    return 'FX Unavailable';
  }
  return CurrencyEngine.getInstance().format(Number(amount), currency, options);
}

class DisplayCurrencyService {
  private static instance: DisplayCurrencyService;

  private config: GlobalDisplayCurrencyConfig = {
    displayCurrency: 'USD',
    updatedAt: new Date(0).toISOString(),
    updatedBy: 'system',
    updatedByName: 'TheUnbound FX Engine',
    fxSource: 'Google Sheets =GOOGLEFINANCE() Official Feed'
  };

  private listeners: Set<() => void> = new Set();
  private fxVersion = 1;
  private conversionCache: Map<string, DisplayConversionResult> = new Map();
  private firestoreUnsubscribe: (() => void) | null = null;
  private fxUnsubscribe: (() => void) | null = null;
  private isHydratedFromFirestore = false;
  private isSyncStarted = false;

  private constructor() {
    this.hydrateFromStorage();
    this.bindFxEngine();
  }

  public static getInstance(): DisplayCurrencyService {
    if (!DisplayCurrencyService.instance) {
      DisplayCurrencyService.instance = new DisplayCurrencyService();
    }
    return DisplayCurrencyService.instance;
  }

  private bindFxEngine(): void {
    if (this.fxUnsubscribe) return;
    const fx = CurrencyEngine.getInstance();
    this.fxUnsubscribe = fx.subscribe(() => {
      this.invalidateConversionCache();
      this.notifyListeners();
    });
  }

  private hydrateFromStorage(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(GLOBAL_DISPLAY_CURRENCY_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<GlobalDisplayCurrencyConfig>;
        if (parsed && isSupportedDisplayCurrency(parsed.displayCurrency)) {
          this.config = {
            ...this.config,
            ...parsed,
            displayCurrency: parsed.displayCurrency.toUpperCase() as CurrencyCode
          };
          CurrencyEngine.getInstance().updateSettings({
            baseCurrency: this.config.displayCurrency
          }, null);
          return;
        }
      }
      // Fallback to existing CurrencyEngine baseCurrency if present
      const existingBase = CurrencyEngine.getInstance().getSettings()?.baseCurrency;
      if (isSupportedDisplayCurrency(existingBase)) {
        this.config.displayCurrency = existingBase;
      }
    } catch (err) {
      console.warn('[DisplayCurrencyService] Failed to hydrate from localStorage:', err);
    }
  }

  private persistToStorage(cfg: GlobalDisplayCurrencyConfig): void {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(GLOBAL_DISPLAY_CURRENCY_STORAGE_KEY, JSON.stringify(cfg));
      window.localStorage.setItem('theunbound_selected_currency', cfg.displayCurrency);
    } catch (err) {
      console.warn('[DisplayCurrencyService] Failed to write localStorage:', err);
    }
  }

  public initRealtimeSync(): () => void {
    if (typeof window === 'undefined') return () => {};
    if (this.isSyncStarted && this.firestoreUnsubscribe) {
      return this.firestoreUnsubscribe;
    }

    this.isSyncStarted = true;
    try {
      const ref = doc(firestoreDb, GLOBAL_DISPLAY_CURRENCY_COLLECTION, GLOBAL_DISPLAY_CURRENCY_DOC_ID);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          this.isHydratedFromFirestore = true;
          if (!snap.exists()) return;
          const data = snap.data() as Partial<GlobalDisplayCurrencyConfig> | undefined;
          if (!data || !isSupportedDisplayCurrency(data.displayCurrency)) return;

          const nextCurrency = data.displayCurrency.toUpperCase() as CurrencyCode;
          const changed = nextCurrency !== this.config.displayCurrency;
          this.config = {
            displayCurrency: nextCurrency,
            updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : new Date().toISOString(),
            updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : 'admin',
            updatedByName: typeof data.updatedByName === 'string' ? data.updatedByName : undefined,
            updatedByEmail: typeof data.updatedByEmail === 'string' ? data.updatedByEmail : undefined,
            updatedByRole: data.updatedByRole === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN',
            fxSource: typeof data.fxSource === 'string' ? data.fxSource : this.config.fxSource
          };
          this.persistToStorage(this.config);
          CurrencyEngine.getInstance().updateSettings({ baseCurrency: nextCurrency }, null);
          if (changed) {
            this.invalidateConversionCache();
          }
          this.notifyListeners();
        },
        (err) => {
          this.isHydratedFromFirestore = true;
          console.debug('[DisplayCurrencyService] Firestore snapshot listener notice:', err?.code || err?.message);
        }
      );

      this.firestoreUnsubscribe = () => {
        unsub();
        this.firestoreUnsubscribe = null;
        this.isSyncStarted = false;
      };
      return this.firestoreUnsubscribe;
    } catch (err) {
      this.isHydratedFromFirestore = true;
      this.isSyncStarted = false;
      console.debug('[DisplayCurrencyService] Firestore listener init skipped:', err);
      return () => {};
    }
  }

  public async refreshFromFirestore(): Promise<GlobalDisplayCurrencyConfig> {
    if (typeof window === 'undefined') return this.getConfig();
    try {
      const ref = doc(firestoreDb, GLOBAL_DISPLAY_CURRENCY_COLLECTION, GLOBAL_DISPLAY_CURRENCY_DOC_ID);
      const snap = await getDoc(ref);
      this.isHydratedFromFirestore = true;
      if (snap.exists()) {
        const data = snap.data() as Partial<GlobalDisplayCurrencyConfig>;
        if (data && isSupportedDisplayCurrency(data.displayCurrency)) {
          const nextCurrency = data.displayCurrency.toUpperCase() as CurrencyCode;
          this.config = {
            ...this.config,
            ...data,
            displayCurrency: nextCurrency
          };
          this.persistToStorage(this.config);
          CurrencyEngine.getInstance().updateSettings({ baseCurrency: nextCurrency }, null);
          this.invalidateConversionCache();
          this.notifyListeners();
        }
      }
    } catch (err) {
      console.debug('[DisplayCurrencyService] refreshFromFirestore error:', err);
    }
    return this.getConfig();
  }

  public getDisplayCurrency(): CurrencyCode {
    return this.config.displayCurrency;
  }

  public getConfig(): GlobalDisplayCurrencyConfig {
    return { ...this.config };
  }

  public getFxVersion(): number {
    return this.fxVersion;
  }

  public isFirestoreHydrated(): boolean {
    return this.isHydratedFromFirestore;
  }

  public invalidateConversionCache(): void {
    this.fxVersion += 1;
    if (this.conversionCache.size > 0) {
      this.conversionCache.clear();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notifyListeners(): void {
    this.listeners.forEach((cb) => {
      try {
        cb();
      } catch (err) {
        console.error('[DisplayCurrencyService] Listener callback error:', err);
      }
    });
  }

  /**
   * Updates the portal-wide Global Display Currency.
   * Strictly restricted to authorised Admin / Super Admin users.
   */
  public async setGlobalDisplayCurrency(
    nextCurrencyRaw: CurrencyCode | string,
    actor: User | null | undefined,
    options?: {
      auditLogger?: (
        previousCurrency: CurrencyCode,
        newCurrency: CurrencyCode,
        actor: User | null | undefined
      ) => void;
    }
  ): Promise<{
    success: boolean;
    displayCurrency: CurrencyCode;
    previousCurrency: CurrencyCode;
    unchanged?: boolean;
    error?: string;
  }> {
    const previousCurrency = this.config.displayCurrency;

    if (!canUserEditDisplayCurrency(actor)) {
      return {
        success: false,
        displayCurrency: previousCurrency,
        previousCurrency,
        error: 'Permission denied: Only authorised Administrators can modify the Global Display Currency.'
      };
    }

    const fx = CurrencyEngine.getInstance();
    const resolved = fx.resolveIsoCurrencyCode(nextCurrencyRaw);
    if (!resolved.isSupported || !resolved.code) {
      return {
        success: false,
        displayCurrency: previousCurrency,
        previousCurrency,
        error: `Unsupported display currency "${String(nextCurrencyRaw)}".`
      };
    }

    const nextCurrency = resolved.code;
    if (nextCurrency === previousCurrency) {
      return {
        success: true,
        displayCurrency: nextCurrency,
        previousCurrency,
        unchanged: true
      };
    }

    const now = new Date().toISOString();
    const actorEmail = actor?.email || firebaseAuth.currentUser?.email || 'business@theunbound.in';
    const actorRole: 'ADMIN' | 'SUPER_ADMIN' =
      String(actor?.role || '').toUpperCase() === 'SUPER_ADMIN' ? 'SUPER_ADMIN' : 'ADMIN';

    const nextConfig: GlobalDisplayCurrencyConfig = {
      displayCurrency: nextCurrency,
      updatedAt: now,
      updatedBy: actor?.id || firebaseAuth.currentUser?.uid || 'usr-admin-business',
      updatedByName: actor?.name || 'Administrator',
      updatedByEmail: actorEmail,
      updatedByRole: actorRole,
      fxSource: fx.getStatus().provider || 'Google Sheets =GOOGLEFINANCE() Official Feed'
    };

    // Persist to Firestore when running in browser with an authenticated Firebase session
    if (typeof window !== 'undefined' && firebaseAuth.currentUser) {
      try {
        const ref = doc(firestoreDb, GLOBAL_DISPLAY_CURRENCY_COLLECTION, GLOBAL_DISPLAY_CURRENCY_DOC_ID);
        await setDoc(ref, nextConfig, { merge: true });
      } catch (err: any) {
        const errMsg = err?.message || 'Failed to persist Global Display Currency to Firestore.';
        return {
          success: false,
          displayCurrency: previousCurrency,
          previousCurrency,
          error: errMsg
        };
      }
    }

    // Apply in-memory + localStorage + FX engine baseCurrency
    this.config = nextConfig;
    this.persistToStorage(nextConfig);
    fx.updateSettings({ baseCurrency: nextCurrency }, actor || null);
    pricingCache.bumpFxCatalogVersion();
    this.invalidateConversionCache();

    if (options?.auditLogger) {
      try {
        options.auditLogger(previousCurrency, nextCurrency, actor);
      } catch (auditErr) {
        console.warn('[DisplayCurrencyService] Audit log callback warning:', auditErr);
      }
    }

    this.notifyListeners();

    return {
      success: true,
      displayCurrency: nextCurrency,
      previousCurrency
    };
  }

  /**
   * Authoritative Conversion from a record's NATIVE/SOURCE currency into the target Display Currency.
   * - Never mutates source data.
   * - Never cascades / double-converts.
   * - Never falls back to exchange rate = 1 on missing/paused/unsupported FX rates.
   */
  public convertForDisplay(
    rawAmount: number | null | undefined,
    sourceCurrencyRaw: any,
    targetCurrencyOverride?: CurrencyCode | string,
    options?: {
      showCode?: boolean;
      decimals?: number;
      skipCache?: boolean;
    }
  ): DisplayConversionResult {
    const fx = CurrencyEngine.getInstance();
    const targetCurrency = isSupportedDisplayCurrency(targetCurrencyOverride)
      ? (targetCurrencyOverride.toUpperCase() as CurrencyCode)
      : this.config.displayCurrency;

    const sourceResolved = fx.resolveIsoCurrencyCode(sourceCurrencyRaw);
    const sourceLabel = sourceResolved.code || sourceResolved.rawCode || 'UNKNOWN';
    const numericAmount = typeof rawAmount === 'number' ? rawAmount : Number(rawAmount);

    if (rawAmount === null || rawAmount === undefined || !Number.isFinite(numericAmount)) {
      return {
        status: 'INVALID_AMOUNT',
        originalAmount: 0,
        sourceCurrency: sourceLabel,
        targetCurrency,
        convertedAmount: null,
        exchangeRate: null,
        formatted: '—',
        nativeFormatted: '—',
        isConverted: false,
        error: 'Invalid or missing numeric amount.'
      };
    }

    const nativeFormatted = sourceResolved.isSupported && sourceResolved.code
      ? fx.format(numericAmount, sourceResolved.code, options)
      : `${sourceLabel} ${numericAmount.toLocaleString()}`;

    const cacheKey = `${numericAmount}|${sourceLabel}|${targetCurrency}|${this.fxVersion}|${pricingCache.getFxCatalogVersion()}|${options?.showCode ? '1' : '0'}|${options?.decimals ?? 'auto'}`;
    if (!options?.skipCache) {
      const cached = this.conversionCache.get(cacheKey);
      if (cached) return cached;
    }

    if (!sourceResolved.isSupported || !sourceResolved.code) {
      const unavailableResult: DisplayConversionResult = {
        status: 'UNAVAILABLE',
        originalAmount: numericAmount,
        sourceCurrency: sourceLabel,
        targetCurrency,
        convertedAmount: null,
        exchangeRate: null,
        formatted: 'FX Unavailable',
        nativeFormatted,
        isConverted: true,
        error: `Unsupported or missing source currency "${sourceLabel}".`
      };
      return unavailableResult;
    }

    const sourceCode = sourceResolved.code;

    // Identity: same source & display currency -> zero conversion distortion
    if (sourceCode === targetCurrency) {
      const rounded = options?.decimals !== undefined
        ? Number(numericAmount.toFixed(options.decimals))
        : roundAmountForCurrency(numericAmount, targetCurrency);
      const identityResult: DisplayConversionResult = {
        status: 'IDENTITY',
        originalAmount: numericAmount,
        sourceCurrency: sourceCode,
        targetCurrency,
        convertedAmount: rounded,
        exchangeRate: 1,
        rateTimestamp: fx.getStatus().lastFetchedAt,
        fxSource: 'Identity (Same Currency)',
        formatted: fx.format(rounded, targetCurrency, options),
        nativeFormatted,
        isConverted: false
      };
      this.cacheResult(cacheKey, identityResult);
      return identityResult;
    }

    const meta = fx.convertWithMetadata(numericAmount, sourceCode, targetCurrency);
    if (!meta.isValid || !Number.isFinite(meta.convertedAmount) || meta.exchangeRate <= 0) {
      const unavailableResult: DisplayConversionResult = {
        status: 'UNAVAILABLE',
        originalAmount: numericAmount,
        sourceCurrency: sourceCode,
        targetCurrency,
        convertedAmount: null,
        exchangeRate: null,
        rateTimestamp: meta.conversionTimestamp,
        fxSource: meta.fxSource,
        formatted: 'FX Unavailable',
        nativeFormatted,
        isConverted: true,
        error: meta.error || `Exchange rate unavailable for ${sourceCode} -> ${targetCurrency}.`
      };
      return unavailableResult;
    }

    const roundedConverted = options?.decimals !== undefined
      ? Number(meta.convertedAmount.toFixed(options.decimals))
      : roundAmountForCurrency(meta.convertedAmount, targetCurrency);

    const okResult: DisplayConversionResult = {
      status: 'OK',
      originalAmount: numericAmount,
      sourceCurrency: sourceCode,
      targetCurrency,
      convertedAmount: roundedConverted,
      exchangeRate: meta.exchangeRate,
      rateTimestamp: meta.conversionTimestamp,
      fxSource: meta.fxSource,
      formatted: fx.format(roundedConverted, targetCurrency, options),
      nativeFormatted,
      isConverted: true
    };
    this.cacheResult(cacheKey, okResult);
    return okResult;
  }

  private cacheResult(key: string, value: DisplayConversionResult): void {
    if (this.conversionCache.size >= 4000) {
      // Prevent unbounded growth while preserving hot entries
      const firstKey = this.conversionCache.keys().next().value;
      if (firstKey !== undefined) {
        this.conversionCache.delete(firstKey);
      }
    }
    this.conversionCache.set(key, value);
  }

  /**
   * Converts every individual record from its own native currency into `targetCurrency` BEFORE summing.
   * Never mixes raw amounts across currencies, and never defaults missing FX rates to 1.
   */
  public aggregateForDisplay<T = any>(
    records: T[],
    extractor: (item: NoInfer<T>) => { amount: number | null | undefined; currency: any },
    targetCurrencyOverride?: CurrencyCode | string
  ): AggregatedDisplayAmount {
    const targetCurrency = isSupportedDisplayCurrency(targetCurrencyOverride)
      ? (targetCurrencyOverride.toUpperCase() as CurrencyCode)
      : this.config.displayCurrency;

    let rawSum = 0;
    let convertedCount = 0;
    let unavailableCount = 0;
    const unavailableSet = new Set<string>();

    for (const item of records) {
      const { amount, currency } = extractor(item);
      const numeric = typeof amount === 'number' ? amount : Number(amount);
      if (amount === null || amount === undefined || !Number.isFinite(numeric)) continue;

      const fx = CurrencyEngine.getInstance();
      const sourceRes = fx.resolveIsoCurrencyCode(currency);
      if (!sourceRes.isSupported || !sourceRes.code) {
        unavailableCount += 1;
        unavailableSet.add(sourceRes.rawCode || 'UNKNOWN');
        continue;
      }

      if (sourceRes.code === targetCurrency) {
        rawSum += numeric;
        convertedCount += 1;
        continue;
      }

      const meta = fx.convertWithMetadata(numeric, sourceRes.code, targetCurrency);
      if (!meta.isValid || !Number.isFinite(meta.convertedAmount) || meta.exchangeRate <= 0) {
        unavailableCount += 1;
        unavailableSet.add(`${sourceRes.code}->${targetCurrency}`);
        continue;
      }

      rawSum += meta.convertedAmount;
      convertedCount += 1;
    }

    const totalConverted = roundAmountForCurrency(rawSum, targetCurrency);
    const formattedTotal = (unavailableCount > 0 && convertedCount === 0)
      ? 'FX Unavailable'
      : formatDisplayMoney(totalConverted, targetCurrency);

    return {
      totalConverted,
      convertedCount,
      unavailableCount,
      hasUnavailableRates: unavailableCount > 0,
      unavailableCurrencies: Array.from(unavailableSet),
      currency: targetCurrency,
      formattedTotal
    };
  }
}

export const displayCurrencyService = DisplayCurrencyService.getInstance();
