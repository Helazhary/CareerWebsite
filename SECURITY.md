# Security

## Posture

This site is a **static export**. `next build` emits plain HTML, CSS, JS, and
images; Cloudflare Pages serves that folder from its CDN. There is no server, no
database, no runtime secrets, and no user input. The attack surface is a CDN
serving immutable files.

## Controls

| Control | Where |
| --- | --- |
| Content-Security-Policy, HSTS, `X-Frame-Options`, `Permissions-Policy`, `nosniff` | `public/_headers` |
| No third-party scripts, fonts, or analytics | enforced by CSP `default-src 'self'` |
| Email address never present in served HTML | `src/doc/Contact.tsx` assembles it client-side |
| No phone number or address published | the PDF resume is sent directly instead |
| Dependency updates | Dependabot, weekly, grouped |
| Vulnerability gate | `npm audit --audit-level=high` in CI |
| Type and lint gate | `npm run check` in CI on every PR |

## Known limitation: `script-src 'unsafe-inline'`

Next.js static export emits two inline `<script>` tags per page — a bootstrap
line and the React flight payload. Static export cannot use a CSP nonce, because
nonces must be generated per response and there is no server generating
responses.

The alternative is per-page `sha256-` hashes generated at build time. That is
tracked as a hardening task, deliberately deferred: a stale or mis-generated hash
silently renders a blank page in production, and the risk it mitigates here is
close to zero — the site has no user input, no query-parameter rendering, no
third-party embeds, and no dynamic content of any kind. There is no injection
path for the policy to close.

If that changes — a contact form, a comment widget, any embedded third-party
content — the hash generator gets built before that feature ships.

## Reporting

Found something? Email the address in the site footer, or open an issue at
https://github.com/Helazhary/CareerWebsite/issues.
