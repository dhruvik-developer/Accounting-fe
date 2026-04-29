/**
 * Render-prop / wrapper that hides children when the active user's role
 * doesn't grant the given permission. The backend already 403s the
 * underlying request — this is purely UX, so users don't see buttons
 * that error when clicked.
 *
 * Usage:
 *   <Can permission="masters.parties.create">
 *     <Button>New party</Button>
 *   </Can>
 *
 *   <Can permission="sales.invoice.delete" fallback={<Tooltip title="Read-only">…}>
 *     <DeleteButton />
 *   </Can>
 *
 * For inline checks use the `useCan` hook instead:
 *   const canEdit = useCan('sales.invoice.edit');
 */
import { ReactNode } from 'react';
import { useMyPermissions } from '@/hooks/useMyPermissions';

type Props = {
  permission: string;
  fallback?: ReactNode;
  children: ReactNode;
};

export default function Can({ permission, fallback = null, children }: Props) {
  const { hasPermission } = useMyPermissions();
  return <>{hasPermission(permission) ? children : fallback}</>;
}

export function useCan(permission: string | undefined | null): boolean {
  const { hasPermission } = useMyPermissions();
  return hasPermission(permission);
}
