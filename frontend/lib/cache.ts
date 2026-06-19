import { useEffect, useState } from "react";

const DEFAULT_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CacheEntry<T> {
  value: T;
  expires: number;
}

function readCache<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(`fc_cache_${key}`);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() > entry.expires) {
      localStorage.removeItem(`fc_cache_${key}`);
      return null;
    }
    return entry.value;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, value: T, ttl: number): void {
  try {
    const entry: CacheEntry<T> = { value, expires: Date.now() + ttl };
    localStorage.setItem(`fc_cache_${key}`, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

/**
 * Stale-while-revalidate fetch with localStorage persistence.
 *
 * Returns cached data instantly on mount, then fetches fresh data in the
 * background and updates once the server responds. This means users see
 * last-known data even during a cold-start, then the UI silently refreshes.
 */
export function useCachedFetch<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttl = DEFAULT_TTL_MS
): { data: T | null; loading: boolean; isStale: boolean } {
  const [data, setData] = useState<T | null>(() => readCache<T>(key));
  const [loading, setLoading] = useState(true);
  const [isStale, setIsStale] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetcher()
      .then((fresh) => {
        if (cancelled) return;
        setData(fresh);
        setIsStale(false);
        writeCache(key, fresh, ttl);
      })
      .catch(() => {
        // Server unavailable — keep showing cached data, still mark as done loading
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return { data, loading: loading && data === null, isStale };
}
