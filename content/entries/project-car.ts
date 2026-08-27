import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'project-car',
  kind: 'project',
  title: 'Project Car with AI Integration',
  subtitle: 'BMW E36',
  start: '2023',
  end: '2025',
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
  media: [
    {
      src: 'three-quarter-front.jpg',
      alt: 'Metallic blue BMW E36 saloon parked on brick paving, seen from the front three-quarter, with gold split-spoke wheels, angel eye headlight rings and a black front splitter, beaded with rain',
      caption: 'Gold split-spokes and angel eye rings.',
    },
    {
      src: 'sunset-overpass.jpg',
      alt: 'The blue E36 parked on gravel beneath a concrete overpass at sunset, silhouetted against an orange sky',
      caption: 'Parked under the overpass at sunset.',
    },
    {
      src: 'engine-bay.jpg',
      alt: 'The E36 engine bay with the bonnet raised, showing a polished strut brace across the suspension towers, a red cone intake filter, and the four angel eye rings in the opened headlight housings below',
      caption: 'Strut brace and cone intake, headlight housings opened up.',
    },
  ],
  ambient: ['toolbox', 'car-lift'],
};

export default entry;
