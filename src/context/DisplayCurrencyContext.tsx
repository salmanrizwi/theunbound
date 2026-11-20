import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { CurrencyCode, User } from '../types';
import { useAuth } from './AuthContext';
import { AppDatabase } from '../services/db';
import {
  AggregatedDisplayAmount,
  canUserEditDisplayCurrency,
  DisplayConversionResult,
  displayCurrencyService,
  formatDisplayMoney,
  GlobalDisplayCurrencyConfig
} from '../services/displayCurrencyService';

interface DisplayCurrencyContextValue {
  displayCurrency: CurrencyCode;
  config: GlobalDisplayCurrencyConfig;
  fxVersion: number;
  canEditDisplayCurrency: boolean;
  isUpdating: boolean;
  lastError: string | null;
  clearError: () => void;
  setGlobalDisplayCurrency: (
    nextCurrency: CurrencyCode,
    actorOverride?: User | null
  ) => Promise<{
    success: boolean;
    displayCurrency: CurrencyCode;
    previousCurrency: CurrencyCode;
    unchanged?: boolean;
    error?: string;
  }>;
  convertForDisplay: (
    amount: number | null | undefined,
    sourceCurrency: any,
    options?: { showCode?: boolean; decimals?: number }
  ) => DisplayConversionResult;
  formatDisplayCurrency: (
    amount: number | null | undefined,
    options?: { showCode?: boolean; decimals?: number }
  ) => string;
  aggregateForDisplay: <T = any>(
    records: T[],
    extractor: (item: NoInfer<T>) => { amount: number | null | undefined; currency: any }
  ) => AggregatedDisplayAmount;
}

const DisplayCurrencyContext = createContext<DisplayCurrencyContextValue | undefined>(undefined);

export const DisplayCurrencyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const db = AppDatabase.getInstance();

  const [config, setConfig] = useState<GlobalDisplayCurrencyConfig>(() => displayCurrencyService.getConfig());
  const [fxVersion, setFxVersion] = useState<number>(() => displayCurrencyService.getFxVersion());
  const [isUpdating, setIsUpdating] = useState(false);
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    const unsubRealtime = displayCurrencyService.initRealtimeSync();
    const unsubService = displayCurrencyService.subscribe(() => {
      setConfig(displayCurrencyService.getConfig());
      setFxVersion(displayCurrencyService.getFxVersion());
    });
    return () => {
      unsubService();
      unsubRealtime();
    };
  }, []);

  const canEdit = useMemo(() => canUserEditDisplayCurrency(user), [user]);

  const setGlobalDisplayCurrency = useCallback(
    async (nextCurrency: CurrencyCode, actorOverride?: User | null) => {
      const effectiveActor = actorOverride !== undefined ? actorOverride : user;
      setIsUpdating(true);
      setLastError(null);
      try {
        const res = await displayCurrencyService.setGlobalDisplayCurrency(nextCurrency, effectiveActor, {
          auditLogger: (prevCurr, newCurr, actor) => {
            db.logAudit(
              actor ? { id: actor.id, name: actor.name, role: actor.role } : null,
              'SETTINGS_UPDATED' as any,
              'GlobalDisplayCurrency',
              'globalDisplayCurrency',
              `Global Display Currency changed from ${prevCurr} to ${newCurr} by ${actor?.email || actor?.name || 'Admin'}`,
              prevCurr,
              newCurr
            );
          }
        });
        if (!res.success && res.error) {
          setLastError(res.error);
        }
        return res;
      } finally {
        setIsUpdating(false);
      }
    },
    [user, db]
  );

  const convertForDisplay = useCallback(
    (
      amount: number | null | undefined,
      sourceCurrency: any,
      options?: { showCode?: boolean; decimals?: number }
    ) => {
      return displayCurrencyService.convertForDisplay(amount, sourceCurrency, config.displayCurrency, options);
    },
    [config.displayCurrency, fxVersion]
  );

  const formatDisplayCurrency = useCallback(
    (amount: number | null | undefined, options?: { showCode?: boolean; decimals?: number }) => {
      return formatDisplayMoney(amount, config.displayCurrency, options);
    },
    [config.displayCurrency]
  );

  const aggregateForDisplay = useCallback(
    <T = any,>(records: T[], extractor: (item: NoInfer<T>) => { amount: number | null | undefined; currency: any }) => {
      return displayCurrencyService.aggregateForDisplay(records, extractor, config.displayCurrency);
    },
    [config.displayCurrency, fxVersion]
  );

  const clearError = useCallback(() => setLastError(null), []);

  const value = useMemo<DisplayCurrencyContextValue>(
    () => ({
      displayCurrency: config.displayCurrency,
      config,
      fxVersion,
      canEditDisplayCurrency: canEdit,
      isUpdating,
      lastError,
      clearError,
      setGlobalDisplayCurrency,
      convertForDisplay,
      formatDisplayCurrency,
      aggregateForDisplay
    }),
    [
      config,
      fxVersion,
      canEdit,
      isUpdating,
      lastError,
      clearError,
      setGlobalDisplayCurrency,
      convertForDisplay,
      formatDisplayCurrency,
      aggregateForDisplay
    ]
  );

  return <DisplayCurrencyContext.Provider value={value}>{children}</DisplayCurrencyContext.Provider>;
};

/**
 * Safe hook for DisplayCurrencyContext. Falls back to displayCurrencyService if used outside provider (e.g. isolated tests).
 */
export function useDisplayCurrency(): DisplayCurrencyContextValue {
  const ctx = useContext(DisplayCurrencyContext);
  if (ctx) return ctx;

  const fallbackCurrency = displayCurrencyService.getDisplayCurrency();
  return {
    displayCurrency: fallbackCurrency,
    config: displayCurrencyService.getConfig(),
    fxVersion: displayCurrencyService.getFxVersion(),
    canEditDisplayCurrency: false,
    isUpdating: false,
    lastError: null,
    clearError: () => {},
    setGlobalDisplayCurrency: async (nextCurrency, actor) =>
      displayCurrencyService.setGlobalDisplayCurrency(nextCurrency, actor),
    convertForDisplay: (amount, sourceCurrency, options) =>
      displayCurrencyService.convertForDisplay(amount, sourceCurrency, fallbackCurrency, options),
    formatDisplayCurrency: (amount, options) => formatDisplayMoney(amount, fallbackCurrency, options),
    aggregateForDisplay: (records, extractor) =>
      displayCurrencyService.aggregateForDisplay(records, extractor, fallbackCurrency)
  };
}
