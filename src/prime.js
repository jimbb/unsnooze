// Window priming (experimental). Claude's 5-hour window — and Codex's, on
// plans that have one — starts on the first message after a reset, not on a
// clock. One tiny prompt to the cheapest model at a chosen time (primeAt.<id>,
// or `auto` — learned from history, see prime-learn.js) starts it early, so
// the reset lands mid-workday instead of mid-afternoon.
//
// Only claude and codex: Cursor and Grok reset on a fixed billing clock,
// Qwen's 5h quota slides per request (and its terms forbid scheduled
// non-interactive use), and Kimi/Antigravity are unverified.
//
// Every prime checks itself: the reply carries the window's reset time, and a
// reset ~5h after the prime means it started the window. Anything else is
// reported as it is — already running, no 5-hour window on this plan, failed.

import { spawn } from 'node:child_process';
import { readdirSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { PRIME_DIR, CODEX_DIR } from './config.js';
import { getConfig } from './settings.js';
import { getAgent } from './agents/index.js';
import { updateState, readState } from './state.js';
import { extractCodexUsage } from './usage.js';
import { makeLogger } from './logger.js';
import { learnSlot, MIN_DAYS } from './prime-learn.js';

const log = makeLogger('prime');

export const PRIME_AGENTS = ['claude', 'codex'];
const PROMPT = 'Reply with just: ok';
const FIVE_HOURS_MS = 5 * 3_600_000;
// A window started by this prime resets 5h after it, give or take the
// run time and the minute the server rounds to.
const STARTED_SLACK_MS = 10 * 60_000;
// A machine asleep at the scheduled time still primes on wake, within this.
// Later than that the day is skipped — the user is likely working by then.
export const GRACE_MS = 4 * 3_600_000;
const RUN_TIMEOUT_MS = 3 * 60_000;

// "6:00" / "06:00" → "06:00"; "auto"; "" / "off" → ""; anything else → null.
export function normalizePrimeAt(raw) {
  const value = String(raw ?? '').trim();
  if (value === '' || /^off$/i.test(value)) return '';
  if (/^auto$/i.test(value)) return 'auto';
  const m = value.match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  return m ? `${m[1].padStart(2, '0')}:${m[2]}` : null;
}

export function dayKey(ms) {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Is a prime due now? Local time, once per day, within GRACE_MS of the slot.
export function primeDue({ at, days = 'daily', lastDay = null, now = Date.now() }) {
  const hhmm = normalizePrimeAt(at);
  if (!hhmm || hhmm === 'auto') return false;   // auto resolves to a slot first
  const d = new Date(now);
  if (days === 'weekdays' && (d.getDay() === 0 || d.getDay() === 6)) return false;
  const [h, m] = hhmm.split(':').map(Number);
  const slot = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m).getTime();
  return now >= slot && now - slot <= GRACE_MS && lastDay !== dayKey(now);
}

// Codex model slugs vary by account, so the default is the first "luna" or
// "mini" model this install has cached, else codex's own default.
export function codexPrimeModel({ codexDir = CODEX_DIR } = {}) {
  try {
    const cache = JSON.parse(readFileSync(join(codexDir, 'models_cache.json'), 'utf-8'));
    const list = Array.isArray(cache) ? cache : cache.models || [];
    const slug = list.map(m => m?.slug || m?.id).find(s => /luna|mini/i.test(s || ''));
    return slug || '';
  } catch { return ''; }
}

export function primeModel(agentId, opts) {
  const set = getConfig(`primeModel.${agentId}`);
  if (set) return set;
  return agentId === 'claude' ? 'haiku' : codexPrimeModel(opts);
}

export function primeArgs(agentId, { model = '', cwd = PRIME_DIR } = {}) {
  if (agentId === 'claude') {
    // stream-json --verbose is what carries the rate_limit_event readback.
    return ['-p', PROMPT, ...(model ? ['--model', model] : []), '--no-session-persistence',
      '--output-format', 'stream-json', '--verbose'];
  }
  // No --ephemeral: the rollout it suppresses is the readback.
  return ['exec', '--json', ...(model ? ['-m', model] : []), '-c', 'model_reasoning_effort="low"',
    '-s', 'read-only', '--skip-git-repo-check', '-C', cwd, PROMPT];
}

function jsonLines(text) {
  return String(text || '').split('\n').map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
}

// Claude: the rate_limit_event in the stream-json output.
export function parseClaudePrime(stdout) {
  for (const m of jsonLines(stdout)) {
    if (m.type !== 'rate_limit_event') continue;
    const info = m.rate_limit_info || {};
    const five = info.unifiedWindows?.five_hour?.resetsAt
      ?? (info.rateLimitType === 'five_hour' ? info.resetsAt : null);
    return Number.isFinite(five) ? { resetsAtMs: five * 1000 } : { noWindow: true };
  }
  return null;
}

// Newest-first day dirs under sessions/YYYY/MM/DD — a prime's rollout is in
// one of the last couple.
function recentDayDirs(root, limit = 3) {
  const out = [];
  const desc = dir => { try { return readdirSync(dir).filter(n => /^\d+$/.test(n)).sort().reverse(); } catch { return []; } };
  for (const y of desc(root)) for (const mo of desc(join(root, y))) for (const d of desc(join(root, y, mo))) {
    out.push(join(root, y, mo, d));
    if (out.length >= limit) return out;
  }
  return out;
}

// Codex: thread_id from `exec --json`, then the rollout's last token_count.
export function parseCodexPrime(stdout, { codexDir = CODEX_DIR } = {}) {
  const started = jsonLines(stdout).find(m => m.type === 'thread.started');
  if (!started?.thread_id) return null;
  for (const dir of recentDayDirs(join(codexDir, 'sessions'))) {
    let name;
    try { name = readdirSync(dir).find(n => n.endsWith(`${started.thread_id}.jsonl`)); } catch { continue; }
    if (!name) continue;
    const lines = readFileSync(join(dir, name), 'utf-8').split('\n');
    let last = null;
    for (const line of lines) last = extractCodexUsage(line) || last;
    if (!last) return null;
    const five = [last.primary, last.secondary].find(w => w?.windowMinutes === 300);
    return five?.resetsAtMs ? { resetsAtMs: five.resetsAtMs } : { noWindow: true, planType: last.planType };
  }
  return null;
}

// stdin closed: `codex exec` with a piped stdin reads it as extra prompt
// input and exits with no output at all.
function defaultRunner(bin, args, opts) {
  return new Promise(resolve => {
    let stdout = '';
    let stderr = '';
    let child;
    try {
      child = spawn(bin, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (err) { resolve({ err, stdout, stderr }); return; }
    const timer = setTimeout(() => { child.kill(); }, RUN_TIMEOUT_MS);
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { stderr += d; });
    child.on('error', err => { clearTimeout(timer); resolve({ err, stdout, stderr }); });
    child.on('close', (code, signal) => {
      clearTimeout(timer);
      const err = code === 0 ? null : Object.assign(new Error(`exit ${code ?? signal}`), { killed: !!signal });
      resolve({ err, stdout, stderr });
    });
  });
}

// One prime, verified. Never throws.
export async function runPrime(agentId, { runner = defaultRunner, now = () => Date.now(), codexDir = CODEX_DIR } = {}) {
  const at = now();
  const model = primeModel(agentId, { codexDir });
  const base = { agent: agentId, at, model: model || null };
  try {
    mkdirSync(PRIME_DIR, { recursive: true, mode: 0o700 });
    const agent = getAgent(agentId);
    const { err, stdout, stderr } = await runner(agent.bin, primeArgs(agentId, { model, cwd: PRIME_DIR }), {
      cwd: PRIME_DIR,
      // The StopFailure hook ignores runs carrying this, so a prime that hits
      // a limit is never recorded as a session to revive.
      env: { ...process.env, UNSNOOZE_PRIME: '1' },
    });
    const read = agentId === 'claude' ? parseClaudePrime(stdout) : parseCodexPrime(stdout, { codexDir });
    if (!read) {
      const why = err ? (err.killed ? 'timed out' : (stderr.trim().split('\n').pop() || err.message)) : 'no rate-limit readback in the reply';
      return { ...base, outcome: 'failed', detail: why.slice(0, 200) };
    }
    if (read.noWindow) return { ...base, outcome: 'no-window', planType: read.planType || null };
    const started = Math.abs(read.resetsAtMs - (at + FIVE_HOURS_MS)) <= STARTED_SLACK_MS;
    return { ...base, outcome: started ? 'started' : 'running', resetsAtMs: read.resetsAtMs };
  } catch (e) {
    return { ...base, outcome: 'failed', detail: String(e.message).slice(0, 200) };
  }
}

const hm = ms => new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

export function formatPrimeResult(r) {
  switch (r.outcome) {
    case 'started': return `${r.agent} 5-hour window started — resets ${hm(r.resetsAtMs)}`;
    case 'running': return `${r.agent} 5-hour window was already running — resets ${hm(r.resetsAtMs)}`;
    case 'no-window': return `${r.agent} has no 5-hour window${r.planType ? ` on the ${r.planType} plan` : ''} — priming does nothing here (unsnooze config set primeAt.${r.agent} off)`;
    case 'pending': return `${r.agent} prime in progress`;
    default: return `${r.agent} prime failed: ${r.detail || 'unknown error'}`;
  }
}

const PRIME_TITLES = {
  started: 'window primed',
  running: 'window already running',
  'no-window': 'window priming does nothing',
};

function record(result) {
  updateState(state => {
    state.prime = state.prime && typeof state.prime === 'object' ? state.prime : {};
    state.prime[result.agent] = { learned: state.prime[result.agent]?.learned, ...result, day: dayKey(result.at) };
  });
}

// The slot to prime at today: the fixed time, or for auto the learned one —
// re-learned once a day and kept in state, so ticks in between cost nothing.
async function resolveSlot(id, { now, days, last, learn }) {
  const at = normalizePrimeAt(getConfig(`primeAt.${id}`));
  if (at !== 'auto') return at;
  const known = last[id]?.learned;
  if (known?.day === dayKey(now) && known.primeDays === days) return known.slot;
  const learned = { ...(await learn(id, { days, now })), day: dayKey(now), primeDays: days };
  updateState(state => {
    state.prime = state.prime && typeof state.prime === 'object' ? state.prime : {};
    state.prime[id] = { ...(state.prime[id] || { agent: id }), learned };
  });
  log(learned.slot
    ? `${id}: usually starts ~${learned.start} (${learned.days} days) — priming at ${learned.slot}`
    : `${id}: auto priming still learning (${learned.days} of ${MIN_DAYS} days)`);
  return learned.slot;
}

let ticking = false;

// Daemon tick. The day is claimed before the run starts, so the next tick
// (or a second daemon) cannot fire the same prime while this one is out.
export async function tickPrime({ now = Date.now(), run = runPrime, notifyFn = null, learn = learnSlot } = {}) {
  const on = PRIME_AGENTS.filter(id => getConfig(`agents.${id}`) && normalizePrimeAt(getConfig(`primeAt.${id}`)));
  if (!on.length || ticking) return [];   // the common case: priming off, no state read
  ticking = true;
  try { return await tickOn(on, { now, run, notifyFn, learn }); } finally { ticking = false; }
}

async function tickOn(on, { now, run, notifyFn, learn }) {
  const days = getConfig('primeDays');
  const last = readState().prime || {};
  const due = [];
  for (const id of on) {
    const slot = await resolveSlot(id, { now, days, last, learn });
    if (primeDue({ at: slot, days, lastDay: last[id]?.day, now })) due.push(id);
  }
  if (!due.length) return [];
  let claimed = [];
  updateState(state => {
    state.prime = state.prime && typeof state.prime === 'object' ? state.prime : {};
    claimed = due.filter(id => state.prime[id]?.day !== dayKey(now));
    for (const id of claimed) state.prime[id] = { learned: state.prime[id]?.learned, agent: id, at: now, day: dayKey(now), outcome: 'pending' };
  });
  const notify = notifyFn || (await import('./notify.js')).notify;
  const results = [];
  for (const id of claimed) {
    const result = await run(id);
    record(result);
    const line = formatPrimeResult(result);
    log(line);
    try { notify(PRIME_TITLES[result.outcome] || 'window prime failed', line, { priority: 2 }); } catch { /* never break the daemon */ }
    results.push(result);
  }
  return results;
}

// `unsnooze prime` — schedule + last result; `unsnooze prime now [agent…]`.
export async function cmdPrime(rest = [], { run = runPrime, print = console.log, learn = learnSlot } = {}) {
  if (rest[0] === 'now') {
    const ids = rest.slice(1).length ? rest.slice(1) : PRIME_AGENTS.filter(id => getConfig(`agents.${id}`));
    const bad = ids.filter(id => !PRIME_AGENTS.includes(id));
    if (bad.length) {
      print(`unsnooze: priming supports ${PRIME_AGENTS.join(' and ')} only (not ${bad.join(', ')})`);
      return 1;
    }
    let code = 0;
    for (const id of ids) {
      print(`unsnooze: priming ${id}…`);
      const result = await run(id);
      record(result);
      print(`unsnooze: ${formatPrimeResult(result)}`);
      if (result.outcome === 'failed') code = 1;
    }
    return code;
  }
  if (rest[0] && rest[0] !== 'status') {
    print('usage: unsnooze prime [status] | unsnooze prime now [claude|codex]');
    return 1;
  }
  const days = getConfig('primeDays');
  const last = readState().prime || {};
  print('window priming (experimental) — starts the 5-hour window early with one tiny prompt');
  for (const id of PRIME_AGENTS) {
    const at = normalizePrimeAt(getConfig(`primeAt.${id}`));
    let sched = 'off';
    if (at === 'auto') {
      const l = await learn(id, { days });
      sched = l.slot
        ? `auto — you usually start ~${l.start} (${l.days} days), so it primes at ${l.slot} ${days}, model ${primeModel(id) || 'default'}`
        : `auto — still learning when you start (${l.days} of ${MIN_DAYS} days); no primes until then`;
    } else if (at) sched = `${at} ${days}, model ${primeModel(id) || 'default'}`;
    const prev = last[id]?.at ? `  last: ${dayKey(last[id].at)} ${hm(last[id].at)} — ${formatPrimeResult(last[id])}` : '';
    print(`  ${id.padEnd(7)} ${sched}${prev ? `\n  ${prev}` : ''}`);
  }
  if (PRIME_AGENTS.some(id => normalizePrimeAt(getConfig(`primeAt.${id}`)))) {
    const { autostartUnitPath } = await import('./install.js');
    if (process.platform !== 'win32' && !existsSync(autostartUnitPath())) {
      print('\n  ! scheduled primes run from the daemon, which is not installed: unsnooze install --daemon');
    }
  } else {
    print('\n  turn on: unsnooze config set primeAt.claude auto   (or a time like 06:00)');
  }
  return 0;
}
