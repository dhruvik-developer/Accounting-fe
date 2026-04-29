import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  IconButton,
  Link,
  Stack,
  Toolbar,
  Tooltip,
  Typography,
} from '@mui/material';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { alpha } from '@mui/material/styles';
import { keyframes } from '@emotion/react';
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { api } from '@/app/api';

const floatY = keyframes`
  0%, 100% { transform: translateY(0); }
  50%      { transform: translateY(-8px); }
`;
const orbDrift = keyframes`
  0%, 100% { transform: translate(0, 0) scale(1); }
  50%      { transform: translate(20px, -30px) scale(1.08); }
`;
const gradientShift = keyframes`
  0%, 100% { background-position: 0% 50%; }
  50%      { background-position: 100% 50%; }
`;
const fadeInUp = keyframes`
  from { opacity: 0; transform: translateY(16px); }
  to   { opacity: 1; transform: translateY(0); }
`;

import AccountBalanceWalletOutlinedIcon from '@mui/icons-material/AccountBalanceWalletOutlined';
import AnalyticsOutlinedIcon from '@mui/icons-material/AnalyticsOutlined';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CloudDoneOutlinedIcon from '@mui/icons-material/CloudDoneOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import SecurityOutlinedIcon from '@mui/icons-material/SecurityOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import TimelineOutlinedIcon from '@mui/icons-material/TimelineOutlined';
import VerifiedOutlinedIcon from '@mui/icons-material/VerifiedOutlined';

import { useBrand } from '@/app/brand';

type Feature = {
  title: string;
  body: string;
  icon: React.ReactNode;
};

type Plan = {
  name: string;
  price: string;
  period: string;
  description: string;
  cta: string;
  to?: string;
  href?: string;
  highlight?: boolean;
  features: string[];
};

const trustItems = [
  { title: 'GST-ready', body: 'Invoices, purchase bills, GST summaries, and tax-ready reports.', icon: <VerifiedOutlinedIcon />, color: 'primary' },
  { title: 'Inventory tracking', body: 'Stock ledger, batches, serial numbers, low-stock alerts, and valuation.', icon: <Inventory2OutlinedIcon />, color: 'success' },
  { title: 'Multi-branch', body: 'HO, retail branches, warehouses, and branch-wise permissions.', icon: <HubOutlinedIcon />, color: 'warning' },
  { title: 'Secure cloud access', body: 'Role-based access, cloud login, team controls, and audit-friendly data.', icon: <CloudDoneOutlinedIcon />, color: 'info' },
] as const;

const features: Feature[] = [
  {
    title: 'GST invoices',
    body: 'Create clean GST invoices with HSN, tax split, discounts, payment status, and printable templates.',
    icon: <ReceiptLongOutlinedIcon />,
  },
  {
    title: 'Purchase bills',
    body: 'Record supplier bills, GST input, due dates, purchase orders, and payable tracking in one flow.',
    icon: <LocalMallOutlinedIcon />,
  },
  {
    title: 'Inventory & stock ledger',
    body: 'Track quantity stock, batch expiry, serial numbers, warehouses, transfers, and item movement history.',
    icon: <Inventory2OutlinedIcon />,
  },
  {
    title: 'Customer & supplier management',
    body: 'Maintain parties, balances, GST details, credit limits, addresses, and transaction history.',
    icon: <GroupsOutlinedIcon />,
  },
  {
    title: 'Payment tracking',
    body: 'Follow collections, supplier payments, outstanding balances, ledgers, and settlement status.',
    icon: <PaymentsOutlinedIcon />,
  },
  {
    title: 'Reports',
    body: 'See sales, purchases, GST payable, outstanding, stock value, party ledger, and business health.',
    icon: <AnalyticsOutlinedIcon />,
  },
  {
    title: 'Document templates',
    body: 'Design invoices, estimates, delivery challans, and purchase documents for your business style.',
    icon: <DescriptionOutlinedIcon />,
  },
  {
    title: 'HO + retail branch management',
    body: 'Run head office controls while each branch manages daily billing, inventory, and users.',
    icon: <StorefrontOutlinedIcon />,
  },
];

const workflows = [
  ['Estimate', 'Sales Order', 'Delivery Challan', 'Sales Invoice'],
  ['Purchase Order', 'Purchase Bill'],
  ['Payment', 'Ledger', 'Reports'],
];

const kpis = [
  { label: 'Sales', value: '₹12.4L', trend: '+18%' },
  { label: 'Purchases', value: '₹7.8L', trend: '+9%' },
  { label: 'Outstanding', value: '₹2.1L', trend: '42 parties' },
  { label: 'Stock value', value: '₹18.6L', trend: '1,240 items' },
  { label: 'GST payable', value: '₹84.5K', trend: 'This month' },
];

