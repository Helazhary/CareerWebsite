'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { shouldAutoDrive, useShouldAutoDrive } from './capability';

const WorldCanvas = dynamic(() => import('./WorldCanvas'), { ssr: false, loading: () => null });

/**
 * Resolves `/p/<id>` to one of the two modes.
 *
 * Capable: mount the world at that building with its panel open. Not capable:
 * send the reader to the document, which is the good version for them anyway —
 * they should never see a "your browser is not supported" message.
 */
export function DeepLink({ entryId }: { entryId: string }): React.JSX.Element | null {
  const autoDrive = useShouldAutoDrive();
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (dismissed) return;
    // Read the probe directly rather than trusting the rendered value. This
    // effect first runs on the hydration commit, where useSyncExternalStore is
    // still returning the server snapshot — so `autoDrive` is false even on a
    // machine that can run the world, and the redirect fires before the real
    // answer arrives. `autoDrive` stays in the deps so this re-runs once it does.
    if (shouldAutoDrive()) return;
    router.replace(`/projects/${entryId}/`);
  }, [autoDrive, dismissed, entryId, router]);

  useEffect(() => {
    if (!autoDrive || dismissed) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [autoDrive, dismissed]);

  if (!autoDrive || dismissed) return null;

  return (
    <WorldCanvas
      initialEntryId={entryId}
      onExit={() => {
        setDismissed(true);
        router.push(`/projects/${entryId}/`);
      }}
    />
  );
}
