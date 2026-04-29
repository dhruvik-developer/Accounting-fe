/**
 * Auto-opens a list page's "create" dialog/drawer when the URL has `?new=1`.
 * Used by Quick Create menus, the ⌘K palette, and Dashboard quick actions
 * so they don't have to navigate to a non-existent `/foo/new` route.
 *
 *   const Parties = () => {
 *     useAutoOpenCreate(startCreate);
 *     ...
 *   }
 *
 * After firing, the `?new=1` param is stripped (replace, not push) so a
 * page refresh doesn't keep re-opening the form.
 */
import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

export default function useAutoOpenCreate(open: () => void, paramName: string = 'new') {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get(paramName) === '1') {
      open();
      const next = new URLSearchParams(searchParams);
      next.delete(paramName);
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
}
