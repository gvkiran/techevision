// Form handler for the Contact and Job-application forms.
// Receives the form POST, checks it, and emails it to contact@techevision.com
// through Zoho SMTP using the contact@ mailbox itself (so SPF/DKIM/DMARC pass).
//
// Required Vercel environment variables (Project → Settings → Environment Variables):
//   SMTP_USER  = contact@techevision.com
//   SMTP_PASS  = Zoho app-specific password for that mailbox (never the login password)
// Optional:
//   SMTP_HOST  = smtppro.zoho.com (default)     SMTP_PORT = 465 (default, SSL)
//   MAIL_TO    = where submissions go (default: SMTP_USER)

const nodemailer = require('nodemailer');

const FORMS = {
  contact: {
    subject: (f) => 'New contact from techevision.com' + (f.subject_line ? ': ' + f.subject_line : ''),
    required: ['email'],
    fields: [
      ['name', 'Name', 120],
      ['email', 'Email', 254],
      ['subject_line', 'Subject', 200],
      ['message', 'Message', 5000],
    ],
  },
  application: {
    subject: (f) => 'New job application' + (f.role ? ': ' + f.role : '') + (f.name ? ' (' + f.name + ')' : ''),
    required: ['name', 'phone', 'email', 'visa_type', 'sponsorship_required'],
    fields: [
      ['name', 'Name', 120],
      ['phone', 'Phone', 40],
      ['email', 'Email', 254],
      ['role', 'Role', 200],
      ['visa_type', 'Visa / work authorization', 100],
      ['visa_validity', 'Visa validity', 100],
      ['sponsorship_required', 'Sponsorship required', 100],
      ['message', 'Message', 5000],
    ],
  },
};

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[^\s@<>()",;:]{2,}$/;

// Best-effort per-instance rate limit: 5 submissions per IP per 10 minutes.
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now(), win = 10 * 60 * 1000;
  const list = (hits.get(ip) || []).filter((t) => now - t < win);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > 5;
}

function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function oneLine(s) { return String(s).replace(/[\r\n\t]+/g, ' ').trim(); }

function parseBody(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === 'string') return Object.fromEntries(new URLSearchParams(b));
  if (Buffer.isBuffer(b)) return Object.fromEntries(new URLSearchParams(b.toString('utf8')));
  return b;
}

function page(res, status, title, msg) {
  res.status(status).setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send('<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />'
    + '<meta name="robots" content="noindex" /><title>' + esc(title) + ' | TecheVision</title><link rel="stylesheet" href="/css/styles.css" /></head>'
    + '<body><section class="section"><div class="container" style="max-width:640px;text-align:center;padding:80px 20px">'
    + '<h1>' + esc(title) + '</h1><p>' + msg + '</p>'
    + '<p><a class="btn btn--primary" href="javascript:history.back()">Go back</a></p></div></section></body></html>');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).send('Method Not Allowed');
  }

  // Only accept posts coming from this site's own pages.
  const host = (req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase();
  const origin = req.headers.origin;
  if (origin && origin !== 'null') {
    let oh = '';
    try { oh = new URL(origin).host.toLowerCase(); } catch (e) {}
    if (oh !== host) return page(res, 403, 'Not allowed', 'Please use the form on techevision.com.');
  }

  const f = parseBody(req);
  const ip = oneLine((req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown');
  const back = '/thanks';

  // Spam traps: hidden field must stay empty; a form filled in under 3 seconds is a bot.
  if (f._gotcha) return res.redirect(303, back);
  const started = Number(f._ts);
  if (started && Date.now() - started < 3000) return res.redirect(303, back);

  if (rateLimited(ip)) {
    return page(res, 429, 'Too many submissions', 'Please wait a few minutes and try again, or email us at <a href="mailto:contact@techevision.com">contact@techevision.com</a>.');
  }

  const type = FORMS[f.form_type] ? f.form_type : 'contact';
  const def = FORMS[type];
  const data = {};
  for (const [key, , max] of def.fields) {
    let v = typeof f[key] === 'string' ? f[key].trim() : '';
    if (v.length > max) v = v.slice(0, max);
    data[key] = v;
  }
  const missing = def.required.filter((k) => !data[k]);
  if (missing.length || !EMAIL_RE.test(data.email)) {
    return page(res, 400, 'Please check the form', 'A required field is missing or the email address looks invalid. Please go back and try again.');
  }

  const user = process.env.SMTP_USER, pass = process.env.SMTP_PASS;
  if (!user || !pass) {
    console.error('[contact] SMTP_USER / SMTP_PASS not configured');
    return page(res, 500, 'Message not sent', 'Sorry, our form is temporarily unavailable. Please email us directly at <a href="mailto:contact@techevision.com">contact@techevision.com</a>.');
  }

  const rows = def.fields
    .filter(([key]) => data[key])
    .map(([key, label]) => '<tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f6f8f7;font-weight:bold;vertical-align:top;white-space:nowrap">'
      + esc(label) + '</td><td style="padding:8px 12px;border:1px solid #ddd;white-space:pre-wrap">' + esc(data[key]) + '</td></tr>')
    .join('');
  const text = def.fields.filter(([key]) => data[key]).map(([key, label]) => label + ': ' + data[key]).join('\n');
  const meta = 'Submitted ' + new Date().toUTCString() + ' from ' + (host || 'techevision.com');

  try {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtppro.zoho.com',
      port: Number(process.env.SMTP_PORT || 465),
      secure: Number(process.env.SMTP_PORT || 465) === 465,
      auth: { user, pass },
      connectionTimeout: 10000, greetingTimeout: 10000, socketTimeout: 15000,
    });
    await transport.sendMail({
      from: { name: 'TecheVision Website', address: user },
      to: process.env.MAIL_TO || user,
      replyTo: { name: oneLine(data.name || data.email), address: data.email },
      subject: oneLine(def.subject(data)).slice(0, 200),
      text: text + '\n\n' + meta,
      html: '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' + rows + '</table>'
        + '<p style="color:#888;font-size:12px;font-family:Arial,sans-serif">' + esc(meta) + '</p>',
    });
  } catch (err) {
    console.error('[contact] send failed:', err && (err.code || ''), err && err.message);
    return page(res, 502, 'Message not sent', 'Sorry, something went wrong sending your message. Please try again in a minute, or email us directly at <a href="mailto:contact@techevision.com">contact@techevision.com</a>.');
  }

  return res.redirect(303, back);
};
