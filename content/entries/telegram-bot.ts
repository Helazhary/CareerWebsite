import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'telegram-bot',
  kind: 'project',
  title: 'Modular Telegram Automation Bot',
  // TODO(hussein): dates are ESTIMATED — the resume lists no project dates. Verify before publishing.
  start: '2025-01',
  district: 'agents',
  skin: 'server-room',
  size: 'md',
  tags: ['Python', 'Self-hosted', 'Local LLMs', 'Image Generation'],
  summary: 'A self-hosted, fully modular Telegram bot running entirely on a home server and NAS.',
  bullets: [
    'Self-hosted, modular Telegram bot delivering a daily technology-news digest.',
    'Pluggable feature modules including local image generation and local LLM chat with persistent memory.',
    'Runs entirely on a home server and NAS — no cloud dependency, full customisation.',
  ],
  links: {
    // TODO(hussein): add the GitHub URL once the repo is pushed.
  },
  ambient: ['terminal-screen'],
};

export default entry;
