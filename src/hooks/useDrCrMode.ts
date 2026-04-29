/**
 * "Display ledger entries as Debit/Credit?" toggle, persisted per-user.
 *
 * Indian accountants — especially Tally migrants — read ledgers in Dr/Cr,
 * not "+/−" or "in/out". This hook flips a global preference; consumers
 * (Payments table, Party ledger tab, Day book) decide how to format
 * direction labels and amount signs based on it.
 *
 * Storage key is unscoped (preference, not data), so it survives a
 * business switch.
 */
import { useCallback, useEffect, useState } from 'react';

const KEY = 'pref.ledger.drcr';

const read = (): boolean => {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
};

const write = (on: boolean) => {
  try {
    localStorage.setItem(KEY, on ? '1' : '0');
  } catch {
    /* private mode — silently degrade */
  }
};

export function useDrCrMode() {
  const [drCr, setDrCr] = useState<boolean>(read);

  // Cross-tab sync — accountants often have multiple tabs open.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY) setDrCr(read());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const toggle = useCallback(() => {
    setDrCr((prev) => {
      const next = !prev;
      write(next);
      return next;
    });
  }, []);

  return { drCr, toggle, set: (v: boolean) => { write(v); setDrCr(v); } };
}

/**
 * Format a payment direction string under the active label mode.
 *  - drCr=false  → "Received" / "Paid out"
 *  - drCr=true   → "Cr" (party credited when they pay us)
 *                  "Dr" (party debited when we pay them)
 */
export function directionLabel(direction: 'in' | 'out', drCr: boolean): string {
  if (drCr) return direction === 'in' ? 'Cr' : 'Dr';
  return direction === 'in' ? 'Received' : 'Paid out';
}
