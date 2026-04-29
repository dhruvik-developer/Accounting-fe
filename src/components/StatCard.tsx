/**
 * Premium stat card. Glassmorphism + accent gradient + optional sparkline +
 * delta tag + click-through CTA. Used by Dashboard, Platform overview,
 * Warehouse summary, and any module that wants to expose a hero KPI.
 *
 *   <StatCard
 *     label="Total revenue"
 *     value="₹12.4L"
 *     accent="#00E676"
 *     icon={<ReceiptLongOutlinedIcon fontSize="small" />}
 *     delta={{ pct: 12.4, up: true, period: 'vs last month' }}
 *     spark={[10, 12, 9, 14, 16, 22, 24]}
 *     cta={{ label: 'View invoices', href: '/sales/invoices' }}
 *   />
 */
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography, alpha } from '@mui/material';
import type { Theme } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import TrendingUpOutlinedIcon from '@mui/icons-material/TrendingUpOutlined';
import TrendingDownOutlinedIcon from '@mui/icons-material/TrendingDownOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(10px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export type StatCardProps = {
  label: string;
  value: string | number;
  accent: string;             // accent color (gradient + glow)
  icon?: React.ReactNode;
  hint?: string;
  delta?: { pct: number; up: boolean; period?: string };
  spark?: number[];
  cta?: { label: string; href: string };
  /** Stagger entrance animation (used in grids of cards) */
  index?: number;
};

export default function StatCard({
  label, value, accent, icon, hint, delta, spark, cta, index = 0,
}: StatCardProps) {
  const nav = useNavigate();
  const clickable = !!cta;

  return (
    <Box
      onClick={() => cta && nav(cta.href)}
      role={clickable ? 'button' : undefined}
      sx={{
        position: 'relative', height: '100%', p: 2.25, borderRadius: 2, overflow: 'hidden',
        cursor: clickable ? 'pointer' : 'default',
        background: (t: Theme) => t.palette.mode === 'dark'
          ? `linear-gradient(180deg, ${alpha(accent, 0.10)} 0%, rgba(255,255,255,0.02) 100%)`
          : 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        border: (t: Theme) => `1px solid ${t.palette.mode === 'dark' ? alpha(accent, 0.22) : 'rgba(15,23,42,0.08)'}`,
        boxShadow: (t: Theme) => t.palette.mode === 'dark'
          ? `0 0 0 1px ${alpha(accent, 0.06)} inset, 0 18px 48px ${alpha(accent, 0.10)}`
          : '0 4px 14px rgba(15,23,42,0.06)',
        transition: 'transform .25s ease, border-color .25s ease, box-shadow .25s ease',
        animation: `${fadeUp} .5s ease-out ${index * 0.06}s both`,
        '&:hover': clickable ? {
          transform: 'translateY(-3px)',
          borderColor: alpha(accent, 0.55),
          boxShadow: (t: Theme) => t.palette.mode === 'dark'
            ? `0 22px 60px ${alpha(accent, 0.20)}, 0 0 0 1px ${alpha(accent, 0.18)} inset`
            : `0 14px 36px ${alpha(accent, 0.18)}`,
        } : {},
      }}
    >
      {/* Corner glow */}
      <Box aria-hidden sx={{
        position: 'absolute', top: -40, right: -40, width: 160, height: 160,
        borderRadius: '50%', filter: 'blur(48px)', opacity: 0.32, pointerEvents: 'none',
        background: `radial-gradient(closest-side, ${accent}, transparent)`,
      }} />

      {(icon || label) && (
        <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.25 }}>
          {icon && (
            <Box sx={{
              width: 36, height: 36, borderRadius: 1.5,
              display: 'grid', placeItems: 'center', color: '#fff',
              background: `linear-gradient(135deg, ${accent}, ${alpha(accent, 0.55)})`,
              boxShadow: `0 6px 16px ${alpha(accent, 0.45)}`,
            }}>
              {icon}
            </Box>
          )}
          <Typography variant="caption" sx={{
            color: 'text.secondary', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
          }}>
            {label}
          </Typography>
        </Stack>
      )}

      <Typography sx={{
        fontSize: { xs: 26, md: 30 }, fontWeight: 800, lineHeight: 1.1,
        fontVariantNumeric: 'tabular-nums', letterSpacing: -0.5,
      }}>
        {value}
      </Typography>

      <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 0.75, minHeight: 22 }}>
        {delta && (
          <>
            {delta.up
              ? <TrendingUpOutlinedIcon sx={{ fontSize: 16, color: '#00E676' }} />
              : <TrendingDownOutlinedIcon sx={{ fontSize: 16, color: '#FF5252' }} />}
            <Typography variant="caption" sx={{ color: delta.up ? '#00E676' : '#FF5252', fontWeight: 700 }}>
              {delta.up ? '+' : '−'}{delta.pct}%
            </Typography>
            {delta.period && <Typography variant="caption" color="text.secondary">{delta.period}</Typography>}
          </>
        )}
        {hint && !delta && <Typography variant="caption" color="text.secondary">{hint}</Typography>}
      </Stack>

      {spark && spark.length > 0 && (
        <Box sx={{ mt: 1.25, mx: -0.5 }}>
          <CardSparkline data={spark} color={accent} />
        </Box>
      )}

      {cta && (
        <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mt: 1.25, color: accent, fontWeight: 700, fontSize: 13 }}>
          <span>{cta.label}</span>
          <ArrowForwardIcon sx={{ fontSize: 16 }} />
        </Stack>
      )}
    </Box>
  );
}

/** Tiny inline sparkline using a smooth cubic-bezier path. */
function CardSparkline({ data, color, height = 44 }: { data: number[]; color: string; height?: number }) {
  if (!data.length) return <Box sx={{ height }} />;
  const w = 120; const h = height; const pad = 2;
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
  const id = `stat-spark-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" style={{ width: '100%', height: h, display: 'block' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.45} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fill} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
