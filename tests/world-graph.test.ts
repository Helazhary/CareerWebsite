import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { entrySchema, type Entry, type EntryInput } from '@content/schema';
import {
  DEFAULT_GRAPH_OPTIONS,
  branchesFrom,
  buildRoadGraph,
  minorRoadClearance,
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

describe('the Montreal detour', () => {
  const graph = buildRoadGraph(entries);
  const detoured = entries.filter((entry) => entry.detour);

  it('has content that asks for a detour', () => {
    expect(detoured.length).toBeGreaterThan(0);
  });

  it('leaves the spine and rejoins it, rather than dead-ending', () => {
    for (const entry of detoured) {
      const bridge = graph.edgeById.get(`detour-${entry.id}`);
      expect(bridge, `no bridge for "${entry.id}"`).toBeDefined();
      if (bridge === undefined) continue;
      expect(bridge.kind).toBe('detour');
      expect(bridge.fromId).not.toBe(bridge.toId);
      // Both ends are junctions on the spine, so the detour is a loop.
      expect(graph.nodeById.get(bridge.fromId)?.kind).toBe('junction');
      expect(graph.nodeById.get(bridge.toId)?.kind).toBe('junction');
    }
  });

  it('bows away from the spine so it is visibly a detour', () => {
    for (const entry of detoured) {
      const bridge = graph.edgeById.get(`detour-${entry.id}`);
      if (bridge === undefined) continue;
      const middle = sampleEdge(bridge, 0.5);
      expect(Math.abs(middle.z)).toBeGreaterThan(40);
    }
  });

  it('puts the entry on the bridge, not on the spine', () => {
    for (const entry of detoured) {
      const anchor = graph.anchorByEntryId.get(entry.id);
      expect(anchor?.edgeId).toBe(`detour-${entry.id}`);
    }
  });

  it('can still be driven straight past without taking it', () => {
    // The spine has to remain continuous through the detour's junctions, or
    // "hold forward and read the resume" stops working.
    const spine = graph.edges.filter((edge) => edge.kind === 'spine');
    const reached = new Set<string>([graph.spawnNodeId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const edge of spine) {
        if (reached.has(edge.fromId) && !reached.has(edge.toId)) {
          reached.add(edge.toId);
          grew = true;
        }
      }
    }
    expect(reached.has('terminus-fog')).toBe(true);
  });

  it('marks every edge with what it structurally is', () => {
    const kinds = new Set(graph.edges.map((edge) => edge.kind));
    expect([...kinds].sort()).toEqual(['detour', 'spine', 'spur']);
  });
});

describe('the fog ending', () => {
  const graph = buildRoadGraph(entries);

  it('runs the road well past the last building', () => {
    const plotXs = graph.anchors.map((anchor) => {
      const edge = graph.edgeById.get(anchor.edgeId);
      return edge === undefined ? 0 : sampleEdge(edge, anchor.u).x;
    });
    const fog = graph.nodeById.get('terminus-fog');
    // Far enough that the road visibly continues rather than simply stopping
    // just after the final plot.
    expect((fog?.position.x ?? 0) - Math.max(...plotXs)).toBeGreaterThan(200);
  });

  /**
   * The number the road renderer holds side-road kerbs and verges closed for.
   *
   * It has to be at least as far as the roads actually take to separate. When
   * it was a hand-picked 46 it was two units short of the spurs and five short
   * of the detour, and the shortfall showed up as a stitched white slab of
   * z-fighting at every off-ramp — coplanar kerbs and verges from two roads
   * drawn on top of each other at the same height.
   *
   * Asserting it is measured rather than assumed: a constant would go quietly
   * out of date the first time content changed the spacing of the world, and
   * the only symptom would be a rendering artefact nobody connects to content.
   */
  it('measures how far a side road runs before it is clear of the junction', () => {
    const graph = buildRoadGraph(entries);
    const roadWidth = (7 + 1.1 + 7) * 2;
    const clearance = minorRoadClearance(graph, roadWidth);

    // Something, or the renderer is tapering nothing.
    expect(clearance).toBeGreaterThan(0);

    // And genuinely clear at that distance: walk each minor road out to the
    // measured point and check it against every neighbour of its junction.
    for (const node of graph.nodes) {
      if (node.kind !== 'junction') continue;
      const incident = node.edgeIds.flatMap((id) => {
        const edge = graph.edgeById.get(id);
        return edge === undefined ? [] : [edge];
      });

      for (const minor of incident) {
        if (minor.kind === 'spine') continue;
        if (clearance > minor.length) continue;
        const outward = minor.fromId === node.id;
        const u = outward ? clearance / minor.length : 1 - clearance / minor.length;
        const point = sampleEdge(minor, u);

        for (const other of incident) {
          if (other.id === minor.id) continue;
          let nearest = Number.POSITIVE_INFINITY;
          for (let i = 0; i <= 96; i += 1) {
            const against = sampleEdge(other, i / 96);
            nearest = Math.min(nearest, Math.hypot(point.x - against.x, point.z - against.z));
          }
          expect(
            nearest,
            `"${minor.id}" is still ${nearest.toFixed(1)} from "${other.id}" at the measured clearance`,
          ).toBeGreaterThanOrEqual(roadWidth - 1);
        }
      }
    }
  });

  /**
   * A detour must not open across an off-ramp on the side it bows to.
   *
   * The bridge arcs out to one side of the spine for its whole span and every
   * district arcs out to its own fixed side, so a detour opening over a ramp
   * lays a road through that district's frontage. Concordia did exactly that
   * the moment The Lab's date moved four months later: the bridge passed two
   * units from the buildings on the lab ramp, and `layoutPlots` had to push one
   * of them into a second rank behind the others to find room — which in turn
   * put it far enough from its own anchor that arriving there offered a
   * neighbour instead.
   *
   * Asserted on the built geometry rather than on the side-picking function, so
   * it holds however the side comes to be chosen.
   */
  it('never opens a detour across an off-ramp on the side it bows to', () => {
    const graph = buildRoadGraph(entries);
    const detours = graph.edges.filter((edge) => edge.kind === 'detour');
    expect(detours.length).toBeGreaterThan(0);

    /** Which side of the spine an edge lies on, from where its middle sits. */
    const sideOf = (edgeId: string): number => Math.sign(sampleEdge(
      graph.edgeById.get(edgeId) ?? detours[0]!,
      0.5,
    ).z);

    for (const detour of detours) {
      const from = graph.nodeById.get(detour.fromId);
      const to = graph.nodeById.get(detour.toId);
      expect(from).toBeDefined();
      expect(to).toBeDefined();
      if (from === undefined || to === undefined) continue;

      const open = Math.min(from.position.x, to.position.x);
      const close = Math.max(from.position.x, to.position.x);
      const bow = sideOf(detour.id);
      expect(bow).not.toBe(0);

      for (const spur of graph.edges.filter((edge) => edge.kind === 'spur')) {
        if (sideOf(spur.id) !== bow) continue;
        // The junction is wherever this ramp meets the spine, at z = 0.
        const junction = [spur.fromId, spur.toId]
          .map((id) => graph.nodeById.get(id))
          .find((node) => node?.kind === 'junction' && Math.abs(node.position.z) < 1e-6);
        expect(junction, `"${spur.id}" does not meet the spine`).toBeDefined();
        if (junction === undefined) continue;

        const inside = junction.position.x > open && junction.position.x < close;
        expect(
          inside,
          `"${detour.id}" bows over "${spur.id}", whose junction sits at ` +
            `x=${junction.position.x.toFixed(0)} inside the span ${open.toFixed(0)}..${close.toFixed(0)}`,
        ).toBe(false);
      }
    }
  });
});