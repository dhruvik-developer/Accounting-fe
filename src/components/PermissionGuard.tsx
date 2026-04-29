import { ReactNode } from 'react';
import { usePermission } from './PermissionContext';

type Props = {
  code: string;
  fallback?: ReactNode;
  children: ReactNode;
};

export default function PermissionGuard({ code, fallback = null, children }: Props) {
  return usePermission(code) ? <>{children}</> : <>{fallback}</>;
}
