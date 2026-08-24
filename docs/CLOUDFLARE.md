# Hosting on Cloudflare

The site is a **Worker serving static assets** — no server code, no runtime. The
Worker has no `main` entrypoint; it is a pure asset binding over `out/`.

Config lives in `wrangler.jsonc` at the repo root. Build settings live in the
Cloudflare dashboard.

> Historical note: an earlier draft of this doc described Cloudflare **Pages**.
> The project is on **Workers**. Pages is in maintenance for new features and
> Cloudflare steers new static projects to Workers Static Assets.

---

## 1. Dashboard build settings

Worker → **Settings** → **Build**:

| Field | Value |
| --- | --- |
| Build command | `npm run build` |
| Deploy command (production) | `npx wrangler deploy` |
| Root directory | *(leave blank)* |

Node is already resolved to 22 from the `engines` field in `package.json` — the
build environment reports `nodejs@22.23.2`. You do not need a `NODE_VERSION`
variable unless that stops being true.

**Production must deploy with `wrangler deploy`, not `wrangler versions upload`.**
`versions upload` stages a version without routing traffic to it, so the live
site never changes and the build still reports success. Non-production branches
use `versions upload` automatically — that is correct and expected for previews.

**The Worker name in `wrangler.jsonc` must match the Worker in the dashboard.**
A mismatch does not error — it silently creates a *second* Worker and leaves the
custom domain pointed at the old one.

## 2. Point the domain at it

1. Worker → **Domains & Routes** → **Add** → **Custom domain**.
2. Enter `helazhary.com` → **Add domain**.

Because the domain is already in the Cloudflare account, DNS is created for you
and HTTPS is issued automatically. Usually live within a few minutes.

3. Repeat for `www.helazhary.com` if you want it to resolve too.

## 3. Verify

- https://helazhary.com loads the real site (not a Hello World placeholder).
- The padlock is present.
- Security headers are applied:

```bash
curl -sI https://helazhary.com | grep -i -E 'content-security|strict-transport|x-frame|x-content-type'
```

If those are missing, `public/_headers` did not make it into `out/`. Confirm
locally with `npm run build && cat out/_headers`.

- A deep link works: https://helazhary.com/projects/nir-spectroscopy/
- An unknown path serves the 404 page, not a blank response.

---

## Day-to-day

- Push to `main` → production deploys automatically.
- Open a pull request → Cloudflare builds a preview version with its own URL.
- Build logs: Worker → **Deployments** → **View build**.
- Roll back: **Deployments** → find a known-good version → **Rollback**.

## Troubleshooting

**Every build fails and the live site is a Hello World.**
The Worker was created from the Hello World template and no build has succeeded
since, so the template is still the active version. Fix the build; the
placeholder disappears with the first green deploy.

**Build fails with a missing entrypoint or missing config.**
`wrangler.jsonc` is absent or the deploy command runs from the wrong directory.
A static-assets Worker needs no `main`, but it does need `assets.directory`.

**Build succeeds, deploy succeeds, live site unchanged.**
The deploy command is `wrangler versions upload`, which stages a version without
routing traffic to it. Production needs `wrangler deploy`.

**Deploy succeeds but the domain still shows the old site.**
The `name` in `wrangler.jsonc` does not match the Worker holding the custom
domain. Check Workers & Pages for a duplicate.

## Optional hardening, once it is live

- **Branch protection:** GitHub repo → Settings → Branches → protect `main`,
  require the `check` status check to pass before merging.
- **Cloudflare Access** on preview URLs, if you would rather they not be public.
