import { ReactNode, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import { CssBaseline } from '@mui/material';
import axios from 'axios';
import { buildTheme } from '@/app/theme';

export type Brand = {
  app_name: string;
  tagline: string;
  primary_color: string;
  accent_color: string;
  logo_url: string;
  favicon_url: string;
  support_email: string;
  default_trial_plan_slug: string;
  default_trial_days: number;
  maintenance_mode: boolean;
  maintenance_message: string;
};

const DEFAULT_BRAND: Brand = {
  app_name: 'VyaparPro',
  tagline: 'Accounting · Suite',
  primary_color: '#2563EB',
  accent_color: '#7C3AED',
  logo_url: '',
  favicon_url: '',
  support_email: '',
  default_trial_plan_slug: 'growth',
  default_trial_days: 14,
  maintenance_mode: false,
  maintenance_message: '',
};

type Mode = 'light' | 'dark';
type Ctx = {
  brand: Brand;
  refresh: () => void;
  mode: Mode;
  toggleMode: () => void;
  setMode: (m: Mode) => void;
};
const BrandContext = createContext<Ctx>({
  brand: DEFAULT_BRAND,
  refresh: () => {},
  mode: 'light',
  toggleMode: () => {},
  setMode: () => {},
});

export const useBrand = () => useContext(BrandContext);

const MODE_KEY = 'vyaparpro:theme-mode';

function readInitialMode(): Mode {
  try {
    const stored = localStorage.getItem(MODE_KEY);
    if (stored === 'dark' || stored === 'light') return stored;
  } catch { /* ignore */ }
  // Default to dark — premium SaaS feel is the brand intent.
  return 'dark';
}

/**
 * Loads platform brand at app start (no auth required), applies it to:
 *   - MUI theme (primary + accent color)
 *   - <title> + favicon
 *   - any consumer of useBrand() (sidebar, topbar, marketing pages)
 *
 * Cached client-side via the response's Cache-Control header (60s).
 */
export default function BrandProvider({ children }: { children: ReactNode }) {
  const [brand, setBrand] = useState<Brand>(DEFAULT_BRAND);
  const [mode, setMode] = useState<Mode>(() => readInitialMode());

  const toggleMode = () => setMode((m) => (m === 'dark' ? 'light' : 'dark'));

  useEffect(() => {
    try { localStorage.setItem(MODE_KEY, mode); } catch { /* ignore */ }
  }, [mode]);

  const fetchBrand = () => {
    const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1';
    // Plain axios (not the auth'd `api`) so this works on /pricing /signup before login.
    axios.get(`${baseURL}/platform/public/brand/`)
      .then(r => setBrand({ ...DEFAULT_BRAND, ...r.data }))
      .catch(() => setBrand(DEFAULT_BRAND));
  };

  useEffect(() => { fetchBrand(); }, []);

  // Apply title + favicon + theme color
  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.title = brand.app_name;
    if (brand.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = brand.favicon_url;
    }
    let meta = document.querySelector("meta[name='theme-color']") as HTMLMetaElement | null;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = brand.primary_color;
  }, [brand]);

  // Build a themed palette per brand colors. In dark mode we deliberately
  // skip the brand override so the premium green/blue palette wins —
  // money-green primary feels right for a payments-heavy SaaS.
  const theme = useMemo(() => {
    if (mode === 'dark') {
      return buildTheme('dark');
    }
    return buildTheme('light', {
      primary: brand.primary_color,
      accent: brand.accent_color,
    });
  }, [brand.primary_color, brand.accent_color, mode]);

  return (
    <BrandContext.Provider value={{ brand, refresh: fetchBrand, mode, toggleMode, setMode }}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </BrandContext.Provider>
  );
}
