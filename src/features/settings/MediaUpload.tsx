/**
 * Reusable media upload tile used by the Business Profile branding section.
 *
 * Behavior:
 *  - Empty state: dashed drop zone with upload button.
 *  - With value: image preview + Replace + Remove buttons.
 *  - Validates MIME type and file size before emitting onChange.
 *  - Surfaces a per-tile error message (does not throw).
 *
 * Storage:
 *  - This component is storage-agnostic — the parent decides what `value` is.
 *  - Today the parent stashes a base64 data URL on the business object (mock).
 *  - When the upload endpoint ships, replace the FileReader path in the parent
 *    with a multipart POST and persist the returned URL instead.
 */
import { useRef, useState } from 'react';
import {
  Box, Button, Card, CardContent, Chip, Stack, Typography, alpha,
} from '@mui/material';
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import DeleteOutlineOutlinedIcon from '@mui/icons-material/DeleteOutlineOutlined';
import ErrorOutlineOutlinedIcon from '@mui/icons-material/ErrorOutlineOutlined';

export type MediaUploadProps = {
  label: string;
  /** Short helper text under the label (recommended size, file types, etc). */
  hint?: string;
  /** What this asset is used for — shown as a small caption inside the card. */
  usedFor?: string;
  /** Mark the asset as optional in the heading. */
  optional?: boolean;
  /** Comma-separated MIME accept list — e.g. "image/png,image/jpeg,image/svg+xml". */
  accept: string;
  /** Max file size in bytes. Defaults to 2 MB. */
  maxBytes?: number;
  /** Image URL or data URL — when truthy a preview is shown. */
  value?: string | null;
  onChange: (next: { url: string; file: File } | null) => void;
  /** Width:height ratio for the preview frame. Defaults to 16/9. */
  aspect?: number;
  icon?: React.ReactNode;
};

const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;

function readableSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function readAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(typeof fr.result === 'string' ? fr.result : '');
    fr.onerror = () => reject(fr.error);
    fr.readAsDataURL(file);
  });
}

export default function MediaUpload({
  label, hint, usedFor, optional,
  accept, maxBytes = DEFAULT_MAX_BYTES,
  value, onChange, aspect = 16 / 9, icon,
}: MediaUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [err, setErr] = useState('');

  const accepted = accept.split(',').map((s) => s.trim());

  const pick = () => inputRef.current?.click();

  const handleFile = async (file: File | undefined) => {
    setErr('');
    if (!file) return;

    // MIME guard — `accept` on <input> isn't enforced on every browser/OS.
    const mimeOk = accepted.some((t) => {
      if (t === file.type) return true;
      // accept handles .ext-style entries too, e.g. ".png"
      if (t.startsWith('.')) return file.name.toLowerCase().endsWith(t.toLowerCase());
      return false;
    });
    if (!mimeOk) {
      setErr(`Unsupported format. Use ${accepted.join(', ')}.`);
      return;
    }

    if (file.size > maxBytes) {
      setErr(`File is ${readableSize(file.size)}. Max allowed is ${readableSize(maxBytes)}.`);
      return;
    }

    try {
      const url = await readAsDataURL(file);
      onChange({ url, file });
    } catch {
      setErr('Could not read this file. Try another one.');
    }
  };

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    // Reset so picking the same file twice still triggers change.
    e.target.value = '';
  };

  return (
    <Card variant="outlined" sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 0.5 }}>
          {icon && (
            <Box sx={{
              width: 28, height: 28, borderRadius: 1,
              display: 'grid', placeItems: 'center',
              bgcolor: (t) => alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.16 : 0.10),
              color: 'primary.main',
            }}>
              {icon}
            </Box>
          )}
          <Typography variant="subtitle2" sx={{ fontWeight: 700, flex: 1 }}>
            {label}
          </Typography>
          {optional && (
            <Chip size="small" label="Optional" sx={{ height: 20, fontWeight: 600, fontSize: 10.5 }} />
          )}
        </Stack>

        {/* Preview / drop zone */}
        <Box
          onClick={value ? undefined : pick}
          sx={{
            position: 'relative',
            width: '100%',
            aspectRatio: String(aspect),
            borderRadius: 1.5,
            border: '1.5px dashed',
            borderColor: err ? 'error.main' : 'divider',
            bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.02)' : 'rgba(15,23,42,0.025)',
            cursor: value ? 'default' : 'pointer',
            display: 'grid', placeItems: 'center',
            overflow: 'hidden',
            transition: 'border-color .15s ease, background-color .15s ease',
            '&:hover': value ? undefined : {
              borderColor: 'primary.main',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.04),
            },
          }}
        >
          {value ? (
            <Box
              component="img"
              src={value}
              alt={label}
              sx={{
                maxWidth: '100%', maxHeight: '100%',
                objectFit: 'contain',
                p: 1,
              }}
            />
          ) : (
            <Stack alignItems="center" spacing={0.5} sx={{ color: 'text.secondary', textAlign: 'center', px: 2 }}>
              <CloudUploadOutlinedIcon sx={{ color: 'text.disabled' }} />
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                Click to upload
              </Typography>
              {hint && (
                <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
                  {hint}
                </Typography>
              )}
            </Stack>
          )}
        </Box>

        {/* Helper / error / actions */}
        <Stack spacing={0.75} sx={{ mt: 1.25 }}>
          {usedFor && !err && (
            <Typography variant="caption" color="text.secondary" sx={{ fontSize: 11 }}>
              {usedFor}
            </Typography>
          )}
          {hint && value && !err && (
            <Typography variant="caption" color="text.disabled" sx={{ fontSize: 11 }}>
              {hint}
            </Typography>
          )}
          {err && (
            <Stack direction="row" spacing={0.5} alignItems="flex-start">
              <ErrorOutlineOutlinedIcon sx={{ color: 'error.main', fontSize: 14, mt: '2px' }} />
              <Typography variant="caption" color="error.main" sx={{ fontSize: 11 }}>{err}</Typography>
            </Stack>
          )}

          <Stack direction="row" spacing={1}>
            {value ? (
              <>
                <Button
                  size="small"
                  startIcon={<RefreshOutlinedIcon fontSize="small" />}
                  onClick={pick}
                  variant="outlined"
                >
                  Replace
                </Button>
                <Button
                  size="small"
                  color="error"
                  startIcon={<DeleteOutlineOutlinedIcon fontSize="small" />}
                  onClick={() => { setErr(''); onChange(null); }}
                >
                  Remove
                </Button>
              </>
            ) : (
              <Button
                size="small"
                startIcon={<CloudUploadOutlinedIcon fontSize="small" />}
                onClick={pick}
                variant="contained"
                fullWidth
              >
                Upload
              </Button>
            )}
          </Stack>
        </Stack>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          hidden
          onChange={onInputChange}
        />
      </CardContent>
    </Card>
  );
}
