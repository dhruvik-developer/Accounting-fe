/**
 * Consistent money formatting across the app.
 *
 *   <MoneyDisplay value={123456.78} />          // ₹1,23,456.78
 *   <MoneyDisplay value={-450} sign />          // −₹450 in danger color
 *   <MoneyDisplay value={1500000} short />      // ₹15.0L
 *   <MoneyDisplay value={inv.amount_paid} muted />
 *   <MoneyDisplay value={delta} delta />        // colors green/red based on sign
 */
import { Box, Typography } from '@mui/material';
import type { TypographyProps } from '@mui/material';

export type MoneyDisplayProps = {
  value: number | string | null | undefined;
  /** Compact form: ₹15.0L, ₹2.4Cr */
  short?: boolean;
  /** Force a leading sign for non-negative values */
  sign?: boolean;
  /** Color positive green / negative red (overrides default) */
  delta?: boolean;
  /** Render in muted text color */
  muted?: boolean;
  /** Strikethrough — useful for cancelled docs */
  strike?: boolean;
  /** Currency symbol (default ₹) */
  currency?: string;
  /** Override how many fraction digits to show (full form only) */
  fractionDigits?: number;
} & Omit<TypographyProps, 'children'>;

const formatShort = (n: number, currency: string) => {
  const a = Math.abs(n);
  if (a >= 10000000) return `${currency}${(n / 10000000).toFixed(2)}Cr`;
  if (a >= 100000)   return `${currency}${(n / 100000).toFixed(2)}L`;
  if (a >= 1000)     return `${currency}${(n / 1000).toFixed(1)}K`;
  return `${currency}${n.toFixed(0)}`;
};

const formatFull = (n: number, currency: string, frac: number) =>
  `${currency}${n.toLocaleString('en-IN', { minimumFractionDigits: frac, maximumFractionDigits: frac })}`;

export default function MoneyDisplay({
  value, short = false, sign = false, delta = false, muted = false, strike = false,
  currency = '₹', fractionDigits = 2, sx, ...rest
}: MoneyDisplayProps) {
  const num = typeof value === 'string' ? Number(value) : (value ?? 0);
  const negative = num < 0;
  const formatted = short
    ? formatShort(Math.abs(num), currency)
    : formatFull(Math.abs(num), currency, fractionDigits);
  const prefix = negative ? '−' : (sign ? '+' : '');

  let color: string | undefined;
  if (delta) color = negative ? '#FF5252' : '#00E676';
  else if (muted) color = undefined; // text.secondary applied via sx
  else color = undefined;

  return (
    <Typography
      component="span"
      sx={{
        fontVariantNumeric: 'tabular-nums',
        fontWeight: 600,
        color: color || (muted ? 'text.secondary' : 'inherit'),
        textDecoration: strike ? 'line-through' : 'none',
        whiteSpace: 'nowrap',
        ...sx,
      }}
      {...rest}
    >
      {prefix}{formatted}
    </Typography>
  );
}

/** Helper for inline numeric formatting without the Typography wrapper. */
export const formatMoney = (
  value: number | string | null | undefined,
  opts?: { short?: boolean; currency?: string; fractionDigits?: number },
) => {
  const num = typeof value === 'string' ? Number(value) : (value ?? 0);
  const c = opts?.currency ?? '₹';
  if (opts?.short) return formatShort(num, c);
  return formatFull(num, c, opts?.fractionDigits ?? 2);
};

/** Tiny pill that pairs delta % with a money value — used in KPI cards. */
export function DeltaTag({ pct, suffix }: { pct: number; suffix?: string }) {
  const up = pct >= 0;
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.5,
      px: 0.75, py: 0.25, borderRadius: 999,
      fontSize: 11, fontWeight: 700,
      color: up ? '#00E676' : '#FF5252',
      background: up ? 'rgba(0,230,118,0.10)' : 'rgba(255,82,82,0.10)',
    }}>
      {up ? '▲' : '▼'} {Math.abs(pct).toFixed(1)}%{suffix ? ` ${suffix}` : ''}
    </Box>
  );
}
