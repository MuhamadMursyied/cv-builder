/*
 * ATS readiness checks.
 *
 * Two parts:
 *   1. Format checks: rules that common ATS parsers (Workday, SuccessFactors,
 *      Taleo, JobStreet/SEEK, Hiredly) and Malaysian recruiters care about.
 *   2. Job-ad match: which keywords from a pasted job ad appear in the CV.
 *
 * No checker can promise a CV will be accepted; every employer configures its
 * ATS differently. These checks cover the failures that are common and fixable.
 */
window.CV = window.CV || {};

(function () {

var WEAK_PHRASES = ['responsible for', 'duties include', 'duties included', 'helped with', 'worked on', 'in charge of', 'tasked with', 'assisted in'];
var SENSITIVE = /\b(\d{6}-\d{2}-\d{4}|nric|ic no|i\/c|race|religion|marital status|bumiputera|date of birth|d\.o\.b)\b/i;
var STOPWORDS = (
  'a an and are as at be been being but by can could do does for from had has have he her his i if in into is it its ' +
  'may might more most must no not of on or our out over own same she should so some such than that the their them then ' +
  'there these they this those through to too under up very was we were what when where which while who will with would you your ' +
  'about above across after again all also any because before below between both during each few further here how just only other ' +
  'ability able candidate candidates company excellent good great strong job role position requirement requirements responsibilities ' +
  'responsibility responsible work working team teams year years experience experiences knowledge skill skills including include etc ' +
  'well related relevant minimum least plus preferred preferably required looking join us apply applicant applicants degree level ' +
  'within across ensure provide support new key successful opportunity environment based using use day days per per-day various ' +
  'hiring hire seeking we\'re apply now immediate dan yang untuk dengan di ke dalam atau adalah akan ini itu serta'
).split(/\s+/);

function words(text) {
  return String(text || '').toLowerCase().split(/\s+/).filter(Boolean);
}

function check(status, title, detail) {
  return { status: status, title: title, detail: detail || '' };
}

function allBullets(cv, key) {
  var out = [];
  cv[key].forEach(function (e) { out = out.concat(CV.splitLines(e.bullets)); });
  return out;
}

function monthIndex(value) {
  if (value === 'present') return 99999;
  var m = /^(\d{4})-(\d{2})$/.exec(value || '');
  return m ? parseInt(m[1], 10) * 12 + parseInt(m[2], 10) : null;
}

function rawText(cv) {
  var parts = [];
  (function walk(v) {
    if (typeof v === 'string') parts.push(v);
    else if (Array.isArray(v)) v.forEach(walk);
    else if (v && typeof v === 'object') Object.keys(v).forEach(function (k) {
      if (['tier', 'theme', 'order', 'hidden', 'version'].indexOf(k) === -1) walk(v[k]);
    });
  })(cv);
  return parts.join('\n');
}

CV.runChecks = function (cv, pageCount) {
  var tier = CV.TIERS[cv.tier];
  var p = cv.personal;
  var checks = [];

  checks.push(check('pass', 'ATS-safe layout', 'Single column, standard fonts, real text. No tables, columns, icons, photos or headers/footers.'));

  // Contact details
  var email = (p.email || '').trim();
  var phoneDigits = (p.phone || '').replace(/\D/g, '');
  if (!p.fullName.trim() || !email || !phoneDigits) {
    checks.push(check('fail', 'Contact details', 'Add your full name, email and phone number. Recruiters cannot reach you without them.'));
  } else if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    checks.push(check('fail', 'Contact details', 'The email address does not look valid.'));
  } else if (!/^(60|0)1\d{8,9}$|^(60|0)[3-9]\d{7,8}$/.test(phoneDigits)) {
    checks.push(check('warn', 'Contact details', 'Phone number is not in a Malaysian format. Use +60 12-345 6789.'));
  } else {
    checks.push(check('pass', 'Contact details', 'Name, email and a Malaysian phone number are present.'));
  }

  if (!(p.location || '').trim()) {
    checks.push(check('warn', 'Location', 'Add your city and state (e.g. Petaling Jaya, Selangor). Many ATS filter candidates by location.'));
  }
  if (!(p.linkedin || '').trim() && cv.tier !== 'student') {
    checks.push(check('warn', 'LinkedIn profile', 'Most Malaysian recruiters check LinkedIn. Add your profile URL.'));
  }

  // Sensitive personal data
  var raw = rawText(cv);
  if (SENSITIVE.test(raw)) {
    checks.push(check('warn', 'Personal data', 'Your CV mentions IC number, race, religion, date of birth or marital status. Leave these out; employers ask for them later.'));
  } else {
    checks.push(check('pass', 'Personal data', 'No IC number, race, religion or marital status. Good for privacy and fair screening.'));
  }

  // Characters that the PDF fonts cannot draw
  var dropped = raw.replace(/[\n -~ -ÿ–•‘’‚′“”„″—―… -​\t]/g, '');
  if (dropped.trim()) {
    checks.push(check('warn', 'Special characters', 'These characters are removed from the export: ' + Array.from(new Set(Array.from(dropped))).join(' ') + '. Avoid emoji and symbols.'));
  }

  // Summary
  var summaryWords = words(cv.summary).length;
  var range = tier.summaryWords;
  if (cv.hidden.summary || summaryWords === 0) {
    checks.push(check('warn', 'Summary', 'Add a short summary. It is the first thing recruiters and keyword searches read.'));
  } else if (summaryWords < range[0] || summaryWords > range[1]) {
    checks.push(check('warn', 'Summary', summaryWords + ' words. Aim for ' + range[0] + ' to ' + range[1] + ' words at this level.'));
  } else {
    checks.push(check('pass', 'Summary', summaryWords + ' words, a good length for this level.'));
  }

  // Core sections
  function visible(key) { return !cv.hidden[key] && cv.order.indexOf(key) !== -1; }
  var hasExp = visible('experience') && cv.experience.some(function (e) { return e.title.trim(); });
  var hasProjects = visible('projects') && cv.projects.some(function (e) { return e.name.trim(); });
  var hasEdu = visible('education') && cv.education.some(function (e) { return e.qualification.trim(); });
  var skillItems = visible('skills') ? cv.skills.reduce(function (n, s) { return n + s.items.split(',').filter(function (x) { return x.trim(); }).length; }, 0) : 0;
  var missing = [];
  if (!hasExp && !(cv.tier === 'student' && hasProjects)) missing.push('Work Experience');
  if (!hasEdu) missing.push('Education');
  if (!skillItems) missing.push('Skills');
  checks.push(missing.length
    ? check('fail', 'Core sections', 'Missing: ' + missing.join(', ') + '. ATS look for these headings to fill in your profile.')
    : check('pass', 'Core sections', 'Experience, Education and Skills are present with standard headings.'));

  if (skillItems && skillItems < 8) {
    checks.push(check('warn', 'Skills', 'Only ' + skillItems + ' skills listed. Add 8 to 20, using the job ad\'s wording.'));
  } else if (skillItems) {
    checks.push(check('pass', 'Skills', skillItems + ' skills listed.'));
  }

  // Dates
  var undated = cv.experience.filter(function (e) { return e.title.trim() && (!e.start || !e.end); }).length +
    cv.education.filter(function (e) { return e.qualification.trim() && !e.end; }).length;
  if (undated) {
    checks.push(check('fail', 'Dates', undated + ' experience or education ' + (undated === 1 ? 'entry is' : 'entries are') + ' missing dates. ATS use dates to calculate years of experience.'));
  } else {
    var starts = cv.experience.map(function (e) { return monthIndex(e.start); }).filter(function (v) { return v !== null; });
    var ordered = starts.every(function (v, i) { return i === 0 || v <= starts[i - 1]; });
    checks.push(ordered
      ? check('pass', 'Dates', 'All entries are dated, most recent first.')
      : check('warn', 'Dates', 'List work experience with the most recent role first.'));
  }

  // Student specifics
  if (cv.tier === 'student' && hasEdu && !cv.education.some(function (e) { return /cgpa|gpa|class|honours|distinction|merit/i.test(e.grade || ''); })) {
    checks.push(check('warn', 'Results', 'Graduate employers in Malaysia often screen by CGPA. Add it if it is 3.00 or higher.'));
  }

  // Bullet quality
  var bullets = allBullets(cv, 'experience').concat(allBullets(cv, 'projects'));
  if (bullets.length) {
    var target = { student: 0.3, mid: 0.5, senior: 0.6 }[cv.tier];
    var quantified = bullets.filter(function (b) { return /\d/.test(b); }).length;
    var ratio = quantified / bullets.length;
    checks.push(ratio >= target
      ? check('pass', 'Measurable results', quantified + ' of ' + bullets.length + ' bullets include a number.')
      : check('warn', 'Measurable results', 'Only ' + quantified + ' of ' + bullets.length + ' bullets include a number. Aim for ' + Math.round(target * 100) + '%: RM, %, time, volume or team size.'));

    var weak = bullets.filter(function (b) {
      var l = b.toLowerCase();
      return WEAK_PHRASES.some(function (w) { return l.indexOf(w) !== -1; }) || /^(i|my|we)\b/i.test(b);
    });
    var long = bullets.filter(function (b) { return words(b).length > 35; });
    if (weak.length || long.length) {
      var detail = [];
      if (weak.length) detail.push(weak.length + ' bullet' + (weak.length > 1 ? 's use' : ' uses') + ' passive wording ("responsible for", "I", "helped with"). Start with an action verb: Led, Built, Reduced.');
      if (long.length) detail.push(long.length + ' bullet' + (long.length > 1 ? 's are' : ' is') + ' over 35 words. Split or trim.');
      checks.push(check('warn', 'Bullet wording', detail.join(' ')));
    } else {
      checks.push(check('pass', 'Bullet wording', 'Bullets are concise and active.'));
    }
  }

  // Length
  if (pageCount) {
    var pages = tier.pages;
    if (pageCount > pages[1]) {
      checks.push(check('warn', 'Length', pageCount + ' pages. Aim for ' + (pages[0] === pages[1] ? pages[0] : pages[0] + ' to ' + pages[1]) + ' at this level. Try the Compact theme or trim older roles.'));
    } else {
      checks.push(check('pass', 'Length', pageCount + ' page' + (pageCount > 1 ? 's' : '') + ', right for this level.'));
    }
  }

  var weights = { pass: 1, warn: 0.5, fail: 0 };
  var score = Math.round(checks.reduce(function (s, c) { return s + weights[c.status]; }, 0) / checks.length * 100);
  return { score: score, checks: checks };
};

/* ---------- job ad keyword match ---------- */

function tokens(text) {
  return String(text || '').toLowerCase()
    .replace(/[^a-z0-9+#&./\- ]+/g, ' ')
    .split(/\s+/)
    .map(function (t) { return t.replace(/^[./-]+|[./-]+$/g, ''); })
    .filter(Boolean);
}

function isTerm(t) {
  return t.length > 1 && STOPWORDS.indexOf(t) === -1 && !/^\d+$/.test(t);
}

CV.extractKeywords = function (jobAd, limit) {
  var toks = tokens(jobAd);
  var counts = {};
  toks.forEach(function (t, i) {
    if (!isTerm(t)) return;
    counts[t] = (counts[t] || 0) + 1;
    var next = toks[i + 1];
    if (next && isTerm(next)) {
      var pair = t + ' ' + next;
      counts[pair] = (counts[pair] || 0) + 1.5;
    }
  });
  // Bigrams only count when repeated; single mentions of a pair are noise.
  var pairs = Object.keys(counts).filter(function (k) { return k.indexOf(' ') !== -1 && counts[k] >= 3; });
  // Drop single words that only ever appear inside a kept pair ("supply" in "supply chain").
  var singles = Object.keys(counts).filter(function (k) {
    return k.indexOf(' ') === -1 && !pairs.some(function (p) {
      return p.split(' ').indexOf(k) !== -1 && counts[k] <= counts[p] / 1.5;
    });
  });
  return pairs.concat(singles)
    .sort(function (a, b) { return counts[b] - counts[a] || a.localeCompare(b); })
    .slice(0, limit || 25);
};

CV.matchKeywords = function (cv, jobAd) {
  if (!String(jobAd || '').trim()) return null;
  var cvText = ' ' + tokens(CV.buildText(cv)).join(' ') + ' ';
  var keywords = CV.extractKeywords(jobAd, 25);
  var matched = [];
  var missing = [];
  keywords.forEach(function (k) {
    (cvText.indexOf(' ' + k + ' ') !== -1 ? matched : missing).push(k);
  });
  var pct = keywords.length ? Math.round(matched.length / keywords.length * 100) : 0;
  return { matched: matched, missing: missing, pct: pct };
};

})();
