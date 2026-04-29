import { ReactNode, useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { api } from '@/app/api';

export default function RequireAuth({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const token = localStorage.getItem('access');
  const businessId = localStorage.getItem('business_id');
  const [checked, setChecked] = useState(false);
  const [hasBusiness, setHasBusiness] = useState(!!businessId);
  const [isSuper, setIsSuper] = useState(
    localStorage.getItem('is_superuser') === 'true',
  );

  useEffect(() => {
    if (!token) { setChecked(true); return; }
    // Always refresh the superuser flag
    api.get('/auth/me/').then((r) => {
      const su = !!r.data?.is_superuser;
      localStorage.setItem('is_superuser', String(su));
      setIsSuper(su);
    }).catch(() => {});

    if (businessId) { setChecked(true); return; }
    api.get('/tenants/businesses/mine/').then((r) => {
      if (r.data?.length) {
        localStorage.setItem('business_id', r.data[0].business.id);
        setHasBusiness(true);
      }
    }).finally(() => setChecked(true));
  }, [token, businessId]);

  if (!token) return <Navigate to="/auth/login" state={{ from: loc }} replace />;
  if (!checked) return null;

  if (!hasBusiness && !isSuper && loc.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  if (!hasBusiness && isSuper && loc.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />;
  }
  return <>{children}</>;
}
