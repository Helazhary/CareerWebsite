---
paths:
  - "src/world/**"
  - "src/ui/**"
---

# World renderer rules

## The pure layer

`graph.ts`, `layout.ts`, `drive.ts`, `scatter.ts` and `signText.ts` import
nothing from `three`, `@react-three/*`, `react`, or anything touching the DOM.
They take content entries and return plain data, and they are unit tested in
`tests/`.

Every geometric or behavioural invariant lives here, because these are the
things that break silently and are invisible until someone drives past them:

- buildings never overlap, for any number of entries
- nothing grows in the road
- the car can never leave the graph, under any input
- every plot is reachable by driving, not merely connected in the adjacency list
- arriving at a project puts you at *that* project, not at its neighbour
- a detour never opens across an off-ramp on the side it bows to
- a title always fits its sign

All of these are covered in `tests/`. When one breaks, add the regression test
at the same time as the fix — and **negative-check it**: break the thing it
guards and confirm it fails, naming the right thing. A test written after the
fix can pass vacuously and prove nothing.
Assert on the **final rendered positions**, not on the intermediate data — the
highway once rendered out of chronological order while the anchors it came from
were perfectly correct.

## Content changes move the world

A date is not a label. The highway *is* chronology: entries are placed along it
by date and an off-ramp leaves the spine where its district began, so editing
one date in `content/entries/` relays the roads.

This is not theoretical. Moving The Lab four months later opened the Concordia
detour directly across the lab off-ramp, `layoutPlots` pushed a building into a
second rank to find room, and that put it far enough from its own anchor that
arriving there offered a neighbour instead — one content edit, three symptoms,
two of them nowhere near content. **Run `npm run check` after any date change**;
those three surfaced as three failing tests.

`hideDate` hides a date; it does not remove one. Every entry keeps a `start`
because a district with nothing dated in it has nothing to place its ramp by.

## No project-specific code, anywhere in here

No `if (entry.id === 'project-car')`. Behaviour varies by `district`, `skin`,
`size`, `status` and `ambient` — all schema fields — and never by identity.

New visual variety is added by **registering a set piece in `skins/`**, not by
extending a switch statement in `Plot.tsx`. Skins are called as render
functions rather than returned from a lookup as components: they hold no state,
and handing a component back from a map remounts it every render.

## The car

Constrained to a spline. No physics, no free steering, no collision. Junction
choice is the only navigation input, and **straight on is always the default** —
holding forward must drive the whole highway without a single decision.

## Performance

Anything that appears more than a few dozen times is an `InstancedMesh` from the
first commit. Retrofitting instancing means rewriting the component.

Canvas textures are disposed on unmount; they hold a bitmap on the GPU.

Prefer emissive geometry to real lights. A few dozen point lights cost more than
the rest of the scene put together, and at dusk in fog they read the same from a
moving car.

Budget is 60fps desktop, 30fps floor. Measure it while *driving* — a static
frame proves nothing.

## Splines

Arc-length parameterised, always: `u` means fraction of distance travelled.
Endpoint control points reflect, they do not clamp.

Ribbon geometry vertex pairs go negative-offset first. Reversing a pair flips
the winding and points the normals at the ground, which renders perfectly and is
invisible from above.

## Bundle

Everything here is dynamically imported. Nothing in `src/world/` or `src/ui/`
may be imported from `src/doc/` or from a page that doc mode renders. Verify
against the built output, not by reasoning: no chunk referenced by
`out/index.html` may contain `WebGLRenderer`.
