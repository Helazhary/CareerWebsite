#!/usr/bin/env node
/**
 * Scaffolds a new content entry and its media folder, then re-syncs the index.
 * Everything it asks for maps 1:1 to a field in content/schema.ts.
 */
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { execFileSync } from 'node:child_process';
import { stdin, stdout } from 'node:process';

const DISTRICTS = ['garage', 'lab', 'agents', 'workshop', 'arcade', 'highway'];
const SKINS = ['garage', 'lab', 'server-room', 'workshop', 'arcade', 'office', 'campus'];
const DEFAULT_SKIN = {
  garage: 'garage',
  lab: 'lab',
  agents: 'server-room',
  workshop: 'workshop',
  arcade: 'arcade',
  highway: 'office',
};

const rl = createInterface({ input: stdin, output: stdout });
const ask = async (q, fallback = '') => {
  const answer = (await rl.question(fallback ? `${q} [${fallback}] ` : `${q} `)).trim();
  return answer || fallback;
};

const slug = (s) =>
  s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const title = await ask('Title:');
if (!title) {
  console.error('A title is required.');
  rl.close();
  process.exit(1);
}

const id = slug(await ask('Id (kebab-case):', slug(title)));
const file = join(process.cwd(), 'content', 'entries', `${id}.ts`);
if (existsSync(file)) {
  console.error(`content/entries/${id}.ts already exists.`);
  rl.close();
  process.exit(1);
}

const kind = await ask(`Kind (project | job | education):`, 'project');
const district = await ask(`District (${DISTRICTS.join(' | ')}):`, 'lab');
const skin = await ask(`Skin (${SKINS.join(' | ')}):`, DEFAULT_SKIN[district] ?? 'lab');
const start = await ask('Start (YYYY-MM):');
const end = await ask("End (YYYY-MM, 'present', or blank):", '');
const status = await ask('Status (shipped | in-progress | archived):', 'shipped');
const summary = await ask('One-line summary (max 200 chars):');
const tags = (await ask('Tags (comma separated):'))
  .split(',')
  .map((t) => t.trim())
  .filter(Boolean);

console.log('\nBullets — three to five. Blank line to finish.');
const bullets = [];
for (;;) {
  const bullet = (await rl.question(`  ${bullets.length + 1}. `)).trim();
  if (!bullet) break;
  bullets.push(bullet);
}
rl.close();

const esc = (s) => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
const lines = [
  "import type { EntryInput } from '../schema';",
  '',
  'const entry: EntryInput = {',
  `  id: '${id}',`,
  `  kind: '${kind}',`,
  `  title: '${esc(title)}',`,
  `  start: '${start}',`,
  ...(end ? [`  end: '${esc(end)}',`] : []),
  `  district: '${district}',`,
  `  skin: '${skin}',`,
  ...(status !== 'shipped' ? [`  status: '${status}',`] : []),
  `  tags: [${tags.map((t) => `'${esc(t)}'`).join(', ')}],`,
  `  summary: '${esc(summary)}',`,
  '  bullets: [',
  ...bullets.map((b) => `    '${esc(b)}',`),
  '  ],',
  '  // Drop images in public/media/' + id + '/ then list them here.',
  '  media: [],',
  '  links: {},',
  '};',
  '',
  'export default entry;',
  '',
];

writeFileSync(file, lines.join('\n'));
mkdirSync(join(process.cwd(), 'public', 'media', id), { recursive: true });
writeFileSync(join(process.cwd(), 'public', 'media', id, '.gitkeep'), '');
execFileSync(process.execPath, [join(process.cwd(), 'scripts', 'sync-entries.mjs')], {
  stdio: 'inherit',
});

console.log(`\nCreated content/entries/${id}.ts and public/media/${id}/`);
console.log('Next: npm run check');
