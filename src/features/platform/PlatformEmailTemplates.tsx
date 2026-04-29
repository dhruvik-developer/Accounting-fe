import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Card, CardContent, Chip, Divider, FormControlLabel,
  Grid, List, ListItemButton, ListItemText, Stack, Switch, TextField, Typography,
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import RestartAltOutlinedIcon from '@mui/icons-material/RestartAltOutlined';
import SendOutlinedIcon from '@mui/icons-material/SendOutlined';
import { api } from '@/app/api';
import PageHeader from '@/components/PageHeader';

type Template = {
  template_key: string;
  subject: string;
  body: string;
  is_active: boolean;
  is_overridden: boolean;
  default_subject: string;
  default_body: string;
};

const PRETTY: Record<string, string> = {
  welcome: 'Welcome',
  activation_nudge_day_3: 'Activation nudge (day 3)',
  trial_ending_day_10: 'Trial ending — day 10',
  trial_ending_day_13: 'Trial ending — day 13',
  trial_ended_day_14: 'Trial ended — day 14',
  payment_failed: 'Payment failed',
  dunning_reminder: 'Dunning reminder',
  cancellation_confirmation: 'Cancellation confirmation',
  win_back_day_30: 'Win-back (day 30)',
};

const PLACEHOLDERS = [
  '{first_name}', '{plan_name}', '{trial_ends}', '{period_end}',
  '{app_url}', '{upgrade_url}', '{billing_url}', '{pricing_url}',
  '{amount}', '{dunning_attempts}', '{coupon_code}',
];

const SAMPLE_CTX: Record<string, string> = {
  '{first_name}': 'Amit',
  '{plan_name}': 'Pro',
  '{trial_ends}': '30 May 2026',
  '{period_end}': '30 May 2026',
  '{app_url}': 'https://vyaparpro.app',
  '{upgrade_url}': 'https://vyaparpro.app/pricing',
  '{billing_url}': 'https://vyaparpro.app/billing/invoices',
  '{pricing_url}': 'https://vyaparpro.app/pricing',
  '{amount}': '₹1,499.00',
  '{dunning_attempts}': '2',
  '{coupon_code}': 'COMEBACK30',
};

const renderPreview = (s: string) =>
  Object.entries(SAMPLE_CTX).reduce((acc, [k, v]) => acc.replaceAll(k, v), s);

