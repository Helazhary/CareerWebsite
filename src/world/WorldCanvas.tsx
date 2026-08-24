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
import { worldGraph } from './world';

const ENTRY_BY_ID = new Map(entries.map((entry) => [entry.id, entry]));

/**
 * The opening: shutter up, car pulls out on its own, then the viewer takes the
 * wheel. Long enough to clear the garage and see the road, short enough that
 * nobody sits through it twice.
 */
const DRIVE_OUT_SECONDS = 3.4;

/** 'garage' → 'leaving' → 'driving'. Deep links skip straight to driving. */
type Phase = 'garage' | 'leaving' | 'driving';

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
  const [aboutOpen, setAboutOpen] = useState(false);
  const [openEntryId, setOpenEntryId] = useState<string | null>(initialEntryId ?? null);
  // Arriving by deep link means arriving at a building, not in the garage.
  const [phase, setPhase] = useState<Phase>(initialEntryId === undefined ? 'garage' : 'driving');
  const [showControls, setShowControls] = useState(initialEntryId === undefined);

  const openEntry = openEntryId === null ? undefined : ENTRY_BY_ID.get(openEntryId);
  const paused = mapOpen || aboutOpen || openEntry !== undefined || showControls;

  // Hand over control once the car is clear of the garage.
  useEffect(() => {
    if (phase !== 'leaving') return;
    const timer = window.setTimeout(() => setPhase('driving'), DRIVE_OUT_SECONDS * 1000);
    return () => window.clearTimeout(timer);
  }, [phase]);

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
    const anchor = worldGraph.anchorByEntryId.get(entryId);
    if (anchor === undefined) return;
    stateRef.current = stateAtAnchor(worldGraph, anchor);
    setMapOpen(false);
    // Travelling by map leaves the garage behind, however you got there.
    setPhase('driving');
  }, []);

  const start = useCallback((): void => {
    setShowControls(false);
    setPhase((current) => (current === 'garage' ? 'leaving' : current));
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
        <Scene
          input={input}
          onHud={setHud}
          stateRef={stateRef}
          paused={paused}
          leaving={phase === 'leaving'}
          inGarage={phase === 'garage'}
        />
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
        <IntroOverlay
          onStart={start}
          startLabel={phase === 'garage' ? 'Drive out of the garage' : 'Back to it'}
        />
      ) : null}
    </div>
  );
}
