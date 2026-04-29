/**
 * Shared types, constants, helpers + small components used by both
 * TemplateCenter (gallery) and TemplateEditor (deep-edit view).
 */
import { useRef, useState } from 'react';
import {
  Box, Button, MenuItem, Stack, TextField, Typography, alpha,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VariablePicker from '@/components/VariablePicker';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Section = { id: string; enabled: boolean; order: number; props?: any };
export type Column = {
  key: string; visible: boolean; width_pct?: number;
  align?: 'left' | 'right' | 'center'; label?: string;
};
export type Condition = {
  id: string;
  when: { field: string; op: 'eq' | 'ne' | 'gt' | 'lt' | 'gte' | 'lte'; value: any }[];
  then: { action: 'hide' | 'show'; target: string }[];
};
export type Config = {
  schema_version: number;
  meta: { name: string; language?: string; density?: string };
  paper: {
    size: string; orientation: string;
    margins_mm: { t: number; r: number; b: number; l: number };
  };
  type: { font_family: string; base_font_px: number; line_height: number };
  branding: { primary: string; accent: string; text: string; muted: string; tagline?: string };
  assets: {
    logo: {
      asset_id?: string | null; position: string;
      width_pct: number; opacity: number; data_url?: string;
    };
    signatures: any[];
  };
  sections: Section[];
  items_table: {
    columns: Column[]; show_totals_row: boolean; show_amount_in_words: boolean;
  };
  watermark: {
    mode: 'status_driven' | 'custom' | 'none';
    map: Record<string, string>;
    opacity: number; rotation_deg: number; custom_text?: string;
  };
  conditions: Condition[];
  terms: { blocks: { title: string; body_md: string }[] };
  footer: {
    show_signatory: boolean; signatory_label: string;
    show_qr?: boolean; qr_source?: string; note?: string;
  };
};
export type Template = {
  id: string;
  name: string;
  document_type: string;
  theme: string;
  is_default: boolean;
  is_active: boolean;
  is_system?: boolean;
  version: number;
  config: Config;
  draft_config: Config;
  thumbnail?: string;
  assignment_count?: number;
  updated_at?: string;
};
export type Assignment = {
  id: string;
  template: string;
  scope: 'branch' | 'party' | 'party_group' | 'tag' | 'currency';
  scope_ref_id: string | null;
  scope_ref_label?: string;
  priority: number;
  active: boolean;
};

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const DOC_TYPES: [string, string][] = [
  ['sales_invoice', 'Sales Invoice'],
  ['tax_invoice', 'Tax Invoice'],
  ['proforma_invoice', 'Proforma Invoice'],
  ['quotation', 'Quotation / Estimate'],
  ['sales_order', 'Sales Order'],
  ['delivery_challan', 'Delivery Challan'],
  ['payment_receipt', 'Payment Receipt'],
  ['credit_note', 'Credit Note'],
  ['purchase_order', 'Purchase Order'],
  ['purchase_bill', 'Purchase Bill'],
  ['debit_note', 'Debit Note'],
  ['expense_voucher', 'Expense Voucher'],
  ['stock_transfer', 'Stock Transfer'],
  ['customer_statement', 'Customer Statement'],
  ['ledger_statement', 'Ledger Statement'],
];

export const SECTION_LABELS: Record<string, string> = {
  header: 'Header', party: 'Party / Bill To', items: 'Items Table',
  tax: 'Tax Summary', totals: 'Totals',
  bank: 'Bank Details', upi_qr: 'UPI QR Block', signature: 'Signature Line',
  notes: 'Notes & Terms', footer: 'Footer',
};

export const COLUMN_LABELS: Record<string, string> = {
  sr_no: '#', item_name: 'Item', description: 'Description',
  hsn_sac: 'HSN/SAC', quantity: 'Qty', uom: 'UoM', rate: 'Rate',
  discount: 'Disc', gst_pct: 'GST %', cgst_amt: 'CGST', sgst_amt: 'SGST',
  igst_amt: 'IGST', amount: 'Amount',
};

export const COND_FIELDS = [
  'igst_total', 'cgst_total', 'sgst_total', 'grand_total', 'line_count', 'status',
];

export const COND_OPS: Condition['when'][0]['op'][] = ['eq', 'ne', 'gt', 'lt', 'gte', 'lte'];

export const THEMES = ['classic', 'modern', 'minimal', 'dark', 'corporate', 'thermal'];

// Theme accent colors used in gallery thumbnails
export const THEME_COLORS: Record<string, [string, string]> = {
  classic:   ['#1565C0', '#0D47A1'],
  modern:    ['#00E676', '#00C853'],
  minimal:   ['#111111', '#4FC3F7'],
  dark:      ['#00E676', '#0B0B0B'],
  corporate: ['#1E3A8A', '#C7A66B'],
  thermal:   ['#000000', '#444444'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const describeErr = (e: any) =>
  e?.response?.data?.detail
  || (typeof e?.response?.data === 'string' ? e.response.data : null)
  || JSON.stringify(e?.response?.data || {})
  || e?.message
  || 'Error';

export function moveSection(
  patch: (f: (c: Config) => Config) => void, id: string, delta: number,
) {
  patch((c) => {
    const sorted = [...c.sections].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex((s) => s.id === id);
    const swap = idx + delta;
    if (swap < 0 || swap >= sorted.length) return c;
    [sorted[idx], sorted[swap]] = [sorted[swap], sorted[idx]];
    return { ...c, sections: sorted.map((s, i) => ({ ...s, order: i })) };
  });
}

export function reorderSections(
  patch: (f: (c: Config) => Config) => void, fromId: string, toId: string,
) {
  patch((c) => {
    const sorted = [...c.sections].sort((a, b) => a.order - b.order);
    const fromIdx = sorted.findIndex((s) => s.id === fromId);
    const toIdx = sorted.findIndex((s) => s.id === toId);
    if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return c;
    const [moved] = sorted.splice(fromIdx, 1);
    sorted.splice(toIdx, 0, moved);
    return { ...c, sections: sorted.map((s, i) => ({ ...s, order: i })) };
  });
}

export function moveColumn(
  patch: (f: (c: Config) => Config) => void, i: number, delta: number,
) {
  patch((c) => {
    const cols = [...c.items_table.columns];
    const j = i + delta;
    if (j < 0 || j >= cols.length) return c;
    [cols[i], cols[j]] = [cols[j], cols[i]];
    return { ...c, items_table: { ...c.items_table, columns: cols } };
  });
}

export function patchCond(
  patch: (f: (c: Config) => Config) => void, id: string, fields: Partial<Condition>,
) {
  patch((c) => ({
    ...c,
    conditions: c.conditions.map((x) =>
      x.id === id ? ({ ...x, ...fields } as Condition) : x),
  }));
}

// ---------------------------------------------------------------------------
// LogoUploader — drag-drop / click image upload, base64 inline
// ---------------------------------------------------------------------------

const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'];

export function LogoUploader({
  value, onChange, onError,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
  onError?: (msg: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showUrl, setShowUrl] = useState(false);

  const ingest = (file: File | undefined | null) => {
    if (!file) return;
    if (!LOGO_MIME_TYPES.includes(file.type)) {
      onError?.(`Logo must be PNG, JPG, WEBP, or SVG. Picked ${file.type || 'unknown'}.`);
      return;
    }
    if (file.size > LOGO_MAX_BYTES) {
      onError?.(`Logo must be under 2 MB. Got ${(file.size / 1024 / 1024).toFixed(2)} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ''));
    reader.onerror = () => onError?.('Could not read file. Try again.');
    reader.readAsDataURL(file);
  };

  return (
    <Stack spacing={1}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
        Company logo
      </Typography>

      {value ? (
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{
          p: 1.25, borderRadius: 1.5, border: 1, borderColor: 'divider',
          bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.02)',
        }}>
          <Box sx={{
            width: 84, height: 56, borderRadius: 1, flex: '0 0 auto',
            display: 'grid', placeItems: 'center', overflow: 'hidden',
            bgcolor: '#fff', border: 1, borderColor: 'divider',
          }}>
            <Box component="img" src={value} alt="Logo preview"
              sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
          </Box>
          <Stack sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>Logo uploaded</Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              ~{Math.round((value.length * 0.75) / 1024)} KB · embedded
            </Typography>
          </Stack>
          <Button size="small" onClick={() => inputRef.current?.click()}>Replace</Button>
          <Button size="small" color="error" onClick={() => onChange('')}>Remove</Button>
        </Stack>
      ) : (
        <Box
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => { e.preventDefault(); setDragOver(false); ingest(e.dataTransfer.files?.[0]); }}
          role="button" tabIndex={0}
          sx={{
            cursor: 'pointer', p: 2, borderRadius: 1.5,
            border: '2px dashed',
            borderColor: dragOver ? 'primary.main' : 'divider',
            background: (t) => dragOver
              ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.10 : 0.06)
              : 'transparent',
            textAlign: 'center', transition: 'background-color .15s, border-color .15s',
            '&:hover': { borderColor: 'primary.main' },
          }}
        >
          <Stack alignItems="center" spacing={0.5}>
            <Box sx={{
              width: 36, height: 36, borderRadius: 1,
              display: 'grid', placeItems: 'center',
              color: 'primary.main',
              background: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.10 : 0.08),
            }}>
              <AddIcon />
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              Drop logo here or click to upload
            </Typography>
            <Typography variant="caption" color="text.secondary">
              PNG · JPG · WEBP · SVG · up to 2 MB
            </Typography>
          </Stack>
        </Box>
      )}

      <input ref={inputRef} type="file" hidden
        accept="image/png,image/jpeg,image/webp,image/svg+xml"
        onChange={(e) => { ingest(e.target.files?.[0]); e.target.value = ''; }}
      />

      <Box>
        <Button size="small" onClick={() => setShowUrl((v) => !v)} sx={{ px: 0.5, textTransform: 'none' }}>
          {showUrl ? 'Hide URL input' : 'Or paste an image URL'}
        </Button>
        {showUrl && (
          <TextField size="small" fullWidth
            placeholder="https://… or data:image/png;base64,…"
            value={value} onChange={(e) => onChange(e.target.value)} sx={{ mt: 0.5 }}
          />
        )}
      </Box>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// TextFieldWithVariables — TextField + inline VariablePicker
// ---------------------------------------------------------------------------

type TFVProps = Omit<React.ComponentProps<typeof TextField>, 'onChange' | 'value'> & {
  value: string;
  onValueChange: (next: string) => void;
};

export function TextFieldWithVariables({
  value, onValueChange, label, ...rest
}: TFVProps) {
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const insertAtCaret = (token: string) => {
    const el = inputRef.current;
    if (!el) { onValueChange(value + token); return; }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    const next = value.slice(0, start) + token + value.slice(end);
    onValueChange(next);
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + token.length;
      el.setSelectionRange(pos, pos);
    });
  };
  return (
    <Box sx={{ position: 'relative' }}>
      <TextField {...rest} label={label} value={value}
        onChange={(e) => onValueChange(e.target.value)}
        inputRef={inputRef} fullWidth
      />
      <Box sx={{ position: 'absolute', top: rest.multiline ? 6 : 4, right: 4 }}>
        <VariablePicker onPick={insertAtCaret} label="Insert variable" variant="icon" />
      </Box>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// AddAssignment — inline form for creating routing rules
// ---------------------------------------------------------------------------

export function AddAssignment({ onAdd }: { onAdd: (p: any) => void }) {
  const [scope, setScope] = useState<Assignment['scope']>('branch');
  const [refId, setRefId] = useState('');
  const [label, setLabel] = useState('');
  const [priority, setPriority] = useState(100);
  return (
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
      <TextField size="small" select value={scope} onChange={(e) => setScope(e.target.value as any)} sx={{ width: 120 }}>
        {(['branch', 'party', 'party_group', 'tag', 'currency'] as const).map((s) =>
          <MenuItem key={s} value={s}>{s}</MenuItem>)}
      </TextField>
      <TextField size="small" placeholder="UUID ref" value={refId} onChange={(e) => setRefId(e.target.value)} sx={{ flex: 1, minWidth: 160 }} />
      <TextField size="small" placeholder="Label" value={label} onChange={(e) => setLabel(e.target.value)} sx={{ flex: 1, minWidth: 120 }} />
      <TextField size="small" type="number" value={priority} onChange={(e) => setPriority(Number(e.target.value))} sx={{ width: 80 }} />
      <Button size="small" startIcon={<AddIcon />} onClick={() => {
        onAdd({ scope, scope_ref_id: refId || null, scope_ref_label: label, priority, active: true });
        setRefId(''); setLabel('');
      }}>Add</Button>
    </Stack>
  );
}
