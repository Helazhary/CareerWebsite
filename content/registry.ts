import { z } from 'zod';
import { entrySchema, type Entry, type EntryInput, type District } from './schema';
import { entryInputs } from './entries';

/**
 * Validates every entry at module load, which means at build time.
 * A malformed entry fails `next build` with a precise message rather than
 * rendering a broken page.
 */
function validateAll(inputs: EntryInput[]): Entry[] {
  const seen = new Set<string>();
  const out: Entry[] = [];

  for (const input of inputs) {
    const parsed = entrySchema.safeParse(input);
    if (!parsed.success) {
      throw new Error(
        `Invalid content entry "${String(input?.id ?? '<missing id>')}":\n${z.prettifyError(parsed.error)}`,
      );
    }
    if (seen.has(parsed.data.id)) {
      throw new Error(`Duplicate content entry id: "${parsed.data.id}"`);
    }
    seen.add(parsed.data.id);
    out.push(parsed.data);
  }

  return out;
}

export const entries: Entry[] = validateAll(entryInputs);

/** Sort key: 'present' is always the most recent. */
function sortKey(entry: Entry): string {
  return entry.end === 'present' ? '9999-99' : (entry.end ?? entry.start);
}

/** Newest first — the order doc mode reads in. */
export const byRecency: Entry[] = [...entries].sort((a, b) => sortKey(b).localeCompare(sortKey(a)));

/** Oldest first — the order the highway is laid out in. */
export const byChronology: Entry[] = [...entries].sort((a, b) => a.start.localeCompare(b.start));

export const jobs: Entry[] = byRecency.filter((e) => e.kind === 'job');
export const education: Entry[] = byRecency.filter((e) => e.kind === 'education');
export const projects: Entry[] = byRecency.filter((e) => e.kind === 'project');

export function inDistrict(district: District): Entry[] {
  return byRecency.filter((e) => e.district === district);
}

export function getEntry(id: string): Entry | undefined {
  return entries.find((e) => e.id === id);
}

/** Every distinct tag, most used first. Drives doc-mode filtering. */
export function allTags(): string[] {
  const counts = new Map<string, number>();
  for (const e of entries) {
    for (const t of e.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([t]) => t);
}

export type { Entry, District };
