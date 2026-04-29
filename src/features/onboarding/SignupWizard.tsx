import { useEffect, useMemo, useState } from 'react';
import {
  Alert, AppBar, Box, Button, Chip, Container, Grid, LinearProgress,
  MenuItem, Paper, Stack, Step, StepLabel, Stepper, TextField, Toolbar, Typography,
} from '@mui/material';
import AutoAwesomeOutlinedIcon from '@mui/icons-material/AutoAwesomeOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import InventoryOutlinedIcon from '@mui/icons-material/InventoryOutlined';
import BuildCircleOutlinedIcon from '@mui/icons-material/BuildCircleOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/app/api';
import { useBrand } from '@/app/brand';
import { GST_STATES } from '@/app/gstStates';

type Step1 = { first_name: string; last_name: string; email: string; password: string };
type Step2 = { name: string; state: string; state_code: string; gstin: string };
type Step3 = { industry: 'retail' | 'wholesale' | 'services' | 'manufacturing' | '' };
type Plan = { slug: string; name: string; price_monthly: number; price_annual: number };

const INDUSTRIES: { key: Step3['industry']; label: string; icon: React.ReactNode; hint: string }[] = [
  { key: 'retail',        label: 'Retail',        icon: <StorefrontOutlinedIcon />,   hint: 'Shop / store' },
  { key: 'wholesale',     label: 'Wholesale',     icon: <InventoryOutlinedIcon />,    hint: 'Distribution' },
  { key: 'services',      label: 'Services',      icon: <BuildCircleOutlinedIcon />,  hint: 'Consulting / trades' },
  { key: 'manufacturing', label: 'Manufacturing', icon: <AutoAwesomeOutlinedIcon />,  hint: 'Factory / units' },
];

