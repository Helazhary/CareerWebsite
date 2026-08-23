# Connecting the repo to Cloudflare Pages

One-time setup. After this, pushing to `main` deploys the site.

You need: the GitHub repo (done) and `helazhary.com` in your Cloudflare account
(done).

---

## 1. Create the Pages project

1. Go to https://dash.cloudflare.com → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Authorise Cloudflare for GitHub if prompted. Grant it access to
   **`Helazhary/CareerWebsite`** only — not all repositories.
3. Select the `CareerWebsite` repo and click **Begin setup**.

## 2. Build settings

| Field | Value |
| --- | --- |
| Project name | `careerwebsite` |
| Production branch | `main` |
| Framework preset | **Next.js (Static HTML Export)** — or **None** |
| Build command | `npm run build` |
| Build output directory | `out` |
| Root directory | *(leave blank)* |

Then expand **Environment variables (advanced)** and add:

| Variable | Value |
| --- | --- |
| `NODE_VERSION` | `22` |

That last one matters. Cloudflare defaults to an older Node and the build will
fail without it.

Click **Save and Deploy**. The first build takes a minute or two. When it
finishes you get a URL like `careerwebsite-abc.pages.dev` — open it and confirm
the site loads.

## 3. Point the domain at it

1. In the Pages project, open the **Custom domains** tab.
2. **Set up a custom domain** → enter `helazhary.com` → **Continue** → **Activate domain**.

Because the domain is already in your Cloudflare account, the DNS record is
created for you and HTTPS is issued automatically. It usually goes live within a
few minutes.

3. Repeat for `www.helazhary.com` if you want it to work too — Cloudflare will
   redirect it to the apex domain.

## 4. Verify

- https://helazhary.com loads.
- The padlock is present, and https works.
- Security headers are applied — check with:

```bash
curl -sI https://helazhary.com | grep -i -E 'content-security|strict-transport|x-frame|x-content-type'
```

If those headers are missing, `public/_headers` did not make it into `out/`.
Confirm with `npm run build && cat out/_headers`.

---

## Day-to-day after setup

- Push to `main` → production deploys automatically.
- Open a pull request → Cloudflare builds a **preview URL** for that branch, so
  you can look at a change before it is public.
- Build logs: Pages project → **Deployments** → click a deployment.
- Roll back: **Deployments** → find a known-good one → **Rollback to this deployment**.

## Optional hardening, once it is live

- **Branch protection:** GitHub repo → Settings → Branches → protect `main`,
  require the `check` status check to pass before merging.
- **Cloudflare Access** on preview URLs, if you would rather they not be public.
