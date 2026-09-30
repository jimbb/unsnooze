import Stars from '../../../components/Stars.jsx';
import SiteNav from '../../../components/SiteNav.jsx';
import SubFooter from '../../../components/SubFooter.jsx';
import DocsNav, { DocsPager } from '../../../components/DocsNav.jsx';
import { Shell, C } from '../../../components/DocsKit.jsx';
import { JsonLd, breadcrumbs } from '../../../lib/jsonld.js';

export const metadata = {
  title: "Supported agents — Claude Code, Codex, Grok, Qwen, Kimi, OpenCode, Antigravity, Cursor",
  description:
    "How unsnooze detects and resumes a usage-limit stop in each coding agent: Claude Code, OpenAI Codex CLI, Grok, Qwen Code, Kimi, OpenCode, Antigravity and Cursor — plus OpenRouter, proxy launchers like Headroom, and Claude Design.",
  alternates: { canonical: '/docs/agents/' },
  openGraph: {
    title: "unsnooze supported agents",
    description: "How each coding agent's usage limit is detected and resumed.",
    url: '/docs/agents/',
  },
};

export default function AgentsDocsPage() {
  return (
    <div className="subpage">
      <Stars dim />
      <JsonLd data={breadcrumbs([['unsnooze', '/'], ['Docs', '/docs/'], ['Agents', '/docs/agents/']])} />
      <SiteNav page="docs" />
      <main className="wrap subpage-main" id="main">
        <header className="sub-hero">
          <p className="eyebrow">documentation</p>
          <h1 className="sub-title">Supported agents</h1>
          <p className="section-lede">
            How each agent's limit stop is detected, where the reset time comes from, and how a
            session whose process is gone gets revived. Claude Code and Codex are on by default;
            the rest are experimental and enabled in <code className="chip">unsnooze setup</code>.
          </p>
        </header>

        <div className="docs-layout">
          <DocsNav current="/docs/agents/" />

          <div className="docs-content">

            <section className="doc-sec" id="agents">
              <h2>Agents</h2>

              <h3>Claude Code</h3>
              <p>Two channels: the <C>StopFailure</C> hook (authoritative, carries the session id)
                plus pane scraping for banners and the interactive limit menu, which is always
                answered with <em>"Stop and wait for limit to reset"</em> — never a blind Enter.
                Dead sessions revive via <C>claude --resume &lt;id&gt;</C>.</p>

              <h3>OpenAI Codex CLI</h3>
              <p>Scrape-based, since Codex fires no event on limits, plus the rollout files under{' '}
                <C>~/.codex/sessions/</C>. unsnooze matches the exact{' '}
                <C>■ You've hit your usage limit …</C> banner strings from the Codex source and
                parses <C>try again at 3:51 PM</C>, <C>Feb 23rd, 2026 9:01 PM</C> and{' '}
                <C>in 4 days 20 hours 9 minutes</C>. Dead sessions revive via{' '}
                <C>codex resume &lt;id&gt; "&lt;message&gt;"</C> — the prompt travels in argv.</p>

              <h3>Grok Build (xAI) <em>— experimental</em></h3>
              <p>The hook channel works (Grok reads Claude-compatible hooks, including{' '}
                <C>StopFailure</C>). Its limit banner is not publicly documented, so pane detection
                uses generic patterns with a safe fallback.</p>

              <h3>Qwen Code <em>— experimental</em></h3>
              <p>A Claude-shaped <C>StopFailure</C> hook installed into{' '}
                <C>~/.qwen/settings.json</C> (fires with <C>error: rate_limit</C>) plus scraping for
                the quota renders: <C>Qwen OAuth quota exceeded</C>, Coding Plan{' '}
                <C>Allocated quota exceeded</C>, and OpenRouter <C>Rate limit exceeded: limit_…</C>{' '}
                passthroughs. Qwen never shows a reset time, so waits use the 5-hour fallback and
                self-correct on verify. Dead sessions revive via <C>qwen --resume &lt;id&gt;</C>,
                with ids from the <C>*.runtime.json</C> sidecars qwen writes for exactly this.</p>

              <h3>Kimi CLI (Moonshot) <em>— experimental</em></h3>
              <p>Kimi retries a 429 three times within seconds, then stops with a red{' '}
                <C>LLM provider error: Error code: 429 … rate_limit_reached_error</C> line — that is
                the detection anchor. The 429 carries no reset time (5-hour fallback plus verify).
                Dead sessions revive via <C>kimi -r &lt;id&gt; -p "&lt;message&gt;"</C>; because kimi
                silently starts a <em>new</em> session for an unknown id, the id is checked on disk
                first, with <C>--continue</C> otherwise. <C>Membership expired</C> (402) only
                notifies.</p>

              <h3>OpenCode <em>— experimental</em></h3>
              <p>OpenCode retries rate limits itself, forever, honoring <C>retry-after</C> — it
                will sleep hours, showing <C>Rate Limited [retrying in 2h5m attempt #4]</C>. So
                unsnooze records the stop but never touches a live self-retrying pane; its job is
                reviving sessions whose process died mid-wait (laptop slept, tmux gone) via{' '}
                <C>opencode -s &lt;ses_id&gt;</C>, with the reset parsed from the countdown. Zen plan
                banners (<C>5 hour/weekly/monthly usage limit reached…</C>) and OpenRouter
                passthroughs are detected too; <C>insufficient credits</C> (402) only notifies.</p>

              <h3>Antigravity CLI (Google, <C>agy</C>) <em>— experimental</em></h3>
              <p>The Gemini CLI successor. Scrapes the quota strings (<C>Model quota limit
                exceeded</C>, <C>Refreshes in 6 days and 18 hours</C> — a multi-day refresh is the
                weekly cap) and treats <C>503 MODEL_CAPACITY_EXHAUSTED</C> as a transient overload,
                not a limit. Dead sessions revive via <C>agy --conversation=&lt;id&gt;</C>, with ids
                from <C>~/.gemini/antigravity-cli/history.jsonl</C>.</p>

              <h3>Cursor CLI (<C>cursor-agent</C>) <em>— experimental</em></h3>
              <p>The only agent whose limit is <strong>not waitable</strong>: Cursor's included
                usage resets on your monthly billing cycle, not a rolling window. So unsnooze never
                schedules a wake for it. The stop is a <strong>model limit</strong> that probes
                every 15/30/60 minutes and resumes the moment the banner clears — you switch to
                Auto, enable on-demand, or the cycle rolls. Transport errors take the
                transient-overload path and <C>Authentication required</C> only notifies. Dead
                sessions revive via <C>cursor-agent --resume=&lt;id&gt;</C>, with ids from{' '}
                <C>~/.cursor/chats/&lt;md5 of cwd&gt;/&lt;chatId&gt;/meta.json</C> (each checked
                against its recorded <C>cwd</C>), and <C>--continue</C> otherwise.</p>
              <p>The wrapper shadows <C>cursor-agent</C> only. The bare <C>cursor</C> command is
                the IDE launcher and is never touched; the newer <C>agent</C> alias is too generic
                a name to shadow safely.</p>

              <p><strong>Missed a banner?</strong> The experimental adapters, Grok and Antigravity
                especially, are closed source. Run <C>unsnooze report [agent]</C> and paste the
                capture into an <a href="https://github.com/saaranshM/unsnooze/issues">issue</a> —
                that is how they get better.</p>
            </section>

            <section className="doc-sec" id="gateways">
              <h2>OpenRouter and proxy launchers</h2>
              <p><strong>OpenRouter</strong> is not a separate agent. Its 429 bodies
                (<C>Rate limit exceeded: limit_rpd/…</C>, free-models-per-day) are detected inside
                the CLIs that use it (OpenCode, Qwen Code). Credit exhaustion (402) is a
                notification — there is no reset to wait for, only a top-up.</p>
              <p><strong>Headroom and other proxy launchers.</strong>{' '}
                <C>headroom wrap claude</C> and <C>headroom wrap codex</C> launch the real
                executable directly, bypassing unsnooze's shell wrapper, so no same-pane monitor is
                attached. The Claude hook can still record stops, as can the session-file watcher
                while the daemon, <C>guiWatch</C> and that agent are enabled. For full pane
                monitoring, use Headroom's provider-scope routing and start <C>claude</C> /{' '}
                <C>codex</C> normally, so unsnooze stays the outer launcher. With Headroom v0.34:</p>
              <Shell title="headroom">{`$ headroom install apply --scope provider --providers manual --target claude --target codex`}</Shell>
            </section>

            <section className="doc-sec" id="design">
              <h2>Claude Design</h2>
              <p>Claude Design shares your 5-hour and weekly limits with chat, Cowork and Claude
                Code, so a long design run stops the same way and unsnooze resumes it the same way.
                Of its three surfaces — the <C>claude.ai/design</C> canvas, the Claude Desktop
                sidebar, and an official MCP server driven by Claude Code — unsnooze supports the
                MCP server:</p>
              <Shell title="claude design">{`$ unsnooze design setup     # registers the claude-design MCP server
# then, inside Claude Code:
/design-login
$ unsnooze design           # confirms it is registered and signed in

# give long design runs room to compact rather than stall
$ unsnooze config set launchExtraArgs.claude "--autocompact 400000"`}</Shell>
              <p><strong>unsnooze does not automate the web canvas, and will not.</strong>{' '}
                Anthropic's Consumer Terms bar accessing Claude "through automated or non-human
                means", and accounts have been terminated for it. Claude Code is the documented
                exemption, and that is what unsnooze drives.</p>
              <ul>
                <li>A signed-out <C>/design-login</C> is <strong>not</strong> a usage limit.
                  Waiting never clears it, so unsnooze reports it separately.</li>
                <li>Design no longer has its own weekly allowance — everything draws from one
                  shared pool, which is why <C>unsnooze usage</C> already counts design work.</li>
              </ul>
            </section>

          </div>
        </div>

        <DocsPager current="/docs/agents/" />
      </main>
      <SubFooter />
    </div>
  );
}
