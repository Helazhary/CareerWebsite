/**
 * Pure driving state. No `three`, no `react`, no DOM.
 *
 * The car is constrained to the spline and does not steer (DESIGN.md §2.1).
 * Holding the throttle advances it along the current edge; releasing coasts to
 * a stop. The only navigation input is which branch to take at a junction, and
 * the default is always "carry straight on" — so holding forward drives the
 * whole highway without a single decision, and the off-ramps are opt-in.
 *
 * Keeping this pure is what lets the promise "the viewer can never get lost or
 * stuck" be a test rather than a hope: `tests/world-drive.test.ts` fuzzes tens
 * of thousands of frames of random input and asserts the car is still on a real
 * edge afterwards.
 */

import {
  type GraphEdge,
  type RoadAnchor,
  type RoadGraph,
  type Vec2,
  branchesFrom,
  otherEnd,
  sampleEdge,
  tangentAt,
} from './graph';

export interface DriveState {
  readonly edgeId: string;
  /** Parameter along the edge, always within 0..1. */
  readonly u: number;
  /** Which way along the edge parameter the car is travelling. */
  readonly direction: 1 | -1;
  /** World units per second. */
  readonly speed: number;
  /** Node the car is currently heading toward. */
  readonly targetNodeId: string;
  /** Index into `branchOptions`, chosen by the viewer. */
  readonly choice: number;
  /**
   * Seconds left of a U-turn. Zero for all but the moment after a flip.
   *
   * The car's graph state flips instantly — it must, or its position on the
   * spline stops being exact — but the *heading you see* sweeps round over this
   * countdown, and input is locked until it reaches zero. See `flipAround`.
   */
  readonly turning: number;
}

export interface DriveInput {
  /** Held, not tapped. */
  readonly throttle: boolean;
  /** One-shot: -1 steers the choice left, +1 right, 0 leaves it alone. */
  readonly steer: -1 | 0 | 1;
  /** One-shot: turn the car around where it stands. */
  readonly flip: boolean;
}

export interface DriveOptions {
  readonly maxSpeed: number;
  readonly acceleration: number;
  /** Coasting deceleration when the throttle is released. */
  readonly deceleration: number;
}

export const DEFAULT_DRIVE_OPTIONS: DriveOptions = {
  maxSpeed: 90,
  acceleration: 70,
  deceleration: 50,
};

/** Which way a branch turns relative to the way the car is facing. */
export interface BranchOption {
  readonly edgeId: string;
  readonly district: GraphEdge['district'];
  /** +1 through -1: how closely this branch continues the current heading. */
  readonly alignment: number;
  /** Signed turn. Negative is left, positive is right. */
  readonly turn: number;
}

function approach(current: number, target: number, maxDelta: number): number {
  if (current < target) return Math.min(current + maxDelta, target);
  return Math.max(current - maxDelta, target);
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high);
}

/**
 * How long a U-turn takes.
 *
 * Long enough to read as a manoeuvre, short enough that nobody waits for it.
 * Input is locked for exactly this long, so it is also how long the viewer is
 * not in control — which is the reason it is not a second and a half.
 */
export const TURN_SECONDS = 0.8;

/**
 * The most simulated time one frame may advance.
 *
 * A frame longer than this is a tab that was backgrounded, not a slow frame.
 * **Everything that animates has to use the same clamp**, or they come apart on
 * a slow machine: the U-turn countdown is clamped and the camera's damping was
 * not, so at ten frames a second the camera finished its 180° swing in three
 * frames while the turn still had six-tenths of a second to run. It looked
 * exactly like the cut this was built to replace.
 */
export const MAX_FRAME_SECONDS = 0.05;

/** Unit heading of the car, in world space. */
export function headingOf(graph: RoadGraph, state: DriveState): Vec2 {
  const edge = graph.edgeById.get(state.edgeId);
  if (edge === undefined) return { x: 1, z: 0 };
  const tangent = tangentAt(edge, state.u);
  return { x: tangent.x * state.direction, z: tangent.z * state.direction };
}

/**
 * Heading as the camera and the car body should *show* it.
 *
 * Mid-U-turn this sweeps from the old heading to the new one; the rest of the
 * time it is exactly `headingOf`. Everything that reasons about the graph —
 * proximity, junctions, the map's sense of where you are going — uses
 * `headingOf`, because the flip is instantaneous as far as the road network is
 * concerned. Only the presentation lags behind it.
 */
