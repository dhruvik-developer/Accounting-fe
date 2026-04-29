import { useEffect, useState } from 'react';
import {
  Box, Card, CardContent, IconButton, LinearProgress, Stack, Typography,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked';
import CloseIcon from '@mui/icons-material/Close';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import WorkspacePremiumOutlinedIcon from '@mui/icons-material/WorkspacePremiumOutlined';
import { useNavigate } from 'react-router-dom';
import { api } from '@/app/api';

type Step = { key: string; label: string; hint: string; to: string };

const STEPS: Step[] = [
  { key: 'first_customer_added',  label: 'Add your first customer',  hint: 'Customers are needed before you can send an invoice.', to: '/parties?new=1' },
  { key: 'first_invoice_issued',  label: 'Issue your first invoice', hint: 'Create and send an invoice to a customer.',           to: '/sales/invoices/new' },
  { key: 'first_payment_recorded',label: 'Record your first payment',hint: 'Mark an invoice paid to close the loop.',             to: '/payments?new=1' },
  { key: 'second_user_invited',   label: 'Invite a teammate',        hint: 'Your staff can issue invoices too.',                  to: '/team' },
  { key: 'template_customized',   label: 'Brand your invoice template', hint: 'Add your logo and colours.',                       to: '/templates' },
];

const DISMISS_KEY = 'checklist.dismissed';

export default function FirstRunChecklist() {
  const [events, setEvents] = useState<Set<string>>(new Set());
  const [dismissed, setDismissed] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(DISMISS_KEY) === '1',
  );
  const [loaded, setLoaded] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    api.get('/billing/activation-events/')
      .then(r => setEvents(new Set<string>(r.data?.events || [])))
      .catch(() => setEvents(new Set()))
      .finally(() => setLoaded(true));
  }, []);

  if (!loaded || dismissed) return null;

  const done = STEPS.filter(s => events.has(s.key)).length;
  const total = STEPS.length;
  // Auto-hide at 5/5 completed.
  if (done === total) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setDismissed(true);
  };

  return (
    <Card
      variant="outlined"
      sx={{
        mb: 2,
        background: (t) => `linear-gradient(135deg, ${t.palette.primary.main}08, ${t.palette.secondary.main}08)`,
      }}
    >
      <CardContent>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
          <WorkspacePremiumOutlinedIcon color="primary" fontSize="small" />
          <Typography variant="subtitle1" sx={{ flex: 1 }}>Get started · {done} of {total}</Typography>
          <IconButton size="small" onClick={dismiss} aria-label="Dismiss">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>

        <LinearProgress
          variant="determinate"
          value={(done / total) * 100}
          sx={{ height: 6, borderRadius: 3, mb: 1.5 }}
        />

        <Stack spacing={0.5}>
          {STEPS.map(s => {
            const ok = events.has(s.key);
            return (
              <Stack
                key={s.key}
                direction="row"
                alignItems="center"
                spacing={1.25}
                onClick={() => !ok && nav(s.to)}
                sx={{
                  px: 1, py: 0.75, borderRadius: 1,
                  cursor: ok ? 'default' : 'pointer',
                  '&:hover': !ok ? { bgcolor: 'action.hover' } : undefined,
                }}
              >
                {ok
                  ? <CheckCircleIcon color="success" fontSize="small" />
                  : <RadioButtonUncheckedIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" sx={{ textDecoration: ok ? 'line-through' : 'none', color: ok ? 'text.disabled' : 'text.primary' }}>
                    {s.label}
                  </Typography>
                  {!ok && <Typography variant="caption" color="text.secondary">{s.hint}</Typography>}
                </Box>
                {!ok && <ArrowForwardIcon fontSize="small" sx={{ color: 'text.disabled' }} />}
              </Stack>
            );
          })}
        </Stack>
      </CardContent>
    </Card>
  );
}
