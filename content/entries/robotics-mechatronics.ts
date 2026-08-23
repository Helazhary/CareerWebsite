import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'robotics-mechatronics',
  kind: 'project',
  title: 'Robotics & Mechatronics',
  // TODO(hussein): dates are ESTIMATED — the resume lists no project dates. Verify before publishing.
  start: '2023-01',
  district: 'workshop',
  skin: 'workshop',
  size: 'lg',
  tags: ['Robotics', 'Computer Vision', '3D Printing', 'Pneumatics'],
  summary: 'Independent builds: robotic arms, a vision-guided tracking turret, and pneumatic automations.',
  bullets: [
    'Multi-DoF and tele-operated robotic arms.',
    'Vision-guided pan-tilt tracking turret.',
    'Laser escape-room puzzle and pneumatic-actuated automations.',
    '3D modelling and printing for custom mechanical parts.',
  ],
  ambient: ['walking-robot', 'robot-arm'],
};

export default entry;