// Fallback list — used while the public plans API is in flight, or if it
// fails (so the marketing site never renders an empty pricing section).
// The platform-admin "is_active" toggle is the source of truth at runtime;
// see usePlans() below.
const FALLBACK_PLANS: Plan[] = [
  {
    name: 'Free',
    price: '₹0',
    period: 'forever',
    description: 'For new businesses testing GST billing and basic inventory.',
    cta: 'Start free',
    to: '/signup?plan=free&cycle=monthly',
    features: ['Basic GST invoices', '1 user', '25 invoices/month', 'Parties + items'],
  },
  {
    name: 'Starter',
    price: '₹399',
    period: '/month',
    description: 'For solo shops and small service businesses on GST.',
    cta: 'Start Starter',
    to: '/signup?plan=starter&cycle=monthly',
    features: ['GST invoices + purchases', 'E-invoice ready', '2 users', '250 invoices/month'],
  },
  {
    name: 'Pro',
    price: '₹999',
    period: '/month',
    description: 'For growing single-branch businesses that need full controls.',
    cta: 'Start Pro',
    to: '/signup?plan=pro&cycle=monthly',
    highlight: true,
    features: [
      'Unlimited users · 2,000 invoices/mo',
      'Advanced reports (GST, P&L, ageing)',
      'Custom roles & permissions (RBAC)',
      'API + Template Designer',
    ],
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: '',
    description: 'Multi-branch operations, SSO, dedicated support and onboarding.',
    cta: 'Contact sales',
    href: 'mailto:sales@vyaparpro.app?subject=VyaparPro%20Enterprise%20plan',
    features: [
      'Unlimited branches (HO + branches)',
      'Branch-wise inventory, users & reports',
      'SSO/SAML · audit · priority support',
      'Custom onboarding & integrations',
    ],
  },
];

const faqs = [
  {
    q: 'Is VyaparPro built for Indian GST billing?',
    a: 'Yes. The product is positioned around GST invoices, purchase bills, HSN/SAC details, tax split, GST payable visibility, and accounting reports for Indian SMBs.',
  },
  {
    q: 'Can I manage multiple branches or warehouses?',
    a: 'Multi-branch management — HO plus branch operations, branch-wise inventory, users, and reporting — is available on the Enterprise plan. Free, Starter, Growth, and Pro plans support a single branch.',
  },
  {
    q: 'Do retailers and wholesalers need separate setups?',
    a: 'No. VyaparPro can tailor defaults during onboarding, but the same account can support retail billing, wholesale orders, purchase bills, stock, payments, and reports.',
  },
  {
    q: 'Can accountants use this for client businesses?',
    a: 'Yes. Accountants can work with parties, GST-ready documents, ledgers, reports, and business-level access permissions.',
  },
  {
    q: 'Do I need a credit card for the trial?',
    a: 'No. The trial flow can start without a credit card, and the customer can choose a plan before account creation.',
  },
];

type ApiPlan = {
  slug: string;
  name: string;
  price_monthly: number;
  price_annual: number;
  max_branches: number;
  max_users: number;
  max_invoices_per_month: number;
  features: Record<string, any>;
  is_active: boolean;
  sort_order: number;
};

const fmtINR = (v: number) => `₹${(v || 0).toLocaleString('en-IN')}`;
const unlimited = (n: number, label: string) =>
  (n === 0 ? 'Unlimited' : n.toLocaleString('en-IN')) + ' ' + label;

// Translate a backend Plan row into the card shape the landing page renders.
// Bullet copy is derived from feature flags + caps, so disabling a flag in
// platform admin is reflected on the homepage without a code change.
function apiPlanToCard(p: ApiPlan, popularSlug: string | null): Plan {
  const isFree = p.price_monthly === 0 && p.slug === 'free';
  const isCustom = p.slug === 'enterprise';
  const periodMonth = isFree ? 'forever' : '/month';
  const price = isCustom ? 'Custom' : (isFree ? '₹0' : fmtINR(p.price_monthly));
  const period = isCustom ? '' : periodMonth;

  const description = ({
    free: 'For new businesses testing GST billing and basic inventory.',
    starter: 'For solo shops and small service businesses on GST.',
    pro: 'For growing single-branch businesses that need full controls.',
    enterprise: 'Multi-branch operations, SSO, dedicated support and onboarding.',
  } as Record<string, string>)[p.slug] || `${p.name} plan`;

  const features: string[] = [];
  features.push(unlimited(p.max_users, p.max_users === 1 ? 'user' : 'users'));
  features.push(unlimited(p.max_invoices_per_month, 'invoices/month'));
  if (p.features?.module_branches) {
    features.push(unlimited(p.max_branches, p.max_branches === 1 ? 'branch' : 'branches')
      + ' · multi-branch HO + branches');
  } else {
    features.push(unlimited(p.max_branches, p.max_branches === 1 ? 'branch' : 'branches'));
  }
  if (p.features?.reports_advanced) features.push('Advanced GST + P&L reports');
  if (p.features?.rbac) features.push('Custom roles & permissions (RBAC)');
  if (p.features?.api) features.push('Public API access');
  if (p.features?.e_invoice) features.push('E-invoice integration');
  if (p.features?.sso) features.push('SSO / SAML');

  const cta = isFree ? 'Start free'
    : isCustom ? 'Contact sales'
    : `Start ${p.name}`;

  return {
    name: p.name,
    price,
    period,
    description,
    cta,
    ...(isCustom
      ? { href: `mailto:sales@vyaparpro.app?subject=${encodeURIComponent(`${p.name} plan enquiry`)}` }
      : { to: `/signup?plan=${p.slug}&cycle=monthly` }
    ),
    highlight: popularSlug != null && p.slug === popularSlug,
    features,
  };
}

