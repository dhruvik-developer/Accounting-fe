import { useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Link, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '@/app/api';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function Register() {
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', username: '', password: '', first_name: '', last_name: '', phone: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  // Don't show a register form to a user who's already signed in.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('access')) return;
    nav(localStorage.getItem('is_superuser') === 'true' ? '/platform' : '/dashboard', { replace: true });
  }, [nav]);

  // Per-field validation. Errors only reveal after the field is "touched"
  // so the form doesn't yell at the user before they've typed.
  const errors = useMemo(() => {
    const e: Record<string, string> = {};
    if (!form.first_name.trim()) e.first_name = 'First name is required';
    if (!form.email.trim()) e.email = 'Email is required';
    else if (!EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address';
    if (!form.username.trim()) e.username = 'Username is required';
    else if (form.username.length < 3) e.username = 'At least 3 characters';
    if (!form.password) e.password = 'Password is required';
    else if (form.password.length < 8) e.password = 'At least 8 characters';
    if (form.phone && form.phone.replace(/\D/g, '').length < 7) e.phone = 'Phone too short';
    return e;
  }, [form]);

  const valid = Object.keys(errors).length === 0;
  const fieldError = (k: keyof typeof form) => (touched[k] ? errors[k] : undefined);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Reveal all errors on submit
    setTouched({ first_name: true, email: true, username: true, password: true, phone: true });
    if (!valid) return;
    setBusy(true);
    setErr('');
    try {
      await api.post('/auth/register/', form);
      const { data } = await api.post('/auth/login/', { email: form.email, password: form.password });
      localStorage.setItem('access', data.access);
      localStorage.setItem('refresh', data.refresh);
      localStorage.setItem('is_superuser', String(!!data.user?.is_superuser));
      localStorage.removeItem('business_id');
      localStorage.removeItem('branch_id');
      nav('/onboarding');
    } catch (e: any) {
      const data = e?.response?.data;
      // DRF returns either {detail: '...'} or {field: ['msg']} — flatten both.
      let msg = 'Signup failed.';
      if (typeof data === 'string') msg = data;
      else if (data?.detail) msg = data.detail;
      else if (data && typeof data === 'object') {
        msg = Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(', ') : v}`).join(' · ');
      }
      setErr(msg);
    } finally {
      setBusy(false);
    }
  };

  const onBlur = (k: string) => () => setTouched((t) => ({ ...t, [k]: true }));
  const upd = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Typography variant="body2">Create your account</Typography>
      <Stack spacing={2} sx={{ mt: 2 }}>
        {err && <Alert severity="error">{err}</Alert>}
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField label="First name" required fullWidth value={form.first_name}
            onChange={upd('first_name')} onBlur={onBlur('first_name')}
            error={!!fieldError('first_name')} helperText={fieldError('first_name')} />
          <TextField label="Last name" fullWidth value={form.last_name}
            onChange={upd('last_name')} />
        </Stack>
        <TextField label="Email" type="email" required fullWidth value={form.email}
          onChange={upd('email')} onBlur={onBlur('email')}
          error={!!fieldError('email')} helperText={fieldError('email')} />
        <TextField label="Username" required fullWidth value={form.username}
          onChange={upd('username')} onBlur={onBlur('username')}
          error={!!fieldError('username')} helperText={fieldError('username')} />
        <TextField label="Phone" fullWidth value={form.phone}
          onChange={upd('phone')} onBlur={onBlur('phone')}
          error={!!fieldError('phone')} helperText={fieldError('phone')} />
        <TextField label="Password" type="password" required fullWidth value={form.password}
          onChange={upd('password')} onBlur={onBlur('password')}
          error={!!fieldError('password')}
          helperText={fieldError('password') || 'Use at least 8 characters'} />
        <Button
          type="submit"
          variant="contained"
          disabled={busy}
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {busy ? 'Creating account…' : 'Sign up'}
        </Button>
        <Typography variant="body2">
          Already have an account? <Link component={RouterLink} to="/auth/login">Login</Link>
        </Typography>
      </Stack>
    </Box>
  );
}
