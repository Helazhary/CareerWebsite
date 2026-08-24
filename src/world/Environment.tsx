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
const HORIZON_RADIUS = 1750;

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
      [HORIZON_RADIUS, 40, 120, 0.0],
      [HORIZON_RADIUS * 0.78, 22, 70, 0.35],
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
 * see from the edge of it. Placed far out and unfogged so they read as
 * genuinely distant rather than as scenery you could drive to.
 */
function Desert(): React.JSX.Element | null {
  const sand = useMemo(() => {
    const map = makeDesertTexture();
    if (map !== null) map.repeat.set(GROUND_SIZE / 90, GROUND_SIZE / 90);
    return map;
  }, []);
  // Fractions of the plane, which is 7000 across. Grass holds for roughly 700
  // units — well past every road — then gives way to sand by about 1500, which
  // is inside the fog distance and therefore actually visible. The defaults
  // put the transition 2100 units out, where nothing can be seen.
  const mask = useMemo(() => makeDesertMask(256, 0.1, 0.22), []);

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
 * Three of them, as seen from Cairo: two large, one small, off to one side.
 *
 * **Sunward, and deliberately.** They used to sit opposite the sun, where a
 * dark silhouette against a dark sky is not a silhouette at all — the largest
 * read as a faint smudge and the other two were never visible from anywhere,
 * because their apexes sat *below* the ridge line. Giza is west of Cairo and
 * you see it against the sunset. So does this.
 *
 * Placed by bearing off the sun rather than in absolute coordinates, so the
 * cluster follows if the sun ever moves — the same reason `Sun.tsx` derives its
 * offset from `SUN_DIRECTION`.
 */
const SUN_BEARING = Math.atan2(SUN_DIRECTION.z, SUN_DIRECTION.x);

/**
 * Bearing measured off the sun, positive towards the westward run of the road.
 *
 * The cluster has to satisfy two things at once and there is only a narrow
 * window that does both. It must sit inside the warm band, or the silhouettes
 * have nothing to be silhouettes against — and it must fall within about 38° of
 * the heading you actually drive, or you never see it without dragging to look
 * around. Placed purely by prettiness it lands 50° off-axis, which is exactly
 * where the first attempt at this ended up.
 */
function placeBySun(degreesOffSun: number, distance: number): { x: number; z: number } {
  const bearing = SUN_BEARING + (degreesOffSun * Math.PI) / 180;
  return { x: Math.cos(bearing) * distance, z: Math.sin(bearing) * distance };
}

/**
 * A cone's `size` is the circumradius of its square base — the half-*diagonal*,
 * not the half-width. 1.13x the height puts the faces at roughly the slope of
 * the real thing.
 */
const BASE_TO_HEIGHT = 1.13;
/** Sunk slightly, so the bases meet the ridge instead of hovering over it. */
const BURIED = 14;

function Pyramids(): React.JSX.Element {
  const shapes = useMemo(
    () =>
      // Each height is set against the ridge at that particular bearing, which
      // runs between 2.5° and 4.5° of elevation across this window. The large
      // pair stand 7° and 6.3° up, the small one 4°. Anything shorter than the
      // ridge beneath it is simply not in the scene however carefully it is
      // placed, which is what happened to two of the previous three — so the
      // small one takes the bearing where the ridge runs lowest.
      [
        { ...placeBySun(3, 1950), height: 150 },
        { ...placeBySun(9, 2000), height: 262 },
        { ...placeBySun(17, 2150), height: 252 },
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
          {/* Unfogged, like the hills. At this distance fog would erase them
              entirely; a flat silhouette against the sunset is the point. */}
          <meshBasicMaterial color={WORLD_COLORS.pyramid} fog={false} />
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
        <Pyramids />
      </Distant>
      <Ground />
      <Desert />
    </group>
  );
}
