import { useEffect, useState, useCallback } from 'react';
import { useMediaQuery, useTheme } from '@mui/material';

const SIDEBAR_KEY = 'ui.sidebarMode';

export type SidebarMode = 'expanded' | 'collapsed';

/**
 * Single source of truth for responsive state.
 *
 * - `isMobile`  ≤ 899px  → sidebar hidden, bottom nav visible
 * - `isTablet`  900-1199 → sidebar forced to `collapsed` (56px)
 * - `isDesktop` ≥ 1200   → user-controllable sidebar, persisted to localStorage
 */
export function useResponsive() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));    // <900
  const isTablet = useMediaQuery(theme.breakpoints.between('md', 'lg')); // 900-1199
  const isDesktop = useMediaQuery(theme.breakpoints.up('lg'));     // ≥1200

  // Persisted preference (only honoured on desktop)
  const [userMode, setUserMode] = useState<SidebarMode>(() => {
    if (typeof window === 'undefined') return 'expanded';
    return (localStorage.getItem(SIDEBAR_KEY) as SidebarMode) || 'expanded';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem(SIDEBAR_KEY, userMode);
  }, [userMode]);

  // Effective sidebar mode, resolved against the current breakpoint
  const sidebarMode: SidebarMode =
    isMobile ? 'collapsed' /* drawer handles visibility, not width */
    : isTablet ? 'collapsed'
    : userMode;

  const toggleSidebar = useCallback(() => {
    if (isDesktop) setUserMode(m => (m === 'expanded' ? 'collapsed' : 'expanded'));
  }, [isDesktop]);

  return { isMobile, isTablet, isDesktop, sidebarMode, userMode, toggleSidebar, setUserMode };
}
