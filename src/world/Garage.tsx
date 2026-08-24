'use client';

import { Suspense, useEffect, useMemo, useRef } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import type { Group, Mesh } from 'three';
import { getEntry } from '@content/registry';
import type { RoadGraph } from './graph';

/**
 * The room the world opens in.
 *
 * DESIGN.md §2.4 and §2.3: the viewer starts in the garage with the real car,
 * and drives out of it into the career. The photographs on the wall are the
 * actual images from `content/entries/project-car.ts` — the same files doc mode
 * shows in that project's gallery, so there is exactly one copy of them and
 * adding another photo puts it on the wall for free.
 */

const WIDTH = 30;
/**
 * Deep enough to hold the chase camera.
 *
 * The camera sits ~20 units behind the car, and the car sits at spawn, so a
 * shallow garage puts the camera outside its own back wall looking at the
 * inside of it. The room is offset backwards for the same reason: the car
 * starts near the door with the workshop behind it.
 */
const DEPTH = 42;
const BACKSET = 7;
const HEIGHT = 11;
const WALL = 0.8;
const DOOR_HEIGHT = 7.4;

/** Seconds for the shutter to travel its full height. */
const DOOR_SECONDS = 2.1;

/** Photographs to hang. More than this and the wall becomes a contact sheet. */
const MAX_PHOTOS = 3;

/**
 * Resolved once at module load. The content is a build-time constant, so there
 * is nothing for a hook to memoise and nothing to recompute.
 */
const PHOTO_URLS: readonly string[] = (() => {
  const entry = getEntry('project-car');
  if (entry === undefined) return [];
  return entry.media.slice(0, MAX_PHOTOS).map((item) => `/media/${entry.id}/${item.src}`);
})();

