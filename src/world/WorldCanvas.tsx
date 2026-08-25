'use client';

import { Canvas } from '@react-three/fiber';
import { PCFShadowMap } from 'three';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { entries } from '@content/registry';
import { AboutPanel } from '@/ui/AboutPanel';
import { DriveHud } from '@/ui/DriveHud';
import { IntroOverlay } from '@/ui/IntroOverlay';
import { Minimap } from '@/ui/Minimap';
import { ProjectPanel } from '@/ui/ProjectPanel';
import { type DriveState, initialDriveState, stateAtAnchor } from './drive';
import { Scene, type HudState } from './Scene';
import { useDriveInput } from './useDriveInput';
import { worldAnchorByEntryId, worldGraph } from './world';

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
        initialEntryId === undefined ? undefined : worldAnchorByEntryId.get(initialEntryId);
      return anchor === undefined ? initialDriveState(worldGraph) : stateAtAnchor(worldGraph, anchor);
    }, [initialEntryId]),
  );

  const [hud, setHud] = useState<HudState | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [openEntryId, setOpenEntryId] = useState<string | null>(initialEntryId ?? null);
  // Arriving by deep link means arriving at a building, and the controls card
  // would be in the way of the thing that was linked to.
  const [showControls, setShowControls] = useState(initialEntryId === undefined);

  const openEntry = openEntryId === null ? undefined : ENTRY_BY_ID.get(openEntryId);
  const paused = mapOpen || aboutOpen || openEntry !== undefined || showControls;

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.repeat) return;
      if (event.code === 'KeyM') setMapOpen((open) => !open);
      if (event.code === 'Enter') {
        setOpenEntryId((current) => current ?? hud?.nearbyEntryId ?? null);
      }
      if (event.code === 'Escape') {
        setMapOpen(false);
        setAboutOpen(false);
        setOpenEntryId(null);
        setShowControls(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [hud?.nearbyEntryId]);

  const travelTo = useCallback((entryId: string): void => {
    const anchor = worldAnchorByEntryId.get(entryId);
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
        // Far must clear the whole backdrop. At 2400 it sat *inside* the sky
        // dome (radius 2600) and in front of the pyramids, so both were clipped
        // away — the sky left a hole showing the canvas clear colour, which read
        // as a black mountain that nothing raycast against and no material
        // recolour touched, because nothing was being drawn there at all.
        camera={{ fov: 52, near: 0.5, far: 9000 }}
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
        onOpenAbout={() => setAboutOpen(true)}
        onOpenControls={() => setShowControls(true)}
        panelOpen={openEntry !== undefined || aboutOpen}
        controlsHidden={showControls}
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

      {aboutOpen ? <AboutPanel onClose={() => setAboutOpen(false)} /> : null}

      {showControls ? (
        <IntroOverlay onStart={() => setShowControls(false)} startLabel="Take the wheel" />
      ) : null}
    </div>
  );
}
