import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'auc',
  kind: 'education',
  title: 'B.Sc. Computer Science',
  subtitle: 'The American University in Cairo',
  // TODO(hussein): confirm the start date — placeholder inferred from a Feb 2026 graduation.
  start: '2021-09',
  end: '2026-02',
  district: 'highway',
  skin: 'campus',
  size: 'lg',
  tags: ['Computer Science', 'AI', 'Computer Vision', 'Algorithms'],
  summary: 'CS GPA 3.97 / 4.0 · Overall GPA 3.79 / 4.0',
  bullets: [
    'B.Sc. in Computer Science, graduated February 2026.',
    'CS GPA 3.97 / 4.0, overall GPA 3.79 / 4.0.',
    'Coursework: Software Engineering, AI, Computer Vision, Machine Learning (+ Advanced), Algorithms, Networks, Computer Architecture, Operating Systems, Databases.',
    'CS tutor for individuals and groups, in Egypt and online.',
  ],
  ambient: ['notice-board', 'trees'],
};

export default entry;
