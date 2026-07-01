// TecheVision — interactive Services field
// Dots gravitate toward the cursor and drift back when it leaves.
// The 6 service nodes are hoverable (name) and clickable (open details).
(function () {
  var host = document.getElementById('service-orbit');
  if (!host) return;
  var NS = 'http://www.w3.org/2000/svg';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var SERVICES = [
    { key: 'data-engineering', label: 'Data Engineering' },
    { key: 'java-development', label: 'Java Development' },
    { key: 'python-development', label: 'Python Development' },
    { key: 'cloud-computing', label: 'Cloud Computing' },
    { key: 'qa-testing', label: 'QA & Testing' },
    { key: 'data-analytics', label: 'Data Analytics' }
  ];

  var VB = 460, cx = 230, cy = 230, R = 150;
  function el(name, attrs) { var e = document.createElementNS(NS, name); for (var k in attrs) e.setAttribute(k, attrs[k]); return e; }

  var svg = el('svg', { viewBox: '0 0 ' + VB + ' ' + VB, class: 'svc-orbit-svg', role: 'group', 'aria-label': 'Services' });
  svg.appendChild(el('circle', { class: 'svc-ring', cx: cx, cy: cy, r: R }));
  svg.appendChild(el('circle', { class: 'svc-ring', cx: cx, cy: cy, r: 95 }));

  // ambient dots
  var ambient = [];
  for (var i = 0; i < 32; i++) {
    var ang = Math.random() * Math.PI * 2, rad = 34 + Math.random() * 172;
    var hx = cx + Math.cos(ang) * rad, hy = cy + Math.sin(ang) * rad;
    var c = el('circle', { class: 'svc-ambient', cx: hx, cy: hy, r: (1.4 + Math.random() * 1.3).toFixed(2) });
    svg.appendChild(c);
    ambient.push({ el: c, hx: hx, hy: hy, x: hx, y: hy, ph: Math.random() * 6.28 });
  }

  // service nodes
  var nodes = SERVICES.map(function (s, i) {
    var a = (i / SERVICES.length) * Math.PI * 2 - Math.PI / 2;
    var hx = cx + Math.cos(a) * R, hy = cy + Math.sin(a) * R;
    var g = el('g', { class: 'svc-onode', tabindex: '0', role: 'button', 'aria-label': s.label });
    var line = el('line', { x1: cx, y1: cy, x2: hx, y2: hy });
    var halo = el('circle', { class: 'h', cx: hx, cy: hy, r: 22 });
    var dot = el('circle', { class: 'd', cx: hx, cy: hy, r: 8 });
    var text = el('text', { x: hx, y: hy });
    text.textContent = s.label;
    text.setAttribute('text-anchor', Math.cos(a) > 0.25 ? 'start' : (Math.cos(a) < -0.25 ? 'end' : 'middle'));
    g.appendChild(line); g.appendChild(halo); g.appendChild(dot); g.appendChild(text);
    g.addEventListener('click', function () { openService(s.key); });
    g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openService(s.key); } });
    svg.appendChild(g);
    return { g: g, line: line, halo: halo, dot: dot, text: text, hx: hx, hy: hy, x: hx, y: hy, a: a };
  });

  // hub
  svg.appendChild(el('circle', { class: 'svc-hub', cx: cx, cy: cy, r: 34 }));
  var bars = el('g', { transform: 'translate(' + (cx - 15) + ',' + (cy - 12) + ')' });
  bars.appendChild(el('rect', { x: 0, y: 0, width: 6, height: 24, rx: 1, fill: '#37766c' }));
  bars.appendChild(el('rect', { x: 11, y: 0, width: 6, height: 24, rx: 1, fill: '#52a890' }));
  bars.appendChild(el('rect', { x: 22, y: 0, width: 6, height: 24, rx: 1, fill: '#81fdda' }));
  svg.appendChild(bars);

  host.appendChild(svg);

  // ---- cursor tracking ----
  var mx = 0, my = 0, active = false, t = 0;
  function toSvg(e) { var r = svg.getBoundingClientRect(); mx = (e.clientX - r.left) / r.width * VB; my = (e.clientY - r.top) / r.height * VB; }
  host.addEventListener('mousemove', function (e) { active = true; toSvg(e); });
  host.addEventListener('mouseleave', function () { active = false; });
  host.addEventListener('touchmove', function (e) { if (e.touches[0]) { active = true; toSvg(e.touches[0]); } }, { passive: true });
  host.addEventListener('touchend', function () { active = false; });

  function frame() {
    t += 0.02;
    // ambient: swarm toward cursor when active, gently float home otherwise
    for (var i = 0; i < ambient.length; i++) {
      var p = ambient[i], tx, ty;
      if (active) { tx = p.hx + (mx - p.hx) * 0.82; ty = p.hy + (my - p.hy) * 0.82; }
      else { tx = p.hx + Math.sin(t + p.ph) * 6; ty = p.hy + Math.cos(t + p.ph) * 6; }
      p.x += (tx - p.x) * 0.08; p.y += (ty - p.y) * 0.08;
      p.el.setAttribute('cx', p.x.toFixed(1)); p.el.setAttribute('cy', p.y.toFixed(1));
    }
    // service nodes: lean toward cursor, spring back
    for (var j = 0; j < nodes.length; j++) {
      var n = nodes[j], nx, ny;
      if (active) { nx = n.hx + (mx - n.hx) * 0.42; ny = n.hy + (my - n.hy) * 0.42; }
      else { nx = n.hx; ny = n.hy; }
      n.x += (nx - n.x) * 0.10; n.y += (ny - n.y) * 0.10;
      n.dot.setAttribute('cx', n.x.toFixed(1)); n.dot.setAttribute('cy', n.y.toFixed(1));
      n.halo.setAttribute('cx', n.x.toFixed(1)); n.halo.setAttribute('cy', n.y.toFixed(1));
      n.line.setAttribute('x2', n.x.toFixed(1)); n.line.setAttribute('y2', n.y.toFixed(1));
      var lx = n.x + Math.cos(n.a) * 20, ly = n.y + Math.sin(n.a) * 20 + 5;
      n.text.setAttribute('x', lx.toFixed(1)); n.text.setAttribute('y', ly.toFixed(1));
    }
    if (!reduce) requestAnimationFrame(frame);
  }
  if (reduce) { /* static */ } else { requestAnimationFrame(frame); }

  function openService(key) {
    var src = document.getElementById('svc-' + key);
    var modal = document.getElementById('service-modal');
    if (!src || !modal) return;
    modal.querySelector('.modal-body').innerHTML = src.innerHTML;
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
})();
