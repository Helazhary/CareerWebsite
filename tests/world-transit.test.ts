import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { buildRoadGraph } from '@/world/graph';
import { layoutPlots } from '@/world/layout';
import {
  type TransitStation,
  buildTransitDiagram,
  transitPosition,
} from '@/world/transit';
import { type DriveInput, initialDriveState, step } from '@/world/drive';

const graph = buildRoadGraph(entries);
const plots = layoutPlots(graph, entries);
const diagram = buildTransitDiagram(graph, plots);

const allStations = (): TransitStation[] => diagram.lines.flatMap((line) => [...line.stations]);

describe('the diagram is a function of the world', () => {
  it('gives every entry exactly one station', () => {
    const stations = allStations();
    expect(stations).toHaveLength(entries.length);
    expect(new Set(stations.map((s) => s.entryId)).size).toBe(entries.length);
    for (const entry of entries) {
      expect(diagram.stationByEntryId.has(entry.id), `"${entry.id}" is not on the map`).toBe(true);
    }
  });

  it('puts every station on a line that claims it', () => {
    for (const line of diagram.lines) {
      for (const station of line.stations) {
        expect(station.lineId).toBe(line.id);
        expect(Number.isFinite(station.x) && Number.isFinite(station.y)).toBe(true);
      }
    }
  });

  it('gives every branch district an interchange on the trunk', () => {
    const branched = new Set(
      graph.edges.filter((edge) => edge.kind === 'spur').map((edge) => edge.district),
    );
    expect(branched.size).toBeGreaterThan(0);
    expect(new Set(diagram.interchanges.map((i) => i.district))).toEqual(branched);
    for (const interchange of diagram.interchanges) {
      expect(interchange.y).toBe(0);
    }
  });
});

describe('the diagram keeps the order the world has', () => {
  it('runs trunk stations left to right in the order they are driven past', () => {
    const worldX = new Map(plots.map((plot) => [plot.entryId, plot.position.x]));
    const trunk = diagram.lines.find((line) => line.trunk);
    expect(trunk).toBeDefined();
    if (trunk === undefined) return;

    // Asserted on the drawn coordinates, not on the feature list they came
    // from: the highway once rendered out of order while its inputs were fine.
    for (let i = 1; i < trunk.stations.length; i += 1) {
      const previous = trunk.stations[i - 1];
      const current = trunk.stations[i];
      if (previous === undefined || current === undefined) continue;
      expect(current.x).toBeGreaterThan(previous.x);
      expect(worldX.get(current.entryId) ?? 0).toBeGreaterThan(worldX.get(previous.entryId) ?? 0);
    }
  });

  it('runs each branch outward from its own interchange', () => {
    for (const line of diagram.lines) {
      if (line.trunk) continue;
      const interchange = diagram.interchanges.find((i) => i.district === line.district);
      expect(interchange).toBeDefined();
      if (interchange === undefined) continue;

      const uById = new Map(plots.map((plot) => [plot.entryId, plot.u]));
      for (const station of line.stations) {
        expect(station.x).toBeGreaterThan(interchange.x);
      }
      for (let i = 1; i < line.stations.length; i += 1) {
        const previous = line.stations[i - 1];
        const current = line.stations[i];
        if (previous === undefined || current === undefined) continue;
        expect(current.x).toBeGreaterThan(previous.x);
        // Further out on the map means further down the road from the spine.
        expect(uById.get(current.entryId) ?? 0).toBeGreaterThan(uById.get(previous.entryId) ?? 0);
      }
    }
  });

  it('never lays two branch lines on top of one another', () => {
    const branches = diagram.lines.filter((line) => !line.trunk);
    for (let i = 0; i < branches.length; i += 1) {
      for (let j = i + 1; j < branches.length; j += 1) {
        const a = branches[i];
        const b = branches[j];
        if (a === undefined || b === undefined) continue;
        const aY = a.stations[0]?.y;
        const bY = b.stations[0]?.y;
        if (aY === undefined || bY === undefined || aY !== bY) continue;

        // Same row, so their runs must not overlap in x.
        const aRun = a.points.map((p) => p.x);
        const bRun = b.points.map((p) => p.x);
        const overlap =
          Math.min(...aRun) < Math.max(...bRun) && Math.min(...bRun) < Math.max(...aRun);
        expect(overlap, `"${a.id}" and "${b.id}" share a row and overlap`).toBe(false);
      }
    }
  });

  it('keeps every branch clear of the trunk it leaves', () => {
    for (const line of diagram.lines) {
      if (line.trunk) continue;
      for (const station of line.stations) expect(station.y).not.toBe(0);
    }
  });
});

