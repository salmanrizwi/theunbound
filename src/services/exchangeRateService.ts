import { CurrencyCode } from '../types';

export interface ExchangeRateData {
  base: string;
  rates: Record<CurrencyCode, number>;
  lastUpdated: string;
  isLive: boolean;
  provider: string;
}

// Fallback baseline rates relative to 1 USD
export const DEFAULT_EXCHANGE_RATES: Record<CurrencyCode, number> = {
  USD: 1.0,
  EUR: 0.92,
  GBP: 0.79,
  JPY: 154.5,
  AED: 3.67,
  THB: 36.5,
  AUD: 1.54,
  CAD: 1.38,
  SGD: 1.35,
  INR: 83.45,
  CHF: 0.90
};

const STORAGE_KEY_RATES = 'theunbound_fx_rates_cache';

export class ExchangeRateService {
  private static instance: ExchangeRateService;
  private currentRates: Record<CurrencyCode, number> = { ...DEFAULT_EXCHANGE_RATES };
  private lastUpdated: string = new Date().toISOString();
  private isLive: boolean = false;
  private listeners: Set<(data: ExchangeRateData) => void> = new Set();
  private isFetching: boolean = false;

  private constructor() {
    this.loadCachedRates();
    this.fetchLiveRates();
  }

  public static getInstance(): ExchangeRateService {
    if (!ExchangeRateService.instance) {
      ExchangeRateService.instance = new ExchangeRateService();
    }
    return ExchangeRateService.instance;
  }

  private loadCachedRates() {
    try {
      if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
        const cached = window.localStorage.getItem(STORAGE_KEY_RATES);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed.rates && parsed.lastUpdated) {
            this.currentRates = { ...DEFAULT_EXCHANGE_RATES, ...parsed.rates };
            this.lastUpdated = parsed.lastUpdated;
            this.isLive = true;
          }
        }
      }
    } catch (e) {
      console.debug('Error loading cached exchange rates:', e);
    }
  }

  public subscribe(callback: (data: ExchangeRateData) => void): () => void {
    this.listeners.add(callback);
    // Emit immediate current state
    callback(this.getData());
    return () => this.listeners.delete(callback);
  }

  private notify() {
    const data = this.getData();
    this.listeners.forEach(cb => cb(data));
  }

  public getData(): ExchangeRateData {
    return {
      base: 'USD',
      rates: { ...this.currentRates },
      lastUpdated: this.lastUpdated,
      isLive: this.isLive,
      provider: 'ExchangeRate Real-Time FX Market Feed'
    };
  }

  public getRate(currency: CurrencyCode): number {
    return this.currentRates[currency] || DEFAULT_EXCHANGE_RATES[currency] || 1.0;
  }

  public convert(amount: number, from: CurrencyCode, to: CurrencyCode): number {
    if (from === to) return amount;
    const fromRate = this.getRate(from);
    const toRate = this.getRate(to);
    const amountInUSD = amount / fromRate;
    return amountInUSD * toRate;
  }

  public async fetchLiveRates(): Promise<boolean> {
    if (this.isFetching) return false;
    this.isFetching = true;

    try {
      // Primary Live Endpoint (Open Exchange Rates / ER-API)
      const res = await fetch('https://open.er-api.com/v6/latest/USD');
      if (res.ok) {
        const data = await res.json();
        if (data && data.rates) {
          const newRates: Record<CurrencyCode, number> = { ...DEFAULT_EXCHANGE_RATES };
          const keys: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'AUD', 'CAD', 'SGD', 'INR', 'CHF'];
          
          keys.forEach(k => {
            if (typeof data.rates[k] === 'number') {
              newRates[k] = data.rates[k];
            }
          });

          this.currentRates = newRates;
          this.lastUpdated = new Date().toISOString();
          this.isLive = true;

          if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify({
              rates: this.currentRates,
              lastUpdated: this.lastUpdated
            }));
          }

          this.notify();
          this.isFetching = false;
          return true;
        }
      }
    } catch (err) {
      console.debug('Primary FX API note, trying fallback:', err);
    }

    try {
      // Secondary Fallback Endpoint
      const resFallback = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      if (resFallback.ok) {
        const data = await resFallback.json();
        if (data && data.rates) {
          const newRates: Record<CurrencyCode, number> = { ...DEFAULT_EXCHANGE_RATES };
          const keys: CurrencyCode[] = ['USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'AUD', 'CAD', 'SGD', 'INR', 'CHF'];
          
          keys.forEach(k => {
            if (typeof data.rates[k] === 'number') {
              newRates[k] = data.rates[k];
            }
          });

          this.currentRates = newRates;
          this.lastUpdated = new Date().toISOString();
          this.isLive = true;

          if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
            window.localStorage.setItem(STORAGE_KEY_RATES, JSON.stringify({
              rates: this.currentRates,
              lastUpdated: this.lastUpdated
            }));
          }

          this.notify();
          this.isFetching = false;
          return true;
        }
      }
    } catch (fallbackErr) {
      console.debug('FX Fallback note:', fallbackErr);
    }

    this.isFetching = false;
    return false;
  }
}
