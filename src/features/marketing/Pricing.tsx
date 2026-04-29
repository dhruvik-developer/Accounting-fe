import { useEffect, useMemo, useState } from 'react';
import {
  Alert, AppBar, Box, Button, Card, CardContent, Chip, Container, Divider,
  Grid, Stack, Switch, Toolbar, Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/app/api';

type Plan = {
  slug: string; name: string;
  price_monthly: number; price_annual: number;
  max_branches: number; max_users: number; max_invoices_per_month: number;
  features: Record<string, any>;
};

const HEADLINE_FEATURES: { key: string; label: string }[] = [
  { key: 'module_branches', label: 'Multi-branch management (HO + branches)' },
  { key: 'designer', label: 'Template Designer' },
  { key: 'reports_advanced', label: 'Advanced Reports (GST, P&L)' },
  { key: 'rbac', label: 'Custom Roles & Permissions' },
  { key: 'api', label: 'Public API access' },
  { key: 'e_invoice', label: 'E-invoice integration' },
  { key: 'multi_state', label: 'Multi-state GST' },
  { key: 'sso', label: 'SSO / SAML' },
];

const fmtINR = (v: number) => `₹${(v || 0).toLocaleString('en-IN')}`;
const unlimited = (n: number) => (n === 0 ? 'Unlimited' : n.toLocaleString('en-IN'));

export default function Pricing() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [annual, setAnnual] = useState(true);
  const [err, setErr] = useState('');
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const planPreselect = sp.get('plan') || '';

  useEffect(() => {
    api.get('/billing/public/plans/')
      .then(r => setPlans(r.data.results ?? r.data))
      .catch(e => setErr(e?.response?.data?.detail || 'Failed to load plans'));
  }, []);

  const chooseCta = (p: Plan) => {
    if (p.slug === 'enterprise') return window.location.href = 'mailto:sales@vyaparpro.app?subject=Enterprise%20plan%20enquiry';
    nav(`/signup?plan=${p.slug}&cycle=${annual ? 'annual' : 'monthly'}`);
  };

  const sorted = useMemo(() => [...plans].sort((a, b) => a.price_monthly - b.price_monthly), [plans]);

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={0}>
        <Toolbar sx={{ gap: 2 }}>
          <Stack direction="row" alignItems="center" spacing={1.25} component={RouterLink} to="/" sx={{ textDecoration: 'none', color: 'inherit' }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: 1.25, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
            }}>
              <AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700, letterSpacing: 0 }}>VyaparPro</Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/auth/login" size="small">Sign in</Button>
          <Button component={RouterLink} to="/pricing" size="small" variant="contained">Start free trial</Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" sx={{ py: { xs: 4, md: 8 } }}>
        <Stack alignItems="center" spacing={1.5} sx={{ mb: { xs: 3, md: 5 }, textAlign: 'center' }}>
          <Chip size="small" color="primary" icon={<WorkspacePremiumOutlinedIcon />} label="Pricing · simple. Indian rupees." />
          <Typography variant="h3" sx={{ fontWeight: 700, letterSpacing: 0, fontSize: { xs: 28, md: 40 } }}>
            Pick a plan that fits your shop
          </Typography>
          <Typography color="text.secondary" sx={{ maxWidth: 620 }}>
            GST-ready invoicing · inventory · payments · multi-branch. Every plan ships with full
            accounting — you pay as you scale.
          </Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mt: 1 }}>
            <Typography variant="body2" sx={{ fontWeight: annual ? 400 : 600 }}>Monthly</Typography>
            <Switch checked={annual} onChange={e => setAnnual(e.target.checked)} />
            <Typography variant="body2" sx={{ fontWeight: annual ? 600 : 400 }}>Annual</Typography>
            <Chip size="small" color="success" label="Save 20%" sx={{ ml: 0.5 }} />
          </Stack>
        </Stack>

        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

        <Grid container spacing={2}>
          {sorted.map(p => {
            const highlight = p.slug === 'pro' || p.slug === planPreselect;
            const priceN = annual ? p.price_annual / 12 : p.price_monthly;
            const badge = p.slug === 'pro' ? 'Most popular' : p.slug === 'enterprise' ? 'Talk to us' : '';
            return (
              <Grid item xs={12} sm={6} md={3} key={p.slug}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor: highlight ? 'primary.main' : 'divider',
                    borderWidth: highlight ? 1.5 : 1,
                    height: '100%', position: 'relative',
                    ...(highlight && { boxShadow: (t) => `0 8px 24px ${t.palette.primary.main}22` }),
                  }}
                >
                  {badge && (
                    <Chip size="small" color={p.slug === 'pro' ? 'primary' : 'default'} label={badge}
                      sx={{ position: 'absolute', top: 12, right: 12 }} />
                  )}
                  <CardContent>
                    <Typography variant="h6" sx={{ fontWeight: 700 }}>{p.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      {p.slug === 'free'      && 'Try the basics, free forever'}
                      {p.slug === 'starter'   && 'For solo shops'}
                      {p.slug === 'growth'    && 'For growing teams'}
                      {p.slug === 'pro'       && 'Advanced reporting · GST · API'}
                      {p.slug === 'enterprise'&& 'Multi-branch · SSO · Custom SLAs'}
                    </Typography>

                    <Box sx={{ my: 2 }}>
                      {p.slug === 'enterprise' ? (
                        <Typography variant="h4" sx={{ fontWeight: 700 }}>Custom</Typography>
                      ) : (
                        <Stack direction="row" alignItems="baseline" spacing={0.5}>
                          <Typography variant="h4" className="num" sx={{ fontWeight: 700 }}>
                            {fmtINR(Math.round(priceN))}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">/ mo</Typography>
                        </Stack>
                      )}
                      {annual && p.price_annual > 0 && (
                        <Typography variant="caption" color="text.secondary">
                          Billed annually — {fmtINR(p.price_annual)}
                        </Typography>
                      )}
                    </Box>

                    <Button
                      fullWidth
                      size="large"
                      variant={highlight ? 'contained' : 'outlined'}
                      onClick={() => chooseCta(p)}
                    >
                      {p.slug === 'free' ? 'Start free'
                       : p.slug === 'enterprise' ? 'Contact sales'
                       : `Start ${p.name}`}
                    </Button>

                    <Divider sx={{ my: 2 }} />

                    <Stack spacing={1}>
                      <Bullet ok={true} text={`${unlimited(p.max_branches)} branch${p.max_branches === 1 ? '' : 'es'}`} />
                      <Bullet ok={true} text={`${unlimited(p.max_users)} users`} />
                      <Bullet ok={true} text={`${p.max_invoices_per_month === 0 ? 'Unlimited' : p.max_invoices_per_month.toLocaleString('en-IN')} invoices/mo`} />
                      {HEADLINE_FEATURES.map(f => (
                        <Bullet key={f.key} ok={!!p.features?.[f.key]} text={f.label} />
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>

        <Box sx={{ mt: 6, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            All plans · GST-ready · No credit card required for trial · Cancel anytime
          </Typography>
        </Box>
      </Container>
    </Box>
  );
}

function Bullet({ ok, text }: { ok: boolean; text: string }) {
  return (
    <Stack direction="row" spacing={1} alignItems="center">
      {ok
        ? <CheckCircleOutlineIcon fontSize="small" color="success" />
        : <RemoveCircleOutlineIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
      <Typography variant="body2" sx={{ color: ok ? 'text.primary' : 'text.disabled' }}>{text}</Typography>
    </Stack>
  );
}
