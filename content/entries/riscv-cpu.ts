import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'riscv-cpu',
  kind: 'project',
  title: 'Pipelined RISC-V CPU',
  start: '2024',
  district: 'workshop',
  skin: 'workshop',
  size: 'md',
  tags: ['Verilog', 'Vivado', 'Computer Architecture'],
  summary: 'A pipelined RISC-V CPU supporting 40+ instructions, with full hazard handling.',
  bullets: [
    'Designed and implemented a pipelined RISC-V CPU supporting 40+ instructions.',
    'Comprehensive hazard detection and handling across the pipeline.',
    'Built and simulated in Verilog using Vivado.',
  ],
  ambient: ['oscilloscope'],
};

export default entry;
