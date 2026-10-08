'use client';

import { useRef, useState } from 'react';

// The docs shells' copy key — the install pill's "copy" → amber "copied" flip,
// small enough for a caption bar.
export default function CopyButton({ text, label = 'Copy commands' }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);

  const copy = () => {
    navigator.clipboard?.writeText(text).catch(() => {});
    setCopied(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1700);
  };

  return (
    <button type="button" className={copied ? 'shell-copy copied' : 'shell-copy'} onClick={copy} aria-label={label}>
      <span className="w" aria-hidden="true">copy</span>
      <span className="w2" aria-hidden="true">copied</span>
      <span className="sr-only" aria-live="polite">{copied ? 'Copied to clipboard' : ''}</span>
    </button>
  );
}
