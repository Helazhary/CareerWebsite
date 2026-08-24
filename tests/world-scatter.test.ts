import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { buildRoadGraph, sampleEdge } from '@/world/graph';
import { DEFAULT_LAYOUT_OPTIONS, layoutPlots } from '@/world/layout';
import { DEFAULT_SCATTER, scatterLamps, scatterScenery } from '@/world/scatter';

const graph = buildRoadGraph(entries);
const plots = layoutPlots(graph, entries);
const scenery = scatterScenery(graph, plots);
const lamps = scatterLamps(graph);

/** Shortest distance from a point to any road centreline. */
function distanceToAnyRoad(point: { x: number; z: number }, samples = 64): number {
  let nearest = Number.POSITIVE_INFINITY;
  for (const edge of graph.edges) {
    for (let i = 0; i <= samples; i += 1) {
      const road = sampleEdge(edge, i / samples);
      nearest = Math.min(nearest, Math.hypot(road.x - point.x, road.z - point.z));
    }
  }
  return nearest;
}

describe('scatterScenery', () => {
  it('produces a populated world', () => {
    expect(scenery.length).toBeGreaterThan(200);
    expect(scenery.length).toBeLessThanOrEqual(DEFAULT_SCATTER.maxItems);
  });

  it('never grows anything in the road', () => {
    for (const item of scenery) {
      const clearance = distanceToAnyRoad(item.position);
      expect(
        clearance,
        `a ${item.kind} stands ${clearance.toFixed(1)} from a road centreline`,
      ).toBeGreaterThan(DEFAULT_LAYOUT_OPTIONS.roadHalfWidth);
    }
  });

  it('never grows anything inside a building', () => {
    for (const item of scenery) {
      for (const plot of plots) {
        const distance = Math.hypot(
          plot.position.x - item.position.x,
          plot.position.z - item.position.z,
        );
        expect(distance, `a ${item.kind} is inside "${plot.entryId}"`).toBeGreaterThanOrEqual(
          plot.radius,
        );
      }
    }
  });

  it('is deterministic, so the world does not reshuffle between builds', () => {
    expect(scatterScenery(graph, plots)).toEqual(scenery);
  });

  it('changes with the seed', () => {
    const other = scatterScenery(graph, plots, { seed: 99 });
    expect(other).not.toEqual(scenery);
  });

  it('varies planting by district rather than scattering one thing everywhere', () => {
    const kinds = new Set(scenery.map((item) => item.kind));
    expect(kinds.size).toBeGreaterThan(1);
  });

  it('respects the hard cap on a much larger world', () => {
    const dense = scatterScenery(graph, plots, { gridStep: 5, density: 1 });
    expect(dense.length).toBeLessThanOrEqual(DEFAULT_SCATTER.maxItems);
  });

  it('gives everything a real transform', () => {
    for (const item of scenery) {
      expect(Number.isFinite(item.position.x) && Number.isFinite(item.position.z)).toBe(true);
      expect(item.scale).toBeGreaterThan(0);
      expect(item.rotationY).toBeGreaterThanOrEqual(0);
      expect(item.rotationY).toBeLessThanOrEqual(Math.PI * 2);
    }
  });

  it('copes with an empty world', () => {
    const bare = buildRoadGraph([]);
    expect(() => scatterScenery(bare, [])).not.toThrow();
  });
});

describe('scatterLamps', () => {
  it('lines every road', () => {
    expect(lamps.length).toBeGreaterThan(30);
  });

  // Regression: flooring the count left the short connectors between junctions
  // with no lamps at all, which is the worst place to lose the road.
  it('lights every single stretch, however short', () => {
    const lit = new Set<string>();
    for (const lamp of lamps) {
      let best = '';
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const edge of graph.edges) {
        for (let i = 0; i <= 32; i += 1) {
          const point = sampleEdge(edge, i / 32);
          const distance = Math.hypot(point.x - lamp.position.x, point.z - lamp.position.z);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = edge.id;
          }
        }
      }
      lit.add(best);
    }
    const dark = graph.edges.filter((edge) => !lit.has(edge.id)).map((edge) => edge.id);
    expect(dark).toEqual([]);
  });

  it('stands them on the verge, never in the carriageway', () => {
    for (const lamp of lamps) {
      const clearance = distanceToAnyRoad(lamp.position);
      expect(clearance).toBeGreaterThan(DEFAULT_LAYOUT_OPTIONS.roadHalfWidth);
    }
  });

  it('keeps them close enough to actually light the road', () => {
    for (const lamp of lamps) {
      expect(distanceToAnyRoad(lamp.position)).toBeLessThan(20);
    }
  });

  it('is deterministic', () => {
    expect(scatterLamps(graph)).toEqual(lamps);
  });
});
