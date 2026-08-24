# Handoff — 2026-08-24

Written at the end of a long session so the next one can pick up cleanly.
Read this, then `CLAUDE.md`, then `docs/DESIGN.md` §9 for the milestone plan.

---

## 1. Where the project stands

**M0–M3 are built.** M0–M2.5 are deployed and live on helazhary.com. M3 (panels,
deep links, Montreal detour, fog ending) is built and merged to `main` but **has
not been deployed**, and neither has anything after it.

| Milestone | State |
| --- | --- |
| M0 — content pipeline, doc mode, CI, hosting | live |
| M1 — road graph, driving, camera, minimap | live |
| M2 — skins, signs, construction sites, dusk lighting, the real car | live |
| M2.5 — environment: textures, sky, hills, scenery, billboards | live |
| M3 — project panels, `/p/<id>`, Montreal detour, fog ending | merged, **not deployed** |
| Garage / intro / About / look-around / sunset | **local only** |
| M4 — real car `.glb` | not started |
| M5 — showpiece | not started |

`main` is **4 commits ahead of `origin/main`**, plus uncommitted work. Nothing
after PR #7 has been pushed.

---

## 2. THE OPEN BUG — start here

**Holding `W` does not move the car.** It sits at spawn inside the garage.

This is the thing to fix first. Everything else below is secondary.

### What is known

- The car's position stays at spawn (`x ≈ -88`), confirmed by reading the
  minimap marker's `transform` attribute before and after a 3-second hold.
- `M` (map) **does** work, and it is also a `window` keydown listener — so
  window key listeners are firing. The problem is specific to the throttle
  path in `src/world/useDriveInput.ts` → `src/world/Scene.tsx`.
- All 117 unit tests pass, including the driving fuzz test. The pure model in
  `src/world/drive.ts` is almost certainly fine; this is in the wiring.
- It worked earlier in the same session. A measured test gave `x = -11.7`
  after a 1.6 s press plus coast. It broke somewhere between that point and
  the end of the session.

### Important caveat

**Every driving test in that session used synthetic `KeyboardEvent`s**
dispatched from Playwright, never a real key press. Before debugging deeply,
**open the dev server and press `W` by hand.** It is entirely possible the
input path is fine and only the synthetic-event harness stopped working —
in which case there is no bug at all.

### Suspects, in order

1. `paused` in `src/world/WorldCanvas.tsx` stuck true. It is
   `mapOpen || aboutOpen || openEntry !== undefined || showControls`. When
   `paused`, `Scene` forces `throttle: false`. Check whether `showControls` or
   `mapOpen` is failing to clear.
2. `src/world/useLookAround.ts` was added late and attaches `pointerdown`,
   `pointermove` and `pointerup` on `window`. Check it is not interfering with
   focus or swallowing events.
3. The garage speed cap. `Scene` passes
   `{ ...DEFAULT_DRIVE_OPTIONS, maxSpeed: GARAGE_SPEED }` while `insideRef` is
   true. If `GARAGE_SPEED` were ever 0 or the options object malformed, the car
   would not move. It is 22 and looks right, but it is on the path.

### Fastest way to diagnose

Add a temporary `useFrame` line in `Scene.tsx` writing
`{ throttle: input.current.throttle, paused, inside: insideRef.current, speed: stateRef.current.speed }`
to `window`, then read it from the console. That was the next step when the
session ended. **Remove it afterwards** — a previous diagnostic like this was
left in and had to be cleaned up.

---

## 3. Uncommitted work

Three files, all part of an unfinished **sunset improvement**:

```
 M src/world/Environment.tsx
 M src/world/Sun.tsx
 M src/world/palette.ts
```

It type-checks, lints and all tests pass, but **it has not been visually
verified** — the driving bug blocked getting a representative screenshot.

What it does, and why:

