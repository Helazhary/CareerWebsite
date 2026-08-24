'use client';

import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import type { Group } from 'three';
import * as THREE from 'three';
import { makeDesertMask, makeDesertTexture, makeGroundTexture } from './textures';
import { WORLD_COLORS } from './palette';

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
const SKY_STOPS: readonly (readonly [number, string])[] = [
  [0.0, '#14161a'],
  [0.42, '#2a2620'],
  [0.48, '#7c5238'],
  [0.5, '#d99257'],
  [0.505, '#c07a4a'],
  [0.525, '#7a5a56'],
  [0.56, '#3a3b52'],
  [0.64, '#1b2740'],
  [0.78, '#0e1626'],
  [1.0, '#070b14'],
];

function skyColourAt(t: number, out: THREE.Color): THREE.Color {
  for (let i = 1; i < SKY_STOPS.length; i += 1) {
    const [t1, c1] = SKY_STOPS[i] ?? SKY_STOPS[SKY_STOPS.length - 1]!;
    const [t0, c0] = SKY_STOPS[i - 1]!;
    if (t <= t1) {
      const span = t1 - t0;
      const k = span === 0 ? 0 : (t - t0) / span;
      return out.set(c0).lerp(new THREE.Color(c1), k);
    }
  }
  return out.set(SKY_STOPS[SKY_STOPS.length - 1]![1]);
}

function Sky(): React.JSX.Element {
  const geometry = useMemo(() => {
    const sphere = new THREE.SphereGeometry(SKY_RADIUS, 48, 32);
    const position = sphere.getAttribute('position');
    const colors = new Float32Array(position.count * 3);
    const swatch = new THREE.Color();

    for (let i = 0; i < position.count; i += 1) {
      // 0 straight down, 0.5 at the horizon, 1 at the zenith.
      const t = (position.getY(i) / SKY_RADIUS + 1) / 2;
      skyColourAt(t, swatch);
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

/** Three of them, as seen from the city: two large, one small, off to one side. */
function Pyramids(): React.JSX.Element {
  const shapes = useMemo(
    () =>
      // Beyond the ring of hills and tall enough to stand above them. Placed
      // any nearer they stop being landmarks and become large objects in the
      // next field, which is exactly how the first attempt looked.
      // At a fixed offset from the camera, so whatever reads well here reads
      // well everywhere. Sized to stand above the ridge line without dominating
      // it — roughly 90px tall at this distance and field of view.
      [
        { x: 1750, z: -1150, size: 235, height: 205 },
        { x: 2010, z: -960, size: 190, height: 168 },
        { x: 2170, z: -845, size: 108, height: 96 },
      ] as const,
    [],
  );

  return (
    <group>
      {shapes.map((shape) => (
        <mesh
          key={`${shape.x}:${shape.z}`}
          position={[shape.x, shape.height / 2 - 14, shape.z]}
          rotation={[0, Math.PI / 4, 0]}
        >
          {/* A four-sided cone is a pyramid, and costs eight triangles. */}
          <coneGeometry args={[shape.size, shape.height, 4]} />
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
