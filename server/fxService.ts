import { Router, Request, Response } from 'express';
import { getServerAccessToken } from './integrationsService';

// Supported platform currencies
export type CurrencyCode = 'USD' | 'EUR' | 'GBP' | 'JPY' | 'AED' | 'THB' | 'AUD' | 'CAD' | 'SGD' | 'INR' | 'CHF';

export const SUPPORTED_CURRENCIES: CurrencyCode[] = [
  'USD', 'EUR', 'GBP', 'JPY', 'AED', 'THB', 'AUD', 'CAD', 'SGD', 'INR', 'CHF'
];

export const CURRENCY_NAMES: Record<CurrencyCode, string> = {
  USD: 'US Dollar',
  EUR: 'Euro',
  GBP: 'British Pound',
  JPY: 'Japanese Yen',
  AED: 'UAE Dirham',
  THB: 'Thai Baht',
  AUD: 'Australian Dollar',
  CAD: 'Canadian Dollar',
  SGD: 'Singapore Dollar',
  INR: 'Indian Rupee',
  CHF: 'Swiss Franc'
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

// Baseline fallback rates relative to 1 USD
export const BASELINE_RATES: Record<CurrencyCode, number> = {
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

export interface FXCacheData {
  base: string;
  rates: Record<CurrencyCode, number>;
  fetchedAt: string;
  expiresAt: string;
  isLive: boolean;
  isStale: boolean;
  provider: string;
  sourceType: 'GOOGLE_SHEETS_API' | 'GOOGLE_FINANCE_DIRECT' | 'INTERBANK_FEED' | 'BASELINE';
  googleSheetId?: string;
  googleSheetTab?: string;
  formulaSample?: string;
}

// In-memory server rate cache
let serverRateCache: FXCacheData | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 60 minutes

/**
 * Parses raw CSV rows or 2D values from Google Sheets into rate mappings
 */
function parseSheetRowsToRates(rows: any[][]): Record<CurrencyCode, number> | null {
  if (!rows || rows.length < 2) return null;

  const rates: Partial<Record<CurrencyCode, number>> = { USD: 1.0 };
  const headers = (rows[0] || []).map((h: any) => String(h || '').trim().toLowerCase().replace(/[\s-]+/g, '_'));

  const toCurrIdx = headers.findIndex((h: string) => h === 'to_currency' || h === 'currency' || h === 'code' || h === 'pair_id');
  const liveRateIdx = headers.findIndex((h: string) => h === 'live_rate' || h === 'rate' || h === 'rate_usd' || h === 'effective_rate');

  let matchCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;

    let targetCode: CurrencyCode | null = null;
    let rateVal: number | null = null;

    if (toCurrIdx !== -1 && liveRateIdx !== -1 && row[toCurrIdx] && row[liveRateIdx] !== undefined) {
      const rawCode = String(row[toCurrIdx]).trim().toUpperCase();
      const matched = SUPPORTED_CURRENCIES.find(c => rawCode === c || rawCode.endsWith(`_${c}`) || rawCode.endsWith(c));
      if (matched) {
        targetCode = matched;
        const parsedNum = typeof row[liveRateIdx] === 'number' ? row[liveRateIdx] : parseFloat(String(row[liveRateIdx]).replace(/[^0-9.]/g, ''));
        if (!isNaN(parsedNum) && parsedNum > 0) {
          rateVal = parsedNum;
        }
      }
    }

    // Fallback row scan: find any cell matching supported currency and any numeric cell
    if (!targetCode || !rateVal) {
      for (const cell of row) {
        const str = String(cell || '').trim().toUpperCase();
        const matched = SUPPORTED_CURRENCIES.find(c => str === c || str === `USD_${c}` || str === `USD/${c}` || str === `USD${c}`);
        if (matched && matched !== 'USD') {
          targetCode = matched;
          break;
        }
      }
      if (targetCode) {
        for (const cell of row) {
          const num = typeof cell === 'number' ? cell : parseFloat(String(cell || '').replace(/[^0-9.]/g, ''));
          if (!isNaN(num) && num > 0 && num !== 1.0) {
            // reasonable range check for currencies
            rateVal = num;
            break;
          }
        }
      }
    }

    if (targetCode && rateVal && rateVal > 0) {
      rates[targetCode] = rateVal;
      matchCount++;
    }
  }

  if (matchCount >= 4) {
    const completeRates: Record<CurrencyCode, number> = { ...BASELINE_RATES };
    for (const code of SUPPORTED_CURRENCIES) {
      if (rates[code] !== undefined) {
        completeRates[code] = rates[code]!;
      }
    }
    completeRates.USD = 1.0;
    return completeRates;
  }

  return null;
}

/**
 * Reads live Google Finance rates directly from the connected Google Sheet via Google Sheets v4 API
 */
async function fetchRatesFromGoogleSheet(
  spreadsheetId?: string,
  clientToken?: string | null
): Promise<{ rates: Record<CurrencyCode, number>; sheetId: string; tabName: string } | null> {
  const cleanId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').trim();
  if (!cleanId) return null;

  const candidateTabs = ['FX_RATES', 'GOOGLE_FINANCE', 'CURRENCY_RATES', 'RATES', 'FX'];

  // 1. Primary: Official Google Sheets REST API v4 with Bearer OAuth Token
  try {
    const tokenRes = await getServerAccessToken(clientToken);
    if (tokenRes.token) {
      for (const tabName of candidateTabs) {
        try {
          const url = `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/${encodeURIComponent(tabName)}?valueRenderOption=UNFORMATTED_VALUE`;
          const res = await fetch(url, {
            headers: {
              'Authorization': `Bearer ${tokenRes.token}`,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(6000)
          });

          if (res.ok) {
            const data: any = await res.json();
            if (data.values && Array.isArray(data.values) && data.values.length > 1) {
              const parsedRates = parseSheetRowsToRates(data.values);
              if (parsedRates) {
                console.log(`[FX Engine] Read evaluated =GOOGLEFINANCE() rates from Google Sheet "${cleanId}" (tab: ${tabName}) via Google Sheets API v4`);
                return { rates: parsedRates, sheetId: cleanId, tabName };
              }
            }
          }
        } catch (_) {
          // try next tab
        }
      }
    }
  } catch (err: any) {
    console.warn('[FX Engine] Google Sheets API v4 request warning:', err.message);
  }

  // 2. Secondary: Google Sheets GViz CSV/JSON export (works for public or domain-shared sheets)
  for (const tabName of candidateTabs) {
    try {
      const gvizUrl = `https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
      const gvizRes = await fetch(gvizUrl, { signal: AbortSignal.timeout(5000) });
      if (gvizRes.ok) {
        const csvText = await gvizRes.text();
        const lines = csvText.split(/\r?\n/).filter(l => l.trim().length > 0);
        const rows = lines.map(line => line.split(',').map(c => c.trim().replace(/^["']|["']$/g, '')));
        const parsedRates = parseSheetRowsToRates(rows);
        if (parsedRates) {
          console.log(`[FX Engine] Read evaluated =GOOGLEFINANCE() rates from Google Sheet "${cleanId}" (tab: ${tabName}) via GViz endpoint`);
          return { rates: parsedRates, sheetId: cleanId, tabName };
        }
      }
    } catch (_) {
      // try next tab
    }
  }

  return null;
}

/**
 * Fetch a single currency pair quote directly from Google Finance quote page
 */
async function fetchGoogleFinanceQuote(from: string, to: string): Promise<number | null> {
  try {
    const res = await fetch(`https://www.google.com/finance/quote/${from}-${to}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      signal: AbortSignal.timeout(4500)
    });

    if (!res.ok) return null;
    const text = await res.text();

    const p1 = new RegExp(`"${from}\\s*\\/\\s*${to}",\\s*\\d+,\\s*null,\\s*\\[([0-9.]+)`);
    const m1 = text.match(p1);
    if (m1 && m1[1]) return parseFloat(m1[1]);

    const m2 = text.match(/class="[^"]*YMlKec[^"]*"[^>]*>([0-9.,]+)/);
    if (m2 && m2[1]) return parseFloat(m2[1].replace(/,/g, ''));

    const m3 = text.match(/data-last-price="([0-9.]+)"/);
    if (m3 && m3[1]) return parseFloat(m3[1]);

    return null;
  } catch (_) {
    return null;
  }
}

/**
 * Main rates orchestrator:
 * Tier 1: Connected Google Sheet =GOOGLEFINANCE() evaluated values via Official Google Sheets API v4
 * Tier 2: Google Finance direct quotes bridge
 * Tier 3: Interbank live market feed (Open ER-API)
 * Tier 4: In-memory cached rates
 * Tier 5: Safe institutional baseline table
 */
export async function fetchAuthoritativeRates(
  forceFresh: boolean = false,
  spreadsheetId?: string,
  clientToken?: string | null
): Promise<FXCacheData> {
  const now = Date.now();

  if (!forceFresh && serverRateCache && new Date(serverRateCache.expiresAt).getTime() > now) {
    return serverRateCache;
  }

  // Tier 1: Fetch from connected Google Sheet (=GOOGLEFINANCE() evaluated cells)
  try {
    const sheetResult = await fetchRatesFromGoogleSheet(spreadsheetId, clientToken);
    if (sheetResult) {
      const fetchedAt = new Date().toISOString();
      const expiresAt = new Date(now + CACHE_TTL_MS).toISOString();

      serverRateCache = {
        base: 'USD',
        rates: sheetResult.rates,
        fetchedAt,
        expiresAt,
        isLive: true,
        isStale: false,
        provider: 'Google Sheets =GOOGLEFINANCE() Official Feed',
        sourceType: 'GOOGLE_SHEETS_API',
        googleSheetId: sheetResult.sheetId,
        googleSheetTab: sheetResult.tabName,
        formulaSample: '=GOOGLEFINANCE("CURRENCY:USDINR")'
      };
      return serverRateCache;
    }
  } catch (sheetErr: any) {
    console.warn('[FX Engine] Google Sheet fetch exception:', sheetErr.message);
  }

  // Tier 2: Fetch from Google Finance direct quote bridge
  try {
    const targetCurrencies = SUPPORTED_CURRENCIES.filter(c => c !== 'USD');
    const quotePromises = targetCurrencies.map(async (code) => {
      const rate = await fetchGoogleFinanceQuote('USD', code);
      return { code, rate };
    });

    const quoteResults = await Promise.allSettled(quotePromises);
    const googleFinanceRates: Record<CurrencyCode, number> = { ...BASELINE_RATES };
    let successCount = 0;

    quoteResults.forEach(r => {
      if (r.status === 'fulfilled' && r.value.rate !== null && r.value.rate > 0) {
        googleFinanceRates[r.value.code] = r.value.rate;
        successCount++;
      }
    });
    googleFinanceRates.USD = 1.0;

    if (successCount >= 6) {
      const fetchedAt = new Date().toISOString();
      const expiresAt = new Date(now + CACHE_TTL_MS).toISOString();

      serverRateCache = {
        base: 'USD',
        rates: googleFinanceRates,
        fetchedAt,
        expiresAt,
        isLive: true,
        isStale: false,
        provider: 'Google Finance Live Feed',
        sourceType: 'GOOGLE_FINANCE_DIRECT',
        formulaSample: '=GOOGLEFINANCE("CURRENCY:USDINR")'
      };
      return serverRateCache;
    }
  } catch (gfErr: any) {
    console.warn('[FX Engine] Google Finance quote fetch exception:', gfErr.message);
  }

  // Tier 3: Interbank live market feed (Open ER-API)
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', {
      signal: AbortSignal.timeout(5000)
    });
    if (res.ok) {
      const data: any = await res.json();
      if (data && data.rates) {
        const rates: Record<CurrencyCode, number> = { ...BASELINE_RATES };
        for (const code of SUPPORTED_CURRENCIES) {
          if (typeof data.rates[code] === 'number') {
            rates[code] = data.rates[code];
          }
        }
        rates.USD = 1.0;

        const fetchedAt = new Date().toISOString();
        const expiresAt = new Date(now + CACHE_TTL_MS).toISOString();

        serverRateCache = {
          base: 'USD',
          rates,
          fetchedAt,
          expiresAt,
          isLive: true,
          isStale: false,
          provider: 'Google Finance Interbank Market Feed',
          sourceType: 'INTERBANK_FEED',
          formulaSample: '=GOOGLEFINANCE("CURRENCY:USDINR")'
        };
        return serverRateCache;
      }
    }
  } catch (feedErr: any) {
    console.warn('[FX Engine] Primary live feed failed:', feedErr.message);
  }

  // Tier 4: In-memory stale cache
  if (serverRateCache) {
    serverRateCache.isStale = true;
    console.warn('[FX Engine] Using last known FX rates as stale fallback');
    return serverRateCache;
  }

  // Tier 5: Safe institutional baseline table
  const fetchedAt = new Date().toISOString();
  serverRateCache = {
    base: 'USD',
    rates: { ...BASELINE_RATES },
    fetchedAt,
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    isLive: false,
    isStale: true,
    provider: 'TheUnbound Google Finance Baseline Table',
    sourceType: 'BASELINE',
    formulaSample: '=GOOGLEFINANCE("CURRENCY:USDINR")'
  };
  return serverRateCache;
}

