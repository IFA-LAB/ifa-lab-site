import { useEffect, useState } from 'react';

/** Clay palette (light values; 3D scenes keep one look in both themes, like a physical toy). Keys match `figure.clay`. */
export const CLAY: Record<string, string> = {
  blue: '#4f7fc4',
  up: '#e2574c',
  down: '#2e9d6e',
  sun: '#f2b544',
  pink: '#ee9aae',
  grey: '#b8c2cf',
};
export const INK = '#1d2633';
export const DARK = '#2b3443';

/** Skip 3D on data-saver, low-memory devices and browsers without WebGL2; the CSS version stays. */
export function canRun3D() {
  if (typeof window === 'undefined') return false;
  const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
  if (nav.connection?.saveData) return false;
  if (nav.deviceMemory !== undefined && nav.deviceMemory < 4) return false;
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

export function useMedia(query: string) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const m = matchMedia(query);
    setOn(m.matches);
    const f = () => setOn(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [query]);
  return on;
}
export const usePrefersReducedMotion = () => useMedia('(prefers-reduced-motion: reduce)');