export default function SignupWizard() {
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { brand } = useBrand();
  const selectedPlan = sp.get('plan') || brand.default_trial_plan_slug || 'growth';
  const selectedCycle = sp.get('cycle') || 'monthly';
  const trialDays = Math.max(1, Number(brand.default_trial_days || 14));

  const [step, setStep] = useState(0);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');

  const [s1, setS1] = useState<Step1>({ first_name: '', last_name: '', email: '', password: '' });
  const [s2, setS2] = useState<Step2>({ name: '', state: '', state_code: '', gstin: '' });
  const [s3, setS3] = useState<Step3>({ industry: '' });

  const step1Valid = s1.first_name.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s1.email) && s1.password.length >= 8;
  const step2Valid = s2.name.trim().length > 0 && s2.state_code;
  const step3Valid = !!s3.industry;
  const plan = useMemo(() => plans.find(p => p.slug === selectedPlan), [plans, selectedPlan]);

  useEffect(() => {
    api.get('/billing/public/plans/')
      .then(r => setPlans(r.data.results ?? r.data))
      .catch(() => {});
  }, []);

  const submit = async () => {
    setErr(''); setSubmitting(true);
    try {
      await api.post('/auth/register/', {
        email: s1.email,
        first_name: s1.first_name,
        last_name: s1.last_name,
        password: s1.password,
        business: { name: s2.name, state: s2.state, state_code: s2.state_code, gstin: s2.gstin },
        industry: s3.industry,
        plan_slug: selectedPlan,
        billing_cycle: selectedCycle,
      });
      // Auto-login so user lands on Dashboard
      const login = await api.post('/auth/login/', { email: s1.email, password: s1.password });
      localStorage.setItem('access', login.data.access);
      localStorage.setItem('refresh', login.data.refresh);
      localStorage.setItem('is_superuser', String(!!login.data.user?.is_superuser));

      // Pick the business we just created
      const biz = await api.get('/tenants/businesses/', {
        headers: { Authorization: `Bearer ${login.data.access}` },
      });
      const newBiz = (biz.data.results ?? biz.data)[0];
      if (newBiz) localStorage.setItem('business_id', newBiz.id);
      localStorage.removeItem('branch_id');
      nav('/dashboard?welcome=1');
    } catch (e: any) {
      setErr(flattenErr(e));
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ bgcolor: 'background.default', minHeight: '100vh' }}>
      <AppBar position="sticky" elevation={0}>
        <Toolbar>
          <Stack direction="row" alignItems="center" spacing={1.25} component={RouterLink} to="/pricing" sx={{ textDecoration: 'none', color: 'inherit' }}>
            <Box sx={{
              width: 30, height: 30, borderRadius: 1.25, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}, ${t.palette.secondary.main})`,
            }}>
              <AutoAwesomeOutlinedIcon sx={{ fontSize: 18 }} />
            </Box>
            <Typography variant="h6" sx={{ fontWeight: 700 }}>VyaparPro</Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Button component={RouterLink} to="/auth/login" size="small">Sign in</Button>
        </Toolbar>
      </AppBar>
      {submitting && <LinearProgress />}

      <Container maxWidth="sm" sx={{ py: { xs: 4, md: 6 } }}>
        <Stack alignItems="center" spacing={1} sx={{ mb: 3, textAlign: 'center' }}>
          <Chip size="small" color="primary" icon={<WorkspacePremiumOutlinedIcon />}
            label={`Starting on ${plan?.name || selectedPlan || 'selected plan'} · ${trialDays}-day trial`} />
          <Typography variant="h4" sx={{ fontWeight: 700, letterSpacing: -0.4 }}>Create your account</Typography>
          <Typography color="text.secondary" variant="body2">
            Takes under 30 seconds. No credit card required.
          </Typography>
          <Button component={RouterLink} to="/pricing" size="small">
            Change plan
          </Button>
        </Stack>

        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 } }}>
          <Stepper activeStep={step} alternativeLabel sx={{ mb: 3 }}>
            <Step><StepLabel>Account</StepLabel></Step>
            <Step><StepLabel>Business</StepLabel></Step>
            <Step><StepLabel>Industry</StepLabel></Step>
          </Stepper>

          {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}

          {step === 0 && (
            <Grid container spacing={2}>
              <Grid item xs={6}>
                <TextField label="First name" fullWidth required autoFocus value={s1.first_name} onChange={e => setS1({ ...s1, first_name: e.target.value })} />
              </Grid>
              <Grid item xs={6}>
                <TextField label="Last name" fullWidth value={s1.last_name} onChange={e => setS1({ ...s1, last_name: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Work email" type="email" fullWidth required value={s1.email} onChange={e => setS1({ ...s1, email: e.target.value })} />
              </Grid>
              <Grid item xs={12}>
                <TextField label="Password" type="password" fullWidth required helperText="At least 8 characters."
                  value={s1.password} onChange={e => setS1({ ...s1, password: e.target.value })} />
              </Grid>
            </Grid>
          )}

          {step === 1 && (
            <Grid container spacing={2}>
              <Grid item xs={12}>
                <TextField label="Business name" fullWidth required autoFocus value={s2.name} onChange={e => setS2({ ...s2, name: e.target.value })} />
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField select label="State" fullWidth required value={s2.state}
                  onChange={e => {
                    const st = GST_STATES.find(s => s.name === e.target.value);
                    setS2({ ...s2, state: e.target.value, state_code: st?.code || '' });
                  }}>
                  {GST_STATES.map(st => <MenuItem key={st.code} value={st.name}>{st.name}</MenuItem>)}
                </TextField>
              </Grid>
              <Grid item xs={12} sm={6}>
                <TextField label="GSTIN (optional)" fullWidth value={s2.gstin} onChange={e => setS2({ ...s2, gstin: e.target.value.toUpperCase() })} helperText="Add later in Settings." />
              </Grid>
            </Grid>
          )}

          {step === 2 && (
            <Stack spacing={1.5}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Pick what best describes your business — we'll tailor defaults accordingly.
              </Typography>
              <Grid container spacing={1.5}>
                {INDUSTRIES.map(i => {
                  const active = s3.industry === i.key;
                  return (
                    <Grid item xs={6} key={i.key}>
                      <Paper
                        variant="outlined"
                        onClick={() => setS3({ industry: i.key })}
                        sx={{
                          p: 2, cursor: 'pointer',
                          borderColor: active ? 'primary.main' : 'divider',
                          borderWidth: active ? 1.5 : 1,
                          bgcolor: active ? 'action.hover' : 'background.paper',
                          transition: 'border-color 160ms',
                        }}
                      >
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Box sx={{ color: active ? 'primary.main' : 'text.secondary' }}>{i.icon}</Box>
                          <Box>
                            <Typography variant="subtitle2">{i.label}</Typography>
                            <Typography variant="caption" color="text.secondary">{i.hint}</Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </Stack>
          )}

          <Stack direction="row" justifyContent="space-between" sx={{ mt: 3 }}>
            <Button disabled={step === 0 || submitting} onClick={() => setStep(s => s - 1)}>Back</Button>
            {step < 2 ? (
              <Button
                variant="contained"
                onClick={() => setStep(s => s + 1)}
                disabled={(step === 0 && !step1Valid) || (step === 1 && !step2Valid) || submitting}
              >
                Continue
              </Button>
            ) : (
              <Button variant="contained" onClick={submit} disabled={!step3Valid || submitting}>
                {submitting ? 'Creating account…' : `Start my ${trialDays}-day trial`}
              </Button>
            )}
          </Stack>
        </Paper>

        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', textAlign: 'center', mt: 2 }}>
          Already have an account? <RouterLink to="/auth/login" style={{ color: 'inherit' }}>Sign in</RouterLink>
        </Typography>
      </Container>
    </Box>
  );
}

function flattenErr(e: any): string {
  const d = e?.response?.data;
  if (!d) return e?.message || 'Signup failed';
  if (typeof d === 'string') return d;
  if (d.detail) return d.detail;
  const first = Object.entries(d)[0];
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`;
  return 'Signup failed';
}
