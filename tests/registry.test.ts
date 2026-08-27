import { describe, expect, it } from 'vitest';
import { entryDate, formatRange } from '@/lib/format';
import { unknownAmbientIds } from '@/world/skins/ambient';
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

  /**
   * `ambient` sat in the schema from M0 with every entry declaring one or two,
   * and nothing rendered any of them — seventeen entries asked for props and
   * got bare forecourts, silently, because an unregistered id is ignored rather
   * than throwing.
   *
   * Ignoring unknown ids is the right behaviour at runtime: content should be
   * able to name a prop before the prop exists, and a typo must never blank a
   * building. But nothing was checking that the two lists had ever met.
   */
  it('registers a prop for every ambient id content asks for', () => {
    const asked = [...new Set(entries.flatMap((entry) => entry.ambient))].sort();
    expect(asked.length).toBeGreaterThan(0);
    expect(unknownAmbientIds(asked), 'ambient ids named in content with no prop registered').toEqual(
      [],
    );
  });

  it('exposes tags most-used first', () => {
    const tags = allTags();
    expect(tags.length).toBeGreaterThan(0);
    expect(new Set(tags).size).toBe(tags.length);
  });

  /**
   * `hideDate` hides the date and nothing else.
   *
   * Most of these dates were reconstructed from a resume that lists none for
   * projects, so several are years rather than months and three are not shown
   * at all. `start` still has to exist for every entry even when hidden,
   * because the highway *is* chronology and a district's off-ramp leaves the
   * spine at the date its work began — drop it and The Arcade, whose only
   * member is one of the hidden ones, has nothing to hang its ramp on.
   */
  it('keeps a placement date on every entry, shown or not', () => {
    for (const entry of entries) {
      expect(entry.start, `"${entry.id}" has no start`).toMatch(/^\d{4}(-\d{2})?$/);
    }
  });

  it('shows no date at all for entries that hide it', () => {
    const hidden = entries.filter((entry) => entry.hideDate);
    expect(hidden.length).toBeGreaterThan(0);
    for (const entry of hidden) {
      expect(entryDate(entry), `"${entry.id}" still renders a date`).toBeNull();
    }
    for (const entry of entries.filter((e) => !e.hideDate)) {
      expect(entryDate(entry), `"${entry.id}" renders nothing`).not.toBe('');
    }
  });

  it('writes a bare year as a year, never dressed up with a month', () => {
    expect(formatRange('2024')).toBe('2024');
    expect(formatRange('2023', '2025')).toBe('2023 – 2025');
    // A year against a month in the same year is that year, not a range.
    expect(formatRange('2025', '2025-06')).toBe('2025');
    // Months survive untouched where content actually has them.
    expect(formatRange('2021-09', '2026-02')).toBe('Sep 2021 – Feb 2026');
    expect(formatRange('2026-03', 'present')).toBe('Mar 2026 – Present');
  });
});