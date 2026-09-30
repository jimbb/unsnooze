import { ogCard, OG_SIZE, OG_CONTENT_TYPE } from '../../../lib/og-card.jsx';

export const alt = 'unsnooze supported agents';
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function Image() {
  return ogCard({
    headline: 'Every agent, its own wall.',
    sub: 'How Claude Code, Codex, Grok, Qwen, Kimi, OpenCode, Antigravity and Cursor limit stops are detected and resumed.',
  });
}
