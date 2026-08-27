import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'intellinote2',
  kind: 'project',
  title: 'IntelliNote2',
  start: '2026',
  district: 'agents',
  skin: 'server-room',
  status: 'in-progress',
  size: 'md',
  // TODO(hussein): confirm the stack and expand these bullets.
  tags: ['Markdown', 'LLM', 'Editor'],
  summary: 'Intelligent note-taking with AI embedded directly in the markdown editor.',
  bullets: [
    'Note-taking software with auto-suggestions surfaced as you write.',
    'Smart organisation and automatic formatting of notes.',
    'AI embedded directly inside the markdown editor rather than bolted on beside it.',
  ],
  ambient: ['terminal-screen'],
};

export default entry;
