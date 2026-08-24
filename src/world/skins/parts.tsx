'use client';

import type { Footprint } from '../layout';

/**
 * Shared building parts.
 *
 * Every skin is assembled from these rather than modelling its own geometry, so
 * a district reads as a district without seven unrelated art styles. All parts
 * are positioned in the plot's local space: origin at ground centre, +Z facing
 * the road.
 */

export interface SkinProps {
  readonly footprint: Footprint;
  readonly tint: string;
}

/** The main mass of a building. */
export function Shell({
  footprint,
  tint,
  inset = 0,
  heightScale = 1,
  roughness = 0.9,
}: SkinProps & { inset?: number; heightScale?: number; roughness?: number }): React.JSX.Element {
  const height = footprint.height * heightScale;
  return (
    <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
      <boxGeometry args={[footprint.width - inset, height, footprint.depth - inset]} />
      <meshStandardMaterial color={tint} roughness={roughness} metalness={0} />
    </mesh>
  );
}

/**
 * A lit horizontal band across the front face — windows, screens, terminal
 * glow. Emissive so it reads at dusk, which is the palette the whole world
 * ships in (DESIGN.md §10).
 */
export function LitBand({
  footprint,
  color,
  y,
  height = 1.6,
  intensity = 1.4,
}: {
  footprint: Footprint;
  color: string;
  y: number;
  height?: number;
  intensity?: number;
}): React.JSX.Element {
  return (
    <mesh position={[0, y, footprint.depth / 2 + 0.06]}>
      <planeGeometry args={[footprint.width * 0.82, height]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={intensity}
        toneMapped={false}
      />
    </mesh>
  );
}

/** Stacked window bands up the front of a taller building. */
export function WindowStack({
  footprint,
  color,
  floors,
}: {
  footprint: Footprint;
  color: string;
  floors: number;
}): React.JSX.Element {
  const spacing = footprint.height / (floors + 1);
  return (
    <group>
      {Array.from({ length: floors }, (_, i) => (
        <LitBand
          key={i}
          footprint={footprint}
          color={color}
          y={spacing * (i + 1)}
          height={Math.min(spacing * 0.42, 1.5)}
          intensity={0.9}
        />
      ))}
    </group>
  );
}

/** A roll-up door: the front of a garage or a workshop unit. */
export function RollUpDoor({
  footprint,
  color,
  width = 0.55,
  height = 0.6,
}: {
  footprint: Footprint;
  color: string;
  width?: number;
  height?: number;
}): React.JSX.Element {
  const doorWidth = footprint.width * width;
  const doorHeight = footprint.height * height;
  const slats = Math.max(3, Math.round(doorHeight / 1.1));

  return (
    <group position={[0, 0, footprint.depth / 2 + 0.05]}>
      <mesh position={[0, doorHeight / 2, 0]}>
        <planeGeometry args={[doorWidth, doorHeight]} />
        <meshStandardMaterial color={color} roughness={0.7} metalness={0.25} />
      </mesh>
      {/* Slat lines. Cheap, and the thing that makes it read as a door. */}
      {Array.from({ length: slats }, (_, i) => (
        <mesh key={i} position={[0, ((i + 0.5) * doorHeight) / slats, 0.02]}>
          <planeGeometry args={[doorWidth, 0.07]} />
          <meshStandardMaterial color="#0d1016" roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

/** Vertical corrugation across the front face. Industrial units. */
export function Corrugation({
  footprint,
  color,
}: {
  footprint: Footprint;
  color: string;
}): React.JSX.Element {
  const ribs = Math.max(4, Math.round(footprint.width / 2.2));
  const step = footprint.width / ribs;
  return (
    <group position={[0, 0, footprint.depth / 2 + 0.04]}>
      {Array.from({ length: ribs }, (_, i) => (
        <mesh key={i} position={[-footprint.width / 2 + step * (i + 0.5), footprint.height / 2, 0]}>
          <boxGeometry args={[step * 0.28, footprint.height * 0.96, 0.16]} />
          <meshStandardMaterial color={color} roughness={0.85} metalness={0.15} />
        </mesh>
      ))}
    </group>
  );
}

/** A flat parapet or plinth cap. */
export function Cap({
  footprint,
  color,
  y,
  overhang = 0.9,
  thickness = 0.5,
}: {
  footprint: Footprint;
  color: string;
  y: number;
  overhang?: number;
  thickness?: number;
}): React.JSX.Element {
  return (
    <mesh position={[0, y, 0]} castShadow>
      <boxGeometry args={[footprint.width + overhang, thickness, footprint.depth + overhang]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  );
}

/** A row of columns across the front. Campus halls. */
export function Colonnade({
  footprint,
  color,
  count = 5,
}: {
  footprint: Footprint;
  color: string;
  count?: number;
}): React.JSX.Element {
  const span = footprint.width * 0.86;
  const step = span / (count - 1);
  const height = footprint.height * 0.62;
  return (
    <group position={[0, 0, footprint.depth / 2 + 1.1]}>
      {Array.from({ length: count }, (_, i) => (
        <mesh key={i} position={[-span / 2 + step * i, height / 2, 0]} castShadow>
          <cylinderGeometry args={[0.42, 0.42, height, 8]} />
          <meshStandardMaterial color={color} roughness={0.85} />
        </mesh>
      ))}
      <mesh position={[0, height + 0.35, 0]} castShadow>
        <boxGeometry args={[span + 1.6, 0.7, 2.4]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>
    </group>
  );
}