describe('where the car is on the diagram', () => {
  const HOLD: DriveInput = { throttle: true, steer: 0, flip: false };
  const FRAME = 1 / 60;

  it('names a stop you are at and a different one you are heading for', () => {
    let state = initialDriveState(graph);
    for (let t = 0; t < 4; t += FRAME) state = step(graph, state, HOLD, FRAME);

    const position = transitPosition(graph, plots, state);
    expect(position.atEntryId).not.toBeNull();
    expect(position.nextEntryId).not.toBeNull();
    expect(position.nextEntryId).not.toBe(position.atEntryId);
    // Both must be real stations, or the map has nothing to light up.
    expect(diagram.stationByEntryId.has(position.atEntryId ?? '')).toBe(true);
    expect(diagram.stationByEntryId.has(position.nextEntryId ?? '')).toBe(true);
  });

  it('arrives at the stop it said was next', () => {
    let state = initialDriveState(graph);
    for (let t = 0; t < 3; t += FRAME) state = step(graph, state, HOLD, FRAME);

    const promised = transitPosition(graph, plots, state).nextEntryId;
    expect(promised).not.toBeNull();

    // Straight on is the default at every junction, so holding the throttle
    // follows exactly the branch the prediction was made against.
    let reached = false;
    for (let t = 0; t < 25 && !reached; t += FRAME) {
      state = step(graph, state, HOLD, FRAME);
      if (transitPosition(graph, plots, state).atEntryId === promised) reached = true;
    }
    expect(reached, `never arrived at the promised stop "${promised ?? ''}"`).toBe(true);
  });

  it('never offers a stop the car has already gone past', () => {
    // The guard for the first hop specifically. Everywhere there is something
    // both ahead of and behind the car on the road it is on, the one it names
    // must be ahead — walking further down the graph cannot fix a wrong answer
    // here, and a reversed comparison is invisible anywhere else.
    let checked = 0;
    for (const edge of graph.edges) {
      const onEdge = plots.filter((plot) => plot.edgeId === edge.id);
      if (onEdge.length < 2) continue;

      for (const direction of [1, -1] as const) {
        for (let i = 1; i < 8; i += 1) {
          const u = i / 8;
          const ahead = onEdge.filter((plot) => (direction > 0 ? plot.u > u : plot.u < u));
          const behind = onEdge.filter((plot) => (direction > 0 ? plot.u < u : plot.u > u));
          if (ahead.length === 0 || behind.length === 0) continue;

          const position = transitPosition(graph, plots, {
            edgeId: edge.id,
            u,
            direction,
            speed: 0,
            targetNodeId: direction > 0 ? edge.toId : edge.fromId,
            choice: 0,
            turning: 0,
          });
          checked += 1;
          expect(
            ahead.map((plot) => plot.entryId),
            `heading ${direction > 0 ? 'up' : 'down'} "${edge.id}" at u=${u}`,
          ).toContain(position.nextEntryId);
        }
      }
    }
    expect(checked, 'no road has buildings on both sides of the car to test with').toBeGreaterThan(
      0,
    );
  });

  it('offers a different stop once the car has turned around', () => {
    const spur = graph.edges.find(
      (edge) => edge.kind === 'spur' && plots.filter((p) => p.edgeId === edge.id).length > 1,
    );
    expect(spur).toBeDefined();
    if (spur === undefined) return;

    const middle = {
      edgeId: spur.id,
      u: 0.5,
      direction: 1 as const,
      speed: 0,
      targetNodeId: spur.toId,
      choice: 0,
      turning: 0,
    };
    const outbound = transitPosition(graph, plots, middle);
    const inbound = transitPosition(graph, plots, {
      ...middle,
      direction: -1 as const,
      targetNodeId: spur.fromId,
    });
    expect(outbound.nextEntryId).not.toBeNull();
    expect(inbound.nextEntryId).not.toBeNull();
    expect(inbound.nextEntryId).not.toBe(outbound.nextEntryId);
  });

  it('always names stations that exist, anywhere on any road', () => {
    for (const edge of graph.edges) {
      for (const direction of [1, -1] as const) {
        for (let i = 0; i <= 8; i += 1) {
          const state = {
            edgeId: edge.id,
            u: i / 8,
            direction,
            speed: 0,
            targetNodeId: direction > 0 ? edge.toId : edge.fromId,
            choice: 0,
            turning: 0,
          };
          const position = transitPosition(graph, plots, state);
          if (position.atEntryId !== null) {
            expect(diagram.stationByEntryId.has(position.atEntryId)).toBe(true);
          }
          if (position.nextEntryId !== null) {
            expect(diagram.stationByEntryId.has(position.nextEntryId)).toBe(true);
          }
        }
      }
    }
  });
});
