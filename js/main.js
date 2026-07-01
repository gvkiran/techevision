// TecheVision — interactions + sci-fi particle network
document.addEventListener('DOMContentLoaded', function () {
  // Mobile nav
  var toggle = document.querySelector('.nav-toggle');
  var links = document.querySelector('.nav-links');
  if (toggle && links) {
    toggle.addEventListener('click', function () { links.classList.toggle('open'); });
    links.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', function () { links.classList.remove('open'); });
    });
  }

  // Footer year
  document.querySelectorAll('#year').forEach(function (y) { y.textContent = new Date().getFullYear(); });

  // Scroll reveal
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else { reveals.forEach(function (el) { el.classList.add('in'); }); }

  // ---- Particle network in hero ----
  initHeroFX();
});

function initHeroFX() {
  var hero = document.querySelector('.hero');
  if (!hero) return;
  if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var canvas = document.createElement('canvas');
  canvas.className = 'hero-fx';
  hero.insertBefore(canvas, hero.firstChild);
  var ctx = canvas.getContext('2d');
  var w = 0, h = 0, dpr = 1, parts = [];
  var mouse = { x: null, y: null };

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = hero.clientWidth; h = hero.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var count = Math.max(28, Math.min(95, Math.floor(w * h / 17000)));
    parts = [];
    for (var i = 0; i < count; i++) {
      parts.push({ x: Math.random() * w, y: Math.random() * h, vx: (Math.random() - 0.5) * 0.45, vy: (Math.random() - 0.5) * 0.45, r: Math.random() * 1.6 + 0.8 });
    }
  }

  hero.addEventListener('mousemove', function (e) {
    var r = hero.getBoundingClientRect(); mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
  });
  hero.addEventListener('mouseleave', function () { mouse.x = mouse.y = null; });

  var LINK = 132, MLINK = 180;
  function frame() {
    ctx.clearRect(0, 0, w, h);
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 6.283);
      ctx.fillStyle = 'rgba(129,253,218,0.85)';
      ctx.shadowColor = 'rgba(129,253,218,0.8)'; ctx.shadowBlur = 6; ctx.fill(); ctx.shadowBlur = 0;
    }
    for (var a = 0; a < parts.length; a++) {
      for (var b = a + 1; b < parts.length; b++) {
        var dx = parts[a].x - parts[b].x, dy = parts[a].y - parts[b].y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < LINK) {
          ctx.beginPath(); ctx.moveTo(parts[a].x, parts[a].y); ctx.lineTo(parts[b].x, parts[b].y);
          ctx.strokeStyle = 'rgba(95,224,192,' + (0.18 * (1 - d / LINK)) + ')'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
      if (mouse.x != null) {
        var mx = parts[a].x - mouse.x, my = parts[a].y - mouse.y, md = Math.sqrt(mx * mx + my * my);
        if (md < MLINK) {
          ctx.beginPath(); ctx.moveTo(parts[a].x, parts[a].y); ctx.lineTo(mouse.x, mouse.y);
          ctx.strokeStyle = 'rgba(129,253,218,' + (0.32 * (1 - md / MLINK)) + ')'; ctx.lineWidth = 1; ctx.stroke();
        }
      }
    }
    requestAnimationFrame(frame);
  }

  build();
  var rt;
  window.addEventListener('resize', function () { clearTimeout(rt); rt = setTimeout(build, 200); });
  requestAnimationFrame(frame);
}
