'use client';

import { useSyncExternalStore } from 'react';
import { site } from '@/lib/site';

const subscribe = () => () => {};

/**
 * Assembles the address in the browser so the plain string never ships in the
 * static HTML. useSyncExternalStore gives us a hydration-safe "are we on the
 * client yet" without a setState-in-effect cascade. Without JS, the readable
 * fallback is still there.
 */
export function Contact() {
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
      {mounted ? (
        <a href={`mailto:${site.emailUser}@${site.emailDomain}`} className="hover:text-accent">
          {`${site.emailUser}@${site.emailDomain}`}
        </a>
      ) : (
        <span>
          {site.emailUser} [at] {site.emailDomain}
        </span>
      )}
      <a href={site.github} className="hover:text-accent" rel="me noopener">
        GitHub
      </a>
      <a href={site.linkedin} className="hover:text-accent" rel="me noopener">
        LinkedIn
      </a>
      <span className="ml-auto text-xs">{site.location}</span>
    </div>
  );
}
