import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { entrySchema, type Entry, type EntryInput } from '@content/schema';
import {
  DEFAULT_GRAPH_OPTIONS,
  branchesFrom,
  buildRoadGraph,
  monthIndex,
  otherEnd,
  sampleEdge,
  spreadMonotonic,
  tangentAt,
  type RoadGraph,
} from '@/world/graph';

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

/** Every node reachable from spawn by walking edges. */
function reachableNodes(graph: RoadGraph): Set<string> {
  const seen = new Set<string>([graph.spawnNodeId]);
  const queue = [graph.spawnNodeId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) continue;
    for (const edge of branchesFrom(graph, current)) {
      const next = otherEnd(edge, current);
      if (seen.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return seen;
}

describe('monthIndex', () => {
  it('orders dates correctly across a year boundary', () => {
    expect(monthIndex('2024-12')).toBeLessThan(monthIndex('2025-01'));
    expect(monthIndex('2025-01') - monthIndex('2024-12')).toBe(1);
  });

  it('rejects malformed input', () => {
    expect(() => monthIndex('not-a-date')).toThrow();
  });
});

describe('spreadMonotonic', () => {
  it('preserves order and enforces the minimum gap', () => {
    const out = spreadMonotonic([0, 1, 2, 100], 10);
    expect(out).toEqual([0, 10, 20, 100]);
    for (let i = 1; i < out.length; i += 1) {
      expect((out[i] ?? 0) - (out[i - 1] ?? 0)).toBeGreaterThanOrEqual(10);
    }
  });

  it('never moves a value backwards', () => {
    const input = [0, 5, 40];
    const out = spreadMonotonic(input, 12);
    out.forEach((value, i) => expect(value).toBeGreaterThanOrEqual(input[i] ?? 0));
  });

  it('handles the empty case', () => {
    expect(spreadMonotonic([], 10)).toEqual([]);
  });
});

describe('buildRoadGraph with the real content set', () => {
  const graph = buildRoadGraph(entries);

  it('roads connect: every node is reachable from spawn', () => {
    const reached = reachableNodes(graph);
    const unreachable = graph.nodes.filter((n) => !reached.has(n.id)).map((n) => n.id);
    expect(unreachable).toEqual([]);
  });

  it('every entry gets an anchor on a real edge', () => {
    for (const entry of entries) {
      const anchor = graph.anchorByEntryId.get(entry.id);
      expect(anchor, `no anchor for "${entry.id}"`).toBeDefined();
      expect(graph.edgeById.has(anchor?.edgeId ?? '')).toBe(true);
      expect(anchor?.u).toBeGreaterThanOrEqual(0);
      expect(anchor?.u).toBeLessThanOrEqual(1);
    }
  });

  it('every plot is reachable: its host edge connects to spawn', () => {
    const reached = reachableNodes(graph);
    for (const anchor of graph.anchors) {
      const edge = graph.edgeById.get(anchor.edgeId);
      expect(edge).toBeDefined();
      expect(reached.has(edge?.fromId ?? '')).toBe(true);
    }
  });

  it('splines are continuous: edge ends land exactly on their nodes', () => {
    for (const edge of graph.edges) {
      const start = sampleEdge(edge, 0);
      const end = sampleEdge(edge, 1);
      const from = graph.nodeById.get(edge.fromId);
      const to = graph.nodeById.get(edge.toId);
      expect(from, `edge ${edge.id} has no from-node`).toBeDefined();
      expect(to, `edge ${edge.id} has no to-node`).toBeDefined();
      expect(start.x).toBeCloseTo(from?.position.x ?? NaN, 6);
      expect(start.z).toBeCloseTo(from?.position.z ?? NaN, 6);
      expect(end.x).toBeCloseTo(to?.position.x ?? NaN, 6);
      expect(end.z).toBeCloseTo(to?.position.z ?? NaN, 6);
    }
  });

  it('has exactly one spawn and reaches a fog terminus', () => {
    expect(graph.nodes.filter((n) => n.kind === 'spawn')).toHaveLength(1);
    expect(graph.nodeById.get('terminus-fog')?.kind).toBe('terminus');
  });

  it('opens one off-ramp per district that has content', () => {
    const spurDistricts = new Set(
      graph.edges.filter((e) => e.district !== 'highway').map((e) => e.district),
    );
    expect([...spurDistricts].sort()).toEqual(['agents', 'arcade', 'lab', 'workshop']);
  });

  it('lays the spine out in chronological order', () => {
    const spine = entries
      .filter((e) => e.district === 'highway')
      .map((entry) => {
        const anchor = graph.anchorByEntryId.get(entry.id);
        const edge = anchor === undefined ? undefined : graph.edgeById.get(anchor.edgeId);
        return {
          start: entry.start,
          x: edge === undefined || anchor === undefined ? 0 : sampleEdge(edge, anchor.u).x,
        };
      })
      .sort((a, b) => a.start.localeCompare(b.start));

    for (let i = 1; i < spine.length; i += 1) {
      expect(spine[i]?.x ?? 0).toBeGreaterThan(spine[i - 1]?.x ?? 0);
    }
  });

  it('gives every junction a real choice of branches', () => {
    for (const node of graph.nodes.filter((n) => n.kind === 'junction')) {
      expect(branchesFrom(graph, node.id).length).toBeGreaterThanOrEqual(3);
    }
  });

  // Regression: districts whose work overlapped in time got junctions a few
  // units apart, and their cul-de-sacs were laid on top of each other.
  it('separates off-ramps that leave the same side of the spine', () => {
    const sides: Record<string, number> = { lab: 1, agents: 1, workshop: -1, arcade: -1 };
    const junctions = graph.nodes
      .filter((node) => node.kind === 'junction')
      .map((node) => ({ district: node.id.replace('junction-', ''), x: node.position.x }))
      .sort((a, b) => a.x - b.x);

    for (let i = 1; i < junctions.length; i += 1) {
      const previous = junctions[i - 1];
      const current = junctions[i];
      if (previous === undefined || current === undefined) continue;
      if (sides[previous.district] !== sides[current.district]) continue;
      expect(
        current.x - previous.x,
        `${previous.district} and ${current.district} share a side and would overlap`,
      ).toBeGreaterThanOrEqual(DEFAULT_GRAPH_OPTIONS.sameSideDistrictGap - 1e-6);
    }
  });

  it('runs the road past the last building into fog', () => {
    const fog = graph.nodeById.get('terminus-fog');
    const furthestPlot = Math.max(
      ...graph.anchors.map((anchor) => {
        const edge = graph.edgeById.get(anchor.edgeId);
        return edge === undefined ? 0 : sampleEdge(edge, anchor.u).x;
      }),
    );
    expect(fog?.position.x ?? 0).toBeGreaterThan(furthestPlot);
  });
});

describe('spline sampling', () => {
  const graph = buildRoadGraph(entries);

  it('returns unit tangents', () => {
    for (const edge of graph.edges) {
      for (const u of [0, 0.25, 0.5, 0.75, 1]) {
        const tangent = tangentAt(edge, u);
        expect(Math.hypot(tangent.x, tangent.z)).toBeCloseTo(1, 6);
      }
    }
  });

  it('advances monotonically along an edge without doubling back', () => {
    for (const edge of graph.edges) {
      let previous = sampleEdge(edge, 0);
      let travelled = 0;
      for (let step = 1; step <= 40; step += 1) {
        const current = sampleEdge(edge, step / 40);
        travelled += Math.hypot(current.x - previous.x, current.z - previous.z);
        previous = current;
      }
      // Sampled length should agree with the stored arc length.
      expect(travelled).toBeCloseTo(edge.length, 0);
    }
  });
});

describe('buildRoadGraph edge cases', () => {
  it('produces a drivable graph with no entries at all', () => {
    const graph = buildRoadGraph([]);
    expect(graph.edges.length).toBeGreaterThan(0);
    expect(graph.nodeById.get(graph.spawnNodeId)).toBeDefined();
    expect(reachableNodes(graph).size).toBe(graph.nodes.length);
  });

  it('handles a single entry', () => {
    const graph = buildRoadGraph([makeEntry({ id: 'only' })]);
    expect(graph.anchorByEntryId.get('only')).toBeDefined();
    expect(reachableNodes(graph).size).toBe(graph.nodes.length);
  });

  it('handles many entries sharing one month without collapsing the spine', () => {
    const crowd = Array.from({ length: 12 }, (_, i) =>
      makeEntry({ id: `same-month-${i}`, district: 'highway', skin: 'office', start: '2025-01' }),
    );
    const graph = buildRoadGraph(crowd);
    const xs = graph.anchors
      .map((anchor) => {
        const edge = graph.edgeById.get(anchor.edgeId);
        return edge === undefined ? 0 : sampleEdge(edge, anchor.u).x;
      })
      .sort((a, b) => a - b);

    for (let i = 1; i < xs.length; i += 1) {
      expect((xs[i] ?? 0) - (xs[i - 1] ?? 0)).toBeGreaterThanOrEqual(
        DEFAULT_GRAPH_OPTIONS.minSpineGap - 1e-6,
      );
    }
  });

  it('is deterministic for the same input', () => {
    const a = buildRoadGraph(entries);
    const b = buildRoadGraph(entries);
    expect(a.edges.map((e) => e.id)).toEqual(b.edges.map((e) => e.id));
    expect(a.anchors).toEqual(b.anchors);
  });
});
