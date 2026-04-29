/**
 * Pinned reports stored in localStorage. Per-business so switching to a
 * different company doesn't bleed favourites across.
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'reports.favourites';
const MAX = 10;

const businessKey = () => {
  try {
    return `${KEY}:${localStorage.getItem('business_id') || 'default'}`;
  } catch {
    return KEY;
  }
};

const read = (): string[] => {
  try {
    const raw = localStorage.getItem(businessKey());
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
};

const write = (codes: string[]) => {
  try {
    localStorage.setItem(businessKey(), JSON.stringify(codes.slice(0, MAX)));
  } catch {
    /* quota / private mode — silently degrade */
  }
};

export function useFavouriteReports() {
  const [favs, setFavs] = useState<string[]>(() => read());

  // Cross-tab sync — if the user toggles a favourite in another tab, reflect it.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === businessKey()) setFavs(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback((code: string) => {
    setFavs((prev) => {
      const next = prev.includes(code)
        ? prev.filter((c) => c !== code)
        : [code, ...prev].slice(0, MAX);
      write(next);
      return next;
    });
  }, []);

  const isFav = useCallback((code: string) => favs.includes(code), [favs]);

  return { favourites: favs, toggle, isFav };
}
