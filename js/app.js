/*
 * App wiring: state, autosave, rendering and exports.
 */
(function () {

var STORAGE_KEY = 'cv-builder.v1';
var ALL_SECTIONS = Object.keys(CV.SECTIONS);

var $ = function (sel) { return document.querySelector(sel); };
var editorEl = $('#editor');
var previewEl = $('#pages');

var state = loadState();
var openSections = { summary: true, experience: true };
var lastPageCount = 1;

/* ---------- state ---------- */

function normalise(cv) {
  var base = CV.emptyCV(CV.TIERS[cv.tier] ? cv.tier : 'student');
  Object.keys(base).forEach(function (k) { if (cv[k] === undefined) cv[k] = base[k]; });
  cv.personal = Object.assign(base.personal, cv.personal);
  // Keep every known section in the order list so it can be shown later.
  cv.order = cv.order.filter(function (k) { return CV.SECTIONS[k]; });
  ALL_SECTIONS.forEach(function (k) {
    if (cv.order.indexOf(k) === -1) { cv.order.push(k); cv.hidden[k] = true; }
  });
  return cv;
}

function exampleState(tier) {
  var cv = normalise(CV.sampleCV(tier));
  cv.isExample = true;
  return cv;
}

function loadState() {
  try {
    var saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved && saved.personal) return normalise(saved);
  } catch (e) { /* storage blocked or corrupt: start from the example */ }
  return exampleState('student');
}

var saveTimer = null;
function saveState() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(function () {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }, 400);
}

/* ---------- rendering ---------- */

function renderEditor() {
  CV.renderEditor(editorEl, state, openSections);
}

function renderTierAndThemes() {
  document.querySelectorAll('[data-tier]').forEach(function (btn) {
    btn.setAttribute('aria-pressed', btn.dataset.tier === state.tier ? 'true' : 'false');
  });
  $('#tier-blurb').textContent = CV.TIERS[state.tier].blurb;

  $('#themes').innerHTML = CV.THEMES.map(function (t) {
    var recommended = t.tiers.indexOf(state.tier) !== -1;
    var serif = t.font === 'serif';
    return '<button type="button" class="theme" data-theme-id="' + t.id + '" aria-pressed="' + (t.id === state.theme) + '">' +
      '<span class="theme-sample' + (t.header === 'banner' ? ' banner' : '') + ' h-' + t.heading + '" style="--swatch:' + t.accent + ';--tint:' + CV.tint(t.accent, 0.86) + ';font-family:' + (serif ? '\'Times New Roman\',Times,serif' : 'Arial,Helvetica,sans-serif') + '">' +
      '<b>Aa</b><i></i></span>' +
      '<span class="theme-name">' + t.name + '</span>' +
      (recommended ? '<span class="rec">Suits ' + CV.TIERS[state.tier].short + '</span>' : '') +
      '</button>';
  }).join('');
}

function renderExampleBanner() {
  $('#example-banner').hidden = !state.isExample;
}

var renderTimer = null;
function scheduleRender() {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(renderOutput, 120);
}

function renderOutput() {
  var theme = CV.getTheme(state.theme);
  var layout = CV.layout(CV.buildBlocks(state), theme);
  lastPageCount = layout.pages.length;
  CV.renderPreview(previewEl, layout);
  $('#preview-meta').textContent = theme.name + ' theme · ' + lastPageCount + ' page' + (lastPageCount > 1 ? 's' : '') + ' · A4';
  renderAts();
}

function renderAts() {
  var result = CV.runChecks(state, lastPageCount);
  var scoreEls = document.querySelectorAll('[data-score]');
  var level = result.score >= 85 ? 'good' : result.score >= 65 ? 'ok' : 'bad';
  scoreEls.forEach(function (el) { el.textContent = result.score; el.dataset.level = level; });

  var icons = { pass: 'Pass', warn: 'Improve', fail: 'Fix' };
  var order = { fail: 0, warn: 1, pass: 2 };
  $('#checks').innerHTML = result.checks.slice().sort(function (a, b) { return order[a.status] - order[b.status]; }).map(function (c) {
    return '<li class="check ' + c.status + '"><span class="chip">' + icons[c.status] + '</span>' +
      '<div><strong>' + c.title + '</strong><p>' + escapeHtml(c.detail) + '</p></div></li>';
  }).join('');

  var match = CV.matchKeywords(state, $('#job-ad').value);
  var out = $('#match');
  if (!match) {
    out.innerHTML = '<p class="muted">Paste a job ad above to see which of its keywords your CV already uses.</p>';
  } else {
    out.innerHTML = '<p class="match-pct"><span data-level="' + (match.pct >= 70 ? 'good' : match.pct >= 45 ? 'ok' : 'bad') + '">' + match.pct + '%</span> of the top ' +
      (match.matched.length + match.missing.length) + ' job-ad keywords appear in your CV.</p>' +
      (match.missing.length ? '<h4>Missing, add where true</h4><ul class="kw miss">' + match.missing.map(kw).join('') + '</ul>' : '') +
      (match.matched.length ? '<h4>Already in your CV</h4><ul class="kw hit">' + match.matched.map(kw).join('') + '</ul>' : '');
  }
  $('#plain-text').textContent = CV.buildText(state);
}

