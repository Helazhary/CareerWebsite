import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'embedded-home-automation',
  kind: 'project',
  title: 'Embedded & Home Automation',
  // No date shown: Hussein confirmed the month and year are not known. `start`
  // is kept only to place the plot on its off-ramp and is never rendered.
  start: '2023-06',
  hideDate: true,
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
