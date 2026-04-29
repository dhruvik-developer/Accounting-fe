/**
 * Common date-range picker with presets (Today, This Week, This Month, etc).
 * Used across Reports, Dashboard, Sales/Purchase registers, GST summary, etc.
 *
 * The `value` is `{from, to}` in ISO YYYY-MM-DD strings — the lingua franca
 * across all list endpoints in this codebase.
 */
import { useMemo } from 'react';
import { Box, MenuItem, Stack, TextField } from '@mui/material';
import dayjs, { Dayjs } from 'dayjs';

export type DateRange = { from: string; to: string };

export type DateRangeFilterProps = {
  value: DateRange;
  onChange: (range: DateRange) => void;
  /** Disable the manual from/to date pickers, leaving only the preset dropdown */
  hideManual?: boolean;
  /** Limit the available presets — by default shows today / week / month / quarter / year */
  presets?: PresetKey[];
  size?: 'small' | 'medium';
};

type PresetKey = 'today' | 'yesterday' | 'week' | 'month' | 'quarter' | 'year' | 'last_year' | 'custom';

const PRESETS: Record<PresetKey, { label: string; range: () => DateRange }> = {
  today:    { label: 'Today',          range: () => ({ from: dayjs().format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }) },
  yesterday:{ label: 'Yesterday',      range: () => ({ from: dayjs().subtract(1, 'day').format('YYYY-MM-DD'), to: dayjs().subtract(1, 'day').format('YYYY-MM-DD') }) },
  week:     { label: 'This Week',      range: () => ({ from: dayjs().startOf('week').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }) },
  month:    { label: 'This Month',     range: () => ({ from: dayjs().startOf('month').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }) },
  quarter:  { label: 'Last 90 Days',   range: () => ({ from: dayjs().subtract(90, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }) },
  year:     { label: 'Last 365 Days',  range: () => ({ from: dayjs().subtract(365, 'day').format('YYYY-MM-DD'), to: dayjs().format('YYYY-MM-DD') }) },
  last_year:{ label: 'Last Year',      range: () => ({ from: dayjs().subtract(1, 'year').startOf('year').format('YYYY-MM-DD'), to: dayjs().subtract(1, 'year').endOf('year').format('YYYY-MM-DD') }) },
  custom:   { label: 'Custom',         range: () => ({ from: '', to: '' }) },
};

const DEFAULT_PRESETS: PresetKey[] = ['today', 'week', 'month', 'quarter', 'year'];

export default function DateRangeFilter({
  value, onChange,
  hideManual = false,
  presets = DEFAULT_PRESETS,
  size = 'small',
}: DateRangeFilterProps) {
  const matchedPreset = useMemo<PresetKey>(() => {
    for (const key of presets) {
      const r = PRESETS[key].range();
      if (r.from === value.from && r.to === value.to) return key;
    }
    return 'custom';
  }, [value, presets]);

  return (
    <Stack direction="row" useFlexGap flexWrap="wrap" rowGap={1} columnGap={1}
      alignItems="center">
      <TextField
        select
        size={size}
        label="Range"
        value={matchedPreset}
        onChange={(e) => {
          const key = e.target.value as PresetKey;
          if (key === 'custom') return; // custom keeps existing range
          onChange(PRESETS[key].range());
        }}
        sx={{ minWidth: 140 }}
      >
        {presets.map((k) => (
          <MenuItem key={k} value={k}>{PRESETS[k].label}</MenuItem>
        ))}
        {/* Hidden item so dropdown can show "Custom" when manual dates differ from any preset */}
        <MenuItem value="custom" sx={{ display: 'none' }}>Custom</MenuItem>
      </TextField>

      {!hideManual && (
        <>
          <TextField
            size={size} type="date" label="From"
            InputLabelProps={{ shrink: true }}
            value={value.from}
            onChange={(e) => onChange({ ...value, from: e.target.value })}
            sx={{ minWidth: 150 }}
          />
          <TextField
            size={size} type="date" label="To"
            InputLabelProps={{ shrink: true }}
            value={value.to}
            onChange={(e) => onChange({ ...value, to: e.target.value })}
            sx={{ minWidth: 150 }}
          />
        </>
      )}
    </Stack>
  );
}

/** Helpers — useful for callers that want to derive an initial range. */
export const todayRange = (): DateRange => PRESETS.today.range();
export const monthRange = (): DateRange => PRESETS.month.range();
export const yearRange = (): DateRange => PRESETS.year.range();

/** Format a `Dayjs` to YYYY-MM-DD safely. */
export const fmtDate = (d: Dayjs) => d.format('YYYY-MM-DD');
