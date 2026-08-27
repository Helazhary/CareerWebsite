import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { buildRoadGraph, otherEnd } from '@/world/graph';
import {
  DEFAULT_DRIVE_OPTIONS,
  type DriveInput,
  type DriveState,
  branchOptions,
  flipAround,
  headingOf,
  initialDriveState,
  positionOf,
  step,
  straightAheadIndex,
  TURN_SECONDS,
  visualHeadingOf,
} from '@/world/drive';

const graph = buildRoadGraph(entries);
const HOLD: DriveInput = { throttle: true, steer: 0, flip: false };
const COAST: DriveInput = { throttle: false, steer: 0, flip: false };
const FRAME = 1 / 60;

function drive(state: DriveState, input: DriveInput, seconds: number): DriveState {
  let current = state;
  for (let t = 0; t < seconds; t += FRAME) current = step(graph, current, input, FRAME);
  return current;
}

/** The invariants that must hold after every single frame, forever. */
function assertOnTheRoad(state: DriveState): void {
  const edge = graph.edgeById.get(state.edgeId);
  expect(edge, `car left the graph onto "${state.edgeId}"`).toBeDefined();
  expect(state.u).toBeGreaterThanOrEqual(0);
  expect(state.u).toBeLessThanOrEqual(1);
  expect(state.speed).toBeGreaterThanOrEqual(0);
  expect(graph.nodeById.has(state.targetNodeId)).toBe(true);
  const position = positionOf(graph, state);
  expect(Number.isFinite(position.x) && Number.isFinite(position.z)).toBe(true);
}

describe('initialDriveState', () => {
  it('spawns on a real edge, stationary, facing into the world', () => {
    const state = initialDriveState(graph);
    assertOnTheRoad(state);
    expect(state.speed).toBe(0);
    const heading = headingOf(graph, state);
    expect(Math.hypot(heading.x, heading.z)).toBeCloseTo(1, 6);
    // The world runs left to right, so the car sets off in +x.
    expect(heading.x).toBeGreaterThan(0);
  });

  it('starts at the spawn node, not somewhere in the middle', () => {
    const state = initialDriveState(graph);
    const spawn = graph.nodeById.get(graph.spawnNodeId);
    const position = positionOf(graph, state);
    expect(position.x).toBeCloseTo(spawn?.position.x ?? NaN, 3);
  });
});

describe('throttle', () => {
  it('accelerates while held and caps at the maximum', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 5);
    expect(rolling.speed).toBeCloseTo(DEFAULT_DRIVE_OPTIONS.maxSpeed, 3);
  });

  it('coasts to a complete stop when released', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 3);
    expect(rolling.speed).toBeGreaterThan(0);
    const stopped = drive(rolling, COAST, 5);
    expect(stopped.speed).toBe(0);
  });

  it('does not move while stationary', () => {
    const state = initialDriveState(graph);
    const after = drive(state, COAST, 2);
    expect(positionOf(graph, after)).toEqual(positionOf(graph, state));
  });
});