function usePlans() {
  const [plans, setPlans] = useState<Plan[]>(FALLBACK_PLANS);
  const [loaded, setLoaded] = useState(false);
  useEffect(() => {
    api.get<ApiPlan[] | { results: ApiPlan[] }>('/billing/public/plans/')
      .then((r) => {
        const raw = (Array.isArray(r.data) ? r.data : r.data?.results) || [];
        const active = raw.filter((p) => p.is_active);
        if (active.length === 0) return; // keep fallback rather than empty page
        // Highlight the cheapest paid plan as "Popular" — predictable rule
        // that doesn't need a separate flag in the database.
        const paid = active.filter((p) => p.slug !== 'free' && p.slug !== 'enterprise');
        const popular = paid.sort((a, b) => a.price_monthly - b.price_monthly)[0]?.slug || null;
        const sorted = active.sort((a, b) => a.sort_order - b.sort_order || a.price_monthly - b.price_monthly);
        setPlans(sorted.map((p) => apiPlanToCard(p, popular)));
      })
      .catch(() => { /* keep fallback */ })
      .finally(() => setLoaded(true));
  }, []);
  return { plans, loaded };
}

export default function LandingPage() {
  const { brand } = useBrand();
  const appName = brand.app_name || 'VyaparPro';

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <MarketingNav appName={appName} />

      <Box
        component="main"
        sx={{
          overflow: 'hidden',
          bgcolor: 'background.default',
        }}
      >
        <Hero appName={appName} />
        <TrustSection />
        <FeaturesSection />
        <WorkflowSection />
        <AnalyticsSection />
        <PricingSection />
        <FaqSection />
        <FinalCta appName={appName} />
      </Box>
    </Box>
  );
}

function MarketingNav({ appName }: { appName: string }) {
  const { mode, toggleMode } = useBrand();
  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        bgcolor: (t) => t.palette.mode === 'dark'
          ? 'rgba(11,18,32,0.78)'
          : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(10px)',
        borderBottom: '1px solid',
        borderColor: 'divider',
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ minHeight: 64, gap: 2 }}>
        <Stack
          direction="row"
          alignItems="center"
          spacing={1.25}
          component={RouterLink}
          to="/"
          sx={{ textDecoration: 'none', color: 'inherit', minWidth: 0 }}
        >
          <Box
            sx={{
              width: 32,
              height: 32,
              borderRadius: 1,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: 'primary.main',
            }}
          >
            <AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0 }}>
            {appName}
          </Typography>
        </Stack>

        <Stack
          direction="row"
          spacing={2.5}
          sx={{ display: { xs: 'none', md: 'flex' }, ml: 3 }}
          alignItems="center"
        >
          <NavAnchor href="#features">Features</NavAnchor>
          <NavAnchor href="#workflow">Workflow</NavAnchor>
          <NavAnchor href="#analytics">Dashboard</NavAnchor>
          <NavAnchor href="#pricing">Pricing</NavAnchor>
        </Stack>

        <Box sx={{ flex: 1 }} />
        <Tooltip title={mode === 'dark' ? 'Switch to light' : 'Switch to dark'}>
          <IconButton onClick={toggleMode} size="small" sx={{ mr: 0.5 }}>
            {mode === 'dark' ? <LightModeOutlinedIcon fontSize="small" /> : <DarkModeOutlinedIcon fontSize="small" />}
          </IconButton>
        </Tooltip>
        <Button component={RouterLink} to="/auth/login" size="small">
          Sign in
        </Button>
        <Button component={RouterLink} to="/pricing" size="small" variant="contained">
          Start free trial
        </Button>
      </Toolbar>
    </AppBar>
  );
}

function NavAnchor({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      underline="none"
      color="text.secondary"
      sx={{
        fontSize: 13,
        fontWeight: 600,
        '&:hover': { color: 'primary.main' },
      }}
    >
      {children}
    </Link>
  );
}

