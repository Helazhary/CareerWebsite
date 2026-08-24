'use client';

import { Canvas } from '@react-three/fiber';
import { PCFShadowMap } from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { entries } from '@content/registry';
import { DriveHud } from '@/ui/DriveHud';
import { Minimap } from '@/ui/Minimap';
import { ProjectPanel } from '@/ui/ProjectPanel';
import { type DriveState, initialDriveState, stateAtAnchor } from './drive';
import { Scene, type HudState } from './Scene';
import { useDriveInput } from './useDriveInput';
import { worldGraph } from './world';

const ENTRY_BY_ID = new Map(entries.map((entry) => [entry.id, entry]));

export default function WorldCanvas({
  onExit,
  initialEntryId,
}: {
  onExit: () => void;
  /** Deep link target: open here with this project's panel already up. */
  initialEntryId?: string;
}): React.JSX.Element {
  const input = useDriveInput();
  const stateRef = useRef<DriveState>(
    useMemo(() => {
      const anchor =
        initialEntryId === undefined ? undefined : worldGraph.anchorByEntryId.get(initialEntryId);
      return anchor === undefined ? initialDriveState(worldGraph) : stateAtAnchor(worldGraph, anchor);
    }, [initialEntryId]),
  );

  const [hud, setHud] = useState<HudState | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [openEntryId, setOpenEntryId] = useState<string | null>(initialEntryId ?? null);

  const openEntry = openEntryId === null ? undefined : ENTRY_BY_ID.get(openEntryId);
  const paused = mapOpen || openEntry !== undefined;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (event.code === 'KeyM') setMapOpen((open) => !open);
      if (event.code === 'Enter') {
        // Enter opens whatever the car is standing at. Deliberately not
        // automatic on approach — a panel that opens itself as you drive past
        // is the world nagging.
        setOpenEntryId((current) => current ?? hud?.nearbyEntryId ?? null);
      }
      if (event.code === 'Escape') {
        setMapOpen(false);
        setOpenEntryId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud?.nearbyEntryId]);

  const travelTo = useCallback((entryId: string): void => {
    const anchor = worldGraph.anchorByEntryId.get(entryId);
    if (anchor === undefined) return;
    stateRef.current = stateAtAnchor(worldGraph, anchor);
    setMapOpen(false);
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-ink">
      <Canvas
        // Explicit: the default soft shadow map is deprecated in three 0.185
        // and warns once per frame, which would bury any real error.
        shadows={{ type: PCFShadowMap }}
        dpr={[1, 2]}
        camera={{ fov: 52, near: 0.5, far: 2400 }}
        gl={{ antialias: true, powerPreference: 'high-performance' }}
      >
        <Scene input={input} onHud={setHud} stateRef={stateRef} paused={paused} />
      </Canvas>

      <DriveHud
        hud={hud}
        input={input}
        onExit={onExit}
        onOpenMap={() => setMapOpen(true)}
        onOpenEntry={setOpenEntryId}
        panelOpen={openEntry !== undefined}
      />

      <Minimap
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onTravel={travelTo}
        stateRef={stateRef}
      />

      {openEntry !== undefined ? (
        <ProjectPanel entry={openEntry} onClose={() => setOpenEntryId(null)} />
      ) : null}
    </div>
  );
}
