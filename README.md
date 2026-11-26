# TecheVision Website

The official website for **TecheVision** — IT consulting services. This is a plain, static
HTML/CSS/JS site (no build step, no framework), hosted on **Vercel** (auto-deploys from this GitHub repo) with the custom
domain **techevision.com**.

It replaces the old GoDaddy Website Builder site so the content is fully owned and editable here.

## Structure

```
.
├── index.html        # Home
├── services.html     # Services
├── clients.html      # Clients
├── contact.html      # Contact (form + hours)
├── faqs.html         # FAQ's
├── jobs.html         # Careers (job openings + apply form)
├── api/contact.js    # Form handler (emails submissions via Zoho SMTP)
├── css/styles.css    # All styling (colors are CSS variables at the top)
├── js/main.js        # Mobile menu + auto footer year
├── vercel.json       # Vercel config: clean URLs + security headers
└── .nojekyll         # Tells GitHub Pages to serve files as-is
```

## Edit the site

Open any `.html` file and edit the text directly. To change brand colors site-wide,
edit the variables at the top of `css/styles.css` (e.g. `--navy`, `--accent`).

### Preview locally
Just double-click `index.html` to open it in your browser. (Optional: run a local server
with `python -m http.server` and visit `http://localhost:8000`.)

## Publishing changes

```bash
git add .
git commit -m "Describe your change"
git push
```

Vercel redeploys automatically within ~1 minute of each push.

## Forms

The contact form (`contact.html`) and the job-application form (`jobs.html`) post to our own
serverless function, **`api/contact.js`**, which emails each submission to
`contact@techevision.com` through **Zoho SMTP**, signed in as the contact@ mailbox itself
(so the mail passes SPF/DKIM/DMARC). The visitor's address is set as Reply-To, so you can
just hit Reply. On success the visitor lands on `/thanks`.

It needs two environment variables in Vercel (Project → Settings → Environment Variables,
for **Production** and **Preview**):

| Name | Value |
|---|---|
| `SMTP_USER` | `contact@techevision.com` |
| `SMTP_PASS` | a Zoho **app-specific password** for contact@ (not the login password) |

> If you ever reset the contact@ password or revoke that app password in Zoho, the forms stop
> sending — create a new app password and update `SMTP_PASS` in Vercel, then redeploy.

Spam protection: a hidden "honeypot" field, a required load-time stamp (3 s minimum, 24 h
maximum), a required same-site Origin/Referer, a block on sender addresses at our own domain
(spam bots fake e.g. "elana@techevision.com", so test the form with a non-company address) and
a per-visitor rate limit. Blocked submissions log `[contact] blocked: <reason>` in Vercel. To add a new form, give it `action="/api/contact"`, `method="POST"`,
`data-tv-form`, and add its fields to the `FORMS` list in `api/contact.js`.

## Hosting & domain

- **Hosting:** Vercel (automatic HTTPS). Vercel is connected to this GitHub repo
  and redeploys on every `git push`. Behavior is configured in `vercel.json`
  (clean URLs + security headers).
- **Domain:** `techevision.com` stays registered at GoDaddy; the domain is added and
  verified in the Vercel dashboard (Project → Settings → Domains), with GoDaddy DNS pointing
  to Vercel. (The old GitHub Pages `CNAME` file was removed on purpose — Vercel doesn't use it.)

## Cloudflare Pages (moving off Vercel)

The Cloudflare Pages setup now lives on `main`, so the same commit builds on both hosts
during the cutover. Which one visitors reach is decided only by DNS for `techevision.com`.
Once DNS points at Cloudflare and the site is confirmed working, the Vercel project can be
paused and `api/`, `vercel.json` and `.vercelignore` deleted.

| Cloudflare setting | Value |
|---|---|
| Production branch | `main` |
| Build command | `sh cloudflare-build.sh` |
| Build output directory | `dist` |
| Variables | `SMTP_USER` = contact@techevision.com, `SMTP_PASS` = Zoho app password (Secret) |

- `functions/api/contact.js`: the Cloudflare version of the form handler (same spam rules; sends via Zoho SMTP over port 465).
- `_headers` / `_redirects`: the Cloudflare equivalents of `vercel.json`. The `*.pages.dev` test address is `noindex`, so Google ignores it.
- Form emails sent from the test address have subjects starting with `[Cloudflare TEST]`.
