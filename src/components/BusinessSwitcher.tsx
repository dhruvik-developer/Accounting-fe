import { useEffect, useState } from 'react';
import {
  Button, ListItemText, Menu, MenuItem, Typography,
} from '@mui/material';
import BusinessIcon from '@mui/icons-material/Business';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { api } from '@/app/api';
import { appPath } from '@/app/basePath';

type Option = {
  membership_id?: string;
  business_id: string;
  name: string;
  gstin?: string;
  role?: string;
};

export default function BusinessSwitcher() {
  const [anchor, setAnchor] = useState<null | HTMLElement>(null);
  const [options, setOptions] = useState<Option[]>([]);
  const [currentId, setCurrentId] = useState<string | null>(
    localStorage.getItem('business_id'),
  );
  const isSuper = localStorage.getItem('is_superuser') === 'true';

  const load = async () => {
    try {
      if (isSuper) {
        const { data } = await api.get('/tenants/businesses/');
        const rows = data.results ?? data;
        setOptions(
          rows.map((b: any) => ({
            business_id: b.id, name: b.name, gstin: b.gstin, role: 'Software Owner',
          })),
        );
      } else {
        const { data } = await api.get('/tenants/businesses/mine/');
        setOptions(
          data.map((m: any) => ({
            membership_id: m.id,
            business_id: m.business.id,
            name: m.business.name,
            gstin: m.business.gstin,
            role: m.role,
          })),
        );
        // Cache each membership's default_branch hint so BranchSwitcher
        // can land staff on the right branch on first paint without
        // making a second round-trip.
        try {
          data.forEach((m: any) => {
            if (m.business?.id && m.role) {
              localStorage.setItem(`membership_role_for:${m.business.id}`, m.role);
            }
            if (m.default_branch_id) {
              localStorage.setItem(`default_branch_for:${m.business.id}`, m.default_branch_id);
            } else {
              localStorage.removeItem(`default_branch_for:${m.business.id}`);
            }
          });
        } catch { /* localStorage may be disabled */ }
      }
    } catch {
      setOptions([]);
    }
  };

  useEffect(() => { load(); }, []);

  const choose = (id: string) => {
    if (id === currentId) { setAnchor(null); return; }
    localStorage.setItem('business_id', id);
    // Clear branch so BranchSwitcher picks the default for the new business.
    localStorage.removeItem('branch_id');
    setCurrentId(id);
    setAnchor(null);
    location.reload();  // force data refresh across all mounted components
  };

  const current = options.find((o) => o.business_id === currentId);

  return (
    <>
      <Button
        color="inherit"
        startIcon={<BusinessIcon />}
        endIcon={<ExpandMoreIcon />}
        onClick={(e) => setAnchor(e.currentTarget)}
        sx={{
          textTransform: 'none', mr: 1,
          maxWidth: { xs: 140, lg: 220 },
          minWidth: 0,
          '& .MuiButton-endIcon': { ml: 0.5 },
          // Truncate long business names instead of pushing other items off-screen.
          '& > .MuiButton-startIcon + *, & > :not(.MuiButton-startIcon):not(.MuiButton-endIcon)': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            display: 'block',
            minWidth: 0,
          },
        }}
      >
        {current?.name || 'Pick business'}
      </Button>
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)}>
        {options.length === 0 && (
          <>
            <MenuItem disabled>
              <Typography variant="body2">No businesses available</Typography>
            </MenuItem>
            <MenuItem onClick={() => { setAnchor(null); location.href = appPath('/onboarding'); }}>
              <ListItemText primary="Create business…" />
            </MenuItem>
          </>
        )}
        {options.map((o) => (
          <MenuItem
            key={o.business_id}
            selected={o.business_id === currentId}
            onClick={() => choose(o.business_id)}
          >
            <ListItemText
              primary={o.name}
              secondary={`${o.role || ''}${o.gstin ? ' · ' + o.gstin : ''}`}
            />
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
