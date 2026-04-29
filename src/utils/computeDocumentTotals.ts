/**
 * Client-side preview of invoice / bill totals.
 *
 * The server is the source of truth — these numbers are recomputed and
 * persisted by `compute_and_save_totals` in apps.sales / apps.purchases.
 * But the form needs to show *something* before save, otherwise the
 * Subtotal / GST / Grand cells just sit at 0.00 and the user can't tell
 * if the data they typed is sane.
 *
 * Math here mirrors the backend so a saved doc shows the same numbers.
 */

export type LineLike = {
  quantity: number | string;
  rate: number | string;
  discount?: number | string;
  tax_rate: number | string;
};

export type ChargeLike = {
  amount: number | string;
  tax_rate?: number | string;
  apply_before_tax?: boolean;
};

export type Totals = {
  subtotal: number;
  discount: number;
  cgst: number;
  sgst: number;
  igst: number;
  postTax: number;
  grand: number;
};

const num = (v: any) => Number(v || 0);

/**
 * Compute live totals from raw line + charge state.
 *
 * `interState=true` puts all GST into IGST. Otherwise it splits 50/50
 * into CGST + SGST (matching the GST engine's calc.py rounding).
 */
export function computeDocumentTotals(
  lines: LineLike[],
  charges: ChargeLike[] = [],
  interState = false,
): Totals {
  let subtotal = 0;
  let discount = 0;
  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  let postTax = 0;

  // Lines first
  for (const l of lines) {
    const qty = num(l.quantity);
    const rate = num(l.rate);
    const disc = num(l.discount);
    const tr = num(l.tax_rate);
    const taxable = Math.max(0, qty * rate - disc);
    const tax = taxable * tr / 100;
    subtotal += taxable;
    discount += disc;
    if (interState) {
      igst += tax;
    } else {
      const half = round2(tax / 2);
      cgst += half;
      sgst += round2(tax - half);
    }
  }

  // Charges fold into the same buckets — pre-tax charges add to taxable +
  // bring their own GST; post-tax charges are flat additions.
  for (const c of charges) {
    const amt = num(c.amount);
    if (amt <= 0) continue;
    if (c.apply_before_tax !== false) {
      const tr = num(c.tax_rate);
      const tax = amt * tr / 100;
      subtotal += amt;
      if (interState) {
        igst += tax;
      } else {
        const half = round2(tax / 2);
        cgst += half;
        sgst += round2(tax - half);
      }
    } else {
      postTax += amt;
    }
  }

  const grand = round2(subtotal) + round2(cgst) + round2(sgst) + round2(igst) + round2(postTax);

  return {
    subtotal: round2(subtotal),
    discount: round2(discount),
    cgst: round2(cgst),
    sgst: round2(sgst),
    igst: round2(igst),
    postTax: round2(postTax),
    grand: round2(grand),
  };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Format a number for display in the totals box (always 2 decimals). */
export function fmt(v: number | undefined): string {
  return Number(v ?? 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
