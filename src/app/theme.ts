import { createTheme, alpha, Theme } from '@mui/material/styles';
import { colors, radii, shadows, motion, typography, layout, ColorMode } from './tokens';

/**
 * Build an MUI theme from design tokens.
 *
 * Defaults to light. Pass 'dark' to flip palette; structural overrides are
 * shared between modes so the app layout never depends on mode. The optional
 * `override` lets the runtime brand (loaded from /platform/public/brand/)
 * recolor the primary + accent without touching design tokens.
 */
export function buildTheme(
  mode: ColorMode = 'light',
  override?: { primary?: string; accent?: string },
): Theme {
  const base = colors[mode];
  const c = {
    ...base,
    primary: override?.primary || base.primary,
    accent: override?.accent || (base as any).accent || base.violet,
  };
  const isDark = mode === 'dark';

  return createTheme({
    palette: {
      mode,
      primary: { main: c.primary, dark: c.primaryHover, contrastText: '#FFFFFF' },
      secondary: { main: c.violet },
      success: { main: c.success },
      warning: { main: c.warning },
      error:   { main: c.danger },
      info:    { main: c.info },
      background: { default: c.canvas, paper: c.surface },
      text: { primary: c.text, secondary: c.textMuted, disabled: c.textFaint },
      divider: c.border,
      action: {
        hover: isDark ? alpha(c.primary, 0.12) : c.primarySoft,
        selected: isDark ? alpha(c.primary, 0.16) : c.primarySoft,
      },
    },
    shape: { borderRadius: radii.sm },
    typography: {
      fontFamily: typography.fontFamily,
      htmlFontSize: 16,
      fontSize: 14,
      h1: { fontSize: typography.scale.h1.size, fontWeight: typography.scale.h1.weight, lineHeight: `${typography.scale.h1.line}px` },
      h2: { fontSize: typography.scale.h2.size, fontWeight: typography.scale.h2.weight, lineHeight: `${typography.scale.h2.line}px` },
      h3: { fontSize: 15, fontWeight: 600 },
      h4: { fontSize: 14, fontWeight: 600 },
      h5: { fontSize: 20, fontWeight: 600 },
      h6: { fontSize: 16, fontWeight: 600 },
      subtitle1: { fontSize: 14, fontWeight: 600 },
      subtitle2: { fontSize: 13, fontWeight: 600 },
      body1: { fontSize: typography.scale.body.size, lineHeight: `${typography.scale.body.line}px` },
      body2: { fontSize: typography.scale.bodyDense.size, lineHeight: `${typography.scale.bodyDense.line}px` },
      caption: { fontSize: typography.scale.caption.size, lineHeight: `${typography.scale.caption.line}px`, color: c.textMuted },
      button: { textTransform: 'none', fontWeight: 600 },
    },
    transitions: {
      duration: {
        shortest: motion.duration.instant,
        shorter: motion.duration.fast,
        short: motion.duration.base,
        standard: motion.duration.base,
        complex: motion.duration.slow,
        enteringScreen: motion.duration.base,
        leavingScreen: motion.duration.fast,
      },
      easing: { easeIn: motion.ease.in, easeOut: motion.ease.out, easeInOut: motion.ease.inOut, sharp: motion.ease.in },
    },
    components: {
      // Global CSS baseline
      MuiCssBaseline: {
        styleOverrides: {
          ':root': { colorScheme: mode },
          body: { backgroundColor: c.canvas, color: c.text, fontFamily: typography.fontFamily },
          '@media (prefers-reduced-motion: reduce)': {
            '*, *::before, *::after': {
              animationDuration: '0.001ms !important',
              transitionDuration: '0.001ms !important',
            },
          },
          // Tabular digits on every td/th inside tables + on .num class
          'table td, table th, .num': { fontVariantNumeric: 'tabular-nums' },
          // Scrollbars
          '*::-webkit-scrollbar': { width: 10, height: 10 },
          '*::-webkit-scrollbar-thumb': { background: c.borderStrong, borderRadius: 10 },
          '*::-webkit-scrollbar-track': { background: 'transparent' },
        },
      },

      // Chrome: glassy translucent topbar (premium SaaS feel in dark mode)
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'default' },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(17,17,17,0.72)' : c.surface,
            backdropFilter: isDark ? 'saturate(180%) blur(14px)' : undefined,
            WebkitBackdropFilter: isDark ? 'saturate(180%) blur(14px)' : undefined,
            color: c.text,
            borderBottom: `1px solid ${c.border}`,
            boxShadow: 'none',
          },
        },
      },

      // Drawer: hairline border, no shadow
      MuiDrawer: {
        styleOverrides: {
          paper: { backgroundColor: c.surface, borderRight: `1px solid ${c.border}`, boxShadow: 'none' },
        },
      },

      // Cards: hairline border + subtle glass on dark for a premium SaaS feel.
      MuiCard: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: {
            backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : c.surface,
            backgroundImage: isDark
              ? 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0))'
              : undefined,
            backdropFilter: isDark ? 'blur(8px)' : undefined,
            WebkitBackdropFilter: isDark ? 'blur(8px)' : undefined,
            border: `1px solid ${c.border}`,
            boxShadow: isDark ? '0 1px 0 rgba(255,255,255,0.03) inset' : shadows.flat,
            borderRadius: radii.sm,
          },
        },
      },
      MuiCardContent: { styleOverrides: { root: { padding: 16, '&:last-child': { paddingBottom: 16 } } } },

      MuiPaper: {
        defaultProps: { elevation: 0 },
        styleOverrides: {
          root: { backgroundImage: 'none' },
          outlined: { borderColor: c.border },
        },
      },

      // Buttons: primary is solid, rest are ghost
      MuiButton: {
        defaultProps: { disableElevation: true, variant: 'text' },
        styleOverrides: {
          root: { borderRadius: radii.sm, paddingInline: 14, minHeight: 36 },
          sizeSmall: { minHeight: 30, paddingInline: 10, fontSize: 13 },
          containedPrimary: {
            boxShadow: 'none',
            '&:hover': { backgroundColor: c.primaryHover, boxShadow: 'none' },
          },
          outlined: { borderColor: c.border, '&:hover': { borderColor: c.borderStrong, backgroundColor: c.surfaceAlt } },
          text: { '&:hover': { backgroundColor: c.surfaceAlt } },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: { borderRadius: radii.sm, '&:hover': { backgroundColor: c.surfaceAlt } },
        },
      },

      // Inputs: compact, subtle
      MuiTextField: {
        defaultProps: { size: 'small', variant: 'outlined' },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: c.surface,
            '& fieldset': { borderColor: c.border },
            '&:hover fieldset': { borderColor: c.borderStrong },
            '&.Mui-focused fieldset': { borderColor: c.primary, borderWidth: 1 },
          },
          input: { padding: '8px 12px' },
        },
      },
      MuiInputLabel: { styleOverrides: { root: { color: c.textMuted } } },

      // Chips = status pills
      MuiChip: {
        defaultProps: { size: 'small' },
        styleOverrides: {
          root: { borderRadius: 999, fontWeight: 500, height: 22 },
          outlined: { borderColor: c.border },
          colorPrimary: { backgroundColor: c.primarySoft, color: c.primaryText, borderColor: 'transparent' },
          colorSuccess: { backgroundColor: c.successSoft, color: c.success, borderColor: 'transparent' },
          colorWarning: { backgroundColor: c.warningSoft, color: c.warning, borderColor: 'transparent' },
          colorError:   { backgroundColor: c.dangerSoft,  color: c.danger,  borderColor: 'transparent' },
          colorInfo:    { backgroundColor: c.infoSoft,    color: c.info,    borderColor: 'transparent' },
        },
      },

      // Tables: dense, sticky-friendly
      MuiTableCell: {
        styleOverrides: {
          root: { borderBottomColor: c.border, padding: '10px 12px', fontSize: 13 },
          head: { color: c.textMuted, fontWeight: 600, background: c.surfaceAlt, textTransform: 'uppercase', fontSize: 11, letterSpacing: 0.3 },
        },
      },
      MuiTableRow: {
        styleOverrides: {
          root: { '&:hover': { backgroundColor: c.surfaceAlt } },
        },
      },

      // Menus / popovers
      MuiMenu:   { styleOverrides: { paper: { boxShadow: shadows.raised, border: `1px solid ${c.border}`, borderRadius: radii.sm } } },
      MuiPopover:{ styleOverrides: { paper: { boxShadow: shadows.raised, border: `1px solid ${c.border}`, borderRadius: radii.sm } } },
      MuiTooltip:{ styleOverrides: { tooltip: { backgroundColor: c.text, fontSize: 12, fontWeight: 500, padding: '6px 8px' } } },

      // Tabs: bottom-border style
      MuiTabs: { styleOverrides: { root: { minHeight: 36, borderBottom: `1px solid ${c.border}` }, indicator: { height: 2 } } },
      MuiTab: { styleOverrides: { root: { minHeight: 36, fontWeight: 600, fontSize: 13 } } },

      // List items: subtle default selected feedback. Components that need
      // a richer active state (sidebar, command palette) add their own sx
      // which wins via specificity. Spacing/margin deliberately NOT set so
      // each consumer controls its own layout.
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderRadius: radii.sm,
            backgroundColor: 'transparent',
            '&.Mui-selected': {
              backgroundColor: alpha(c.primary, isDark ? 0.10 : 0.08),
              color: c.primaryText,
              '& .MuiListItemIcon-root': { color: c.primary },
              '&:hover': { backgroundColor: alpha(c.primary, isDark ? 0.14 : 0.12) },
            },
            // Kill EVERY transient state that could leave a stuck grey block.
            '&.Mui-focusVisible': { backgroundColor: 'transparent' },
            '&:focus': { backgroundColor: 'transparent' },
            '&:focus-visible': { backgroundColor: 'transparent' },
            '&:focus-within': { backgroundColor: 'transparent' },
          },
        },
      },
      MuiListItemIcon: { styleOverrides: { root: { minWidth: 34, color: c.textMuted } } },
      MuiListItemText: { styleOverrides: { primary: { fontSize: 13.5, fontWeight: 500 } } },

      // Divider
      MuiDivider: { styleOverrides: { root: { borderColor: c.border } } },

      // Dialog: modal shadow
      MuiDialog: { styleOverrides: { paper: { borderRadius: radii.md, boxShadow: shadows.modal, border: `1px solid ${c.border}` } } },

      // Bottom nav (mobile)
      MuiBottomNavigation: {
        styleOverrides: { root: { backgroundColor: c.surface, borderTop: `1px solid ${c.border}`, height: layout.bottomNavHeight } },
      },
      MuiBottomNavigationAction: {
        styleOverrides: {
          root: { minWidth: 0, color: c.textMuted, '&.Mui-selected': { color: c.primary } },
        },
      },

      // Linear progress for top route loader
      MuiLinearProgress: {
        styleOverrides: { root: { height: 2, backgroundColor: 'transparent' }, bar: { backgroundColor: c.primary } },
      },
    },
  });
}

export const theme = buildTheme('light');
