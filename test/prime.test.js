// Window priming (prime.js). The claude fixture is the real rate_limit_event
// `claude -p --output-format stream-json --verbose` printed (2.1.294); the
// codex rollout lines follow the token_count shape codex-cli 0.159.2 writes.
import { test, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIR = mkdtempSync(join(tmpdir(), 'unsnooze-prime-test-'));
process.env.UNSNOOZE_STATE_DIR = join(DIR, 'state');
const CODEX = join(DIR, 'codex');
process.env.UNSNOOZE_CODEX_DIR = CODEX;
for (const k of ['UNSNOOZE_PRIME_AT_CLAUDE', 'UNSNOOZE_PRIME_AT_CODEX', 'UNSNOOZE_PRIME_DAYS', 'UNSNOOZE_PRIME']) delete process.env[k];

const {
  normalizePrimeAt, primeDue, primeArgs, parseClaudePrime, parseCodexPrime,
  runPrime, tickPrime, cmdPrime, formatPrimeResult, dayKey, GRACE_MS,
} = await import('../src/prime.js');
const { setConfigValue, writeConfig, getConfig } = await import('../src/settings.js');
const { readState, updateState } = await import('../src/state.js');
const { PRIME_DIR } = await import('../src/config.js');
const { dispatchCandidate } = await import('../src/watcher.js');
const { runHook } = await import('../src/hook.js');

after(() => rmSync(DIR, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 }));

beforeEach(() => {
  writeConfig({});
  updateState(s => { delete s.prime; s.sessions = {}; });
});

const SIX = new Date(2026, 9, 8, 6, 0).getTime();          // Thursday 06:00 local
const HOUR = 3_600_000;

const claudeOut = resetsAtSec => [
  JSON.stringify({ type: 'system', subtype: 'init' }),
  JSON.stringify({ type: 'rate_limit_event', rate_limit_info: {
    status: 'allowed', resetsAt: resetsAtSec, rateLimitType: 'five_hour',
    unifiedWindows: { five_hour: { utilization: 0.29, resetsAt: resetsAtSec }, seven_day: { utilization: 0.12, resetsAt: 1791792000 } },
  } }),
  JSON.stringify({ type: 'result', subtype: 'success', result: 'ok' }),
].join('\n');

function writeRollout(threadId, rateLimits) {
  const dir = join(CODEX, 'sessions', '2026', '10', '08');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `rollout-2026-10-08T06-00-00-${threadId}.jsonl`), [
    JSON.stringify({ type: 'session_meta', payload: { id: threadId, cwd: PRIME_DIR } }),
    JSON.stringify({ timestamp: '2026-10-08T00:30:05.000Z', type: 'event_msg', payload: { type: 'token_count', rate_limits: rateLimits } }),
  ].join('\n') + '\n');
}
const codexOut = threadId => [
  JSON.stringify({ type: 'thread.started', thread_id: threadId }),
  JSON.stringify({ type: 'turn.completed', usage: { input_tokens: 10, output_tokens: 1 } }),
].join('\n');

test('normalizePrimeAt pads, accepts off, rejects garbage', () => {
  assert.equal(normalizePrimeAt('6:00'), '06:00');
  assert.equal(normalizePrimeAt('23:59'), '23:59');
  assert.equal(normalizePrimeAt('off'), '');
  assert.equal(normalizePrimeAt(''), '');
  assert.equal(normalizePrimeAt('24:00'), null);
  assert.equal(normalizePrimeAt('6am'), null);
});

test('config: primeAt is validated and normalized, primeDays is an enum', () => {
  assert.equal(setConfigValue('primeAt.claude', '6:30'), '06:30');
  assert.equal(getConfig('primeAt.claude'), '06:30');
  assert.equal(setConfigValue('primeAt.claude', 'off'), '');
  assert.throws(() => setConfigValue('primeAt.claude', '6am'), /local time like 06:00/);
  assert.throws(() => setConfigValue('primeDays', 'sometimes'), /daily, weekdays/);
  assert.throws(() => setConfigValue('primeAt.qwen', '06:00'), /unknown setting/);
});

