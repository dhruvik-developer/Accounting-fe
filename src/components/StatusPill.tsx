import { Chip, ChipProps } from '@mui/material';

/**
 * Fixed status → MUI-color map. Used everywhere we show a document/invoice/bill
 * status, so colors never drift screen to screen.
 */
const MAP: Record<string, ChipProps['color']> = {
  draft: 'info',
  pending: 'info',
  issued: 'primary',
  open: 'primary',
  partial: 'warning',
  due: 'warning',
  paid: 'success',
  completed: 'success',
  received: 'success',
  overdue: 'error',
  cancelled: 'default',
  void: 'default',
  active: 'success',
  inactive: 'default',
};

const LABEL_OVERRIDE: Record<string, string> = {
  partial: 'Partially paid',
};

type Props = {
  status?: string | null;
  size?: ChipProps['size'];
  variant?: ChipProps['variant'];
  /** Override the label shown on the chip. */
  label?: string;
};

export default function StatusPill({ status, size = 'small', variant = 'filled', label }: Props) {
  const key = (status || 'draft').toLowerCase();
  const color = MAP[key] ?? 'default';
  const text = label ?? LABEL_OVERRIDE[key] ?? (status || 'Draft');
  return (
    <Chip
      size={size}
      variant={variant}
      color={color}
      label={text.charAt(0).toUpperCase() + text.slice(1)}
    />
  );
}
