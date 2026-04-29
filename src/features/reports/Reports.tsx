/**
 * Reports — top-level page.
 *
 * Layout:
 *   • Left  : Group-by-group catalogue with a "★ Favourites" pinned strip
 *             and a search box. Click a report → opens it on the right.
 *   • Right : Either ReportsDashboard (default landing) or the selected
 *             report's filter bar + KPI/total cards + DataGrid.
 *
 * Three changes from the previous version that close the "Zoho gap":
 *   1. Visual landing dashboard (KPIs + sales line + payment donut +
 *      top-outstanding bars + low-stock + recent invoices) instead of
 *      a blank "select a report" prompt.
 *   2. Date-range presets (Today / This week / This month / This FY / …)
 *      replace the two raw date pickers — saves 3 clicks every time.
 *   3. Filter panel is now report-aware: each backend report declares
 *      its own `filters` list, and we render only those instead of
 *      always showing 11 fields. Cuts visual noise massively.
 *
 * Plus quality-of-life: star/favourite reports per business (localStorage),
 * Excel-friendly CSV export with a UTF-8 BOM, smarter empty state.
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Autocomplete, Box, Button, Card, CardContent, Chip, Divider, Grid,
  IconButton, InputAdornment, List, ListItemButton, ListItemText, MenuItem,
  Paper, Stack, TextField, Tooltip, Typography, alpha,
} from '@mui/material';
import { DataGrid, GridColDef } from '@mui/x-data-grid';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import DashboardIcon from '@mui/icons-material/Dashboard';
import dayjs from 'dayjs';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/app/api';
import EmptyState from '@/components/EmptyState';
import ReportsDashboard from './ReportsDashboard';
import {
  PRESET_OPTIONS, rangeForPreset, type DatePreset, type DateRange,
} from './datePresets';
import { useFavouriteReports } from './useFavourites';

type FilterSpec = {
  key: string;
  label: string;
  type: 'date' | 'date_range' | 'select' | 'text' | 'bool';
  default?: any;
  options?: { value: string; label: string }[];
  required?: boolean;
};

type ReportMeta = {
  code: string;
  title: string;
  description: string;
  group: string;
  filters?: FilterSpec[];
  fields: Array<{ key: string; label: string; align?: 'left' | 'right' | 'center'; type?: string; width?: number }>;
};

type ReportResult = {
  report: ReportMeta;
  rows: any[];
  totals: Record<string, any>;
  meta: Record<string, any>;
};

const GROUP_LABELS: Record<string, string> = {
  sales: 'Sales',
  purchase: 'Purchase',
  gst: 'GST',
  party: 'Party',
  inventory: 'Inventory',
  accounting: 'Accounting',
};

const GROUP_ORDER = ['sales', 'purchase', 'gst', 'party', 'inventory', 'accounting'];

const describeError = (e: any, fallback = 'Failed to load report') => {
  const data = e?.response?.data;
  if (data?.detail) return data.detail;
  if (typeof data === 'string') return data.trim().startsWith('<!DOCTYPE') ? fallback : data.slice(0, 240);
  return data ? JSON.stringify(data).slice(0, 240) : e?.message || fallback;
};

// CSV with a UTF-8 BOM so Excel opens it without mangling rupee sign /
// vernacular characters. Quotes are doubled per RFC 4180.
const downloadCsv = (filename: string, headers: string[], rows: string[][]) => {
  const escape = (cell: string) => `"${cell.replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))];
  const csv = '﻿' + lines.join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export default function Reports() {
  const nav = useNavigate();
  const [params, setParams] = useSearchParams();
  const [catalogue, setCatalogue] = useState<ReportMeta[]>([]);
  const [result, setResult] = useState<ReportResult | null>(null);
  const [branches, setBranches] = useState<any[]>([]);
  const [parties, setParties] = useState<any[]>([]);
  const [items, setItems] = useState<any[]>([]);
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarQuery, setSidebarQuery] = useState('');

  // Date range driven by a preset dropdown. Presets compute concrete
  // from/to strings; "custom" exposes the two date inputs as a fallback.
  const [preset, setPreset] = useState<DatePreset>('this_month');
  const [range, setRange] = useState<DateRange>(() => rangeForPreset('this_month'));
  // Free-form filter values keyed by the FilterSpec.key.
  const [filterValues, setFilterValues] = useState<Record<string, any>>({});

  const reportCode = params.get('report') || ''; // empty = dashboard
  const isDashboard = !reportCode;
  const activeReport = catalogue.find((r) => r.code === reportCode) || null;

  const { favourites, toggle, isFav } = useFavouriteReports();

  // Group catalogue and float favourites to the top.
  const grouped = useMemo(() => {
    const needle = sidebarQuery.trim().toLowerCase();
    const map: Record<string, ReportMeta[]> = {};
    catalogue
      .filter((r) => !needle
        || r.title.toLowerCase().includes(needle)
        || r.description.toLowerCase().includes(needle))
      .forEach((r) => {
        map[r.group] = [...(map[r.group] || []), r];
      });
    return map;
  }, [catalogue, sidebarQuery]);

  const favouriteReports = useMemo(
    () => favourites
      .map((code) => catalogue.find((r) => r.code === code))
      .filter(Boolean) as ReportMeta[],
    [favourites, catalogue],
  );

  const loadCatalogue = async () => {
    const [reports, br, pt, it, wh] = await Promise.all([
      api.get('/reports/engine/'),
      api.get('/branches/').catch(() => ({ data: [] })),
      api.get('/parties/', { params: { page_size: 1000 } }).catch(() => ({ data: [] })),
      api.get('/items/', { params: { page_size: 1000 } }).catch(() => ({ data: [] })),
      api.get('/warehouses/').catch(() => ({ data: [] })),
    ]);
    setCatalogue(reports.data.reports || []);
    setBranches(br.data.results ?? br.data);
    setParties(pt.data.results ?? pt.data);
    setItems(it.data.results ?? it.data);
    setWarehouses(wh.data.results ?? wh.data);
  };

  useEffect(() => {
    loadCatalogue().catch((e) => setErr(describeError(e)));
  }, []);

  const loadReport = async (code = reportCode) => {
    if (!code) return;
    setLoading(true);
    setErr('');
    try {
      const { data } = await api.get(`/reports/engine/${code}/`, {
        params: {
          date_from: range.from,
          date_to: range.to,
          ...filterValues,
        },
      });
      setResult(data);
    } catch (e) {
      setErr(describeError(e));
    } finally {
      setLoading(false);
    }
  };

  // Auto-load when the active report or date range changes.
  useEffect(() => {
    if (activeReport) loadReport(activeReport.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport?.code, range.from, range.to]);

  // Reset filter values to defaults when switching reports.
  useEffect(() => {
    if (!activeReport) return;
    const defaults: Record<string, any> = {};
    (activeReport.filters || []).forEach((f) => {
      if (f.key === 'date_from' || f.key === 'date_to') return;
      if (f.default !== undefined && f.default !== null) defaults[f.key] = f.default;
    });
    setFilterValues(defaults);
  }, [activeReport?.code]);

  const selectReport = (code: string) => {
    const next = new URLSearchParams(params);
    if (code) next.set('report', code); else next.delete('report');
    setParams(next);
  };

  const goDashboard = () => selectReport('');

  const onPresetChange = (p: DatePreset) => {
    setPreset(p);
    if (p !== 'custom') setRange(rangeForPreset(p));
  };

  const columns: GridColDef[] = (result?.report.fields || []).map((field) => ({
    field: field.key,
    headerName: field.label,
    width: field.width,
    flex: field.width ? undefined : 1,
    minWidth: field.width ? undefined : 140,
    align: field.align || 'left',
    headerAlign: field.align || 'left',
    renderCell: (cell) => {
      const link = cell.row?._links?.[field.key];
      const value = cell.value ?? '';
      if (field.type === 'chip') return <Chip size="small" label={value || '-'} />;
      if (!link?.url) return <span>{value}</span>;
      return (
        <Button size="small" onClick={() => nav(link.url)} sx={{ px: 0, minWidth: 0 }}>
          {value || 'Open'}
        </Button>
      );
    },
  }));

  const exportCsv = () => {
    if (!result) return;
    const headers = result.report.fields.map((f) => f.label);
    const rows = result.rows.map((row) =>
      result.report.fields.map((f) => String(row[f.key] ?? '')),
    );
    const stamp = `${range.from}_to_${range.to}`;
    downloadCsv(`${result.report.code}_${stamp}.csv`, headers, rows);
  };

  const exportTally = async () => {
    try {
      const res = await api.get('/integrations/tally/export/', {
        params: { date_from: range.from, date_to: range.to },
        responseType: 'blob',
      });
      const url = URL.createObjectURL(new Blob([res.data], { type: 'application/xml' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `tally-${range.from}-to-${range.to}.xml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErr(describeError(e, 'Tally export failed'));
    }
  };

  return (
    <Box>
      {/* Header */}
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between"
        alignItems={{ md: 'center' }} spacing={2} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
            Reports
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {isDashboard
              ? 'Live business overview — sales, receivables, GST, inventory at a glance.'
              : `${activeReport?.title || 'Report'} · ${dayjs(range.from).format('DD MMM')} – ${dayjs(range.to).format('DD MMM YYYY')}`}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {!isDashboard && (
            <>
              <Button startIcon={<RefreshIcon />} variant="outlined" onClick={() => loadReport()}>
                Refresh
              </Button>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportCsv}
                disabled={!result}>
                Export CSV
              </Button>
              <Button startIcon={<PrintIcon />} variant="outlined" onClick={() => window.print()}>
                Print / PDF
              </Button>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={exportTally}>
                Tally XML
              </Button>
            </>
          )}
        </Stack>
      </Stack>

      {/* Top filter bar — date range preset always visible */}
      <Paper sx={{ p: 1.5, mb: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ md: 'center' }}>
          <TextField
            select size="small" label="Period"
            value={preset}
            onChange={(e) => onPresetChange(e.target.value as DatePreset)}
            sx={{ minWidth: 200 }}
          >
            {PRESET_OPTIONS.map((p) => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </TextField>
          {preset === 'custom' && (
            <Stack direction="row" spacing={1}>
              <TextField size="small" type="date" label="From"
                InputLabelProps={{ shrink: true }}
                value={range.from}
                onChange={(e) => setRange((r) => ({ ...r, from: e.target.value }))} />
              <TextField size="small" type="date" label="To"
                InputLabelProps={{ shrink: true }}
                value={range.to}
                onChange={(e) => setRange((r) => ({ ...r, to: e.target.value }))} />
            </Stack>
          )}
          {preset !== 'custom' && (
            <Chip size="small" variant="outlined"
              label={`${dayjs(range.from).format('DD MMM')} – ${dayjs(range.to).format('DD MMM YYYY')}`} />
          )}
          {!isDashboard && (
            <Button size="small" variant="text" startIcon={<DashboardIcon />} onClick={goDashboard}>
              Back to dashboard
            </Button>
          )}
        </Stack>
      </Paper>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      <Grid container spacing={2}>
        {/* Left rail — catalogue */}
        <Grid item xs={12} md={3}>
          <Paper sx={{ p: 1, position: { md: 'sticky' }, top: { md: 16 } }}>
            <ListItemButton
              selected={isDashboard} onClick={goDashboard}
              sx={{ borderRadius: 1, mb: 1 }}
            >
              <DashboardIcon fontSize="small" sx={{ mr: 1.25, color: isDashboard ? 'primary.main' : 'text.secondary' }} />
              <ListItemText primary="Overview dashboard"
                secondary="Live business KPIs + charts" />
            </ListItemButton>

            <TextField
              size="small" placeholder="Find a report…"
              value={sidebarQuery}
              onChange={(e) => setSidebarQuery(e.target.value)}
              sx={{ width: '100%', mb: 1, px: 0.5 }}
              InputProps={{
                startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
              }}
            />

            {favouriteReports.length > 0 && sidebarQuery === '' && (
              <Box sx={{ mb: 1 }}>
                <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
                  ★ Favourites
                </Typography>
                <List dense disablePadding>
                  {favouriteReports.map((report) => (
                    <ReportRow key={report.code} report={report}
                      selected={activeReport?.code === report.code}
                      starred isFav onToggleFav={() => toggle(report.code)}
                      onPick={() => selectReport(report.code)} />
                  ))}
                </List>
              </Box>
            )}

            {GROUP_ORDER.filter((g) => grouped[g]?.length).map((group) => (
              <Box key={group} sx={{ mb: 1 }}>
                <Typography variant="overline" color="text.secondary" sx={{ px: 1 }}>
                  {GROUP_LABELS[group] || group}
                </Typography>
                <List dense disablePadding>
                  {grouped[group].map((report) => (
                    <ReportRow key={report.code} report={report}
                      selected={activeReport?.code === report.code}
                      isFav={isFav(report.code)}
                      onToggleFav={() => toggle(report.code)}
                      onPick={() => selectReport(report.code)} />
                  ))}
                </List>
              </Box>
            ))}

            {Object.keys(grouped).length === 0 && (
              <Box sx={{ p: 2 }}>
                <Typography variant="caption" color="text.secondary">
                  No reports match "{sidebarQuery}".
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        {/* Right pane — dashboard or selected report */}
        <Grid item xs={12} md={9}>
          {isDashboard ? (
            <ReportsDashboard range={range} onPickReport={selectReport} />
          ) : (
            <>
              {/* Report-aware filter bar (only the filters this report declares) */}
              <ReportFilters
                report={activeReport}
                values={filterValues}
                onChange={setFilterValues}
                onApply={() => loadReport()}
                branches={branches}
                parties={parties}
                items={items}
                warehouses={warehouses}
              />

              <Paper sx={{ p: 2 }}>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between"
                  spacing={2} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h6">{result?.report.title || activeReport?.title || 'Report'}</Typography>
                    <Typography variant="body2" color="text.secondary">
                      {result?.report.description || activeReport?.description}
                    </Typography>
                  </Box>
                  <Chip
                    label={`${result?.meta?.count ?? result?.rows?.length ?? 0} rows`}
                    color={loading ? 'default' : 'primary'} />
                </Stack>

                {result?.totals && Object.keys(result.totals).length > 0 && (
                  <>
                    <Grid container spacing={1} sx={{ mb: 2 }}>
                      {Object.entries(result.totals).map(([key, value]) => (
                        <Grid item xs={6} md={3} key={key}>
                          <Card variant="outlined">
                            <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
                              <Typography variant="caption" color="text.secondary"
                                sx={{ textTransform: 'capitalize' }}>
                                {key.replace(/_/g, ' ')}
                              </Typography>
                              <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                                {String(value)}
                              </Typography>
                            </CardContent>
                          </Card>
                        </Grid>
                      ))}
                    </Grid>
                    <Divider sx={{ mb: 2 }} />
                  </>
                )}

                <DataGrid
                  autoHeight loading={loading}
                  rows={result?.rows || []}
                  columns={columns}
                  getRowId={(row) =>
                    row.id || row.code || row.party_id || row.item_id || row.hsn || row.status
                    || `${Object.values(row).slice(0, 3).join('|')}`}
                  initialState={{ pagination: { paginationModel: { pageSize: 25 } } }}
                  pageSizeOptions={[10, 25, 50, 100]}
                  disableRowSelectionOnClick
                  slots={{
                    noRowsOverlay: () => (
                      <Box sx={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        height: '100%', minHeight: 220,
                      }}>
                        <EmptyState
                          title="No matching rows"
                          body={`Nothing for "${activeReport?.title || 'this report'}" in the selected window. Try expanding the date range or clearing filters.`}
                        />
                      </Box>
                    ),
                  }}
                />
              </Paper>
            </>
          )}
        </Grid>
      </Grid>
    </Box>
  );
}

// ---------- Sidebar row --------------------------------------------------

function ReportRow({ report, selected, isFav, starred, onToggleFav, onPick }: {
  report: ReportMeta;
  selected: boolean;
  isFav: boolean;
  starred?: boolean;
  onToggleFav: () => void;
  onPick: () => void;
}) {
  return (
    <ListItemButton selected={selected} onClick={onPick}
      sx={{
        borderRadius: 1, pr: 1,
        bgcolor: starred ? (t) => alpha(t.palette.warning.main, t.palette.mode === 'dark' ? 0.06 : 0.04) : undefined,
      }}
    >
      <ListItemText
        primary={report.title}
        secondary={report.description}
        primaryTypographyProps={{ variant: 'body2', sx: { fontWeight: 600 } }}
        secondaryTypographyProps={{ variant: 'caption', sx: { display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' } }}
      />
      <Tooltip title={isFav ? 'Unstar' : 'Pin to favourites'}>
        <IconButton size="small" onClick={(e) => { e.stopPropagation(); onToggleFav(); }}
          sx={{ color: isFav ? '#FFB300' : 'text.disabled', flexShrink: 0 }}>
          {isFav ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
        </IconButton>
      </Tooltip>
    </ListItemButton>
  );
}

// ---------- Report-aware filter bar --------------------------------------

function ReportFilters({
  report, values, onChange, onApply, branches, parties, items, warehouses,
}: {
  report: ReportMeta | null;
  values: Record<string, any>;
  onChange: (v: Record<string, any>) => void;
  onApply: () => void;
  branches: any[];
  parties: any[];
  items: any[];
  warehouses: any[];
}) {
  if (!report) return null;
  // Skip date_from / date_to here — those are driven by the global date preset.
  const filters = (report.filters || []).filter(
    (f) => f.key !== 'date_from' && f.key !== 'date_to',
  );

  if (filters.length === 0) return null;

  const setVal = (key: string, val: any) => onChange({ ...values, [key]: val });

  return (
    <Paper sx={{ p: 1.5, mb: 2 }}>
      <Grid container spacing={1.5} alignItems="center">
        {filters.map((f) => {
          const colSpan = { xs: 12, sm: 6, md: 3 };

          // Field-key-based smart binding for the master-data filters
          // (party, branch, item, warehouse). The backend declares them as
          // generic 'select' but we know the right autocomplete options.
          if (f.key === 'party_id') {
            return (
              <Grid item key={f.key} {...colSpan}>
                <Autocomplete
                  size="small" options={parties}
                  getOptionLabel={(o: any) => o.name || ''}
                  value={parties.find((p) => p.id === values.party_id) || null}
                  onChange={(_, v: any) => setVal('party_id', v?.id || '')}
                  renderInput={(p) => <TextField {...p} label={f.label} />}
                />
              </Grid>
            );
          }
          if (f.key === 'branch_id') {
            return (
              <Grid item key={f.key} {...colSpan}>
                <Autocomplete
                  size="small" options={branches}
                  getOptionLabel={(o: any) => o.name ? `${o.code} · ${o.name}` : ''}
                  value={branches.find((b) => b.id === values.branch_id) || null}
                  onChange={(_, v: any) => setVal('branch_id', v?.id || '')}
                  renderInput={(p) => <TextField {...p} label={f.label} />}
                />
              </Grid>
            );
          }
          if (f.key === 'item_id') {
            return (
              <Grid item key={f.key} {...colSpan}>
                <Autocomplete
                  size="small" options={items}
                  getOptionLabel={(o: any) => o.name ? `${o.sku} · ${o.name}` : ''}
                  value={items.find((i) => i.id === values.item_id) || null}
                  onChange={(_, v: any) => setVal('item_id', v?.id || '')}
                  renderInput={(p) => <TextField {...p} label={f.label} />}
                />
              </Grid>
            );
          }
          if (f.key === 'warehouse_id') {
            return (
              <Grid item key={f.key} {...colSpan}>
                <Autocomplete
                  size="small" options={warehouses}
                  getOptionLabel={(o: any) => o.name || ''}
                  value={warehouses.find((w) => w.id === values.warehouse_id) || null}
                  onChange={(_, v: any) => setVal('warehouse_id', v?.id || '')}
                  renderInput={(p) => <TextField {...p} label={f.label} />}
                />
              </Grid>
            );
          }

          if (f.type === 'select' && f.options) {
            return (
              <Grid item key={f.key} {...colSpan}>
                <TextField select size="small" fullWidth label={f.label}
                  value={values[f.key] ?? f.default ?? ''}
                  onChange={(e) => setVal(f.key, e.target.value)}>
                  {f.options.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>{opt.label}</MenuItem>
                  ))}
                </TextField>
              </Grid>
            );
          }

          if (f.type === 'bool') {
            return (
              <Grid item key={f.key} {...colSpan}>
                <TextField select size="small" fullWidth label={f.label}
                  value={values[f.key] ? 'true' : ''}
                  onChange={(e) => setVal(f.key, e.target.value === 'true')}>
                  <MenuItem value="">All</MenuItem>
                  <MenuItem value="true">{f.label} only</MenuItem>
                </TextField>
              </Grid>
            );
          }

          // text / fallback
          return (
            <Grid item key={f.key} {...colSpan}>
              <TextField size="small" fullWidth label={f.label}
                value={values[f.key] ?? ''}
                onChange={(e) => setVal(f.key, e.target.value)} />
            </Grid>
          );
        })}
        <Grid item xs={12} sm={6} md={3}>
          <Button fullWidth variant="contained" onClick={onApply} sx={{ height: 40 }}>
            Apply filters
          </Button>
        </Grid>
      </Grid>
    </Paper>
  );
}
