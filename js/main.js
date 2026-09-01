// Cookie consent + Google Analytics (GA loads only after the visitor accepts)
(function () {
  var GA_ID = 'G-M5EHVH5XMX';
  function loadGA() {
    if (window.__gaLoaded) return; window.__gaLoaded = true;
    var s = document.createElement('script'); s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    gtag('config', GA_ID, { anonymize_ip: true });
  }
  var choice = null;
  try { choice = localStorage.getItem('tv-consent'); } catch (e) {}
  if (choice === 'accepted') { loadGA(); return; }
  if (choice === 'declined') { return; }

  function setChoice(v) { try { localStorage.setItem('tv-consent', v); } catch (e) {} }
  function dismiss(b) { b.classList.remove('show'); setTimeout(function () { if (b.parentNode) b.parentNode.removeChild(b); }, 300); }
  function showBanner() {
    var b = document.createElement('div');
    b.className = 'cookie-banner'; b.setAttribute('role', 'dialog'); b.setAttribute('aria-label', 'Cookie consent');
    b.innerHTML = '<p>We use cookies to analyze site traffic and improve your experience. See our <a href="/privacy">Privacy Policy</a>.</p>'
      + '<div class="cookie-actions"><button type="button" class="btn btn--dark" data-cc="decline">Decline</button>'
      + '<button type="button" class="btn btn--primary" data-cc="accept">Accept</button></div>';
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('show'); });
    b.querySelector('[data-cc="accept"]').addEventListener('click', function () { setChoice('accepted'); loadGA(); dismiss(b); });
    b.querySelector('[data-cc="decline"]').addEventListener('click', function () { setChoice('declined'); dismiss(b); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', showBanner);
  else showBanner();
})();

// TecheVision — interactions + per-page sci-fi hero effects
document.addEventListener('DOMContentLoaded', function () {
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    links.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { links.classList.remove('open'); }); });
  }
  document.querySelectorAll('#year').forEach(function (y) { y.textContent = new Date().getFullYear(); });

  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('in'); }); }

  // Apply buttons: prefill the role and jump to the application form
  document.querySelectorAll('[data-role]').forEach(function (el) {
    el.addEventListener('click', function () {
      var r = document.getElementById('j-role');
      if (r) r.value = el.getAttribute('data-role');
    });
  });

  // Service detail modal
  var modal = document.getElementById('service-modal');
  if (modal) {
    var mbody = modal.querySelector('.modal-body');
    var openModal = function (key) {
      var src = document.getElementById('svc-' + key);
      if (!src) return;
      mbody.innerHTML = src.innerHTML;
      modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
    };
    var closeModal = function () {
      modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    };
    document.querySelectorAll('[data-service]').forEach(function (c) {
      c.addEventListener('click', function () { openModal(c.getAttribute('data-service')); });
    });
    modal.querySelectorAll('[data-close]').forEach(function (x) { x.addEventListener('click', closeModal); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeModal(); });
  }

  // Home-page service tiles link through to the Services page
  document.querySelectorAll('.service-grid .service').forEach(function (el) {
    el.style.cursor = 'pointer';
    el.addEventListener('click', function () { window.location.href = '/services'; });
  });

  // FAQ live search
  var faqSearch = document.getElementById('faq-search');
  if (faqSearch) {
    var faqItems = Array.prototype.slice.call(document.querySelectorAll('.faq details'));
    var faqNone = document.getElementById('faq-none');
    faqSearch.addEventListener('input', function () {
      var q = faqSearch.value.trim().toLowerCase(), shown = 0;
      faqItems.forEach(function (d) {
        var match = q === '' || d.textContent.toLowerCase().indexOf(q) >= 0;
        d.style.display = match ? '' : 'none';
        d.open = !!(q && match);
        if (match) shown++;
      });
      if (faqNone) faqNone.hidden = shown > 0;
    });
  }

  initHeroFX();
});