export default function PlatformEmailTemplates() {
  const [rows, setRows] = useState<Template[]>([]);
  const [activeKey, setActiveKey] = useState('');
  const [draft, setDraft] = useState<Template | null>(null);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  const load = async () => {
    try {
      const r = await api.get('/platform/email-templates/');
      const arr = (r.data.results ?? r.data) as Template[];
      setRows(arr);
      if (!activeKey && arr[0]) setActiveKey(arr[0].template_key);
    } catch (e: any) { setErr(e?.response?.data?.detail || 'Failed to load'); }
  };
  useEffect(() => { load(); /* eslint-disable-line */ }, []);

  const active = useMemo(() => rows.find(r => r.template_key === activeKey) || null, [rows, activeKey]);

  useEffect(() => { setDraft(active ? { ...active } : null); }, [activeKey]); // eslint-disable-line

  const dirty = active && draft && (
    draft.subject !== active.subject ||
    draft.body !== active.body ||
    draft.is_active !== active.is_active
  );

  const save = async () => {
    if (!draft) return;
    try {
      await api.patch(`/platform/email-templates/${draft.template_key}/`, {
        subject: draft.subject, body: draft.body, is_active: draft.is_active,
      });
      setMsg(`${PRETTY[draft.template_key] || draft.template_key} saved.`);
      load();
    } catch (e: any) { setErr(flatten(e)); }
  };

  const reset = async () => {
    if (!draft) return;
    if (!confirm('Reset to the built-in default? This deletes your override.')) return;
    try {
      await api.delete(`/platform/email-templates/${draft.template_key}/`);
      setMsg('Reset to default.'); load();
    } catch (e: any) { setErr(flatten(e)); }
  };

  const sendTest = async () => {
    if (!draft) return;
    try {
      const r = await api.post(`/platform/email-templates/${draft.template_key}/send-test/`, {});
      setMsg(`Test email sent to ${r.data.sent_to}.`);
    } catch (e: any) { setErr(flatten(e)); }
  };

  return (
    <Box>
      <PageHeader
        title="Email templates"
        subtitle={`${rows.length} transactional template${rows.length > 1 ? 's' : ''}`}
      />

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      <Grid container spacing={2}>
        {/* Template list */}
        <Grid item xs={12} md={3}>
          <Card>
            <List dense>
              {rows.map(t => (
                <ListItemButton
                  key={t.template_key}
                  selected={t.template_key === activeKey}
                  onClick={() => setActiveKey(t.template_key)}
                >
                  <ListItemText
                    primary={PRETTY[t.template_key] || t.template_key}
                    secondary={
                      t.is_overridden ? (t.is_active ? 'Override active' : 'Override draft') : 'Default'
                    }
                  />
                  {t.is_overridden && t.is_active && <Chip size="small" label="Custom" color="primary" />}
                </ListItemButton>
              ))}
            </List>
          </Card>
        </Grid>

        {/* Editor + preview */}
        <Grid item xs={12} md={9}>
          {draft ? (
            <Card>
              <CardContent>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
                  <Typography variant="h6" sx={{ flex: 1 }}>
                    {PRETTY[draft.template_key] || draft.template_key}
                  </Typography>
                  <FormControlLabel
                    control={<Switch checked={draft.is_active} onChange={e => setDraft({ ...draft, is_active: e.target.checked })} />}
                    label="Use override"
                  />
                  <Button size="small" startIcon={<RestartAltOutlinedIcon />} onClick={reset}>Reset to default</Button>
                  <Button size="small" startIcon={<SendOutlinedIcon />} onClick={sendTest}>Send test</Button>
                  <Button size="small" variant="contained" startIcon={<SaveOutlinedIcon />} onClick={save} disabled={!dirty}>Save</Button>
                </Stack>

                <TextField
                  fullWidth label="Subject" value={draft.subject}
                  onChange={e => setDraft({ ...draft, subject: e.target.value })}
                  sx={{ mb: 2 }}
                />

                <TextField
                  fullWidth multiline minRows={10} label="Body" value={draft.body}
                  onChange={e => setDraft({ ...draft, body: e.target.value })}
                  helperText="Use placeholders below for dynamic content."
                />

                <Stack direction="row" spacing={0.75} flexWrap="wrap" sx={{ mt: 1 }}>
                  {PLACEHOLDERS.map(p => (
                    <Chip
                      key={p} size="small" variant="outlined" label={p}
                      onClick={() => setDraft({ ...draft, body: draft.body + ' ' + p })}
                    />
                  ))}
                </Stack>

                <Divider sx={{ my: 2 }} />

                <Typography variant="subtitle2" gutterBottom>Preview (sample data)</Typography>
                <Card variant="outlined" sx={{ background: 'background.default', p: 2 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                    Subject: {renderPreview(draft.subject)}
                  </Typography>
                  <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', fontFamily: 'IBM Plex Mono, monospace', fontSize: 13 }}>
                    {renderPreview(draft.body)}
                  </Typography>
                </Card>
              </CardContent>
            </Card>
          ) : (
            <Alert severity="info">Pick a template to edit.</Alert>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

function flatten(e: any): string {
  const d = e?.response?.data;
  if (!d) return e?.message || 'Request failed';
  if (typeof d === 'string') return d;
  if (d.detail) return d.detail;
  const first = Object.entries(d)[0];
  if (first) return `${first[0]}: ${Array.isArray(first[1]) ? first[1][0] : first[1]}`;
  return 'Request failed';
}
