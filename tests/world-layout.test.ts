import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { entrySchema, type Entry, type EntryInput } from '@content/schema';
import { buildRoadGraph } from '@/world/graph';
import {
  DEFAULT_LAYOUT_OPTIONS,
  clearanceToRoad,
  findOverlaps,
  footprintFor,
  layoutPlots,
} from '@/world/layout';

function makeEntry(overrides: Partial<EntryInput> & { id: string }): Entry {
  return entrySchema.parse({
    kind: 'project',
    title: `Entry ${overrides.id}`,
    start: '2024-01',
    district: 'lab',
    skin: 'lab',
    tags: ['test'],
    summary: 'A synthetic entry used to exercise layout invariants.',
    bullets: ['Did a thing.'],
    ...overrides,
  } satisfies EntryInput);
}

describe('layoutPlots with the real content set', () => {
  const graph = buildRoadGraph(entries);
  const plots = layoutPlots(graph, entries);

  it('places every entry exactly once', () => {
    expect(plots).toHaveLength(entries.length);
    expect(new Set(plots.map((p) => p.entryId)).size).toBe(entries.length);
  });

  it('no two buildings overlap', () => {
    expect(findOverlaps(plots)).toEqual([]);
  });

  it('no building sits in the road', () => {
    for (const plot of plots) {
      const anchor = graph.anchorByEntryId.get(plot.entryId);
      const edge = anchor === undefined ? undefined : graph.edgeById.get(anchor.edgeId);
      expect(edge).toBeDefined();
      if (edge === undefined) continue;
      expect(clearanceToRoad(plot, edge)).toBeGreaterThan(DEFAULT_LAYOUT_OPTIONS.roadHalfWidth);
    }
  });

  it('keeps every building clear of every road, not just its own', () => {
    for (const plot of plots) {
      for (const edge of graph.edges) {
        const clearance = clearanceToRoad(plot, edge);
        expect(
          clearance,
          `"${plot.entryId}" is ${clearance.toFixed(1)} from road "${edge.id}"`,
        ).toBeGreaterThan(DEFAULT_LAYOUT_OPTIONS.roadHalfWidth);
      }
    }
  });

  it('faces every building at the road it fronts onto', () => {
    for (const plot of plots) {
      const anchor = graph.anchorByEntryId.get(plot.entryId);
      const edge = anchor === undefined ? undefined : graph.edgeById.get(anchor.edgeId);
      if (edge === undefined) continue;

      const facing = { x: Math.sin(plot.rotationY), z: Math.cos(plot.rotationY) };
      expect(Math.hypot(facing.x, facing.z)).toBeCloseTo(1, 6);

      const stepped = {
        entryId: plot.entryId,
        position: { x: plot.position.x + facing.x * 5, z: plot.position.z + facing.z * 5 },
      };
      const before = clearanceToRoad(plot, edge);
      const after = clearanceToRoad({ ...plot, ...stepped }, edge);
      expect(after, `"${plot.entryId}" faces away from its road`).toBeLessThan(before);
    }
  });

  it('sizes buildings from the schema `size` field', () => {
    for (const plot of plots) {
      expect(plot.footprint).toEqual(footprintFor(plot.size));
    }
    expect(footprintFor('lg').width).toBeGreaterThan(footprintFor('md').width);
    expect(footprintFor('md').width).toBeGreaterThan(footprintFor('sm').width);
  });

  it('keeps the whole world on the roadside, not in a second rank', () => {
    // The real content fits at the kerb. If this ever fails, the world grew and
    // ranking kicked in — which is correct behaviour, not a bug.
    expect(plots.every((p) => p.rank === 0)).toBe(true);
  });

  it('is deterministic', () => {
    expect(layoutPlots(graph, entries)).toEqual(plots);
  });
});