test('primeDue: once a day, from the slot until the grace runs out', () => {
  assert.equal(primeDue({ at: '06:00', now: SIX - 60_000 }), false, 'before the slot');
  assert.equal(primeDue({ at: '06:00', now: SIX }), true);
  assert.equal(primeDue({ at: '06:00', now: SIX + GRACE_MS }), true, 'woke late, still within grace');
  assert.equal(primeDue({ at: '06:00', now: SIX + GRACE_MS + 60_000 }), false, 'too late — skip the day');
  assert.equal(primeDue({ at: '06:00', now: SIX + HOUR, lastDay: dayKey(SIX) }), false, 'already primed today');
  assert.equal(primeDue({ at: '', now: SIX }), false, 'off');
  const saturday = new Date(2026, 9, 10, 6, 5).getTime();
  assert.equal(primeDue({ at: '06:00', days: 'weekdays', now: saturday }), false);
  assert.equal(primeDue({ at: '06:00', days: 'daily', now: saturday }), true);
});

test('primeArgs: one-shot, cheap, no session left behind for claude; rollout kept for codex', () => {
  const c = primeArgs('claude', { model: 'haiku' });
  assert.deepEqual(c.slice(0, 1), ['-p']);
  for (const flag of ['--model', 'haiku', '--no-session-persistence', 'stream-json', '--verbose']) assert.ok(c.includes(flag), flag);
  const x = primeArgs('codex', { model: 'gpt-6-luna', cwd: '/p' });
  assert.equal(x[0], 'exec');
  for (const flag of ['--json', '-m', 'gpt-6-luna', '--skip-git-repo-check', 'read-only']) assert.ok(x.includes(flag), flag);
  assert.equal(x[x.indexOf('-C') + 1], '/p');
  assert.ok(!x.includes('--ephemeral'), 'the rollout is the readback');
  assert.ok(!primeArgs('codex', { model: '' }).includes('-m'), 'no model → codex default');
});

test('parseClaudePrime reads the five_hour reset from the rate_limit_event', () => {
  assert.deepEqual(parseClaudePrime(claudeOut(1791450600)), { resetsAtMs: 1791450600_000 });
  const noFive = JSON.stringify({ type: 'rate_limit_event', rate_limit_info: { rateLimitType: 'seven_day', resetsAt: 1, unifiedWindows: { seven_day: { resetsAt: 1 } } } });
  assert.deepEqual(parseClaudePrime(noFive), { noWindow: true });
  assert.equal(parseClaudePrime('not json\n{"type":"result"}'), null);
});

test('parseCodexPrime: 5h window on Plus, none on Pro, null when the rollout is missing', () => {
  writeRollout('aaaa-plus', { limit_id: 'codex', plan_type: 'plus',
    primary: { used_percent: 1, window_minutes: 300, resets_at: 1791450600 },
    secondary: { used_percent: 4, window_minutes: 10080, resets_at: 1791952605 } });
  assert.deepEqual(parseCodexPrime(codexOut('aaaa-plus')), { resetsAtMs: 1791450600_000 });
  writeRollout('bbbb-pro', { limit_id: 'codex', plan_type: 'pro',
    primary: { used_percent: 41, window_minutes: 10080, resets_at: 1791952605 }, secondary: null });
  assert.deepEqual(parseCodexPrime(codexOut('bbbb-pro')), { noWindow: true, planType: 'pro' });
  assert.equal(parseCodexPrime(codexOut('cccc-missing')), null);
  assert.equal(parseCodexPrime('{"type":"turn.started"}'), null);
});

test('runPrime classifies started vs already running, and isolates the run', async () => {
  let call;
  const runner = async (bin, args, opts) => { call = { bin, args, opts }; return { err: null, stdout: claudeOut(Math.round((SIX + 5 * HOUR - 2 * 60_000) / 1000)), stderr: '' }; };
  const r = await runPrime('claude', { runner, now: () => SIX });
  assert.equal(r.outcome, 'started');
  assert.equal(r.model, 'haiku');
  assert.equal(call.opts.cwd, PRIME_DIR);
  assert.equal(call.opts.env.UNSNOOZE_PRIME, '1', 'hook must be able to ignore it');
  const running = await runPrime('claude', { runner: async () => ({ err: null, stdout: claudeOut(Math.round((SIX + HOUR) / 1000)), stderr: '' }), now: () => SIX });
  assert.equal(running.outcome, 'running');
  assert.match(formatPrimeResult(running), /already running/);
});

