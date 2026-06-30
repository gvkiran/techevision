# TecheVision Website

The official website for **TecheVision** — IT consulting services. This is a plain, static
HTML/CSS/JS site (no build step, no framework), hosted free on **GitHub Pages** with the custom
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
├── careers.html      # Careers (job openings + apply form)
├── css/styles.css    # All styling (colors are CSS variables at the top)
├── js/main.js        # Mobile menu + auto footer year
├── CNAME             # Custom domain for GitHub Pages (techevision.com)
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

GitHub Pages redeploys automatically within ~1 minute of each push.

## Forms

The contact and careers forms post to **FormSubmit** (https://formsubmit.co), a free service
that emails submissions to `contact@techevision.com` — no server required.

> **One-time activation:** the first time a form is submitted, FormSubmit emails
> `contact@techevision.com` an activation link. Click it once and all future submissions
> are delivered automatically. To switch providers later (e.g. Formspree), just change the
> `action="..."` URL on each `<form>`.

## Hosting & domain

- **Hosting:** GitHub Pages (free, automatic HTTPS).
- **Domain:** `techevision.com` stays registered at GoDaddy; only the DNS records point to
  GitHub Pages. See the migration notes shared in chat for the exact DNS values.
