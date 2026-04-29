/**
 * PaperSizeSelector — visual radio cards for A4 / A5 / Thermal80 with
 * a per-size live mini-preview (proportional rectangle).
 *
 * Consumed by template editors to set `config.paper.size` and orientation.
 *
 *   <PaperSizeSelector
 *     value={{ size: cfg.paper.size, orientation: cfg.paper.orientation }}
 *     onChange={(next) => setCfg({ ...cfg, paper: { ...cfg.paper, ...next } })}
 *   />
 */
import { Box, Stack, ToggleButton, ToggleButtonGroup, Typography, alpha } from '@mui/material';
import StayCurrentPortraitOutlinedIcon from '@mui/icons-material/StayCurrentPortraitOutlined';
import StayCurrentLandscapeOutlinedIcon from '@mui/icons-material/StayCurrentLandscapeOutlined';

export type PaperSize = 'A4' | 'A5' | 'Letter' | 'Thermal80';
export type PaperOrientation = 'portrait' | 'landscape';

export type PaperValue = { size: PaperSize; orientation: PaperOrientation };

const SIZES: { id: PaperSize; label: string; w: number; h: number; hint: string }[] = [
  { id: 'A4',        label: 'A4',         w: 210, h: 297, hint: '210 × 297 mm · most common' },
  { id: 'A5',        label: 'A5',         w: 148, h: 210, hint: '148 × 210 mm · half page' },
  { id: 'Letter',    label: 'Letter',     w: 216, h: 279, hint: 'US 8.5 × 11 in' },
  { id: 'Thermal80', label: 'Thermal 80', w: 80,  h: 200, hint: '80 mm POS receipt' },
];

export type PaperSizeSelectorProps = {
  value: PaperValue;
  onChange: (v: PaperValue) => void;
  /** Hide orientation toggle when only thermal/A5 makes sense */
  hideOrientation?: boolean;
  size?: 'small' | 'medium';
};

export default function PaperSizeSelector({
  value, onChange, hideOrientation, size = 'medium',
}: PaperSizeSelectorProps) {
  const orientation = value.orientation || 'portrait';
  // Thermal is always portrait — hide the orientation toggle for it.
  const showOrientation = !hideOrientation && value.size !== 'Thermal80';

  // Scale every preview rectangle relative to the largest side across all sizes,
  // so they sit visually next to each other in correct proportion.
  const maxDim = Math.max(...SIZES.map((s) => Math.max(s.w, s.h)));
  const previewMax = size === 'small' ? 70 : 96;

  const swap = (s: typeof SIZES[number]): typeof SIZES[number] =>
    orientation === 'landscape' && s.id !== 'Thermal80' ? { ...s, w: s.h, h: s.w } : s;

  return (
    <Box>
      <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
        {SIZES.map((s) => {
          const sized = swap(s);
          const w = (sized.w / maxDim) * previewMax;
          const h = (sized.h / maxDim) * previewMax;
          const selected = value.size === s.id;
          return (
            <Box
              key={s.id}
              role="button"
              onClick={() => onChange({ size: s.id, orientation: s.id === 'Thermal80' ? 'portrait' : orientation })}
              sx={{
                cursor: 'pointer',
                px: 1.5, py: 1.25,
                borderRadius: 2,
                border: 1,
                borderColor: selected ? 'primary.main' : 'divider',
                background: (t) => selected
                  ? alpha(t.palette.primary.main, t.palette.mode === 'dark' ? 0.10 : 0.06)
                  : 'transparent',
                boxShadow: selected
                  ? (t) => `0 0 0 1px ${alpha(t.palette.primary.main, 0.4)} inset, 0 6px 18px ${alpha(t.palette.primary.main, 0.18)}`
                  : 'none',
                transition: 'border-color .18s, background-color .18s, box-shadow .18s',
                '&:hover': { borderColor: 'primary.main' },
                minWidth: 96,
              }}
            >
              <Box sx={{
                width: previewMax, height: previewMax,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                mb: 0.75,
              }}>
                <Box sx={{
                  width: w, height: h,
                  borderRadius: 0.75,
                  bgcolor: (t) => t.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(15,23,42,0.06)',
                  border: 1,
                  borderColor: selected ? 'primary.main' : 'divider',
                  boxShadow: selected
                    ? (t) => `0 0 12px ${alpha(t.palette.primary.main, 0.35)}`
                    : 'none',
                  transition: 'all .18s',
                }} />
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 700, lineHeight: 1.2 }}>{s.label}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                {s.hint}
              </Typography>
            </Box>
          );
        })}
      </Stack>

      {showOrientation && (
        <ToggleButtonGroup
          exclusive
          size="small"
          value={orientation}
          onChange={(_, v) => v && onChange({ ...value, orientation: v })}
          sx={{ mt: 1.5 }}
        >
          <ToggleButton value="portrait">
            <StayCurrentPortraitOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} /> Portrait
          </ToggleButton>
          <ToggleButton value="landscape">
            <StayCurrentLandscapeOutlinedIcon fontSize="small" sx={{ mr: 0.75 }} /> Landscape
          </ToggleButton>
        </ToggleButtonGroup>
      )}
    </Box>
  );
}
