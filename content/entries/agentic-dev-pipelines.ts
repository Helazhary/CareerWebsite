import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'agentic-dev-pipelines',
  kind: 'project',
  title: 'Agentic Development Pipelines & AI Tooling',
  start: '2023',
  end: '2026',
  district: 'agents',
  skin: 'server-room',
  status: 'in-progress',
  size: 'lg',
  tags: ['Python', 'MCP', 'Local LLMs', 'SDLC Automation'],
  summary: 'Personal agentic pipelines that accelerate my own planning, development, review, and testing.',
  bullets: [
    'Personal agentic pipelines and reusable AI tooling that speed up my own software workflow across planning, development, code review, and testing.',
    'Orchestrates local and cloud LLMs through SDLC and Kanban-style stages.',
    'Custom and third-party MCP servers wire agents into Jira, design tools, and local services.',
  ],
  ambient: ['terminal-screen', 'cable-tray'],
};

export default entry;
