import { describe, expect, it } from 'vitest';
import {
  entries,
  byChronology,
  byRecency,
  projects,
  jobs,
  education,
  getEntry,
  inDistrict,
  allTags,
} from '@content/registry';
import { entrySchema } from '@content/schema';

describe('content registry', () => {
  it('loads and validates every entry', () => {
    expect(entries.length).toBeGreaterThan(0);
    for (const entry of entries) {
      expect(() => entrySchema.parse(entry)).not.toThrow();
    }
  });

  it('has unique ids', () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('partitions cleanly by kind', () => {
    expect(projects.length + jobs.length + education.length).toBe(entries.length);
  });

  it('orders chronology oldest first', () => {
    for (let i = 1; i < byChronology.length; i += 1) {
      expect(byChronology[i]!.start >= byChronology[i - 1]!.start).toBe(true);
    }
  });

  it('puts current roles at the top of recency order', () => {
    const current = entries.filter((e) => e.end === 'present');
    for (const entry of current) {
      expect(byRecency.indexOf(entry)).toBeLessThan(current.length);
    }
  });

  it('never ends before it starts', () => {
    for (const entry of entries) {
      if (entry.end && entry.end !== 'present') {
        expect(entry.end >= entry.start).toBe(true);
      }
    }
  });

  it('resolves entries by id and returns undefined otherwise', () => {
    expect(getEntry(entries[0]!.id)?.id).toBe(entries[0]!.id);
    expect(getEntry('no-such-entry')).toBeUndefined();
  });

  it('files every job and degree on the highway', () => {
    for (const entry of [...jobs, ...education]) {
      expect(entry.district).toBe('highway');
    }
  });

  it('keeps projects off the highway', () => {
    for (const entry of projects) {
      expect(entry.district).not.toBe('highway');
    }
    expect(inDistrict('highway').every((e) => e.kind !== 'project')).toBe(true);
  });

  it('requires descriptive alt text on all media', () => {
    for (const entry of entries) {
      for (const item of entry.media) {
        expect(item.alt.length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it('exposes tags most-used first', () => {
    const tags = allTags();
    expect(tags.length).toBeGreaterThan(0);
    expect(new Set(tags).size).toBe(tags.length);
  });
});
