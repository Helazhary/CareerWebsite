'use client';

import type { Entry } from '@content/schema';
import {
  Cap,
  Colonnade,
  Corrugation,
  LitBand,
  PitchedRoof,
  Plinth,
  RoofPlant,
  RollUpDoor,
  Setback,
  Shell,
  WindowStack,
  type SkinProps,
} from './parts';

/**
 * The skin kit.
 *
 * One entry per `skin` value in the content schema. `Plot` looks a skin up here
 * and never learns a project's name — visual variety is added by registering a
 * set piece, not by extending a switch statement (.claude/rules/world.md).
 *
 * Looks follow DESIGN.md §2.4.
 */

const GLOW = {
  window: '#ffd9a0',
  lab: '#cfe9ff',
  terminal: '#5cf2a8',
  neon: '#ff5cc8',
} as const;

/** Roll-up door, workbench light. The world opens here. */
function GarageSkin({ footprint, tint }: SkinProps): React.JSX.Element {
  return (
    <group>
      <Plinth footprint={footprint} tint="#4a4238" height={1.1} spread={2.6} />
      <Shell footprint={footprint} tint={tint} />
      <PitchedRoof footprint={footprint} color="#4a4238" y={footprint.height} pitch={0.2} />
      <Cap footprint={footprint} color={tint} y={footprint.height + 0.25} />
      <RollUpDoor footprint={footprint} color="#8d7a63" />
      <LitBand
        footprint={footprint}
        color={GLOW.window}
        y={footprint.height * 0.82}
        height={0.9}
        intensity={1.1}
      />
    </group>
  );
}

/** Clean research block, glazing band, screens inside. */
function LabSkin({ footprint, tint }: SkinProps): React.JSX.Element {
  return (
    <group>
      <Plinth footprint={footprint} tint="#8d97a6" height={1.3} spread={2.2} />
      <Shell footprint={footprint} tint={tint} roughness={0.55} />
      <Setback footprint={footprint} tint={tint} from={0.78} rise={0.26} inset={0.62} />
      <RoofPlant footprint={footprint} tint="#8d97a6" y={footprint.height} />
      <Cap footprint={footprint} color="#cfd6e2" y={footprint.height + 0.2} thickness={0.4} />
      <LitBand footprint={footprint} color={GLOW.lab} y={footprint.height * 0.58} height={2.2} />
      <LitBand
        footprint={footprint}
        color={GLOW.lab}
        y={footprint.height * 0.26}
        height={1.2}
        intensity={0.8}
      />
    </group>
  );
}

/** Dim, windowless, green terminal glow through the vents. */
function ServerRoomSkin({ footprint, tint }: SkinProps): React.JSX.Element {
  return (
    <group>
      <Plinth footprint={footprint} tint="#242a35" height={1.8} spread={2.4} />
      <Shell footprint={footprint} tint={tint} roughness={0.95} />
      <RoofPlant footprint={footprint} tint="#2b3240" y={footprint.height} />
      <Cap footprint={footprint} color="#2b3240" y={footprint.height + 0.2} overhang={1.4} />
      <LitBand
        footprint={footprint}
        color={GLOW.terminal}
        y={footprint.height * 0.34}
        height={0.5}
        intensity={2.2}
      />
      <LitBand
        footprint={footprint}
        color={GLOW.terminal}
        y={footprint.height * 0.52}
        height={0.5}
        intensity={2.2}
      />
    </group>
  );
}

/** Corrugated unit with a roll-up door. */
function WorkshopSkin({ footprint, tint }: SkinProps): React.JSX.Element {
  return (
    <group>
      <Plinth footprint={footprint} tint="#3f3931" height={0.9} spread={2.2} />
      <Shell footprint={footprint} tint={tint} />
      <Corrugation footprint={footprint} color={tint} />
      <RollUpDoor footprint={footprint} color="#6f6252" width={0.48} height={0.55} />
      <PitchedRoof footprint={footprint} color="#4a4438" y={footprint.height} pitch={0.16} />
      <Cap footprint={footprint} color="#4a4438" y={footprint.height + 0.2} thickness={0.4} />
    </group>
  );
}

/** Neon frontage. A short alley of cabinets, not a district. */
function ArcadeSkin({ footprint, tint }: SkinProps): React.JSX.Element {
  return (
    <group>
      <Plinth footprint={footprint} tint="#3a2b45" height={1.2} spread={2.8} />
      <Shell footprint={footprint} tint={tint} roughness={0.7} />
      <LitBand
        footprint={footprint}
        color={GLOW.neon}
        y={footprint.height * 0.78}
        height={1.5}
        intensity={2.4}
      />
      <LitBand
        footprint={footprint}
        color="#54d7ff"
        y={footprint.height * 0.3}
        height={0.6}
        intensity={2}
      />
      <Cap footprint={footprint} color="#3a2b45" y={footprint.height + 0.25} />
    </group>
  );
}

/** Employer. Stacked floors, lights on. */
function OfficeSkin({ footprint, tint }: SkinProps): React.JSX.Element {
  const floors = Math.max(2, Math.round(footprint.height / 4));
  return (
    <group>
      <Plinth footprint={footprint} tint="#5a6272" height={2.2} spread={2.6} />
      <Shell footprint={footprint} tint={tint} roughness={0.6} />
      <WindowStack footprint={footprint} color={GLOW.window} floors={floors} />
      <Setback footprint={footprint} tint={tint} from={0.82} rise={0.24} inset={0.7} />
      <RoofPlant footprint={footprint} tint="#5a6272" y={footprint.height} />
      <Cap footprint={footprint} color={tint} y={footprint.height + 0.25} thickness={0.6} />
    </group>
  );
}

/** Institution. Colonnade and a heavy cap. */
function CampusSkin({ footprint, tint }: SkinProps): React.JSX.Element {
  return (
    <group>
      <Plinth footprint={footprint} tint="#9aa2b0" height={2} spread={3.2} />
      <Shell footprint={footprint} tint={tint} />
      <Colonnade footprint={footprint} color="#c8cdd8" />
      <WindowStack footprint={footprint} color={GLOW.window} floors={2} />
      <Cap footprint={footprint} color="#aeb5c2" y={footprint.height + 0.3} overhang={1.6} thickness={0.8} />
      <PitchedRoof footprint={footprint} color="#7d8593" y={footprint.height + 0.7} pitch={0.24} />
    </group>
  );
}

const SKINS: Record<Entry['skin'], (props: SkinProps) => React.JSX.Element> = {
  garage: GarageSkin,
  lab: LabSkin,
  'server-room': ServerRoomSkin,
  workshop: WorkshopSkin,
  arcade: ArcadeSkin,
  office: OfficeSkin,
  campus: CampusSkin,
};

/**
 * Render the skin registered for a `skin` value.
 *
 * Called directly rather than returned as a component: these are pure render
 * functions with no state and no hooks, and handing a component back from a
 * lookup would remount it on every render.
 */
export function renderSkin(skin: Entry['skin'], props: SkinProps): React.JSX.Element {
  return SKINS[skin](props);
}

export type { SkinProps };
