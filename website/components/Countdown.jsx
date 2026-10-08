'use client';

import { useEffect, useState } from 'react';
import SplitFlapText from './rb/SplitFlapText.jsx';

const pad = (n) => String(n).padStart(2, '0');

// Live countdown to the next 03:00 local — the reset the whole page is
// waiting for — on a split-flap board: each second flips only the digits
// that changed. Renders a placeholder on the server (the time is the
// visitor's, not the build machine's) and starts ticking after hydration.
// The flaps are decoration; assistive tech reads the label.
export default function Countdown() {
  const [s, setS] = useState(null);
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      const t = new Date(now); t.setHours(3, 0, 0, 0);
      if (t <= now) t.setDate(t.getDate() + 1);
      setS(Math.floor((t - now) / 1000));
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  if (s === null) return <span className="strip__v warm">--:--:--</span>;
  const text = `${pad(Math.floor(s / 3600))}:${pad(Math.floor(s / 60) % 60)}:${pad(s % 60)}`;
  return (
    <span className="strip__v warm flap-clock" role="timer" aria-label={`${text} until 03:00`}>
      <SplitFlapText
        text={text} loop={false} padTo={8} charset="numeric"
        flipsPerChar={3} flipDuration={0.07} stagger={0.03}
        fontSize="1em" tileColor="#171b30" textColor="currentColor" tileRadius={4} gap={3}
        aria-hidden="true"
      />
    </span>
  );
}
