/**
 * Slim left-pane party list. Replaces the 9-column DataGrid with a
 * scannable 4-column layout: Name (+ tag chip) · Type · Balance (Dr/Cr) ·
 * Status. Clicking a row selects it; the detail pane on the right does
 * the heavy lifting (stats, ledger, invoices, payments, GST info).
 */
import { useMemo } from 'react';
import {
  Box, Chip, InputAdornment, MenuItem, Paper, Stack, TextField, Typography,
  alpha, useTheme,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { formatMoney } from '@/components/MoneyDisplay';

export type PartyRow = {
  id: string;
  name: string;
  display_name?: string;
  type: 'customer' | 'supplier' | 'both';
  gst_treatment?: string;
  gstin?: string;
  current_balance?: number | string;
  credit_limit?: number | string;
  is_active?: boolean;
  tags?: string;
};

type Props = {
  rows: PartyRow[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  q: string;
  onQ: (v: string) => void;
  typeFilter: string;
  onTypeFilter: (v: string) => void;
  loading?: boolean;
};

const TYPE_COLORS: Record<string, string> = {
  customer: '#4FC3F7',
  supplier: '#FFB300',
  both:     '#B388FF',
};

export default function PartyList({
  rows, selectedId, onSelect, q, onQ, typeFilter, onTypeFilter, loading,
}: Props) {
  const theme = useTheme();

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (typeFilter !== 'all') {
        if (typeFilter === 'overlimit') {
          const limit = Number(r.credit_limit || 0);
          const bal = Number(r.current_balance || 0);
          if (!(limit > 0 && bal > limit)) return false;
        } else if (typeFilter === 'inactive') {
          if (r.is_active !== false) return false;
        } else if (r.type !== typeFilter && r.type !== 'both') {
          return false;
        }
      }
      if (!needle) return true;
      return (
        r.name?.toLowerCase().includes(needle)
        || r.display_name?.toLowerCase().includes(needle)
        || r.gstin?.toLowerCase().includes(needle)
        || r.tags?.toLowerCase().includes(needle)
      );
    });
  }, [rows, q, typeFilter]);

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <Stack spacing={1.25} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <TextField
          size="small"
          placeholder="Search name, GSTIN, tag…"
          value={q}
          onChange={(e) => onQ(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
              </InputAdornment>
            ),
          }}
        />
        <TextField
          size="small" select fullWidth
          value={typeFilter} onChange={(e) => onTypeFilter(e.target.value)}
        >
          <MenuItem value="all">All parties</MenuItem>
          <MenuItem value="customer">Customers</MenuItem>
          <MenuItem value="supplier">Suppliers</MenuItem>
          <MenuItem value="overlimit">Over credit limit</MenuItem>
          <MenuItem value="inactive">Inactive</MenuItem>
        </TextField>
        <Typography variant="caption" color="text.secondary">
          {loading ? 'Loading…' : `${filtered.length} of ${rows.length} parties`}
        </Typography>
      </Stack>

      <Box sx={{ flex: 1, overflowY: 'auto' }}>
        {filtered.length === 0 ? (
          <Box sx={{ p: 4, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary">
              {rows.length === 0 ? 'No parties yet.' : 'No matches — clear search or change filter.'}
            </Typography>
          </Box>
        ) : (
          filtered.map((r) => {
            const balance = Number(r.current_balance || 0);
            const isSelected = r.id === selectedId;
            const balanceColor = balance > 0 ? '#FFB300' : balance < 0 ? '#00E676' : 'text.disabled';
            return (
              <Box
                key={r.id}
                onClick={() => onSelect(r.id)}
                sx={{
                  p: 1.5,
                  cursor: 'pointer',
                  borderLeft: '3px solid transparent',
                  borderBottom: 1,
                  borderColor: 'divider',
                  bgcolor: isSelected
                    ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.15 : 0.08)
                    : 'transparent',
                  borderLeftColor: isSelected ? 'primary.main' : 'transparent',
                  transition: 'background-color 120ms, border-color 120ms',
                  '&:hover': {
                    bgcolor: isSelected
                      ? alpha(theme.palette.primary.main, theme.palette.mode === 'dark' ? 0.18 : 0.1)
                      : alpha(theme.palette.text.primary, 0.04),
                  },
                }}
              >
                <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={1}>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700 }} noWrap>
                      {r.display_name || r.name}
                    </Typography>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                      <Chip
                        size="small"
                        label={r.type === 'both' ? 'Both' : r.type}
                        sx={{
                          height: 18, fontSize: 10, fontWeight: 700,
                          textTransform: 'capitalize',
                          color: TYPE_COLORS[r.type] || 'text.secondary',
                          bgcolor: alpha(TYPE_COLORS[r.type] || '#999', 0.12),
                          border: `1px solid ${alpha(TYPE_COLORS[r.type] || '#999', 0.3)}`,
                        }}
                      />
                      {r.gstin && (
                        <Typography variant="caption" color="text.secondary"
                          sx={{ fontFamily: '"IBM Plex Mono", monospace', fontSize: 10 }}>
                          {r.gstin}
                        </Typography>
                      )}
                      {r.is_active === false && (
                        <Chip size="small" label="Inactive" sx={{ height: 18, fontSize: 10 }} />
                      )}
                    </Stack>
                  </Box>
                  <Stack alignItems="flex-end" sx={{ flexShrink: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 700, color: balanceColor }}>
                      {balance === 0 ? '—' : formatMoney(Math.abs(balance), { short: true })}
                    </Typography>
                    {balance !== 0 && (
                      <Typography variant="caption" color="text.secondary">
                        {balance > 0 ? 'Dr' : 'Cr'}
                      </Typography>
                    )}
                  </Stack>
                </Stack>
              </Box>
            );
          })
        )}
      </Box>
    </Paper>
  );
}
