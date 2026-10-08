// Shared building blocks for the docs routes. Extracted when the single
// /docs/ page was split so the five pages stay visually identical.

import CopyButton from './CopyButton.jsx';
import { shellCommands } from '../lib/shell-commands.js';

// A terminal block: a mono caption bar and the output — no fake window chrome.
// `examples`: this block's sample values — lines using them are not copied.
export function Shell({ title = 'terminal', examples, children }) {
  const commands = shellCommands(children, { examples });
  return (
    <figure className="shell">
      <figcaption>
        <span>{title}</span>
        {commands && <CopyButton text={commands} label={`Copy ${title} commands`} />}
      </figcaption>
      <pre>{children}</pre>
    </figure>
  );
}

export const C = ({ children }) => <code className="chip">{children}</code>;
