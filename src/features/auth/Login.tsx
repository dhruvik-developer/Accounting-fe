import { useEffect, useState } from 'react';
import { Alert, Box, Button, Link, Stack, TextField, Typography } from '@mui/material';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { api } from '@/app/api';

export default function Login() {
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  // Already-authenticated users land on /dashboard instead of staring at a
  // login form. Superusers go to the platform console.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!localStorage.getItem('access')) return;
    nav(localStorage.getItem('is_superuser') === 'true' ? '/platform' : '/dashboard', { replace: true });
  }, [nav]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr(''); setLoading(true);
    try {
      const { data } = await api.post('/auth/login/', { email, password });
      localStorage.setItem('access', data.access);
      localStorage.setItem('refresh', data.refresh);
      const u = data.user || {};
      localStorage.setItem('is_superuser', String(!!u.is_superuser));
      localStorage.setItem('platform_role', u.platform_role || '');
      localStorage.removeItem('business_id');
      localStorage.removeItem('branch_id');

      // Route by role:
      //   owner / admin → /platform   (last visit can override via ?next=)
      //   tenant user   → /dashboard  (existing dashboard / onboarding flow)
      if (u.is_superuser || u.is_platform_admin) {
        nav('/platform');
      } else {
        nav('/dashboard');
      }
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Login failed');
    } finally { setLoading(false); }
  };

  const emailError = email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? 'Enter a valid email'
    : undefined;
  const canSubmit = !!email && !!password && !emailError && !loading;

  return (
    <Box component="form" onSubmit={submit} noValidate>
      <Typography variant="body2" gutterBottom>Sign in to your account</Typography>
      <Stack spacing={2} sx={{ mt: 2 }}>
        {err && <Alert severity="error">{err}</Alert>}
        <TextField label="Email" type="email" value={email}
          onChange={e => setEmail(e.target.value)} required fullWidth
          error={!!emailError} helperText={emailError}
          autoComplete="email" autoFocus />
        <TextField label="Password" type="password" value={password}
          onChange={e => setPassword(e.target.value)} required fullWidth
          autoComplete="current-password" />
        <Button type="submit" variant="contained" disabled={!canSubmit}>
          {loading ? 'Signing in…' : 'Login'}
        </Button>
        <Typography variant="body2">
          New here? <Link component={RouterLink} to="/signup">Create an account</Link>
        </Typography>
      </Stack>
    </Box>
  );
}