export function visualHeadingOf(graph: RoadGraph, state: DriveState): Vec2 {
  const heading = headingOf(graph, state);
  if (state.turning <= 0) return heading;

  // At `turning === TURN_SECONDS` this is a half turn, which lands exactly on
  // the heading the car had before the flip. At zero it is the identity.
  const angle = (Math.min(state.turning, TURN_SECONDS) / TURN_SECONDS) * Math.PI;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return { x: heading.x * cos - heading.z * sin, z: heading.x * sin + heading.z * cos };
}

/** World position of the car. */
export function positionOf(graph: RoadGraph, state: DriveState): Vec2 {
  const edge = graph.edgeById.get(state.edgeId);
  if (edge === undefined) return { x: 0, z: 0 };
  return sampleEdge(edge, state.u);
}

/** The direction you would set off in, taking `edge` away from `nodeId`. */
function departureHeading(edge: GraphEdge, nodeId: string): Vec2 {
  if (edge.fromId === nodeId) return tangentAt(edge, 0);
  const tangent = tangentAt(edge, 1);
  return { x: -tangent.x, z: -tangent.z };
}

/**
 * Branches available at the node the car is approaching, ordered left to right
 * so the HUD can lay them out the way they appear through the windscreen.
 */
export function branchOptions(graph: RoadGraph, state: DriveState): BranchOption[] {
  const heading = headingOf(graph, state);
  const branches = branchesFrom(graph, state.targetNodeId, state.edgeId);

  // A cul-de-sac has nowhere to go but back. Offer the U-turn rather than
  // letting the car arrive somewhere it cannot leave.
  const usable =
    branches.length > 0
      ? branches
      : branchesFrom(graph, state.targetNodeId).filter((edge) => edge.id === state.edgeId);

  return usable
    .map((edge) => {
      const departure = departureHeading(edge, state.targetNodeId);
      return {
        edgeId: edge.id,
        district: edge.district,
        alignment: heading.x * departure.x + heading.z * departure.z,
        turn: heading.x * departure.z - heading.z * departure.x,
      };
    })
    .sort((a, b) => a.turn - b.turn || a.edgeId.localeCompare(b.edgeId));
}

/** Index of the branch that carries straight on. The default, always. */
export function straightAheadIndex(options: readonly BranchOption[]): number {
  let best = 0;
  let bestAlignment = Number.NEGATIVE_INFINITY;
  options.forEach((option, index) => {
    if (option.alignment > bestAlignment) {
      bestAlignment = option.alignment;
      best = index;
    }
  });
  return best;
}

/**
 * Turn the car around on the spot.
 *
 * Chosen over a true reverse gear because the camera is a fixed chase camera:
 * reversing would mean driving backwards with the view pointing the way you
 * came, which is disorienting for no gain. Flipping keeps the road ahead in
 * shot and needs no new controls.
 *
 * Speed drops to zero so a flip at pace is a stop and a turn, not a lurch
 * backwards at 90 units a second.
 *
 * The direction change is instantaneous and stays that way: the car's place on
 * the spline has to be exact every frame or the invariants in this file stop
 * meaning anything. What was abrupt was never the model — it was that the
 * camera read the new heading on the very next frame and cut to the far side of
 * the car. `turning` gives the presentation something to interpolate over, and
 * locks input while it does, so a flip is a manoeuvre you watch rather than a
 * jump you notice.
 */
export function flipAround(graph: RoadGraph, state: DriveState): DriveState {
  const edge = graph.edgeById.get(state.edgeId);
  if (edge === undefined) return state;

  const direction: 1 | -1 = state.direction > 0 ? -1 : 1;
  const turned: DriveState = {
    ...state,
    direction,
    speed: 0,
    targetNodeId: direction > 0 ? edge.toId : edge.fromId,
    choice: 0,
    turning: TURN_SECONDS,
  };
  // The junction ahead is a different junction now, so the default branch has
  // to be recomputed or the car inherits a choice meant for the other end.
  return { ...turned, choice: straightAheadIndex(branchOptions(graph, turned)) };
}

/** Put the car at the start of the world, facing down the road. */
export function initialDriveState(graph: RoadGraph): DriveState {
  const spawn = graph.nodeById.get(graph.spawnNodeId);
  const firstEdgeId = spawn?.edgeIds[0];
  const edge = firstEdgeId === undefined ? graph.edges[0] : graph.edgeById.get(firstEdgeId);

  if (edge === undefined) {
    throw new Error('Cannot spawn a car into a world with no roads');
  }

  const forward = edge.fromId === graph.spawnNodeId;
  const spawned: DriveState = {
    edgeId: edge.id,
    u: forward ? 0 : 1,
    direction: forward ? 1 : -1,
    speed: 0,
    targetNodeId: forward ? edge.toId : edge.fromId,
    choice: 0,
    turning: 0,
  };

  // Index 0 is the *leftmost* branch, not the straight-ahead one. Without this
  // the car takes the first off-ramp it meets, which turns the opening drive
  // into a decision the viewer never asked to make.
  return { ...spawned, choice: straightAheadIndex(branchOptions(graph, spawned)) };
}

