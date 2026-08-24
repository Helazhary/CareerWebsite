'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { makeGroundTexture, makeSkyTexture } from './textures';
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

/** A dome, unfogged, so the gradient stays a sky rather than washing to grey. */
function Sky(): React.JSX.Element | null {
  const texture = useMemo(() => makeSkyTexture(), []);
  useEffect(() => () => texture?.dispose(), [texture]);
  if (texture === null) return null;

  return (
    <mesh scale={[1, 1, 1]} renderOrder={-1}>
      <sphereGeometry args={[SKY_RADIUS, 24, 16]} />
      <meshBasicMaterial map={texture} side={THREE.BackSide} fog={false} depthWrite={false} />
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

export function Environment(): React.JSX.Element {
  return (
    <group>
      <Sky />
      <Horizon />
      <Ground />
    </group>
  );
}
