import axios from 'axios';
import { appPath, stripAppBasePath } from '@/app/basePath';
import { notify } from '@/components/Notifier';

const baseURL = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1';

export const api = axios.create({ baseURL });

const clearBusinessContext = (scope: 'branch' | 'business') => {
  localStorage.removeItem('branch_id');
  if (scope === 'business') localStorage.removeItem('business_id');
};

const canManageBilling = () => {
  if (localStorage.getItem('is_superuser') === 'true') return true;
  const businessId = localStorage.getItem('business_id');
  const role = businessId ? localStorage.getItem(`membership_role_for:${businessId}`) : '';
  return role === 'owner' || role === 'admin';
};

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access');
  const businessId = localStorage.getItem('business_id');
  const branchId = localStorage.getItem('branch_id');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  if (businessId) config.headers['X-Business-Id'] = businessId;
  if (branchId) config.headers['X-Branch-Id'] = branchId;
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (err) => {
    const detail = err?.response?.data?.detail;
    if (err?.response?.status === 401) {
      localStorage.removeItem('access');
      localStorage.removeItem('refresh');
      localStorage.removeItem('business_id');
      localStorage.removeItem('branch_id');
      notify({ severity: 'warning', message: 'Session expired. Please sign in again.' });
      if (!stripAppBasePath(location.pathname).startsWith('/auth')) location.href = appPath('/auth/login');
    } else if (err?.response?.status === 402) {
      if (canManageBilling()) {
        // Plan limit exceeded — surface via global event; UpgradeModal listens.
        notify({ severity: 'info', message: detail || 'Upgrade required for this action.' });
        window.dispatchEvent(new CustomEvent('upgrade-required', { detail: err.response.data }));
      } else {
        notify({
          severity: 'warning',
          message: 'This plan does not allow the action. Ask the owner/admin to review the plan.',
        });
      }
    } else if (err?.response?.status === 403 && detail === 'Branch not found for this business.') {
      clearBusinessContext('branch');
      notify({ severity: 'warning', message: 'Branch context was reset. Please select a branch again.' });
      location.reload();
    } else if (err?.response?.status === 403 && detail === 'Business not found for this user.') {
      clearBusinessContext('business');
      notify({ severity: 'warning', message: 'Business context was reset. Please select a business again.' });
      location.reload();
    }
    return Promise.reject(err);
  },
);
