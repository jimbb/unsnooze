// What a docs shell's copy key copies: the `$ ` lines that run as written —
// prompt and trailing `# comment` dropped, output lines left out. Lines that
// cannot run unchanged are shown but never copied:
//  · syntax placeholders: <id>, [--json], "..." / …
//  · the block's own sample values (`examples`: a session id like f3a1, a
//    host like gpu-box), which would run but act on something that is not
//    the reader's — or register a fake host in their fleet.
// test/docs-commands.test.js runs every copied line against the CLI's real
// commands and settings.
const PLACEHOLDER = /<[A-Za-z][^>]*>|\[[^\]]*\]|"(\.\.\.|…)"|(^|\s)(\.\.\.|…)(\s|$)/;

const escape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function shellCommands(text, { examples = [] } = {}) {
  if (typeof text !== 'string') return '';
  // Whole words only: `work` is the sample host in `hosts rm work`, not the
  // `work` inside an address like you@work-box.local.
  const sample = examples.map(ex => new RegExp(`(^|\\s)${escape(ex)}(\\s|$)`));
  return text.split('\n')
    .filter(line => line.startsWith('$ '))
    .map(line => line.slice(2).replace(/\s+#\s.*$/, '').trimEnd())
    .filter(cmd => !PLACEHOLDER.test(cmd) && !sample.some(re => re.test(cmd)))
    .join('\n');
}
