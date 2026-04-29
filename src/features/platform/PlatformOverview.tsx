import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Box, Chip, Grid, Skeleton, Stack, Typography, alpha } from '@mui/material';
import { keyframes } from '@emotion/react';
import { useNavigate } from 'react-router-dom';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import AutoGraphOutlinedIcon from '@mui/icons-material/AutoGraphOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HourglassBottomOutlinedIcon from '@mui/icons-material/HourglassBottomOutlined';
import ReportGmailerrorredOutlinedIcon from '@mui/icons-material/ReportGmailerrorredOutlined';
import RocketLaunchOutlinedIcon from '@mui/icons-material/RocketLaunchOutlined';
import PersonAddAlt1OutlinedIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import NotificationsActiveOutlinedIcon from '@mui/icons-material/NotificationsActiveOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { api } from '@/app/api';

// ---------------------------------------------------------------------------
// Types + helpers
// ---------------------------------------------------------------------------

type Overview = {
  mrr_paise: number; mrr_annualised_paise: number;
  active_subscriptions: number; trial_subscriptions: number;
  trials_ending_7d: number; past_due_count: number;
  signups_30d: number; cancelled_30d: number; churn_pct_30d: number;
  mrr_series: { month: string; amount_paise: number }[];
  signups_daily: { day: string; count: number }[];
  updated_at: string;
};

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

const fmtINR = (paise: number) => {
  const r = Math.round(paise / 100);
  if (r >= 10000000) return `₹${(r / 10000000).toFixed(2)} Cr`;
  if (r >= 100000) return `₹${(r / 100000).toFixed(2)} L`;
  if (r >= 1000) return `₹${(r / 1000).toFixed(1)}K`;
  return `₹${r.toLocaleString('en-IN')}`;
};

const fmtINRFull = (paise: number) => `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;

const trendDelta = (points: number[]): { delta: number; up: boolean } => {
  if (!points || points.length < 2) return { delta: 0, up: true };
  const half = Math.floor(points.length / 2);
  const prev = points.slice(0, half).reduce((a, n) => a + n, 0);
  const curr = points.slice(half).reduce((a, n) => a + n, 0);
  if (prev === 0) return { delta: curr > 0 ? 100 : 0, up: curr >= 0 };
  const d = ((curr - prev) / prev) * 100;
  return { delta: Math.round(Math.abs(d) * 10) / 10, up: d >= 0 };
};

// ---------------------------------------------------------------------------
// Sparkline (smooth cubic, gradient fill)
// ---------------------------------------------------------------------------

function Sparkline({ data, color, height = 56 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return <Box sx={{ height }} />;
  const w = 200; const h = height; const pad = 3;
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const dx = (w - pad * 2) / Math.max(1, data.length - 1);
  const pts = data.map((v, i) => [pad + i * dx, h - pad - ((v - min) / range) * (h - pad * 2)] as const);
  const path = 'M' + pts.map(([x, y], i) => {
    if (i === 0) return `${x},${y}`;
    const [px, py] = pts[i - 1];
    const cx = px + (x - px) / 2;
    return `C${cx},${py} ${cx},${y} ${x},${y}`;
  }).join(' ');
  const fill = `${path} L${w - pad},${h - pad} L${pad},${h - pad} Z`;
  const id = `pf-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.5} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Hero KPI
// ---------------------------------------------------------------------------

type Hero = {
  label: string; value: string; hint?: string;
  delta?: { pct: number; up: boolean; period?: string };
  spark?: number[]; color: string; icon: ReactNode; href?: string;
};

