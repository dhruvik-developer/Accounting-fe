/**
 * Design tokens — single source of truth.
 *
 * Rule: no color / spacing / radius / duration is hardcoded anywhere in the
 * app. Components read from tokens (directly or via the MUI theme palette /
 * shape / transitions it's mapped into in theme.ts).
 */

export const colors = {
  light: {
    canvas: '#F6F7FB',
    surface: '#FFFFFF',
    surfaceAlt: '#FAFBFD',
    border: '#E5E7EB',
    borderStrong: '#D1D5DB',

    text: '#111827',
    textMuted: '#6B7280',
    textFaint: '#9CA3AF',

    primary: '#2563EB',
    primaryHover: '#1D4ED8',
    primarySoft: '#EFF4FF',
    primaryText: '#1D4ED8',

    success: '#059669',
    successSoft: '#ECFDF5',
    warning: '#D97706',
    warningSoft: '#FFFBEB',
    danger: '#DC2626',
    dangerSoft: '#FEF2F2',
    info: '#0EA5E9',
    infoSoft: '#F0F9FF',
    violet: '#7C3AED',
    violetSoft: '#F5F3FF',
  },
  dark: {
    // Premium dark palette inspired by Stripe / Linear / Notion.
    // Money-green primary, trust-blue secondary, deep matte blacks.
    canvas: '#0B0B0B',
    surface: '#111111',
    surfaceAlt: '#161616',
    border: 'rgba(255,255,255,0.08)',
    borderStrong: 'rgba(255,255,255,0.14)',

    text: '#FFFFFF',
    textMuted: '#B0B0B0',
    textFaint: '#6B7280',

    primary: '#00E676',           // money/payments green
    primaryHover: '#00C853',
    primarySoft: 'rgba(0,230,118,0.12)',
    primaryText: '#69F0AE',

    success: '#00E676',
    successSoft: 'rgba(0,230,118,0.10)',
    warning: '#FFB300',
    warningSoft: 'rgba(255,179,0,0.10)',
    danger: '#FF5252',
    dangerSoft: 'rgba(255,82,82,0.10)',
    info: '#4FC3F7',              // trust blue
    infoSoft: 'rgba(79,195,247,0.10)',
    violet: '#B388FF',
    violetSoft: 'rgba(179,136,255,0.10)',
  },
} as const;

export const spacing = [0, 4, 8, 12, 16, 20, 24, 32, 40, 56, 72] as const;
export const radii = { xs: 4, sm: 8, md: 12, lg: 16 } as const;

export const shadows = {
  flat: '0 1px 0 rgba(16,24,40,0.04)',
  raised: '0 4px 12px rgba(16,24,40,0.06)',
  modal: '0 18px 48px rgba(16,24,40,0.18)',
} as const;

export const motion = {
  duration: { instant: 100, fast: 180, base: 240, slow: 360 },
  ease: {
    out: 'cubic-bezier(0.2, 0.9, 0.3, 1)',
    in: 'cubic-bezier(0.4, 0, 1, 1)',
    inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
} as const;

export const typography = {
  fontFamily:
    'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
  fontFamilyMono: '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  numericCss: { fontVariantNumeric: 'tabular-nums' },
  scale: {
    h1: { size: 22, weight: 600, line: 28 },
    h2: { size: 16, weight: 600, line: 22 },
    body: { size: 14, weight: 400, line: 20 },
    bodyDense: { size: 13, weight: 400, line: 20 },
    caption: { size: 12, weight: 500, line: 16 },
  },
} as const;

/** Fixed status → color map. Never invent new status colors per screen. */
export const statusColor = {
  draft: 'info',
  issued: 'primary',
  partial: 'warning',
  paid: 'success',
  overdue: 'danger',
  cancelled: 'slate',
} as const;

export const layout = {
  topbarHeight: 56,
  topbarHeightMobile: 52,
  sidebarExpanded: 240,
  sidebarCollapsed: 56,
  bottomNavHeight: 56,
  contentPaddingDesktop: 24,
  contentPaddingTablet: 16,
  contentPaddingMobile: 12,
  stickyFooterHeight: 64,
} as const;

export type ColorMode = keyof typeof colors;
