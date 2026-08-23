import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'brightskies',
  kind: 'job',
  title: 'AI/ML Engineer Intern',
  subtitle: 'Brightskies',
  start: '2025-07',
  end: '2025-08',
  district: 'highway',
  skin: 'office',
  size: 'md',
  tags: ['BERT', 'ASR', 'Gemini API', 'Raspberry Pi', 'Edge AI'],
  summary: 'Built a modular AI-assistant prototype for smart glasses, on-device where it counted.',
  bullets: [
    'Developed a modular AI-assistant software prototype for smart glasses with ASR, a fine-tuned BERT model for intent classification, and a multimodal LLM (Gemini API) for contextual responses.',
    'Enabled offline functionality via tool calling and fallback handling, reducing API dependency by 20%.',
    'Integrated camera and microphone inputs for real-time interaction with wake-word detection and hands-free control.',
    'Designed a scalable architecture for sensor and hardware-module integration, including a smart-glasses prototype with a GUI for testing.',
  ],
  ambient: ['lit-windows'],
};

export default entry;
