// primeAt = auto: learning the usual start time from local history.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync, appendFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = mkdtempSync(join(tmpdir(), 'unsnooze-prime-learn-test-'));
process.env.UNSNOOZE_STATE_DIR = join(DIR, 'state');
process.env.UNSNOOZE_CLAUDE_DIR = join(DIR, 'claude');
process.env.UNSNOOZE_CODEX_DIR = join(DIR, 'codex');
for (const k of ['UNSNOOZE_PRIME_AT_CLAUDE', 'UNSNOOZE_PRIME_AT_CODEX', 'UNSNOOZE_PRIME_DAYS', 'UNSNOOZE_RESUME_MESSAGE', 'UNSNOOZE_RESUME_MESSAGE_CLAUDE']) delete process.env[k];

const {
  promptTimestamp, learnStart, collectPrompts, learnSlot, hhmm, MIN_DAYS,
} = await import('../src/prime-learn.js');
const { tickPrime, cmdPrime, normalizePrimeAt } = await import('../src/prime.js');
const { setConfigValue, writeConfig, DEFAULTS } = await import('../src/settings.js');
const { readState, updateState } = await import('../src/state.js');
const { PRIME_DIR } = await import('../src/config.js');

after(() => rmSync(DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));
beforeEach(() => { writeConfig({}); updateState(s => { delete s.prime; }); });

const at = (day, h, m = 0) => new Date(2026, 8, day, h, m).getTime();   // September 2026, local
const NOW = at(30, 0, 30);
const claudeLine = (ts, content, extra = {}) => JSON.stringify({ type: 'user', timestamp: new Date(ts).toISOString(), message: { role: 'user', content }, ...extra });
const codexLine = (ts, text) => JSON.stringify({ timestamp: new Date(ts).toISOString(), type: 'response_item', payload: { type: 'message', role: 'user', content: [{ type: 'input_text', text }] } });

test('promptTimestamp counts human prompts only', () => {
  const t = at(10, 9);
  assert.equal(promptTimestamp('claude', claudeLine(t, 'fix the bug')), t);
  assert.equal(promptTimestamp('claude', claudeLine(t, [{ type: 'text', text: 'hi' }])), t);
  assert.equal(promptTimestamp('claude', claudeLine(t, [{ type: 'tool_result', content: 'x' }])), null, 'tool result');
  assert.equal(promptTimestamp('claude', claudeLine(t, 'sub', { isSidechain: true })), null, 'subagent');
  assert.equal(promptTimestamp('claude', claudeLine(t, 'caveat', { isMeta: true })), null, 'meta');
  const resumePrefix = DEFAULTS.resumeMessage.slice(0, 40);
  assert.equal(promptTimestamp('claude', claudeLine(t, DEFAULTS.resumeMessage), { resumePrefix }), null, 'unsnooze revival');
  assert.equal(promptTimestamp('claude', JSON.stringify({ type: 'assistant', timestamp: new Date(t).toISOString() })), null);
  assert.equal(promptTimestamp('codex', codexLine(t, 'ship it')), t);
  assert.equal(promptTimestamp('codex', codexLine(t, '<environment_context>\n  <cwd>/x</cwd>')), null, 'injected context');
  assert.equal(promptTimestamp('codex', codexLine(t, '# AGENTS.md instructions for /x')), null, 'injected AGENTS.md');
  assert.equal(promptTimestamp('claude', claudeLine(t, 'This session is being continued…', { isCompactSummary: true })), null, 'compaction');
  assert.equal(promptTimestamp('codex', JSON.stringify({ type: 'response_item', timestamp: new Date(t).toISOString(), payload: { type: 'message', role: 'assistant', content: [] } })), null);
});

test('learnStart: median of each day\'s start after sleep', () => {
  const ts = [at(20, 18)];   // history before the first day, so day 21 has a known gap
  for (const [day, h, m] of [[21, 12, 53], [22, 12, 31], [23, 12, 7], [24, 12, 35], [28, 16, 7], [29, 12, 13]]) {
    ts.push(at(day, h, m), at(day, h + 2, m));
  }
  // Working past midnight: 00:10 follows 23:30 by 40 minutes — not a start.
  ts.push(at(24, 23, 30), at(25, 0, 10));
  ts.sort((a, b) => a - b);
  const r = learnStart(ts);
  assert.equal(r.days, 6, 'the after-midnight continuation does not count as a day');
  assert.equal(hhmm(r.minutes), '12:33', 'median of 12:07 12:13 12:31 12:35 12:53 16:07');
});

test('learnStart: a stray prompt after an evening break does not take the day', () => {
  const ts = [at(20, 9)];
  for (const day of [21, 22, 23, 24, 25]) ts.push(at(day, 9), at(day, 18));
  // 00:30 after an 18:00 stop is a 6.5h gap; 09:00 after it is 8.5h — the real start.
  ts.push(at(23, 0, 30));
  ts.sort((a, b) => a - b);
  assert.equal(hhmm(learnStart(ts).minutes), '09:00');
});

test('learnStart: the earliest prompt on record is not a start', () => {
  assert.equal(learnStart([at(21, 4)]).days, 0);
});

test('learnStart: nothing until enough days, weekdays-only when asked', () => {
  const few = [at(20, 12), at(21, 12), at(22, 12), at(23, 12)];
  assert.deepEqual(learnStart(few), { minutes: null, days: 3 });
  const ts = [18, 19, 20, 21, 22, 23, 24, 25].map(d => at(d, d === 19 || d === 20 ? 15 : 10));   // 19/20 = Sat/Sun
  assert.equal(hhmm(learnStart(ts).minutes), '10:00');
  assert.equal(learnStart(ts, { days: 'weekdays' }).days, 5);
});

