/**
 * TemplateCenter — gallery view at /templates.
 *
 * Browse + filter + create. Click any card to open the deep-edit view at
 * /templates/:id/edit. Keeping the gallery focused on selection means no
 * scrolling under an inspector and the cards get full real estate.
 */
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert, Box, Button, Card, CardContent, Chip, Grid, Paper, Stack,
  TextField, Tooltip, Typography, alpha,
} from '@mui/material';
import { keyframes } from '@emotion/react';
import AddIcon from '@mui/icons-material/Add';
import StarIcon from '@mui/icons-material/Star';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';

import { api } from '@/app/api';
import EmptyState from '@/components/EmptyState';
import { DOC_TYPES, THEME_COLORS, Template, describeErr } from './shared';

const fadeUp = keyframes`
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
`;

export default function TemplateCenter() {
  const nav = useNavigate();
  const [rows, setRows] = useState<Template[]>([]);
  const [docTypeFilter, setDocTypeFilter] = useState<string>('all');
  const [searchQ, setSearchQ] = useState<string>('');
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  const loadList = async () => {
    setLoading(true);
    try {
      const r = await api.get('/templates/');
      setRows((r.data.results ?? r.data) as Template[]);
    } catch (e) {
      setErr(describeErr(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadList(); }, []);

  const createNew = async () => {
    try {
      const r = await api.post('/templates/', {
        name: 'New Template',
        document_type: 'sales_invoice',
        theme: 'classic',
      });
      nav(`/templates/${r.data.id}/edit`);
    } catch (e) {
      setErr(describeErr(e));
    }
  };

  // Filtered + searched rows
  const visibleRows = useMemo(() => {
    let list = rows;
    if (docTypeFilter !== 'all') list = list.filter((r) => r.document_type === docTypeFilter);
    const q = searchQ.trim().toLowerCase();
    if (q) {
      list = list.filter((r) =>
        r.name.toLowerCase().includes(q)
        || (DOC_TYPES.find((d) => d[0] === r.document_type)?.[1] || '').toLowerCase().includes(q)
      );
    }
    return [...list].sort(
      (a, b) => (b.is_default ? 1 : 0) - (a.is_default ? 1 : 0) || a.name.localeCompare(b.name),
    );
  }, [rows, docTypeFilter, searchQ]);

  // Only show doc-type chips that have at least one template — keeps the strip tight
  const docTypesInUse = useMemo(() => {
    const set = new Set(rows.map((r) => r.document_type));
    return DOC_TYPES.filter(([id]) => set.has(id));
  }, [rows]);

  return (
    <Box>
      {/* Hero header */}
      <Box sx={{
        position: 'relative',
        mx: { xs: -1.5, sm: -2, md: -3 },
        mt: { xs: -1.5, sm: -2, md: -3 },
        mb: 3,
        px: { xs: 2, md: 3 }, py: { xs: 2.5, md: 3 },
        overflow: 'hidden',
        borderBottom: '1px solid',
        borderColor: 'divider',
        background: (t) => t.palette.mode === 'dark'
          ? 'radial-gradient(900px 320px at 0% 0%, rgba(0,230,118,0.10), transparent 60%),'
            + 'radial-gradient(700px 280px at 100% 0%, rgba(79,195,247,0.16), transparent 65%),'
            + 'linear-gradient(180deg, rgba(255,255,255,0.02) 0%, transparent 100%)'
          : 'linear-gradient(180deg, rgba(0,230,118,0.05), transparent 100%)',
      }}>
        <Box aria-hidden sx={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          backgroundImage: (t) => t.palette.mode === 'dark'
            ? 'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),'
              + 'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)'
            : 'linear-gradient(rgba(15,23,42,0.04) 1px, transparent 1px),'
              + 'linear-gradient(90deg, rgba(15,23,42,0.04) 1px, transparent 1px)',
          backgroundSize: '36px 36px',
          maskImage: 'radial-gradient(ellipse at top left, black 0%, transparent 70%)',
          WebkitMaskImage: 'radial-gradient(ellipse at top left, black 0%, transparent 70%)',
        }} />
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ xs: 'flex-start', md: 'center' }}
          spacing={2} sx={{ position: 'relative' }}>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ flex: 1 }}>
            <Box sx={{
              width: 38, height: 38, borderRadius: 1.5,
              display: 'grid', placeItems: 'center', color: '#fff',
              background: 'linear-gradient(135deg, #00E676, #4FC3F7)',
              boxShadow: '0 8px 22px rgba(0,230,118,0.35)',
            }}>
              <DesignServicesOutlinedIcon fontSize="small" />
            </Box>
            <Box>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.25 }}>
                <Typography variant="h5" sx={{ fontWeight: 800, letterSpacing: -0.3 }}>
                  Document Templates
                </Typography>
                <Chip size="small" label={`${rows.length} templates`} sx={{
                  height: 22, fontWeight: 700,
                  background: 'rgba(0,230,118,0.12)', color: '#00E676',
                  border: '1px solid rgba(0,230,118,0.32)',
                }} />
              </Stack>
              <Typography variant="body2" color="text.secondary">
                Brand your invoices, bills, statements and 12 other document types · GST-compliant
              </Typography>
            </Box>
          </Stack>
          <Button startIcon={<AddIcon />} variant="contained" size="large" onClick={createNew}>
            New Template
          </Button>
        </Stack>
      </Box>

      {err && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setErr('')}>{err}</Alert>}

      {/* Filter strip */}
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <TextField
          size="small"
          placeholder="Search templates by name…"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          InputProps={{
            startAdornment: <SearchOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.disabled' }} />,
          }}
          sx={{ minWidth: { xs: '100%', md: 320 } }}
        />
        <Box sx={{
          display: 'flex', gap: 0.75, overflowX: 'auto', flexWrap: { xs: 'nowrap', md: 'wrap' },
          '&::-webkit-scrollbar': { height: 0 },
        }}>
          <Chip
            label="All"
            onClick={() => setDocTypeFilter('all')}
            color={docTypeFilter === 'all' ? 'primary' : 'default'}
            variant={docTypeFilter === 'all' ? 'filled' : 'outlined'}
            sx={{ cursor: 'pointer' }}
          />
          {docTypesInUse.map(([id, label]) => (
            <Chip
              key={id}
              label={label}
              onClick={() => setDocTypeFilter(id)}
              color={docTypeFilter === id ? 'primary' : 'default'}
              variant={docTypeFilter === id ? 'filled' : 'outlined'}
              sx={{ cursor: 'pointer', whiteSpace: 'nowrap' }}
            />
          ))}
        </Box>
      </Stack>

      {/* Gallery */}
      {visibleRows.length === 0 ? (
        <Paper sx={{ p: 5, mb: 2, borderRadius: 2 }}>
          <EmptyState
            icon={<DesignServicesOutlinedIcon />}
            title={loading ? 'Loading templates…'
              : (searchQ || docTypeFilter !== 'all') ? 'No templates match'
              : 'No templates yet'}
            body={loading ? '' :
              (searchQ || docTypeFilter !== 'all')
                ? 'Try clearing filters or switching the document type.'
                : 'Click New Template, or run python manage.py seed_premium_templates to seed 7 premium presets.'}
            action={!loading && !searchQ && docTypeFilter === 'all'
              ? <Button variant="contained" startIcon={<AddIcon />} onClick={createNew}>New Template</Button>
              : undefined}
          />
        </Paper>
      ) : (
        <Grid container spacing={2}>
          {visibleRows.map((t, idx) => {
            const [c1, c2] = THEME_COLORS[t.theme] || ['#4FC3F7', '#00E676'];
            const docLabel = DOC_TYPES.find((d) => d[0] === t.document_type)?.[1] || t.document_type;
            return (
              <Grid item xs={12} sm={6} md={4} lg={3} key={t.id}>
                <Card
                  onClick={() => nav(`/templates/${t.id}/edit`)}
                  sx={{
                    cursor: 'pointer', position: 'relative', borderRadius: 2,
                    overflow: 'hidden', bgcolor: 'transparent', backgroundImage: 'none',
                    border: 1, borderColor: 'divider',
                    transition: 'transform .25s ease, border-color .25s ease, box-shadow .25s ease',
                    animation: `${fadeUp} .35s ease-out ${(idx % 12) * 0.03}s both`,
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      borderColor: alpha(c1, 0.6),
                      boxShadow: `0 16px 36px ${alpha(c1, 0.18)}`,
                    },
                  }}
                >
                  {/* Faux invoice paper thumbnail */}
                  <Box sx={{
                    position: 'relative', height: 156, overflow: 'hidden',
                    background: `linear-gradient(135deg, ${alpha(c1, 0.18)} 0%, ${alpha(c2, 0.08)} 100%)`,
                  }}>
                    <Box sx={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Box sx={{
                        width: '70%', height: '78%',
                        bgcolor: (theme) => theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.94)' : '#fff',
                        borderRadius: 0.75,
                        boxShadow: '0 12px 26px rgba(0,0,0,0.20)',
                        position: 'relative', p: 0.75,
                      }}>
                        <Box sx={{
                          height: 14, width: '46%', borderRadius: 0.5,
                          background: `linear-gradient(90deg, ${c1}, ${c2})`, mb: 0.5,
                        }} />
                        {[68, 52, 80, 74, 60, 42].map((w, i) => (
                          <Box key={i} sx={{
                            height: 4, width: `${w}%`, bgcolor: 'rgba(15,23,42,0.18)',
                            borderRadius: 0.5, mb: 0.5,
                          }} />
                        ))}
                        <Box sx={{
                          position: 'absolute', bottom: 6, right: 6,
                          height: 8, width: '38%', borderRadius: 0.5, background: c1,
                        }} />
                      </Box>
                    </Box>
                    <Chip
                      size="small" label={t.theme}
                      sx={{
                        position: 'absolute', top: 8, left: 8,
                        height: 20, fontSize: 10, fontWeight: 700, textTransform: 'capitalize',
                        background: alpha(c1, 0.18), color: c1,
                        border: `1px solid ${alpha(c1, 0.45)}`,
                        backdropFilter: 'blur(6px)',
                      }}
                    />
                    {t.is_default && (
                      <Tooltip title="Default for this document type">
                        <Box sx={{
                          position: 'absolute', top: 8, right: 8,
                          display: 'flex', alignItems: 'center', gap: 0.5,
                          px: 0.75, py: 0.25, borderRadius: 999,
                          background: 'rgba(0,230,118,0.18)',
                          border: '1px solid rgba(0,230,118,0.45)',
                          color: '#00E676', backdropFilter: 'blur(6px)',
                        }}>
                          <StarIcon sx={{ fontSize: 12 }} />
                          <Typography variant="caption" sx={{ fontWeight: 700, fontSize: 10 }}>DEFAULT</Typography>
                        </Box>
                      </Tooltip>
                    )}
                    {t.is_system && (
                      <Chip
                        size="small" label="System"
                        sx={{
                          position: 'absolute', bottom: 8, right: 8,
                          height: 18, fontSize: 9.5, fontWeight: 700,
                          background: 'rgba(15,23,42,0.45)', color: '#fff',
                          border: '1px solid rgba(255,255,255,0.18)',
                          backdropFilter: 'blur(6px)',
                        }}
                      />
                    )}
                  </Box>

                  <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
                    <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                      <Typography variant="body1" sx={{ fontWeight: 700, flex: 1 }} noWrap>
                        {t.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary"
                        sx={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                        v{t.version}
                      </Typography>
                    </Stack>
                    <Stack direction="row" alignItems="center" spacing={0.75}>
                      <ReceiptLongOutlinedIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary" noWrap sx={{ flex: 1 }}>
                        {docLabel}
                      </Typography>
                      {!!t.assignment_count && (
                        <Chip
                          size="small"
                          label={`${t.assignment_count} rule${t.assignment_count > 1 ? 's' : ''}`}
                          sx={{
                            height: 18, fontSize: 10, fontWeight: 600,
                            background: 'rgba(79,195,247,0.10)', color: '#4FC3F7',
                            border: '1px solid rgba(79,195,247,0.32)',
                          }}
                        />
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Grid>
            );
          })}
        </Grid>
      )}
    </Box>
  );
}
