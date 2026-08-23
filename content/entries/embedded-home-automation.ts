import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'embedded-home-automation',
  kind: 'project',
  title: 'Embedded & Home Automation',
  // TODO(hussein): dates are ESTIMATED — the resume lists no project dates. Verify before publishing.
  start: '2023-06',
  district: 'workshop',
  skin: 'workshop',
  size: 'md',
  tags: ['ESP32', 'Arduino', 'Face Recognition', 'Microcontrollers'],
  summary: 'Custom microcontroller builds: a face-recognition door lock and ESP32 home control.',
  bullets: [
    'Facial-recognition smart door lock.',
    'ESP32 / Arduino control of AC and lighting.',
    'Microcontroller development across multiple custom builds.',
  ],
  ambient: ['door-lock'],
};

export default entry;
