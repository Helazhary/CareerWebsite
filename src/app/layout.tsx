import type { Metadata } from 'next';
import Link from 'next/link';
import { site } from '@/lib/site';
import { Contact } from '@/doc/Contact';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — ${site.role}`,
    template: `%s — ${site.name}`,
  },
  description: site.pitch,
  openGraph: {
    title: `${site.name} — ${site.role}`,
    description: site.pitch,
    url: site.url,
    siteName: site.name,
    type: 'website',
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:rounded focus:bg-accent focus:px-3 focus:py-2 focus:text-ink"
        >
          Skip to content
        </a>

        {/* The escape hatch. Visible in the first frame, on every page. */}
        <header className="no-print sticky top-0 z-40 border-b border-line bg-ink/85 backdrop-blur">
          <nav className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 py-3">
            <Link href="/" className="font-semibold tracking-tight hover:text-accent">
              {site.name}
            </Link>
            <div className="flex items-center gap-2 text-sm">
              <Link
                href="/resume"
                className="rounded-md border border-line px-3 py-1.5 text-muted transition hover:border-accent hover:text-text"
              >
                Resume
              </Link>
              <Link
                href="/projects"
                className="rounded-md border border-line px-3 py-1.5 text-muted transition hover:border-accent hover:text-text"
              >
                Projects
              </Link>
            </div>
          </nav>
        </header>

        <main id="main" className="mx-auto max-w-3xl px-5 py-10">
          {children}
        </main>

        <footer className="no-print mx-auto max-w-3xl border-t border-line px-5 py-8 text-sm text-muted">
          <Contact />
        </footer>
      </body>
    </html>
  );
}
