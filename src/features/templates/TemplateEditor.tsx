/**
 * TemplateEditor — full-screen editor at /templates/:id/edit.
 * Layout:
 *   ┌─ Sticky topbar ────────────────────────────────────────────────┐
 *   │  ← Back · Name · v# · Set default · Duplicate · Save · Publish │
 *   ├──────────────────────────┬─────────────────────────────────────┤
 *   │  INSPECTOR (tabbed)      │  LIVE PREVIEW (sticky)              │
 *   │  Brand · Sections ·      │  iframe · paper info chip ·         │
 *   │  Columns · Layout ·      │  zoom controls                      │
 *   │  Rules · Routing · Terms │                                     │
 *   └──────────────────────────┴─────────────────────────────────────┘
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AppBar, Alert, Box, Button, Chip, Divider, FormControlLabel, Grid,
  IconButton, MenuItem, Paper, Slider, Stack, Switch, Tab, Tabs, TextField,
  Toolbar, Tooltip, Typography, alpha,
} from '@mui/material';

import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import FitScreenIcon from '@mui/icons-material/FitScreen';

import { api } from '@/app/api';
import {
  AddAssignment, Assignment, COND_FIELDS, COND_OPS, Column, Condition, Config,
  COLUMN_LABELS, DOC_TYPES, LogoUploader, SECTION_LABELS, Template, THEMES,
  TextFieldWithVariables, describeErr, moveColumn, moveSection, patchCond, reorderSections,
} from './shared';

type TabKey = 'brand' | 'sections' | 'columns' | 'layout' | 'rules' | 'routing' | 'terms';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'brand', label: 'Brand' },
  { key: 'sections', label: 'Sections' },
  { key: 'columns', label: 'Columns' },
  { key: 'layout', label: 'Layout' },
  { key: 'rules', label: 'Rules' },
  { key: 'routing', label: 'Routing' },
  { key: 'terms', label: 'Terms' },
];

export default function TemplateEditor() {
  const { id = '' } = useParams<{ id: string }>();
  const nav = useNavigate();

  const [draft, setDraft] = useState<Template | null>(null);
  const [dirty, setDirty] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [preview, setPreview] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [tab, setTab] = useState<TabKey>('brand');
  const [zoom, setZoom] = useState(1);

  const previewTimer = useRef<number | null>(null);

  // Load template + assignments
  useEffect(() => {
    if (!id) return;
    api.get(`/templates/${id}/`)
      .then((r) => setDraft(r.data as Template))
      .catch((e) => setErr(describeErr(e)));
    refreshAssignments(id);
  }, [id]);

  // Live preview — debounced 400ms re-render via /preview/ endpoint
  useEffect(() => {
    if (!draft) return;
    if (previewTimer.current) window.clearTimeout(previewTimer.current);
    previewTimer.current = window.setTimeout(async () => {
      try {
        const r = await api.post(`/templates/${draft.id}/preview/`, {
          config: draft.draft_config,
        });
        setPreview(r.data.html);
      } catch (e) { setErr(describeErr(e)); }
    }, 400);
  }, [draft?.draft_config]); // eslint-disable-line

  const refreshAssignments = async (tid: string) => {
    try {
      const r = await api.get(`/templates/${tid}/assignments/`);
      setAssignments(r.data as Assignment[]);
    } catch { /* 404 ok */ }
  };

  // Helpers
  const patchCfg = (patch: (c: Config) => Config) => {
    if (!draft) return;
    setDraft({ ...draft, draft_config: patch(draft.draft_config) });
    setDirty(true);
  };

  const saveDraft = async () => {
    if (!draft) return;
    try {
      await api.patch(`/templates/${draft.id}/draft/`, {
        draft_config: draft.draft_config,
      });
      setMsg('Draft saved'); setDirty(false);
    } catch (e) { setErr(describeErr(e)); }
  };

  const publish = async () => {
    if (!draft) return;
    try {
      await api.patch(`/templates/${draft.id}/draft/`, {
        draft_config: draft.draft_config,
      });
      const r = await api.post(`/templates/${draft.id}/publish/`);
      setDraft(r.data as Template);
      setMsg(`Published v${r.data.version}`); setDirty(false);
    } catch (e) { setErr(describeErr(e)); }
  };

  const duplicate = async () => {
    if (!draft) return;
    try {
      const r = await api.post(`/templates/${draft.id}/duplicate/`);
      nav(`/templates/${r.data.id}/edit`);
    } catch (e) { setErr(describeErr(e)); }
  };

  const setDefault = async () => {
    if (!draft) return;
    try {
      await api.post(`/templates/${draft.id}/set-default/`);
      setDraft({ ...draft, is_default: true });
      setMsg('Default updated');
    } catch (e) { setErr(describeErr(e)); }
  };

  // Patch top-level fields (name / doc type / theme) on blur
  const patchField = async (field: 'name' | 'document_type' | 'theme', value: string) => {
    if (!draft) return;
    try {
      const r = await api.patch(`/templates/${draft.id}/`, { [field]: value });
      setDraft({ ...draft, ...r.data });
    } catch (e) { setErr(describeErr(e)); }
  };

  const docLabel = useMemo(
    () => DOC_TYPES.find((d) => d[0] === draft?.document_type)?.[1] || draft?.document_type || '',
    [draft?.document_type],
  );

  if (!draft) {
    return (
      <Box sx={{ p: 3 }}>
        {err
          ? <Alert severity="error">{err}</Alert>
          : <Typography color="text.secondary">Loading template…</Typography>}
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      {/* Sticky topbar — stays in view while user scrolls inspector */}
      <AppBar
        position="sticky"
        elevation={0}
        sx={{
          // Re-anchor outside dashboard padding so it spans the full main area
          mx: { xs: -1.5, sm: -2, md: -3 },
          mt: { xs: -1.5, sm: -2, md: -3 },
          mb: 2,
          width: 'auto',
          left: 'auto', right: 'auto',
          borderBottom: 1, borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ minHeight: 56, gap: 1, px: { xs: 1.5, md: 3 } }}>
          <Tooltip title="Back to gallery">
            <IconButton onClick={() => nav('/templates')} size="small"><ArrowBackOutlinedIcon /></IconButton>
          </Tooltip>

          <Stack direction="row" spacing={1} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
            <TextField
              size="small" variant="standard"
              value={draft.name}
              onChange={(e) => { setDraft({ ...draft, name: e.target.value }); setDirty(true); }}
              onBlur={() => patchField('name', draft.name)}
              InputProps={{ disableUnderline: true, sx: { fontSize: 18, fontWeight: 700 } }}
              sx={{ minWidth: 240, flex: { xs: 1, md: 0 } }}
            />
            <Tooltip title={draft.is_default ? 'Default for this doc type' : 'Not the default'}>
              {draft.is_default
                ? <StarIcon sx={{ color: '#FFB300', fontSize: 18 }} />
                : <StarBorderIcon sx={{ color: 'text.disabled', fontSize: 18 }} />}
            </Tooltip>
            <Chip
              size="small" label={dirty ? 'Unsaved' : `v${draft.version}`}
              color={dirty ? 'warning' : 'default'}
              sx={{ fontWeight: 700 }}
            />
            <Chip
              size="small" label={docLabel}
              sx={{ display: { xs: 'none', md: 'inline-flex' },
                    bgcolor: 'rgba(79,195,247,0.10)', color: '#4FC3F7',
                    border: '1px solid rgba(79,195,247,0.32)' }}
            />
          </Stack>

          <Button size="small" onClick={setDefault} disabled={draft.is_default}>
            Set default
          </Button>
          <Button size="small" startIcon={<ContentCopyIcon />} onClick={duplicate}
            sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>
            Duplicate
          </Button>
          <Button size="small" onClick={saveDraft} disabled={!dirty}>Save draft</Button>
          <Button size="small" variant="contained" onClick={publish}>Publish</Button>
        </Toolbar>
      </AppBar>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}
      {msg && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMsg('')}>{msg}</Alert>}

      {/* Body grid — Inspector | Preview */}
      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 0, position: 'sticky', top: 80, overflow: 'hidden' }}>
            {/* Inspector header — doc type + theme */}
            <Stack direction="row" spacing={1} sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
              <TextField
                size="small" select fullWidth label="Document type"
                value={draft.document_type}
                onChange={(e) => patchField('document_type', e.target.value)}
              >
                {DOC_TYPES.map(([v, l]) => <MenuItem key={v} value={v}>{l}</MenuItem>)}
              </TextField>
              <TextField
                size="small" select fullWidth label="Theme"
                value={draft.theme}
                onChange={(e) => patchField('theme', e.target.value)}
              >
                {THEMES.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
              </TextField>
            </Stack>

            {/* Inspector tabs */}
            <Tabs
              value={tab} onChange={(_, v) => setTab(v)}
              variant="scrollable" scrollButtons="auto"
              sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 40,
                    '& .MuiTab-root': { minHeight: 40, textTransform: 'none', fontWeight: 600 } }}
            >
              {TABS.map((t) => <Tab key={t.key} value={t.key} label={t.label} />)}
            </Tabs>

            <Box sx={{ p: 2, maxHeight: 'calc(100vh - 220px)', overflowY: 'auto' }}>
              {tab === 'brand' && <BrandTab draft={draft} patchCfg={patchCfg} setErr={setErr} />}
              {tab === 'sections' && <SectionsTab draft={draft} patchCfg={patchCfg} />}
              {tab === 'columns' && <ColumnsTab draft={draft} patchCfg={patchCfg} />}
              {tab === 'layout' && <LayoutTab draft={draft} patchCfg={patchCfg} />}
              {tab === 'rules' && <RulesTab draft={draft} patchCfg={patchCfg} />}
              {tab === 'routing' && (
                <RoutingTab
                  draft={draft}
                  assignments={assignments}
                  refresh={() => refreshAssignments(draft.id)}
                  setErr={setErr}
                />
              )}
              {tab === 'terms' && <TermsTab draft={draft} patchCfg={patchCfg} />}
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 1, position: 'sticky', top: 80 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1 }}>
              <Typography variant="subtitle2" sx={{ flex: 1 }}>Live preview</Typography>
              <Chip
                size="small"
                label={`${draft.draft_config.paper.size} · ${draft.draft_config.paper.orientation}`}
              />
              <Tooltip title="Zoom out">
                <IconButton size="small" onClick={() => setZoom((z) => Math.max(0.5, z - 0.1))}>
                  <ZoomOutIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Typography variant="caption" sx={{ minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(zoom * 100)}%
              </Typography>
              <Tooltip title="Zoom in">
                <IconButton size="small" onClick={() => setZoom((z) => Math.min(2, z + 0.1))}>
                  <ZoomInIcon fontSize="small" />
                </IconButton>
              </Tooltip>
              <Tooltip title="Fit (100%)">
                <IconButton size="small" onClick={() => setZoom(1)}><FitScreenIcon fontSize="small" /></IconButton>
              </Tooltip>
            </Stack>
            <Box sx={{
              height: 'calc(100vh - 180px)', overflow: 'auto',
              bgcolor: (t) => t.palette.mode === 'dark' ? '#222' : '#f5f5f5',
              borderRadius: 1,
              display: 'flex', justifyContent: 'center', p: 1.5,
            }}>
              <Box sx={{
                transform: `scale(${zoom})`, transformOrigin: 'top center',
                transition: 'transform .12s ease',
              }}>
                <iframe
                  title="template-preview" srcDoc={preview} sandbox=""
                  style={{
                    width: 794, height: 1123, // ~A4 at 96dpi
                    border: 'none', background: '#fff', display: 'block',
                    boxShadow: '0 14px 40px rgba(0,0,0,0.20)',
                  }}
                />
              </Box>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Tab content components
// ---------------------------------------------------------------------------

function BrandTab({
  draft, patchCfg, setErr,
}: { draft: Template; patchCfg: (f: (c: Config) => Config) => void; setErr: (s: string) => void }) {
  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5}>
        <Grid item xs={6}>
          <TextField size="small" fullWidth label="Primary color"
            value={draft.draft_config.branding.primary}
            onChange={(e) => patchCfg((c) => ({ ...c, branding: { ...c.branding, primary: e.target.value } }))} />
        </Grid>
        <Grid item xs={6}>
          <TextField size="small" fullWidth label="Accent color"
            value={draft.draft_config.branding.accent}
            onChange={(e) => patchCfg((c) => ({ ...c, branding: { ...c.branding, accent: e.target.value } }))} />
        </Grid>
        <Grid item xs={12}>
          <TextField size="small" fullWidth label="Tagline"
            value={draft.draft_config.branding.tagline || ''}
            onChange={(e) => patchCfg((c) => ({ ...c, branding: { ...c.branding, tagline: e.target.value } }))} />
        </Grid>
        <Grid item xs={12}>
          <LogoUploader
            value={draft.draft_config.assets.logo.data_url || ''}
            onChange={(next) => patchCfg((c) => ({ ...c, assets: { ...c.assets, logo: { ...c.assets.logo, data_url: next } } }))}
            onError={setErr}
          />
        </Grid>
        <Grid item xs={4}>
          <TextField size="small" select fullWidth label="Position"
            value={draft.draft_config.assets.logo.position}
            onChange={(e) => patchCfg((c) => ({ ...c, assets: { ...c.assets, logo: { ...c.assets.logo, position: e.target.value } } }))}>
            {['TL', 'TC', 'TR'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={4}>
          <Typography variant="caption">Width %</Typography>
          <Slider size="small" min={10} max={60}
            value={draft.draft_config.assets.logo.width_pct}
            onChange={(_, v) => patchCfg((c) => ({ ...c, assets: { ...c.assets, logo: { ...c.assets.logo, width_pct: v as number } } }))} />
        </Grid>
        <Grid item xs={4}>
          <Typography variant="caption">Opacity</Typography>
          <Slider size="small" min={0.1} max={1} step={0.05}
            value={draft.draft_config.assets.logo.opacity}
            onChange={(_, v) => patchCfg((c) => ({ ...c, assets: { ...c.assets, logo: { ...c.assets.logo, opacity: v as number } } }))} />
        </Grid>
      </Grid>
    </Stack>
  );
}

function SectionsTab({
  draft, patchCfg,
}: { draft: Template; patchCfg: (f: (c: Config) => Config) => void }) {
  return (
    <Stack spacing={0.5}>
      {[...draft.draft_config.sections].sort((a, b) => a.order - b.order).map((s, idx, arr) => (
        <Stack
          direction="row" key={s.id} spacing={1} alignItems="center"
          draggable
          onDragStart={(e) => { e.dataTransfer.setData('text/plain', s.id); e.dataTransfer.effectAllowed = 'move'; }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }}
          onDrop={(e) => {
            e.preventDefault();
            const fromId = e.dataTransfer.getData('text/plain');
            if (!fromId || fromId === s.id) return;
            reorderSections(patchCfg, fromId, s.id);
          }}
          sx={{
            px: 1, py: 0.75, border: 1, borderColor: 'divider', borderRadius: 1,
            cursor: 'grab', transition: 'background-color .15s, border-color .15s',
            '&:active': { cursor: 'grabbing' },
            '&:hover': { borderColor: 'primary.main',
              bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.03)' : 'rgba(15,23,42,0.02)' },
          }}
        >
          <DragIndicatorIcon fontSize="small" sx={{ color: 'text.disabled' }} />
          <Typography sx={{ flex: 1, fontWeight: s.enabled ? 600 : 400,
            color: s.enabled ? 'text.primary' : 'text.secondary' }}>
            {SECTION_LABELS[s.id] || s.id}
          </Typography>
          <IconButton size="small" disabled={idx === 0} onClick={() => moveSection(patchCfg, s.id, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
          <IconButton size="small" disabled={idx === arr.length - 1} onClick={() => moveSection(patchCfg, s.id, +1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
          <Switch size="small" checked={s.enabled}
            onChange={(e) => patchCfg((c) => ({ ...c, sections: c.sections.map((x) => x.id === s.id ? { ...x, enabled: e.target.checked } : x) }))} />
        </Stack>
      ))}
    </Stack>
  );
}

function ColumnsTab({
  draft, patchCfg,
}: { draft: Template; patchCfg: (f: (c: Config) => Config) => void }) {
  return (
    <Stack spacing={0.5}>
      {draft.draft_config.items_table.columns.map((c, i, arr) => (
        <Stack key={c.key} direction="row" spacing={1} alignItems="center"
          sx={{ px: 1, py: 0.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Typography sx={{ flex: 1 }}>{COLUMN_LABELS[c.key] || c.key}</Typography>
          <TextField size="small" type="number" sx={{ width: 80 }} label="w%"
            value={c.width_pct ?? ''}
            onChange={(e) => patchCfg((cfg) => ({ ...cfg, items_table: {
              ...cfg.items_table,
              columns: cfg.items_table.columns.map((x, j) => j === i ? { ...x, width_pct: Number(e.target.value) } : x),
            } }))} />
          <IconButton size="small" disabled={i === 0} onClick={() => moveColumn(patchCfg, i, -1)}><ArrowUpwardIcon fontSize="small" /></IconButton>
          <IconButton size="small" disabled={i === arr.length - 1} onClick={() => moveColumn(patchCfg, i, +1)}><ArrowDownwardIcon fontSize="small" /></IconButton>
          <Switch size="small" checked={c.visible}
            onChange={(e) => patchCfg((cfg) => ({ ...cfg, items_table: {
              ...cfg.items_table,
              columns: cfg.items_table.columns.map((x, j) => j === i ? { ...x, visible: e.target.checked } : x),
            } }))} />
        </Stack>
      ))}
    </Stack>
  );
}

function LayoutTab({
  draft, patchCfg,
}: { draft: Template; patchCfg: (f: (c: Config) => Config) => void }) {
  return (
    <Stack spacing={2.5}>
      {/* Paper */}
      <Stack spacing={1.5}>
        <Typography variant="caption" color="text.secondary"
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Paper & Print
        </Typography>
        <Grid container spacing={1.5}>
          <Grid item xs={6}>
            <TextField size="small" fullWidth select label="Paper" value={draft.draft_config.paper.size}
              onChange={(e) => patchCfg((c) => ({ ...c, paper: { ...c.paper, size: e.target.value } }))}>
              {['A4', 'A5', 'Letter', 'Thermal80'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField size="small" fullWidth select label="Orientation"
              value={draft.draft_config.paper.orientation}
              onChange={(e) => patchCfg((c) => ({ ...c, paper: { ...c.paper, orientation: e.target.value } }))}>
              {['portrait', 'landscape'].map((p) => <MenuItem key={p} value={p}>{p}</MenuItem>)}
            </TextField>
          </Grid>
          {(['t', 'r', 'b', 'l'] as const).map((k) => (
            <Grid item xs={3} key={k}>
              <TextField size="small" fullWidth type="number" label={`${k.toUpperCase()} mm`}
                value={draft.draft_config.paper.margins_mm[k]}
                onChange={(e) => patchCfg((c) => ({ ...c, paper: { ...c.paper, margins_mm: { ...c.paper.margins_mm, [k]: Number(e.target.value) } } }))} />
            </Grid>
          ))}
          <Grid item xs={6}>
            <TextField size="small" fullWidth type="number" label="Base font px"
              value={draft.draft_config.type.base_font_px}
              onChange={(e) => patchCfg((c) => ({ ...c, type: { ...c.type, base_font_px: Number(e.target.value) } }))} />
          </Grid>
          <Grid item xs={6}>
            <TextField size="small" fullWidth type="number" label="Line height" inputProps={{ step: 0.1 }}
              value={draft.draft_config.type.line_height}
              onChange={(e) => patchCfg((c) => ({ ...c, type: { ...c.type, line_height: Number(e.target.value) } }))} />
          </Grid>
        </Grid>
      </Stack>

      <Divider />

      {/* Watermark */}
      <Stack spacing={1.5}>
        <Typography variant="caption" color="text.secondary"
          sx={{ fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6 }}>
          Watermark
        </Typography>
        <TextField size="small" select label="Mode" value={draft.draft_config.watermark.mode}
          onChange={(e) => patchCfg((c) => ({ ...c, watermark: { ...c.watermark, mode: e.target.value as any } }))}>
          <MenuItem value="status_driven">Driven by document status</MenuItem>
          <MenuItem value="custom">Custom text</MenuItem>
          <MenuItem value="none">None</MenuItem>
        </TextField>
        {draft.draft_config.watermark.mode === 'custom' && (
          <TextField size="small" label="Custom text" value={draft.draft_config.watermark.custom_text || ''}
            onChange={(e) => patchCfg((c) => ({ ...c, watermark: { ...c.watermark, custom_text: e.target.value } }))} />
        )}
        {draft.draft_config.watermark.mode === 'status_driven' && (
          <Grid container spacing={1}>
            {['draft', 'paid', 'cancelled', 'overdue'].map((k) => (
              <Grid item xs={6} key={k}>
                <TextField size="small" fullWidth label={k}
                  value={draft.draft_config.watermark.map[k] || ''}
                  onChange={(e) => patchCfg((c) => ({ ...c, watermark: { ...c.watermark, map: { ...c.watermark.map, [k]: e.target.value } } }))} />
              </Grid>
            ))}
          </Grid>
        )}
        <Stack direction="row" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption">Opacity</Typography>
            <Slider size="small" min={0.02} max={0.5} step={0.02} value={draft.draft_config.watermark.opacity}
              onChange={(_, v) => patchCfg((c) => ({ ...c, watermark: { ...c.watermark, opacity: v as number } }))} />
          </Box>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption">Rotation °</Typography>
            <Slider size="small" min={-90} max={90} value={draft.draft_config.watermark.rotation_deg}
              onChange={(_, v) => patchCfg((c) => ({ ...c, watermark: { ...c.watermark, rotation_deg: v as number } }))} />
          </Box>
        </Stack>
      </Stack>
    </Stack>
  );
}

function RulesTab({
  draft, patchCfg,
}: { draft: Template; patchCfg: (f: (c: Config) => Config) => void }) {
  return (
    <Stack spacing={1}>
      {draft.draft_config.conditions.map((cond, i) => (
        <Paper key={cond.id} variant="outlined" sx={{ p: 1 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography variant="caption" color="text.secondary" sx={{ flex: 1 }}>
              Rule {i + 1}
            </Typography>
            <IconButton size="small"
              onClick={() => patchCfg((c) => ({ ...c, conditions: c.conditions.filter((x) => x.id !== cond.id) }))}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <TextField size="small" select label="When" sx={{ flex: 1 }}
              value={cond.when[0]?.field || 'igst_total'}
              onChange={(e) => patchCond(patchCfg, cond.id, { when: [{ ...cond.when[0], field: e.target.value }] })}>
              {COND_FIELDS.map((f) => <MenuItem key={f} value={f}>{f}</MenuItem>)}
            </TextField>
            <TextField size="small" select sx={{ width: 90 }} value={cond.when[0]?.op || 'eq'}
              onChange={(e) => patchCond(patchCfg, cond.id, { when: [{ ...cond.when[0], op: e.target.value as any }] })}>
              {COND_OPS.map((op) => <MenuItem key={op} value={op}>{op}</MenuItem>)}
            </TextField>
            <TextField size="small" sx={{ width: 100 }} label="Value" value={cond.when[0]?.value ?? 0}
              onChange={(e) => patchCond(patchCfg, cond.id, { when: [{ ...cond.when[0], value: isNaN(Number(e.target.value)) ? e.target.value : Number(e.target.value) }] })} />
          </Stack>
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            <Typography variant="caption" sx={{ alignSelf: 'center' }}>then hide</Typography>
            <TextField size="small" select sx={{ flex: 1 }}
              value={cond.then[0]?.target || 'items_table.columns.igst_amt'}
              onChange={(e) => patchCond(patchCfg, cond.id, { then: [{ action: 'hide', target: e.target.value }] })}>
              {Object.keys(COLUMN_LABELS).map((k) => <MenuItem key={k} value={`items_table.columns.${k}`}>column: {COLUMN_LABELS[k]}</MenuItem>)}
              {Object.keys(SECTION_LABELS).map((k) => <MenuItem key={k} value={`sections.${k}`}>section: {SECTION_LABELS[k]}</MenuItem>)}
            </TextField>
          </Stack>
        </Paper>
      ))}
      <Button size="small" startIcon={<AddIcon />}
        onClick={() => patchCfg((c) => ({
          ...c, conditions: [...c.conditions, {
            id: `rule-${Date.now()}`,
            when: [{ field: 'igst_total', op: 'eq', value: 0 }],
            then: [{ action: 'hide', target: 'items_table.columns.igst_amt' }],
          }],
        }))}
      >
        Add rule
      </Button>
    </Stack>
  );
}

function RoutingTab({
  draft, assignments, refresh, setErr,
}: {
  draft: Template;
  assignments: Assignment[];
  refresh: () => void;
  setErr: (s: string) => void;
}) {
  return (
    <Stack spacing={1}>
      {assignments.length === 0 && (
        <Typography variant="caption" color="text.secondary">
          No rules. This template is used only when it's set as the default for the document type.
        </Typography>
      )}
      {assignments.map((a) => (
        <Stack key={a.id} direction="row" alignItems="center" spacing={1}
          sx={{ px: 1, py: 0.5, border: 1, borderColor: 'divider', borderRadius: 1 }}>
          <Chip size="small" label={a.scope} />
          <Typography sx={{ flex: 1 }} variant="body2">
            {a.scope_ref_label || a.scope_ref_id || 'Any'}
          </Typography>
          <Chip size="small" variant="outlined" label={`prio ${a.priority}`} />
          <IconButton size="small" onClick={async () => {
            try {
              await api.delete(`/templates/assignments/${a.id}/`);
              refresh();
            } catch (e) { setErr(describeErr(e)); }
          }}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Stack>
      ))}
      <AddAssignment onAdd={async (payload) => {
        try {
          await api.post(`/templates/${draft.id}/assignments/`, payload);
          refresh();
        } catch (e) { setErr(describeErr(e)); }
      }} />
    </Stack>
  );
}

function TermsTab({
  draft, patchCfg,
}: { draft: Template; patchCfg: (f: (c: Config) => Config) => void }) {
  return (
    <Stack spacing={1.5}>
      {draft.draft_config.terms.blocks.map((b, i) => (
        <Stack key={i} spacing={1}>
          <TextField size="small" label="Title" value={b.title}
            onChange={(e) => patchCfg((c) => ({ ...c, terms: { blocks: c.terms.blocks.map((x, j) => j === i ? { ...x, title: e.target.value } : x) } }))} />
          <TextFieldWithVariables size="small" multiline minRows={2} label="Body"
            value={b.body_md}
            onValueChange={(next) => patchCfg((c) => ({ ...c, terms: { blocks: c.terms.blocks.map((x, j) => j === i ? { ...x, body_md: next } : x) } }))} />
        </Stack>
      ))}
      <Divider />
      <FormControlLabel control={
        <Switch checked={draft.draft_config.footer.show_signatory}
          onChange={(e) => patchCfg((c) => ({ ...c, footer: { ...c.footer, show_signatory: e.target.checked } }))} />
      } label="Show signatory" />
      <TextField size="small" label="Signatory label"
        value={draft.draft_config.footer.signatory_label}
        onChange={(e) => patchCfg((c) => ({ ...c, footer: { ...c.footer, signatory_label: e.target.value } }))} />
      <TextFieldWithVariables size="small" label="Footer note"
        value={draft.draft_config.footer.note || ''}
        onValueChange={(next) => patchCfg((c) => ({ ...c, footer: { ...c.footer, note: next } }))} />
    </Stack>
  );
}
