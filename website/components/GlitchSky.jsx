'use client';

import { useEffect, useState } from 'react';
import LetterGlitch from './rb/LetterGlitch.jsx';

// The 404's backdrop: a dim amber terminal glitch (React Bits' LetterGlitch)
// behind "This page is still asleep." Client-only and skipped under reduced
// motion; the veil keeps the headline and links readable over it.
export default function GlitchSky() {
  const [on, setOn] = useState(false);
  useEffect(() => {
    setOn(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  }, []);
  if (!on) return null;
  return (
    <div className="glitch-sky" aria-hidden="true">
      <LetterGlitch
        glitchColors={['#1b2040', '#4a3416', '#f2a93b']} glitchSpeed={90}
        outerVignette={false} centerVignette={false} smooth backgroundColor="#0a0c18"
      />
      <div className="glitch-sky__veil" />
    </div>
  );
}
