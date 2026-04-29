import { ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { Box, Typography } from '@mui/material';
import { api } from '@/app/api';

export type PlatformRole = 'owner' | 'admin' | '';
type GuardState = 'loading' | 'ok' | 'deny';

const PlatformRoleContext = createContext<PlatformRole>('');

export const usePlatformRole = () => useContext(PlatformRoleContext);
export const useIsPlatformOwner = () => useContext(PlatformRoleContext) === 'owner';

/**
 * 404 for callers without owner OR admin tier. Owner / admin distinction is
 * exposed via PlatformRoleContext so individual pages can hide owner-only
 * controls (e.g. plan editor, coupon CRUD).
 */
export default function PlatformGuard({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GuardState>('loading');
  const [role, setRole] = useState<PlatformRole>('');

  useEffect(() => {
    api.get('/auth/me/')
      .then(r => {
        const r1: PlatformRole = r.data?.is_superuser ? 'owner'
          : r.data?.is_platform_admin ? 'admin' : '';
        setRole(r1);
        setState(r1 ? 'ok' : 'deny');
      })
      .catch(() => setState('deny'));
  }, []);

  if (state === 'loading') return null;
  if (state === 'deny') {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h2" sx={{ fontWeight: 700, color: 'text.secondary', lineHeight: 1 }}>404</Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>Page not found.</Typography>
      </Box>
    );
  }
  return <PlatformRoleContext.Provider value={role}>{children}</PlatformRoleContext.Provider>;
}
