import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, Grid, IconButton,
  LinearProgress, MenuItem, Skeleton, Stack, TextField, Tooltip,
  Typography, alpha,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import { api } from '@/app/api';
import FirstRunChecklist from '@/features/onboarding/FirstRunChecklist';

import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import CheckCircleOutlineOutlinedIcon from '@mui/icons-material/CheckCircleOutlineOutlined';
import BoltOutlinedIcon from '@mui/icons-material/BoltOutlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import GroupOutlinedIcon from '@mui/icons-material/GroupOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';

// ---------------------------------------------------------------------------
// Animations
// ---------------------------------------------------------------------------

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;
const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50%      { opacity: 0.55; }
`;

// ---------------------------------------------------------------------------
// API types (preserved from prior dashboard contract)
// ---------------------------------------------------------------------------

type Kpi = { group: string; label: string; value: string | number; format: 'money' | 'number'; href?: string };
type ChartPoint = { label: string; value: string | number; count?: number };
type StorePoint = { branch_id: string; branch: string; code: string; sales: string; invoices: number };
type RecentInvoice = { id: string; number: string; date: string; party: string; amount: string; status: string };
type LowStock = { id: string; sku: string; name: string; stock: string; purchase_price: string };
type Outstanding = { id: string; party: string; type: string; balance: string; phone: string };

type DashboardData = {
  mode: 'ho' | 'retail';
  branch: { id: string | null; code: string; name: string };
  period: { from: string; to: string };
  last_updated: string;
  kpis: Kpi[];
  charts: {
    sales_trend: ChartPoint[];
    purchase_trend: ChartPoint[];
    store_sales: StorePoint[];
    payment_split: ChartPoint[];
  };
  tables: {
    recent_invoices: RecentInvoice[];
    low_stock: LowStock[];
    outstanding_parties: Outstanding[];
  };
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const moneyShort = (n: number) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 10000000) return '₹' + (v / 10000000).toFixed(2) + ' Cr';
  if (Math.abs(v) >= 100000) return '₹' + (v / 100000).toFixed(2) + ' L';
  if (Math.abs(v) >= 1000) return '₹' + (v / 1000).toFixed(1) + 'K';
  return '₹' + v.toFixed(0);
};
const money = (v: string | number) => '₹' + Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const num = (v: string | number) => Number(v || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

const findKpi = (kpis: Kpi[], pattern: RegExp): number => {
  const hit = kpis.find((k) => pattern.test(k.label));
  return hit ? Number(hit.value || 0) : 0;
};
const sumPoints = (points: ChartPoint[]) => points.reduce((acc, p) => acc + Number(p.value || 0), 0);

const trendDelta = (points: ChartPoint[]): { delta: number; up: boolean } => {
  if (!points || points.length < 2) return { delta: 0, up: true };
  const half = Math.floor(points.length / 2);
  const prev = points.slice(0, half).reduce((a, p) => a + Number(p.value || 0), 0);
  const curr = points.slice(half).reduce((a, p) => a + Number(p.value || 0), 0);
  if (prev === 0) return { delta: curr > 0 ? 100 : 0, up: curr >= 0 };
  const d = ((curr - prev) / prev) * 100;
  return { delta: Math.round(Math.abs(d) * 10) / 10, up: d >= 0 };
};

// ---------------------------------------------------------------------------
// Sparkline (smooth SVG path with gradient stroke + fill)
// ---------------------------------------------------------------------------

function Sparkline({ data, color, height = 44 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return <Box sx={{ height }} />;
  const w = 120;
  const h = height;
  const pad = 2;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const dx = (w - pad * 2) / Math.max(1, data.length - 1);
  const points = data.map((v, i) => [pad + i * dx, h - pad - ((v - min) / range) * (h - pad * 2)] as const);
  const path =
    'M' +
    points
      .map(([x, y], i) => {
        if (i === 0) return `${x},${y}`;
        const [px, py] = points[i - 1];
        const cx1 = px + (x - px) / 2;
        const cy1 = py;
        const cx2 = px + (x - px) / 2;
        const cy2 = y;
        return `C${cx1},${cy1} ${cx2},${cy2} ${x},${y}`;
      })
      .join(' ');
  const fillPath = `${path} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  const id = `spark-${color.replace('#', '')}`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.45" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hero KPI card
// ---------------------------------------------------------------------------

