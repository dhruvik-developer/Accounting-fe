import {
  createContext, ReactNode, useCallback, useContext, useEffect, useState,
} from 'react';
import { api } from '@/app/api';

type Ctx = {
  codes: Set<string>;
  isSuper: boolean;
  has: (code: string) => boolean;
  reload: () => Promise<void>;
};

const PermissionContext = createContext<Ctx>({
  codes: new Set(), isSuper: false, has: () => false, reload: async () => {},
});

export function PermissionProvider({ children }: { children: ReactNode }) {
  const [codes, setCodes] = useState<Set<string>>(new Set());
  const [isSuper, setIsSuper] = useState(
    localStorage.getItem('is_superuser') === 'true',
  );

  const reload = useCallback(async () => {
    try {
      const { data } = await api.get('/rbac/me/permissions/');
      setCodes(new Set<string>(data.codes || []));
      setIsSuper(!!data.is_superuser);
      localStorage.setItem('is_superuser', String(!!data.is_superuser));
    } catch {
      setCodes(new Set());
    }
  }, []);

  useEffect(() => {
    if (localStorage.getItem('access')) reload();
  }, [reload]);

  const has = useCallback(
    (code: string) => {
      if (isSuper) return true;
      if (codes.has(code)) return true;
      // Manage-shortcut: "<mod>.<sub>.manage" covers all actions on that submodule.
      const parts = code.split('.');
      if (parts.length >= 2) {
        const manage = [...parts.slice(0, -1), 'manage'].join('.');
        if (codes.has(manage)) return true;
      }
      return false;
    },
    [codes, isSuper],
  );

  return (
    <PermissionContext.Provider value={{ codes, isSuper, has, reload }}>
      {children}
    </PermissionContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionContext);
}

export function usePermission(code: string) {
  return useContext(PermissionContext).has(code);
}
