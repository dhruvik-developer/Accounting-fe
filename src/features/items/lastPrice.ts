/**
 * "Last sold/bought" lookups for the invoice + bill line auto-fill flow.
 *
 * When the user picks an item AND the party is already chosen, we ping the
 * backend for the last rate this party paid (or charged us) and pre-fill
 * the line. Saves a re-look-up every time the same customer reorders.
 *
 * The backend returns 404-equivalent (`{found: false}`) when no history
 * exists; consumers fall back to the item-master sale_price / purchase_price.
 */
import { api } from '@/app/api';

export type LastPriceHit = {
  found: true;
  rate: string;
  discount: string;
  tax_rate: string;
  date: string;
  invoice_number?: string;
  bill_number?: string;
  invoice_id?: string;
  bill_id?: string;
};

export type LastPriceMiss = { found: false };

export type LastPriceResult = LastPriceHit | LastPriceMiss;

export async function fetchLastSoldTo(itemId: string, partyId: string): Promise<LastPriceResult> {
  const { data } = await api.get<LastPriceResult>(
    `/items/${itemId}/last-sold-to/`, { params: { party: partyId } },
  );
  return data;
}

export async function fetchLastBoughtFrom(itemId: string, partyId: string): Promise<LastPriceResult> {
  const { data } = await api.get<LastPriceResult>(
    `/items/${itemId}/last-bought-from/`, { params: { party: partyId } },
  );
  return data;
}

/**
 * Hint shown next to the rate cell after auto-fill.
 * Stored per-line in form state; rendered as a small chip with date.
 */
export type LastPriceHint = {
  rate: number;
  date: string;          // ISO
  docNumber?: string;
};
