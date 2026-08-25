import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { buildRoadGraph } from '@/world/graph';
import { layoutPlots } from '@/world/layout';
import { DEFAULT_PROXIMITY, nearestPlot } from '@/world/proximity';
import { headingOf, initialDriveState, positionOf, stateAtAnchor, step } from '@/world/drive';

const graph = buildRoadGraph(entries);
const plots = layoutPlots(graph, entries);
const AHEAD = { x: 1, z: 0 };
/** Fine enough that a building only offered over a short stretch is still seen. */
const SAMPLES_PER_EDGE = 400;

describe('nearestPlot', () => {
  it('finds nothing in open country', () => {
    expect(nearestPlot({ x: 100000, z: 100000 }, AHEAD, plots)).toBeUndefined();
  });

  it('finds the building you are standing at', () => {
    const target = plots[0];
    expect(target).toBeDefined();
    if (target === undefined) return;
    const found = nearestPlot(target.position, AHEAD, plots);
    expect(found?.entryId).toBe(target.entryId);
  });

  it('ignores a building the car has already driven past', () => {
    const target = plots.find((plot) => plot.district === 'highway');
    expect(target).toBeDefined();
    if (target === undefined) return;

    // Sitting just past it, facing away.
    const position = { x: target.position.x + 20, z: target.position.z };
    expect(nearestPlot(position, { x: 1, z: 0 }, [target])).toBeUndefined();
    // Same spot, facing back at it.
    expect(nearestPlot(position, { x: -1, z: 0 }, [target])?.entryId).toBe(target.entryId);
  });

  it('prefers the nearer of two candidates', () => {
    const [a, b] = plots;
    if (a === undefined || b === undefined) return;
    const near = { x: a.position.x, z: a.position.z };
    expect(nearestPlot(near, AHEAD, [a, b])?.entryId).toBe(a.entryId);
  });

  it('never offers a building beyond reach', () => {
    for (const plot of plots) {
      const far = { x: plot.position.x + DEFAULT_PROXIMITY.reach + plot.radius + 30, z: plot.position.z };
      expect(nearestPlot(far, { x: -1, z: 0 }, [plot])).toBeUndefined();
    }
  });

  /** Drive with the throttle held and collect everything offered on the way. */
  function offeredWhileDriving(seconds: number): Set<string> {
    let state = initialDriveState(graph);
    const seen = new Set<string>();
    for (let frame = 0; frame < 60 * seconds; frame += 1) {
      state = step(graph, state, { throttle: true, steer: 0, flip: false }, 1 / 60);
      const found = nearestPlot(positionOf(graph, state), headingOf(graph, state), plots);
      if (found !== undefined) seen.add(found.entryId);
    }
    return seen;
  }

  it('offers every building on the spine during a drive down the highway', () => {
    // The highway is the resume. If driving it end to end never surfaces a job
    // or a degree, the panel is unreachable without the minimap.
    const seen = offeredWhileDriving(30);
    const onSpine = entries.filter(
      (entry) => (entry.district === 'highway' || entry.district === 'garage') && !entry.detour,
    );
    const missed = onSpine.filter((entry) => !seen.has(entry.id)).map((entry) => entry.id);
    expect(missed).toEqual([]);
  });

  it('does not offer a detour entry to someone who drove straight past', () => {
    // The point of a detour is that you have to leave the main road. If it were
    // offered from the spine the bridge would be decoration.
    const seen = offeredWhileDriving(30);
    for (const entry of entries.filter((e) => e.detour)) {
      expect(seen.has(entry.id), `"${entry.id}" was offered without taking the detour`).toBe(false);
    }
  });

  it('offers a detour entry to someone who takes the detour', () => {
    // ...and it must be reachable, or the content is stranded.
    for (const entry of entries.filter((e) => e.detour)) {
      const anchor = graph.anchorByEntryId.get(entry.id);
      expect(anchor).toBeDefined();
      if (anchor === undefined) continue;
      const bridge = graph.edgeById.get(anchor.edgeId);
      expect(bridge).toBeDefined();
      if (bridge === undefined) continue;

      let state = stateAtAnchor(graph, anchor);
      let found = false;
      for (let frame = 0; frame < 60 * 6 && !found; frame += 1) {
        state = step(graph, state, { throttle: true, steer: 0, flip: false }, 1 / 60);
        const near = nearestPlot(positionOf(graph, state), headingOf(graph, state), plots);
        if (near?.entryId === entry.id) found = true;
      }
      expect(found, `"${entry.id}" is unreachable even on its own detour`).toBe(true);
    }
  });

  /**
   * The detour test above proves the detour entries can be reached. Nothing
   * proved it for the other fourteen.
   *
   * `layoutPlots` displaces buildings away from their anchors to keep them from
   * overlapping, and it does not move the anchor with them. Push one far enough
   * and a neighbour's building becomes the nearest thing to every point of road
   * beside it — at which point that project has no button anywhere in the world
   * and is reachable only by URL. Two entries are already displaced far enough
   * that a neighbour's centre is closer to their own anchor than their own
   * building is, so this is a live margin, not a hypothetical one.
   *
   * Sampled along the roads rather than driven, because whether a building can
   * be offered at all is a property of the geometry, not of how you got there.
   */
  it('offers every building somewhere on the road', () => {
    const offered = new Set<string>();
    for (const edge of graph.edgeById.values()) {
      for (const direction of [1, -1] as const) {
        for (let i = 0; i <= SAMPLES_PER_EDGE; i += 1) {
          const state = {
            edgeId: edge.id,
            u: i / SAMPLES_PER_EDGE,
            direction,
            speed: 0,
            targetNodeId: edge.toId,
            choice: 0,
          };
          const near = nearestPlot(positionOf(graph, state), headingOf(graph, state), plots);
          if (near?.entryId !== undefined) offered.add(near.entryId);
        }
      }
    }

    for (const entry of entries) {
      expect(offered.has(entry.id), `"${entry.id}" is never the nearest building anywhere`).toBe(
        true,
      );
    }
  });
});
