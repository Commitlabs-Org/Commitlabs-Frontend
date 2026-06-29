import { useState, useEffect } from 'react';

/**
 * Debounces a value, returning the latest value only after the
 * specified delay has elapsed without the value changing.
 *
 * @param value  The value to debounce.
 * @param delay  Delay in milliseconds (default 300 ms).
 */
export function useDebounce<T>(value: T, delay = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      window.clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}