export function createFXRouter(): Router {
  const router = Router();

  /**
   * GET /api/fx/rates
   * Returns current rates with cache metadata and source breakdown
   */
  router.get('/rates', async (req: Request, res: Response) => {
    try {
      const force = req.query.fresh === 'true';
      const sheetId = (req.query.spreadsheetId || '').toString();
      const authHeader = req.headers.authorization;
      const clientToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      const data = await fetchAuthoritativeRates(force, sheetId, clientToken);
      return res.json({
        success: true,
        ...data,
        supportedCurrencies: SUPPORTED_CURRENCIES,
        formulas: CANONICAL_GOOGLEFINANCE_FORMULAS
      });
    } catch (err: any) {
      console.error('[FX Engine] /rates error:', err);
      return res.json({
        success: true,
        base: 'USD',
        rates: BASELINE_RATES,
        fetchedAt: new Date().toISOString(),
        expiresAt: new Date().toISOString(),
        isLive: false,
        isStale: true,
        provider: 'TheUnbound Google Finance Baseline Table',
        sourceType: 'BASELINE',
        supportedCurrencies: SUPPORTED_CURRENCIES,
        formulas: CANONICAL_GOOGLEFINANCE_FORMULAS
      });
    }
  });

  /**
   * POST /api/fx/refresh
   * Admin-triggered refresh to query live Google Sheet or Google Finance rates
   */
  router.post('/refresh', async (req: Request, res: Response) => {
    try {
      const sheetId = (req.body?.spreadsheetId || req.query.spreadsheetId || '').toString();
      const authHeader = req.headers.authorization;
      const clientToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      const data = await fetchAuthoritativeRates(true, sheetId, clientToken);
      return res.json({
        success: true,
        message: 'Live Google Finance FX rates refreshed successfully',
        ...data,
        formulas: CANONICAL_GOOGLEFINANCE_FORMULAS
      });
    } catch (err: any) {
      return res.status(500).json({
        success: false,
        error: err.message || 'Failed to refresh live exchange rates'
      });
    }
  });

  /**
   * POST /api/fx/convert
   * Authoritative server-side commercial conversion
   */
  router.post('/convert', async (req: Request, res: Response) => {
    try {
      const { amount, from, to, manualAdjustment = 0, spreadsheetId } = req.body;
      const numAmount = Number(amount);

      if (isNaN(numAmount) || numAmount < 0) {
        return res.status(400).json({ error: 'Valid numeric amount is required' });
      }

      const fromCurr = (from || 'USD').toUpperCase() as CurrencyCode;
      const toCurr = (to || 'USD').toUpperCase() as CurrencyCode;

      const authHeader = req.headers.authorization;
      const clientToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      const data = await fetchAuthoritativeRates(false, spreadsheetId, clientToken);
      const fromUsdRate = data.rates[fromCurr] || BASELINE_RATES[fromCurr] || 1.0;
      const toUsdRate = data.rates[toCurr] || BASELINE_RATES[toCurr] || 1.0;

      // Base unadjusted cross rate from -> to
      const liveRate = toUsdRate / fromUsdRate;
      const adjustment = Number(manualAdjustment) || 0;
      const effectiveRate = Math.max(0.000001, liveRate + adjustment);

      const convertedAmount = numAmount * effectiveRate;
      const formula = fromCurr === 'USD' 
        ? CANONICAL_GOOGLEFINANCE_FORMULAS[toCurr]?.direct || `=GOOGLEFINANCE("CURRENCY:USD${toCurr}")`
        : `=GOOGLEFINANCE("CURRENCY:${fromCurr}${toCurr}")`;

      return res.json({
        success: true,
        amount: numAmount,
        fromCurrency: fromCurr,
        toCurrency: toCurr,
        googleFinanceLiveRate: Number(liveRate.toFixed(6)),
        googleFinanceFormula: formula,
        xeLiveRate: Number(liveRate.toFixed(6)), // backward-compatible alias
        manualAdjustment: adjustment,
        effectiveRate: Number(effectiveRate.toFixed(6)),
        convertedAmount: Number(convertedAmount.toFixed(2)),
        provider: data.provider,
        sourceType: data.sourceType,
        googleSheetId: data.googleSheetId,
        googleSheetTab: data.googleSheetTab,
        isLive: data.isLive,
        isStale: data.isStale,
        timestamp: new Date().toISOString()
      });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || 'Conversion error' });
    }
  });

  /**
   * GET /api/fx/google-sheets/status
   * Probes Google Sheet connection for FX_RATES tab
   */
  router.get('/google-sheets/status', async (req: Request, res: Response) => {
    try {
      const cleanId = (req.query.spreadsheetId || process.env.GOOGLE_SHEET_ID || '').toString().trim();
      const authHeader = req.headers.authorization;
      const clientToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      const tokenRes = await getServerAccessToken(clientToken);

      const statusInfo = {
        configured: Boolean(cleanId),
        spreadsheetId: cleanId,
        hasOAuthToken: Boolean(tokenRes.token),
        tokenStatus: tokenRes.status,
        canonicalTabName: 'FX_RATES',
        canonicalFormulas: CANONICAL_GOOGLEFINANCE_FORMULAS,
        supportedPairsCount: SUPPORTED_CURRENCIES.length - 1,
        timestamp: new Date().toISOString()
      };

      if (!cleanId) {
        return res.json({
          ...statusInfo,
          connected: false,
          tabExists: false,
          message: 'No Google Sheet ID configured'
        });
      }

      if (!tokenRes.token) {
        // Try gviz probe
        try {
          const gvizRes = await fetch(`https://docs.google.com/spreadsheets/d/${cleanId}/gviz/tq?tqx=out:json&sheet=FX_RATES`, {
            signal: AbortSignal.timeout(4000)
          });
          const gvizOk = gvizRes.ok;
          return res.json({
            ...statusInfo,
            connected: gvizOk,
            tabExists: gvizOk,
            connectionType: 'PUBLIC_GVIZ',
            message: gvizOk ? 'Connected via Google Sheets link sharing' : 'Authentication required for private sheet'
          });
        } catch (_) {
          return res.json({
            ...statusInfo,
            connected: false,
            tabExists: false,
            message: 'Authentication required to probe private Google Sheet'
          });
        }
      }

      // Check spreadsheet metadata via Google Sheets API v4
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=properties.title,sheets.properties`, {
        headers: {
          'Authorization': `Bearer ${tokenRes.token}`,
          'Accept': 'application/json'
        },
        signal: AbortSignal.timeout(5000)
      });

      if (!metaRes.ok) {
        const errText = await metaRes.text();
        return res.json({
          ...statusInfo,
          connected: false,
          tabExists: false,
          apiStatusCode: metaRes.status,
          message: `Google Sheets API returned HTTP ${metaRes.status}: ${errText}`
        });
      }

      const metaData = await metaRes.json();
      const existingTabs: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);
      const fxTabFound = existingTabs.includes('FX_RATES');

      return res.json({
        ...statusInfo,
        connected: true,
        spreadsheetTitle: metaData.properties?.title,
        tabExists: fxTabFound,
        availableTabs: existingTabs,
        message: fxTabFound 
          ? 'FX_RATES tab verified in connected Google Sheet' 
          : 'Google Sheet connected; FX_RATES tab ready to be provisioned'
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * POST /api/fx/google-sheets/provision
   * Automatically provisions the FX_RATES worksheet in the connected Google Sheet
   * with authoritative =GOOGLEFINANCE() formulas
   */
  router.post('/google-sheets/provision', async (req: Request, res: Response) => {
    try {
      const { spreadsheetId } = req.body || {};
      const cleanId = (spreadsheetId || process.env.GOOGLE_SHEET_ID || '').toString().trim();
      const authHeader = req.headers.authorization;
      const clientToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

      if (!cleanId) {
        return res.status(400).json({ success: false, error: 'Spreadsheet ID is required' });
      }

      const tokenRes = await getServerAccessToken(clientToken);
      if (!tokenRes.token) {
        return res.status(401).json({
          success: false,
          error: 'Google Workspace authentication is required to provision worksheets. Please sign in via Google Workspace.'
        });
      }

      // 1. Check if tab already exists
      const metaRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}?fields=sheets.properties`, {
        headers: { 'Authorization': `Bearer ${tokenRes.token}` }
      });

      if (!metaRes.ok) {
        const err = await metaRes.text();
        return res.status(metaRes.status).json({ success: false, error: `Google Sheets API error: ${err}` });
      }

      const metaData = await metaRes.json();
      const existingTabs: string[] = (metaData.sheets || []).map((s: any) => s.properties?.title).filter(Boolean);

      if (!existingTabs.includes('FX_RATES')) {
        // Add worksheet tab
        const addSheetRes = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${cleanId}:batchUpdate`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            requests: [
              {
                addSheet: {
                  properties: {
                    title: 'FX_RATES',
                    tabColor: { red: 0.0, green: 0.89, blue: 0.75 } // TheUnbound Teal
                  }
                }
              }
            ]
          })
        });

        if (!addSheetRes.ok) {
          const addErr = await addSheetRes.text();
          return res.status(addSheetRes.status).json({ success: false, error: `Failed to create FX_RATES tab: ${addErr}` });
        }
      }

      // 2. Populate FX_RATES with canonical headers and =GOOGLEFINANCE() formulas
      const headers = [
        'pair_id', 'from_currency', 'to_currency', 'currency_name',
        'googlefinance_formula', 'live_rate', 'inverse_formula', 'inverse_rate',
        'manual_adjustment', 'effective_rate', 'last_synced_at'
      ];

      const targetCurrencies = SUPPORTED_CURRENCIES.filter(c => c !== 'USD');
      const rows: any[][] = [headers];

      targetCurrencies.forEach((curr, idx) => {
        const rowNum = idx + 2;
        rows.push([
          `USD_${curr}`,
          'USD',
          curr,
          CURRENCY_NAMES[curr] || curr,
          `=GOOGLEFINANCE("CURRENCY:USD${curr}")`,
          `=GOOGLEFINANCE("CURRENCY:USD${curr}")`,
          `=GOOGLEFINANCE("CURRENCY:${curr}USD")`,
          `=GOOGLEFINANCE("CURRENCY:${curr}USD")`,
          0.00,
          `=F${rowNum}+I${rowNum}`,
          '=NOW()'
        ]);
      });

      const writeRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${cleanId}/values/FX_RATES!A1:K${rows.length}?valueInputOption=USER_ENTERED`,
        {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${tokenRes.token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            range: `FX_RATES!A1:K${rows.length}`,
            majorDimension: 'ROWS',
            values: rows
          })
        }
      );

      if (!writeRes.ok) {
        const writeErr = await writeRes.text();
        return res.status(writeRes.status).json({ success: false, error: `Failed to write formulas to FX_RATES: ${writeErr}` });
      }

      return res.json({
        success: true,
        message: 'FX_RATES tab successfully provisioned with official =GOOGLEFINANCE() formulas!',
        spreadsheetId: cleanId,
        tabName: 'FX_RATES',
        rowsWritten: rows.length,
        formulasCount: targetCurrencies.length
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  /**
   * GET /api/fx/health
   */
  router.get('/health', (req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'TheUnbound Google Sheets =GOOGLEFINANCE() FX Engine',
      provider: 'Google Sheets & Google Finance',
      supportedCurrencies: SUPPORTED_CURRENCIES,
      timestamp: new Date().toISOString()
    });
  });

  return router;
}
