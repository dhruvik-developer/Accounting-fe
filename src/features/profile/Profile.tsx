import { useEffect, useState } from 'react';
import {
  Alert, Avatar, Box, Button, Chip, Divider, Grid, Paper, Stack, TextField,
  Typography,
} from '@mui/material';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LockResetIcon from '@mui/icons-material/LockReset';
import SaveIcon from '@mui/icons-material/Save';
import { api } from '@/app/api';

type ProfileForm = {
  email: string;
  username: string;
  first_name: string;
  last_name: string;
  phone: string;
  is_superuser?: boolean;
  is_staff?: boolean;
};

const EMPTY_PROFILE: ProfileForm = {
  email: '',
  username: '',
  first_name: '',
  last_name: '',
  phone: '',
};

const EMPTY_PASSWORD = {
  current_password: '',
  new_password: '',
  confirm_password: '',
};

const describeError = (e: any, fallback: string) =>
  e?.response?.data?.detail
  || JSON.stringify(e?.response?.data)
  || e?.message
  || fallback;

export default function Profile() {
  const [form, setForm] = useState<ProfileForm>(EMPTY_PROFILE);
  const [password, setPassword] = useState(EMPTY_PASSWORD);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => {
    api.get('/auth/me/')
      .then(({ data }) => {
        setForm({
          email: data.email || '',
          username: data.username || '',
          first_name: data.first_name || '',
          last_name: data.last_name || '',
          phone: data.phone || '',
          is_superuser: !!data.is_superuser,
          is_staff: !!data.is_staff,
        });
      })
      .catch((e) => setErr(describeError(e, 'Failed to load profile')))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: keyof ProfileForm) => (e: any) => {
    setForm({ ...form, [key]: e.target.value });
  };

  const setPasswordField = (key: keyof typeof EMPTY_PASSWORD) => (e: any) => {
    setPassword({ ...password, [key]: e.target.value });
  };

  const saveProfile = async () => {
    setSaving(true);
    setErr('');
    setProfileMsg('');
    try {
      const { data } = await api.patch('/auth/me/', {
        email: form.email,
        username: form.username,
        first_name: form.first_name,
        last_name: form.last_name,
        phone: form.phone,
      });
      setForm({
        email: data.email || '',
        username: data.username || '',
        first_name: data.first_name || '',
        last_name: data.last_name || '',
        phone: data.phone || '',
        is_superuser: !!data.is_superuser,
        is_staff: !!data.is_staff,
      });
      setProfileMsg('Profile updated');
    } catch (e: any) {
      setErr(describeError(e, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const changePassword = async () => {
    setErr('');
    setPasswordMsg('');
    try {
      await api.post('/auth/change-password/', password);
      setPassword(EMPTY_PASSWORD);
      setPasswordMsg('Password updated');
    } catch (e: any) {
      setErr(describeError(e, 'Failed to update password'));
    }
  };

  const displayName = `${form.first_name} ${form.last_name}`.trim() || form.username || form.email;
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

  if (loading) return null;

  return (
    <Box>
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5">Profile</Typography>
          <Typography variant="body2" color="text.secondary">
            Manage your account details and password.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          {form.is_superuser && <Chip size="small" color="primary" label="Superadmin" />}
          {form.is_staff && !form.is_superuser && <Chip size="small" color="secondary" label="Staff" />}
        </Stack>
      </Stack>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      <Grid container spacing={2}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2 }}>
            <Stack spacing={2} alignItems="center">
              <Avatar sx={{ width: 88, height: 88, fontSize: 30 }}>
                {initials || <AccountCircleIcon fontSize="large" />}
              </Avatar>
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="subtitle1">{displayName}</Typography>
                <Typography variant="body2" color="text.secondary">{form.email}</Typography>
              </Box>
              <Divider flexItem />
              <Stack spacing={0.5} sx={{ width: '100%' }}>
                <Typography variant="caption" color="text.secondary">Username</Typography>
                <Typography variant="body2">{form.username || '-'}</Typography>
              </Stack>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" justifyContent="space-between">
                <Typography variant="subtitle1">Personal Details</Typography>
                <Button
                  variant="contained"
                  startIcon={<SaveIcon />}
                  onClick={saveProfile}
                  disabled={saving}
                >
                  Save
                </Button>
              </Stack>
              {profileMsg && (
                <Alert severity="success" onClose={() => setProfileMsg('')}>{profileMsg}</Alert>
              )}
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="First name" value={form.first_name} onChange={set('first_name')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Last name" value={form.last_name} onChange={set('last_name')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required label="Email" type="email" value={form.email} onChange={set('email')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth required label="Username" value={form.username} onChange={set('username')} />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Phone" value={form.phone} onChange={set('phone')} />
                </Grid>
              </Grid>
            </Stack>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Stack spacing={2}>
              <Stack direction="row" alignItems="center" spacing={1}>
                <LockResetIcon color="action" />
                <Typography variant="subtitle1">Change Password</Typography>
              </Stack>
              {passwordMsg && (
                <Alert severity="success" onClose={() => setPasswordMsg('')}>{passwordMsg}</Alert>
              )}
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Current password"
                    type="password"
                    value={password.current_password}
                    onChange={setPasswordField('current_password')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="New password"
                    type="password"
                    value={password.new_password}
                    onChange={setPasswordField('new_password')}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Confirm password"
                    type="password"
                    value={password.confirm_password}
                    onChange={setPasswordField('confirm_password')}
                  />
                </Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end">
                <Button variant="outlined" onClick={changePassword}>Update Password</Button>
              </Stack>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
