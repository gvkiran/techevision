// Cloudflare Pages version of the form handler (same rules as api/contact.js, which Vercel uses).
// Receives the Contact / Job-application form POST, checks it, and emails it to
// contact@techevision.com through Zoho SMTP, signed in as contact@ (so SPF/DKIM/DMARC pass).
//
// Cloudflare doesn't run nodemailer, so this file talks SMTP directly over a TLS socket
// (cloudflare:sockets). Port 465 is allowed; only port 25 is blocked on Cloudflare.
//
// Cloudflare environment variables (Pages project → Settings → Variables and Secrets):
//   SMTP_USER  = contact@techevision.com
//   SMTP_PASS  = Zoho app-specific password for that mailbox (type: Secret)
// Optional:
//   SMTP_HOST  = smtppro.zoho.com (default)     SMTP_PORT = 465 (default, SSL)
//   MAIL_TO    = where submissions go (default: SMTP_USER)

import { connect } from 'cloudflare:sockets';

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

// Domains no outside visitor would use as their own address.
const OWN_DOMAINS = ['techevision.com'];

// Logs which spam rule caught a submission (no personal data), visible in Cloudflare real-time logs.
function drop(reason) { console.log('[contact] blocked: ' + reason); }

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

function page(status, title, msg) {
  const html = '<!DOCTYPE html><html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />'
    + '<meta name="robots" content="noindex" /><title>' + esc(title) + ' | TecheVision</title><link rel="stylesheet" href="/css/styles.css" /></head>'
    + '<body><section class="section"><div class="container" style="max-width:640px;text-align:center;padding:80px 20px">'
    + '<h1>' + esc(title) + '</h1><p>' + msg + '</p>'
    + '<p><a class="btn btn--primary" href="javascript:history.back()">Go back</a></p></div></section></body></html>';
  return new Response(html, { status, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } });
}

function redirect(request, path) {
  return new Response(null, { status: 303, headers: { Location: new URL(path, request.url).toString(), 'Cache-Control': 'no-store' } });
}

// ---------- Email building ----------

