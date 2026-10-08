// Every command the website's docs copy keys put on the clipboard must run as
// written. This reads each <Shell> block in website/app/docs, takes what its
// copy key would copy (website/lib/shell-commands.js), and checks it against
// the real CLI: known subcommands, settings that `config set` accepts with
// that value, and repo scripts that exist. Placeholders and sample values are
// the copy key's job to leave out — a line with one here is a docs bug.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIR = mkdtempSync(join(tmpdir(), 'unsnooze-docs-commands-'));
process.env.UNSNOOZE_STATE_DIR = DIR;
after(() => rmSync(DIR, { recursive: true, force: true }));

const { shellCommands } = await import('../website/lib/shell-commands.js');
const { setConfigValue } = await import('../src/settings.js');
const { splitArgString } = await import('../src/settings.js');

function pages(dir) {
  return readdirSync(dir).flatMap(name => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? pages(p) : name === 'page.jsx' ? [p] : [];
  });
}

// { file, title, copied } for every Shell block.
function shellBlocks() {
  const out = [];
  const re = /<Shell title="([^"]*)"(?:\s+examples=\{\[([^\]]*)\]\})?>\{`([\s\S]*?)`\}<\/Shell>/g;
  for (const file of pages(join(ROOT, 'website', 'app', 'docs'))) {
    const src = readFileSync(file, 'utf-8');
    for (const m of src.matchAll(re)) {
      const examples = m[2] ? [...m[2].matchAll(/'([^']*)'/g)].map(x => x[1]) : [];
      const copied = shellCommands(m[3], { examples });
      out.push({ file: file.slice(ROOT.length + 1), title: m[1], copied: copied ? copied.split('\n') : [] });
    }
  }
  return out;
}

const SUBCOMMANDS = new Set(
  [...readFileSync(join(ROOT, 'bin', 'unsnooze.js'), 'utf-8').matchAll(/case '([a-z][a-z-]*)':/g)].map(m => m[1]),
);
// Third-party and system tools the docs tell people to run.
const TOOLS = new Set(['npm', 'sudo', 'headroom', 'bash', 'node', 'vhs']);

const blocks = shellBlocks();

test('docs have shell blocks to check', () => {
  assert.ok(blocks.length >= 15, `found ${blocks.length}`);
});

for (const { file, title, copied } of blocks) {
  test(`docs copy key runs as written: ${file} · ${title}`, () => {
    for (const line of copied) {
      for (const part of line.split(/\s*&&\s*/)) {
        const argv = splitArgString(part);
        const [bin, sub, ...rest] = argv;
        if (bin === 'unsnooze') {
          assert.ok(SUBCOMMANDS.has(sub), `${line}: unknown subcommand "${sub}"`);
          if (sub === 'config' && rest[0] === 'set') {
            assert.doesNotThrow(() => setConfigValue(rest[1], rest[2]), `${line}: config set rejects it`);
          }
        } else if (bin.startsWith('./') || bin.startsWith('scripts/')) {
          assert.ok(existsSync(join(ROOT, bin)), `${line}: ${bin} does not exist`);
        } else {
          assert.ok(TOOLS.has(bin), `${line}: unexpected command "${bin}"`);
          for (const arg of [sub, ...rest]) {
            if (/^(scripts|demo)\//.test(arg || '')) assert.ok(existsSync(join(ROOT, arg)), `${line}: ${arg} does not exist`);
          }
        }
      }
    }
  });
}

test('copy keys leave out placeholders and sample values', () => {
  const all = blocks.flatMap(b => b.copied);
  for (const bad of ['<id>', '[--json]', '"..."', 'f3a1', 'gpu-box', '~/code/api', 'hosts add work']) {
    assert.ok(!all.some(l => l.includes(bad)), `copied a line with ${bad}`);
  }
});