/**
 * Put the car outside a given building, stationary and pointing down its road.
 *
 * This is what a minimap click resolves to. The world is ~18 seconds end to end
 * at full throttle, so a click is not a shortcut for impatience — it is the
 * difference between the map being explorable and being a corridor.
 */
export function stateAtAnchor(graph: RoadGraph, anchor: RoadAnchor): DriveState {
  const edge = graph.edgeById.get(anchor.edgeId);
  if (edge === undefined) return initialDriveState(graph);

  const arrived: DriveState = {
    edgeId: edge.id,
    u: anchor.u,
    direction: 1,
    speed: 0,
    targetNodeId: edge.toId,
    choice: 0,
    turning: 0,
  };
  return { ...arrived, choice: straightAheadIndex(branchOptions(graph, arrived)) };
}

/** Guard against a pathological frame consuming the whole world. */
const MAX_TRANSITIONS_PER_STEP = 8;

/**
 * Advance the car by `dt` seconds.
 *
 * Distance is consumed in a loop rather than a single interpolation, because
 * short connecting stretches of highway are shorter than one frame of travel at
 * full speed — without the loop the car would tunnel straight through a
 * junction and out the far side of the map.
 */
export function step(
  graph: RoadGraph,
  state: DriveState,
  input: DriveInput,
  dt: number,
  options: DriveOptions = DEFAULT_DRIVE_OPTIONS,
): DriveState {
  const edge = graph.edgeById.get(state.edgeId);
  if (edge === undefined || dt <= 0) return state;

  // Mid-U-turn the viewer is a passenger: no throttle, no steering, and no
  // second flip to cancel the first. The countdown is the only thing running.
  const midTurn = state.turning > 0;
  const turning = Math.max(0, state.turning - dt);

  const throttle = midTurn ? false : input.throttle;
  const target = throttle ? options.maxSpeed : 0;
  const rate = throttle ? options.acceleration : options.deceleration;
  const speed = approach(state.speed, target, rate * dt);

  let current: DriveState =
    !midTurn && input.flip ? flipAround(graph, state) : { ...state, speed, turning };

  if (!midTurn && input.steer !== 0) {
    const available = branchOptions(graph, current);
    current = { ...current, choice: clamp(current.choice + input.steer, 0, available.length - 1) };
  }

  // Read from the state rather than the local: a flip zeroes the speed, and
  // taking the pre-flip value here moved the car a frame *after* stopping it.
  let remaining = current.speed * dt;
  let transitions = 0;

  while (remaining > 0 && transitions < MAX_TRANSITIONS_PER_STEP) {
    const active = graph.edgeById.get(current.edgeId);
    if (active === undefined) break;

    const length = Math.max(active.length, 1e-6);
    const toGo = current.direction > 0 ? (1 - current.u) * length : current.u * length;

    if (remaining < toGo) {
      const du = (remaining / length) * current.direction;
      current = { ...current, u: clamp(current.u + du, 0, 1) };
      break;
    }

    // Reached the node. Take the chosen branch and carry the leftover distance
    // onto it, so speed is continuous across a junction.
    remaining -= toGo;
    transitions += 1;

    const arrivedAt = current.targetNodeId;
    const atNode: DriveState = {
      ...current,
      u: current.direction > 0 ? 1 : 0,
    };

    const available = branchOptions(graph, atNode);
    const fallback = straightAheadIndex(available);
    const picked = available[clamp(atNode.choice, 0, Math.max(available.length - 1, 0))] ?? available[fallback];
    const nextEdge = picked === undefined ? undefined : graph.edgeById.get(picked.edgeId);

    if (nextEdge === undefined) {
      current = { ...atNode, speed: 0 };
      break;
    }

    const forward = nextEdge.fromId === arrivedAt;
    const nextTarget = otherEnd(nextEdge, arrivedAt);
    const entered: DriveState = {
      edgeId: nextEdge.id,
      u: forward ? 0 : 1,
      direction: forward ? 1 : -1,
      speed: current.speed,
      targetNodeId: nextTarget,
      choice: 0,
      turning: current.turning,
    };

    // Reset the choice to "straight on" for the junction now ahead.
    const upcoming = branchOptions(graph, entered);
    current = { ...entered, choice: straightAheadIndex(upcoming) };
  }

  return current;
}