describe('junctions', () => {
  it('carries straight on by default, so holding forward drives the highway', () => {
    let state = initialDriveState(graph);
    const districts = new Set<string>();
    for (let t = 0; t < 10; t += FRAME) {
      state = step(graph, state, HOLD, FRAME);
      districts.add(graph.edgeById.get(state.edgeId)?.district ?? '');
    }
    // Never wandered off the spine, despite passing every junction.
    expect([...districts].filter((d) => d !== 'highway' && d !== '')).toEqual([]);
  });

  it('offers the off-ramp as a branch when approaching a junction', () => {
    let state = initialDriveState(graph);
    let sawChoice = false;
    let sawOffRamp = false;
    for (let t = 0; t < 12; t += FRAME) {
      state = step(graph, state, HOLD, FRAME);
      const options = branchOptions(graph, state);
      if (options.length > 1) sawChoice = true;
      if (options.some((o) => o.district !== 'highway')) sawOffRamp = true;
    }
    expect(sawChoice).toBe(true);
    expect(sawOffRamp).toBe(true);
  });

  it('starts out aimed straight down the highway, not at the first off-ramp', () => {
    const state = initialDriveState(graph);
    const options = branchOptions(graph, state);
    expect(options.length).toBeGreaterThan(1);
    expect(state.choice).toBe(straightAheadIndex(options));
    expect(options[state.choice]?.district).toBe('highway');
  });

  it('orders branches left to right', () => {
    let state = initialDriveState(graph);
    for (let t = 0; t < 12; t += FRAME) {
      state = step(graph, state, HOLD, FRAME);
      const options = branchOptions(graph, state);
      for (let i = 1; i < options.length; i += 1) {
        expect(options[i]?.turn ?? 0).toBeGreaterThanOrEqual(options[i - 1]?.turn ?? 0);
      }
    }
  });

  it('takes the off-ramp when the viewer steers', () => {
    // Drive up to the first junction, then pick the branch that is not the spine.
    let state = initialDriveState(graph);
    let steered = false;

    for (let t = 0; t < 20; t += FRAME) {
      const options = branchOptions(graph, state);
      const spur = options.findIndex((o) => o.district !== 'highway');
      if (!steered && options.length > 1 && spur >= 0) {
        const straight = straightAheadIndex(options);
        const direction = spur > straight ? 1 : -1;
        state = step(graph, state, { throttle: true, steer: direction, flip: false }, FRAME);
        steered = true;
        continue;
      }
      state = step(graph, state, HOLD, FRAME);
      if (steered && graph.edgeById.get(state.edgeId)?.district !== 'highway') break;
    }

    expect(steered).toBe(true);
    expect(graph.edgeById.get(state.edgeId)?.district).not.toBe('highway');
  });

  it('turns around at a cul-de-sac rather than getting stuck', () => {
    const spur = graph.edges.find((e) => e.district === 'lab');
    expect(spur).toBeDefined();
    if (spur === undefined) return;

    const terminus = graph.nodeById.get(spur.toId);
    expect(terminus?.kind).toBe('terminus');

    // Sitting at the dead end, pointing at it.
    const atEnd: DriveState = {
      edgeId: spur.id,
      u: 0.98,
      direction: 1,
      speed: 0,
      targetNodeId: spur.toId,
      choice: 0,
      turning: 0,
    };
    const options = branchOptions(graph, atEnd);
    expect(options).toHaveLength(1);
    expect(options[0]?.edgeId).toBe(spur.id);

    const after = drive(atEnd, HOLD, 2);
    assertOnTheRoad(after);
    expect(after.direction).toBe(-1);
  });
});

describe('turning around', () => {
  it('reverses the direction of travel and aims at the other end', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const edge = graph.edgeById.get(rolling.edgeId);
    expect(edge).toBeDefined();
    if (edge === undefined) return;

    const turned = flipAround(graph, rolling);
    expect(turned.direction).toBe(rolling.direction > 0 ? -1 : 1);
    expect(turned.targetNodeId).not.toBe(rolling.targetNodeId);
    expect(turned.edgeId).toBe(rolling.edgeId);
  });

  it('stops the car rather than lurching backwards at speed', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 3);
    expect(rolling.speed).toBeGreaterThan(0);
    expect(flipAround(graph, rolling).speed).toBe(0);
  });

  it('leaves the car exactly where it stood', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const before = positionOf(graph, rolling);
    const after = positionOf(graph, flipAround(graph, rolling));
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.z).toBeCloseTo(before.z, 6);
  });

  it('points the heading the opposite way', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const before = headingOf(graph, rolling);
    const after = headingOf(graph, flipAround(graph, rolling));
    const dot = before.x * after.x + before.z * after.z;
    expect(dot).toBeLessThan(-0.98);
  });

  it('recomputes the default branch for the junction now ahead', () => {
    // The old choice indexed the branches at the *other* end of the edge.
    // Inheriting it would send the car down an arbitrary turning.
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const turned = flipAround(graph, rolling);
    expect(turned.choice).toBe(straightAheadIndex(branchOptions(graph, turned)));
  });

  it('drives back the way it came after turning', () => {
    let state = drive(initialDriveState(graph), HOLD, 3);
    const wentTo = positionOf(graph, state).x;
    state = drive(flipAround(graph, state), HOLD, 2);
    expect(positionOf(graph, state).x).toBeLessThan(wentTo);
  });

  it('can be done through step(), as one-shot input', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const turned = step(graph, rolling, { throttle: true, steer: 0, flip: true }, FRAME);
    expect(turned.direction).toBe(rolling.direction > 0 ? -1 : 1);
  });

  it('survives being turned around at a cul-de-sac', () => {
    const spur = graph.edges.find((e) => e.district === 'lab');
    if (spur === undefined) return;
    const atEnd: DriveState = {
      edgeId: spur.id, u: 0.99, direction: 1, speed: 0,
      targetNodeId: spur.toId, choice: 0, turning: 0,
    };
    assertOnTheRoad(flipAround(graph, atEnd));
  });
});

