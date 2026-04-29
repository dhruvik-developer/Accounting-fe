/**
 * Reusable confirmation dialog. Replaces window.confirm() / inline AlertDialog
 * boilerplate so destructive actions stay consistent across the app.
 *
 * Usage:
 *   const [open, setOpen] = useState(false);
 *   <ConfirmDialog
 *     open={open}
 *     title="Delete invoice INV-001?"
 *     body="This action cannot be undone. Linked payments stay intact."
 *     tone="danger"
 *     confirmLabel="Delete"
 *     onConfirm={async () => { await api.delete(...); setOpen(false); }}
 *     onClose={() => setOpen(false)}
 *   />
 */
import { useState } from 'react';
import {
  Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogContentText, DialogTitle, Stack, Typography, alpha,
} from '@mui/material';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';

type Tone = 'danger' | 'warning' | 'info';

const TONE: Record<Tone, { color: string; icon: React.ReactNode; label: string }> = {
  danger:  { color: '#FF5252', icon: <DeleteOutlineOutlinedIcon />, label: 'Confirm' },
  warning: { color: '#FFB300', icon: <WarningAmberOutlinedIcon />, label: 'Continue' },
  info:    { color: '#4FC3F7', icon: <HelpOutlineOutlinedIcon />, label: 'OK' },
};

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  tone?: Tone;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  /** When true, the confirm button stays disabled until typed text matches title */
  requireTypedConfirm?: string;
};

export default function ConfirmDialog({
  open, title, body, tone = 'info',
  confirmLabel, cancelLabel = 'Cancel',
  onConfirm, onClose, requireTypedConfirm,
}: ConfirmDialogProps) {
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState('');
  const t = TONE[tone];
  const canConfirm = !requireTypedConfirm || typed === requireTypedConfirm;

  const handleConfirm = async () => {
    if (!canConfirm) return;
    try {
      setBusy(true);
      await onConfirm();
    } finally {
      setBusy(false);
      setTyped('');
    }
  };

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="xs"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 2,
          border: (theme) => `1px solid ${alpha(t.color, theme.palette.mode === 'dark' ? 0.30 : 0.20)}`,
        },
      }}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" spacing={1.25} alignItems="center">
          <Box sx={{
            width: 36, height: 36, borderRadius: 1.5, display: 'grid', placeItems: 'center', color: '#fff',
            background: `linear-gradient(135deg, ${t.color}, ${alpha(t.color, 0.55)})`,
            boxShadow: `0 6px 16px ${alpha(t.color, 0.45)}`,
          }}>
            {t.icon}
          </Box>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>{title}</Typography>
        </Stack>
      </DialogTitle>
      <DialogContent>
        {body && (
          typeof body === 'string'
            ? <DialogContentText>{body}</DialogContentText>
            : body
        )}
        {requireTypedConfirm && (
          <Box sx={{ mt: 2 }}>
            <Typography variant="caption" color="text.secondary">
              Type <b>{requireTypedConfirm}</b> to confirm
            </Typography>
            <Box
              component="input"
              value={typed}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTyped(e.target.value)}
              sx={{
                width: '100%', mt: 0.5, p: 1,
                bgcolor: 'transparent',
                color: 'text.primary',
                border: 1, borderColor: 'divider', borderRadius: 1,
                fontFamily: '"IBM Plex Mono", monospace',
                outline: 'none',
                '&:focus': { borderColor: t.color },
              }}
              placeholder={requireTypedConfirm}
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={busy}>{cancelLabel}</Button>
        <Button
          onClick={handleConfirm}
          disabled={busy || !canConfirm}
          variant="contained"
          startIcon={busy ? <CircularProgress size={14} color="inherit" /> : null}
          sx={{
            bgcolor: t.color,
            '&:hover': { bgcolor: t.color, filter: 'brightness(0.92)' },
            color: '#fff',
            fontWeight: 700,
          }}
        >
          {confirmLabel || t.label}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
