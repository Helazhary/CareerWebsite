# helazhary.com

Personal career site for Hussein Elazhary — an interactive map where a low-poly
BMW E36 drives through a stylized world, and every building is a job, a degree, or
a project. A persistent one-click escape hatch swaps to a plain, accessible
resume for visitors who want the short version.

**Live:** https://helazhary.com

## Stack

Next.js (static export) · React 19 · TypeScript (strict) · Tailwind CSS 4 ·
Zod · Vitest · Cloudflare Pages

No server, no database, no runtime secrets. `next build` emits static files and a
CDN serves them.

## Getting started

```bash
npm install
npm run dev
```

| Command | Purpose |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run check` | typecheck + lint + test |
| `npm run build` | Static export into `out/` |
| `npm run new:project` | Scaffold a new content entry |

## How it is organised

Content and engine are strictly separated. Every job, degree, and project is a
plain object in `content/entries/`, validated by a Zod schema at build time.
Adding one is a new file plus a media folder — no renderer changes.

- `docs/DESIGN.md` — the full design specification
- `HOWTO.md` — day-to-day guide for adding and editing content
- `SECURITY.md` — security posture and known limitations

## Status

M0 complete: content pipeline, document mode, CI, and hosting.
The 3D world (M1 onward) is not built yet. See `docs/DESIGN.md` §9.

## License

[MIT](LICENSE) for the code. Written content, images, and resume details are not
licensed for reuse.
