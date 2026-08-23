import type { EntryInput } from '../schema';

const entry: EntryInput = {
  id: 'games-and-apps',
  kind: 'project',
  title: 'Android Applications & 2D Games',
  // TODO(hussein): dates are ESTIMATED — the resume lists no project dates. Verify before publishing.
  start: '2022-09',
  end: '2024-12',
  district: 'arcade',
  skin: 'arcade',
  size: 'md',
  tags: ['Kotlin', 'Firebase', 'Unity', 'Godot', 'C++'],
  summary: 'An Animatex-nominated physics game, an A*-driven puzzle game, and Firebase-backed Android apps.',
  bullets: [
    'Animatex-nominated 2D physics game.',
    'C++ puzzle game with A*-driven enemy AI.',
    'Physics-based Unity game.',
    'Firebase-backed Android apps: a student networking platform, a university search tool, and an MVC 15-puzzle.',
  ],
  // TODO(hussein): drop screenshots into public/media/games-and-apps/ and list them here.
  media: [],
  ambient: ['arcade-cabinet'],
};

export default entry;