describe('layoutPlots under pressure', () => {
  it('never overlaps, however many projects land in one district', () => {
    for (const count of [1, 5, 12, 40]) {
      const crowd = Array.from({ length: count }, (_, i) =>
        makeEntry({ id: `lab-${i}`, district: 'lab', skin: 'lab', size: 'lg' }),
      );
      const graph = buildRoadGraph(crowd);
      const plots = layoutPlots(graph, crowd);
      expect(plots).toHaveLength(count);
      expect(findOverlaps(plots), `overlap with ${count} entries in one district`).toEqual([]);
    }
  });

  it('starts a second rank rather than stacking when frontage runs out', () => {
    const crowd = Array.from({ length: 40 }, (_, i) =>
      makeEntry({ id: `lab-${i}`, district: 'lab', skin: 'lab', size: 'lg' }),
    );
    const graph = buildRoadGraph(crowd);
    const plots = layoutPlots(graph, crowd);
    expect(Math.max(...plots.map((p) => p.rank))).toBeGreaterThan(0);
  });

  it('sets deeper ranks further from the road', () => {
    const crowd = Array.from({ length: 40 }, (_, i) =>
      makeEntry({ id: `lab-${i}`, district: 'lab', skin: 'lab', size: 'lg' }),
    );
    const graph = buildRoadGraph(crowd);
    const plots = layoutPlots(graph, crowd);
    const spur = graph.edges.find((e) => e.district === 'lab');
    expect(spur).toBeDefined();
    if (spur === undefined) return;

    const roadside = plots.filter((p) => p.rank === 0);
    const behind = plots.filter((p) => p.rank === 1);
    expect(behind.length).toBeGreaterThan(0);
    const nearest = Math.min(...behind.map((p) => clearanceToRoad(p, spur)));
    const furthest = Math.max(...roadside.map((p) => clearanceToRoad(p, spur)));
    expect(nearest).toBeGreaterThan(furthest);
  });

  it('handles a district with no entries at all', () => {
    const graph = buildRoadGraph([]);
    expect(layoutPlots(graph, [])).toEqual([]);
  });

  it('keeps buildings off the spine when a district is crowded', () => {
    const crowd = Array.from({ length: 20 }, (_, i) =>
      makeEntry({ id: `w-${i}`, district: 'workshop', skin: 'workshop', size: 'lg' }),
    );
    const graph = buildRoadGraph(crowd);
    const plots = layoutPlots(graph, crowd);
    const spine = graph.edges.filter((e) => e.district === 'highway');
    for (const plot of plots) {
      for (const edge of spine) {
        expect(clearanceToRoad(plot, edge)).toBeGreaterThan(DEFAULT_LAYOUT_OPTIONS.roadHalfWidth);
      }
    }
  });
});

describe('world composition', () => {
  const graph = buildRoadGraph(entries);
  const plots = layoutPlots(graph, entries);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const positionOf = (id: string): number =>
    plots.find((plot) => plot.entryId === id)?.position.x ?? NaN;

  // Regression: layout used to repack each frontage from the start of its edge,
  // discarding the date the graph had anchored to. The highway read out of
  // order even though the anchors were correct, so assert on where buildings
  // actually stand, not on where they asked to stand.
  it('reads chronologically when driven straight through', () => {
    const highway = plots
      .filter((plot) => plot.district === 'highway')
      .map((plot) => ({ start: byId.get(plot.entryId)?.start ?? '', x: plot.position.x }))
      .sort((a, b) => a.start.localeCompare(b.start));

    for (let i = 1; i < highway.length; i += 1) {
      const previous = highway[i - 1];
      const current = highway[i];
      expect(
        current?.x ?? 0,
        `${current?.start} should stand further along than ${previous?.start}`,
      ).toBeGreaterThan(previous?.x ?? 0);
    }
  });

  // Regression: the garage used to ride the timeline like any other district,
  // which stranded the car's own garage in the middle of the career.
  it('opens in the garage, before anything on the highway', () => {
    const garage = plots.filter((plot) => plot.district === 'garage');
    expect(garage.length).toBeGreaterThan(0);
    const firstHighway = Math.min(
      ...plots.filter((plot) => plot.district === 'highway').map((plot) => plot.position.x),
    );
    for (const plot of garage) {
      expect(plot.position.x).toBeLessThan(firstHighway);
    }
  });

  it('starts the car behind the garage', () => {
    const spawn = graph.nodeById.get(graph.spawnNodeId);
    expect(spawn?.position.x ?? 0).toBeLessThan(Math.min(...plots.map((plot) => plot.position.x)));
  });

  it('ends with the largest building, then road into fog', () => {
    const furthest = plots.reduce((a, b) => (a.position.x > b.position.x ? a : b));
    expect(furthest.size).toBe('lg');
    expect(graph.nodeById.get('terminus-fog')?.position.x ?? 0).toBeGreaterThan(furthest.position.x);
    expect(positionOf('qortova')).toBe(furthest.position.x);
  });
});