function Hero({ appName }: { appName: string }) {
  return (
    <Box
      component="section"
      sx={{
        position: 'relative',
        py: { xs: 7, md: 10 },
        overflow: 'hidden',
        background: (t) => t.palette.mode === 'dark'
          ? 'radial-gradient(1200px 600px at 12% -10%, rgba(0,230,118,0.18), transparent 60%),'
            + 'radial-gradient(1000px 500px at 95% 0%, rgba(79,195,247,0.16), transparent 65%),'
            + 'radial-gradient(900px 500px at 50% 110%, rgba(179,136,255,0.10), transparent 60%),'
            + 'linear-gradient(180deg, #0B0B0B 0%, #111111 100%)'
          : 'radial-gradient(1200px 600px at 12% -10%, rgba(0,230,118,0.18), transparent 60%),'
            + 'radial-gradient(1000px 500px at 95% 0%, rgba(79,195,247,0.18), transparent 65%),'
            + 'radial-gradient(900px 500px at 50% 110%, rgba(244,114,182,0.10), transparent 60%),'
            + 'linear-gradient(180deg, #FBFCFF 0%, #F2F5FB 100%)',
        borderBottom: '1px solid',
        borderColor: 'divider',
      }}
    >
      {/* Floating gradient orbs — money green + trust blue */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', top: -120, left: -80, width: 380, height: 380,
          borderRadius: '50%', filter: 'blur(70px)', opacity: 0.5,
          background: 'radial-gradient(closest-side, rgba(0,230,118,0.55), transparent)',
          animation: `${orbDrift} 14s ease-in-out infinite`, pointerEvents: 'none',
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'absolute', top: 40, right: -100, width: 440, height: 440,
          borderRadius: '50%', filter: 'blur(80px)', opacity: 0.5,
          background: 'radial-gradient(closest-side, rgba(79,195,247,0.55), transparent)',
          animation: `${orbDrift} 18s ease-in-out infinite reverse`, pointerEvents: 'none',
        }}
      />
      {/* Subtle grid texture */}
      <Box
        aria-hidden
        sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: (t) => t.palette.mode === 'dark'
            ? 'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px),'
              + 'linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)'
            : 'linear-gradient(rgba(15,23,42,0.06) 1px, transparent 1px),'
              + 'linear-gradient(90deg, rgba(15,23,42,0.06) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
          maskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 0%, transparent 75%)',
        }}
      />

      <Container
        maxWidth="lg"
        sx={{
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
        }}
      >
        <Stack alignItems="center" spacing={2} sx={{ animation: `${fadeInUp} 0.8s ease-out both` }}>
          <Chip
            color="primary"
            icon={<VerifiedOutlinedIcon />}
            label="GST accounting, inventory, billing, and reporting for Indian SMBs"
            sx={{
              maxWidth: '100%', height: 'auto',
              backdropFilter: 'blur(8px)',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.10),
              color: 'primary.dark',
              border: (t) => `1px solid ${alpha(t.palette.primary.main, 0.25)}`,
              '& .MuiChip-label': { whiteSpace: 'normal', py: 0.5, fontWeight: 600 },
            }}
          />
          <Typography
            component="h1"
            sx={{
              fontSize: { xs: 36, sm: 48, md: 68 },
              lineHeight: { xs: '42px', sm: '56px', md: '74px' },
              fontWeight: 800,
              letterSpacing: -0.5,
              color: 'text.primary',
              maxWidth: 920,
              '& .accent': {
                background: 'linear-gradient(90deg, #00E676 0%, #4FC3F7 50%, #B388FF 100%)',
                backgroundSize: '200% 100%',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
                animation: `${gradientShift} 6s ease-in-out infinite`,
              },
            }}
          >
            Run billing, GST, stock, and branches from{' '}
            <Box component="span" className="accent">one clean business dashboard.</Box>
          </Typography>
          <Typography
            sx={{
              color: 'text.secondary',
              fontSize: { xs: 16, md: 19 },
              lineHeight: { xs: '24px', md: '30px' },
              maxWidth: 760,
            }}
          >
            {appName} helps retailers, wholesalers, distributors, service businesses, small
            manufacturers, and accountants create GST-ready documents, track inventory, collect
            payments, and understand profit without spreadsheet chaos.
          </Typography>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            alignItems="center"
            justifyContent="center"
            sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}
          >
            <Button
              component={RouterLink}
              to="/pricing"
              variant="contained"
              size="large"
              endIcon={<ArrowForwardIcon />}
              sx={{ minWidth: { xs: '100%', sm: 178 } }}
            >
              Start Free Trial
            </Button>
            <Button
              href="#dashboard-demo"
              variant="outlined"
              size="large"
              sx={{ minWidth: { xs: '100%', sm: 150 }, bgcolor: 'background.paper' }}
            >
              View Demo
            </Button>
          </Stack>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={{ xs: 0.75, sm: 2 }}
            alignItems="center"
            justifyContent="center"
            sx={{ color: 'text.secondary', pt: 1 }}
          >
            <ProofText>14-day trial</ProofText>
            <ProofText>No credit card required</ProofText>
            <ProofText>Built for Indian GST workflows</ProofText>
          </Stack>
        </Stack>

        <Box sx={{ mt: { xs: 5, md: 7 }, display: 'flex', justifyContent: 'center' }}>
          <HeroDashboardMockup />
        </Box>
      </Container>
    </Box>
  );
}

function ProofText({ children }: { children: React.ReactNode }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.75}>
      <CheckCircleOutlineIcon color="success" sx={{ fontSize: 18 }} />
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {children}
      </Typography>
    </Stack>
  );
}