- `SUN_DIRECTION` and `SUN_ELEVATION` in `palette.ts`, shared between the sky
  and the key light, because they disagreed. The sky said sunset while the
  light sat 37° above the horizon, which lights the world like mid-afternoon.
- The sun is now low (elevation 0.12) and warmer (`#ffb877`).
- The sky is **directional**. It previously painted the same warm band right
  around the horizon in every direction, so there was nowhere the sun actually
  *was* and the whole thing read as haze. There are now two gradients —
  `SKY_SUNWARD` and `SKY_AWAY` — blended per vertex by how much that part of
  the sky faces the sun.
- The warm band is much wider. It was about eight degrees of elevation, which
  is why the sunset was barely visible.

**Verify this visually before committing.** If it looks wrong, `git checkout`
those three files loses only this change.

---

## 4. Bugs fixed this session, worth not re-introducing

These cost real time and are invisible in the finished code.

- **The camera far plane must clear the backdrop.** It was 2400 with a sky dome
  of radius 2600, so the dome was clipped away and the canvas clear colour
  showed through as a black mountain hanging over the world. It raycast against
  nothing and survived recolouring all 456 meshes, because nothing was being
  drawn there. It is now 9000. The pyramids at 2400+ were invisible for the
  same reason.
- **Distant scenery must follow the camera.** The hills were centred on the
  world origin while the world runs to x≈1300, so driving east brought you
  within 65 units of a 170-unit ridge.
- **Ribbon geometry winding is load-bearing.** Reversing a vertex pair points
  the normals at the ground: the mesh renders perfectly and is invisible from
  above. This is what made the road centre dashes disappear.
- **A shadow-casting light that follows the car makes every shadow crawl.**
  Snap the shadow volume to whole texels. This was the "jittery movement".
- **Anything spaced with `floor(length / spacing)` skips short segments.**
  Street lamps missed exactly the stretches beside junctions, twice.
- **`useLoader` suspends.** Without a `<Suspense>` boundary the suspension
  propagates out of the `<Canvas>` and blanks the entire scene.
- **Splines must be arc-length parameterised**, and endpoint control points
  must reflect rather than clamp.
- **Test final positions, not intermediate data.** The highway once rendered
  out of chronological order while its anchors were perfectly correct.

---

## 5. Things waiting on Hussein

- **The About text.** `site.about` in `src/lib/site.ts` is deliberately empty
  and carries a `TODO(hussein)`. The panel falls back to the pitch, role and
  location already in that file, so nothing is invented and nothing is blank.
  Two or three short paragraphs in his own voice: where he is from, what he
  likes building, what he is looking for next.
- **Estimated dates.** Several entries in `content/entries/` still carry
  `TODO(hussein)` comments marking dates that were estimated from the resume
  and need confirming before they are truthful.
- **Media.** Only `project-car` has photographs. Every other media folder is
  empty; `npm run dev:preview` stands in for them.

---

## 6. Loose ends

- **Ambient props are not rendered.** `riscv-cpu` declares `'oscilloscope'` and
  `project-car` declares `'toolbox'` and `'car-lift'` in their `ambient`
  arrays. Unknown ids are ignored safely, so this is harmless — but it is a
  schema field doing nothing.
- **The pyramids have never been seen properly.** They were invisible behind
  the far-plane bug for the whole session, and were resized twice while
  chasing an artifact that was not them. Their current size is a guess and
  needs looking at.
- **`npm run dev:preview` was the running server** for most of the session.
  Remember it fills empty galleries with placeholder cards. Use plain
  `npm run dev` to see the site as it actually ships.

---

## 7. Deploying

Push to `main`; Cloudflare builds and publishes. It is a **Worker serving
static assets**, not Pages — config is `wrangler.jsonc`, and the Worker is
named `careerwebsite`. Full notes in `docs/CLOUDFLARE.md`.

Before deploying, run `npm run check`, and **read the whole output**. A
previous session tailed three lines, cut off the pass/fail count, and pushed a
branch with two failing tests that CI then caught.
