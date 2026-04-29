import { useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, LinearProgress, MenuItem, Paper, Stack, Tab, Table,
  TableBody, TableCell, TableContainer, TableHead, TableRow, Tabs, TextField,
  Typography,
} from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import { api } from '@/app/api';

type ImportResult = {
  created: number;
  total: number;
  errors: { row: number; error: string }[];
};

type GstinPreviewRow = {
  gstin: string;
  pan: string;
  state: string;
  state_code: string;
  gst_treatment: string;
  name_placeholder: string;
};

type GstinResult = {
  created: number;
  total: number;
  preview: GstinPreviewRow[];
  errors: { row: number; gstin: string; error: string }[];
};

const FILE_TABS = [
  {
    key: 'parties',
    label: 'Parties (CSV/XLSX)',
    template: '/imports/parties/template/',
    upload: '/imports/parties/',
    helper: 'Required: name. Optional: type (customer/supplier/both), phone, email, gstin, pan, gst_treatment, state, state_code, billing_address, opening_balance, opening_balance_type (dr/cr), credit_days. If gstin is supplied, state, pan, gst_treatment and place_of_supply auto-fill.',
  },
  {
    key: 'items',
    label: 'Items (CSV/XLSX)',
    template: '/imports/items/template/',
    upload: '/imports/items/',
    helper: 'Required: sku, name. Optional: type (product/service), hsn_code, sale_price, purchase_price, mrp, opening_stock, opening_stock_value.',
  },
] as const;

export default function BulkImport() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 0.5 }}>Bulk import</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Migrate from Tally / Vyapar / Excel in minutes — or paste a list of GSTINs and let the system fill in state, PAN and treatment automatically.
      </Typography>

      <Paper sx={{ p: 0, mb: 2 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Parties (CSV/XLSX)" />
          <Tab label="Items (CSV/XLSX)" />
          <Tab label="Quick add by GSTIN" />
        </Tabs>
      </Paper>

      {tab < 2 ? <FileImport tabIndex={tab} /> : <GstinQuickAdd />}
    </Box>
  );
}

