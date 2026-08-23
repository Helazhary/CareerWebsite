import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'darwinz-2022',
  kind: 'job',
  title: 'Software Engineer Intern',
  subtitle: 'Darwinz AI',
  start: '2022-06',
  end: '2022-08',
  district: 'highway',
  skin: 'office',
  size: 'sm',
  tags: ['Python', 'OpenAI API', 'Prompt Engineering', 'TTS'],
  summary: 'First internship — an AI-driven restaurant ordering system and a TTS evaluation harness.',
  bullets: [
    'Developed an AI-driven restaurant ordering system in Python with the OpenAI API, using prompt engineering to reduce drift and keep dialogue task-focused.',
    'Built an integrated Jupyter testing environment for AI audiobook partner Ekra2ly, enabling TTS evaluation with ElevenLabs.',
  ],
  ambient: ['lit-windows'],
};

export default entry;
