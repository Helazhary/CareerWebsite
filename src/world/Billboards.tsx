'use client';

import { useEffect, useMemo } from 'react';
import type { District } from '@content/schema';
import { DISTRICT_LABELS } from '@/lib/site';
import { type RoadGraph, tangentAt } from './graph';
import { createSignTexture } from './signTexture';
import { DISTRICT_TINT } from './palette';

/**
 * Roadside billboards naming each district, readable from a long way off.
 *
 * The junction HUD prompt only appears at the last moment, which tells you
 * where you *can* turn but not where anything is. A sign you can read from
 * three hundred units away is the difference between a road network and a map.
 */

const WIDTH = 26;
const HEIGHT = 7.2;
const POST_HEIGHT = 11;
const CANVAS_WIDTH = 1024;

interface Board {
  readonly id: string;
  readonly district: District;
  readonly x: number;
  readonly z: number;
  readonly rotationY: number;
}

function Billboard({ board }: { board: Board }): React.JSX.Element | null {
  const label = DISTRICT_LABELS[board.district] ?? board.district;
  const texture = useMemo(
    () =>
      createSignTexture(label, {
        width: CANVAS_WIDTH,
        height: Math.round((CANVAS_WIDTH * HEIGHT) / WIDTH),
        panel: '#10141c',
        ink: '#f0f3f8',
        accent: DISTRICT_TINT[board.district],
        uppercase: true,
      }),
    [label, board.district],
  );
  useEffect(() => () => texture?.dispose(), [texture]);

  if (texture === null) return null;

  return (
    <group position={[board.x, 0, board.z]} rotation={[0, board.rotationY, 0]}>
      {[-WIDTH * 0.32, WIDTH * 0.32].map((x) => (
        <mesh key={x} position={[x, POST_HEIGHT / 2, -0.35]} castShadow>
          <boxGeometry args={[0.6, POST_HEIGHT, 0.6]} />
          <meshStandardMaterial color="#454c59" roughness={0.85} metalness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, POST_HEIGHT + HEIGHT / 2 - 0.6, 0]} castShadow>
        <boxGeometry args={[WIDTH, HEIGHT, 0.5]} />
        <meshStandardMaterial color="#10141c" roughness={0.9} />
      </mesh>
      <mesh position={[0, POST_HEIGHT + HEIGHT / 2 - 0.6, 0.28]}>
        <planeGeometry args={[WIDTH, HEIGHT]} />
        <meshStandardMaterial
          map={texture}
          roughness={0.55}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.5}
        />
      </mesh>
    </group>
  );
}

export function Billboards({ graph }: { graph: RoadGraph }): React.JSX.Element {
  const boards = useMemo<Board[]>(() => {
    const result: Board[] = [];

    for (const edge of graph.edges) {
      if (edge.district === 'highway') continue;
      const junction = graph.nodeById.get(edge.fromId);
      if (junction === undefined) continue;

      // Stand it back down the highway from the turning, on the far side, angled
      // at oncoming traffic — where a real sign warning of a junction goes.
      const departure = tangentAt(edge, 0);
      const side = Math.sign(departure.z) || 1;
      result.push({
        id: edge.id,
        district: edge.district,
        x: junction.position.x - 46,
        z: junction.position.z + side * 26,
        rotationY: -Math.PI / 2 + side * 0.32,
      });
    }

    return result;
  }, [graph]);

  return (
    <group>
      {boards.map((board) => (
        <Billboard key={board.id} board={board} />
      ))}
    </group>
  );
}
