/**
 * Global ⌘K / Ctrl+K command palette.
 *
 * Two layers of results:
 *   1. Static commands (navigate to /sales/new, /payments/new, etc.)
 *   2. Live search via existing /suggest/<entity>/?q= endpoint
 *      (parties, items, hsn — see backend/apps/suggest)
 *
 * Listens for the keyboard shortcut at window-level so it's reachable from
 * anywhere inside the dashboard shell.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box, Chip, Dialog, IconButton, InputAdornment, List, ListItemButton,
  ListItemIcon, ListItemText, Stack, TextField, Typography, alpha,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import SearchIcon from '@mui/icons-material/Search';
import KeyboardCommandKeyIcon from '@mui/icons-material/KeyboardCommandKey';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import LocalMallOutlinedIcon from '@mui/icons-material/LocalMallOutlined';
import PaymentsOutlinedIcon from '@mui/icons-material/PaymentsOutlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import SpaceDashboardOutlinedIcon from '@mui/icons-material/SpaceDashboardOutlined';
import BarChartOutlinedIcon from '@mui/icons-material/BarChartOutlined';
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined';
import { api } from '@/app/api';

type CommandItem = {
  key: string;
  group: 'Actions' | 'Navigate' | 'Parties' | 'Items';
  label: string;
  hint?: string;
  href: string;
  icon: React.ReactNode;
};

const STATIC_COMMANDS: CommandItem[] = [
  { key: 'new-invoice', group: 'Actions', label: 'New invoice', hint: 'Create sales invoice', href: '/sales/invoices/new', icon: <ReceiptLongOutlinedIcon /> },
  { key: 'new-bill', group: 'Actions', label: 'New purchase bill', href: '/purchases/bills/new', icon: <LocalMallOutlinedIcon /> },
  { key: 'new-expense', group: 'Actions', label: 'New expense', href: '/expenses?new=1', icon: <LocalMallOutlinedIcon /> },
  { key: 'new-payment', group: 'Actions', label: 'Record payment', href: '/payments?new=1', icon: <PaymentsOutlinedIcon /> },
  { key: 'new-party', group: 'Actions', label: 'Add party', href: '/parties?new=1', icon: <GroupsOutlinedIcon /> },
  { key: 'new-item', group: 'Actions', label: 'Add item', href: '/items?new=1', icon: <Inventory2OutlinedIcon /> },
  { key: 'bulk-import', group: 'Actions', label: 'Bulk import', hint: 'CSV / XLSX', href: '/settings/import', icon: <UploadFileOutlinedIcon /> },
  { key: 'go-dash', group: 'Navigate', label: 'Dashboard', href: '/dashboard', icon: <SpaceDashboardOutlinedIcon /> },
  { key: 'go-invoices', group: 'Navigate', label: 'Sales invoices', href: '/sales/invoices', icon: <ReceiptLongOutlinedIcon /> },
  { key: 'go-bills', group: 'Navigate', label: 'Purchase bills', href: '/purchases/bills', icon: <LocalMallOutlinedIcon /> },
  { key: 'go-parties', group: 'Navigate', label: 'Parties', href: '/parties', icon: <GroupsOutlinedIcon /> },
  { key: 'go-items', group: 'Navigate', label: 'Items', href: '/items', icon: <Inventory2OutlinedIcon /> },
  { key: 'go-reports', group: 'Navigate', label: 'Reports', href: '/reports', icon: <BarChartOutlinedIcon /> },
];

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);

export default function CommandPalette() {
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [parties, setParties] = useState<{ id: string; name: string; phone?: string }[]>([]);
  const [items, setItems] = useState<{ id: string; name: string; sku?: string }[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // ⌘K / Ctrl+K listener — global. Also listens to a custom event so any
  // button (e.g. topbar search trigger) can open the palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    const onOpen = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('open-command-palette', onOpen);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('open-command-palette', onOpen);
    };
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) { setQ(''); setActive(0); setParties([]); setItems([]); }
    else setTimeout(() => inputRef.current?.focus(), 50);
  }, [open]);

  // Live search (debounced)
  useEffect(() => {
    if (!q.trim()) { setParties([]); setItems([]); return; }
    const id = window.setTimeout(async () => {
      try {
        const [pr, ir] = await Promise.all([
          api.get('/suggest/parties/', { params: { q, limit: 5 } }).catch(() => ({ data: [] })),
          api.get('/suggest/items/', { params: { q, limit: 5 } }).catch(() => ({ data: [] })),
        ]);
        setParties(Array.isArray(pr.data) ? pr.data : pr.data?.results || []);
        setItems(Array.isArray(ir.data) ? ir.data : ir.data?.results || []);
      } catch { /* ignore */ }
    }, 180);
    return () => window.clearTimeout(id);
  }, [q]);

  const filtered = useMemo<CommandItem[]>(() => {
    const term = q.trim().toLowerCase();
    const stat = term
      ? STATIC_COMMANDS.filter((c) =>
          c.label.toLowerCase().includes(term) || c.hint?.toLowerCase().includes(term))
      : STATIC_COMMANDS;
    // Send the user straight to the selected entity rather than the list —
    // landing on the list and re-finding the row defeats the palette's point.
    const partyRows: CommandItem[] = parties.map((p) => ({
      key: 'party-' + p.id, group: 'Parties', label: p.name,
      hint: p.phone || '', href: `/parties?focus=${p.id}`, icon: <GroupsOutlinedIcon />,
    }));
    const itemRows: CommandItem[] = items.map((it) => ({
      key: 'item-' + it.id, group: 'Items', label: it.name,
      hint: it.sku || '', href: `/items?focus=${it.id}`, icon: <Inventory2OutlinedIcon />,
    }));
    return [...stat, ...partyRows, ...itemRows];
  }, [q, parties, items]);

  const grouped = useMemo(() => {
    const out: Record<string, CommandItem[]> = {};
    filtered.forEach((c) => { (out[c.group] ||= []).push(c); });
    return out;
  }, [filtered]);

  // Keyboard nav over flat list
  const flat = filtered;
  useEffect(() => {
    if (active >= flat.length) setActive(0);
  }, [flat.length, active]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, flat.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    if (e.key === 'Enter')     { e.preventDefault(); if (flat[active]) { nav(flat[active].href); setOpen(false); } }
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          mt: 8, alignSelf: 'flex-start',
          background: (t) => t.palette.mode === 'dark'
            ? 'linear-gradient(180deg, rgba(20,20,22,0.92), rgba(11,11,11,0.92))'
            : 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
          border: (t) => `1px solid ${t.palette.mode === 'dark' ? 'rgba(255,255,255,0.10)' : 'rgba(15,23,42,0.08)'}`,
          boxShadow: (t) => t.palette.mode === 'dark'
            ? '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,230,118,0.10) inset'
            : '0 30px 80px rgba(15,23,42,0.18)',
          borderRadius: 2.5,
        },
      }}
    >
      <Box sx={{ p: 1.5, pb: 0 }}>
        <TextField
          inputRef={inputRef}
          fullWidth
          autoFocus
          placeholder="Search invoices, parties, items, actions…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setActive(0); }}
          onKeyDown={onKeyDown}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start"><SearchIcon /></InputAdornment>
            ),
            endAdornment: (
              <InputAdornment position="end">
                <Stack direction="row" spacing={0.5} alignItems="center">
                  <Chip size="small" label={isMac ? '⌘K' : 'Ctrl K'} variant="outlined"
                    sx={{ height: 22, fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' }}
                  />
                  <IconButton size="small" onClick={() => setOpen(false)}>
                    <Box component="span" sx={{ fontSize: 12, color: 'text.secondary' }}>esc</Box>
                  </IconButton>
                </Stack>
              </InputAdornment>
            ),
            sx: { borderRadius: 1.5 },
          }}
        />
      </Box>

      <Box sx={{ p: 1.5, maxHeight: 480, overflowY: 'auto' }}>
        {flat.length === 0 ? (
          <Stack alignItems="center" sx={{ py: 4 }}>
            <KeyboardCommandKeyIcon sx={{ fontSize: 36, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body2" color="text.secondary">No results.</Typography>
            <Typography variant="caption" color="text.disabled">Try "invoice", a party name, or an SKU.</Typography>
          </Stack>
        ) : (
          Object.entries(grouped).map(([group, items]) => (
            <Box key={group} sx={{ mb: 1 }}>
              <Typography variant="caption" sx={{ pl: 1.5, color: 'text.secondary', fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase' }}>
                {group}
              </Typography>
              <List dense disablePadding>
                {items.map((c) => {
                  const flatIdx = flat.findIndex((f) => f.key === c.key);
                  const isActive = flatIdx === active;
                  return (
                    <ListItemButton
                      key={c.key}
                      selected={isActive}
                      onMouseEnter={() => setActive(flatIdx)}
                      onClick={() => { nav(c.href); setOpen(false); }}
                      sx={{
                        borderRadius: 1.5, mb: 0.25, px: 1.25,
                        '&.Mui-selected': {
                          background: (t) => t.palette.mode === 'dark'
                            ? alpha('#00E676', 0.10)
                            : alpha('#2563EB', 0.08),
                          '&:hover': {
                            background: (t) => t.palette.mode === 'dark'
                              ? alpha('#00E676', 0.16)
                              : alpha('#2563EB', 0.12),
                          },
                        },
                      }}
                    >
                      <ListItemIcon sx={{ minWidth: 32, color: 'text.secondary' }}>{c.icon}</ListItemIcon>
                      <ListItemText
                        primary={c.label}
                        secondary={c.hint || undefined}
                        primaryTypographyProps={{ fontSize: 14, fontWeight: 600 }}
                        secondaryTypographyProps={{ fontSize: 12 }}
                      />
                      {isActive && (
                        <Chip size="small" label="↵" sx={{ height: 20, fontSize: 11, fontFamily: '"IBM Plex Mono", monospace' }} />
                      )}
                    </ListItemButton>
                  );
                })}
              </List>
            </Box>
          ))
        )}
      </Box>

      <Box sx={{ px: 1.75, py: 1, borderTop: 1, borderColor: 'divider', display: 'flex', alignItems: 'center', gap: 1 }}>
        <Typography variant="caption" color="text.secondary">
          ↑ ↓ navigate · ↵ open · esc close
        </Typography>
      </Box>
    </Dialog>
  );
}
