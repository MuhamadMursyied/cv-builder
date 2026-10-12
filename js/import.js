/*
 * Import an existing CV (PDF, Word .docx, plain text) and fill in the form.
 *
 * Two steps, both in the browser:
 *   1. extract  file -> lines of text
 *        PDF   pdf.js (loaded only when needed), lines rebuilt from text positions
 *        DOCX  unzipped with the browser's DecompressionStream, paragraphs read from XML
 *        TXT   as is
 *   2. parse    lines -> CV data, using section headings (English and Malay),
 *               date ranges, bullets and contact patterns
 *
 * Parsing is rule-based, so it is a head start, not a perfect copy. The app
 * shows what was filled and any text it could not place, for the user to review.
 *
 * The public functions (CV.extractCvLines, CV.parseCvLines, CV.importCvFile)
 * have no UI dependencies and return CV Builder's own data format.
 */
window.CV = window.CV || {};

(function () {

/* ---------- 1. extract ---------- */

var PDFJS_URLS = ['vendor/pdf.min.js', 'vendor/pdf.worker.min.js'];

function loadScript(src) {
  return new Promise(function (resolve, reject) {
    var s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = function () { reject(new Error('Could not load ' + src)); };
    document.head.appendChild(s);
  });
}

// Loading the worker script on the page makes pdf.js run in the main thread,
// which works from file://, on any static host and inside sandboxed frames.
function loadPdfJs() {
  if (window.pdfjsLib && window.pdfjsWorker) return Promise.resolve(window.pdfjsLib);
  var urls = CV.PDFJS_URLS || PDFJS_URLS;
  return loadScript(urls[0]).then(function () { return loadScript(urls[1]); }).then(function () { return window.pdfjsLib; });
}

function pdfLines(buffer) {
  return loadPdfJs().then(function (pdfjsLib) {
    return pdfjsLib.getDocument({ data: new Uint8Array(buffer), isEvalSupported: false }).promise;
  }).then(function (pdf) {
    var pages = [];
    for (var i = 1; i <= pdf.numPages; i++) pages.push(pdf.getPage(i).then(function (p) { return p.getTextContent(); }));
    return Promise.all(pages);
  }).then(function (contents) {
    var lines = [];
    contents.forEach(function (content) {
      // Group text pieces that share a baseline into one line.
      var rows = [];
      content.items.forEach(function (it) {
        if (!it.str || !it.str.trim()) return;
        var x = it.transform[4], y = it.transform[5];
        var row = rows.find(function (r) { return Math.abs(r.y - y) < 2.5; });
        if (!row) { row = { y: y, items: [] }; rows.push(row); }
        row.items.push({ x: x, end: x + it.width, str: it.str });
      });
      rows.sort(function (a, b) { return b.y - a.y; });
      var minX = Math.min.apply(null, rows.map(function (r) { return Math.min.apply(null, r.items.map(function (it) { return it.x; })); }));
      rows.forEach(function (row) {
        row.items.sort(function (a, b) { return a.x - b.x; });
        var text = '';
        var lastEnd = null;
        row.items.forEach(function (it) {
          if (lastEnd !== null) {
            var gap = it.x - lastEnd;
            // A wide gap usually separates a title from a right-aligned date.
            if (gap > 24) text += '\t';
            else if (gap > 1 && !/\s$/.test(text) && !/^\s/.test(it.str)) text += ' ';
          }
          text += it.str;
          lastEnd = it.end;
        });
        // Leading spaces mark an indented line, e.g. the wrapped part of a bullet.
        lines.push((row.items[0].x > minX + 6 ? '    ' : '') + text);
      });
      lines.push('');
    });
    return lines;
  });
}

/* Minimal ZIP reader for .docx (uses the browser's built-in inflate). */
function unzipEntry(buffer, wanted) {
  var view = new DataView(buffer);
  var eocd = -1;
  for (var i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return Promise.reject(new Error('not a zip'));
  var count = view.getUint16(eocd + 10, true);
  var ptr = view.getUint32(eocd + 16, true);
  var decoder = new TextDecoder();
  for (var n = 0; n < count; n++) {
    var method = view.getUint16(ptr + 10, true);
    var compSize = view.getUint32(ptr + 20, true);
    var nameLen = view.getUint16(ptr + 28, true);
    var extraLen = view.getUint16(ptr + 30, true);
    var commentLen = view.getUint16(ptr + 32, true);
    var localOffset = view.getUint32(ptr + 42, true);
    var name = decoder.decode(new Uint8Array(buffer, ptr + 46, nameLen));
    if (name === wanted) {
      var dataStart = localOffset + 30 + view.getUint16(localOffset + 26, true) + view.getUint16(localOffset + 28, true);
      var data = new Uint8Array(buffer, dataStart, compSize);
      if (method === 0) return Promise.resolve(decoder.decode(data));
      if (method !== 8 || typeof DecompressionStream === 'undefined') return Promise.reject(new Error('unsupported zip'));
      var stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
      return new Response(stream).text();
    }
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  return Promise.reject(new Error('missing ' + wanted));
}

var W_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

function docxLines(buffer) {
  return unzipEntry(buffer, 'word/document.xml').then(function (xml) {
    var doc = new DOMParser().parseFromString(xml, 'application/xml');
    var lines = [];
    var paras = doc.getElementsByTagNameNS(W_NS, 'p');
    for (var i = 0; i < paras.length; i++) {
      var p = paras[i];
      var text = '';
      var walker = doc.createTreeWalker(p, NodeFilter.SHOW_ELEMENT);
      var node;
      while ((node = walker.nextNode())) {
        if (node.namespaceURI !== W_NS) continue;
        if (node.localName === 't') text += node.textContent;
        else if (node.localName === 'tab') text += '\t';
        else if (node.localName === 'br') text += '\n';
      }
      var style = p.getElementsByTagNameNS(W_NS, 'pStyle')[0];
      var isList = p.getElementsByTagNameNS(W_NS, 'numPr').length > 0 ||
        !!(style && /list|bullet/i.test(style.getAttributeNS(W_NS, 'val') || style.getAttribute('w:val') || ''));
      text.split('\n').forEach(function (t, k) { lines.push((isList && k === 0 && t.trim() ? '• ' : '') + t); });
    }
    return lines;
  });
}

CV.extractCvLines = function (file) {
  var name = (file.name || '').toLowerCase();
  return file.arrayBuffer().then(function (buffer) {
    var head = new Uint8Array(buffer, 0, Math.min(5, buffer.byteLength));
    var isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46; // %PDF
    var isZip = head[0] === 0x50 && head[1] === 0x4b;                                          // PK
    if (isPdf || /\.pdf$/.test(name)) return pdfLines(buffer);
    if (isZip || /\.docx$/.test(name)) return docxLines(buffer);
    if (/\.doc$/.test(name)) throw new Error('old-doc');
    return new TextDecoder().decode(buffer).split(/\r?\n/);
  });
};

/* ---------- 2. parse ---------- */

var HEADINGS = {
  summary: ['summary', 'professional summary', 'executive summary', 'career summary', 'profile', 'professional profile', 'personal profile', 'about me', 'objective', 'career objective', 'objectives', 'ringkasan', 'profil', 'objektif', 'objektif kerjaya'],
  experience: ['experience', 'work experience', 'working experience', 'professional experience', 'employment', 'employment history', 'work history', 'career history', 'internship', 'internships', 'internship experience', 'internship & work experience', 'relevant experience', 'pengalaman', 'pengalaman kerja', 'latihan industri'],
  education: ['education', 'educational background', 'academic background', 'academic qualifications', 'education background', 'qualifications', 'academic', 'pendidikan', 'kelayakan akademik', 'latar belakang pendidikan'],
  skills: ['skills', 'technical skills', 'key skills', 'core competencies', 'competencies', 'skills & competencies', 'skills and competencies', 'technical competencies', 'computer skills', 'soft skills', 'kemahiran', 'kemahiran teknikal'],
  projects: ['projects', 'project', 'key projects', 'academic projects', 'personal projects', 'final year project', 'projek'],
  activities: ['co-curricular', 'co-curricular activities', 'cocurricular activities', 'extracurricular activities', 'extra-curricular activities', 'activities', 'leadership', 'leadership experience', 'volunteering', 'volunteer experience', 'co-curricular & leadership', 'board & industry roles', 'memberships', 'professional memberships', 'kokurikulum', 'aktiviti kokurikulum'],
  certifications: ['certifications', 'certification', 'certificates', 'licenses & certifications', 'licenses and certifications', 'professional certifications', 'training', 'courses', 'training & certifications', 'sijil', 'kursus'],
  achievements: ['achievements', 'awards', 'honours', 'honors', 'awards & achievements', 'achievements & awards', 'key achievements', 'accomplishments', 'awards and honours', 'pencapaian', 'anugerah'],
  languages: ['languages', 'language', 'language proficiency', 'language skills', 'languages spoken', 'bahasa', 'penguasaan bahasa', 'kemahiran bahasa'],
  referees: ['references', 'referees', 'reference', 'referee', 'rujukan'],
  additional: ['additional information', 'personal details', 'personal information', 'personal particulars', 'other information', 'maklumat peribadi', 'maklumat tambahan'],
  _contact: ['contact', 'contact details', 'contact information', 'hubungi']
};

var HEADING_LOOKUP = {};
Object.keys(HEADINGS).forEach(function (key) {
  HEADINGS[key].forEach(function (h) { HEADING_LOOKUP[h] = key; });
});

function headingKey(line) {
  var t = line.replace(/\t/g, ' ').replace(/[:–—_=*#|]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  if (!t || t.length > 40) return null;
  return HEADING_LOOKUP[t] || null;
}

var MONTHS = {
  jan: 1, january: 1, januari: 1, feb: 2, february: 2, februari: 2, mar: 3, march: 3, mac: 3,
  apr: 4, april: 4, may: 5, mei: 5, jun: 6, june: 6, jul: 7, july: 7, julai: 7,
  aug: 8, august: 8, ogos: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11, dec: 12, december: 12, dis: 12, disember: 12
};
var MONTH_RE = '(?:' + Object.keys(MONTHS).sort(function (a, b) { return b.length - a.length; }).join('|') + ')\\.?';
var YEAR = '(?:19|20)\\d{2}';
var DATE_RE = '(?:' + MONTH_RE + ',?\\s+' + YEAR + '|\\d{1,2}[/.-]' + YEAR + '|' + YEAR + '[/.-]\\d{1,2}|' + YEAR + ')';
var PRESENT_RE = '(?:present|current|now|today|ongoing|kini|sekarang|masa kini)';
var RANGE = new RegExp('(' + DATE_RE + ')\\s*(?:-|\\u2013|\\u2014|to|until|hingga|sehingga)\\s*(' + DATE_RE + '|' + PRESENT_RE + ')', 'i');
var SINGLE = new RegExp('(' + DATE_RE + '|' + PRESENT_RE + ')', 'i');
var EXPECTED = /\b(expected|jangkaan)\b/i;

function toMonthValue(text) {
  if (!text) return '';
  var t = text.trim().toLowerCase().replace(/\./g, '');
  if (new RegExp('^' + PRESENT_RE + '$').test(t)) return 'present';
  var m = t.match(/^([a-z]+),?\s+(\d{4})$/);
  if (m && MONTHS[m[1]]) return m[2] + '-' + String(MONTHS[m[1]]).padStart(2, '0');
  m = t.match(/^(\d{1,2})[/-](\d{4})$/);
  if (m && +m[1] >= 1 && +m[1] <= 12) return m[2] + '-' + m[1].padStart(2, '0');
  m = t.match(/^(\d{4})[/-](\d{1,2})$/);
  if (m && +m[2] >= 1 && +m[2] <= 12) return m[1] + '-' + m[2].padStart(2, '0');
  return text.trim(); // year only or anything else: keep as typed
}

/* Finds a date range (or single date) in a line and returns it plus the rest. */
function takeDates(line) {
  var m = line.match(RANGE);
  if (m) return { start: toMonthValue(m[1]), end: toMonthValue(m[2]), rest: cleanRest(line.replace(m[0], ' ')) };
  m = line.match(SINGLE);
  if (m) {
    var expected = EXPECTED.test(line);
    return { start: '', end: toMonthValue(m[1]), rest: cleanRest(line.replace(m[0], ' ').replace(EXPECTED, ' ')), single: true, expected: expected };
  }
  return null;
}

function cleanRest(s) {
  return s.replace(/\t/g, ' ').replace(/[(\[]\s*[)\]]/g, ' ').replace(/\s*[|,–—-]\s*$/g, '').replace(/^\s*[|,–—-]\s*/g, '').replace(/\s+/g, ' ').trim();
}

var BULLET_RE = /^\s*(?:[•▪●◦‣⁃∙➢➔►▶✓✔·*\-–o]|\d+[.)])\s+/;
var EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
var PHONE_RE = /(?:\+?6?0)[\s-]?1\d[\s-]?\d{3,4}[\s-]?\d{3,4}|\+?6?0[\s-]?[3-9][\s-]?\d{3,4}[\s-]?\d{4}|\+\d[\d\s-]{8,15}\d/;
var LINKEDIN_RE = /(?:https?:\/\/)?(?:[a-z]{2,3}\.)?linkedin\.com\/[^\s|,]+/i;
var URL_RE = /(?:https?:\/\/)?(?:www\.)?(?:github\.com|gitlab\.com|behance\.net|[a-z0-9-]+\.(?:com|my|dev|io|net|org|me))(?:\/[^\s|,]*)?/i;
var STATES = /\b(serdang|bangi|kajang|semenyih|nilai|rawang|sepang|gombak|ampang|setapak|kepong|damansara|sungai buloh|skudai|nusajaya|iskandar puteri|pasir gudang|batu pahat|muar|kluang|segamat|senai|parit raja|nibong tebal|bayan lepas|bayan baru|butterworth|bukit mertajam|kulim|sungai petani|alor setar|langkawi|sintok|arau|kangar|seri iskandar|tronoh|taiping|lumut|teluk intan|kuantan|gambang|pekan|temerloh|bentong|kuala terengganu|kota bharu|alor gajah|ayer keroh|port dickson|miri|sibu|bintulu|sandakan|tawau|johor|kedah|kelantan|melaka|malacca|negeri sembilan|pahang|penang|pulau pinang|perak|perlis|sabah|sarawak|selangor|terengganu|kuala lumpur|putrajaya|labuan|petaling jaya|shah alam|subang|cyberjaya|ipoh|seremban|kuching|kota kinabalu|johor bahru|georgetown|klang|puchong|cheras|bangsar|mont kiara|malaysia|singapore)\b/i;
var SENSITIVE_RE = /\b(ic\s*no|i\/c|nric|mykad|race|bangsa|religion|agama|marital|status perkahwinan|date of birth|d\.o\.b|tarikh lahir|age|umur|gender|jantina|height|weight)\b/i;
var DEGREE_RE = /\b(bachelor|degree|diploma|master|phd|doctor of|foundation|matriculation|matrikulasi|asasi|spm|stpm|uec|a-level|a level|o-level|igcse|certificate|sijil|ijazah|sarjana|b\.?\s?(?:eng|sc|a|cs|it)|m\.?\s?(?:eng|sc|ba)|mba|hons)\b/i;
var INSTITUTION_RE = /\b(universiti|university|college|kolej|institute|institut|politeknik|polytechnic|school|sekolah|academy|akademi|uitm|utm|ukm|upm|usm|um|uum|uthm|unimap|ump|utp|mmu|taylor|sunway|apu|ucsi|segi|inti|help)\b/i;
var GRADE_RE = /\b(cgpa|gpa|pngk|first class|second class|class honours|distinction|merit|grade|band \d|muet|ielts|\d+\s?a\+?|dean'?s list)\b/i;
var LEVEL_RE = /\b(native|fluent|proficient|advanced|intermediate|basic|beginner|conversational|mother tongue|professional|good|excellent|fair|limited|band \d|ielts|muet|hsk|n[1-5]|written|spoken|penutur asli|fasih|baik|asas)\b/i;

function isBullet(line) { return BULLET_RE.test(line); }
function stripBullet(line) { return line.replace(BULLET_RE, '').trim(); }

function splitPair(text) {
  // "Software Engineer | ABC Sdn. Bhd." / "Engineer at ABC" / "ABC - Engineer"
  var parts = text.split(/\s+(?:\||–|—|-|@|at)\s+|\s*\|\s*|\t+/).map(function (s) { return s.trim(); }).filter(Boolean);
  if (parts.length >= 2) return [parts[0], parts.slice(1).join(', ')];
  return [text, ''];
}

function looksLikeCompany(s) {
  return /\b(sdn\.?\s*bhd|bhd|berhad|ltd|limited|inc|corp|corporation|company|plc|llc|group|holdings|enterprise|services|solutions|technologies|technology|bank|hospital|university|universiti|kolej|college|ministry|kementerian|jabatan|agency|centre|center)\b/i.test(s);
}

/* Groups section lines into entries: a header (1 to 3 lines) followed by bullets. */
function hasDate(line) { return RANGE.test(line) || SINGLE.test(line); }

function groupEntries(lines, isStart) {
  var entries = [];
  var cur = null;
  lines.forEach(function (raw) {
    var indented = /^\s{2,}/.test(raw);
    var line = raw.trim();
    if (!line) { if (cur && cur.bullets.length) cur.closed = true; return; }
    if (isBullet(line)) {
      if (!cur) { cur = { header: [], bullets: [] }; entries.push(cur); }
      cur.bullets.push(stripBullet(line));
      cur.lastWasBullet = true;
      return;
    }
    // Wrapped continuation of the previous bullet
    if (cur && cur.lastWasBullet && !cur.closed && (indented || /^[a-z0-9(,&]/.test(line)) && !RANGE.test(line)) {
      cur.bullets[cur.bullets.length - 1] += ' ' + line;
      return;
    }
    var startsNew = !cur || cur.bullets.length > 0 || cur.closed ||
      (hasDate(line) && cur.header.some(hasDate) && cur.header.length >= 2) ||
      // "Title" / "Organisation | date" then a short line: the next entry begins
      (cur.header.length >= 2 && hasDate(cur.header[cur.header.length - 1]) && line.length < 60 && !/[.;]$/.test(line) && !GRADE_RE.test(line)) ||
      (isStart && isStart(line, cur));
    if (startsNew) { cur = { header: [], bullets: [] }; entries.push(cur); }
    if (cur.header.length < 3 || !cur.bullets.length) cur.header.push(line);
    cur.lastWasBullet = false;
  });
  // Long header-only paragraphs: keep the first two lines as header, the rest as bullets.
  entries.forEach(function (e) {
    if (e.header.length > 3) e.bullets = e.header.splice(3).concat(e.bullets);
  });
  return entries;
}

function parseHeader(header) {
  var dates = null;
  var texts = [];
  header.forEach(function (h) {
    if (!dates) {
      var d = takeDates(h);
      if (d) {
        dates = d;
        if (d.rest) texts.push(d.rest);
        return;
      }
    }
    texts.push(cleanRest(h));
  });
  return { dates: dates || { start: '', end: '' }, texts: texts.filter(Boolean) };
}

/* "ABC Sdn. Bhd., Bayan Lepas, Penang" -> main "ABC Sdn. Bhd.", location "Bayan Lepas, Penang" */
function locationOf(text) {
  var parts = text.split(/\s*,\s*/);
  var i = parts.length;
  while (i > 1) {
    var seg = parts[i - 1];
    var place = seg.split(/\s+/).length <= 4 && !/\d/.test(seg) && STATES.test(seg) && !looksLikeCompany(seg) && !INSTITUTION_RE.test(seg);
    if (!place) break;
    i--;
  }
  if (i === parts.length) return { main: text, location: '' };
  return { main: parts.slice(0, i).join(', '), location: parts.slice(i).join(', ') };
}

var SECTION_PARSERS = {
  summary: function (lines, cv) {
    cv.summary = lines.map(function (l) { return stripBullet(l.trim()); }).filter(Boolean).join(' ');
  },
  experience: function (lines, cv) {
    groupEntries(lines).forEach(function (e) {
      var h = parseHeader(e.header);
      var title = h.texts[0] || '';
      var org = h.texts[1] || '';
      if (!org) { var pair = splitPair(title); title = pair[0]; org = pair[1]; }
      // "Company" first, "Title" second is common too.
      if (looksLikeCompany(title) && !looksLikeCompany(org) && org) { var t = title; title = org; org = t; }
      var loc = locationOf(org);
      var extra = h.texts.slice(2);
      cv.experience.push({ title: title, org: loc.main, location: loc.location, start: h.dates.start, end: h.dates.end, bullets: extra.concat(e.bullets).join('\n') });
    });
  },
  education: function (lines, cv) {
    var isStart = function (line, cur) { return DEGREE_RE.test(line) && cur.header.some(function (h) { return DEGREE_RE.test(h); }); };
    groupEntries(lines, isStart).forEach(function (e) {
      var h = parseHeader(e.header);
      var texts = h.texts.slice();
      var bullets = e.bullets.slice();
      var grade = '';
      // A grade line can sit in the header or among the bullets.
      [texts, bullets].forEach(function (list) {
        for (var i = list.length - 1; i >= 0; i--) {
          if (!grade && GRADE_RE.test(list[i]) && list[i].length < 90) { grade = list.splice(i, 1)[0]; }
        }
      });
      var qIndex = texts.findIndex(function (t) { return DEGREE_RE.test(t); });
      var iIndex = texts.findIndex(function (t, i) { return i !== qIndex && INSTITUTION_RE.test(t); });
      if (qIndex === -1 && texts.length === 1) {
        var pair = splitPair(texts[0]);
        if (pair[1]) { texts = pair; qIndex = DEGREE_RE.test(pair[1]) ? 1 : 0; iIndex = 1 - qIndex; }
      }
      if (qIndex === -1) qIndex = iIndex === 0 ? 1 : 0;
      if (iIndex === -1) iIndex = texts.findIndex(function (t, i) { return i !== qIndex; });
      var institution = locationOf(texts[iIndex] || '');
      var rest = texts.filter(function (t, i) { return i !== qIndex && i !== iIndex; });
      cv.education.push({
        qualification: texts[qIndex] || '', institution: institution.main, location: institution.location,
        start: h.dates.start, end: h.dates.end, grade: grade.replace(/^(result|grade|keputusan)\s*:\s*/i, ''),
        bullets: rest.concat(bullets).join('\n')
      });
    });
  },
  skills: function (lines, cv) {
    var loose = [];
    lines.forEach(function (raw) {
      var line = stripBullet(raw.trim()).replace(/\t+/g, ', ');
      if (!line) return;
      var m = line.match(/^([^:]{2,40}):\s*(.+)$/);
      if (m) cv.skills.push({ category: m[1].trim(), items: m[2].trim() });
      else loose.push(line);
    });
    if (loose.length) {
      var items = loose.join(', ').split(/\s*(?:,|;|\||•|·)\s*/).filter(Boolean);
      cv.skills.push({ category: cv.skills.length ? 'Other' : '', items: items.join(', ') });
    }
  },
  projects: function (lines, cv) {
    groupEntries(lines).forEach(function (e) {
      var h = parseHeader(e.header);
      var name = h.texts[0] || '';
      var role = h.texts[1] || '';
      var link = '';
      var linkLine = h.texts.concat(e.bullets).find(function (t) { return URL_RE.test(t) && !EMAIL_RE.test(t); });
      if (linkLine) link = linkLine.match(URL_RE)[0];
      if (!role) { var pair = splitPair(name); name = pair[0]; role = pair[1]; }
      cv.projects.push({ name: name, role: role.replace(link, '').replace(/\s*\|\s*$/, '').trim(), link: link, start: h.dates.start, end: h.dates.end, bullets: h.texts.slice(2).concat(e.bullets).join('\n') });
    });
  },
  activities: function (lines, cv) {
    groupEntries(lines).forEach(function (e) {
      var h = parseHeader(e.header);
      var role = h.texts[0] || '';
      var org = h.texts[1] || '';
      if (!org) { var pair = splitPair(role); role = pair[0]; org = pair[1]; }
      cv.activities.push({ role: role, org: org, start: h.dates.start, end: h.dates.end, bullets: h.texts.slice(2).concat(e.bullets).join('\n') });
    });
  },
  certifications: function (lines, cv) {
    lines.forEach(function (raw) {
      var line = stripBullet(raw.trim());
      if (!line) return;
      var d = takeDates(line);
      var text = d ? d.rest : cleanRest(line);
      // Issuer follows the last "|" or comma: "AWS Certified Solutions Architect - Associate, Amazon Web Services"
      var cut = text.lastIndexOf('|') !== -1 ? text.lastIndexOf('|') : text.lastIndexOf(', ');
      var name = cut > 0 ? text.slice(0, cut).trim() : text;
      var issuer = cut > 0 ? text.slice(cut + 1).replace(/^[\s,]+/, '').trim() : '';
      cv.certifications.push({ name: name, issuer: issuer, date: d ? (d.end || d.start) : '' });
    });
  },
  achievements: function (lines, cv) {
    var items = [];
    lines.forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      if (!isBullet(line) && items.length && (/^\s{2,}/.test(raw) || /^[a-z(]/.test(line))) items[items.length - 1] += ' ' + line;
      else items.push(stripBullet(line).replace(/\t+/g, ', '));
    });
    cv.achievements = (cv.achievements ? cv.achievements + '\n' : '') + items.join('\n');
  },
  languages: function (lines, cv) {
    var text = lines.map(function (l) { return stripBullet(l.trim()); }).filter(Boolean).join(', ');
    text.split(/\s*(?:,(?![^(]*\))|;|\n)\s*/).forEach(function (part) {
      if (!part) return;
      var m = part.match(/^([^(:\-–\t]+?)\s*(?:\(([^)]+)\)|[:\-–\t]\s*(.+))?$/);
      if (!m) return;
      var language = m[1].trim();
      var level = (m[2] || m[3] || '').trim();
      // "Fluent" on its own belongs to the previous language.
      if (!level && LEVEL_RE.test(language) && cv.languages.length && !cv.languages[cv.languages.length - 1].level) {
        cv.languages[cv.languages.length - 1].level = language;
        return;
      }
      cv.languages.push({ language: language, level: level });
    });
  },
  referees: function (lines, cv) {
    var cur = null;
    lines.forEach(function (raw) {
      var line = stripBullet(raw.trim());
      if (!line) { cur = null; return; }
      if (/available upon request|boleh didapati/i.test(line)) return;
      var isContact = EMAIL_RE.test(line) || PHONE_RE.test(line);
      var isName = !isContact && /^(dr|prof|mr|mrs|ms|miss|encik|en|puan|pn|cik|tuan|ir|ts|dato|datin|tan sri)\b\.?/i.test(line);
      if (!cur || (isName && (cur.position || cur.contact))) { cur = { name: '', position: '', contact: '' }; cv.referees.push(cur); }
      if (isContact) cur.contact = cur.contact ? cur.contact + ' | ' + line : line;
      else if (!cur.name) cur.name = line;
      else cur.position = cur.position ? cur.position + ', ' + line : line;
    });
  },
  additional: function (lines, cv, notes) {
    lines.forEach(function (raw) {
      var line = stripBullet(raw.trim());
      if (!line) return;
      // Personal particulars (IC, race, religion...) are not copied in.
      if (SENSITIVE_RE.test(line)) { notes.skippedSensitive.push(line); return; }
      var m = line.match(/^([^:]{2,40})\s*:\s*(.+)$/);
      if (m) cv.additional.push({ label: m[1].trim(), value: m[2].trim() });
      else cv.additional.push({ label: '', value: line });
    });
  }
};

/* Name, headline and contact details from the top of the CV. */
function parseTop(lines, cv, notes) {
  var p = cv.personal;
  var leftovers = [];
  lines.forEach(function (raw) {
    var line = raw.replace(/\t+/g, ' | ').trim();
    if (!line) return;
    var used = false;
    var email = line.match(EMAIL_RE);
    if (email && !p.email) { p.email = email[0]; line = line.replace(email[0], ' '); used = true; }
    var li = line.match(LINKEDIN_RE);
    if (li && !p.linkedin) { p.linkedin = li[0].replace(/^https?:\/\/(www\.)?/, ''); line = line.replace(li[0], ' '); used = true; }
    var phone = line.match(PHONE_RE);
    if (phone && !p.phone) { p.phone = phone[0].trim(); line = line.replace(phone[0], ' '); used = true; }
    var url = line.match(URL_RE);
    if (url && !p.website && !EMAIL_RE.test(url[0])) { p.website = url[0].replace(/^https?:\/\/(www\.)?/, ''); line = line.replace(url[0], ' '); used = true; }
    line = line.replace(/\b(email|e-mail|phone|tel|mobile|h\/p|hp|linkedin|github|address|alamat|no\.? tel)\s*:?/gi, ' ')
      .replace(/^[\s|,•·\-]+|[\s|,•·\-]+$/g, '').replace(/(\s*\|\s*)+/g, ' | ').trim();
    if (!line) return;
    if (SENSITIVE_RE.test(line)) { notes.skippedSensitive.push(line); return; }
    // Full home address: keep only "City, State" after the postcode.
    var addr = line.match(/\b\d{5}\s+([^,|]+),\s*([^,|]+)/);
    if (addr && !p.location) { p.location = addr[1].trim() + ', ' + addr[2].trim(); return; }
    if (used && STATES.test(line) && !p.location) { p.location = line.split(' | ').find(function (s) { return STATES.test(s); }) || line; return; }
    if (!p.fullName && !/\d/.test(line) && line.split(/\s+/).length <= 7 && !headingKey(line)) { p.fullName = toNameCase(line); return; }
    if (p.fullName && !p.headline && line.length <= 80 && !STATES.test(line)) { p.headline = line; return; }
    if (!p.location && STATES.test(line) && line.length <= 80) { p.location = line; return; }
    leftovers.push(line);
  });
  // A paragraph before the first heading is usually the summary.
  var para = leftovers.filter(function (l) { return l.length > 40; });
  if (para.length && !cv.summary) cv.summary = para.join(' ');
  leftovers.filter(function (l) { return l.length <= 40; }).forEach(function (l) { notes.unplaced.push(l); });
}

function toNameCase(name) {
  if (name !== name.toUpperCase()) return name;
  return name.toLowerCase().replace(/(^|[\s'-])([a-z])/g, function (m, a, b) { return a + b.toUpperCase(); })
    .replace(/\b(Bin|Binti|Bt|A\/L|A\/P|Al|Van|De)\b/g, function (w) { return w.toLowerCase(); });
}

function guessTier(cv) {
  var now = new Date();
  var nowIdx = now.getFullYear() * 12 + now.getMonth() + 1;
  function idx(v) {
    if (v === 'present') return nowIdx;
    var m = /^(\d{4})(?:-(\d{2}))?/.exec(v || '');
    return m ? +m[1] * 12 + (+m[2] || 6) : null;
  }
  var months = 0;
  cv.experience.forEach(function (e) {
    var s = idx(e.start), en = idx(e.end);
    if (s && en && en > s && !/intern|part[- ]time|trainee|praktikal|latihan/i.test(e.title)) months += en - s;
  });
  var studying = cv.education.some(function (e) { return /expected|jangkaan/i.test(e.end) || (idx(e.end) || 0) > nowIdx; });
  var senior = cv.experience.some(function (e) { return /\b(chief|director|head of|vice president|vp|general manager|ceo|coo|cfo|cto|managing|pengarah|ketua)\b/i.test(e.title); });
  if (studying || months < 18) return 'student';
  if (senior || months >= 12 * 12) return 'senior';
  return 'mid';
}

CV.parseCvLines = function (rawLines) {
  var cv = CV.emptyCV('mid');
  var notes = { filled: [], unplaced: [], skippedSensitive: [] };
  var sections = { _top: [] };
  var current = '_top';
  var order = [];
  rawLines.forEach(function (line) {
    var key = headingKey(line);
    if (key) {
      current = key;
      if (!sections[key]) { sections[key] = []; order.push(key); }
      return;
    }
    sections[current].push(line);
  });

  parseTop(sections._top.concat(sections._contact || []), cv, notes);
  order.forEach(function (key) {
    if (key === '_contact') return;
    SECTION_PARSERS[key](sections[key], cv, notes);
    notes.filled.push(key);
  });

  cv.tier = guessTier(cv);
  cv.theme = CV.TIERS[cv.tier].defaultTheme;
  // Keep the tier's recommended order, but show every section that has content.
  var tierOrder = CV.TIERS[cv.tier].order;
  cv.order = tierOrder.concat(Object.keys(CV.SECTIONS).filter(function (k) { return tierOrder.indexOf(k) === -1; }));
  cv.hidden = {};
  Object.keys(CV.SECTIONS).forEach(function (k) {
    if (tierOrder.indexOf(k) === -1 && notes.filled.indexOf(k) === -1) cv.hidden[k] = true;
  });
  return { cv: cv, notes: notes };
};

CV.importCvFile = function (file) {
  return CV.extractCvLines(file).then(function (lines) {
    var text = lines.join('').replace(/\s/g, '');
    if (text.length < 40) throw new Error('no-text');
    return CV.parseCvLines(lines);
  });
};

})();
