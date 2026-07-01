// Vercel serverless function — job applications (with resume attachment) via Resend
const fs = require('fs');
const _formidable = require('formidable');
const formidable = _formidable.formidable || _formidable.default || _formidable;
const { Resend } = require('resend');

const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
  try {
    const form = formidable({ maxFileSize: 6 * 1024 * 1024, keepExtensions: true });
    const [fields, files] = await form.parse(req);
    const g = (k) => { const v = fields[k]; return Array.isArray(v) ? v[0] : (v || ''); };

    // Honeypot: silently accept bots without emailing
    if (g('_gotcha')) { res.writeHead(303, { Location: '/thanks' }); return res.end(); }

    const attachments = [];
    let fa = files.attachment;
    if (fa) {
      const f = Array.isArray(fa) ? fa[0] : fa;
      if (f && f.filepath) attachments.push({ filename: f.originalFilename || 'resume', content: fs.readFileSync(f.filepath) });
    }

    const keys = ['name', 'phone', 'email', 'role', 'visa_type', 'visa_validity', 'sponsorship_required', 'message'];
    const rows = keys.map((k) =>
      `<tr><td style="padding:8px 14px;border:1px solid #e2e8f0;background:#f8fafc"><b>${k.replace(/_/g, ' ')}</b></td><td style="padding:8px 14px;border:1px solid #e2e8f0">${esc(g(k)) || '&mdash;'}</td></tr>`
    ).join('');

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'TecheVision Careers <careers@techevision.com>',
      to: ['contact@techevision.com'],
      replyTo: g('email') || undefined,
      subject: `New job application: ${g('role') || g('name') || 'Applicant'}`,
      html: `<h2 style="font-family:Arial,sans-serif">New job application</h2>
             <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>
             <p style="font-family:Arial,sans-serif;font-size:12px;color:#64748b">Resume ${attachments.length ? 'attached to this email.' : 'was not uploaded.'}</p>`,
      attachments
    });

    res.writeHead(303, { Location: '/thanks' });
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.end('Sorry — we could not send your application right now. Please email contact@techevision.com directly.');
  }
};
