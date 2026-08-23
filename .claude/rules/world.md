---
paths:
  - "src/world/**"
---

# World renderer rules

- `graph.ts` and `layout.ts` are pure. No imports from `three`, `@react-three/*`,
  `react`, or anything touching the DOM. They take content entries and return
  plain data. They are unit tested in `tests/`.
- No project-specific branching anywhere in this directory. No `if (entry.id ===
  'project-car')`. Behaviour varies by `district`, `skin`, `size`, `status`, and
  `ambient` — all schema fields — never by identity.
- New visual variety is added by registering a set piece in the kit, not by
  extending a switch statement in `Plot.tsx`.
- The car is constrained to a spline. Do not add physics, free steering, or
  collision. Junction choice is the only navigation input.
- Everything here is dynamically imported. Nothing in `src/world/` may be
  imported from `src/doc/` or from a page that doc mode renders.
