import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'chess-digitization',
  kind: 'project',
  title: 'Real-Life Chess Digitization',
  start: '2025',
  district: 'lab',
  skin: 'lab',
  size: 'md',
  tags: ['PyTorch', 'Ultralytics', 'OpenCV', 'Raspberry Pi', 'Edge Deployment'],
  summary: 'Digitising physical chess games in real time with custom board and piece detection.',
  bullets: [
    'Built an end-to-end system with a 6-member team to digitise physical chess gameplay.',
    'Custom ML/CV models for board and piece detection, plus domain logic for real-time game tracking.',
    'Quantisation and pruning cut inference time by 40%+ for edge deployment on Raspberry Pi hardware.',
  ],
  ambient: ['loss-curve-screen'],
};

export default entry;