describe('the U-turn is a manoeuvre, not a cut', () => {
  const FLIP: DriveInput = { throttle: false, steer: 0, flip: true };

  /** Signed angle between two unit vectors, in radians. */
  function angleBetween(a: { x: number; z: number }, b: { x: number; z: number }): number {
    return Math.abs(Math.atan2(a.x * b.z - a.z * b.x, a.x * b.x + a.z * b.z));
  }

  it('starts a timed turn rather than finishing instantly', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const turned = step(graph, rolling, FLIP, FRAME);
    expect(turned.turning).toBeGreaterThan(0);
    expect(turned.turning).toBeCloseTo(TURN_SECONDS, 6);
  });

  it('shows the old heading at the start of the turn and the new one at the end', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const before = headingOf(graph, rolling);
    const turned = step(graph, rolling, FLIP, FRAME);

    // The graph has already flipped — that part must stay instantaneous.
    expect(angleBetween(headingOf(graph, turned), before)).toBeCloseTo(Math.PI, 3);
    // What the camera sees has not moved yet.
    expect(angleBetween(visualHeadingOf(graph, turned), before)).toBeLessThan(0.1);

    const settled = drive(turned, COAST, TURN_SECONDS + 0.1);
    expect(settled.turning).toBe(0);
    expect(angleBetween(visualHeadingOf(graph, settled), headingOf(graph, settled))).toBe(0);
  });

  it('sweeps through the halfway heading instead of jumping past it', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const before = headingOf(graph, rolling);
    let state = step(graph, rolling, FLIP, FRAME);

    // Half the turn elapsed should be a quarter turn of the visible heading,
    // and it must be a real intermediate angle: a cut would only ever show 0
    // or pi, never anything between.
    state = drive(state, COAST, TURN_SECONDS / 2);
    const swept = angleBetween(visualHeadingOf(graph, state), before);
    expect(swept).toBeGreaterThan(0.2);
    expect(swept).toBeLessThan(Math.PI - 0.2);
  });

  it('always reports a unit heading, mid-turn included', () => {
    let state = step(graph, drive(initialDriveState(graph), HOLD, 2), FLIP, FRAME);
    for (let t = 0; t < TURN_SECONDS + 0.2; t += FRAME) {
      const heading = visualHeadingOf(graph, state);
      expect(Math.hypot(heading.x, heading.z)).toBeCloseTo(1, 6);
      state = step(graph, state, COAST, FRAME);
    }
  });

  it('locks input until the turn is over', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const turned = step(graph, rolling, FLIP, FRAME);
    const parked = positionOf(graph, turned);

    // Throttle held down for most of the turn moves the car nowhere.
    const held = drive(turned, HOLD, TURN_SECONDS * 0.75);
    expect(held.speed).toBe(0);
    expect(Math.hypot(positionOf(graph, held).x - parked.x, positionOf(graph, held).z - parked.z))
      .toBeLessThan(1e-6);

    // And the same throttle works again the moment the turn finishes.
    const released = drive(held, HOLD, 0.5);
    expect(released.speed).toBeGreaterThan(0);
  });

  it('ignores a second flip during the first', () => {
    const rolling = drive(initialDriveState(graph), HOLD, 2);
    const turned = step(graph, rolling, FLIP, FRAME);
    const again = step(graph, turned, FLIP, FRAME);
    // Cancelling a U-turn halfway would leave the car facing the way it
    // started with the camera mid-sweep, which is the glitch this replaced.
    expect(again.direction).toBe(turned.direction);
    expect(again.turning).toBeLessThan(turned.turning);
  });

  it('ignores steering during the turn', () => {
    const approaching = drive(initialDriveState(graph), HOLD, 2);
    const turned = step(graph, approaching, FLIP, FRAME);
    const steered = step(graph, turned, { throttle: false, steer: 1, flip: false }, FRAME);
    expect(steered.choice).toBe(turned.choice);
  });
});

