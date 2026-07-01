// TecheVision — job board (search, filter, detail view)
(function () {
  var JOBS = window.TECHEVISION_JOBS || [];
  var listEl = document.getElementById('jobs-list');
  if (!listEl) return;

  var emptyEl = document.getElementById('jobs-empty');
  var countEl = document.getElementById('jf-count');
  var fSearch = document.getElementById('jf-search');
  var fMode = document.getElementById('jf-mode');
  var fVisa = document.getElementById('jf-visa');
  var fDate = document.getElementById('jf-date');
  var fLoc = document.getElementById('jf-loc');
  var clearBtn = document.getElementById('jf-clear');
  var modal = document.getElementById('job-modal');
  var modalBody = modal ? modal.querySelector('.modal-body') : null;

  var PIN = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  var STAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2l3 7h7l-5.5 4.5L18 21l-6-4-6 4 1.5-7.5L2 9h7z"/></svg>';
  var CLOCK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  var HOME = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12l9-8 9 8M5 10v10h14V10"/></svg>';

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function daysAgo(iso) { var d = new Date(iso); return Math.floor((Date.now() - d.getTime()) / 86400000); }
  function postedLabel(iso) { if (!iso) return ''; var n = daysAgo(iso); if (n <= 0) return 'Today'; if (n === 1) return '1 day ago'; if (n < 30) return n + ' days ago'; if (n < 60) return '1 month ago'; return Math.floor(n / 30) + ' months ago'; }

  // Populate Location & Visa dropdowns from the data
  function fill(sel, values) {
    values.filter(Boolean).sort().forEach(function (v) {
      if (values.indexOf(v) === values.lastIndexOf(v) || true) {}
      var o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
    });
  }
  function uniq(arr) { var out = []; arr.forEach(function (x) { if (x && out.indexOf(x) < 0) out.push(x); }); return out; }
  if (fLoc) fill(fLoc, uniq(JOBS.map(function (j) { return j.location; })));
  if (fVisa) fill(fVisa, uniq(JOBS.map(function (j) { return j.visa; })));

  function matches(j) {
    var q = fSearch.value.trim().toLowerCase();
    if (q) {
      var hay = (j.title + ' ' + (j.skills || []).join(' ') + ' ' + (j.summary || '') + ' ' + (j.level || '')).toLowerCase();
      if (hay.indexOf(q) < 0) return false;
    }
    if (fMode.value && j.mode !== fMode.value) return false;
    if (fVisa.value && (j.visa || '') !== fVisa.value) return false;
    if (fLoc.value && j.location !== fLoc.value) return false;
    if (fDate.value && daysAgo(j.posted) > parseInt(fDate.value, 10)) return false;
    return true;
  }

  function cardHTML(j) {
    var top = (j.skills || []).slice(0, 6).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('');
    var extra = (j.skills || []).length > 6 ? '<span class="more">+' + ((j.skills.length) - 6) + ' more</span>' : '';
    return '<article class="job">'
      + '<div class="job-head"><h3>' + esc(j.title) + '</h3><span class="job-type">' + esc(j.type) + '</span></div>'
      + '<div class="job-meta">'
      + '<span>' + PIN + ' ' + esc(j.location) + '</span>'
      + '<span>' + HOME + ' ' + esc(j.mode) + '</span>'
      + (j.level ? '<span>' + STAR + ' ' + esc(j.level) + '</span>' : '')
      + '<span>' + CLOCK + ' ' + postedLabel(j.posted) + '</span>'
      + '</div>'
      + '<p>' + esc(j.summary) + '</p>'
      + '<div class="job-tags">' + top + extra + '</div>'
      + '<div class="job-actions">'
      + '<button type="button" class="btn btn--dark" data-detail="' + esc(j.id) + '">View details</button>'
      + '<a class="btn btn--primary" href="#apply" data-role="' + esc(j.title) + '">Apply</a>'
      + '</div></article>';
  }

  function setRole(role) { var r = document.getElementById('j-role'); if (r) r.value = role; }

  function render() {
    var filtered = JOBS.filter(matches);
    listEl.innerHTML = filtered.map(cardHTML).join('');
    if (emptyEl) emptyEl.hidden = filtered.length > 0;
    if (countEl) countEl.textContent = filtered.length + (filtered.length === 1 ? ' role' : ' roles') + ' found';
    listEl.querySelectorAll('[data-detail]').forEach(function (b) { b.addEventListener('click', function () { openDetail(b.getAttribute('data-detail')); }); });
    listEl.querySelectorAll('[data-role]').forEach(function (b) { b.addEventListener('click', function () { setRole(b.getAttribute('data-role')); }); });
  }

  function row(label, val) { return val ? '<div class="jd-row"><span>' + label + '</span><strong>' + esc(val) + '</strong></div>' : ''; }

  function openDetail(id) {
    var j = JOBS.filter(function (x) { return x.id === id; })[0];
    if (!j || !modalBody) return;
    var skills = (j.skills || []).map(function (s) { return '<span>' + esc(s) + '</span>'; }).join('');
    modalBody.innerHTML =
      '<span class="job-type" style="position:absolute;top:38px;right:66px">' + esc(j.type) + '</span>'
      + '<h3>' + esc(j.title) + '</h3>'
      + '<p class="modal-tag">' + esc(j.location) + ' &middot; ' + esc(j.mode) + '</p>'
      + '<div class="jd-grid">'
      + row('Location', j.location) + row('Work mode', j.mode) + row('Job type', j.type)
      + row('Experience', j.level) + row('Visa', j.visa) + row('Interview', j.interview)
      + row('Posted', postedLabel(j.posted))
      + '</div>'
      + '<h4>About the role</h4><p>' + esc(j.description || j.summary) + '</p>'
      + '<h4>Key skills</h4><div class="job-tags">' + skills + '</div>'
      + '<a class="btn btn--primary" href="#apply" data-role="' + esc(j.title) + '">Apply for this role</a>';
    modal.classList.add('open'); modal.setAttribute('aria-hidden', 'false'); document.body.style.overflow = 'hidden';
    modalBody.querySelectorAll('[data-role]').forEach(function (b) { b.addEventListener('click', function () { setRole(b.getAttribute('data-role')); closeDetail(); }); });
  }
  function closeDetail() { if (!modal) return; modal.classList.remove('open'); modal.setAttribute('aria-hidden', 'true'); document.body.style.overflow = ''; }
  if (modal) {
    modal.querySelectorAll('[data-close]').forEach(function (x) { x.addEventListener('click', closeDetail); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && modal.classList.contains('open')) closeDetail(); });
  }

  [fSearch, fMode, fVisa, fDate, fLoc].forEach(function (el) { if (el) { el.addEventListener('input', render); el.addEventListener('change', render); } });
  if (clearBtn) clearBtn.addEventListener('click', function () { fSearch.value = ''; fMode.value = ''; fVisa.value = ''; fDate.value = ''; fLoc.value = ''; render(); });

  render();
})();
