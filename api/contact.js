// Vercel serverless function — contact messages via Resend
const _formidable = require('formidable');
const formidable = _formidable.formidable || _formidable.default || _formidable;
const { Resend } = require('resend');

const esc = (s) => String(s == null ? '' : s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

module.exports = async (req, res) => {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end('Method not allowed'); }
  try {
    const form = formidable({});
    const [fields] = await form.parse(req);
    const g = (k) => { const v = fields[k]; return Array.isArray(v) ? v[0] : (v || ''); };

    if (g('_gotcha')) { res.writeHead(303, { Location: '/thanks' }); return res.end(); }

    const keys = ['name', 'email', 'subject_line', 'message'];
    const rows = keys.map((k) =>
      `<tr><td style="padding:8px 14px;border:1px solid #e2e8f0;background:#f8fafc"><b>${k.replace(/_/g, ' ')}</b></td><td style="padding:8px 14px;border:1px solid #e2e8f0">${esc(g(k)) || '&mdash;'}</td></tr>`
    ).join('');

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'TecheVision Website <website@techevision.com>',
      to: ['contact@techevision.com'],
      replyTo: g('email') || undefined,
      subject: `New contact: ${g('subject_line') || g('name') || 'Website message'}`,
      html: `<h2 style="font-family:Arial,sans-serif">New website message</h2>
             <table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">${rows}</table>`
    });

    res.writeHead(303, { Location: '/thanks' });
    res.end();
  } catch (e) {
    res.statusCode = 500;
    res.end('Sorry — we could not send your message right now. Please email contact@techevision.com directly.');
  }
};
