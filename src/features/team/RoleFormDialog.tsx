import { useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Grid, Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { api } from '@/app/api';

type Action = { key: string; label: string; code: string };
type Submodule = { key: string; label: string; actions: Action[] };
type Module = { key: string; label: string; submodules: Submodule[] };

type Props = {
  open: boolean;
  roleId: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export default function RoleFormDialog({ open, roleId, onClose, onSaved }: Props) {
  const [tabIdx, setTabIdx] = useState(0);
  const [modules, setModules] = useState<Module[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [code, setCode] = useState('');
  const [isSystem, setIsSystem] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  // Pre-compute a union of every action key used across the catalogue, so the
  // matrix has consistent columns across tabs.
  const allActions = useMemo<string[]>(() => {
    const keys = new Set<string>();
    modules.forEach((m) => m.submodules.forEach(
      (s) => s.actions.forEach((a) => keys.add(a.key)),
    ));
    const order = ['manage', 'create', 'view', 'edit', 'delete', 'print', 'export'];
    return order.filter((k) => keys.has(k));
  }, [modules]);

  useEffect(() => {
    if (!open) return;
    setErr('');
    setTabIdx(0);
    (async () => {
      try {
        const { data } = await api.get('/rbac/permissions/grouped/');
        setModules(data.modules);

        if (roleId) {
          const { data: role } = await api.get(`/rbac/roles/${roleId}/`);
          setName(role.name);
          setCode(role.code);
          setDescription(role.description || '');
          setIsSystem(!!role.is_system);
          setSelected(new Set(role.permission_codes));
        } else {
          setName(''); setCode(''); setDescription('');
          setIsSystem(false); setSelected(new Set());
        }
      } catch (e: any) {
        setErr(e?.response?.data?.detail || 'Failed to load permissions');
      }
    })();
  }, [open, roleId]);

  const toggleCode = (c: string, checked: boolean) => {
    const next = new Set(selected);
    checked ? next.add(c) : next.delete(c);
    setSelected(next);
  };

  const toggleSubmodule = (s: Submodule, checked: boolean) => {
    const next = new Set(selected);
    s.actions.forEach((a) => (checked ? next.add(a.code) : next.delete(a.code)));
    setSelected(next);
  };

  const toggleTab = (m: Module, checked: boolean) => {
    const next = new Set(selected);
    m.submodules.forEach((s) =>
      s.actions.forEach((a) => (checked ? next.add(a.code) : next.delete(a.code))),
    );
    setSelected(next);
  };

  const submoduleStatus = (s: Submodule) => {
    const codes = s.actions.map((a) => a.code);
    const picked = codes.filter((c) => selected.has(c)).length;
    return { all: picked === codes.length, some: picked > 0 && picked < codes.length };
  };

  const tabStatus = (m: Module) => {
    const codes = m.submodules.flatMap((s) => s.actions.map((a) => a.code));
    const picked = codes.filter((c) => selected.has(c)).length;
    return { all: picked === codes.length, some: picked > 0 && picked < codes.length };
  };

  const selectedCountForTab = (m: Module) =>
    m.submodules
      .flatMap((s) => s.actions)
      .filter((a) => selected.has(a.code)).length;

  const save = async () => {
    setErr(''); setSaving(true);
    try {
      const payload = {
        name, code, description,
        permission_codes: Array.from(selected),
      };
      if (roleId) {
        await api.patch(`/rbac/roles/${roleId}/`, payload);
      } else {
        await api.post('/rbac/roles/', payload);
      }
      onSaved();
    } catch (e: any) {
      setErr(
        e?.response?.data?.detail
          || JSON.stringify(e?.response?.data || {})
          || 'Save failed',
      );
    } finally {
      setSaving(false);
    }
  };

  const activeModule = modules[tabIdx];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>{roleId ? 'Edit Role' : 'Create New Role'}</DialogTitle>
      <DialogContent dividers>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        {isSystem && (
          <Alert severity="info" sx={{ mb: 2 }}>
            System role — name and code are locked, but you can adjust the
            permission matrix.
          </Alert>
        )}

        <Grid container spacing={2} sx={{ mb: 2 }}>
          <Grid item xs={12} sm={5}>
            <TextField
              fullWidth label="Role name" required
              value={name} onChange={(e) => setName(e.target.value)}
              disabled={isSystem}
            />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField
              fullWidth label="Code" required
              value={code} onChange={(e) => setCode(e.target.value)}
              helperText="Lowercase, a-z and underscore"
              disabled={isSystem || !!roleId}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <TextField
              fullWidth label="Description"
              value={description} onChange={(e) => setDescription(e.target.value)}
            />
          </Grid>
        </Grid>

        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 1 }}>
          <Tabs
            value={tabIdx}
            onChange={(_, v) => setTabIdx(v)}
            variant="scrollable"
            scrollButtons="auto"
          >
            {modules.map((m, i) => {
              const picked = selectedCountForTab(m);
              return (
                <Tab
                  key={m.key}
                  label={`${m.label}${picked ? ` (${picked})` : ''}`}
                />
              );
            })}
          </Tabs>
        </Box>

        {activeModule && (
          <Stack spacing={1}>
            <Stack direction="row" justifyContent="space-between" alignItems="center">
              <FormControlLabel
                control={
                  <Checkbox
                    checked={tabStatus(activeModule).all}
                    indeterminate={tabStatus(activeModule).some}
                    onChange={(e) => toggleTab(activeModule, e.target.checked)}
                  />
                }
                label={<b>Select all {activeModule.label}</b>}
              />
              <Typography variant="caption" color="text.secondary">
                {selectedCountForTab(activeModule)} selected in this tab
              </Typography>
            </Stack>

            <TableContainer component={Box} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell width={40} />
                    <TableCell><b>Module</b></TableCell>
                    {allActions.map((a) => (
                      <TableCell key={a} align="center" sx={{ textTransform: 'capitalize' }}>
                        <b>{a}</b>
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {activeModule.submodules.map((s) => {
                    const st = submoduleStatus(s);
                    const byAction = Object.fromEntries(s.actions.map((a) => [a.key, a.code]));
                    return (
                      <TableRow key={s.key} hover>
                        <TableCell>
                          <Checkbox
                            size="small"
                            checked={st.all}
                            indeterminate={st.some}
                            onChange={(e) => toggleSubmodule(s, e.target.checked)}
                          />
                        </TableCell>
                        <TableCell>{s.label}</TableCell>
                        {allActions.map((a) => {
                          const code = byAction[a];
                          if (!code) {
                            return <TableCell key={a} align="center" sx={{ color: 'text.disabled' }}>—</TableCell>;
                          }
                          return (
                            <TableCell key={a} align="center">
                              <Checkbox
                                size="small"
                                checked={selected.has(code)}
                                onChange={(e) => toggleCode(code, e.target.checked)}
                              />
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        <Typography variant="caption" color="text.secondary" sx={{ mr: 'auto', ml: 2 }}>
          {selected.size} permissions selected across all tabs
        </Typography>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save} disabled={saving || !name || !code}>
          {roleId ? 'Save' : 'Create Role'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