function b64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}
function wrap76(s) { return s.replace(/.{1,76}/g, '$&\r\n'); }
// Header text: plain ASCII as-is, otherwise RFC 2047 encoded-word.
function hdr(s) { return /^[\x20-\x7e]*$/.test(s) ? s : '=?UTF-8?B?' + b64(s) + '?='; }
function addr(name, email) {
  const n = oneLine(name || '').replace(/["\\]/g, '');
  return n ? (/^[\x20-\x7e]*$/.test(n) ? '"' + n + '"' : hdr(n)) + ' <' + email + '>' : '<' + email + '>';
}

function buildMessage({ from, fromName, to, replyTo, replyName, subject, text, html }) {
  const boundary = 'tv-' + crypto.randomUUID();
  return [
    'From: ' + addr(fromName, from),
    'To: <' + to + '>',
    'Reply-To: ' + addr(replyName, replyTo),
    'Subject: ' + hdr(subject),
    'Date: ' + new Date().toUTCString().replace('GMT', '+0000'),
    'Message-ID: <' + crypto.randomUUID() + '@techevision.com>',
    'MIME-Version: 1.0',
    'Content-Type: multipart/alternative; boundary="' + boundary + '"',
    '',
    '--' + boundary,
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(text)),
    '--' + boundary,
    'Content-Type: text/html; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    '',
    wrap76(b64(html)),
    '--' + boundary + '--',
    '',
  ].join('\r\n');
}

// ---------- Minimal SMTP client (implicit TLS on 465) ----------

async function smtpSend({ host, port, secure, user, pass, from, to, message }) {
  const socket = connect({ hostname: host, port }, { secureTransport: secure ? 'on' : 'off' });
  const writer = socket.writable.getWriter();
  const reader = socket.readable.getReader();
  const enc = new TextEncoder(), dec = new TextDecoder();
  let buf = '';

  async function reply() {
    const lines = [];
    for (;;) {
      let i;
      while ((i = buf.indexOf('\r\n')) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        lines.push(line);
        if (/^\d{3}(?: |$)/.test(line)) return { code: Number(line.slice(0, 3)), text: lines.join(' | ') };
      }
      const { value, done } = await reader.read();
      if (done) throw new Error('connection closed by server');
      buf += dec.decode(value, { stream: true });
    }
  }
  async function step(name, line, ok) {
    if (line !== null) await writer.write(enc.encode(line + '\r\n'));
    const r = await reply();
    if (!ok.includes(r.code)) throw new Error(name + ' failed: ' + r.code + ' ' + r.text.slice(0, 200));
    return r;
  }

  const run = (async () => {
    await step('greeting', null, [220]);
    await step('EHLO', 'EHLO techevision.com', [250]);
    await step('AUTH', 'AUTH PLAIN ' + b64('\0' + user + '\0' + pass), [235]);
    await step('MAIL FROM', 'MAIL FROM:<' + from + '>', [250]);
    await step('RCPT TO', 'RCPT TO:<' + to + '>', [250, 251]);
    await step('DATA', 'DATA', [354]);
    // Dot-stuffing: any line starting with "." gets an extra ".".
    const body = message.replace(/\r?\n/g, '\r\n').replace(/^\./gm, '..');
    await step('message', body + (body.endsWith('\r\n') ? '' : '\r\n') + '.', [250]);
    try { await writer.write(enc.encode('QUIT\r\n')); } catch (e) {}
  })();

  let timer;
  const timeout = new Promise((_, rej) => { timer = setTimeout(() => rej(new Error('timed out')), 20000); });
  try {
    await Promise.race([run, timeout]);
  } finally {
    clearTimeout(timer);
    try { await socket.close(); } catch (e) {}
  }
}

// ---------- Request handler ----------

export async function onRequest({ request, env }) {
  if (request.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
  }

  // Only accept posts coming from this site's own pages (same rule as the Vercel version).
  const host = new URL(request.url).host.toLowerCase();
  const o = request.headers.get('origin');
  const origin = o && o !== 'null' ? o : request.headers.get('referer');
  let oh = '';
  try { oh = new URL(origin).host.toLowerCase(); } catch (e) {}
  if (!origin) {
    drop('no-origin');
    return page(400, 'Message not sent', 'Please send your message from the form on techevision.com, or email us directly at <a href="mailto:contact@techevision.com">contact@techevision.com</a>.');
  }
  if (oh !== host) return page(403, 'Not allowed', 'Please use the form on techevision.com.');

  let f = {};
  try {
    const fd = await request.formData();
    for (const [k, v] of fd.entries()) if (typeof v === 'string') f[k] = v;
  } catch (e) { f = {}; }
  const ip = oneLine(request.headers.get('cf-connecting-ip') || 'unknown');
  const back = '/thanks';

  // Spam traps. Bots are sent to the normal thank-you page so they learn nothing.
  if (f._gotcha) { drop('honeypot'); return redirect(request, back); }
  const started = Number(f._ts), age = Date.now() - started;
  if (!started) {
    drop('no-timestamp');
    return page(400, 'Message not sent', 'Please reload the page and try again (the form needs JavaScript turned on), or email us directly at <a href="mailto:contact@techevision.com">contact@techevision.com</a>.');
  }
  if (age < 3000) { drop('too-fast'); return redirect(request, back); }
  if (age > 24 * 60 * 60 * 1000 || age < -60000) {
    drop('stale-timestamp');
    return page(400, 'Message not sent', 'This page has been open a long time. Please reload it and send your message again.');
  }

  if (rateLimited(ip)) {
    return page(429, 'Too many submissions', 'Please wait a few minutes and try again, or email us at <a href="mailto:contact@techevision.com">contact@techevision.com</a>.');
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
    return page(400, 'Please check the form', 'A required field is missing or the email address looks invalid. Please go back and try again.');
  }

  const senderDomain = data.email.split('@').pop().toLowerCase();
  if (OWN_DOMAINS.includes(senderDomain)) {
    drop('own-domain-sender');
    return page(400, 'Please use your own email address', 'Enter the email address where you would like us to reply, then send your message again.');
  }

  const user = env.SMTP_USER, pass = env.SMTP_PASS;
  if (!user || !pass) {
    console.error('[contact] SMTP_USER / SMTP_PASS not configured');
    return page(500, 'Message not sent', 'Sorry, our form is temporarily unavailable. Please email us directly at <a href="mailto:contact@techevision.com">contact@techevision.com</a>.');
  }

  const rows = def.fields
    .filter(([key]) => data[key])
    .map(([key, label]) => '<tr><td style="padding:8px 12px;border:1px solid #ddd;background:#f6f8f7;font-weight:bold;vertical-align:top;white-space:nowrap">'
      + esc(label) + '</td><td style="padding:8px 12px;border:1px solid #ddd;white-space:pre-wrap">' + esc(data[key]) + '</td></tr>')
    .join('');
  const text = def.fields.filter(([key]) => data[key]).map(([key, label]) => label + ': ' + data[key]).join('\n');
  const meta = 'Submitted ' + new Date().toUTCString() + ' from ' + (host || 'techevision.com');
  // Mark mail from the Cloudflare test address so it's easy to tell apart from real enquiries.
  const testTag = host.endsWith('.pages.dev') || host.startsWith('localhost') ? '[Cloudflare TEST] ' : '';

  const port = Number(env.SMTP_PORT || 465);
  try {
    await smtpSend({
      host: env.SMTP_HOST || 'smtppro.zoho.com',
      port,
      secure: env.SMTP_SECURE ? env.SMTP_SECURE !== 'off' : port === 465,
      user, pass,
      from: user,
      to: env.MAIL_TO || user,
      message: buildMessage({
        from: user, fromName: 'TecheVision Website',
        to: env.MAIL_TO || user,
        replyTo: data.email, replyName: data.name || data.email,
        subject: (testTag + oneLine(def.subject(data))).slice(0, 200),
        text: text + '\n\n' + meta,
        html: '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' + rows + '</table>'
          + '<p style="color:#888;font-size:12px;font-family:Arial,sans-serif">' + esc(meta) + '</p>',
      }),
    });
  } catch (err) {
    console.error('[contact] send failed:', err && err.message);
    return page(502, 'Message not sent', 'Sorry, something went wrong sending your message. Please try again in a minute, or email us directly at <a href="mailto:contact@techevision.com">contact@techevision.com</a>.');
  }

  return redirect(request, back);
}
