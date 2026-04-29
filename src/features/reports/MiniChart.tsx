/**
 * Lightweight inline-SVG charts for the Reports landing screen.
 *
 * Why hand-rolled SVG instead of Recharts / x-charts?
 *  - No new dependency (saves ~150 KB on the bundle).
 *  - Full theme integration with MUI palette + dark mode.
 *  - We only need a few primitive shapes (line, bar, donut, sparkline).
 *
 * If we later need stacked bars, log scales, brush selection, etc., move to
 * MUI x-charts — these chart shapes remain useful as a low-overhead fallback.
 */
import { useMemo } from 'react';
import { Box, Stack, Typography, alpha, useTheme } from '@mui/material';

type Point = { label: string; value: number };

// ---------- Shared helpers ------------------------------------------------

const pad = (v: number, digits = 2) => v.toFixed(digits);

const formatShort = (v: number) => {
  const abs = Math.abs(v);
  if (abs >= 1e7) return `${(v / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `${(v / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `${(v / 1e3).toFixed(1)}K`;
  return v.toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

// ---------- Line / area chart -------------------------------------------

export function LineChart({
  data, height = 120, color, compareData,
}: {
  data: Point[];
  height?: number;
  color?: string;
  compareData?: Point[];
}) {
  const theme = useTheme();
  const stroke = color || theme.palette.primary.main;
  const fill = alpha(stroke, theme.palette.mode === 'dark' ? 0.18 : 0.12);

  const W = 600;  // viewBox width — actual size is set by CSS
  const H = height;
  const PAD_X = 4;
  const PAD_Y = 8;

  const allValues = [
    ...data.map((d) => d.value),
    ...(compareData || []).map((d) => d.value),
  ];
  const maxV = Math.max(...allValues, 1);
  const minV = Math.min(...allValues, 0);
  const range = maxV - minV || 1;

  const pointsToPath = (pts: Point[], close = false) => {
    if (pts.length === 0) return '';
    const stepX = pts.length > 1 ? (W - PAD_X * 2) / (pts.length - 1) : 0;
    const segments = pts.map((p, i) => {
      const x = PAD_X + i * stepX;
      const y = H - PAD_Y - ((p.value - minV) / range) * (H - PAD_Y * 2);
      return `${i === 0 ? 'M' : 'L'}${pad(x)},${pad(y)}`;
    }).join(' ');
    if (!close) return segments;
    const lastX = PAD_X + (pts.length - 1) * stepX;
    return `${segments} L${pad(lastX)},${H - PAD_Y} L${PAD_X},${H - PAD_Y} Z`;
  };

  const linePath = useMemo(() => pointsToPath(data, false), [data, W, H]);
  const areaPath = useMemo(() => pointsToPath(data, true), [data, W, H]);
  const comparePath = useMemo(
    () => compareData ? pointsToPath(compareData, false) : '',
    [compareData, W, H],
  );

  if (data.length === 0) {
    return <EmptyChart height={height} />;
  }

  return (
    <Box sx={{ width: '100%', height }}>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none"
        style={{ width: '100%', height: '100%', display: 'block' }}>
        {/* Baseline grid */}
        <line x1="0" y1={H - PAD_Y} x2={W} y2={H - PAD_Y}
          stroke={alpha(theme.palette.text.primary, 0.08)} strokeWidth="1" />
        {/* Compare (background) */}
        {comparePath && (
          <path d={comparePath}
            fill="none" stroke={alpha(theme.palette.text.primary, 0.4)}
            strokeWidth="1.5" strokeDasharray="3 3" />
        )}
        {/* Area + line */}
        <path d={areaPath} fill={fill} />
        <path d={linePath} fill="none" stroke={stroke} strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />
        {/* Last-point dot */}
        {data.length > 0 && (() => {
          const stepX = data.length > 1 ? (W - PAD_X * 2) / (data.length - 1) : 0;
          const last = data[data.length - 1];
          const x = PAD_X + (data.length - 1) * stepX;
          const y = H - PAD_Y - ((last.value - minV) / range) * (H - PAD_Y * 2);
          return <circle cx={x} cy={y} r="3.5" fill={stroke} />;
        })()}
      </svg>
    </Box>
  );
}

// ---------- Horizontal bar chart -----------------------------------------

export function HBarChart({
  rows, valueKey = 'value', color,
}: {
  rows: Array<{ label: string; value: number; sublabel?: string }>;
  valueKey?: string;
  color?: string;
}) {
  const theme = useTheme();
  const tone = color || theme.palette.primary.main;
  const max = Math.max(...rows.map((r) => r.value), 1);

  if (rows.length === 0) return <EmptyChart height={120} />;

  return (
    <Stack spacing={1.25}>
      {rows.map((r, i) => {
        const pct = max > 0 ? (r.value / max) * 100 : 0;
        return (
          <Box key={`${r.label}-${i}`}>
            <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.25 }}>
              <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                {r.label}
              </Typography>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {formatShort(r.value)}
              </Typography>
            </Stack>
            <Box sx={{
              height: 8, borderRadius: 999,
              bgcolor: alpha(theme.palette.text.primary, 0.06),
            }}>
              <Box sx={{
                height: '100%', width: `${Math.max(2, pct)}%`,
                background: `linear-gradient(90deg, ${tone}, ${alpha(tone, 0.6)})`,
                borderRadius: 999,
                transition: 'width 350ms ease',
              }} />
            </Box>
            {r.sublabel && (
              <Typography variant="caption" color="text.secondary">
                {r.sublabel}
              </Typography>
            )}
          </Box>
        );
      })}
    </Stack>
  );
}

// ---------- Donut chart ---------------------------------------------------

const DONUT_PALETTE = ['#4FC3F7', '#00E676', '#FFB300', '#B388FF', '#FF5252', '#26A69A'];

export function DonutChart({
  data, size = 140, centerLabel, centerValue,
}: {
  data: Point[];
  size?: number;
  centerLabel?: string;
  centerValue?: string;
}) {
  const theme = useTheme();
  const total = data.reduce((acc, d) => acc + d.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.4;
  const inner = size * 0.26;

  if (total <= 0) {
    return (
      <Stack alignItems="center" justifyContent="center" sx={{ height: size }}>
        <EmptyChart height={size} />
      </Stack>
    );
  }

  // Build SVG arcs
  let cumulative = 0;
  const arcs = data.map((d, i) => {
    const start = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    cumulative += d.value;
    const end = (cumulative / total) * Math.PI * 2 - Math.PI / 2;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const xi1 = cx + inner * Math.cos(start);
    const yi1 = cy + inner * Math.sin(start);
    const xi2 = cx + inner * Math.cos(end);
    const yi2 = cy + inner * Math.sin(end);
    const large = end - start > Math.PI ? 1 : 0;
    const path = [
      `M${pad(x1)},${pad(y1)}`,
      `A${pad(radius)},${pad(radius)} 0 ${large} 1 ${pad(x2)},${pad(y2)}`,
      `L${pad(xi2)},${pad(yi2)}`,
      `A${pad(inner)},${pad(inner)} 0 ${large} 0 ${pad(xi1)},${pad(yi1)}`,
      'Z',
    ].join(' ');
    return { path, color: DONUT_PALETTE[i % DONUT_PALETTE.length], label: d.label, value: d.value };
  });

  return (
    <Stack direction="row" spacing={2} alignItems="center">
      <Box sx={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          {arcs.map((a) => (
            <path key={a.label} d={a.path} fill={a.color}
              stroke={theme.palette.background.paper} strokeWidth="1.5" />
          ))}
        </svg>
        {(centerLabel || centerValue) && (
          <Box sx={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {centerValue && (
              <Typography variant="subtitle2" sx={{ fontWeight: 800, lineHeight: 1 }}>
                {centerValue}
              </Typography>
            )}
            {centerLabel && (
              <Typography variant="caption" color="text.secondary">
                {centerLabel}
              </Typography>
            )}
          </Box>
        )}
      </Box>
      <Stack spacing={0.5} sx={{ flex: 1, minWidth: 0 }}>
        {arcs.map((a) => (
          <Stack key={a.label} direction="row" alignItems="center" spacing={1}>
            <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: a.color, flexShrink: 0 }} />
            <Typography variant="caption" sx={{ flex: 1 }} noWrap>{a.label}</Typography>
            <Typography variant="caption" sx={{ fontWeight: 700 }}>
              {formatShort(a.value)}
            </Typography>
          </Stack>
        ))}
      </Stack>
    </Stack>
  );
}

// ---------- Empty placeholder --------------------------------------------

function EmptyChart({ height }: { height: number }) {
  return (
    <Box sx={{
      height, display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: 'text.disabled',
    }}>
      <Typography variant="caption">No data in this period</Typography>
    </Box>
  );
}
