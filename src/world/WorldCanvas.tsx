'use client';

import { Canvas } from '@react-three/fiber';
import { PCFShadowMap } from 'three';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DriveHud } from '@/ui/DriveHud';
import { Minimap } from '@/ui/Minimap';
import { type DriveState, initialDriveState, stateAtAnchor } from './drive';
import { Scene, type HudState } from './Scene';
import { useDriveInput } from './useDriveInput';
import { worldGraph } from './world';

export default function WorldCanvas({ onExit }: { onExit: () => void }): React.JSX.Element {
  const input = useDriveInput();
  const stateRef = useRef<DriveState>(initialDriveState(worldGraph));
  const [hud, setHud] = useState<HudState | null>(null);
  const [mapOpen, setMapOpen] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.code === 'KeyM' && !event.repeat) setMapOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

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
        <Scene input={input} onHud={setHud} stateRef={stateRef} />
      </Canvas>

      <DriveHud
        hud={hud}
        input={input}
        onExit={onExit}
        onOpenMap={() => setMapOpen(true)}
      />

      <Minimap
        open={mapOpen}
        onClose={() => setMapOpen(false)}
        onTravel={travelTo}
        stateRef={stateRef}
      />
    </div>
  );
}
