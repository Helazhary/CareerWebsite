import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { DEFAULT_LAYOUT_OPTIONS, footprintFor } from '@/world/layout';
import { forecourtReach, registeredAmbientIds, unknownAmbientIds } from '@/world/skins/ambient';

const SIZES = ['sm', 'md', 'lg'] as const;

/** The same conservative bounding radius `layout.ts` gives a plot. */
function radiusOf(size: (typeof SIZES)[number]): number {
  const footprint = footprintFor(size);
  return Math.hypot(footprint.width, footprint.depth) / 2;
}

describe('ambient props', () => {
  /**
   * **Nothing grows in the road** (.claude/rules/world.md).
   *
   * The layout puts a plot centre `roadHalfWidth + verge + radius` out from the
   * centreline, so the clear ground between a plot centre and the kerb is
   * `verge + radius` — and props stand in that ground, in front of a building
   * face that is only `depth / 2` out. A prop reaching further than that is in
   * the carriageway.
   *
   * Checked against the layout's own constants rather than a copied-out number,
   * so widening the verge or changing a footprint cannot quietly invalidate it.
   * The tightest case is the smallest footprint, which has the least radius to
   * spend and is therefore the one that fails first.
   */
  it('keeps every prop out of the road, on every footprint', () => {
    const { verge } = DEFAULT_LAYOUT_OPTIONS;

    for (const size of SIZES) {
      const footprint = footprintFor(size);
      const available = verge + radiusOf(size);

      for (const id of registeredAmbientIds()) {
        const reach = forecourtReach(footprint, id);
        expect(
          reach,
          `"${id}" reaches ${reach.toFixed(1)} from the centre of a ${size} plot, which has ` +
            `${available.toFixed(1)} of clear ground before the kerb`,
        ).toBeLessThanOrEqual(available);
      }
    }
  });

  it('places facade props on the wall, not on the ground', () => {
    // A facade prop has no forecourt reach by definition; if one ever gets a
    // ground extent it would be placed twice.
    expect(forecourtReach(footprintFor('md'), 'lit-windows')).toBe(0);
  });

  it('ignores an id it has never heard of', () => {
    expect(unknownAmbientIds(['definitely-not-a-prop'])).toEqual(['definitely-not-a-prop']);
    expect(forecourtReach(footprintFor('md'), 'definitely-not-a-prop')).toBe(0);
  });

  it('has no props registered that no entry ever asks for', () => {
    const asked = new Set(entries.flatMap((entry) => entry.ambient));
    const orphans = registeredAmbientIds().filter((id) => !asked.has(id));
    expect(orphans, 'props in the kit that no content asks for').toEqual([]);
  });
});
