/**
 * WhatsApp share helpers for the Party detail pane.
 *
 * Why text-only and not PDF? wa.me / WhatsApp Web doesn't accept file
 * attachments in the URL — only `?text=`. A nicely formatted, copy-pastable
 * message is what 90% of Indian SMBs actually send today (Vyapar / Khatabook
 * also do this). PDF statements are a future server-side enhancement.
 *
 * The phone number is normalised to a 91-prefixed digit string so wa.me
 * works whether the user stored "+91 98...", "98...", or with spaces.
 */
import dayjs from 'dayjs';

const num = (v: any) => Number(v || 0);
const inr = (v: number) =>
  '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 2 });

/**
 * Drop everything that isn't a digit, then prefix +91 if it looks like a
 * 10-digit Indian number. Already-international numbers (12+ digits) are
 * left alone so this still works for foreign customers.
 */
export function normalisePhone(raw: string | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (!digits) return null;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

export function openWhatsApp(phone: string | null | undefined, message: string) {
  const norm = normalisePhone(phone || '');
  // No number? Open the WhatsApp share dialog with no recipient — the user
  // can pick a contact inside WhatsApp. Better than failing silently.
  const url = norm
    ? `https://wa.me/${norm}?text=${encodeURIComponent(message)}`
    : `https://wa.me/?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ---------- Ledger -------------------------------------------------------

export type LedgerEntry = {
  date: string;
  ref_type: string;
  ref_number: string;
  debit: string;
  credit: string;
  running_balance: string;
};

export function formatLedgerMessage(
  party: any,
  entries: LedgerEntry[],
  businessName?: string,
): string {
  const lines: string[] = [];
  lines.push(`*Account statement — ${party.display_name || party.name}*`);
  if (businessName) lines.push(`From: ${businessName}`);
  lines.push(`Generated: ${dayjs().format('DD MMM YYYY')}`);
  lines.push('');

  if (entries.length === 0) {
    lines.push('_No transactions to show in this window._');
  } else {
    lines.push('```');
    lines.push('Date       Ref            Debit      Credit     Bal');
    entries.slice(-30).forEach((e) => {
      const d = num(e.debit);
      const c = num(e.credit);
      const b = num(e.running_balance);
      const bSuffix = b > 0 ? 'Dr' : b < 0 ? 'Cr' : '';
      const date = dayjs(e.date).format('DD/MM/YY');
      const ref = (e.ref_number || e.ref_type || '').slice(0, 12).padEnd(12);
      const dr = d > 0 ? d.toLocaleString('en-IN').padStart(10) : '          ';
      const cr = c > 0 ? c.toLocaleString('en-IN').padStart(10) : '          ';
      const bal = `${Math.abs(b).toLocaleString('en-IN')} ${bSuffix}`.padStart(12);
      lines.push(`${date} ${ref} ${dr} ${cr} ${bal}`);
    });
    lines.push('```');

    if (entries.length > 30) {
      lines.push('');
      lines.push(`_Showing last 30 of ${entries.length} entries._`);
    }

    const lastBal = num(entries[entries.length - 1]?.running_balance);
    lines.push('');
    if (lastBal > 0) {
      lines.push(`*Closing balance: ${inr(Math.abs(lastBal))} Dr* (you owe us)`);
    } else if (lastBal < 0) {
      lines.push(`*Closing balance: ${inr(Math.abs(lastBal))} Cr* (we owe you)`);
    } else {
      lines.push('*Closing balance: settled*');
    }
  }
  lines.push('');
  lines.push('Please reach out if anything looks off. Thanks!');
  return lines.join('\n');
}

// ---------- Invoices -----------------------------------------------------

export type InvoiceLite = {
  number?: string;
  id: string;
  date: string;
  due_date?: string | null;
  status: string;
  grand_total: string | number;
  amount_paid: string | number;
};

export function formatInvoicesMessage(
  party: any,
  invoices: InvoiceLite[],
  businessName?: string,
): string {
  const lines: string[] = [];
  const single = invoices.length === 1;
  lines.push(single
    ? `*Invoice ${invoices[0].number || ''}*`
    : `*${invoices.length} invoices for ${party.display_name || party.name}*`);
  if (businessName) lines.push(`From: ${businessName}`);
  lines.push('');

  let totalGrand = 0;
  let totalPending = 0;
  invoices.forEach((inv, i) => {
    const grand = num(inv.grand_total);
    const paid = num(inv.amount_paid);
    const pending = grand - paid;
    totalGrand += grand;
    totalPending += pending;

    const prefix = single ? '' : `${i + 1}. `;
    lines.push(`${prefix}*${inv.number || inv.id.slice(0, 8)}*  ·  ${dayjs(inv.date).format('DD MMM YY')}`);
    lines.push(`   Total: ${inr(grand)}`);
    if (paid > 0) lines.push(`   Paid:  ${inr(paid)}`);
    if (pending > 0) {
      const due = inv.due_date ? `  (due ${dayjs(inv.due_date).format('DD MMM')})` : '';
      lines.push(`   *Pending: ${inr(pending)}*${due}`);
    } else {
      lines.push('   _Fully paid_');
    }
    lines.push('');
  });

  if (!single) {
    lines.push('-----');
    lines.push(`*Total: ${inr(totalGrand)}*`);
    if (totalPending > 0) lines.push(`*Pending: ${inr(totalPending)}*`);
    lines.push('');
  }
  if (totalPending > 0) {
    lines.push('Kindly arrange the payment at the earliest. Thank you.');
  } else {
    lines.push('Thank you for your business!');
  }
  return lines.join('\n');
}

// ---------- Payments -----------------------------------------------------

export type PaymentLite = {
  number?: string;
  id: string;
  date: string;
  direction: 'in' | 'out';
  mode: string;
  amount: string | number;
};

export function formatPaymentsMessage(
  party: any,
  payments: PaymentLite[],
  businessName?: string,
): string {
  const lines: string[] = [];
  const single = payments.length === 1;
  lines.push(single
    ? `*Payment receipt — ${payments[0].number || ''}*`
    : `*${payments.length} payments — ${party.display_name || party.name}*`);
  if (businessName) lines.push(`From: ${businessName}`);
  lines.push('');

  let totalIn = 0;
  let totalOut = 0;
  payments.forEach((p, i) => {
    const amt = num(p.amount);
    if (p.direction === 'in') totalIn += amt; else totalOut += amt;
    const arrow = p.direction === 'in' ? 'received' : 'paid';
    const prefix = single ? '' : `${i + 1}. `;
    lines.push(`${prefix}*${p.number || p.id.slice(0, 8)}*  ·  ${dayjs(p.date).format('DD MMM YY')}`);
    lines.push(`   ${inr(amt)} ${arrow} via ${p.mode.toUpperCase()}`);
    lines.push('');
  });

  if (!single) {
    lines.push('-----');
    if (totalIn > 0) lines.push(`*Total received: ${inr(totalIn)}*`);
    if (totalOut > 0) lines.push(`*Total paid out: ${inr(totalOut)}*`);
    lines.push('');
  }
  lines.push('Thank you!');
  return lines.join('\n');
}
