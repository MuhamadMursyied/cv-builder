/*
 * Turns CV data into a flat list of "blocks".
 *
 * Every exporter (preview, PDF, DOCX, plain text) reads the same blocks, so
 * what you see in the preview is what the ATS reads in the file.
 *
 * Block types:
 *   name      { text }
 *   headline  { text }
 *   contact   { items: [] }
 *   heading   { text }
 *   entry     { title, sub, date }            title line + organisation line
 *   item      { segs, date }                  one line, optional date on the right
 *   para      { segs }                        wrapped paragraph
 *   bullets   { items: [] }
 *
 * `segs` is a list of { text, style } runs, style = 'normal' | 'bold' | 'italic'.
 */
window.CV = window.CV || {};

(function () {

var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/* Replace characters that some ATS parsers or the standard PDF fonts mangle. */
CV.cleanText = function (text) {
  return String(text || '')
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"')
    .replace(/[—―]/g, '-')
    .replace(/…/g, '...')
    .replace(/[  -​\t]/g, ' ')
    // Anything outside Latin-1 plus the en dash and bullet (emoji, symbols, CJK)
    // cannot be drawn by the standard PDF fonts, so it is dropped.
    .replace(/[^\n -~ -ÿ–•]/g, '')
    .replace(/ {2,}/g, ' ')
    .trim();
};

CV.splitLines = function (text) {
  return String(text || '').split('\n')
    .map(function (line) { return CV.cleanText(line.replace(/^\s*([-*•▪●–>]|\d+[.)])\s+/, '')); })
    .filter(Boolean);
};

/* '2023-01' -> 'Jan 2023'. Free text is kept as typed. */
CV.formatMonth = function (value) {
  if (!value) return '';
  if (value === 'present') return 'Present';
  var m = /^(\d{4})-(\d{2})$/.exec(value);
  if (!m) return CV.cleanText(value);
  return MONTHS[parseInt(m[2], 10) - 1] + ' ' + m[1];
};

CV.isFuture = function (value) {
  var m = /^(\d{4})-(\d{2})$/.exec(value || '');
  if (!m) return false;
  var now = new Date();
  return parseInt(m[1], 10) * 12 + parseInt(m[2], 10) > now.getFullYear() * 12 + now.getMonth() + 1;
};

CV.formatRange = function (start, end, expectedAllowed) {
  var s = CV.formatMonth(start);
  var e = CV.formatMonth(end);
  if (e && expectedAllowed && CV.isFuture(end)) e = 'Expected ' + e;
  if (s && e) return s + ' – ' + e;
  return s || e;
};

function joinParts(parts, sep) {
  return parts.map(CV.cleanText).filter(Boolean).join(sep);
}

function hasContent(cv, key) {
  var value = cv[key];
  if (key === 'summary' || key === 'achievements') return CV.cleanText(value).length > 0;
  return Array.isArray(value) && value.some(function (item) {
    return Object.keys(item).some(function (k) { return CV.cleanText(item[k]).length > 0; });
  });
}

var SECTION_BLOCKS = {
  summary: function (cv) {
    return [{ type: 'para', segs: [{ text: CV.cleanText(cv.summary), style: 'normal' }] }];
  },
  achievements: function (cv) {
    return [{ type: 'bullets', items: CV.splitLines(cv.achievements) }];
  },
  experience: function (cv) {
    var out = [];
    cv.experience.forEach(function (e) {
      out.push({ type: 'entry', title: CV.cleanText(e.title), sub: joinParts([e.org, e.location], ', '), date: CV.formatRange(e.start, e.end) });
      out.push({ type: 'bullets', items: CV.splitLines(e.bullets) });
    });
    return out;
  },
  education: function (cv) {
    var out = [];
    cv.education.forEach(function (e) {
      out.push({ type: 'entry', title: CV.cleanText(e.qualification), sub: joinParts([e.institution, e.location], ', '), date: CV.formatRange(e.start, e.end, true) });
      if (CV.cleanText(e.grade)) out.push({ type: 'para', segs: [{ text: CV.cleanText(e.grade), style: 'normal' }] });
      out.push({ type: 'bullets', items: CV.splitLines(e.bullets) });
    });
    return out;
  },
  projects: function (cv) {
    var out = [];
    cv.projects.forEach(function (p) {
      out.push({ type: 'entry', title: CV.cleanText(p.name), sub: joinParts([p.role, p.link], ' | '), date: CV.formatRange(p.start, p.end) });
      out.push({ type: 'bullets', items: CV.splitLines(p.bullets) });
    });
    return out;
  },
  activities: function (cv) {
    var out = [];
    cv.activities.forEach(function (a) {
      out.push({ type: 'entry', title: CV.cleanText(a.role), sub: CV.cleanText(a.org), date: CV.formatRange(a.start, a.end) });
      out.push({ type: 'bullets', items: CV.splitLines(a.bullets) });
    });
    return out;
  },
  skills: function (cv) {
    return cv.skills.filter(function (s) { return CV.cleanText(s.items); }).map(function (s) {
      var label = CV.cleanText(s.category);
      var segs = label ? [{ text: label + ': ', style: 'bold' }] : [];
      segs.push({ text: CV.cleanText(s.items), style: 'normal' });
      return { type: 'item', segs: segs, date: '' };
    });
  },
  certifications: function (cv) {
    return cv.certifications.filter(function (c) { return CV.cleanText(c.name); }).map(function (c) {
      var segs = [{ text: CV.cleanText(c.name), style: 'bold' }];
      if (CV.cleanText(c.issuer)) segs.push({ text: ', ' + CV.cleanText(c.issuer), style: 'normal' });
      return { type: 'item', segs: segs, date: CV.formatMonth(c.date) };
    });
  },
  languages: function (cv) {
    var text = cv.languages.filter(function (l) { return CV.cleanText(l.language); }).map(function (l) {
      return CV.cleanText(l.language) + (CV.cleanText(l.level) ? ' (' + CV.cleanText(l.level) + ')' : '');
    }).join(', ');
    return [{ type: 'para', segs: [{ text: text, style: 'normal' }] }];
  },
  additional: function (cv) {
    return cv.additional.filter(function (a) { return CV.cleanText(a.value); }).map(function (a) {
      var segs = CV.cleanText(a.label) ? [{ text: CV.cleanText(a.label) + ': ', style: 'bold' }] : [];
      segs.push({ text: CV.cleanText(a.value), style: 'normal' });
      return { type: 'item', segs: segs, date: '' };
    });
  },
  referees: function (cv) {
    var out = [];
    cv.referees.forEach(function (r) {
      out.push({ type: 'entry', title: CV.cleanText(r.name), sub: CV.cleanText(r.position), date: '' });
      if (CV.cleanText(r.contact)) out.push({ type: 'para', segs: [{ text: CV.cleanText(r.contact), style: 'normal' }] });
    });
    return out;
  }
};

CV.buildBlocks = function (cv) {
  var p = cv.personal;
  var blocks = [];
  blocks.push({ type: 'name', text: CV.cleanText(p.fullName) || 'Your Name' });
  if (CV.cleanText(p.headline)) blocks.push({ type: 'headline', text: CV.cleanText(p.headline) });
  var contact = [p.phone, p.email, p.location, p.linkedin, p.website].map(CV.cleanText).filter(Boolean);
  if (contact.length) blocks.push({ type: 'contact', items: contact });

  cv.order.forEach(function (key) {
    if (cv.hidden[key] || !SECTION_BLOCKS[key] || !hasContent(cv, key)) return;
    blocks.push({ type: 'heading', text: CV.sectionTitle(key, cv.tier), key: key });
    SECTION_BLOCKS[key](cv).forEach(function (b) {
      if (b.type === 'bullets' && !b.items.length) return;
      blocks.push(b);
    });
  });
  return blocks;
};

CV.fileBaseName = function (cv) {
  var name = CV.cleanText(cv.personal.fullName).replace(/[^A-Za-z0-9 ]/g, '').trim().replace(/\s+/g, '_');
  return (name || 'My') + '_CV';
};

})();