function kw(k) { return '<li>' + escapeHtml(k) + '</li>'; }
function escapeHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }

function renderAll() {
  renderTierAndThemes();
  renderExampleBanner();
  renderEditor();
  renderOutput();
}

/* ---------- editor events ---------- */

function changed() {
  if (state.isExample) { state.isExample = false; renderExampleBanner(); }
  saveState();
  scheduleRender();
}

editorEl.addEventListener('input', function (e) {
  var path = e.target.dataset.path;
  if (!path) return;
  CV.setPath(state, path, e.target.value);
  if (path === 'summary') CV.updateCounters(editorEl, state);
  // Keep the entry heading in sync with its first field.
  var item = e.target.closest('.item');
  if (item && item.querySelector('[data-path]') === e.target) {
    item.querySelector('.item-title').textContent = e.target.value || 'New entry';
  }
  changed();
});

editorEl.addEventListener('change', function (e) {
  var path = e.target.dataset.present;
  if (!path) return;
  CV.setPath(state, path, e.target.checked ? 'present' : '');
  var monthInput = document.getElementById('f-' + path.replace(/\./g, '-'));
  monthInput.disabled = e.target.checked;
  monthInput.value = '';
  changed();
});

editorEl.addEventListener('toggle', function (e) {
  var key = e.target.dataset && e.target.dataset.sec;
  if (key) openSections[key] = e.target.open;
}, true);

editorEl.addEventListener('click', function (e) {
  var btn = e.target.closest('button[data-action]');
  if (!btn) return;
  e.preventDefault(); // buttons inside <summary> must not toggle the section
  var key = btn.dataset.key;
  var i = parseInt(btn.dataset.index, 10);
  var list = state[key];
  switch (btn.dataset.action) {
    case 'add': list.push(CV.newItem(key)); openSections[key] = true; break;
    case 'remove': list.splice(i, 1); break;
    case 'up': list.splice(i - 1, 0, list.splice(i, 1)[0]); break;
    case 'down': list.splice(i + 1, 0, list.splice(i, 1)[0]); break;
    case 'toggle': state.hidden[key] = !state.hidden[key]; break;
    case 'sec-up':
    case 'sec-down': {
      var from = state.order.indexOf(key);
      var to = from + (btn.dataset.action === 'sec-up' ? -1 : 1);
      state.order.splice(to, 0, state.order.splice(from, 1)[0]);
      break;
    }
  }
  renderEditor();
  changed();
  if (btn.dataset.action === 'add') {
    var items = editorEl.querySelectorAll('[data-sec="' + key + '"] .item');
    var input = items[items.length - 1] && items[items.length - 1].querySelector('input, textarea');
    if (input) input.focus();
  }
});

/* ---------- tier and theme ---------- */

document.querySelectorAll('[data-tier]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    var tier = btn.dataset.tier;
    if (tier === state.tier) return;
    if (state.isExample) {
      state = exampleState(tier);
    } else {
      // Keep the user's content; adopt the tier's section order and hide
      // only sections that are empty and not part of this tier.
      state.tier = tier;
      var tierOrder = CV.TIERS[tier].order;
      state.order = tierOrder.concat(ALL_SECTIONS.filter(function (k) { return tierOrder.indexOf(k) === -1; }));
      var blocks = CV.buildBlocks(Object.assign({}, state, { hidden: {} }));
      ALL_SECTIONS.forEach(function (k) {
        var hasContent = blocks.some(function (b) { return b.key === k; });
        state.hidden[k] = tierOrder.indexOf(k) === -1 && !hasContent;
      });
      saveState();
    }
    renderAll();
  });
});

$('#themes').addEventListener('click', function (e) {
  var btn = e.target.closest('[data-theme-id]');
  if (!btn) return;
  state.theme = btn.dataset.themeId;
  saveState();
  renderTierAndThemes();
  renderOutput();
});

