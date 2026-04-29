import { useEffect, useState } from 'react';
import { api } from '@/app/api';

type BillingAccess = {
  loaded: boolean;
  canManageBilling: boolean;
  role: string | null;
};

const BILLING_MANAGER_ROLES = new Set(['owner', 'admin']);

export function isBillingManagerRole(role?: string | null) {
  return !!role && BILLING_MANAGER_ROLES.has(role);
}

export function useBillingAccess(): BillingAccess {
  const [state, setState] = useState<BillingAccess>({
    loaded: false,
    canManageBilling: false,
    role: null,
  });

  useEffect(() => {
    let active = true;

    const resolveAccess = async () => {
      if (localStorage.getItem('is_superuser') === 'true') {
        if (active) setState({ loaded: true, canManageBilling: true, role: 'superuser' });
        return;
      }

      const businessId = localStorage.getItem('business_id');
      if (!businessId) {
        if (active) setState({ loaded: true, canManageBilling: false, role: null });
        return;
      }

      try {
        const { data } = await api.get('/tenants/businesses/mine/');
        const rows = Array.isArray(data) ? data : (data?.results ?? []);
        const membership = rows.find((m: any) => String(m.business?.id) === String(businessId));
        const role = membership?.role ?? null;
        if (role) localStorage.setItem(`membership_role_for:${businessId}`, role);
        if (active) {
          setState({
            loaded: true,
            canManageBilling: isBillingManagerRole(role),
            role,
          });
        }
      } catch {
        if (active) setState({ loaded: true, canManageBilling: false, role: null });
      }
    };

    resolveAccess();
    return () => { active = false; };
  }, []);

  return state;
}