function HeroDashboardMockup() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'relative',
        width: '100%',
        maxWidth: 1120,
        height: { xs: 420, md: 460 },
        border: '1px solid',
        borderColor: alpha('#6366F1', 0.18),
        borderRadius: 2.5,
        bgcolor: 'background.paper',
        boxShadow: (t) => t.palette.mode === 'dark'
          ? '0 30px 80px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(99,102,241,0.18), 0 0 60px rgba(56,189,248,0.22)'
          : '0 30px 80px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(99,102,241,0.08), 0 0 60px rgba(56,189,248,0.18)',
        overflow: 'hidden',
        animation: `${floatY} 6s ease-in-out infinite`,
      }}
    >
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ px: 2, height: 46, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: 'error.main' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: 'warning.main' }} />
        <Box sx={{ width: 10, height: 10, borderRadius: 999, bgcolor: 'success.main' }} />
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1, fontWeight: 700 }}>
          Head Office Dashboard
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Chip size="small" color="primary" label="GST-ready" />
      </Stack>

      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '220px 1fr' }, height: 'calc(100% - 46px)' }}>
        <Box sx={{ display: { xs: 'none', md: 'block' }, borderRight: '1px solid', borderColor: 'divider', p: 1.5, bgcolor: 'background.default' }}>
          {['Dashboard', 'Sales', 'Purchases', 'Parties', 'Items', 'Inventory', 'Reports'].map((item, index) => (
            <Stack
              key={item}
              direction="row"
              spacing={1}
              alignItems="center"
              sx={{
                height: 34,
                px: 1.25,
                mb: 0.5,
                borderRadius: 1,
                bgcolor: index === 0 ? 'primary.main' : 'transparent',
                color: index === 0 ? '#fff' : 'text.secondary',
                fontWeight: 700,
                fontSize: 13,
              }}
            >
              <Box sx={{ width: 8, height: 8, borderRadius: 999, bgcolor: index === 0 ? '#fff' : 'divider' }} />
              <Box>{item}</Box>
            </Stack>
          ))}
        </Box>

        <Box sx={{ p: { xs: 1.5, md: 2 }, bgcolor: (t) => t.palette.mode === 'dark' ? alpha(t.palette.background.paper, 0.6) : '#F8FAFC' }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 1.5 }}>
            {[
              ['Total sales', '₹8.42L', '+16%'],
              ['GST payable', '₹72.8K', 'April'],
              ['Stock value', '₹14.6L', '1,028 items'],
              ['Outstanding', '₹1.9L', '36 parties'],
            ].map(([label, value, meta]) => (
              <Box
                key={label}
                sx={{
                  flex: 1,
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: 'divider',
                  borderRadius: 1,
                  p: 1.5,
                  minHeight: 84,
                }}
              >
                <Typography variant="caption" color="text.secondary">{label}</Typography>
                <Typography className="num" sx={{ fontSize: 24, fontWeight: 800, mt: 0.5 }}>{value}</Typography>
                <Typography variant="caption" color={meta.startsWith('+') ? 'success.main' : 'text.secondary'}>{meta}</Typography>
              </Box>
            ))}
          </Stack>

          <Grid container spacing={1.5}>
            <Grid item xs={12} md={7}>
              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, height: 210 }}>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
                  <Typography sx={{ fontWeight: 800 }}>Sales trend</Typography>
                  <Chip size="small" color="success" label="Live" />
                </Stack>
                <Stack direction="row" alignItems="flex-end" spacing={1} sx={{ height: 142 }}>
                  {[46, 72, 54, 92, 70, 108, 126, 116, 142, 132, 154, 170].map((height, index) => (
                    <Box
                      key={index}
                      sx={{
                        flex: 1,
                        height,
                        borderRadius: 0.5,
                        bgcolor: index > 8 ? 'primary.main' : alpha('#2563EB', 0.18),
                      }}
                    />
                  ))}
                </Stack>
              </Box>
            </Grid>
            <Grid item xs={12} md={5}>
              <Box sx={{ bgcolor: 'background.paper', border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1.5, height: 210 }}>
                <Typography sx={{ fontWeight: 800, mb: 1.5 }}>Recent activity</Typography>
                {['Sales invoice created', 'Purchase bill matched', 'Low stock alert', 'Payment received'].map((item, index) => (
                  <Stack key={item} direction="row" spacing={1} alignItems="center" sx={{ py: 0.75 }}>
                    <Box
                      sx={{
                        width: 26,
                        height: 26,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        bgcolor: index % 2 ? 'success.light' : 'primary.main',
                        color: '#fff',
                      }}
                    >
                      <CheckCircleOutlineIcon sx={{ fontSize: 16 }} />
                    </Box>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>{item}</Typography>
                      <Typography variant="caption" color="text.secondary">Just now</Typography>
                    </Box>
                  </Stack>
                ))}
              </Box>
            </Grid>
          </Grid>
        </Box>
      </Box>
    </Box>
  );
}

