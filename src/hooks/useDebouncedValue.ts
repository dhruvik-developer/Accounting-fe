import { useEffect, useState } from 'react';

/**
 * Returns `value` debounced by `delay` ms. Useful for search inputs to
 * avoid firing a request on every keystroke.
 */
export default function useDebouncedValue<T>(value: T, delay = 250): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