function FileImport({ tabIndex }: { tabIndex: number }) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [err, setErr] = useState('');
  const active = FILE_TABS[tabIndex];

  const downloadTemplate = async () => {
    try {
      const res = await api.get(active.template, { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement('a');
      a.href = url;
      a.download = `${active.key}_template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Failed to download template.');
    }
  };

  const uploadFile = async (file: File) => {
    const MAX_BYTES = 25 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      setErr(`File is ${(file.size / 1024 / 1024).toFixed(1)} MB — limit is 25 MB. Split into smaller batches.`);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    const ext = file.name.toLowerCase().split('.').pop() || '';
    if (!['csv', 'xlsx', 'xls'].includes(ext)) {
      setErr(`Unsupported file (.${ext}). Use .csv, .xlsx, or .xls.`);
      if (fileInput.current) fileInput.current.value = '';
      return;
    }
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const { data } = await api.post<ImportResult>(active.upload, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Upload failed.');
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {active.helper}
      </Typography>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Button variant="outlined" startIcon={<DownloadIcon />} onClick={downloadTemplate}>
          Download template
        </Button>
        <Button
          variant="contained"
          startIcon={<UploadFileIcon />}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? 'Uploading…' : 'Upload CSV / XLSX'}
        </Button>
        <input
          ref={fileInput} hidden type="file" accept=".csv,.xlsx"
          onChange={(e) => e.target.files?.[0] && uploadFile(e.target.files[0])}
        />
      </Stack>
      {busy && <LinearProgress sx={{ mb: 2 }} />}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {result && (
        <Box>
          <Alert severity={result.errors.length === 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
            Imported <b>{result.created}</b> of <b>{result.total}</b> rows.
            {result.errors.length > 0 && ` ${result.errors.length} row(s) had errors.`}
          </Alert>
          {result.errors.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>Row</TableCell>
                  <TableCell>Error</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.errors.map((e) => (
                  <TableRow key={e.row}>
                    <TableCell>{e.row}</TableCell>
                    <TableCell>{e.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      )}
    </Paper>
  );
}

function GstinQuickAdd() {
  const [text, setText] = useState('');
  const [partyType, setPartyType] = useState('customer');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<GstinResult | null>(null);
  const [err, setErr] = useState('');

  const gstinList = () =>
    text.split(/[\s,]+/).map((g) => g.trim().toUpperCase()).filter(Boolean);

  const run = async (dryRun: boolean) => {
    const gstins = gstinList();
    if (!gstins.length) {
      setErr('Paste at least one GSTIN — one per line, comma- or space-separated.');
      return;
    }
    setBusy(true);
    setErr('');
    setResult(null);
    try {
      const { data } = await api.post<GstinResult>('/imports/parties/from-gstins/', {
        gstins,
        type: partyType,
        dry_run: dryRun,
      });
      setResult(data);
    } catch (e: any) {
      setErr(e?.response?.data?.detail || 'Quick add failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Paper sx={{ p: 2.5 }}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Paste a list of GSTINs — one per line. Each GSTIN auto-decodes into <b>state, PAN, GST treatment</b> and place of supply. Click <b>Preview</b> to see what will be created, then <b>Save all</b> to commit. You can rename the parties later from the Parties page.
      </Typography>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} sx={{ mb: 2 }}>
        <TextField
          select size="small" label="Party type"
          value={partyType} onChange={(e) => setPartyType(e.target.value)}
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="customer">Customer</MenuItem>
          <MenuItem value="supplier">Supplier</MenuItem>
          <MenuItem value="both">Both</MenuItem>
        </TextField>
      </Stack>
      <TextField
        fullWidth multiline minRows={5} maxRows={14}
        placeholder={'27AABCN1234D1Z5\n29NEWGS1111N1Z2\n07ZYXWV5678Q1Z3'}
        value={text}
        onChange={(e) => setText(e.target.value)}
        sx={{ mb: 2 }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Button
          variant="outlined" startIcon={<CloudDownloadIcon />}
          disabled={busy} onClick={() => run(true)}
        >
          {busy ? 'Working…' : 'Preview'}
        </Button>
        <Button
          variant="contained" startIcon={<UploadFileIcon />}
          disabled={busy} onClick={() => run(false)}
        >
          Save all
        </Button>
        <Box sx={{ flexGrow: 1 }} />
        <Chip size="small" label={`${gstinList().length} GSTIN${gstinList().length === 1 ? '' : 's'} ready`} />
      </Stack>
      {busy && <LinearProgress sx={{ mb: 2 }} />}
      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {result && (
        <Box>
          <Alert severity={result.errors.length === 0 ? 'success' : 'warning'} sx={{ mb: 2 }}>
            {result.created > 0
              ? <>Created <b>{result.created}</b> draft {partyType}{result.created === 1 ? '' : 's'} from <b>{result.total}</b> GSTIN{result.total === 1 ? '' : 's'}.</>
              : <>Preview ready for <b>{result.preview.length}</b> GSTIN{result.preview.length === 1 ? '' : 's'} — click <b>Save all</b> to commit.</>}
            {result.errors.length > 0 && ` ${result.errors.length} skipped.`}
          </Alert>

          {result.preview.length > 0 && (
            <TableContainer sx={{ mb: 2 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>GSTIN</TableCell>
                    <TableCell>PAN</TableCell>
                    <TableCell>State</TableCell>
                    <TableCell>Code</TableCell>
                    <TableCell>Treatment</TableCell>
                    <TableCell>Placeholder name</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {result.preview.map((p) => (
                    <TableRow key={p.gstin}>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{p.gstin}</TableCell>
                      <TableCell sx={{ fontFamily: 'monospace' }}>{p.pan}</TableCell>
                      <TableCell>{p.state}</TableCell>
                      <TableCell>{p.state_code}</TableCell>
                      <TableCell>{p.gst_treatment}</TableCell>
                      <TableCell>{p.name_placeholder}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {result.errors.length > 0 && (
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>GSTIN</TableCell>
                  <TableCell>Issue</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {result.errors.map((e, i) => (
                  <TableRow key={`${e.gstin}-${i}`}>
                    <TableCell sx={{ fontFamily: 'monospace' }}>{e.gstin || '—'}</TableCell>
                    <TableCell>{e.error}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </Box>
      )}
    </Paper>
  );
}
