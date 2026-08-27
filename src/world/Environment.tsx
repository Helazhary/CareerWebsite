'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import * as THREE from 'three';
import { makeDesertMask, makeDesertTexture, makeGroundTexture } from './textures';
import { SUN_DIRECTION, WORLD_COLORS } from './palette';

/**
 * Sky, ground and the far horizon.
 *
 * These three together are what stop the world reading as objects floating in a
 * void. A flat background colour, a flat ground colour and nothing in the
 * distance is the signature of a render rather than a place, no matter how good
 * the buildings are.
 */

const GROUND_SIZE = 7000;
const SKY_RADIUS = 2600;
/**
 * How far out the skyline stands.
 *
 * Pushed from 1750 because the pyramids stopped being backdrop and became
 * things in the world. The ridge travels with the camera and the pyramids do
 * not, so any ridge nearer than the furthest pyramid is a wall that the pyramid
 * crosses as you drive — it pops out from behind a hill that is not there. Both
 * ranges now stand beyond the furthest a pyramid can ever be from the car,
 * which is about 2100 units, from the garage to the far one.
 *
 * Heights below are scaled with it so the skyline subtends what it always did.
 */
const HORIZON_RADIUS = 2400;

/**
 * The sky: a dome coloured per vertex.
 *
 * It was a gradient texture, which produced a dark dome hanging over the middle
 * of the view — hard-edged, following the sphere's triangles, and raycasting
 * against nothing because there was nothing there. A tall narrow gradient
 * stretched over a sphere is a bad case for texture sampling, and chasing the
 * sampler was not worth it when the gradient can simply be baked into the
 * geometry. Vertex colours interpolate smoothly, have no mip chain, no wrap
 * mode and no seam.
 */
/**
 * Two gradients: the sky facing the sun, and the sky with its back to it.
 *
 * A single gradient painted the same warm band right around the horizon, so
 * there was nowhere the sun actually was and the whole thing read as haze
 * rather than as a sunset. The warm band was also far too narrow — about eight
 * degrees of elevation — so even facing it there was almost nothing to see.
 */
const SKY_SUNWARD: readonly (readonly [number, string])[] = [
  [0.0, '#241a14'],
  [0.42, '#4a2f1f'],
  [0.47, '#8a4a24'],
  [0.5, '#ff9d44'],
  [0.53, '#f08040'],
  [0.58, '#c25f42'],
  [0.65, '#7c4a55'],
  [0.74, '#3f3a5c'],
  [0.86, '#1b2340'],
  [1.0, '#080d18'],
];

const SKY_AWAY: readonly (readonly [number, string])[] = [
  [0.0, '#12151a'],
  [0.42, '#1d2029'],
  [0.48, '#33384a'],
  [0.5, '#4a4a63'],
  [0.56, '#3b3f5c'],
  [0.66, '#252d4c'],
  [0.8, '#141c33'],
  [1.0, '#070b14'],
];

function sampleStops(
  stops: readonly (readonly [number, string])[],
  t: number,
  out: THREE.Color,
): THREE.Color {
  for (let i = 1; i < stops.length; i += 1) {
    const next = stops[i] ?? stops[stops.length - 1];
    const previous = stops[i - 1];
    if (next === undefined || previous === undefined) break;
    if (t <= next[0]) {
      const span = next[0] - previous[0];
      const k = span === 0 ? 0 : (t - previous[0]) / span;
      return out.set(previous[1]).lerp(new THREE.Color(next[1]), k);
    }
  }
  const last = stops[stops.length - 1];
  return out.set(last === undefined ? '#000000' : last[1]);
}

