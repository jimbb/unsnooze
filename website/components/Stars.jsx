// Deterministic star field — same sky on every visit, and identical on the
// server and client (fixed-precision strings, so styles hydrate cleanly).
// Each star gets its own phase AND period so the twinkle never syncs; about
// one in seven is a "bright" star that glints. Three sizes read as depth.
const STARS = Array.from({ length: 120 }, (_, i) => {
  const r = (n) => {
    const x = Math.sin(i * 127.1 + n * 311.7) * 43758.5453;
    return x - Math.floor(x);
  };
  const big = r(3) > 0.78;
  return {
    top: `${(r(1) * 100).toFixed(2)}%`,
    left: `${(r(2) * 99).toFixed(2)}%`,
    size: big ? '2.2px' : '1.4px',
    delay: `${(r(4) * 6).toFixed(2)}s`,
    dur: `${(3.5 + r(5) * 3.5).toFixed(2)}s`,
    bright: r(6) > 0.86,
  };
});

// `dim` is the quieter sky behind the subpages' reading surfaces. The spans are
// the server-rendered sky; StarsGL swaps in the WebGL one after hydration
// where it can, and they stay the sky everywhere it can't.
import StarsGL from './StarsGL.jsx';

export default function Stars({ dim = false }) {
  return (
    <div className={dim ? 'stars stars--dim' : 'stars'} id="stars" aria-hidden="true">
      <StarsGL dim={dim} />
      {STARS.map((s, i) => (
        <span
          key={i}
          className={s.bright ? 'bright' : undefined}
          style={{
            top: s.top, left: s.left,
            width: s.size, height: s.size,
            animationDelay: s.delay,
            animationDuration: s.dur,
          }}
        />
      ))}
    </div>
  );
}
