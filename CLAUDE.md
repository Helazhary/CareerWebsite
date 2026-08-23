# CareerWebsite

Interactive career map for helazhary.com. A low-poly BMW E36 drives through a
stylized world where every building is a job, a degree, or a project. One click
escapes to a plain resume for anyone in a hurry.

Full design spec: `docs/DESIGN.md` (read it before architectural work; do not
load it for routine content edits).
Contributor guide: `HOWTO.md`.

## Commands

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on :3000 |
| `npm run check` | typecheck + lint + test. Run before every commit. |
| `npm run build` | Static export into `out/` |
| `npm run new:project` | Scaffold a new content entry |
| `npm run content:sync` | Regenerate `content/entries/index.ts` |

## Hard rules

1. **Content is data.** Everything a viewer reads lives in `content/entries/*.ts`
   and is validated by `content/schema.ts`. Never hardcode a project's title,
   date, or copy into a component.
2. **No project-specific code in `src/world/`.** If a project needs something
   bespoke it registers a set piece or a showpiece into a registry. The renderer
   never learns the name of a project.
3. **Doc mode is the load-bearing mode.** It must work with no WebGL and render
   readable content without client-side JS. The 3D bundle is code-split and never
   enters the doc-mode bundle.
4. **`src/world/graph.ts` and `src/world/layout.ts` stay pure.** No Three.js
   imports, no React, no DOM. They are plain functions with unit tests.

## Conventions

- TypeScript strict. No `any`, no non-null assertions in app code.
- Entry ids are kebab-case and permanent — they are public URLs (`/projects/<id>`).
- Adding an entry file requires running `npm run content:sync`; CI fails if the
  generated index is stale.
- Images live in `public/media/<entry id>/` and are referenced by filename only.
- Alt text is required by the schema. Write a real description, not the title.

## Current state

M0 (doc mode, CI, hosting) is built. The 3D world (M1 onward) does not exist yet —
`src/world/` is not created. See `docs/DESIGN.md` §9 for the milestone plan.