function initHeroFX() {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var mode = hero.getAttribute('data-fx') || 'network';
  var canvas = document.createElement('canvas');
  canvas.className = 'hero-fx';
  hero.insertBefore(canvas, hero.firstChild);
  var ctx = canvas.getContext('2d');
  var w = 0, h = 0, dpr = 1;
  var mouse = { x: null, y: null };
  var spin = 0, dragging = false, lastX = 0;
  if (mode === 'globe' || mode === 'orbit') hero.style.cursor = 'grab';
  var P = [];   // particles / points
  var t = 0;

  var MINT = '129,253,218', TEAL = '95,224,192';

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    P = [];
    var n, i;
    if (mode === 'network' || mode === 'globe') {
      n = mode === 'globe' ? 140 : Math.max(28, Math.min(95, Math.floor(w * h / 17000)));
      if (mode === 'globe') {
        var ga = Math.PI * (3 - Math.sqrt(5));
        for (i = 0; i < n; i++) { var yy = 1 - (i + 0.5) / n * 2; var rad = Math.sqrt(1 - yy * yy); P.push({ y0: yy, r0: rad, ph: ga * i }); }
      } else {
        for (i = 0; i < n; i++) P.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - .5) * .45, vy: (Math.random() - .5) * .45, r: Math.random() * 1.6 + .8 });
      }
    } else if (mode === 'orbit') {
      for (i = 0; i < 40; i++) { var ring = 1 + (i % 3); P.push({ a: Math.random() * 6.283, sp: (0.0016 + Math.random() * 0.0022) * (i % 2 ? 1 : -1), rr: 60 + ring * 46 + Math.random() * 14, r: Math.random() * 1.8 + 1 }); }
    } else if (mode === 'rise') {
      n = Math.max(30, Math.min(90, Math.floor(w * h / 18000)));
      for (i = 0; i < n; i++) P.push({ x: Math.random() * w, y: Math.random() * h, sp: 0.3 + Math.random() * 0.7, sway: Math.random() * 6.283, r: Math.random() * 1.8 + .7 });
    } else if (mode === 'ripple') {
      for (i = 0; i < 5; i++) P.push({ x: Math.random() * w, y: Math.random() * h, rad: Math.random() * 200, sp: 0.4 + Math.random() * 0.6 });
    }
  }

  hero.addEventListener('mousemove', function (e) { var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top; });
  hero.addEventListener('mouseleave', function () { mouse.x = mouse.y = null; });
  if (mode === 'globe' || mode === 'orbit') {
    hero.addEventListener('pointerdown', function (e) { dragging = true; lastX = e.clientX; hero.style.cursor = 'grabbing'; });
    window.addEventListener('pointermove', function (e) { if (dragging) { document.body.style.userSelect = 'none'; spin += (e.clientX - lastX) * 0.006; lastX = e.clientX; } });
    window.addEventListener('pointerup', function () { if (dragging) { dragging = false; hero.style.cursor = 'grab'; document.body.style.userSelect = ''; } });
  }

  function dot(x, y, r, alpha, color) {
    ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283);
    ctx.fillStyle = 'rgba(' + (color || MINT) + ',' + alpha + ')';
    ctx.shadowColor = 'rgba(' + MINT + ',0.9)'; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
  }
  function line(x1, y1, x2, y2, alpha, color) {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2);
    ctx.strokeStyle = 'rgba(' + (color || TEAL) + ',' + alpha + ')'; ctx.lineWidth = 1; ctx.stroke();
  }

  function frame() {
    t += 1; ctx.clearRect(0, 0, w, h);

    if (mode === 'network') {
      var LINK = 132, ML = 180, i, j;
      for (i = 0; i < P.length; i++) { var p = P[i]; p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > w) p.vx *= -1; if (p.y < 0 || p.y > h) p.vy *= -1; dot(p.x, p.y, p.r, .85); }
      for (i = 0; i < P.length; i++) {
        for (j = i + 1; j < P.length; j++) { var dx = P[i].x - P[j].x, dy = P[i].y - P[j].y, d = Math.sqrt(dx * dx + dy * dy); if (d < LINK) line(P[i].x, P[i].y, P[j].x, P[j].y, .18 * (1 - d / LINK)); }
        if (mouse.x != null) { var mx = P[i].x - mouse.x, my = P[i].y - mouse.y, md = Math.sqrt(mx * mx + my * my); if (md < ML) line(P[i].x, P[i].y, mouse.x, mouse.y, .32 * (1 - md / ML), MINT); }
      }

    } else if (mode === 'orbit') {
      var cx = w > 900 ? w * 0.72 : w * 0.5, cy = h * 0.5;
      ctx.strokeStyle = 'rgba(' + TEAL + ',0.10)';
      for (var rr = 1; rr <= 4; rr++) { ctx.beginPath(); ctx.arc(cx, cy, 60 + rr * 46, 0, 6.283); ctx.stroke(); }
      dot(cx, cy, 4, 1);
      for (var k = 0; k < P.length; k++) { var o = P[k]; o.a += o.sp; var x = cx + Math.cos(o.a + spin) * o.rr, y = cy + Math.sin(o.a + spin) * o.rr; line(cx, cy, x, y, .05); dot(x, y, o.r, .85); }

    } else if (mode === 'radar') {
      var rx = w > 900 ? w * 0.74 : w * 0.5, ry = h * 0.5, R = Math.min(w, h) * 0.42;
      ctx.strokeStyle = 'rgba(' + TEAL + ',0.12)';
      for (var g = 1; g <= 4; g++) { ctx.beginPath(); ctx.arc(rx, ry, R * g / 4, 0, 6.283); ctx.stroke(); }
      line(rx - R, ry, rx + R, ry, .08); line(rx, ry - R, rx, ry + R, .08);
      var ang = t * 0.02;
      var grad = ctx.createConicGradient ? null : null;
      ctx.save(); ctx.beginPath(); ctx.moveTo(rx, ry);
      ctx.arc(rx, ry, R, ang - 0.5, ang); ctx.closePath();
      ctx.fillStyle = 'rgba(' + MINT + ',0.10)'; ctx.fill(); ctx.restore();
      line(rx, ry, rx + Math.cos(ang) * R, ry + Math.sin(ang) * R, .5, MINT);
      // blips
      for (var bi = 0; bi < 6; bi++) { var ba = bi * 1.05, bd = (0.35 + (bi % 3) * 0.22) * R; var bx = rx + Math.cos(ba) * bd, by = ry + Math.sin(ba) * bd; var pulse = (Math.sin(t * 0.05 + bi) + 1) / 2; dot(bx, by, 2 + pulse * 2, .4 + pulse * 0.5); }

    } else if (mode === 'globe') {
      var gx = w > 900 ? w * 0.72 : w * 0.5, gy = h * 0.5, GR = Math.min(w, h) * 0.32, rot = t * 0.004 + spin;
      var pts = [];
      for (var m = 0; m < P.length; m++) { var q = P[m]; var ph = q.ph + rot; var X = q.r0 * Math.cos(ph), Z = q.r0 * Math.sin(ph); var sx = gx + X * GR, sy = gy + q.y0 * GR; var depth = (Z + 1) / 2; pts.push({ x: sx, y: sy, z: Z, dp: depth }); dot(sx, sy, 0.6 + depth * 1.8, 0.25 + depth * 0.7); }
      for (var a2 = 0; a2 < pts.length; a2 += 7) { for (var b2 = a2 + 1; b2 < pts.length; b2 += 11) { var ddx = pts[a2].x - pts[b2].x, ddy = pts[a2].y - pts[b2].y, dd = Math.sqrt(ddx * ddx + ddy * ddy); if (dd < 70) line(pts[a2].x, pts[a2].y, pts[b2].x, pts[b2].y, .12 * pts[a2].dp); } }

    } else if (mode === 'rise') {
      var i2;
      for (i2 = 0; i2 < P.length; i2++) { var s = P[i2]; s.y -= s.sp; s.sway += 0.01; if (s.y < -6) { s.y = h + 6; s.x = Math.random() * w; } var sx2 = s.x + Math.sin(s.sway) * 8; dot(sx2, s.y, s.r, .7); }
      for (i2 = 0; i2 < P.length; i2++) { for (var j2 = i2 + 1; j2 < P.length; j2++) { var ex = P[i2].x - P[j2].x, ey = P[i2].y - P[j2].y, ed = Math.sqrt(ex * ex + ey * ey); if (ed < 96) line(P[i2].x + Math.sin(P[i2].sway) * 8, P[i2].y, P[j2].x + Math.sin(P[j2].sway) * 8, P[j2].y, .12 * (1 - ed / 96)); } }

    } else if (mode === 'ripple') {
      for (var ri = 0; ri < P.length; ri++) { var rp = P[ri]; rp.rad += rp.sp; if (rp.rad > 240) { rp.rad = 0; rp.x = Math.random() * w; rp.y = Math.random() * h; } var al = Math.max(0, 0.35 * (1 - rp.rad / 240)); ctx.beginPath(); ctx.arc(rp.x, rp.y, rp.rad, 0, 6.283); ctx.strokeStyle = 'rgba(' + MINT + ',' + al + ')'; ctx.lineWidth = 1.3; ctx.stroke(); dot(rp.x, rp.y, 2, al + 0.2); }
    }
    requestAnimationFrame(frame);
  }

  build();
  var rt; window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 200); });
  requestAnimationFrame(frame);
}
