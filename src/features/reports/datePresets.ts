/**
 * Date-range presets for the Reports filter bar.
 *
 * Indian SMB context: financial year runs April → March, so "This FY" /
 * "Last FY" need to be aware of that, not the calendar year. The fy_start_month
 * could come from /preferences/ — for now we hardcode April since 99% of
 * the target users are on the standard Indian FY.
 */
import dayjs, { Dayjs } from 'dayjs';

export type DateRange = { from: string; to: string };

export type DatePreset =
  | 'today' | 'yesterday'
  | 'this_week' | 'last_week'
  | 'this_month' | 'last_month'
  | 'this_quarter' | 'last_quarter'
  | 'this_fy' | 'last_fy'
  | 'last_30' | 'last_90' | 'last_365'
  | 'custom';

const fyStart = (d: Dayjs): Dayjs => {
  // FY runs April–March. If we're in Jan/Feb/Mar, FY started last calendar year.
  return d.month() >= 3
    ? d.month(3).date(1)
    : d.subtract(1, 'year').month(3).date(1);
};

const fmt = (d: Dayjs) => d.format('YYYY-MM-DD');

export function rangeForPreset(preset: DatePreset, base: Dayjs = dayjs()): DateRange {
  const today = base.startOf('day');
  switch (preset) {
    case 'today':
      return { from: fmt(today), to: fmt(today) };
    case 'yesterday': {
      const y = today.subtract(1, 'day');
      return { from: fmt(y), to: fmt(y) };
    }
    case 'this_week':
      return {
        from: fmt(today.startOf('week').add(1, 'day')), // Mon
        to: fmt(today),
      };
    case 'last_week': {
      const lastMon = today.startOf('week').add(1, 'day').subtract(7, 'day');
      return { from: fmt(lastMon), to: fmt(lastMon.add(6, 'day')) };
    }
    case 'this_month':
      return { from: fmt(today.startOf('month')), to: fmt(today) };
    case 'last_month': {
      const lm = today.subtract(1, 'month');
      return {
        from: fmt(lm.startOf('month')),
        to: fmt(lm.endOf('month')),
      };
    }
    case 'this_quarter': {
      const q = Math.floor(today.month() / 3);
      return { from: fmt(today.month(q * 3).date(1)), to: fmt(today) };
    }
    case 'last_quarter': {
      const q = Math.floor(today.month() / 3);
      const startThis = today.month(q * 3).date(1);
      return {
        from: fmt(startThis.subtract(3, 'month')),
        to: fmt(startThis.subtract(1, 'day')),
      };
    }
    case 'this_fy': {
      const start = fyStart(today);
      return { from: fmt(start), to: fmt(today) };
    }
    case 'last_fy': {
      const lastFyStart = fyStart(today).subtract(1, 'year');
      return {
        from: fmt(lastFyStart),
        to: fmt(lastFyStart.add(1, 'year').subtract(1, 'day')),
      };
    }
    case 'last_30':
      return { from: fmt(today.subtract(29, 'day')), to: fmt(today) };
    case 'last_90':
      return { from: fmt(today.subtract(89, 'day')), to: fmt(today) };
    case 'last_365':
      return { from: fmt(today.subtract(364, 'day')), to: fmt(today) };
    case 'custom':
      return { from: fmt(today.startOf('month')), to: fmt(today) };
  }
}

/**
 * Compute the previous-period range matching the same number of days.
 * E.g. if you pass `1 Apr → 30 Apr`, returns `2 Mar → 31 Mar`.
 * Used for the "vs previous period" comparison overlay on charts.
 */
export function previousPeriod(range: DateRange): DateRange {
  const from = dayjs(range.from);
  const to = dayjs(range.to);
  const days = to.diff(from, 'day');
  const prevTo = from.subtract(1, 'day');
  const prevFrom = prevTo.subtract(days, 'day');
  return { from: fmt(prevFrom), to: fmt(prevTo) };
}

export const PRESET_OPTIONS: { value: DatePreset; label: string; group?: string }[] = [
  { value: 'today',         label: 'Today' },
  { value: 'yesterday',     label: 'Yesterday' },
  { value: 'this_week',     label: 'This week' },
  { value: 'last_week',     label: 'Last week' },
  { value: 'this_month',    label: 'This month' },
  { value: 'last_month',    label: 'Last month' },
  { value: 'this_quarter',  label: 'This quarter' },
  { value: 'last_quarter',  label: 'Last quarter' },
  { value: 'this_fy',       label: 'This FY (Apr–Mar)' },
  { value: 'last_fy',       label: 'Last FY' },
  { value: 'last_30',       label: 'Last 30 days' },
  { value: 'last_90',       label: 'Last 90 days' },
  { value: 'last_365',      label: 'Last 365 days' },
  { value: 'custom',        label: 'Custom' },
];
