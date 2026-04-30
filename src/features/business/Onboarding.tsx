import { useState } from 'react';
import {
  Alert, Box, Button, Container, Grid, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { api } from '@/app/api';
import { appPath } from '@/app/basePath';
import { formatApiError } from '@/app/errors';
import { GST_STATES } from '@/app/gstStates';

export default function Onboarding() {
  const nav = useNavigate();
  const [form, setForm] = useState({
    name: '', legal_name: '', gstin: '', pan: '', state: '', state_code: '',
    address_line1: '', city: '', pincode: '', phone: '', email: '',
    currency: 'INR', fy_start_month: 4,
  });
  const [err, setErr] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      const { data } = await api.post('/tenants/businesses/', form);
      localStorage.setItem('business_id', data.id);
      localStorage.removeItem('branch_id');
      // Hard reload to refresh axios interceptors and feature-flag cache
      // with the newly-active business. Replacing instead of pushing keeps
      // the back button from returning to a now-stale onboarding form.
      window.location.replace(appPath('/dashboard'));
    } catch (e) {
      setErr(formatApiError(e, 'Failed to create business'));
    }
  };

  const set = (k: string) => (e: any) => setForm({ ...form, [k]: e.target.value });
  const setState = (e: any) => {
    const state = GST_STATES.find((s) => s.name === e.target.value);
    setForm({
      ...form,
      state: e.target.value,
      state_code: state?.code || '',
    });
  };

  return (
    <Container maxWidth="md" sx={{ py: 6 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h5" gutterBottom>Create your business</Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          We’ll use this info on your invoices and GST computations.
        </Typography>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <Box component="form" onSubmit={submit}>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}><TextField label="Business name" required fullWidth value={form.name} onChange={set('name')} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="Legal name" fullWidth value={form.legal_name} onChange={set('legal_name')} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="GSTIN" fullWidth value={form.gstin} onChange={set('gstin')} /></Grid>
            <Grid item xs={12} sm={6}><TextField label="PAN" fullWidth value={form.pan} onChange={set('pan')} /></Grid>
            <Grid item xs={12} sm={8}>
              <TextField select label="State" required fullWidth value={form.state} onChange={setState}>
                {GST_STATES.map((state) => (
                  <MenuItem key={state.code} value={state.name}>
                    {state.name}
                  </MenuItem>
                ))}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField
                label="State code"
                required
                fullWidth
                value={form.state_code}
                helperText="Auto-filled from state selection"
                InputProps={{ readOnly: true }}
              />
            </Grid>
            <Grid item xs={12}><TextField label="Address" fullWidth value={form.address_line1} onChange={set('address_line1')} /></Grid>
            <Grid item xs={6} sm={4}><TextField label="City" fullWidth value={form.city} onChange={set('city')} /></Grid>
            <Grid item xs={6} sm={4}><TextField label="PIN code" fullWidth value={form.pincode} onChange={set('pincode')} /></Grid>
            <Grid item xs={12} sm={4}><TextField label="Phone" fullWidth value={form.phone} onChange={set('phone')} /></Grid>
            <Grid item xs={12}><Stack direction="row" justifyContent="flex-end">
              <Button type="submit" variant="contained" size="large">Create Business</Button>
            </Stack></Grid>
          </Grid>
        </Box>
      </Paper>
    </Container>
  );
}
