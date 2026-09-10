import { CurrencyCode } from '../types';
import { currencyEngine, CurrencyEngine, BASELINE_USD_RATES } from './currencyEngine';

export interface ExchangeRateData {
  base: string;
  rates: Record<CurrencyCode, number>;
  lastUpdated: string;
  isLive: boolean;
  provider: string;
}

export const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  ...BASELINE_USD_RATES
};

/**
 * ExchangeRateService compatibility layer
 * Delegates all conversion and rate calculations directly to the centralized CurrencyEngine
 */
export class ExchangeRateService {
  private static instance: ExchangeRateService;

  private constructor() {
    // CurrencyEngine handles lifecycle
  }

  public static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  public subscribe(callback: (data: ExchangeRateData) => void): () => void {
    return currencyEngine.subscribe(() => {
      callback(this.getData());
    });
  }

  public getData(): ExchangeRateData {
    const status = currencyEngine.getStatus();
    const pairs = currencyEngine.getAllPairs();
    const rates: Record<CurrencyCode, number> = { ...BASELINE_USD_RATES };

    // Populate USD cross rates
    pairs.forEach(p => {
      if (p.fromCurrency === 'USD') {
        rates[p.toCurrency] = p.effectiveRate;
      }
    });

    return {
      base: 'USD',
      rates,
      lastUpdated: status.lastFetchedAt,
      isLive: status.isLive,
      provider: status.provider
    };
  }

  public getRate(currency: CurrencyCode): number {
    return currencyEngine.convert(1, 'USD', currency);
  }

  public convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
    return currencyEngine.convert(amount, from, to);
  }

  public async fetchLiveRates(): Promise<boolean> {
    return currencyEngine.fetchLiveRates(true);
  }
}
