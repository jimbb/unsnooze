'use client';

import { useEffect } from 'react';

// Hover spotlight for anything marked `.spot` — React Bits' SpotlightCard
// mechanism (https://reactbits.dev), one delegated listener for the page
// instead of a handler per row. CSS draws the glow from --mx / --my.
export default function Spotlight() {
  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    const onMove = (e) => {
      const el = e.target.closest?.('.spot');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);
  return null;
}
