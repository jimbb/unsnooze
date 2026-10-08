import Stars from '../../../components/Stars.jsx';
import SiteNav from '../../../components/SiteNav.jsx';
import SubFooter from '../../../components/SubFooter.jsx';
import DocsNav, { DocsPager } from '../../../components/DocsNav.jsx';
import { Shell, C } from '../../../components/DocsKit.jsx';
import { JsonLd, breadcrumbs } from '../../../lib/jsonld.js';

export const metadata = {
  title: "Command reference — status, usage, preview",
  description:
    "Every unsnooze command with real output: status, usage forecast with burn rate and time-to-limit, preview as a true dry-run, doctor, message, resume-now, cancel, and the queued-prompt verbs.",
  alternates: { canonical: '/docs/commands/' },
  openGraph: {
    title: "unsnooze command reference",
    description: "Every command with real output, the usage forecast, and queued prompts.",
    url: '/docs/commands/',
  },
};

export default function CommandsDocsPage() {
  return (
    <div className="subpage">
      <Stars dim />
      <JsonLd data={breadcrumbs([['unsnooze', '/'], ['Docs', '/docs/'], ['Commands', '/docs/commands/']])} />
      <SiteNav page="docs" />
      <main className="wrap subpage-main" id="main">
        <header className="sub-hero">
          <p className="eyebrow">documentation</p>
          <h1 className="sub-title">Command reference</h1>
          <p className="section-lede">
            Every command, the usage forecast that tells you when the wall arrives, and the
            prompt queue that starts the next piece of work as a fresh session.
          </p>
        </header>

        <div className="docs-layout">
          <DocsNav current="/docs/commands/" />

          <div className="docs-content">

            <section className="doc-sec" id="commands">
              <h2>Command reference</h2>
              <p>Agent help/version commands, such as <C>claude --help</C> and{' '}
                <C>codex --version</C>, go straight to the agent without opening a multiplexer
                session, starting a pane monitor, adding <C>launchExtraArgs</C>, or showing an
                unsnooze update notice. <C>unsnooze help</C> shows the commands below.</p>
              <Shell title="unsnooze help">{`unsnooze — wakes every limit-stopped AI coding session when the limit resets

Usage:
  unsnooze [claude args...]        run claude under limit-watch (default)
  unsnooze _run <agent> [args...]  run a specific agent CLI under limit-watch
  unsnooze status                  list tracked sessions + reset countdowns
  unsnooze resume-now [id|--all]   resume stopped session(s) immediately
  unsnooze cancel [id|--all]       stop tracking session(s)
  unsnooze message <id|--all> <t>  set a per-session wake message (--clear to reset)
  unsnooze sessions                list unsnooze-owned mux sessions + panes
  unsnooze reap [--dry-run|--yes]  close terminal-record panes / empty sessions
                                   (default: dry-run; pass --yes to apply)
  unsnooze doctor [--fix]          check install health; find (and with --fix
                                   retire) leftovers of the old
                                   claude-session-guard install
  unsnooze preview [id]            dry-run: what WOULD happen right now, and
                                   why — nothing is typed or opened (exit 2
                                   when a wake is actionable, else 0)
  unsnooze dashboard [tab]         live TUI (status|usage|sessions|doctor|logs|fleet|prompts) — q to quit,
                                   mouse: click/wheel (m toggles)
  unsnooze hosts [add|rm|list]     register ssh hosts for the fleet view
                                   add <name> <dest> [--auth key|password]
                                     [--source prompt|env|keychain|command]
                                     [--env VAR] [--service s --account a]
                                     [--cmd '<command>']
  unsnooze hosts test <name>       pre-flight a host: resolves its credential
                                   and probes reachability (secret never shown)
  unsnooze fleet [--json]          all hosts' sessions (hosts add <name> first)
  unsnooze prompt add [text...]    queue a prompt to start a NEW session in a
                                   project when the limit resets ([--agent id]
                                   [--project path] [--at time|--now])
  unsnooze prompt list [--json]    list queued prompts
  unsnooze prompt remove <id>      cancel a queued prompt
  unsnooze prompt clear            cancel all pending queued prompts
  unsnooze usage [--json]          account burn rate & time-to-limit forecast
                                   (--install-statusline for exact Claude %,
                                    --uninstall-statusline to remove it)
  unsnooze prime [now [agent]]     window priming (experimental): start the 5-hour
                                   window early — set a time with primeAt.claude
  unsnooze design [setup]          Claude Design from the terminal: check whether
                                   the claude-design MCP server is registered and
                                   signed in, or register it with setup
  unsnooze logs [-f]               show (or follow) the unsnooze log
  unsnooze update                  update unsnooze itself to the latest version
  unsnooze daemon                  persistent watcher for GUI sessions (VS Code
                                   extension, desktop apps) — no live pane needed
                                   to detect; revival opens in your multiplexer,
                                   or headless where there is none
  unsnooze config [list|get|set]   view or change settings (toggles, global +
                                   per-agent resume messages, notifyChannel
                                   auto|native|osc|bell, updateCheck)
  unsnooze setup                   interactive setup wizard (agents + toggles)
  unsnooze install [--yes]         wire up shell wrappers + hooks (non-interactive)
                                   (--fishrc <path> overrides the fish config)
  unsnooze uninstall [--purge]     remove wrappers + hooks (and state with --purge)
                                   (--fishrc <path> overrides the fish config)
  unsnooze report [agent] [pane]   capture a pane to report an undetected banner
  unsnooze help                    show this help (also -h / --help)`}</Shell>

              <h3>Scripting status</h3>
              <p><C>unsnooze status --json</C> prints the ledger as JSON: per session the agent,
                working directory, <C>status</C>, <C>limitType</C>, <C>resetAt</C> and its source,
                the pane, <C>attempts</C>, and two fields worth watching.{' '}
                <C>lastError</C> carries a failed revival's own words — a headless revival that
                exits non-zero is retried with backoff rather than counted as resumed.{' '}
                <C>limitReason</C> is the provider's stated reason, when it gives one (Codex's{' '}
                <C>rate_limit_reached_type</C>, such as depleted workspace credits) — the reason
                a stop is probed and held instead of scheduled.</p>

              <h3>Install health</h3>
              <p><C>unsnooze doctor</C> reports problems, not a checklist: wrappers and hook,
                the daemon and whether it can reach your multiplexer, state files only you can
                read, and the binary each agent resolves to. <C>doctor --fix</C> repairs what it
                safely can.</p>

              <h3>Claude Design</h3>
              <p><C>unsnooze design</C> checks whether the <C>claude-design</C> MCP server is
                registered and signed in; <C>unsnooze design setup</C> registers it, so Claude
                Design runs watched inside Claude Code.</p>
            </section>

            <section className="doc-sec" id="usage">
              <h2>Usage forecast</h2>
              <p>Recovery is half the job; <C>unsnooze usage</C> is the other half — knowing when
                the wall is coming so you can <C>/compact</C>, pause, or switch models first.</p>
              <Shell title="unsnooze usage">{`$ unsnooze usage
unsnooze usage — account burn & time-to-limit  (daemon: running · warnings at 80,95%)

  claude  5h      [█████████████░░░░░░░]  ~64%  (calibrated from 4 stops)
          burn    ~31k weighted tok/min over last 42 active min
          wall    ~1h 10m at this pace · window resets 8:00 pm (absolute)

  codex   5h      [███░░░░░░░░░░░░░░░░░]  5% used  (exact)
          30d     [██░░░░░░░░░░░░░░░░░░]  5% used  (exact) · resets Aug 11
          burn    idle — no active burn`}</Shell>
              <p>Every figure carries its provenance — never a bare percentage:</p>
              <ul>
                <li><strong><C>(exact)</C></strong> — Codex when a recent local rollout contains{' '}
                  <C>token_count.rate_limits</C> (<C>used_percent</C> + epoch reset). Claude only
                  with the opt-in statusline shim, which persists Claude Code's
                  server-authoritative rate limits.</li>
                <li><strong><C>(calibrated from N stops)</C></strong> — Claude 5-hour token burn
                  against a ceiling learned from <em>your</em> matching usable calibration samples:
                  stops classified as <C>5h</C>, with a nonzero local token sample from the same
                  model pool when known, otherwise an unpooled fallback sample. A stop can still
                  be valid for revival without calibrating the ceiling.</li>
                <li><strong><C>(estimated — percentage unavailable)</C></strong>{' '}
                  — used tokens + burn are shown when available, but there is no exact percentage
                  (and a Claude 5-hour row has no matching usable calibration ceiling yet).</li>
              </ul>
              <Shell title="statusline shim (opt-in)">{`$ unsnooze usage --install-statusline    # exact Claude % (chains your statusLine)
$ unsnooze usage --uninstall-statusline  # restore your original statusLine`}</Shell>
              <p>With the daemon running, warnings fire at the <C>usageWarnAt</C> percent bands and
                at 30 / 10 minutes to the wall at your current pace, deduped once per window.
                Warnings may <em>suggest</em> <C>/compact</C>; unsnooze never auto-types it.{' '}
                <C>usage --json</C> emits a stable machine shape and exits 2 past the warn
                threshold — useful in scripts and statuslines.</p>
              <p><strong>Honest limits:</strong> Claude transcript sums are a lower bound —
                subscription quotas are account-pooled with claude.ai and the desktop app. Without
                the shim, Claude tops out at calibrated/estimated.</p>
            </section>

            <section className="doc-sec" id="prime">
              <h2>Window priming <small>(experimental)</small></h2>
              <p>Claude's 5-hour window starts with the first message after a reset, not on a
                clock. Start work at 9am and it resets at 2pm. Have unsnooze send one tiny prompt
                to the cheapest model at 6am and the window resets at 11am instead — a fresh one
                lands mid-morning.</p>
              <Shell title="window priming">{`$ unsnooze config set primeAt.claude auto     # learn when you start; or a time like 06:00
$ unsnooze config set primeDays weekdays      # optional (default: daily)
$ unsnooze prime                              # schedule + last result
  claude  auto — you usually start ~12:10 (17 days), so it primes at 09:10 daily, model haiku
$ unsnooze prime now claude                   # prime right away
unsnooze: claude 5-hour window started — resets 2:10 pm`}</Shell>
              <p><C>auto</C> learns when you usually start from your own local history: the
                median of each day's first prompt after 5 hours of quiet, over the last 3 weeks,
                and primes 3 hours before it — so the reset lands about 2 hours into your
                session. Only your own prompts count; tool results, subagents, unsnooze's resume
                messages and primes don't, so a 4am revival never teaches it you start at 4am.
                It needs 5 qualifying days before it primes, and re-learns daily. Usage on
                claude.ai or the desktop app isn't in local history; if that already started
                the window, the prime reports it as running.</p>
              <p>Scheduled primes run from the daemon (<C>unsnooze install --daemon</C>). A machine
                asleep at the scheduled time primes on wake, up to 4 hours late; after that the
                day is skipped. Each prime checks itself — the reply carries the window's reset
                time — and reports <em>started</em>, <em>already running</em>, <em>no 5-hour
                window on this plan</em>, or the failure.</p>
              <p><strong>Which agents:</strong> Claude (Haiku, about a third of a cent) and Codex
                (the cheapest cached model, e.g. <C>gpt-6-luna</C>). Codex Pro currently has no
                5-hour window, so priming does nothing there and says so. Other agents are left
                out on purpose: Cursor and Grok reset on a fixed billing clock, Qwen's quota
                slides per request and its terms forbid scheduled non-interactive use.</p>
            </section>

            <section className="doc-sec" id="prompts">
              <h2>Queued prompts</h2>
              <p>Queue a prompt now; unsnooze types it into a <strong>brand-new</strong> agent
                session — a fresh window in a project directory — once a usage limit clears (or
                at a time you choose). It's one-shot: each entry is delivered at most once.</p>
              <Shell title="prompt queue" examples={['~/code/api']}>{`$ unsnooze prompt add "run the full test suite and fix any failures"
# → interactive agent picker on a TTY; queued for next-reset in the cwd

$ unsnooze prompt add --agent codex --project ~/code/api --now "ship the release"
$ unsnooze prompt add --at "+2h30m" "rebase onto main"   # relative duration
$ unsnooze prompt add --at "9pm" "nightly cleanup pass"  # next occurrence of a clock time
$ unsnooze prompt add --at <epoch|ISO-8601> "<prompt>"  # epoch (seconds or ms), or an ISO-8601 timestamp

$ unsnooze prompt list            # id, agent, due, status, cwd, prompt preview
$ unsnooze prompt list --json     # the same, for scripts
$ unsnooze prompt remove <id>     # cancel one pending/launching entry
$ unsnooze prompt clear           # cancel every pending/launching entry`}</Shell>
              <h3>Modes</h3>
              <ul>
                <li><strong>next-reset</strong> (default) — delivered once no future reset time
                  is known for that agent, i.e. once the current limit clears. If unsnooze holds{' '}
                  <strong>no reset signal at all</strong> for that agent when you add the entry,
                  there's nothing to wait on — it delivers on the very next daemon tick, and{' '}
                  <C>prompt add</C> prints a notice to that effect right away. Use <C>--at</C> if
                  you want a specific time instead.</li>
                <li><strong><C>--now</C></strong> — deliver on the next daemon tick, no reset
                  wait at all.</li>
                <li><strong><C>--at &lt;time&gt;</C></strong> — deliver at a specific time: epoch
                  (seconds or milliseconds), an ISO-8601 timestamp, a <C>+2h30m</C>-style relative
                  duration, or a bare clock time (<C>9pm</C>, <C>2:05pm</C>, <C>14:30</C>) rolled
                  to its next local occurrence.</li>
              </ul>
              <p>If a delivery attempt lands on a pane that's still limited — the reset hadn't
                actually cleared, or a fresh <C>--now</C>/<C>--at</C> session hits the wall
                immediately — the entry goes back to pending behind a backoff floor before it's
                retried. That floor applies to every mode, so a failing <C>--now</C>/<C>--at</C>{' '}
                entry can't burn through every retry in the first few seconds. Verified delivery
                (capped at 5 attempts, same as resume) marks it <C>failed</C> and sends a
                notification.</p>
              <p><C>autoResume</C> does <strong>not</strong> gate prompt delivery — the queue runs
                independently of session tracking, even with <C>autoResume off</C>.</p>
              <h3>Fleet</h3>
              <p><C>--host &lt;name&gt;</C> queues on a registered host instead of locally.{' '}
                <C>--project</C> (an absolute remote path) and <C>--agent</C> are both
                required — there's no local cwd to default to and no interactive picker over an
                ssh round-trip. The remote host re-validates everything server-side. Delivery
                feedback comes from <C>unsnooze fleet</C> / the dashboard's Fleet tab (per-host
                queued count) and that host's own notifications (ntfy reaches your phone from any
                host, not just the one you're sitting at). A host can refuse all queue traffic
                with <C>remoteQueue: false</C> (<C>unsnooze config set remoteQueue off</C>, env{' '}
                <C>UNSNOOZE_REMOTE_QUEUE=0</C>, <strong>set on the host being controlled</strong>)
                — the queue verbs then answer a typed "disabled" instead of silently dropping; a
                remote that predates this feature reports a clear "too old" error instead of
                failing silently.</p>
              <Shell title="fleet prompt queue" examples={['gpu-box']}>{`$ unsnooze prompt add --host gpu-box --project /home/me/repo --agent claude --now "run the test suite"
$ unsnooze prompt list --host gpu-box`}</Shell>
              <h3>Dashboard</h3>
              <p>The <strong>Prompts</strong> tab (<C>7</C>) lists queued entries; <C>a</C> opens
                an add form (path → agent → when — with a time prompt if you pick "at" — → a host
                step if you have hosts registered → prompt text), <C>d</C>/<C>x</C> removes the
                selected entry. The Status tab shows a{' '}
                <C>&lt;n&gt; prompt(s) queued — tab 7</C> hint whenever entries are pending or
                launching.</p>
            </section>

          </div>
        </div>

        <DocsPager current="/docs/commands/" />
      </main>
      <SubFooter />
    </div>
  );
}