function TrustSection() {
  return (
    <Box component="section" sx={{ py: { xs: 5, md: 7 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <Grid container spacing={2}>
          {trustItems.map((item) => (
            <Grid item xs={12} sm={6} md={3} key={item.title}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  position: 'relative',
                  overflow: 'hidden',
                  borderRadius: 2,
                  // Glassmorphism — translucent surface + backdrop blur
                  backgroundColor: (t) => t.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(255,255,255,0.7)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  borderColor: (t) => t.palette.mode === 'dark'
                    ? 'rgba(255,255,255,0.08)'
                    : 'rgba(15,23,42,0.08)',
                  transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
                  '&::before': {
                    content: '""',
                    position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                    background: (t) =>
                      `linear-gradient(90deg, ${t.palette[item.color].main}, ${alpha(t.palette[item.color].main, 0.25)})`,
                  },
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    borderColor: (t) => alpha(t.palette[item.color].main, 0.35),
                    boxShadow: (t) => `0 18px 40px ${alpha(t.palette[item.color].main, 0.18)}`,
                  },
                }}
              >
                <CardContent sx={{ pt: 2.5 }}>
                  <Stack spacing={1.25}>
                    <Box
                      sx={{
                        width: 44,
                        height: 44,
                        borderRadius: 1.5,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        background: (t) =>
                          `linear-gradient(135deg, ${t.palette[item.color].main}, ${t.palette[item.color].dark || t.palette[item.color].main})`,
                        boxShadow: (t) => `0 8px 20px ${alpha(t.palette[item.color].main, 0.35)}`,
                      }}
                    >
                      {item.icon}
                    </Box>
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>{item.title}</Typography>
                    <Typography color="text.secondary">{item.body}</Typography>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
}

function FeaturesSection() {
  return (
    <Box id="features" component="section" sx={{ py: { xs: 7, md: 10 } }}>
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="Complete SMB operating system"
          title="Everything Indian businesses need after the first bill"
          body="VyaparPro connects day-to-day billing with stock, payments, GST reporting, templates, branches, and users so owners and accountants see the same truth."
        />
        <Grid container spacing={2.25}>
          {features.map((feature, idx) => {
            // Premium dark palette — money green, trust blue, accent violet,
            // with warm sparks for warmth. All hold up on a #0B0B0B canvas.
            const tints = [
              ['#00E676', '#00C853'],   // money green
              ['#4FC3F7', '#29B6F6'],   // trust blue
              ['#B388FF', '#7C4DFF'],   // accent violet
              ['#69F0AE', '#4FC3F7'],   // green → blue
              ['#FFB300', '#FF7043'],   // amber spark
              ['#4FC3F7', '#B388FF'],   // blue → violet
              ['#00E676', '#4FC3F7'],   // primary blend
              ['#FF80AB', '#B388FF'],   // pink → violet
            ];
            const [c1, c2] = tints[idx % tints.length];
            return (
              <Grid item xs={12} sm={6} md={3} key={feature.title}>
                <Card
                  variant="outlined"
                  sx={{
                    height: '100%',
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: 2,
                    backgroundColor: (t) => t.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(255,255,255,0.7)',
                    backdropFilter: 'blur(18px)',
                    WebkitBackdropFilter: 'blur(18px)',
                    borderColor: (t) => t.palette.mode === 'dark'
                      ? 'rgba(255,255,255,0.08)'
                      : 'rgba(15,23,42,0.08)',
                    transition: 'transform .25s ease, box-shadow .25s ease, border-color .25s ease',
                    '&::after': {
                      content: '""',
                      position: 'absolute', inset: 0, pointerEvents: 'none',
                      background: `radial-gradient(220px 120px at 100% 0%, ${alpha(c1, 0.16)}, transparent 70%)`,
                    },
                    '&:hover': {
                      transform: 'translateY(-4px)',
                      borderColor: alpha(c1, 0.45),
                      boxShadow: `0 18px 40px ${alpha(c1, 0.22)}`,
                    },
                  }}
                >
                  <CardContent>
                    <Stack spacing={1.25}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 1.5,
                          display: 'grid',
                          placeItems: 'center',
                          color: '#fff',
                          background: `linear-gradient(135deg, ${c1}, ${c2})`,
                          boxShadow: `0 8px 20px ${alpha(c1, 0.35)}`,
                        }}
                      >
                        {feature.icon}
                      </Box>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>{feature.title}</Typography>
                      <Typography color="text.secondary">{feature.body}</Typography>
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
}

function WorkflowSection() {
  return (
    <Box id="workflow" component="section" sx={{ py: { xs: 7, md: 10 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="Business workflows"
          title="Move documents forward without retyping the same data"
          body="Start from the document your team already uses, then convert it into the next operational or accounting step."
        />
        <Stack spacing={2}>
          {workflows.map((flow, index) => (
            <Card variant="outlined" key={flow.join('-')}>
              <CardContent>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
                  <Stack direction="row" spacing={1.25} alignItems="center" sx={{ minWidth: { md: 190 } }}>
                    <Box
                      sx={{
                        width: 40,
                        height: 40,
                        borderRadius: 1,
                        display: 'grid',
                        placeItems: 'center',
                        color: '#fff',
                        bgcolor: index === 0 ? 'primary.main' : index === 1 ? 'success.main' : 'warning.main',
                      }}
                    >
                      {index === 0 ? <ReceiptLongOutlinedIcon /> : index === 1 ? <LocalMallOutlinedIcon /> : <TimelineOutlinedIcon />}
                    </Box>
                    <Typography sx={{ fontWeight: 800 }}>
                      {index === 0 ? 'Sales flow' : index === 1 ? 'Purchase flow' : 'Money flow'}
                    </Typography>
                  </Stack>

                  <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ flex: 1 }}>
                    {flow.map((step, stepIndex) => (
                      <Stack key={step} direction="row" spacing={1} alignItems="center" sx={{ flex: 1 }}>
                        <Box
                          sx={{
                            flex: 1,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            bgcolor: 'background.default',
                            px: 1.5,
                            py: 1.2,
                            fontWeight: 700,
                            textAlign: 'center',
                            minHeight: 44,
                          }}
                        >
                          {step}
                        </Box>
                        {stepIndex < flow.length - 1 && (
                          <ArrowForwardIcon sx={{ color: 'text.disabled', display: { xs: 'none', sm: 'block' } }} />
                        )}
                      </Stack>
                    ))}
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}

function AnalyticsSection() {
  return (
    <Box id="analytics" component="section" sx={{ py: { xs: 7, md: 10 } }}>
      <Container maxWidth="lg" id="dashboard-demo">
        <SectionHeading
          eyebrow="Dashboard analytics"
          title="Know your numbers before the month closes"
          body="Track daily sales, purchases, outstanding money, stock value, and GST payable with branch-level visibility."
        />
        <Grid container spacing={2.25}>
          <Grid item xs={12} md={5}>
            <Grid container spacing={1.5}>
              {kpis.map((kpi) => (
                <Grid item xs={12} sm={6} md={12} key={kpi.label}>
                  <Card variant="outlined">
                    <CardContent>
                      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}>
                        <Box>
                          <Typography color="text.secondary">{kpi.label}</Typography>
                          <Typography className="num" sx={{ fontSize: 28, fontWeight: 800, mt: 0.5 }}>{kpi.value}</Typography>
                        </Box>
                        <Chip color={kpi.label === 'GST payable' ? 'warning' : 'primary'} label={kpi.trend} />
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </Grid>
          <Grid item xs={12} md={7}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardContent sx={{ height: '100%' }}>
                <Stack spacing={2.5} sx={{ height: '100%' }}>
                  <Stack direction="row" alignItems="center" justifyContent="space-between">
                    <Box>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>Branch performance</Typography>
                      <Typography color="text.secondary">Sales, stock, and collections by location</Typography>
                    </Box>
                    <Chip color="success" label="Updated today" />
                  </Stack>

                  <Box sx={{ display: 'grid', gap: 1.25 }}>
                    {[
                      ['Head Office', 92, '₹5.4L'],
                      ['Retail branch', 72, '₹3.1L'],
                      ['Wholesale counter', 58, '₹2.2L'],
                      ['Service desk', 44, '₹1.7L'],
                    ].map(([name, pct, value]) => (
                      <Box key={name}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.75 }}>
                          <Typography sx={{ fontWeight: 700 }}>{name}</Typography>
                          <Typography className="num" color="text.secondary">{value}</Typography>
                        </Stack>
                        <Box sx={{ height: 10, borderRadius: 999, bgcolor: 'background.default', overflow: 'hidden' }}>
                          <Box sx={{ width: `${pct}%`, height: '100%', bgcolor: Number(pct) > 70 ? 'primary.main' : 'success.main' }} />
                        </Box>
                      </Box>
                    ))}
                  </Box>

                  <Divider />

                  <Grid container spacing={1.5}>
                    {['Receivables', 'Payables', 'Low stock', 'Draft invoices'].map((item, index) => (
                      <Grid item xs={6} key={item}>
                        <Box sx={{ p: 1.25, borderRadius: 1, bgcolor: 'background.default', border: '1px solid', borderColor: 'divider' }}>
                          <Typography variant="caption" color="text.secondary">{item}</Typography>
                          <Typography className="num" sx={{ fontWeight: 800, fontSize: 18 }}>
                            {['₹1.9L', '₹82K', '18', '7'][index]}
                          </Typography>
                        </Box>
                      </Grid>
                    ))}
                  </Grid>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
}

function PricingSection() {
  const { plans } = usePlans();
  return (
    <Box id="pricing" component="section" sx={{ py: { xs: 7, md: 10 }, bgcolor: 'background.paper' }}>
      <Container maxWidth="lg">
        <SectionHeading
          eyebrow="Pricing"
          title="Start small, then unlock deeper controls as you grow"
          body="Every plan is designed around real Indian business operations, from first GST invoice to multi-branch management."
        />
        <Grid container spacing={2} justifyContent="center">
          {plans.map((plan) => {
            // Lay 1/2/3/4 cards out cleanly — 12 lg cols ÷ count, capped
            // at 3 so we don't stretch a single card edge-to-edge.
            const lgSpan = plans.length >= 4 ? 3
              : plans.length === 3 ? 4
              : plans.length === 2 ? 6
              : 12;
            return (
            <Grid item xs={12} sm={6} lg={lgSpan} key={plan.name}>
              <Card
                variant="outlined"
                sx={{
                  height: '100%',
                  borderColor: plan.highlight ? 'primary.main' : 'divider',
                  boxShadow: plan.highlight ? (theme) => `0 18px 36px ${alpha(theme.palette.primary.main, 0.14)}` : 'none',
                }}
              >
                <CardContent>
                  <Stack spacing={1.5}>
                    <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
                      <Typography variant="h6" sx={{ fontWeight: 800 }}>{plan.name}</Typography>
                      {plan.highlight && <Chip color="primary" label="Popular" />}
                    </Stack>
                    <Typography color="text.secondary">{plan.description}</Typography>
                    <Stack direction="row" alignItems="baseline" spacing={0.5}>
                      <Typography className="num" sx={{ fontSize: plan.price === 'Custom' ? 30 : 34, fontWeight: 900 }}>
                        {plan.price}
                      </Typography>
                      <Typography color="text.secondary">{plan.period}</Typography>
                    </Stack>
                    <Button
                      component={plan.to ? RouterLink : 'a'}
                      to={plan.to}
                      href={plan.href}
                      variant={plan.highlight ? 'contained' : 'outlined'}
                      fullWidth
                    >
                      {plan.cta}
                    </Button>
                    <Divider />
                    <Stack spacing={1}>
                      {plan.features.map((feature) => (
                        <Stack direction="row" spacing={1} alignItems="flex-start" key={feature}>
                          <CheckCircleOutlineIcon color="success" sx={{ fontSize: 18, mt: 0.2 }} />
                          <Typography variant="body2">{feature}</Typography>
                        </Stack>
                      ))}
                    </Stack>
                  </Stack>
                </CardContent>
              </Card>
            </Grid>
            );
          })}
        </Grid>
      </Container>
    </Box>
  );
}

function FaqSection() {
  return (
    <Box component="section" sx={{ py: { xs: 7, md: 10 } }}>
      <Container maxWidth="md">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions before you start"
          body="Short answers for owners, operators, and accountants evaluating VyaparPro."
        />
        <Stack spacing={1.25}>
          {faqs.map((faq) => (
            <Accordion key={faq.q} disableGutters variant="outlined" sx={{ borderRadius: 1, '&::before': { display: 'none' } }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography sx={{ fontWeight: 800 }}>{faq.q}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Typography color="text.secondary">{faq.a}</Typography>
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      </Container>
    </Box>
  );
}

function FinalCta({ appName }: { appName: string }) {
  return (
    <Box component="section" sx={{ py: { xs: 7, md: 10 }, bgcolor: 'primary.main', color: '#fff' }}>
      <Container maxWidth="md" sx={{ textAlign: 'center' }}>
        <Stack spacing={2} alignItems="center">
          <AccountBalanceWalletOutlinedIcon sx={{ fontSize: 42 }} />
          <Typography sx={{ fontSize: { xs: 30, md: 44 }, lineHeight: { xs: '38px', md: '54px' }, fontWeight: 900, letterSpacing: 0 }}>
            Bring billing, inventory, GST, and payments into one workspace.
          </Typography>
          <Typography sx={{ color: alpha('#FFFFFF', 0.84), fontSize: { xs: 16, md: 18 }, maxWidth: 680 }}>
            Start {appName} with a free trial, choose the plan that matches your business,
            and upgrade only when your operations need more power.
          </Typography>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ pt: 1, width: { xs: '100%', sm: 'auto' } }}>
            <Button component={RouterLink} to="/pricing" variant="contained" color="inherit" size="large" sx={{ color: 'primary.main', minWidth: 178 }}>
              Start Free Trial
            </Button>
            <Button href="#dashboard-demo" variant="outlined" size="large" sx={{ color: '#fff', borderColor: alpha('#FFFFFF', 0.6), minWidth: 150 }}>
              View Demo
            </Button>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
}

function SectionHeading({ eyebrow, title, body }: { eyebrow: string; title: string; body: string }) {
  return (
    <Stack spacing={1.25} sx={{ textAlign: 'center', maxWidth: 760, mx: 'auto', mb: { xs: 4, md: 5 } }}>
      <Typography color="primary.main" sx={{ fontWeight: 800, textTransform: 'uppercase', fontSize: 12, letterSpacing: 0 }}>
        {eyebrow}
      </Typography>
      <Typography sx={{ fontSize: { xs: 28, md: 42 }, lineHeight: { xs: '36px', md: '52px' }, fontWeight: 900, letterSpacing: 0 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ fontSize: { xs: 15, md: 17 }, lineHeight: { xs: '24px', md: '28px' } }}>
        {body}
      </Typography>
    </Stack>
  );
}
