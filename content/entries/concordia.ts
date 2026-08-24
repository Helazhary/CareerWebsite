import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'concordia',
  kind: 'education',
  title: 'Exchange Semester',
  subtitle: 'Concordia University, Montreal',
  // TODO(hussein): confirm these dates before publishing — currently a placeholder.
  start: '2024-09',
  end: '2024-12',
  district: 'highway',
  // A semester in Montreal, told as a detour off the main road (DESIGN.md §2.3).
  detour: true,
  skin: 'campus',
  size: 'sm',
  tags: ['Exchange', 'Montreal'],
  summary: 'A semester abroad at Concordia University in Montreal, Canada.',
  bullets: [
    'Exchange semester at Concordia University, Montreal, Canada, as part of the AUC Computer Science degree.',
  ],
  ambient: ['snow', 'trees'],
};

export default entry;