function HeroCard({ k, index }: { k: Hero; index: number }) {
  const nav = useNavigate();
  return (
    <Box
      onClick={() => k.href && nav(k.href)}
      sx={{
        position: 'relative', height: '100%', p: 2.25, borderRadius: 2, overflow: 'hidden',
        cursor: k.href ? 'pointer' : 'default',
        background: (t) => t.palette.mode === 'dark'
          ? `linear-gradient(180deg, ${alpha(k.color, 0.10)} 0%, rgba(255,255,255,0.02) 100%)`
          : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        border: (t) => `1px solid ${t.palette.mode === 'dark' ? alpha(k.color, 0.22) : 'rgba(15,23,42,0.08)'}`,
        boxShadow: (t) => t.palette.mode === 'dark'
          ? `0 0 0 1px ${alpha(k.color, 0.06)} inset, 0 18px 48px ${alpha(k.color, 0.10)}`
          : '0 4px 14px rgba(15,23,42,0.06)',
        transition: 'transform .25s ease, border-color .25s ease, box-shadow .25s ease',
        animation: `${fadeUp} .5s ease-out ${index * 0.06}s both`,
        '&:hover': k.href ? {
          transform: 'translateY(-3px)',
          borderColor: alpha(k.color, 0.55),
          boxShadow: (t) => t.palette.mode === 'dark'
            ? `0 22px 60px ${alpha(k.color, 0.20)}, 0 0 0 1px ${alpha(k.color, 0.18)} inset`
            : `0 14px 36px ${alpha(k.color, 0.18)}`,
        } : {},
      }}
    >
      <Box aria-hidden sx={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        borderRadius: '50%', filter: 'blur(48px)', opacity: 0.32, pointerEvents: 'none',
        background: `radial-gradient(closest-side, ${k.color}, transparent)`,
      }} />
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25 }}>
        <Box sx={{
          width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', color: '#fff',
          background: `linear-gradient(135deg, ${k.color}, ${alpha(k.color, 0.55)})`,
          boxShadow: `0 6px 16px ${alpha(k.color, 0.45)}`,
        }}>
          {k.icon}
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
          {k.label}
        </Typography>
      </Stack>
      <Typography sx={{ fontSize: { xs: 26, md: 30 }, fontWeight: 800, lineHeight: 1.1, fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5 }}>
        {k.value}
      </Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75, minHeight: 22 }}>
        {k.delta && (
          <>
            {k.delta.up
              ? <TrendingUpOutlinedIcon sx={{ fontSize: 16, color: '#00E676' }} />
              : <TrendingDownOutlinedIcon sx={{ fontSize: 16, color: '#FF5252' }} />}
            <Typography variant="caption" sx={{ color: k.delta.up ? '#00E676' : '#FF5252', fontWeight: 700 }}>
              {k.delta.up ? '+' : '−'}{k.delta.pct}%
            </Typography>
          </>
        )}
        {k.hint && (
          <Typography variant="caption" color="text.secondary">{k.hint}</Typography>
        )}
      </Stack>
      {k.spark && (
        <Box sx={{ mt: 1.25, mx: -0.5 }}>
          <Sparkline data={k.spark} color={k.color} />
        </Box>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Insight bar
// ---------------------------------------------------------------------------

type Insight = { tone: 'positive' | 'attention' | 'warning' | 'info'; text: string; href?: string; icon: ReactNode };
const TONE: Record<Insight['tone'], string> = {
  positive: '#00E676', attention: '#FFB300', warning: '#FF5252', info: '#4FC3F7',
};

function InsightBar({ items }: { items: Insight[] }) {
  const nav = useNavigate();
  if (!items.length) return null;
  return (
    <Box sx={{ display: 'flex', gap: 1.25, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: 0 } }}>
      {items.map((it, i) => (
        <Box
          key={i}
          onClick={() => it.href && nav(it.href)}
          sx={{
            flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 1, px: 1.5, py: 1,
            borderRadius: 999,
            cursor: it.href ? 'pointer' : 'default',
            background: (t) => t.palette.mode === 'dark' ? alpha(TONE[it.tone], 0.10) : alpha(TONE[it.tone], 0.12),
            border: `1px solid ${alpha(TONE[it.tone], 0.35)}`,
            transition: 'transform .2s ease, background .2s ease',
            animation: `${fadeUp} .4s ease-out ${i * 0.05}s both`,
            '&:hover': it.href ? { transform: 'translateY(-1px)' } : {},
          }}
        >
          <Box sx={{ color: TONE[it.tone], display: 'inline-flex' }}>{it.icon}</Box>
          <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{it.text}</Typography>
          {it.href && <ArrowForwardIcon sx={{ fontSize: 14, color: TONE[it.tone] }} />}
        </Box>
      ))}
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Glass panel
// ---------------------------------------------------------------------------

function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <Box sx={{
      height: '100%', p: 2.25, borderRadius: 2,
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
// Main
// ---------------------------------------------------------------------------

export default function PlatformOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/platform/overview/').then(r => setData(r.data)).catch(e => setErr(e?.response?.data?.detail || 'Failed to load'));
  }, []);

  const mrrSeries = (data?.mrr_series ?? []).map(p => p.amount_paise);
  const signupsSeries = (data?.signups_daily ?? []).map(p => p.count);
  const mrrDelta = trendDelta(mrrSeries);
  const signupDelta = trendDelta(signupsSeries);

  const hero: Hero[] = useMemo(() => [
    {
      label: 'MRR', value: data ? fmtINR(data.mrr_paise) : '—',
      hint: data ? `ARR ${fmtINR(data.mrr_annualised_paise)}` : '',
      delta: data ? { pct: mrrDelta.delta, up: mrrDelta.up, period: 'vs prev half' } : undefined,
      spark: mrrSeries, color: '#00E676',
      icon: <CurrencyRupeeOutlinedIcon fontSize="small" />,
      href: '/platform/subscriptions',
    },
    {
      label: 'Active subs', value: data ? data.active_subscriptions.toLocaleString('en-IN') : '—',
      spark: signupsSeries, color: '#4FC3F7',
      icon: <AutoGraphOutlinedIcon fontSize="small" />,
      href: '/platform/subscriptions',
    },
    {
      label: 'Trials', value: data ? data.trial_subscriptions.toLocaleString('en-IN') : '—',
      hint: data ? `${data.trials_ending_7d} ending in 7d` : '',
      color: '#B388FF',
      icon: <RocketLaunchOutlinedIcon fontSize="small" />,
      href: '/platform/subscriptions',
    },
    {
      label: 'Past due', value: data ? data.past_due_count.toLocaleString('en-IN') : '—',
      color: data && data.past_due_count > 0 ? '#FF5252' : '#4FC3F7',
      icon: <ReportGmailerrorredOutlinedIcon fontSize="small" />,
      href: '/platform/dunning',
    },
    {
      label: 'Signups (30d)', value: data ? data.signups_30d.toLocaleString('en-IN') : '—',
      delta: data ? { pct: signupDelta.delta, up: signupDelta.up, period: 'vs prev half' } : undefined,
      spark: signupsSeries, color: '#00E676',
      icon: <PersonAddAlt1OutlinedIcon fontSize="small" />,
      href: '/platform/organizations',
    },
    {
      label: 'Churn (30d)', value: data ? `${data.churn_pct_30d}%` : '—',
      hint: data ? `${data.cancelled_30d} cancelled` : '',
      color: data && data.churn_pct_30d > 5 ? '#FF5252' : '#FFB300',
      icon: <HourglassBottomOutlinedIcon fontSize="small" />,
      href: '/platform/subscriptions',
    },
  ], [data, mrrDelta, signupDelta, mrrSeries, signupsSeries]);

  const insights: Insight[] = useMemo(() => {
    if (!data) return [];
    const out: Insight[] = [];
    if (data.past_due_count > 0) {
      out.push({ tone: 'warning', text: `${data.past_due_count} past-due subscriptions`, href: '/platform/dunning', icon: <ReportGmailerrorredOutlinedIcon sx={{ fontSize: 16 }} /> });
    }
    if (data.trials_ending_7d > 0) {
      out.push({ tone: 'attention', text: `${data.trials_ending_7d} trials end in 7 days`, href: '/platform/subscriptions', icon: <NotificationsActiveOutlinedIcon sx={{ fontSize: 16 }} /> });
    }
    if (mrrDelta.up && mrrDelta.delta >= 5) {
      out.push({ tone: 'positive', text: `MRR up ${mrrDelta.delta}% vs prior half`, href: '/platform/subscriptions', icon: <TrendingUpOutlinedIcon sx={{ fontSize: 16 }} /> });
    }
    if (data.churn_pct_30d > 5) {
      out.push({ tone: 'warning', text: `Churn at ${data.churn_pct_30d}% — review cancellations`, href: '/platform/subscriptions', icon: <TrendingDownOutlinedIcon sx={{ fontSize: 16 }} /> });
    }
    if (out.length === 0) {
      out.push({ tone: 'positive', text: 'All systems healthy — no flags', icon: <TrendingUpOutlinedIcon sx={{ fontSize: 16 }} /> });
    }
    return out;
  }, [data, mrrDelta]);

  return (
    <Box>
      {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary">
          {data ? `Updated ${new Date(data.updated_at).toLocaleString()}` : 'Loading platform metrics…'}
        </Typography>
      </Box>

      <Box sx={{ mb: 2.5 }}>
        <InsightBar items={insights} />
      </Box>

      {!data ? (
        <Grid container spacing={2}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
              <Box sx={{ p: 2, borderRadius: 2, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <Skeleton variant="rounded" width={36} height={36} sx={{ mb: 1.5 }} />
                <Skeleton width="70%" height={32} />
                <Skeleton width="40%" height={20} />
              </Box>
            </Grid>
          ))}
        </Grid>
      ) : (
        <Grid container spacing={2}>
          {hero.map((k, i) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={k.label}>
              <HeroCard k={k} index={i} />
            </Grid>
          ))}
        </Grid>
      )}

      <Grid container spacing={2} sx={{ mt: 0 }}>
        <Grid item xs={12} md={7}>
          <Panel title="MRR — last 12 months" action={
            <Chip size="small" icon={<TrendingUpOutlinedIcon sx={{ fontSize: 14 }} />}
              label={data ? `${data.mrr_series.length} months` : '—'}
              sx={{ background: 'rgba(0,230,118,0.10)', color: '#00E676', border: '1px solid rgba(0,230,118,0.32)' }}
            />
          }>
            {mrrSeries.length === 0 ? (
              <Stack alignItems="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">No revenue history yet.</Typography>
              </Stack>
            ) : (
              <>
                <Box sx={{ height: 180 }}>
                  <Sparkline data={mrrSeries} color="#00E676" height={180} />
                </Box>
                <Stack direction="row" spacing={2} sx={{ mt: 1.5, overflowX: 'auto', pb: 0.5, '&::-webkit-scrollbar': { height: 0 } }}>
                  {(data?.mrr_series ?? []).slice(-6).map(p => (
                    <Box key={p.month} sx={{ minWidth: 90, flex: '0 0 auto' }}>
                      <Typography variant="caption" color="text.secondary">{p.month}</Typography>
                      <Typography variant="body2" sx={{ fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                        {fmtINRFull(p.amount_paise)}
                      </Typography>
                    </Box>
                  ))}
                </Stack>
              </>
            )}
          </Panel>
        </Grid>
        <Grid item xs={12} md={5}>
          <Panel title="Signups — last 30 days" action={
            <Chip size="small" icon={<GroupsOutlinedIcon sx={{ fontSize: 14 }} />}
              label={data ? `${data.signups_30d} new` : '—'}
              sx={{ background: 'rgba(79,195,247,0.10)', color: '#4FC3F7', border: '1px solid rgba(79,195,247,0.32)' }}
            />
          }>
            {signupsSeries.length === 0 ? (
              <Stack alignItems="center" sx={{ py: 4 }}>
                <Typography variant="body2" color="text.secondary">No signups in the window.</Typography>
              </Stack>
            ) : (
              <>
                <Box sx={{ height: 180 }}>
                  <Sparkline data={signupsSeries} color="#4FC3F7" height={180} />
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                  Total: {data?.signups_30d ?? 0} new organizations
                </Typography>
              </>
            )}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
