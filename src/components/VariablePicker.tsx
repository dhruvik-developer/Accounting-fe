/**
 * VariablePicker — popover that lists every placeholder variable available
 * in document templates, grouped by domain (company, party, doc, items,
 * payment, config). Click a variable → onPick fires with the literal
 * placeholder string ready for the editor to insert.
 *
 * Backend source: GET /api/v1/document-templates/variables/
 *   { groups: [...], flat: [...] }
 *
 * Usage:
 *   const editorRef = useRef<HTMLTextAreaElement>(null);
 *   <VariablePicker
 *     onPick={(token) => insertAtCursor(editorRef.current, token)}
 *   />
 */
import { useEffect, useMemo, useState } from 'react';
import {
  Box, Chip, IconButton, InputAdornment, List, ListItemButton, ListItemText,
  Popover, Stack, TextField, Tooltip, Typography, alpha,
} from '@mui/material';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import { api } from '@/app/api';
import { notify } from '@/components/Notifier';

type Variable = {
  key: string;
  label: string;
  type: 'string' | 'money' | 'number' | 'date' | 'image' | 'color' | 'block';
  group: string;
  group_label: string;
};

type Group = {
  group: string;
  label: string;
  variables: Omit<Variable, 'group' | 'group_label'>[];
};

const TYPE_TONES: Record<Variable['type'], string> = {
  string: '#4FC3F7', money: '#00E676', number: '#00E676',
  date: '#B388FF', image: '#FF80AB', color: '#FFB300', block: '#FF5252',
};

export type VariablePickerProps = {
  /** Called with the placeholder string (e.g. "{{customer.name}}") */
  onPick?: (token: string) => void;
  /** Shown in the trigger button */
  label?: string;
  /** Override icon trigger with an inline-block-style chip */
  variant?: 'icon' | 'button';
};

export default function VariablePicker({
  onPick, label = 'Insert variable', variant = 'icon',
}: VariablePickerProps) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [q, setQ] = useState('');
  const [activeGroup, setActiveGroup] = useState<string>('');

  useEffect(() => {
    if (!anchor || groups.length) return;
    api.get('/document-templates/variables/')
      .then((r) => {
        const next: Group[] = r.data?.groups || [];
        setGroups(next);
        setActiveGroup(next[0]?.group || '');
      })
      .catch(() => {
        notify({ severity: 'error', message: 'Could not load template variables.' });
      });
  }, [anchor, groups.length]);

  const filtered = useMemo<Variable[]>(() => {
    const flat: Variable[] = [];
    for (const g of groups) {
      if (activeGroup && q === '' && g.group !== activeGroup) continue;
      for (const v of g.variables) {
        flat.push({ ...v, group: g.group, group_label: g.label });
      }
    }
    if (!q.trim()) return flat;
    const term = q.toLowerCase();
    return flat.filter((v) =>
      v.key.toLowerCase().includes(term) ||
      v.label.toLowerCase().includes(term) ||
      v.group_label.toLowerCase().includes(term),
    );
  }, [groups, activeGroup, q]);

  const close = () => { setAnchor(null); setQ(''); };

  const pick = async (token: string) => {
    if (onPick) onPick(token);
    try {
      await navigator.clipboard?.writeText(token);
      notify({ severity: 'success', message: `Copied ${token}` });
    } catch { /* clipboard not available */ }
    close();
  };

  return (
    <>
      {variant === 'icon' ? (
        <Tooltip title={label}>
          <IconButton size="small" onClick={(e) => setAnchor(e.currentTarget)}>
            <CodeOutlinedIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ) : (
        <Chip
          icon={<CodeOutlinedIcon />}
          label={label}
          onClick={(e) => setAnchor(e.currentTarget)}
          sx={{ cursor: 'pointer' }}
        />
      )}

      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={close}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
        PaperProps={{
          sx: { width: 380, maxHeight: 520, p: 0, borderRadius: 2, overflow: 'hidden' },
        }}
      >
        <Box sx={{ p: 1.5, pb: 1 }}>
          <TextField
            fullWidth size="small" autoFocus
            placeholder="Search variables…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>
              ),
            }}
          />
        </Box>

        {q === '' && (
          <Box sx={{ display: 'flex', gap: 0.75, px: 1.5, pb: 1, flexWrap: 'wrap' }}>
            {groups.map((g) => (
              <Chip
                key={g.group}
                size="small"
                label={g.label}
                variant={activeGroup === g.group ? 'filled' : 'outlined'}
                onClick={() => setActiveGroup(g.group)}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        )}

        <List dense sx={{ overflowY: 'auto', maxHeight: 380, pt: 0 }}>
          {filtered.length === 0 && (
            <Stack sx={{ py: 4, alignItems: 'center' }}>
              <Typography variant="body2" color="text.secondary">No variables match "{q}"</Typography>
            </Stack>
          )}
          {filtered.map((v) => (
            <ListItemButton
              key={v.key}
              onClick={() => pick(v.key)}
              sx={{
                borderRadius: 1, mx: 0.75, my: 0.15,
                '&:hover .copy': { opacity: 1 },
              }}
            >
              <Box sx={{
                width: 6, height: 6, borderRadius: '50%', mr: 1.25,
                bgcolor: TYPE_TONES[v.type] || '#888',
                boxShadow: `0 0 8px ${TYPE_TONES[v.type] || '#888'}`,
              }} />
              <ListItemText
                primary={v.label}
                secondary={v.key}
                primaryTypographyProps={{ fontSize: 13, fontWeight: 600 }}
                secondaryTypographyProps={{
                  fontSize: 11,
                  fontFamily: '"IBM Plex Mono", monospace',
                  sx: { color: (t) => alpha(t.palette.text.secondary, 0.85) },
                }}
              />
              <Box className="copy" sx={{ opacity: 0, transition: 'opacity .15s ease' }}>
                <ContentCopyOutlinedIcon fontSize="small" sx={{ color: 'text.secondary' }} />
              </Box>
            </ListItemButton>
          ))}
        </List>
      </Popover>
    </>
  );
}
