/**
 * Track an element's pixel size.
 *
 * Uses a ResizeObserver, but also measures on mount and on window resize and
 * polls a few times just after mount, so a correct size is available even in
 * environments where ResizeObserver callbacks are suppressed.
 *
 * @module hooks/useElementSize
 */

import { useEffect, useRef, useState } from 'react';

/**
 * @returns {[import('react').RefObject<HTMLElement>, { width: number, height: number }]}
 */
export function useElementSize() {
  const ref = useRef(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return undefined;
    }

    let last = { width: -1, height: -1 };
    const measure = () => {
      const rect = el.getBoundingClientRect();
      const next = { width: Math.round(rect.width), height: Math.round(rect.height) };
      if (next.width !== last.width || next.height !== last.height) {
        last = next;
        setSize(next);
      }
    };

    measure();

    let ro;
    try {
      ro = new ResizeObserver(measure);
      ro.observe(el);
    } catch {
      ro = null;
    }

    window.addEventListener('resize', measure);

    // A few delayed measurements catch the layout settling after first paint.
    const timers = [50, 150, 400, 1000].map((ms) => setTimeout(measure, ms));

    return () => {
      if (ro) {
        ro.disconnect();
      }
      window.removeEventListener('resize', measure);
      timers.forEach(clearTimeout);
    };
  }, []);

  return [ref, size];
}