/* ---------- tabs (preview / ATS, and the mobile edit pane) ---------- */

function showTab(name) {
  document.body.dataset.tab = name;
  document.querySelector('.output-pane').scrollTop = 0;
  document.querySelectorAll('[data-tab-btn]').forEach(function (b) {
    b.setAttribute('aria-selected', b.dataset.tabBtn === name ? 'true' : 'false');
  });
  try { sessionStorage.setItem('cv-builder.tab', name); } catch (e) { /* ignore */ }
}
document.querySelectorAll('[data-tab-btn]').forEach(function (b) {
  b.addEventListener('click', function () { showTab(b.dataset.tabBtn); });
});

$('#job-ad').addEventListener('input', function () {
  try { localStorage.setItem(STORAGE_KEY + '.jobad', this.value); } catch (e) { /* ignore */ }
  clearTimeout(this._t);
  this._t = setTimeout(renderAts, 200);
});

/* ---------- files ---------- */

// Inside a claude.ai Artifact, downloads go through the viewer's "downloads"
// capability. Opened as a normal web page, a plain blob link is used.
var downloadsApi = (window.claude && window.claude.use)
  ? window.claude.use('downloads').catch(function () { return null; })
  : Promise.resolve(null);

function toast(message) {
  var el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.hidden = true; }, 3200);
}

