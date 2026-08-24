'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useHasWebGL, useShouldAutoDrive } from './capability';

/**
 * The only bridge between the document and the world.
 *
 * `ssr: false` plus a dynamic import is what keeps the entire 3D bundle —
 * three, fiber, drei, the world modules — out of the document payload. Doc mode
 * renders and is readable whether or not this ever resolves.
 */
const WorldCanvas = dynamic(() => import('./WorldCanvas'), {
  ssr: false,
  loading: () => null,
});

type Mode = 'document' | 'drive';

export function WorldMount(): React.JSX.Element | null {
  const canDrive = useHasWebGL();
  const autoDrive = useShouldAutoDrive();
  // The probe decides where the reader lands; this only records them choosing
  // otherwise, so the toggle survives a re-render without fighting the probe.
  const [chosen, setChosen] = useState<Mode | null>(null);
  const mode: Mode = chosen ?? (autoDrive ? 'drive' : 'document');

  // Driving over a scrollable page fights the page. Lock it while the world is up.
  useEffect(() => {
    if (mode !== 'drive') return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mode]);

  if (mode === 'document') {
    // An invitation, not an apology: offered only where it would actually work,
    // and never in place of the content.
    if (!canDrive) return null;
    return (
      <button
        type="button"
        onClick={() => setChosen('drive')}
        className="no-print rounded-md border border-line px-4 py-2 text-sm text-muted transition hover:border-accent hover:text-text"
      >
        Drive it instead
      </button>
    );
  }

  return <WorldCanvas onExit={() => setChosen('document')} />;
}
