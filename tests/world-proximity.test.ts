import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { buildRoadGraph } from '@/world/graph';
import { layoutPlots } from '@/world/layout';
import { DEFAULT_PROXIMITY, nearestPlot } from '@/world/proximity';
import { headingOf, initialDriveState, positionOf, step } from '@/world/drive';

const graph = buildRoadGraph(entries);
const plots = layoutPlots(graph, entries);
const AHEAD = { x: 1, z: 0 };

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

  it('offers every building at some point during a drive down the highway', () => {
    // The highway is the resume. If driving it end to end never surfaces a job
    // or a degree, the panel is unreachable without the minimap.
    let state = initialDriveState(graph);
    const seen = new Set<string>();
    for (let frame = 0; frame < 60 * 25; frame += 1) {
      state = step(graph, state, { throttle: true, steer: 0 }, 1 / 60);
      const found = nearestPlot(positionOf(graph, state), headingOf(graph, state), plots);
      if (found !== undefined) seen.add(found.entryId);
    }

    const highway = plots.filter((plot) => plot.district === 'highway' || plot.district === 'garage');
    const missed = highway.filter((plot) => !seen.has(plot.entryId)).map((plot) => plot.entryId);
    expect(missed).toEqual([]);
  });
});