function PhotoWall({ urls }: { urls: readonly string[] }): React.JSX.Element | null {
  const textures = useLoader(THREE.TextureLoader, [...urls]);
  // JPEGs are colour data, not linear values; without the colour space the
  // photographs hang on the wall looking washed out. Set on a clone rather
  // than on the loader's cached texture, which is shared and must not be
  // mutated during render.
  const maps = useMemo(() => {
    const loaded = Array.isArray(textures) ? textures : [textures];
    return loaded.map((texture) => {
      const copy = texture.clone();
      copy.colorSpace = THREE.SRGBColorSpace;
      copy.needsUpdate = true;
      return copy;
    });
  }, [textures]);

  useEffect(() => () => maps.forEach((map) => map.dispose()), [maps]);

  // Hung on the side walls, not the back one. The camera looks out through the
  // door, so anything behind the car is never seen.
  const frameWidth = 7;
  const inset = WIDTH / 2 - WALL - 0.08;

  return (
    <group>
      {urls.map((url, index) => {
        const map = maps[index];
        if (map === undefined) return null;
        const side = index % 2 === 0 ? -1 : 1;
        // Forward of the car, not level with it: the camera starts behind the
        // car, so anything hung near the back wall is out of shot.
        const along = -DEPTH / 2 + 23 + Math.floor(index / 2) * (frameWidth + 3.5);
        const aspect = (map.image?.height ?? 3) / (map.image?.width ?? 4);
        const height = frameWidth * Math.min(Math.max(aspect, 0.6), 1.35);

        return (
          <group
            key={url}
            position={[side * inset, HEIGHT * 0.55, along]}
            rotation={[0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0]}
          >
            <mesh position={[0, 0, -0.05]}>
              <planeGeometry args={[frameWidth + 0.55, height + 0.55]} />
              <meshStandardMaterial color="#15181f" roughness={0.9} />
            </mesh>
            <mesh>
              <planeGeometry args={[frameWidth, height]} />
              <meshStandardMaterial map={map} roughness={0.7} toneMapped={false} />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

export function Garage({
  graph,
  open,
}: {
  graph: RoadGraph;
  /** Drives the shutter. The room stays; only the door moves. */
  open: boolean;
}): React.JSX.Element | null {
  const spawn = graph.nodeById.get(graph.spawnNodeId);
  const shutter = useRef<Mesh>(null);
  const room = useRef<Group>(null);
  const urls = PHOTO_URLS;

  useFrame((_, delta) => {
    const door = shutter.current;
    if (door === null) return;
    // Rolls up out of sight, and stops there.
    const closedY = DOOR_HEIGHT / 2;
    const openY = DOOR_HEIGHT / 2 + DOOR_HEIGHT + 0.6;
    const target = open ? openY : closedY;
    const step = ((openY - closedY) / DOOR_SECONDS) * delta;
    door.position.y += Math.sign(target - door.position.y) * Math.min(step, Math.abs(target - door.position.y));
  });

  if (spawn === undefined) return null;

  const shell = '#3d3529';
  const inner = '#4a4234';

  return (
    // Built with its opening along +z, then turned a quarter so the opening
    // faces +x — the way the highway runs and the way the car sets off.
    // Without this the car drives straight through a side wall.
    <group ref={room} position={[spawn.position.x - BACKSET, 0, spawn.position.z]} rotation={[0, Math.PI / 2, 0]}>
      {/* Back wall, carrying the photographs. */}
      <mesh position={[0, HEIGHT / 2, -DEPTH / 2]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH, HEIGHT, WALL]} />
        <meshStandardMaterial color={shell} roughness={0.95} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={side} position={[(side * WIDTH) / 2, HEIGHT / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[WALL, HEIGHT, DEPTH]} />
          <meshStandardMaterial color={inner} roughness={0.95} />
        </mesh>
      ))}
      <mesh position={[0, HEIGHT, 0]} castShadow receiveShadow>
        <boxGeometry args={[WIDTH + 1.4, WALL, DEPTH + 1.4]} />
        <meshStandardMaterial color={shell} roughness={0.95} />
      </mesh>
      {/* Concrete, laid above the road surface and its grass verge — both run
          through this spot and would otherwise render inside the garage, so
          the floor read as tarmac and lawn. The road picks up again outside
          the door, which is where a road belongs. */}
      <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[WIDTH - WALL, DEPTH - WALL]} />
        <meshStandardMaterial color="#33343a" roughness={0.88} />
      </mesh>
      {/* Oil-stained bay under where the car stands. */}
      <mesh position={[0, 0.15, DEPTH * 0.08]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[6.5, 13]} />
        <meshStandardMaterial color="#2a2b30" roughness={0.95} />
      </mesh>

      {/* Header above the opening, so the door has something to roll into. */}
      <mesh position={[0, DOOR_HEIGHT + (HEIGHT - DOOR_HEIGHT) / 2, DEPTH / 2]} castShadow>
        <boxGeometry args={[WIDTH, HEIGHT - DOOR_HEIGHT, WALL]} />
        <meshStandardMaterial color={shell} roughness={0.95} />
      </mesh>

      <mesh ref={shutter} position={[0, DOOR_HEIGHT / 2, DEPTH / 2]} castShadow>
        <boxGeometry args={[WIDTH - 1.2, DOOR_HEIGHT, 0.35]} />
        <meshStandardMaterial color="#6d6252" roughness={0.6} metalness={0.35} />
      </mesh>

      {/* useLoader suspends while the JPEGs decode. Without a boundary that
          suspension propagates out of the Canvas and blanks the entire scene —
          the garage, the world, everything — until the images arrive. */}
      {urls.length > 0 ? (
        <Suspense fallback={null}>
          <PhotoWall urls={urls} />
        </Suspense>
      ) : null}

      {/* Strip lights, so the room reads as interior against the dusk outside. */}
      {[-DEPTH * 0.22, DEPTH * 0.18].map((z) => (
        <mesh key={z} position={[0, HEIGHT - 0.7, z]}>
          <boxGeometry args={[WIDTH * 0.55, 0.22, 0.7]} />
          <meshStandardMaterial
            color="#fff3d6"
            emissive="#ffe9bd"
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      ))}
      <pointLight position={[0, HEIGHT - 1.6, 0]} intensity={900} distance={46} decay={2} color="#ffe9c4" />
    </group>
  );
}