type HeroKpi = {
  label: string;
  value: string;
  delta?: { pct: number; up: boolean; period?: string };
  spark?: number[];
  color: string;            // accent color (sparkline + glow)
  icon: ReactNode;
  cta?: { label: string; href: string };
  emphasis?: 'positive' | 'attention' | 'neutral';
};

function HeroCard({ k, index }: { k: HeroKpi; index: number }) {
  const nav = useNavigate();
  return (
    <Box
      onClick={() => k.cta && nav(k.cta.href)}
      role={k.cta ? 'button' : undefined}
      sx={{
        position: 'relative',
        height: '100%',
        p: 2.25,
        borderRadius: 2,
        cursor: k.cta ? 'pointer' : 'default',
        overflow: 'hidden',
        background: (t) => t.palette.mode === 'dark'
          ? `linear-gradient(180deg, ${alpha(k.color, 0.10)} 0%, rgba(255,255,255,0.02) 100%)`
          : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha(k.color, 0.22) : 'rgba(15,23,42,0.08)'}`,
        boxShadow: (t) => t.palette.mode === 'dark'
          ? `0 0 0 1px ${alpha(k.color, 0.06)} inset, 0 18px 48px ${alpha(k.color, 0.10)}`
          : '0 4px 14px rgba(15,23,42,0.06)',
        transition: 'transform .25s ease, border-color .25s ease, box-shadow .25s ease',
        animation: `${fadeUp} .5s ease-out ${index * 0.06}s both`,
        '&:hover': k.cta ? {
          transform: 'translateY(-3px)',
          borderColor: alpha(k.color, 0.55),
          boxShadow: (t) => t.palette.mode === 'dark'
            ? `0 22px 60px ${alpha(k.color, 0.20)}, 0 0 0 1px ${alpha(k.color, 0.18)} inset`
            : `0 14px 36px ${alpha(k.color, 0.18)}`,
        } : {},
      }}
    >
      {/* corner glow */}
      <Box aria-hidden sx={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        borderRadius: '50%', filter: 'blur(48px)', opacity: 0.35, pointerEvents: 'none',
        background: `radial-gradient(closest-side, ${k.color}, transparent)`,
      }} />

      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center',
          color: '#fff',
          background: `linear-gradient(135deg, ${k.color}, ${alpha(k.color, 0.6)})`,
          boxShadow: `0 6px 16px ${alpha(k.color, 0.45)}`,
        }}>
          {k.icon}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {k.label}
        </Typography>
      </Stack>

      <Typography sx={{
        fontSize: { xs: 26, md: 32 }, fontWeight: 800, lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5,
      }}>
        {k.value}
      </Typography>

      {k.delta && (
        <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.75 }}>
          {k.delta.up
            ? <TrendingUpOutlinedIcon sx={{ fontSize: 16, color: '#00E676' }} />
            : <TrendingDownOutlinedIcon sx={{ fontSize: 16, color: '#FF5252' }} />}
          <Typography variant="caption" sx={{ color: k.delta.up ? '#00E676' : '#FF5252', fontWeight: 700 }}>
            {k.delta.up ? '+' : '−'}{k.delta.pct}%
          </Typography>
          <Typography variant="caption" color="text.secondary">{k.delta.period || 'vs prev'}</Typography>
        </Stack>
      )}

      {k.spark && (
        <Box sx={{ mt: 1.5, mx: -0.5 }}>
          <Sparkline data={k.spark} color={k.color} />
        </Box>
      )}

      {k.cta && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.25, color: k.color, fontWeight: 700, fontSize: 13 }}>
          <span>{k.cta.label}</span>
          <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </Stack>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Insight bar
// ---------------------------------------------------------------------------

type Insight = { tone: 'positive' | 'attention' | 'warning' | 'info'; text: string; href?: string; icon: ReactNode };

const TONE_COLORS: Record<Insight['tone'], string> = {
  positive: '#00E676', attention: '#FFB300', warning: '#FF5252', info: '#4FC3F7',
};

function InsightBar({ items }: { items: Insight[] }) {
  const nav = useNavigate();
  if (!items.length) return null;
  return (
    <Box sx={{
      display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5,
      '&::-webkit-scrollbar': { height: 0 },
    }}>
      {items.map((it, i) => (
        <Box
          key={i}
          onClick={() => it.href && nav(it.href)}
          sx={{
            flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1,
            px: 1.5, py: 1, borderRadius: 999,
            cursor: it.href ? 'pointer' : 'default',
            background: (t) => t.palette.mode === 'dark'
              ? alpha(TONE_COLORS[it.tone], 0.10)
              : alpha(TONE_COLORS[it.tone], 0.12),
            border: `1px solid ${alpha(TONE_COLORS[it.tone], 0.35)}`,
            color: 'text.primary',
            transition: 'transform .2s ease, background .2s ease',
            animation: `${fadeUp} .4s ease-out ${i * 0.05}s both`,
            '&:hover': it.href ? { transform: 'translateY(-1px)', background: (t) => t.palette.mode === 'dark' ? alpha(TONE_COLORS[it.tone], 0.18) : alpha(TONE_COLORS[it.tone], 0.18) } : {},
          }}
        >
          <Box sx={{ color: TONE_COLORS[it.tone], display: 'inline-flex' }}>{it.icon}</Box>
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{it.text}</Typography>
          {it.href && <ArrowForwardIcon sx={{ fontSize: 14, color: TONE_COLORS[it.tone] }} />}
        </Box>
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Trend dual-area chart (Sales vs Purchase)
// ---------------------------------------------------------------------------

function DualAreaChart({ a, b, labelA, labelB, colorA, colorB }: {
  a: ChartPoint[]; b: ChartPoint[]; labelA: string; labelB: string; colorA: string; colorB: string;
}) {
  const buckets = Math.max(a.length, b.length);
  if (!buckets) return <EmptyMini text="No trend data yet" />;
  const w = 600; const h = 200; const pad = 12;
  const series = [a, b].map((s) => Array.from({ length: buckets }).map((_, i) => Number(s[i]?.value || 0)));
  const max = Math.max(...series.flat(), 1);
  const dx = (w - pad * 2) / Math.max(1, buckets - 1);

  const buildPath = (vals: number[]) => {
    const pts = vals.map((v, i) => [pad + i * dx, h - pad - (v / max) * (h - pad * 2)] as const);
    const line = 'M' + pts.map(([x, y], i) => {
      if (i === 0) return `${x},${y}`;
      const [px, py] = pts[i - 1];
      const cx1 = px + (x - px) / 2; const cx2 = cx1;
      return `C${cx1},${py} ${cx2},${y} ${x},${y}`;
    }).join(' ');
    const fill = `${line} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
    return { line, fill };
  };
  const A = buildPath(series[0]);
  const B = buildPath(series[1]);

  return (
    <Box sx={{ position: 'relative' }}>
      <Stack direction="row" spacing={2} sx={{ mb: 1.5 }}>
        <LegendDot color={colorA} label={labelA} />
        <LegendDot color={colorB} label={labelB} />
      </Stack>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: 200, display: 'block' }}>
        <defs>
          <linearGradient id="grad-a" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorA} stopOpacity="0.35" />
            <stop offset="100%" stopColor={colorA} stopOpacity="0" />
          </linearGradient>
          <linearGradient id="grad-b" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colorB} stopOpacity="0.30" />
            <stop offset="100%" stopColor={colorB} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* faint baseline */}
        {[0.25, 0.5, 0.75].map((p) => (
          <line key={p} x1={pad} x2={w - pad} y1={pad + (h - pad * 2) * p} y2={pad + (h - pad * 2) * p}
            stroke="currentColor" strokeOpacity="0.06" strokeDasharray="2 4" />
        ))}
        <path d={A.fill} fill="url(#grad-a)" />
        <path d={B.fill} fill="url(#grad-b)" />
        <path d={A.line} fill="none" stroke={colorA} strokeWidth={2} strokeLinecap="round" />
        <path d={B.line} fill="none" stroke={colorB} strokeWidth={2} strokeLinecap="round" />
      </svg>
    </Box>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: color, boxShadow: `0 0 12px ${color}` }} />
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Bar list (Top customers / Payment split)
// ---------------------------------------------------------------------------

