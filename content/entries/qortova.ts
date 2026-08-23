import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'qortova',
  kind: 'job',
  title: 'Software Engineer',
  subtitle: 'Qortova',
  start: '2026-03',
  end: 'present',
  district: 'highway',
  skin: 'office',
  size: 'lg',
  featured: true,
  tags: ['C#', '.NET MAUI', 'ASP.NET Core', 'LLM', 'gRPC', 'Unity'],
  summary: 'R&D co-lead turning emerging AI capabilities into shipped production features.',
  bullets: [
    'Co-lead a small R&D team researching and prototyping emerging AI and software capabilities, carrying selected prototypes through to production features.',
    'Delivered 21 features end-to-end across the rider and driver iOS/Android apps and backend of a ride-hailing platform — card payments, OTP auth with JWT refresh-token rotation, Arabic/English RTL localisation, and accessibility across 35+ screens.',
    'Built low-latency real-time AI voice agents (LLM, ASR/TTS) with a modular persona and skill layer that adapts one pipeline to any vertical; extended the stack into an interactive AI chess coach with engine-grounded feedback.',
    'Built an LLM-powered pipeline extracting structured data from unstructured messaging sources, with async processing and Pydantic schema enforcement.',
    'Developed a 3D VR safety training environment in Unity for factory and physical-labour drills.',
  ],
  ambient: ['lit-windows', 'parked-cars'],
};

export default entry;