describe('the car cannot leave the road', () => {
  it('survives sustained random input without ever leaving the graph', () => {
    // Deterministic pseudo-random so a failure is reproducible.
    let seed = 1337;
    const random = (): number => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };

    let state = initialDriveState(graph);
    for (let frame = 0; frame < 20000; frame += 1) {
      const roll = random();
      const input: DriveInput = {
        throttle: roll > 0.2,
        steer: roll > 0.95 ? 1 : roll < 0.05 ? -1 : 0,
        flip: roll > 0.49 && roll < 0.495,
      };
      state = step(graph, state, input, FRAME);
      assertOnTheRoad(state);
    }
  });

  it('does not tunnel through short stretches of road at full speed', () => {
    const shortest = [...graph.edges].sort((a, b) => a.length - b.length)[0];
    expect(shortest).toBeDefined();
    if (shortest === undefined) return;
    // One frame of travel at full speed, against the shortest edge in the world.
    expect(DEFAULT_DRIVE_OPTIONS.maxSpeed * FRAME).toBeLessThan(shortest.length);

    // And a deliberately enormous timestep still lands somewhere legal.
    const lurched = step(graph, initialDriveState(graph), HOLD, 5);
    assertOnTheRoad(lurched);
  });

  it('keeps every node reachable by driving, from a standing start', () => {
    // Breadth-first over the graph proves connectivity; this proves the *driver*
    // can actually realise it, choosing branches frame by frame.
    const reached = new Set<string>();
    let state = initialDriveState(graph);

    for (let frame = 0; frame < 60000 && reached.size < graph.nodes.length; frame += 1) {
      const options = branchOptions(graph, state);
      const unvisited = options.findIndex((option) => {
        const edge = graph.edgeById.get(option.edgeId);
        return edge !== undefined && !reached.has(otherEnd(edge, state.targetNodeId));
      });
      const steer = unvisited > state.choice ? 1 : unvisited < state.choice && unvisited >= 0 ? -1 : 0;
      state = step(graph, state, { throttle: true, steer, flip: false }, FRAME);
      reached.add(state.targetNodeId);
    }

    const missed = graph.nodes.filter((n) => !reached.has(n.id) && n.id !== graph.spawnNodeId);
    expect(missed.map((n) => n.id)).toEqual([]);
  });
});

describe('pace', () => {
  it('reports how long the world takes to cross end to end', () => {
    let state = initialDriveState(graph);
    const fog = graph.nodeById.get('terminus-fog');
    let seconds = 0;
    while (seconds < 60) {
      state = step(graph, state, HOLD, FRAME);
      seconds += FRAME;
      if (Math.abs(positionOf(graph, state).x - (fog?.position.x ?? 0)) < 5) break;
    }
    // Not a spec budget — a recorded measurement, so a change in world scale or
    // top speed shows up here instead of being discovered by feel.
    expect(seconds).toBeLessThan(20);
    console.log(`\n  spawn to fog: ${seconds.toFixed(1)}s of held throttle at ${DEFAULT_DRIVE_OPTIONS.maxSpeed} u/s\n`);
  });
});
