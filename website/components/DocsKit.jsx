// Shared building blocks for the docs routes. Extracted when the single
// /docs/ page was split so the five pages stay visually identical.

import CopyButton from './CopyButton.jsx';

// What a shell's copy key copies: the `$ ` lines as commands — prompt and
// trailing `# comment` dropped — never the output around them. A block with
// no `$ ` line is output only and gets no key.
export function shellCommands(text) {
  if (typeof text !== 'string') return '';
  return text.split('\n')
    .filter(line => line.startsWith('$ '))
    .map(line => line.slice(2).replace(/\s+#\s.*$/, '').trimEnd())
    .join('\n');
}

// A terminal block: a mono caption bar and the output — no fake window chrome.
export function Shell({ title = 'terminal', children }) {
  const commands = shellCommands(children);
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
