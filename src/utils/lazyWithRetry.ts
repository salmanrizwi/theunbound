import React from 'react';

const CHUNK_RELOAD_STORAGE_KEY = 'theunbound_chunk_reload_at';
const CHUNK_RELOAD_COOLDOWN_MS = 15000;

export function isDynamicImportFetchError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err || '');
  const lower = message.toLowerCase();
  return (
    lower.includes('failed to fetch dynamically imported module') ||
    lower.includes('importing a module script failed') ||
    lower.includes('error loading dynamically imported module') ||
    lower.includes('loading chunk') ||
    lower.includes('loading css chunk') ||
    lower.includes('outdated optimize dep') ||
    lower.includes('dynamically imported module')
  );
}

/**
 * Resilient lazy loader that recovers from transient network errors, Vite dev-server
 * dependency re-optimization hashes, or production chunk updates.
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>
): React.LazyExoticComponent<T> {
  return React.lazy(async () => {
    const delays = [250, 600];
    let lastError: unknown;

    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        const mod = await factory();
        if (typeof window !== 'undefined' && window.sessionStorage) {
          try {
            window.sessionStorage.removeItem(CHUNK_RELOAD_STORAGE_KEY);
          } catch {
            // Ignore storage errors
          }
        }
        return mod;
      } catch (err) {
        lastError = err;
        if (attempt < delays.length) {
          console.warn(`[LazyLoad] Retrying dynamic module import (attempt ${attempt + 1}/${delays.length}):`, err);
          await new Promise(resolve => setTimeout(resolve, delays[attempt]));
        }
      }
    }

    if (typeof window !== 'undefined' && isDynamicImportFetchError(lastError)) {
      try {
        const now = Date.now();
        const lastReloadRaw = window.sessionStorage?.getItem(CHUNK_RELOAD_STORAGE_KEY);
        const lastReloadAt = lastReloadRaw ? Number(lastReloadRaw) : 0;

        if (!lastReloadAt || Number.isNaN(lastReloadAt) || now - lastReloadAt > CHUNK_RELOAD_COOLDOWN_MS) {
          window.sessionStorage?.setItem(CHUNK_RELOAD_STORAGE_KEY, String(now));
          console.warn('[LazyLoad] Dynamic module stale or unavailable; reloading page to refresh module graph.');
          window.location.reload();
          return new Promise<{ default: T }>(() => {
            // Keep Suspense pending while the browser reloads
          });
        }
      } catch {
        // Ignore sessionStorage errors and fall through to throw
      }
    }

    throw lastError;
  });
}
