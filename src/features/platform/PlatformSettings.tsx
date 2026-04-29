import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Card, CardContent, FormControlLabel, Grid,
  InputAdornment, MenuItem, Stack, Switch, TextField, Typography,
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import ColorLensOutlinedIcon from '@mui/icons-material/ColorLensOutlined';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { api } from '@/app/api';
import { useBrand } from '@/app/brand';
import PageHeader from '@/components/PageHeader';

type Settings = {
  app_name: string; tagline: string;
  primary_color: string; accent_color: string;
  logo_url: string; favicon_url: string;
  default_currency: string; default_timezone: string; support_email: string;
  default_trial_plan_slug: string; default_trial_days: number;
  email_from_name: string; email_from_address: string;
  maintenance_mode: boolean; maintenance_message: string;
};

type Plan = {
  slug: string;
  name: string;
  price_monthly: number;
};

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD'];
const TIMEZONES = [
  'Asia/Kolkata', 'Asia/Dubai', 'Asia/Singapore', 'Europe/London',
  'America/New_York', 'America/Los_Angeles', 'UTC',
];

export default function PlatformSettings() {
  const [s, setS] = useState<Settings | null>(null);
  const [original, setOriginal] = useState<Settings | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const { refresh } = useBrand();

  const load = () => {
    Promise.all([
      api.get('/platform/settings/'),
      api.get('/billing/plans/').catch(() => ({ data: [] })),
    ]).then(([settingsRes, plansRes]) => {
      setS(settingsRes.data);
      setOriginal(settingsRes.data);
      setPlans(plansRes.data.results ?? plansRes.data);
    }).catch(e => setErr(e?.response?.data?.detail || 'Failed to load'));
  };
  useEffect(load, []);

  const dirty = s && original && JSON.stringify(s) !== JSON.stringify(original);

  const save = async () => {
    if (!s) return;
    setSaving(true);
    try {
      const r = await api.patch('/platform/settings/', s);
      setS(r.data); setOriginal(r.data);
      setMsg('Settings saved.');
      refresh();  // reload brand globally → topbar/title update immediately
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Save failed');
    } finally { setSaving(false); }
  };

  const reset = () => { if (original) setS(original); };

  if (!s) return (
    <Box>
      <PageHeader title="Platform settings" />
      {err ? <Alert severity="error">{err}</Alert> : <Typography color="text.secondary">Loading…</Typography>}
    </Box>
  );

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setS({ ...s, [k]: v });

  return (
    <Box>
      <PageHeader
        title="Platform settings"
        subtitle="Brand · System · Trial · Email · Maintenance"
        actions={
          <>
            <Button size="small" startIcon={<RestartAltOutlinedIcon />} onClick={reset} disabled={!dirty}>Discard</Button>
            <Button size="small" variant="contained" startIcon={<SaveOutlinedIcon />} onClick={save} disabled={!dirty || saving}>
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
          </>
        }
      />
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Grid container spacing={2}>
        {/* Brand */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <ColorLensOutlinedIcon fontSize="small" color="primary" /> Brand
              </Typography>
              <Stack spacing={2}>
                <TextField label="App name" value={s.app_name} onChange={e => set('app_name', e.target.value)} fullWidth />
                <TextField label="Tagline" value={s.tagline} onChange={e => set('tagline', e.target.value)} fullWidth />
                <Stack direction="row" spacing={2}>
                  <TextField
                    label="Primary color" value={s.primary_color}
                    onChange={e => set('primary_color', e.target.value)}
                    InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <Box sx={{ width: 18, height: 18, borderRadius: 0.75, bgcolor: s.primary_color, border: 1, borderColor: 'divider' }} />
                      </InputAdornment>
                    ) }}
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    label="Accent color" value={s.accent_color}
                    onChange={e => set('accent_color', e.target.value)}
                    InputProps={{ startAdornment: (
                      <InputAdornment position="start">
                        <Box sx={{ width: 18, height: 18, borderRadius: 0.75, bgcolor: s.accent_color, border: 1, borderColor: 'divider' }} />
                      </InputAdornment>
                    ) }}
                    sx={{ flex: 1 }}
                  />
                </Stack>
                <TextField label="Logo URL" placeholder="https://…/logo.png" value={s.logo_url} onChange={e => set('logo_url', e.target.value)} fullWidth />
                <TextField label="Favicon URL" placeholder="https://…/favicon.ico" value={s.favicon_url} onChange={e => set('favicon_url', e.target.value)} fullWidth />

                {/* Live brand preview */}
                <Box sx={{ p: 2, border: '1px dashed', borderColor: 'divider', borderRadius: 1.5,
                  background: `linear-gradient(135deg, ${s.primary_color}10, ${s.accent_color}10)` }}>
                  <Stack direction="row" alignItems="center" spacing={1.5}>
                    <Avatar src={s.logo_url} sx={{ bgcolor: s.primary_color, width: 36, height: 36 }}>
                      {s.app_name.charAt(0)}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.1 }}>{s.app_name}</Typography>
                      <Typography variant="caption" color="text.secondary">{s.tagline}</Typography>
                    </Box>
                  </Stack>
                </Box>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* System */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>System</Typography>
              <Stack spacing={2}>
                <TextField select label="Default currency" value={s.default_currency} onChange={e => set('default_currency', e.target.value)} fullWidth>
                  {CURRENCIES.map(c => <MenuItem key={c} value={c}>{c}</MenuItem>)}
                </TextField>
                <TextField select label="Default timezone" value={s.default_timezone} onChange={e => set('default_timezone', e.target.value)} fullWidth>
                  {TIMEZONES.map(tz => <MenuItem key={tz} value={tz}>{tz}</MenuItem>)}
                </TextField>
                <TextField label="Support email" type="email" value={s.support_email} onChange={e => set('support_email', e.target.value)} fullWidth />
              </Stack>
            </CardContent>
          </Card>

          {/* Trial defaults */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                <WorkspacePremiumOutlinedIcon fontSize="small" color="primary" /> Signup trial
              </Typography>
              <Stack spacing={2}>
                <TextField
                  select
                  label="Default trial plan"
                  value={s.default_trial_plan_slug}
                  onChange={e => set('default_trial_plan_slug', e.target.value)}
                  fullWidth
                  helperText="Used when a customer signs up without a specific plan link, and when a new business needs an automatic trial."
                >
                  {plans.map(plan => (
                    <MenuItem key={plan.slug} value={plan.slug}>
                      {plan.name} — ₹{Number(plan.price_monthly || 0).toLocaleString('en-IN')}/mo
                    </MenuItem>
                  ))}
                </TextField>
                <TextField
                  label="Trial days"
                  type="number"
                  value={s.default_trial_days}
                  onChange={e => set('default_trial_days', Math.max(1, Number(e.target.value || 1)))}
                  fullWidth
                  inputProps={{ min: 1, max: 365 }}
                  helperText={`Current default: ${s.default_trial_days} days on ${plans.find(p => p.slug === s.default_trial_plan_slug)?.name || s.default_trial_plan_slug}.`}
                />
              </Stack>
            </CardContent>
          </Card>

          {/* Email From */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Email from</Typography>
              <Stack spacing={2}>
                <TextField label="From name" value={s.email_from_name} onChange={e => set('email_from_name', e.target.value)} fullWidth />
                <TextField label="From address" type="email" value={s.email_from_address} onChange={e => set('email_from_address', e.target.value)} fullWidth />
                <Typography variant="caption" color="text.secondary">
                  All transactional emails (welcome, trial nudges, dunning) use this From identity.
                </Typography>
              </Stack>
            </CardContent>
          </Card>

          {/* Maintenance */}
          <Card sx={{ mt: 2 }}>
            <CardContent>
              <Typography variant="subtitle1" sx={{ mb: 2 }}>Maintenance</Typography>
              <FormControlLabel
                control={<Switch checked={s.maintenance_mode} onChange={e => set('maintenance_mode', e.target.checked)} color="warning" />}
                label="Maintenance mode (shows banner on every page)"
              />
              <TextField
                fullWidth
                multiline minRows={2}
                sx={{ mt: 2 }}
                label="Maintenance message"
                value={s.maintenance_message}
                onChange={e => set('maintenance_message', e.target.value)}
                disabled={!s.maintenance_mode}
              />
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
