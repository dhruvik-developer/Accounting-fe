/**
 * Default landing screen for /reports.
 *
 * Replaces the old "select a report" prompt with a curated executive view:
 *   • 4 KPI hero cards (Sales, Receivables, GST payable, Inventory value)
 *   • Sales trend line chart (with optional vs-previous-period overlay)
 *   • Payment-mode donut
 *   • Top outstanding parties + low-stock items as pinned strips
 *
 * All data comes from the existing /reports/dashboard/ endpoint — the
 * landing is a pure rendering layer, no backend changes.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Chip, Divider, Grid, IconButton, Paper, Skeleton,
  Stack, Switch, Tooltip, Typography, alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import { api } from '@/app/api';
import StatCard from '@/components/StatCard';
import MoneyDisplay, { formatMoney } from '@/components/MoneyDisplay';
import { LineChart, DonutChart, HBarChart } from './MiniChart';
import { previousPeriod } from './datePresets';

const num = (v: any) => Number(v || 0);

type DashboardResponse = {
  period: { from: string; to: string };
  kpis: any[];
  charts: {
    sales_trend: { label: string; value: string }[];
    purchase_trend: { label: string; value: string }[];
    payment_split: { label: string; value: string }[];
  };
  tables: {
    recent_invoices: any[];
    low_stock: any[];
    outstanding_parties: any[];
  };
  totals: { sales: string; purchases: string; payments_in: string; payments_out: string };
  receivables: string;
  payables: string;
};

type Props = {
  range: { from: string; to: string };
  onPickReport: (code: string) => void;
};

export default function ReportsDashboard({ range, onPickReport }: Props) {
  const nav = useNavigate();
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [compareData, setCompareData] = useState<DashboardResponse | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    setErr('');
    api.get('/reports/dashboard/', {
      params: { date_from: range.from, date_to: range.to },
    })
      .then((r) => setData(r.data))
      .catch((e) => setErr(e?.response?.data?.detail || e?.message || 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  // Comparison fetch — only runs when toggled on. Failures are silent
  // (the toggle just does nothing if it fails) so the main view isn't blocked.
  useEffect(() => {
    if (!compareOn) { setCompareData(null); return; }
    const prev = previousPeriod(range);
    api.get('/reports/dashboard/', {
      params: { date_from: prev.from, date_to: prev.to },
    })
      .then((r) => setCompareData(r.data))
      .catch(() => setCompareData(null));
  }, [compareOn, range.from, range.to]);

  // Pull the four most useful KPIs out of the catalogue we get back.
  // The backend ships ~12 KPIs; for the landing we want only "what changed".
  const kpis = useMemo(() => {
    if (!data) return [];
    const sales = num(data.totals.sales);
    const receivables = num(data.receivables);
    const inventoryKpi = data.kpis.find((k: any) => k.label === 'Inventory Value');
    const gstKpi = data.kpis.find((k: any) => k.label === 'GST Payable');
    const purchases = num(data.totals.purchases);

    const compareSales = compareData ? num(compareData.totals.sales) : null;
    const compareReceivables = compareData ? num(compareData.receivables) : null;

    const pctDelta = (curr: number, prev: number | null) => {
      if (prev == null) return undefined;
      if (prev === 0) return curr === 0 ? undefined : { pct: 100, up: curr > 0 };
      const pct = ((curr - prev) / Math.abs(prev)) * 100;
      return { pct: Math.round(pct), up: pct >= 0 };
    };

    return [
      {
        label: 'Sales', accent: '#00E676', icon: <TrendingUpIcon fontSize="small" />,
        value: formatMoney(sales, { short: true }),
        hint: `${data.tables.recent_invoices.length}+ invoices in window`,
        delta: pctDelta(sales, compareSales),
        href: '/reports?report=sale_register',
      },
      {
        label: 'Purchases', accent: '#4FC3F7', icon: <ArrowOutwardIcon fontSize="small" />,
        value: formatMoney(purchases, { short: true }),
        hint: 'goods + services',
        href: '/reports?report=purchase_register',
      },
      {
        label: 'Receivables', accent: '#FFB300', icon: <ReceiptLongIcon fontSize="small" />,
        value: formatMoney(receivables, { short: true }),
        hint: `${data.tables.outstanding_parties.length} parties owe`,
        delta: pctDelta(receivables, compareReceivables),
        href: '/reports?report=party_outstanding',
      },
      {
        label: 'GST payable', accent: '#FF5252', icon: <AccountBalanceIcon fontSize="small" />,
        value: formatMoney(num(gstKpi?.value), { short: true }),
        hint: 'output − input',
        href: '/reports?report=gst_summary',
      },
    ];
  }, [data, compareData]);

  const salesTrendData = useMemo(
    () => (data?.charts?.sales_trend || []).map((p) => ({ label: p.label, value: num(p.value) })),
    [data],
  );
  const compareTrendData = useMemo(
    () => (compareData?.charts?.sales_trend || []).map((p) => ({ label: p.label, value: num(p.value) })),
    [compareData],
  );

  const paymentSplit = useMemo(
    () => (data?.charts?.payment_split || [])
      .map((p) => ({ label: p.label, value: num(p.value) }))
      .filter((p) => p.value > 0),
    [data],
  );
  const paymentsTotal = paymentSplit.reduce((acc, p) => acc + p.value, 0);

  if (loading && !data) {
    return (
      <Stack spacing={2}>
        <Grid container spacing={1.5}>
          {[0, 1, 2, 3].map((i) =>
            <Grid item xs={6} md={3} key={i}><Skeleton variant="rounded" height={110} /></Grid>
          )}
        </Grid>
        <Skeleton variant="rounded" height={220} />
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={220} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={220} /></Grid>
        </Grid>
      </Stack>
    );
  }

  if (err) return <Alert severity="error">{err}</Alert>;
  if (!data) return null;

  return (
    <Stack spacing={2}>
      {/* KPI hero strip */}
      <Grid container spacing={1.5}>
        {kpis.map((k, i) => (
          <Grid item xs={6} md={3} key={k.label}>
            <StatCard
              label={k.label} value={k.value} accent={k.accent}
              icon={k.icon} hint={k.hint}
              delta={k.delta ? {
                pct: Math.abs(k.delta.pct), up: k.delta.up,
                period: 'vs last',
              } : undefined}
              cta={{ label: 'View report', href: k.href }}
              index={i}
            />
          </Grid>
        ))}
      </Grid>

      {/* Sales trend */}
      <Paper sx={{ p: 2 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
          <Box>
            <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Sales trend</Typography>
            <Typography variant="caption" color="text.secondary">
              {dayjs(range.from).format('DD MMM')} – {dayjs(range.to).format('DD MMM')}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="caption" color="text.secondary">vs previous period</Typography>
            <Switch size="small" checked={compareOn} onChange={(e) => setCompareOn(e.target.checked)} />
          </Stack>
        </Stack>
        <LineChart data={salesTrendData} compareData={compareOn ? compareTrendData : undefined} height={180} />
        {compareOn && compareData && (
          <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
            <LegendDot color="primary" label={`This period · ${formatMoney(num(data.totals.sales), { short: true })}`} />
            <LegendDot color="muted" label={`Previous · ${formatMoney(num(compareData.totals.sales), { short: true })}`} dashed />
          </Stack>
        )}
      </Paper>

      {/* Payment split + Top outstanding */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 1.5 }}>
              Payment mix
            </Typography>
            <DonutChart
              data={paymentSplit}
              size={150}
              centerLabel="collected"
              centerValue={formatMoney(paymentsTotal, { short: true })}
            />
          </Paper>
        </Grid>
        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Top outstanding</Typography>
              <Button size="small" onClick={() => onPickReport('party_outstanding')}>
                Full report →
              </Button>
            </Stack>
            <HBarChart
              color="#FFB300"
              rows={data.tables.outstanding_parties.slice(0, 5).map((p: any) => ({
                label: p.party,
                value: Math.abs(num(p.balance)),
                sublabel: p.phone || p.type,
              }))}
            />
          </Paper>
        </Grid>
      </Grid>

      {/* Low stock + recent invoices */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Low stock</Typography>
              <Button size="small" onClick={() => onPickReport('low_stock')}>
                Full report →
              </Button>
            </Stack>
            {data.tables.low_stock.length === 0 ? (
              <Stack direction="row" spacing={1} alignItems="center" sx={{ color: 'text.secondary' }}>
                <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#00E676' }} />
                <Typography variant="body2">All items above reorder level.</Typography>
              </Stack>
            ) : (
              <Stack divider={<Divider />}>
                {data.tables.low_stock.slice(0, 6).map((it: any) => (
                  <Stack key={it.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                        {it.name}
                      </Typography>
                      <Typography variant="caption" sx={{ fontFamily: '"IBM Plex Mono", monospace', color: 'text.secondary' }}>
                        {it.sku}
                      </Typography>
                    </Box>
                    <Chip size="small" label={`${num(it.stock).toLocaleString()} left`}
                      sx={{
                        height: 22, fontSize: 11, fontWeight: 700,
                        color: '#FFB300',
                        bgcolor: (t) => alpha('#FFB300', t.palette.mode === 'dark' ? 0.2 : 0.12),
                        border: (t) => `1px solid ${alpha('#FFB300', t.palette.mode === 'dark' ? 0.4 : 0.32)}`,
                      }} />
                  </Stack>
                ))}
              </Stack>
            )}
          </Paper>
        </Grid>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2, height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1.5 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>Recent invoices</Typography>
              <Button size="small" onClick={() => onPickReport('sale_register')}>
                Sale register →
              </Button>
            </Stack>
            <Stack divider={<Divider />}>
              {data.tables.recent_invoices.slice(0, 6).map((inv: any) => (
                <Stack key={inv.id} direction="row" justifyContent="space-between" alignItems="center" sx={{ py: 0.75 }}>
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2"
                      sx={{ fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }} noWrap>
                      {inv.number}
                    </Typography>
                    <Typography variant="caption" color="text.secondary" noWrap>
                      {dayjs(inv.date).format('DD MMM')} · {inv.party}
                    </Typography>
                  </Box>
                  <Stack alignItems="flex-end">
                    <MoneyDisplay value={num(inv.amount)} sx={{ fontWeight: 700 }} fractionDigits={0} />
                    <Tooltip title={`Status: ${inv.status}`}>
                      <IconButton size="small" sx={{ p: 0 }} onClick={() => nav(`/sales/invoices?id=${inv.id}`)}>
                        <Box sx={{
                          width: 7, height: 7, borderRadius: '50%',
                          bgcolor: inv.status === 'paid' ? '#00E676'
                            : inv.status === 'partial' ? '#4FC3F7'
                            : '#FFB300',
                        }} />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </Stack>
              ))}
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Stack>
  );
}

function LegendDot({ color, label, dashed }: { color: 'primary' | 'muted'; label: string; dashed?: boolean }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{
        width: dashed ? 14 : 10, height: dashed ? 0 : 10,
        borderRadius: dashed ? 0 : '50%',
        bgcolor: dashed ? 'transparent' : (color === 'primary' ? 'primary.main' : 'text.disabled'),
        borderTop: dashed ? '2px dashed' : 'none',
        borderColor: 'text.disabled',
      }} />
      <Typography variant="caption" color="text.secondary">{label}</Typography>
    </Stack>
  );
}