test('learnSlot marks a slot that falls the evening before', async () => {
  const dir = join(DIR, 'claude', 'projects', '-night');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'n.jsonl'), [at(20, 15), ...[21, 22, 23, 24, 25].map(d => at(d, 1, 30))]
    .map(t => claudeLine(t, 'go')).join('\n') + '\n');
  const night = await learnSlot('claude', { now: NOW, files: [{ path: join(dir, 'n.jsonl'), size: 1, mtimeMs: 1 }] });
  assert.deepEqual(night, { start: '01:30', slot: '22:30', wrap: true, days: 5 });
  rmSync(dir, { recursive: true, force: true });
});

test('hhmm wraps across midnight', () => {
  assert.equal(hhmm(60 - 180), '22:00');
  assert.equal(hhmm(9 * 60 + 10), '09:10');
});

function writeClaudeHistory() {
  const dir = join(DIR, 'claude', 'projects', '-repo');
  mkdirSync(dir, { recursive: true });
  for (const day of [21, 22, 23, 24, 25, 26, 27]) {
    writeFileSync(join(dir, `s${day}.jsonl`), [
      claudeLine(at(day, 12, 10), 'start'),
      claudeLine(at(day, 12, 11), [{ type: 'tool_result', content: '' }]),
      claudeLine(at(day, 4, 0), DEFAULTS.resumeMessage),   // 4am revival — ignored
    ].join('\n') + '\n');
  }
  return dir;
}

test('collectPrompts reads history once, then only changed files', async () => {
  const dir = writeClaudeHistory();
  // A counting stand-in for the streaming scanner.
  let scans = 0;
  const counting = async (agentId, path, resumePrefix) => {
    scans++;
    return readFileSync(path, 'utf-8').split('\n').map(l => promptTimestamp(agentId, l, { resumePrefix })).filter(t => t != null);
  };
  const first = await collectPrompts('claude', { now: NOW, scan: counting });
  assert.equal(scans, 7);
  assert.equal(first.length, 7, 'one human prompt per day; tool results and revivals dropped');
  await collectPrompts('claude', { now: NOW, scan: counting });
  assert.equal(scans, 7, 'unchanged files come from the cache');
  appendFileSync(join(dir, 's27.jsonl'), claudeLine(at(27, 18), 'evening') + '\n');
  const third = await collectPrompts('claude', { now: NOW, scan: counting });
  assert.equal(scans, 8, 'only the appended file is re-read');
  assert.equal(third.length, 8);
  // A new resume message changes what counts as a revival: rescan everything.
  setConfigValue('resumeMessage', 'Keep going.');
  await collectPrompts('claude', { now: NOW, scan: counting });
  assert.equal(scans, 15);
});

test('learnSlot: primes three hours before the usual start; codex skips prime rollouts', async () => {
  writeClaudeHistory();
  assert.deepEqual(await learnSlot('claude', { now: NOW }), { start: '12:10', slot: '09:10', wrap: false, days: 6 });
  const dir = join(DIR, 'codex', 'sessions', '2026', '09', '29');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'rollout-2026-09-29T06-00-00-p.jsonl'),
    JSON.stringify({ type: 'session_meta', payload: { cwd: PRIME_DIR } }) + '\n' + codexLine(at(29, 6), 'Reply with just: ok') + '\n');
  const codex = await learnSlot('codex', { now: NOW });
  assert.deepEqual(codex, { slot: null, start: null, days: 0 }, 'a prime is not the user starting work');
});

test('settings and normalize accept auto', () => {
  assert.equal(normalizePrimeAt('AUTO'), 'auto');
  assert.equal(setConfigValue('primeAt.claude', 'auto'), 'auto');
});

test('tickPrime auto: learns once a day, primes at the learned slot', async () => {
  setConfigValue('primeAt.claude', 'auto');
  setConfigValue('agents.codex', 'off');
  let learns = 0;
  const learn = async () => { learns++; return { start: '12:10', slot: '09:10', days: 6 }; };
  const runs = [];
  const run = async id => { runs.push(id); return { agent: id, at: at(30, 9, 11), outcome: 'started', resetsAtMs: at(30, 14, 11) }; };
  const notifyFn = () => {};
  await tickPrime({ now: at(30, 8, 0), run, learn, notifyFn });
  assert.deepEqual(runs, [], 'before the learned slot');
  await tickPrime({ now: at(30, 9, 11), run, learn, notifyFn });
  await tickPrime({ now: at(30, 9, 12), run, learn, notifyFn });
  assert.deepEqual(runs, ['claude'], 'once');
  assert.equal(learns, 1, 'learned once for the day');
  assert.equal(readState().prime.claude.learned.slot, '09:10');
  assert.equal(readState().prime.claude.outcome, 'started');
});

test('tickPrime auto: still learning means no prime', async () => {
  setConfigValue('primeAt.claude', 'auto');
  setConfigValue('agents.codex', 'off');
  const runs = [];
  await tickPrime({ now: at(30, 9, 0), run: async id => { runs.push(id); }, learn: async () => ({ slot: null, start: null, days: 2 }), notifyFn: () => {} });
  assert.deepEqual(runs, []);
});

test('cmdPrime status explains auto', async () => {
  setConfigValue('primeAt.claude', 'auto');
  const lines = [];
  await cmdPrime([], { print: l => lines.push(l), learn: async () => ({ start: '12:10', slot: '09:10', days: 17 }) });
  assert.match(lines.join('\n'), /auto — you usually start ~12:10 \(17 days\), so it primes at 09:10/);
  const learning = [];
  await cmdPrime([], { print: l => learning.push(l), learn: async () => ({ slot: null, start: null, days: 2 }) });
  assert.match(learning.join('\n'), new RegExp(`still learning when you start \\(2 of ${MIN_DAYS} days\\)`));
});
