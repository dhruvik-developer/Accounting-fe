import { useEffect, useMemo, useRef, useState } from 'react';
import { Autocomplete, Box, CircularProgress, TextField, Typography } from '@mui/material';
import { api } from '@/app/api';

export type SuggestResult = {
  id: string;
  label: string;
  subtitle?: string;
  meta?: Record<string, any>;
};

type Entity = 'parties' | 'items' | 'hsn' | string;

type Props = {
  entity: Entity;
  /** extra context for the resolver, e.g. { party_id: '...' } for items */
  context?: Record<string, string | undefined | null>;
  value: SuggestResult | null;
  onChange: (value: SuggestResult | null) => void;
  label?: string;
  placeholder?: string;
  size?: 'small' | 'medium';
  required?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  /** min chars before a remote fetch; 0 = prefetch on focus */
  minChars?: number;
  /** prepopulate the visible row when an id is known but label isn't */
  hydrateId?: string | null;
};

const DEBOUNCE_MS = 180;

export default function Suggest({
  entity,
  context,
  value,
  onChange,
  label,
  placeholder,
  size = 'small',
  required,
  disabled,
  autoFocus,
  minChars = 0,
  hydrateId,
}: Props) {
  const [input, setInput] = useState('');
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [options, setOptions] = useState<SuggestResult[]>([]);
  const timer = useRef<number | null>(null);
  const seq = useRef(0);

  const contextStr = useMemo(() =>
    Object.entries(context || {})
      .filter(([, v]) => v != null && v !== '')
      .map(([k, v]) => `${k}=${v}`)
      .join(','),
  [context]);

  const fetchNow = (q: string) => {
    if (q.length < minChars) { setOptions([]); return; }
    const my = ++seq.current;
    setLoading(true);
    api.get(`/suggest/${entity}/`, { params: { q, limit: 10, context: contextStr || undefined } })
      .then(r => {
        if (my !== seq.current) return; // discard stale
        setOptions(r.data.results || []);
      })
      .catch(() => { if (my === seq.current) setOptions([]); })
      .finally(() => { if (my === seq.current) setLoading(false); });
  };

  // Debounce input-driven fetches
  useEffect(() => {
    if (!open) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => fetchNow(input), DEBOUNCE_MS);
    return () => { if (timer.current) window.clearTimeout(timer.current); };
  }, [input, open, contextStr]); // eslint-disable-line react-hooks/exhaustive-deps

  // Hydrate from an id (e.g. editing an existing invoice — we have party_id but no label)
  useEffect(() => {
    if (!hydrateId || value?.id === hydrateId) return;
    api.get(`/suggest/${entity}/`, { params: { q: '', limit: 20, context: contextStr || undefined } })
      .then(r => {
        const hit = (r.data.results || []).find((x: SuggestResult) => x.id === hydrateId);
        if (hit) onChange(hit);
      })
      .catch(() => {});
  }, [hydrateId]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <Autocomplete
      size={size}
      open={open}
      onOpen={() => { setOpen(true); fetchNow(input); }}
      onClose={() => setOpen(false)}
      disabled={disabled}
      options={options}
      value={value}
      filterOptions={x => x}  // server-side filter
      isOptionEqualToValue={(a, b) => a?.id === b?.id}
      getOptionLabel={o => (o && typeof o === 'object' ? o.label || '' : '')}
      onChange={(_, v) => onChange(v)}
      onInputChange={(_, v, reason) => { if (reason !== 'reset') setInput(v); }}
      loading={loading}
      noOptionsText={input ? 'No matches' : 'Start typing…'}
      renderOption={(props, option) => (
        <Box component="li" {...props} key={option.id} sx={{ alignItems: 'flex-start !important', flexDirection: 'column', py: 0.75 }}>
          <Typography variant="body2">{option.label}</Typography>
          {option.subtitle && (
            <Typography variant="caption" color="text.secondary">{option.subtitle}</Typography>
          )}
        </Box>
      )}
      renderInput={(p) => (
        <TextField
          {...p}
          label={label}
          placeholder={placeholder}
          required={required}
          autoFocus={autoFocus}
          InputProps={{
            ...p.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress size={14} sx={{ mr: 1 }} /> : null}
                {p.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}