function Sky(): React.JSX.Element {
  const geometry = useMemo(() => {
    const sphere = new THREE.SphereGeometry(SKY_RADIUS, 48, 32);
    const position = sphere.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const swatch = new THREE.Color();

    const away = new THREE.Color();
    const sunLength = Math.hypot(SUN_DIRECTION.x, SUN_DIRECTION.z) || 1;

    for (let i = 0; i < position.count; i += 1) {
      // 0 straight down, 0.5 at the horizon, 1 at the zenith.
      const t = (position.getY(i) / SKY_RADIUS + 1) / 2;

      // How much this part of the sky faces the sun. Squared so the glow
      // concentrates into one quarter of the sky rather than smearing evenly.
      const hx = position.getX(i);
      const hz = position.getZ(i);
      const hLength = Math.hypot(hx, hz) || 1;
      const facing =
        ((hx / hLength) * SUN_DIRECTION.x + (hz / hLength) * SUN_DIRECTION.z) / sunLength;
      const glow = Math.max(0, facing) ** 1.6;

      sampleStops(SKY_SUNWARD, t, swatch);
      sampleStops(SKY_AWAY, t, away);
      swatch.lerp(away, 1 - glow);
      colors[i * 3] = swatch.r;
      colors[i * 3 + 1] = swatch.g;
      colors[i * 3 + 2] = swatch.b;
    }

    sphere.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    return sphere;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={-1}>
      <meshBasicMaterial vertexColors side={THREE.BackSide} fog={false} depthWrite={false} />
    </mesh>
  );
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A ridge of distant hills all the way round.
 *
 * Cheap — one geometry, a few hundred triangles, no shadows, no detail. It does
 * more for the sense of being somewhere than anything else in this file,
 * because it gives the eye a distance to measure everything else against.
 */
function Horizon(): React.JSX.Element {
  const geometry = useMemo(() => {
    const random = mulberry32(4242);
    const segments = 128;
    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    // The ridge is a wall, and with fog disabled the whole wall renders — not
    // just the peaks. Unfogged it reads as a dark band across the sky. Fading
    // each column from the fog colour at its base to the ridge colour at its
    // top makes the bottom disappear into the haze, leaving a skyline.
    const base = new THREE.Color(WORLD_COLORS.fog);
    const peak = new THREE.Color(WORLD_COLORS.horizon);

    // Two overlapping ranges, the far one taller and hazier, so the skyline has
    // depth instead of being one cut-out.
    for (const [radius, floor, variance, blend] of [
      [HORIZON_RADIUS, 55, 165, 0.0],
      // 0.92 rather than 0.78: the near range has to clear the pyramids too,
      // and two ranges 190 apart still read as two.
      [HORIZON_RADIUS * 0.92, 30, 96, 0.35],
    ] as const) {
      const start = positions.length / 3;
      // The nearer range sits slightly hazier, so the two read as different
      // distances rather than as one cut-out.
      const top = peak.clone().lerp(base, blend);
      for (let i = 0; i <= segments; i += 1) {
        const angle = (i / segments) * Math.PI * 2;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        // Layered waves rather than pure noise: real ridgelines have long
        // shapes with smaller peaks riding on them.
        const height =
          floor +
          Math.abs(Math.sin(angle * 2.3 + 0.7)) * variance * 0.55 +
          Math.abs(Math.sin(angle * 5.1 + 2.1)) * variance * 0.3 +
          random() * variance * 0.18;
        positions.push(x, -8, z, x, height, z);
        colors.push(base.r, base.g, base.b, top.r, top.g, top.b);
        if (i < segments) {
          const a = start + i * 2;
          indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
        }
      }
    }

    const result = new THREE.BufferGeometry();
    result.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    result.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    result.setIndex(indices);
    result.computeVertexNormals();
    return result;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} renderOrder={-1}>
      <meshBasicMaterial vertexColors side={THREE.DoubleSide} fog={false} />
    </mesh>
  );
}

/**
 * Desert, laid over the grass and faded in with distance.
 *
 * Cairo is where this career happened, and the pyramids are the thing you can
 * see from the edge of it. Unfogged, like the ridge, so they stay a clean
 * silhouette instead of being washed halfway to the fog colour — which is what
 * would happen to anything else standing where they now stand.
 */
function Desert(): React.JSX.Element | null {
  const sand = useMemo(() => {
    const map = makeDesertTexture();
    if (map !== null) map.repeat.set(GROUND_SIZE / 90, GROUND_SIZE / 90);
    return map;
  }, []);
  // Fractions of the plane, which is 7000 across and centred at x=350.
  //
  // Tied to the road rather than picked: the last junction stands at x=1056,
  // which is 706 units from the centre of this plane, so grass holds to 0.10
  // and the sand comes in over the next 300. Green covers exactly the part of
  // the world that has roads in it and the desert starts where they stop —
  // which is the whole reason the far end of the highway is worth driving to,
  // and it puts the pyramids in sand rather than on a lawn.
  //
  // Do not push the clear radius much below 0.10. The plane is centred near the
  // middle of the built world, so a smaller circle starts laying sand under the
  // buildings and the green stops reading as a contrast at all.
  const mask = useMemo(() => makeDesertMask(256, 0.101, 0.143), []);

  useEffect(
    () => () => {
      sand?.dispose();
      mask?.dispose();
    },
    [sand, mask],
  );

  if (sand === null || mask === null) return null;

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[350, 0.02, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial map={sand} alphaMap={mask} transparent roughness={1} metalness={0} />
    </mesh>
  );
}

/**
 * Three of them, standing in the desert past the end of the road.
 *
 * They were backdrop until now: carried with the camera so they never came any
 * closer, unfogged, and painted almost black to read as a silhouette against
 * the sunset. That bought visibility at the cost of being scenery you could
 * never arrive at, and at dusk it did not even buy much of that.
 *
 * They are objects now. Fixed in the world east of the last junction, the
 * colour of the stone, and lit by the same sun as everything else — which
 * works because the sun is *behind* the viewer on the drive out, so the faces
 * you see are the lit ones. The road ends, the grass runs out, and there is
 * something standing in the sand at the end of it.
 *
 * Distance is set by apparent size, not by where there was room. Placed at the
 * first plausible spot — 250 units past the last junction — a 200-unit pyramid
 * subtends nearly 40° and fills the sky like a wall, which reads as a bug
 * rather than as a monument. Giza from the edge of Cairo is a few degrees. At
 * 700-900 units out and 140-150 tall these come in around 9-12°: unmistakably
 * the thing at the end of the road, and still recognisably a building.
 *
 * The skyline was moved out to 2400 to make room. See `HORIZON_RADIUS`.
 */

/**
 * A cone's `size` is the circumradius of its square base — the half-*diagonal*,
 * not the half-width. 1.13x the height puts the faces at roughly the slope of
 * the real thing.
 */
const BASE_TO_HEIGHT = 1.13;
/**
 * Sunk a little, so the bases sit in the sand rather than resting on it.
 *
 * Small now that they hold still. It used to be 14, because the group rode with
 * the camera and a base above y=0 skimmed across the ground as you drove.
 */
const BURIED = 3;

function Pyramids(): React.JSX.Element {
  const shapes = useMemo(
    () =>
      // World coordinates, out past the end of the road at x=1056. Heights are
      // near enough the real ones — the Great Pyramid is about 140 tall to its
      // 230 of base — so the proportions are Giza's and only the distance is a
      // decision.
      //
      // Spread across three bearings and three distances so the group has depth
      // from the road rather than standing in a line, with the small one nearest
      // so its size is legible against the other two.
      [
        { x: 1780, z: -150, height: 150 },
        { x: 1960, z: 130, height: 140 },
        { x: 1690, z: 265, height: 72 },
      ] as const,
    [],
  );

  return (
    <group>
      {shapes.map((shape) => (
        <mesh
          key={`${shape.x}:${shape.z}`}
          position={[shape.x, shape.height / 2 - BURIED, shape.z]}
          rotation={[0, Math.PI / 4, 0]}
        >
          {/* A four-sided cone is a pyramid, and costs eight triangles. */}
          <coneGeometry args={[shape.height * BASE_TO_HEIGHT, shape.height, 4]} />
          {/* Lit and flat-shaded, so two faces of every one of them catch the
              sun differently and they read as solid. Still unfogged: they stand
              beyond the 1450 fog distance from the western half of the road,
              and fog there would erase the thing you are driving towards. */}
          <meshStandardMaterial
            color={WORLD_COLORS.pyramid}
            roughness={1}
            metalness={0}
            flatShading
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function Ground(): React.JSX.Element {
  const texture = useMemo(() => {
    const map = makeGroundTexture();
    if (map !== null) map.repeat.set(GROUND_SIZE / 26, GROUND_SIZE / 26);
    return map;
  }, []);
  useEffect(() => () => texture?.dispose(), [texture]);

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[GROUND_SIZE, GROUND_SIZE]} />
      <meshStandardMaterial
        map={texture}
        color={texture === null ? WORLD_COLORS.ground : '#ffffff'}
        roughness={1}
        metalness={0}
      />
    </mesh>
  );
}

/**
 * Everything that must always be far away.
 *
 * The sky, the hills and the pyramids were centred on the world origin while
 * the world runs to about x=1300 — so driving east brought you to within 65
 * units of a 170-unit ridge, and the "distant" hills reared up as a wall across
 * the sky. Carrying them with the camera keeps their distance constant, which
 * is the whole idea of a backdrop.
 *
 * Ground and desert stay put: they are terrain, and terrain you can drive
 * across has to hold still.
 */
function Distant({ children }: { children: React.ReactNode }): React.JSX.Element {
  const group = useRef<Group>(null);

  useFrame(({ camera }) => {
    group.current?.position.set(camera.position.x, 0, camera.position.z);
  });

  return <group ref={group}>{children}</group>;
}

export function Environment(): React.JSX.Element {
  return (
    <group>
      <Distant>
        <Sky />
        <Horizon />
      </Distant>
      <Ground />
      <Desert />
      {/* Not `Distant`. They stand in the world at the end of the road, and the
          whole point is that driving towards them brings you closer. */}
      <Pyramids />
    </group>
  );
}