test('runPrime reports a failure instead of guessing', async () => {
  const err = Object.assign(new Error('exit 1'), { killed: false });
  const r = await runPrime('claude', { runner: async () => ({ err, stdout: '', stderr: 'API Error: 429 rate limit\n' }), now: () => SIX });
  assert.equal(r.outcome, 'failed');
  assert.match(r.detail, /429/);
  const quiet = await runPrime('claude', { runner: async () => ({ err: null, stdout: '{"type":"result"}', stderr: '' }), now: () => SIX });
  assert.match(quiet.detail, /no rate-limit readback/);
});

test('runPrime: codex with no 5-hour window says so', async () => {
  writeRollout('dddd-pro', { limit_id: 'codex', plan_type: 'pro', primary: { used_percent: 41, window_minutes: 10080, resets_at: 1791952605 } });
  const r = await runPrime('codex', { runner: async () => ({ err: null, stdout: codexOut('dddd-pro'), stderr: '' }), now: () => SIX });
  assert.equal(r.outcome, 'no-window');
  assert.match(formatPrimeResult(r), /no 5-hour window on the pro plan/);
});

test('tickPrime: off by default, fires once per day when due, records the result', async () => {
  const runs = [];
  const run = async id => { runs.push(id); return { agent: id, at: SIX, outcome: 'started', resetsAtMs: SIX + 5 * HOUR }; };
  const notes = [];
  const notifyFn = (title, body) => notes.push(body);
  assert.deepEqual(await tickPrime({ now: SIX, run, notifyFn }), []);
  assert.equal(readState().prime, undefined, 'off → no state written');

  setConfigValue('primeAt.claude', '06:00');
  setConfigValue('agents.codex', 'off');
  setConfigValue('primeAt.codex', '06:00');
  await tickPrime({ now: SIX + 60_000, run, notifyFn });
  await tickPrime({ now: SIX + 120_000, run, notifyFn });
  assert.deepEqual(runs, ['claude'], 'once, and never for a disabled agent');
  assert.equal(readState().prime.claude.outcome, 'started');
  assert.equal(readState().prime.claude.day, dayKey(SIX));
  assert.match(notes[0], /window started/);
});

test('the StopFailure hook ignores a prime run', async () => {
  process.env.UNSNOOZE_PRIME = '1';
  try {
    // Without the guard the hook blocks reading stdin — fail, don't hang.
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => resolve('read stdin'), 2000); });
    const result = await Promise.race([runHook([], { ensureDaemonFn: () => {} }), timeout]);
    clearTimeout(timer);
    assert.equal(result, 0, 'must return before reading the payload');
  } finally { delete process.env.UNSNOOZE_PRIME; }
  assert.deepEqual(readState().sessions, {});
});

test('the watcher never records a stop from the prime working dir', () => {
  dispatchCandidate({ agent: 'codex', sessionId: 'prime-1', cwd: PRIME_DIR, resetLine: 'try again in 5h', timestampMs: SIX });
  assert.deepEqual(readState().sessions, {});
});

test('cmdPrime: status shows off, now refuses unsupported agents', async () => {
  const lines = [];
  assert.equal(await cmdPrime([], { print: l => lines.push(l) }), 0);
  assert.match(lines.join('\n'), /claude\s+off/);
  assert.equal(await cmdPrime(['now', 'qwen'], { print: l => lines.push(l) }), 1);
  assert.match(lines.at(-1), /claude and codex only/);
  const out = [];
  const run = async id => ({ agent: id, at: SIX, outcome: 'started', resetsAtMs: SIX + 5 * HOUR });
  assert.equal(await cmdPrime(['now', 'claude'], { run, print: l => out.push(l) }), 0);
  assert.match(out.at(-1), /claude 5-hour window started/);
  assert.equal(readState().prime.claude.outcome, 'started');
});
