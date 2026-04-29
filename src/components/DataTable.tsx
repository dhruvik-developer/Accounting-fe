import { ReactNode, useMemo, useState } from 'react';
import {
  Box, Button, Checkbox, FormControlLabel, IconButton, InputBase, Menu,
  MenuItem, Paper, Stack, Tooltip, Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ViewColumnOutlinedIcon from '@mui/icons-material/ViewColumnOutlined';
import FileDownloadOutlinedIcon from '@mui/icons-material/FileDownloadOutlined';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import { DataGrid, DataGridProps, GridColDef, GridRowSelectionModel } from '@mui/x-data-grid';
import EmptyState from './EmptyState';

const STORAGE_KEY = (id: string) => `dt.cols.${id}`;
const DENSITY_KEY = (id: string) => `dt.density.${id}`;

type Props<R = any> = Omit<DataGridProps, 'rows' | 'columns'> & {
  /** Stable table id — used to persist column visibility + density per user. */
  id: string;
  rows: R[];
  columns: GridColDef[];
  loading?: boolean;

  /** Toolbar search (client-side filter across all string columns). */
  searchable?: boolean;
  /** Heading shown in the toolbar. */
  title?: ReactNode;
  /** Right-hand action cluster in the toolbar. */
  toolbarActions?: ReactNode;

  /** Enable bulk-selection + show the contextual action bar with these actions. */
  bulkActions?: (selected: GridRowSelectionModel) => ReactNode;
  /** Rendered when rows is empty and loading is false. */
  emptyState?: ReactNode;

  /** Called when "Export CSV" is chosen (if omitted, button is hidden). */
  onExport?: (format: 'csv' | 'xlsx') => void;
};

export default function DataTable<R = any>({
  id, rows, columns, loading,
  searchable = true, title, toolbarActions,
  bulkActions, emptyState, onExport, ...grid
}: Props<R>) {
  const [search, setSearch] = useState('');
  const [selection, setSelection] = useState<GridRowSelectionModel>([]);
  const [colMenu, setColMenu] = useState<HTMLElement | null>(null);
  const [exportMenu, setExportMenu] = useState<HTMLElement | null>(null);

  const [hidden, setHidden] = useState<Record<string, boolean>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY(id)) || '{}'); } catch { return {}; }
  });
  const [density, setDensity] = useState<'compact' | 'standard'>(() => {
    if (typeof window === 'undefined') return 'standard';
    return (localStorage.getItem(DENSITY_KEY(id)) as any) || 'standard';
  });

  const columnVisibility = useMemo(() => {
    const m: Record<string, boolean> = {};
    for (const c of columns) m[c.field] = !hidden[c.field];
    return m;
  }, [columns, hidden]);

  const filtered = useMemo(() => {
    if (!searchable || !search) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      columns.some(c => {
        const v = r[c.field];
        return v != null && String(v).toLowerCase().includes(q);
      }),
    );
  }, [rows, columns, search, searchable]);

  const persistHidden = (next: Record<string, boolean>) => {
    setHidden(next);
    try { localStorage.setItem(STORAGE_KEY(id), JSON.stringify(next)); } catch {}
  };
  const persistDensity = (next: 'compact' | 'standard') => {
    setDensity(next);
    try { localStorage.setItem(DENSITY_KEY(id), next); } catch {}
  };

  const selectedCount = Array.isArray(selection) ? selection.length : 0;

  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {/* Toolbar */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1, borderBottom: 1, borderColor: 'divider', flexWrap: 'wrap' }}>
        {title && <Typography variant="subtitle2" sx={{ mr: 1 }}>{title}</Typography>}

        {searchable && (
          <Stack direction="row" alignItems="center" spacing={0.5} sx={{
            px: 1, height: 30, minWidth: { xs: 140, sm: 220 },
            border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper',
          }}>
            <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <InputBase
              fullWidth
              placeholder="Search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ fontSize: 13 }}
            />
          </Stack>
        )}

        <Box sx={{ flex: 1 }} />

        <Tooltip title={density === 'compact' ? 'Comfortable density' : 'Compact density'}>
          <IconButton size="small" onClick={() => persistDensity(density === 'compact' ? 'standard' : 'compact')}>
            {density === 'compact' ? <DensityMediumIcon fontSize="small" /> : <DensitySmallIcon fontSize="small" />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Columns">
          <IconButton size="small" onClick={(e) => setColMenu(e.currentTarget)}>
            <ViewColumnOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
        <Menu anchorEl={colMenu} open={!!colMenu} onClose={() => setColMenu(null)} PaperProps={{ sx: { p: 1, maxHeight: 320 } }}>
          {columns.map(c => (
            <MenuItem key={c.field} dense onClick={() => persistHidden({ ...hidden, [c.field]: !(hidden[c.field]) })}>
              <FormControlLabel
                control={<Checkbox size="small" checked={!hidden[c.field]} />}
                label={(c.headerName || c.field) as string}
                sx={{ m: 0 }}
              />
            </MenuItem>
          ))}
        </Menu>

        {onExport && (
          <>
            <Tooltip title="Export">
              <IconButton size="small" onClick={(e) => setExportMenu(e.currentTarget)}>
                <FileDownloadOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Menu anchorEl={exportMenu} open={!!exportMenu} onClose={() => setExportMenu(null)}>
              <MenuItem onClick={() => { setExportMenu(null); onExport('csv'); }}>Export CSV</MenuItem>
              <MenuItem onClick={() => { setExportMenu(null); onExport('xlsx'); }}>Export Excel</MenuItem>
            </Menu>
          </>
        )}

        {toolbarActions}
      </Stack>

      {/* Bulk action bar */}
      {bulkActions && selectedCount > 0 && (
        <Stack direction="row" spacing={1} alignItems="center"
          sx={{ px: 1.5, py: 1, bgcolor: 'action.selected', borderBottom: 1, borderColor: 'divider' }}
        >
          <Typography variant="body2" fontWeight={600}>{selectedCount} selected</Typography>
          <Box sx={{ flex: 1 }} />
          {bulkActions(selection)}
          <Button size="small" onClick={() => setSelection([])}>Clear</Button>
        </Stack>
      )}

      {/* Grid */}
      <Box sx={{ width: '100%' }}>
        <DataGrid
          rows={filtered}
          columns={columns}
          loading={loading}
          autoHeight
          density={density}
          disableRowSelectionOnClick
          checkboxSelection={!!bulkActions}
          onRowSelectionModelChange={setSelection}
          rowSelectionModel={selection}
          columnVisibilityModel={columnVisibility}
          onColumnVisibilityModelChange={(m) => {
            const next: Record<string, boolean> = {};
            for (const f of Object.keys(m)) next[f] = !m[f];
            persistHidden(next);
          }}
          slots={{
            noRowsOverlay: () => (
              <Box sx={{ p: 2 }}>{emptyState ?? <EmptyState compact title="No data" body="Nothing matches the current filters." />}</Box>
            ),
          }}
          sx={{
            border: 0,
            '--DataGrid-overlayHeight': '180px',
            '& .MuiDataGrid-columnHeaders': {
              bgcolor: 'background.default',
              textTransform: 'uppercase',
              fontSize: 11,
              letterSpacing: 0.3,
              color: 'text.secondary',
            },
            '& .MuiDataGrid-cell': { fontSize: 13 },
            '& .MuiDataGrid-row:hover': { bgcolor: 'action.hover' },
            '& .MuiDataGrid-footerContainer': { borderTop: 1, borderColor: 'divider' },
          }}
          {...grid}
        />
      </Box>
    </Paper>
  );
}