function BarList({ rows, accent, money: moneyMode = true }: { rows: ChartPoint[]; accent: string; money?: boolean }) {
  if (!rows.length) return <EmptyMini text="No data yet" />;
  const max = Math.max(...rows.map((r) => Number(r.value || 0)), 1);
  return (
    <Stack spacing={1.25}>
      {rows.slice(0, 5).map((r, i) => {
        const v = Number(r.value || 0);
        return (
          <Box key={r.label + i} sx={{ animation: `${fadeUp} .4s ease-out ${i * 0.04}s both` }}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>{r.label}</Typography>
              <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {moneyMode ? moneyShort(v) : num(v)}
              </Typography>
            </Stack>
            <Box sx={{ height: 8, borderRadius: 999, bgcolor: (t) => alpha(t.palette.divider, 0.4), overflow: 'hidden' }}>
              <Box sx={{
                height: '100%', width: `${Math.max(2, (v / max) * 100)}%`,
                background: `linear-gradient(90deg, ${accent}, ${alpha(accent, 0.5)})`,
                boxShadow: `0 0 12px ${alpha(accent, 0.7)}`,
                transition: 'width .4s ease',
              }} />
            </Box>
          </Box>
        );
      })}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ icon, title, body, ctaLabel, ctaHref }: {
  icon: ReactNode; title: string; body: string; ctaLabel?: string; ctaHref?: string;
}) {
  const nav = useNavigate();
  return (
    <Stack alignItems="center" spacing={1.25} sx={{ py: 4, textAlign: 'center' }}>
      <Box sx={{
        width: 56, height: 56, borderRadius: 2, display: 'grid', placeItems: 'center',
        color: '#4FC3F7',
        background: (t) => t.palette.mode === 'dark'
          ? 'linear-gradient(135deg, rgba(79,195,247,0.18), rgba(79,195,247,0.04))'
          : 'rgba(79,195,247,0.10)',
        border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(79,195,247,0.32)' : 'rgba(79,195,247,0.25)'}`,
      }}>
        {icon}
      </Box>
      <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 280 }}>{body}</Typography>
      {ctaLabel && ctaHref && (
        <Button size="small" variant="contained" onClick={() => nav(ctaHref)} sx={{ mt: 0.5 }}>
          {ctaLabel}
        </Button>
      )}
    </Stack>
  );
}