function browserDownload(filename, data) {
  var blob = data instanceof Blob ? data : new Blob([data], { type: 'text/plain;charset=utf-8' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
}

function offerFile(filename, data) {
  return downloadsApi.then(function (api) {
    if (!api) { browserDownload(filename, data); toast('Downloaded ' + filename); return; }
    return api.save({ filename: filename, data: data }).then(function () {
      toast('Saved ' + filename);
    }, function (err) {
      var code = err && err.code;
      if (code === 'declined') toast('Download cancelled.');
      else if (code === 'rate_limited') toast('A download prompt is already open.');
      else toast('Downloads are not available here. Use "Copy text" instead.');
    });
  });
}

$('#btn-pdf').addEventListener('click', function () {
  var pdf = CV.buildPdf(state);
  offerFile(CV.fileBaseName(state) + '.pdf', pdf.doc.output('blob'));
});
$('#btn-docx').addEventListener('click', function () {
  offerFile(CV.fileBaseName(state) + '.docx', CV.buildDocx(state));
});
$('#btn-txt').addEventListener('click', function () {
  offerFile(CV.fileBaseName(state) + '.txt', CV.buildText(state));
});
$('#btn-copy').addEventListener('click', function () {
  var text = CV.buildText(state);
  var fallback = function () {
    var range = document.createRange();
    range.selectNodeContents($('#plain-text'));
    var sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);
    showTab('ats');
    toast('Text selected. Press Ctrl+C to copy.');
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(function () { toast('CV text copied.'); }, fallback);
  } else {
    fallback();
  }
});
$('#btn-save-json').addEventListener('click', function () {
  var data = Object.assign({}, state);
  delete data.isExample;
  offerFile(CV.fileBaseName(state) + '.json', JSON.stringify(data, null, 2));
});
$('#file-json').addEventListener('change', function (e) {
  var file = e.target.files[0];
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function () {
    try {
      var data = JSON.parse(reader.result);
      if (!data || !data.personal) throw new Error('not a CV');
      state = normalise(data);
      state.isExample = false;
      saveState();
      renderAll();
      toast('Loaded ' + file.name);
    } catch (err) {
      toast('That file is not a CV saved from this tool.');
    }
    e.target.value = '';
  };
  reader.readAsText(file);
});
/* ---------- import an existing CV ---------- */

var SECTION_NAMES = { summary: 'Summary', experience: 'Experience', education: 'Education', skills: 'Skills', projects: 'Projects', activities: 'Activities', certifications: 'Certifications', achievements: 'Achievements', languages: 'Languages', additional: 'Additional information', referees: 'References' };
var beforeImport = null;

function showImportNotice(html, isError) {
  var el = $('#import-notice');
  el.innerHTML = html + '<div class="notice-actions">' +
    (beforeImport ? '<button type="button" class="btn" data-notice="undo">Undo import</button>' : '') +
    '<button type="button" class="btn" data-notice="close">Close</button></div>';
  el.classList.toggle('error', !!isError);
  el.hidden = false;
  el.scrollIntoView({ block: 'nearest' });
}

$('#import-notice').addEventListener('click', function (e) {
  var btn = e.target.closest('[data-notice]');
  if (!btn) return;
  if (btn.dataset.notice === 'undo' && beforeImport) {
    state = beforeImport;
    beforeImport = null;
    saveState();
    renderAll();
    toast('Import undone.');
  }
  $('#import-notice').hidden = true;
});

function countOf(key) {
  var v = state[key];
  if (Array.isArray(v)) return v.length;
  return v ? 1 : 0;
}

function importedSummary(fileName, notes) {
  var tier = CV.TIERS[state.tier];
  var found = Object.keys(SECTION_NAMES).filter(function (k) { return countOf(k); }).map(function (k) {
    var n = countOf(k);
    return SECTION_NAMES[k] + (Array.isArray(state[k]) && n > 1 ? ' (' + n + ')' : '');
  });
  var html = '<h3>Imported ' + escapeHtml(fileName) + '</h3>' +
    '<p>Filled in: ' + (found.length ? found.join(', ') : 'contact details only') + '. Career level set to <b>' + tier.short + '</b>; change it above if that is wrong.</p>' +
    '<p class="muted">Automatic import is a head start, not a perfect copy. Check each section, especially job titles, company names and dates.</p>';
  if (notes.skippedSensitive.length) {
    html += '<p class="muted">Left out ' + notes.skippedSensitive.length + ' personal detail line' + (notes.skippedSensitive.length > 1 ? 's' : '') + ' (IC number, race, religion, age or similar). They are not needed on a CV.</p>';
  }
  if (notes.unplaced.length) {
    html += '<details><summary>' + notes.unplaced.length + ' line' + (notes.unplaced.length > 1 ? 's' : '') + ' could not be placed</summary><ul>' +
      notes.unplaced.map(function (l) { return '<li>' + escapeHtml(l) + '</li>'; }).join('') + '</ul></details>';
  }
  return html;
}

function loadJsonCv(file) {
  return file.text().then(function (textContent) {
    var data = JSON.parse(textContent);
    if (!data || !data.personal) throw new Error('not-cv-json');
    return { cv: data, notes: { unplaced: [], skippedSensitive: [] }, isJson: true };
  });
}

$('#file-import').addEventListener('change', function (e) {
  var file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  document.querySelector('.menu').open = false;
  toast('Reading ' + file.name + '...');
  var job = /\.json$/i.test(file.name) ? loadJsonCv(file) : CV.importCvFile(file);
  job.then(function (result) {
    beforeImport = JSON.parse(JSON.stringify(state));
    state = normalise(result.cv);
    state.isExample = false;
    openSections = { personal: true, summary: true, experience: true, education: true };
    saveState();
    renderAll();
    if (result.isJson) showImportNotice('<h3>Loaded ' + escapeHtml(file.name) + '</h3><p>Your saved CV is back, exactly as you left it.</p>');
    else showImportNotice(importedSummary(file.name, result.notes));
    toast('Imported ' + file.name);
  }).catch(function (err) {
    var msg = {
      'no-text': 'This PDF has no selectable text, so it is probably a scanned image or a photo. ATS software cannot read it either, which is a good reason to rebuild it here. Import a Word version if you have one, or type your details in.',
      'old-doc': 'Old .doc files cannot be read. Open it in Word or Google Docs, save it as .docx or PDF, then import that.',
      'not-cv-json': 'That .json file was not saved from CV Builder.',
      'unsupported': file.name + ' is not a CV file this tool can read. Choose a PDF, Word (.docx) or text file.'
    }[err && err.message] || 'Could not read ' + file.name + '. Try saving it as PDF or .docx and import again.';
    showImportNotice('<h3>Import failed</h3><p>' + escapeHtml(msg) + '</p>', true);
  });
});

$('#btn-blank').addEventListener('click', function () {
  state = normalise(CV.emptyCV(state.tier));
  openSections = { personal: true };
  saveState();
  renderAll();
});
$('#banner-blank').addEventListener('click', function () { $('#btn-blank').click(); });
$('#btn-example').addEventListener('click', function () {
  state = exampleState(state.tier);
  saveState();
  renderAll();
});

// Close the "More" menu after picking an item.
document.querySelector('.menu-list').addEventListener('click', function (e) {
  if (e.target.closest('button')) document.querySelector('.menu').open = false;
});

/* ---------- start ---------- */

try {
  $('#job-ad').value = localStorage.getItem(STORAGE_KEY + '.jobad') || '';
  showTab(sessionStorage.getItem('cv-builder.tab') || 'preview');
} catch (e) {
  showTab('preview');
}
renderAll();

// Exposed for debugging in the browser console.
window.cvState = function () { return state; };

})();
