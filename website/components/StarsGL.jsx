'use client';

import { useEffect, useState } from 'react';
import Galaxy from './rb/Galaxy.jsx';

// The WebGL star field (React Bits' Galaxy) over the CSS one in #stars. Only
// with WebGL and without reduced motion; otherwise the CSS stars stay. Once it
// is up, `.stars--gl` hides the spans — Celestial keeps driving #stars'
// opacity and drift, so the night→dawn arc is unchanged.
function webgl() {
  try { return !!document.createElement('canvas').getContext('webgl'); } catch { return false; }
}

export default function StarsGL({ dim = false }) {
  const [on, setOn] = useState(false);

  useEffect(() => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !webgl()) return;
    setOn(true);
    const host = document.getElementById('stars');
    host?.classList.add('stars--gl');
    return () => host?.classList.remove('stars--gl');
  }, []);

  if (!on) return null;
  return (
    <Galaxy
      className="stars__gl"
      transparent saturation={0} hueShift={220}
      density={dim ? 0.7 : 1} glowIntensity={dim ? 0.12 : 0.18}
      twinkleIntensity={0.45} rotationSpeed={0.02} starSpeed={0.15} speed={0.5}
      mouseRepulsion repulsionStrength={1.2}
    />
  );
}