function EmptyMini({ text }: { text: string }) {
  return (
    <Stack alignItems="center" sx={{ py: 3 }}>
      <Typography variant="body2" color="text.secondary">{text}</Typography>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Quick-actions panel
// ---------------------------------------------------------------------------

const QUICK_ACTIONS: { label: string; href: string; icon: ReactNode; tone: string }[] = [
  { label: 'Create Invoice', href: '/sales/invoices/new', icon: <ReceiptLongOutlinedIcon />, tone: '#00E676' },
  { label: 'Record Payment', href: '/payments?new=1', icon: <PaymentsOutlinedIcon />, tone: '#4FC3F7' },
  { label: 'Add Expense', href: '/expenses?new=1', icon: <LocalMallOutlinedIcon />, tone: '#B388FF' },
  { label: 'New Party', href: '/parties?new=1', icon: <GroupOutlinedIcon />, tone: '#FFB300' },
];

function QuickActionsPanel() {
  const nav = useNavigate();
  return (
    <Stack spacing={1}>
      <Typography variant="subtitle2" sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.6, mb: 0.5 }}>
        Quick actions
      </Typography>
      {QUICK_ACTIONS.map((a, i) => (
        <Button
          key={a.href}
          onClick={() => nav(a.href)}
          startIcon={<Box sx={{ color: a.tone, display: 'inline-flex' }}>{a.icon}</Box>}
          fullWidth
          sx={{
            justifyContent: 'flex-start',
            px: 1.5, py: 1, borderRadius: 1.5,
            background: (t) => t.palette.mode === 'dark' ? alpha(a.tone, 0.06) : alpha(a.tone, 0.08),
            border: (t) => `1px solid ${alpha(a.tone, 0.20)}`,
            color: 'text.primary',
            fontWeight: 600,
            animation: `${fadeUp} .4s ease-out ${i * 0.05}s both`,
            '&:hover': {
              background: (t) => alpha(a.tone, t.palette.mode === 'dark' ? 0.14 : 0.16),
              borderColor: alpha(a.tone, 0.45),
            },
          }}
        >
          {a.label}
        </Button>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Activity timeline
// ---------------------------------------------------------------------------

type Activity = { id: string; icon: ReactNode; tone: string; title: string; meta: string; href?: string };

function ActivityTimeline({ items }: { items: Activity[] }) {
  const nav = useNavigate();
  if (!items.length) {
    return (
      <EmptyState
        icon={<RocketLaunchOutlinedIcon />}
        title="No activity yet"
        body="Once invoices, payments and bills start flowing, the live timeline lights up here."
        ctaLabel="Create your first invoice"
        ctaHref="/sales/invoices/new"
      />
    );
  }
  return (
    <Stack spacing={1.5}>
      {items.map((a, i) => (
        <Box key={a.id} onClick={() => a.href && nav(a.href)}
          sx={{
            position: 'relative', pl: 4, py: 0.5, cursor: a.href ? 'pointer' : 'default',
            animation: `${fadeUp} .4s ease-out ${i * 0.04}s both`,
            '&:hover': a.href ? { '& .row': { color: a.tone } } : {},
          }}
        >
          <Box sx={{ position: 'absolute', left: '11px', top: '18px', bottom: '-10px', width: '1px', bgcolor: 'divider' }} />
          <Box sx={{
            position: 'absolute', left: 0, top: 4, width: 22, height: 22, borderRadius: '50%',
            display: 'grid', placeItems: 'center', color: '#fff',
            background: `linear-gradient(135deg, ${a.tone}, ${alpha(a.tone, 0.6)})`,
            boxShadow: `0 0 12px ${alpha(a.tone, 0.55)}`,
          }}>
            {a.icon}
          </Box>
          <Typography className="row" variant="body2" sx={{ fontWeight: 600, transition: 'color .2s' }}>{a.title}</Typography>
          <Typography variant="caption" color="text.secondary">{a.meta}</Typography>
        </Box>
      ))}
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Section card (glass panel wrapper)
// ---------------------------------------------------------------------------

function Panel({ title, action, children, minHeight }: { title: string; action?: ReactNode; children: ReactNode; minHeight?: number }) {
  return (
    <Box sx={{
      height: '100%', minHeight, p: 2, borderRadius: 2,
      background: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.7)',
      backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)',
      border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(15,23,42,0.06)'}`,
    }}>
      <Stack direction="row" alignItems="center" sx={{ mb: 1.5 }}>
        <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>{title}</Typography>
        <Box sx={{ flex: 1 }} />
        {action}
      </Stack>
      {children}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Skeleton hero strip while loading
// ---------------------------------------------------------------------------

function HeroSkeleton() {
  return (
    <Grid container spacing={2}>
      {[0, 1, 2, 3].map((i) => (
        <Grid item xs={12} sm={6} md={3} key={i}>
          <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', animation: `${pulse} 1.6s ease-in-out infinite` }}>
            <Skeleton variant="rounded" width={36} height={36} sx={{ mb: 1.5 }} />
            <Skeleton width="70%" height={32} />
            <Skeleton width="40%" height={20} />
            <Skeleton variant="rounded" height={44} sx={{ mt: 1.5 }} />
          </Box>
        </Grid>
      ))}
    </Grid>
  );
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const nav = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [range, setRange] = useState({
    from: dayjs().startOf('month').format('YYYY-MM-DD'),
    to: dayjs().format('YYYY-MM-DD'),
  });

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const { data: payload } = await api.get('/reports/dashboard/', {
        params: { date_from: range.from, date_to: range.to },
      });
      setData(payload);
    } catch (e: any) {
      const detail = e?.response?.data?.detail;
      setErr(detail || e?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60000);
    return () => window.clearInterval(t);
  }, [range.from, range.to]);

  // Derive hero KPIs from API
  const hero: HeroKpi[] = useMemo(() => {
    const k = data?.kpis || [];
    const sales = sumPoints(data?.charts.sales_trend || []);
    const purchases = sumPoints(data?.charts.purchase_trend || []);
    const receivables = findKpi(k, /outstanding|receivable/i)
      || (data?.tables.outstanding_parties || []).reduce((a, p) => a + Number(p.balance || 0), 0);
    const cash = findKpi(k, /cash|bank|balance/i);
    const profit = sales - purchases;
    const profitDelta = trendDelta((data?.charts.sales_trend || []).map((p, i) => ({
      label: p.label, value: Number(p.value || 0) - Number(data?.charts.purchase_trend?.[i]?.value || 0),
    })));
    const salesDelta = trendDelta(data?.charts.sales_trend || []);

    return [
      {
        label: 'Total Revenue', value: moneyShort(sales),
        delta: { pct: salesDelta.delta, up: salesDelta.up, period: 'this period' },
        spark: (data?.charts.sales_trend || []).map((p) => Number(p.value || 0)),
        color: '#00E676',
        icon: <ReceiptLongOutlinedIcon fontSize="small" />,
        emphasis: 'positive',
      },
      {
        label: 'Receivables', value: moneyShort(receivables),
        spark: (data?.tables.outstanding_parties || []).map((p) => Number(p.balance || 0)),
        color: '#FFB300',
        icon: <HourglassBottomOutlinedIcon fontSize="small" />,
        cta: receivables > 0 ? { label: 'Collect now', href: '/payments?new=1' } : undefined,
        emphasis: 'attention',
      },
      {
        label: 'Cash in bank', value: moneyShort(cash),
        spark: undefined,
        color: '#4FC3F7',
        icon: <AccountBalanceWalletOutlinedIcon fontSize="small" />,
        emphasis: 'neutral',
      },
      {
        label: 'Net Profit', value: moneyShort(profit),
        delta: { pct: profitDelta.delta, up: profit >= 0 && profitDelta.up },
        spark: (data?.charts.sales_trend || []).map((p, i) =>
          Number(p.value || 0) - Number(data?.charts.purchase_trend?.[i]?.value || 0)),
        color: profit >= 0 ? '#00E676' : '#FF5252',
        icon: profit >= 0 ? <TrendingUpOutlinedIcon fontSize="small" /> : <TrendingDownOutlinedIcon fontSize="small" />,
        emphasis: profit >= 0 ? 'positive' : 'attention',
      },
    ];
  }, [data]);

  // Smart insights
  const insights: Insight[] = useMemo(() => {
    if (!data) return [];
    const out: Insight[] = [];
    const overdue = data.tables.outstanding_parties || [];
    const overdueTotal = overdue.reduce((a, p) => a + Number(p.balance || 0), 0);
    if (overdueTotal > 0) {
      out.push({
        tone: 'warning',
        text: `${moneyShort(overdueTotal)} outstanding · ${overdue.length} parties`,
        href: '/payments?new=1',
        icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 16 }} />,
      });
    }
    if ((data.tables.low_stock || []).length > 0) {
      out.push({
        tone: 'attention',
        text: `${data.tables.low_stock.length} items low in stock`,
        href: '/inventory',
        icon: <WarningAmberOutlinedIcon sx={{ fontSize: 16 }} />,
      });
    }
    const salesDelta = trendDelta(data.charts.sales_trend || []);
    if (Math.abs(salesDelta.delta) >= 10 && (data.charts.sales_trend || []).length >= 4) {
      out.push({
        tone: salesDelta.up ? 'positive' : 'warning',
        text: `Sales ${salesDelta.up ? 'up' : 'down'} ${salesDelta.delta}% vs prior window`,
        href: '/reports',
        icon: salesDelta.up
          ? <TrendingUpOutlinedIcon sx={{ fontSize: 16 }} />
          : <TrendingDownOutlinedIcon sx={{ fontSize: 16 }} />,
      });
    }
    if (out.length === 0) {
      out.push({
        tone: 'positive', text: 'All caught up — no alerts right now',
        icon: <CheckCircleOutlineOutlinedIcon sx={{ fontSize: 16 }} />,
      });
    }
    return out;
  }, [data]);

  // Top customers from outstanding_parties (descending by balance)
  const topCustomers: ChartPoint[] = useMemo(() => {
    return (data?.tables.outstanding_parties || [])
      .map((p) => ({ label: p.party, value: p.balance }))
      .sort((a, b) => Number(b.value) - Number(a.value))
      .slice(0, 5);
  }, [data]);

  // Activity feed from recent invoices + low stock
  const activity: Activity[] = useMemo(() => {
    const inv = (data?.tables.recent_invoices || []).slice(0, 4).map<Activity>((r) => ({
      id: 'inv-' + r.id,
      icon: <ReceiptLongOutlinedIcon sx={{ fontSize: 14 }} />,
      tone: r.status === 'paid' ? '#00E676' : '#4FC3F7',
      title: `Invoice ${r.number} → ${r.party}`,
      meta: `${money(r.amount)} · ${dayjs(r.date).format('DD MMM')}`,
      href: `/sales/invoices/${r.id}`,
    }));
    const low = (data?.tables.low_stock || []).slice(0, 2).map<Activity>((r) => ({
      id: 'low-' + r.id,
      icon: <WarningAmberOutlinedIcon sx={{ fontSize: 14 }} />,
      tone: '#FFB300',
      title: `Low stock — ${r.name}`,
      meta: `${num(r.stock)} units left · ${r.sku}`,
      href: '/inventory',
    }));
    return [...inv, ...low];
  }, [data]);

  const period = data
    ? `${dayjs(data.period.from).format('DD MMM')} – ${dayjs(data.period.to).format('DD MMM')}`
    : '';

  return (
    <Box>
      <FirstRunChecklist />

      {/* Header row */}
      <Stack
        direction={{ xs: 'column', md: 'row' }}
        spacing={2}
        alignItems={{ xs: 'stretch', md: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Box>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
              Business Control Center
            </Typography>
            {data && (
              <Chip size="small" label={data.branch.code + ' · ' + data.branch.name}
                sx={{
                  ml: 0.5,
                  background: (t) => t.palette.mode === 'dark' ? 'rgba(79,195,247,0.10)' : 'rgba(79,195,247,0.18)',
                  color: '#4FC3F7', border: '1px solid rgba(79,195,247,0.30)',
                }}
              />
            )}
          </Stack>
          <Typography variant="body2" color="text.secondary">
            {data?.last_updated ? `${period} · last updated ${data.last_updated}` : 'Loading insights…'}
          </Typography>
        </Box>

        <Stack direction="row" spacing={1}>
          <TextField
            select size="small" label="Range"
            value="custom"
            onChange={(e) => {
              const today = dayjs(); const v = e.target.value;
              if (v === 'today') setRange({ from: today.format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD') });
              if (v === 'month') setRange({ from: today.startOf('month').format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD') });
              if (v === 'quarter') setRange({ from: today.subtract(90, 'day').format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD') });
              if (v === 'year') setRange({ from: today.subtract(365, 'day').format('YYYY-MM-DD'), to: today.format('YYYY-MM-DD') });
            }}
            sx={{ minWidth: 130 }}
          >
            <MenuItem value="today">Today</MenuItem>
            <MenuItem value="month">This Month</MenuItem>
            <MenuItem value="quarter">Last 90 Days</MenuItem>
            <MenuItem value="year">Last 365 Days</MenuItem>
            <MenuItem value="custom" sx={{ display: 'none' }}>Custom</MenuItem>
          </TextField>
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }}
            value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }}
            value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          <Tooltip title="Refresh">
            <IconButton onClick={load}><RefreshIcon /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>

      {loading && !data && <LinearProgress sx={{ mb: 2 }} />}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      {/* Insight bar */}
      <Box sx={{ mb: 2.5 }}>
        <InsightBar items={insights} />
      </Box>

      {/* Hero KPI strip */}
      {!data ? (
        <HeroSkeleton />
      ) : (
        <Grid container spacing={2}>
          {hero.map((k, i) => (
            <Grid item xs={12} sm={6} md={3} key={k.label}>
              <HeroCard k={k} index={i} />
            </Grid>
          ))}
        </Grid>
      )}

      {/* Charts + actions */}
      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} md={8}>
          <Panel title="Sales vs Purchases" action={
            <Chip size="small" icon={<BoltOutlinedIcon sx={{ fontSize: 14 }} />} label="Live"
              sx={{ background: 'rgba(0,230,118,0.10)', color: '#00E676', border: '1px solid rgba(0,230,118,0.32)' }}
            />
          }>
            <DualAreaChart
              a={data?.charts.sales_trend || []}
              b={data?.charts.purchase_trend || []}
              labelA="Sales" labelB="Purchases"
              colorA="#00E676" colorB="#4FC3F7"
            />
          </Panel>
        </Grid>
        <Grid item xs={12} md={4}>
          <Panel title="Quick actions">
            <QuickActionsPanel />
          </Panel>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} md={4}>
          <Panel title="Top customers (outstanding)">
            <BarList rows={topCustomers} accent="#00E676" />
          </Panel>
        </Grid>
        <Grid item xs={12} md={4}>
          <Panel title="Payment split">
            {(data?.charts.payment_split || []).length
              ? <BarList rows={data?.charts.payment_split || []} accent="#4FC3F7" />
              : <EmptyState
                  icon={<PaymentsOutlinedIcon />}
                  title="No payments yet"
                  body="Record a payment to see how money is flowing across cash, bank and UPI."
                  ctaLabel="Record payment"
                  ctaHref="/payments?new=1"
                />
            }
          </Panel>
        </Grid>
        <Grid item xs={12} md={4}>
          <Panel title="Recent activity">
            <ActivityTimeline items={activity} />
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
