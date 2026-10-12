/*
 * The editor form on the left.
 *
 * The form is rebuilt only on structural changes (tier switch, add/remove/move
 * an entry). Typing updates the CV data through `data-path` attributes, so the
 * input keeps focus while the preview refreshes.
 */
window.CV = window.CV || {};

(function () {

function esc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function idFor(path) { return 'f-' + path.replace(/\./g, '-'); }

function wordCount(text) { return String(text || '').trim().split(/\s+/).filter(Boolean).length; }

function inputField(label, path, value, opts) {
  opts = opts || {};
  var id = idFor(path);
  var type = opts.type || 'text';
  // Imported dates can be year-only ("2019"); a month picker would show those as empty.
  if (type === 'month' && value && !/^\d{4}-\d{2}$/.test(value)) type = 'text';
  var attrs = ' id="' + id + '" data-path="' + path + '" placeholder="' + esc(opts.placeholder || '') + '"' + (opts.disabled ? ' disabled' : '') + (opts.autocomplete ? ' autocomplete="' + opts.autocomplete + '"' : '');
  var control = opts.multiline
    ? '<textarea' + attrs + ' rows="' + (opts.rows || 4) + '">' + esc(value) + '</textarea>'
    : '<input type="' + type + '"' + attrs + ' value="' + esc(value) + '">';
  return '<div class="field' + (opts.wide ? ' wide' : '') + '"><label for="' + id + '">' + esc(label) + '</label>' + control + (opts.after || '') + '</div>';
}

function personalSection(cv) {
  var p = cv.personal;
  var f = function (label, key, ph, ac, wide) {
    return inputField(label, 'personal.' + key, p[key], { placeholder: ph, autocomplete: ac, wide: wide });
  };
  return '<details class="sec" data-sec="personal" open><summary><span class="sec-title">Personal details</span></summary>' +
    '<p class="hint">' + esc(CV.HINTS.personal) + '</p><div class="grid">' +
    f('Full name', 'fullName', 'As in your IC, e.g. Ali bin Abu', 'name', true) +
    f('Headline', 'headline', 'Target role, e.g. Graduate Mechatronics Engineer', 'off', true) +
    f('Email', 'email', 'name@example.com', 'email') +
    f('Phone', 'phone', '+60 12-345 6789', 'tel') +
    f('Location', 'location', 'Petaling Jaya, Selangor', 'address-level2') +
    f('LinkedIn', 'linkedin', 'linkedin.com/in/yourname', 'url') +
    f('Website / GitHub', 'website', 'github.com/yourname', 'url', true) +
    '</div></details>';
}

function listItem(key, def, item, index, count) {
  var fields = def.fields.map(function (fd) {
    var path = key + '.' + index + '.' + fd.key;
    if (fd.type === 'bullets') {
      return inputField(fd.label, path, item[fd.key], { multiline: true, rows: 4, placeholder: fd.placeholder, wide: true });
    }
    if (fd.present) {
      var isPresent = item[fd.key] === 'present';
      var check = '<label class="present"><input type="checkbox" data-present="' + path + '"' + (isPresent ? ' checked' : '') + '> Present</label>';
      return inputField(fd.label, path, isPresent ? '' : item[fd.key], { type: 'month', disabled: isPresent, after: check });
    }
    return inputField(fd.label, path, item[fd.key], { type: fd.type, placeholder: fd.placeholder, wide: def.fields.length <= 3 && fd === def.fields[def.fields.length - 1] });
  }).join('');
  var heading = esc(item[def.fields[0].key] || 'New entry');
  return '<div class="item"><div class="item-head"><span class="item-title">' + heading + '</span>' +
    '<span class="item-tools">' +
    '<button type="button" class="icon" data-action="up" data-key="' + key + '" data-index="' + index + '" aria-label="Move up"' + (index === 0 ? ' disabled' : '') + '>&uarr;</button>' +
    '<button type="button" class="icon" data-action="down" data-key="' + key + '" data-index="' + index + '" aria-label="Move down"' + (index === count - 1 ? ' disabled' : '') + '>&darr;</button>' +
    '<button type="button" class="icon danger" data-action="remove" data-key="' + key + '" data-index="' + index + '" aria-label="Remove entry">&times;</button>' +
    '</span></div><div class="grid">' + fields + '</div></div>';
}

function sectionBody(cv, key) {
  var def = CV.SECTIONS[key];
  if (def.kind === 'text') {
    var n = wordCount(cv[key]);
    var range = CV.TIERS[cv.tier].summaryWords;
    return inputField('Summary', key, cv[key], { multiline: true, rows: 6, wide: true,
      after: '<span class="counter" data-counter="' + key + '">' + n + ' words (aim ' + range[0] + '–' + range[1] + ')</span>' });
  }
  if (def.kind === 'lines') {
    return inputField('One per line', key, cv[key], { multiline: true, rows: 4, placeholder: def.placeholder, wide: true });
  }
  var items = cv[key];
  return items.map(function (item, i) { return listItem(key, def, item, i, items.length); }).join('') +
    '<button type="button" class="add" data-action="add" data-key="' + key + '">+ ' + esc(def.addLabel) + '</button>';
}

function section(cv, key, index, openSet) {
  var hidden = !!cv.hidden[key];
  var title = CV.sectionTitle(key, cv.tier);
  var hint = CV.sectionHint(key, cv.tier);
  return '<details class="sec' + (hidden ? ' is-hidden' : '') + '" data-sec="' + key + '"' + (openSet[key] ? ' open' : '') + '>' +
    '<summary><span class="sec-title">' + esc(title) + '</span>' +
    (hidden ? '<span class="tag">Hidden</span>' : '') +
    '<span class="sec-tools">' +
    '<button type="button" class="icon" data-action="sec-up" data-key="' + key + '" aria-label="Move section up"' + (index === 0 ? ' disabled' : '') + '>&uarr;</button>' +
    '<button type="button" class="icon" data-action="sec-down" data-key="' + key + '" aria-label="Move section down"' + (index === cv.order.length - 1 ? ' disabled' : '') + '>&darr;</button>' +
    '<button type="button" class="toggle" data-action="toggle" data-key="' + key + '">' + (hidden ? 'Show' : 'Hide') + '</button>' +
    '</span></summary>' +
    (hint ? '<p class="hint">' + esc(hint) + '</p>' : '') +
    sectionBody(cv, key) + '</details>';
}

CV.renderEditor = function (container, cv, openSet) {
  container.innerHTML = personalSection(cv) +
    cv.order.map(function (key, i) { return section(cv, key, i, openSet); }).join('');
};

CV.updateCounters = function (container, cv) {
  var el = container.querySelector('[data-counter="summary"]');
  if (el) {
    var range = CV.TIERS[cv.tier].summaryWords;
    el.textContent = wordCount(cv.summary) + ' words (aim ' + range[0] + '–' + range[1] + ')';
  }
};

/* Read and write CV data by dotted path, e.g. "experience.0.title". */
CV.getPath = function (obj, path) {
  return path.split('.').reduce(function (o, k) { return o == null ? o : o[k]; }, obj);
};
CV.setPath = function (obj, path, value) {
  var keys = path.split('.');
  var last = keys.pop();
  var target = keys.reduce(function (o, k) { return o[k]; }, obj);
  target[last] = value;
};

CV.newItem = function (key) {
  var item = {};
  CV.SECTIONS[key].fields.forEach(function (f) { item[f.key] = ''; });
  return item;
};

})();
