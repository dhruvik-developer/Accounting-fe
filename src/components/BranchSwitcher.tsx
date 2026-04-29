import { useEffect, useState } from 'react';
import { Button, ListItemText, Menu, MenuItem } from '@mui/material';
import AccountTreeIcon from '@mui/icons-material/AccountTree';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { api } from '@/app/api';

type Branch = { id: string; code: string; name: string; is_default: boolean; is_active: boolean };

export default function BranchSwitcher() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(
    localStorage.getItem('branch_id'),
  );

  useEffect(() => {
    const businessId = localStorage.getItem('business_id');
    if (!businessId) return;
    api.get('/branches/').then(({ data }) => {
      const rows: Branch[] = data.results ?? data;
      const active = rows.filter((b) => b.is_active);
      setBranches(active);
      // Reset persisted branch_id when:
      //   - nothing is set yet (first visit), OR
      //   - it points to a branch that no longer exists / was deactivated
      //     (e.g. the user switched businesses, or the HO repaired the
      //     branch list under them). Without this we'd render stale state
      //     and the sidebar would flicker between "module gated" and
      //     "fail-open" until the user manually picked a branch.
      const stored = localStorage.getItem('branch_id');
      const valid = stored && active.some((b) => b.id === stored);
      if (!valid) {
        // Per-user default (set on the membership by an admin) wins over
        // the business-wide default — that's how a Retail-locked staff
        // member lands on RTL instead of HO at login.
        const userDefaultId = (() => {
          try { return localStorage.getItem(`default_branch_for:${businessId}`); } catch { return null; }
        })();
        const userDefault = userDefaultId ? active.find((b) => b.id === userDefaultId) : null;
        const def = userDefault || active.find((b) => b.is_default) || active[0];
        if (def) {
          localStorage.setItem('branch_id', def.id);
          setCurrentId(def.id);
          // Notify other components in *this tab* (storage events only
          // fire cross-tab, so without this useBranchModules would keep
          // its stale activeId until the next reload).
          window.dispatchEvent(new CustomEvent('branchchange', { detail: def.id }));
        } else {
          localStorage.removeItem('branch_id');
          setCurrentId(null);
          window.dispatchEvent(new CustomEvent('branchchange', { detail: null }));
        }
      }
    }).catch(() => setBranches([]));
  }, []);

  const choose = (id: string) => {
    if (id === currentId) { setAnchor(null); return; }
    localStorage.setItem('branch_id', id);
    setCurrentId(id);
    setAnchor(null);
    location.reload();
  };

  if (branches.length <= 1) return null; // hide switcher when single branch

  const current = branches.find((b) => b.id === currentId);
  return (
    <>
      <Button
        color="inherit"
        startIcon={<AccountTreeIcon />}
        endIcon={<ExpandMoreIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          textTransform: 'none', mr: 1,
          maxWidth: { xs: 130, lg: 200 },
          minWidth: 0,
          '& .MuiButton-endIcon': { ml: 0.5 },
          // Truncate long branch labels instead of overflowing the topbar.
          '& > .MuiButton-startIcon + *, & > :not(.MuiButton-startIcon):not(.MuiButton-endIcon)': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            minWidth: 0,
          },
        }}
      >
        {current ? `${current.code} · ${current.name}` : 'Pick branch'}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {branches.map((b) => (
          <MenuItem
            key={b.id}
            selected={b.id === currentId}
            onClick={() => choose(b.id)}
          >
            <ListItemText
              primary={b.name}
              secondary={`${b.code}${b.is_default ? ' · default' : ''}`}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
