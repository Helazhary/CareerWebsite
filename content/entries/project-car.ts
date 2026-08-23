import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'project-car',
  kind: 'project',
  title: 'Project Car with AI Integration',
  subtitle: 'BMW E36',
  // TODO(hussein): dates are ESTIMATED — the resume lists no project dates. Verify before publishing.
  start: '2024-01',
  district: 'garage',
  skin: 'garage',
  size: 'lg',
  featured: true,
  tags: ['Python', 'Google Cloud Run', 'Gemini API', 'ElevenLabs', 'Android'],
  summary: 'A full mechanical E36 rebuild, with an AI voice assistant living in the head unit.',
  bullets: [
    'Rebuilt a BMW E36 mechanically, end to end.',
    "Developed an AI voice assistant for the car's Android head unit, deployed on Google Cloud Run.",
    'Integrated Gemini and OpenAI with ElevenLabs TTS/STT for hands-free interaction while driving.',
  ],
  // TODO(hussein): drop photos of the real car into public/media/project-car/ and list them here.
  media: [],
  ambient: ['toolbox', 'car-lift'],
};

export default entry;
