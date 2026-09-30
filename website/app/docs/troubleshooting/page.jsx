import Stars from '../../../components/Stars.jsx';
import SiteNav from '../../../components/SiteNav.jsx';
import SubFooter from '../../../components/SubFooter.jsx';
import DocsNav, { DocsPager } from '../../../components/DocsNav.jsx';
import { Shell, C } from '../../../components/DocsKit.jsx';
import { JsonLd, breadcrumbs } from '../../../lib/jsonld.js';

export const metadata = {
  title: "Troubleshooting — when a session did not resume",
  description:
    "Fix an unsnooze session that did not wake: what unsnooze doctor reports, why a limit banner may be missed, the security model and threat boundaries, and how to run the test suite and end-to-end simulation locally.",
  alternates: { canonical: '/docs/troubleshooting/' },
  openGraph: {
    title: "unsnooze troubleshooting and security",
    description: "When a wake did not happen, what doctor tells you, and the threat model.",
    url: '/docs/troubleshooting/',
  },
};

export default function TroubleshootingDocsPage() {
  return (
    <div className="subpage">
      <Stars dim />
      <JsonLd data={breadcrumbs([['unsnooze', '/'], ['Docs', '/docs/'], ['Troubleshooting', '/docs/troubleshooting/']])} />
      <SiteNav page="docs" />
      <main className="wrap subpage-main" id="main">
        <header className="sub-hero">
          <p className="eyebrow">documentation</p>
          <h1 className="sub-title">Troubleshooting and security</h1>
          <p className="section-lede">
            When a wake did not happen, start with <code className="chip">unsnooze doctor</code>.
            The security model and the local dev loop follow.
          </p>
        </header>

        <div className="docs-layout">
          <DocsNav current="/docs/troubleshooting/" />

          <div className="docs-content">

            <section className="doc-sec" id="troubleshooting">
              <h2>Troubleshooting</h2>
              <ul>
                <li><strong>Something looks off?</strong> <C>unsnooze doctor</C> checks the whole
                  install; <C>--fix</C> repairs what it can (including retiring leftovers of the
                  old claude-session-guard install).</li>
                <li><strong>What has it been doing?</strong> <C>unsnooze logs -f</C> follows the
                  log live; the dashboard's logs tab scrolls back with the mouse wheel.</li>
                <li><strong>A wake didn't happen?</strong> <C>unsnooze preview &lt;id&gt;</C> tells
                  you exactly what's holding it back. After every real wake the pane is
                  re-captured; if the limit banner reappears, unsnooze reschedules from the fresh
                  banner, capped at five attempts.</li>
                <li><strong>A banner wasn't detected?</strong> <C>unsnooze report [agent]</C>{' '}
                  captures the pane so you can paste it into an issue — that's how the experimental
                  adapters get good.</li>
                <li><strong>Panes piling up?</strong> <C>unsnooze reap</C> lists finished panes and
                  empty sessions (dry-run); <C>--yes</C> closes them.</li>
                <li><strong>Leaving?</strong> <C>unsnooze uninstall</C> removes wrappers and hooks;{' '}
                  <C>--purge</C> removes state too.</li>
              </ul>

              <h3>Start with the symptom</h3>
              <p>Almost every report falls into one of these. The distinction that matters most
                is whether the session was <em>recorded</em> at all — that separates a detection
                problem from a wake problem, and they have different fixes.</p>
              <ul>
                <li><strong>Typing <C>claude</C> starts nothing watched.</strong> The shell
                  wrapper lives in <C>~/.zshrc</C> or <C>~/.bashrc</C> (<C>~/.config/fish/config.fish</C>{' '}
                  for fish, PowerShell's <C>$PROFILE</C> on Windows), so it only applies to
                  shells started after <C>unsnooze setup</C> ran. Open a new terminal, then
                  confirm with <C>unsnooze doctor</C>. Nothing is protected until the wrapper is
                  loaded, because the wrapper is the entry point — you never invoke unsnooze
                  directly.</li>
                <li><strong>Cursor sessions are not watched, even with the agent enabled.</strong>{' '}
                  unsnooze wraps <C>cursor-agent</C> — not <C>cursor</C>, which is the IDE
                  launcher (<C>cursor .</C>) and must keep working, and not the newer{' '}
                  <C>agent</C> alias, which is far too generic a name to shadow safely. Launch
                  with <C>cursor-agent</C> and the session is tracked; on some machines{' '}
                  <C>agent</C> resolves to another vendor's CLI entirely.</li>
                <li><strong>Cursor hit its limit and unsnooze scheduled no wake.</strong>{' '}
                  Deliberate. Cursor's usage resets on your monthly <em>billing cycle</em>, not
                  a rolling window, so a scheduled wake would sleep for weeks and then type
                  into a wall that never moved. The stop is recorded as a{' '}
                  <strong>model limit</strong>: you are notified that it needs a decision, and
                  unsnooze probes at 15/30/60 minutes and resumes the moment the banner clears
                  — when you change plan, or the cycle rolls.</li>
                <li><strong>Using <C>headroom wrap claude</C> or <C>headroom wrap codex</C>.</strong>{' '}
                  Headroom resolves and launches the real executable directly, bypassing shell
                  functions, so Unsnooze cannot attach its same-pane monitor. The Claude hook can
                  still record stops; the daemon file watcher can too while <C>guiWatch</C> and
                  that agent are enabled. For full pane monitoring with Headroom v0.34, first run{' '}
                  <C>headroom install apply --scope provider --providers manual --target claude --target codex</C>,
                  then invoke normal <C>claude</C> / <C>codex</C>, leaving Unsnooze as the outer
                  launcher.</li>
                <li><strong>The limit hit but nothing was recorded.</strong> A detection
                  problem. Either the <C>StopFailure</C> hook is not installed (<C>doctor</C>{' '}
                  reports it) or the banner wording was not recognised. Capture it with{' '}
                  <C>unsnooze report</C> — an unmatched banner is a one-release fix, but only if
                  someone sends the text.</li>
                <li><strong>Codex stopped at 99% with no tracked session.</strong>{' '}
                  Update to v1.19.0 or later and check that the daemon, <C>guiWatch</C>, and
                  the Codex agent are enabled. The watcher now recognizes a recent 99%
                  five-hour snapshot followed by an empty <C>premium</C> bucket with no credits
                  in the same rollout, then schedules the session using the previous reset
                  time. A 99% reading alone is not a stop signal.</li>
                <li><strong>Codex behind a proxy never stopped.</strong> Through an
                  OpenAI-compatible proxy the rate-limit headers never reach Codex, so its
                  snapshots are empty. From v1.19.1 unsnooze also reads the limit error Codex
                  writes when the turn fails (codex-cli 0.145 or later) and dates the stop from
                  its banner.</li>
                <li><strong>A headless revival died.</strong> Without a multiplexer (native
                  Windows, a bare server) a revival that exits non-zero is retried, and{' '}
                  <C>unsnooze status</C> shows its own last words as the <C>last error</C> —{' '}
                  <C>spawn codex ENOENT</C> means the daemon cannot find the agent.{' '}
                  <C>unsnooze doctor</C> prints the binary each agent resolves to. On Windows
                  the daemon keeps the <C>PATH</C> it started with: set{' '}
                  <C>UNSNOOZE_CODEX_BIN</C> (or <C>UNSNOOZE_CLAUDE_BIN</C>, …) to the agent's{' '}
                  <C>.exe</C>, or restart the daemon with <C>unsnooze install --daemon</C> after
                  an agent update.</li>
                <li><strong>It was recorded but never woke.</strong> A wake problem, and{' '}
                  <C>unsnooze preview &lt;id&gt;</C> names the reason rather than guessing. The
                  usual answers are a guard deliberately holding it — see{' '}
                  <a href="/docs/settings/#guards">guards</a> — or the five-attempt cap having
                  been reached.</li>
                <li><strong>It woke, but at the wrong time.</strong> Read the provenance in{' '}
                  <C>unsnooze status</C>: a reset shown as <C>(absolute, from hook)</C> came from
                  the agent itself, while <C>(absolute, from scrape)</C> was read off the pane.
                  A reset that looks hours out is a parsing bug worth reporting with the banner
                  text attached — reset times are always absolute, never a relative countdown.</li>
                <li><strong>It resumed while still rate-limited.</strong> Expected and handled:
                  the pane is re-captured after every wake, and if the banner is still there
                  unsnooze reschedules from the fresh one. Overload is not a limit, so a
                  transient overload message is not treated as one.</li>
                <li><strong>You upgraded, and the fix did not take.</strong> A monitor is started
                  once, when the agent launches, and it watches that pane for as long as the
                  agent lives — days, in a long tmux session. Upgrading replaces the package on
                  disk but cannot reach into a process that already loaded the old code. From
                  the version after 1.14.2 both the monitor and the resumer notice the package
                  changed underneath them and hand off to a replacement on their own, so an
                  upgrade propagates within seconds. A session that was <em>launched</em> under
                  1.14.2 or earlier predates that machinery and needs one restart: exit the
                  agent in that pane and start it again. <C>unsnooze logs</C> shows which
                  version each watcher is running from the moment it hands off.</li>
                <li><strong>The machine was asleep at reset time.</strong> Wakes are dispatched
                  by the daemon — a launchd agent on macOS, a systemd user unit on Linux, an on-demand process on
                  Windows. If you
                  declined it during setup, nothing runs while the terminal is closed;{' '}
                  <C>doctor</C> reports whether it is running and under which pid.</li>
              </ul>
            </section>

            <section className="doc-sec" id="faq">
              <h2>Common questions</h2>

              <h3>What does "You've hit your usage limit" mean?</h3>
              <p>Claude and ChatGPT plans meter usage in a rolling 5-hour window plus a weekly cap.
                When either runs out, the agent stops mid-task and shows a banner with the reset
                time. Nothing is lost: the session can be resumed once the limit resets
                (<C>claude --resume &lt;id&gt;</C>, <C>codex resume &lt;id&gt;</C>). unsnooze does
                that automatically, for every stopped session — typing into the live pane when it
                is still open, reopening it when it is not.</p>

              <h3>Does this get around the rate limit?</h3>
              <p>No. unsnooze waits for the reset exactly like you would, resumes once, and checks
                the limit actually lifted. It replaces the 4am alarm, not the limit.</p>

              <h3>Does it work if my laptop was asleep or the terminal was closed?</h3>
              <p>Yes. Reset times are stored as absolute timestamps and checked every 30 seconds
                instead of one long timer, so a laptop that slept through the reset resumes on the
                next check, and weekly limits are just a later timestamp. Dead panes are reopened
                by session id. State writes go through a lock and an atomic rename, so several
                sessions stopping at once cannot corrupt the ledger; a corrupt file is set aside,
                never fatal.</p>

              <h3>Why did resuming a big session use so much quota?</h3>
              <p>Prompt-cache expiry. After hours stopped, the provider's cache is gone, so the
                first message — unsnooze's or a hand-typed "continue", same cost — re-reads the
                whole conversation at full price. <C>/compact</C> before the limit helps, and{' '}
                <a href="/docs/settings/#guards"><C>contextGuard</C></a> tells you (or holds the
                session) when a wake will be expensive.</p>

              <h3>How do I update?</h3>
              <p><C>unsnooze update</C> (or <C>npm i -g unsnooze</C>). unsnooze checks npm at most
                once a day and tells you when a newer version exists; after updating, the next
                command shows what's new. Turn the check off with{' '}
                <C>unsnooze config set updateCheck off</C>.</p>
            </section>

            <section className="doc-sec" id="security">
              <h2>Security model</h2>
              <p>unsnooze is a <strong>scheduler that presses your keys — not an
                auto-approver</strong>. The short version of the contract:</p>
              <ul>
                <li>Keys are typed only after proving the pane is yours — identity (ownership stamp
                  or process-id + birth-time lease; pane ids get recycled, so a mismatch vetoes)
                  and liveness (your agent foreground, not mid-stream). Unprovable → a fresh
                  session is opened instead of typing.</li>
                <li>Claude's limit menu is read before any key is sent; unreadable → nothing is
                  pressed. It will never select "Upgrade your plan."</li>
                <li>No <C>--dangerously-skip-permissions</C>, no auto-approve, no touching MCP
                  config — unsnooze adds no permission flags of its own (flags you set in{' '}
                  <C>resumeExtraArgs</C> are yours); your agent's own permission model governs
                  everything after the wake. Headless Codex revivals pass{' '}
                  <C>--skip-git-repo-check</C>, since <C>codex exec</C> refuses non-git folders the
                  session already ran in.</li>
                <li>Nearly zero network: one daily version check, plus ntfy only if you configure
                  it. Zero telemetry; state stays owner-only (0700/0600) in <C>~/.unsnooze</C>.</li>
                <li>Releases are published to npm by CI with provenance.</li>
              </ul>
              <p><strong>Honest limits:</strong> unsnooze does inject keystrokes into your live
                terminal, and it does not sandbox your agent or defend against prompt injection —
                that's your agent's job. Full threat model and vulnerability reporting:{' '}
                <a href="https://github.com/saaranshM/unsnooze/blob/main/SECURITY.md">SECURITY.md</a>.</p>
            </section>

            <section className="doc-sec" id="development">
              <h2>Development</h2>
              <Shell title="dev loop">{`$ npm test                      # unit tests (node:test)
$ ./scripts/e2e-simulate.sh     # full detect → wait → re-open cycle in a
                                # scratch tmux session (no real limits needed)
$ bash -n scripts/e2e-zellij.sh # syntax-check the Zellij smoke test
$ node scripts/e2e-herdr.mjs    # drive the herdr backend against a real herdr (not in CI)
$ vhs demo/demo.tape            # regenerate the demo gif (brew install vhs)`}</Shell>
              <p>Releases are tagged (<C>git tag v&lt;version&gt;</C>, then{' '}
                <C>git push origin v&lt;version&gt;</C>) and published to npm by CI with provenance
                via trusted publishing — see <C>.github/workflows/release.yml</C>. Contributions:
                open an <a href="https://github.com/saaranshM/unsnooze/issues">issue</a> first for
                anything behavioral; adapter banner captures (<C>unsnooze report</C>) are always
                welcome.</p>
            </section>

          </div>
        </div>

        <DocsPager current="/docs/troubleshooting/" />
      </main>
      <SubFooter />
    </div>
  );
}
