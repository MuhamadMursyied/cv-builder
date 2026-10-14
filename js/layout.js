/*
 * Page layout engine.
 *
 * Positions every line of the CV on A4 pages using the real PDF font metrics
 * (from jsPDF's built-in Helvetica and Times). The result is a list of simple
 * drawing operations that two painters consume:
 *   - preview.js draws them as SVG, so the on-screen preview paginates exactly
 *   - export-pdf.js draws them with jsPDF, producing a text-based PDF
 *
 * Units are PDF points (1 pt = 1/72 inch). y grows downwards from the top.
 */
window.CV = window.CV || {};

(function () {

var PAGE_W = 595.28;   // A4
var PAGE_H = 841.89;
var BODY_COLOR = '#1f2328';
var MUTED_COLOR = '#4a4f57';

var measurer = null;
function getMeasurer() {
  if (!measurer) measurer = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4' });
  return measurer;
}

// Mixes a colour with white; amount 0 = colour, 1 = white.
CV.tint = function (hex, amount) {
  var n = parseInt(hex.slice(1), 16);
  var mix = function (c) { return Math.round(c + (255 - c) * amount); };
  var out = [mix(n >> 16), mix((n >> 8) & 255), mix(n & 255)];
  return '#' + out.map(function (c) { return ('0' + c.toString(16)).slice(-2); }).join('');
};

function pdfFamily(theme) { return theme.font === 'serif' ? 'times' : 'helvetica'; }

function textWidth(text, family, style, size) {
  var m = getMeasurer();
  m.setFont(family, style);
  m.setFontSize(size);
  return m.getTextWidth(text);
}

function metricsFor(theme) {
  var compact = theme.density === 'compact';
  return {
    margin: compact ? 40 : 48,
    body: compact ? 9.5 : 10,
    lineHeight: compact ? 1.24 : 1.28,
    name: compact ? 20 : 22,
    headline: compact ? 11 : 11.5,
    contact: compact ? 9 : 9.5,
    heading: compact ? 11 : 11.5,
    gapBeforeHeading: compact ? 9 : 12,
    gapAfterHeading: compact ? 4 : 6,
    gapBetweenEntries: compact ? 5 : 7,
    bulletIndent: 12
  };
}

/*
 * Word-wraps styled runs into lines no wider than maxWidth.
 * Returns [{ runs: [{ text, style, x }], width }], x relative to line start.
 */
function wrapSegs(segs, family, size, maxWidth) {
  var lines = [];
  var line = { runs: [], width: 0 };
  var pendingSpace = false;

  function addWord(word, style) {
    var w = textWidth(word, family, style, size);
    var spaceW = pendingSpace && line.runs.length ? textWidth(' ', family, style, size) : 0;
    if (line.runs.length && line.width + spaceW + w > maxWidth) {
      lines.push(line);
      line = { runs: [], width: 0 };
      spaceW = 0;
    }
    var last = line.runs[line.runs.length - 1];
    if (last && last.style === style) {
      last.text += (spaceW ? ' ' : '') + word;
    } else {
      line.runs.push({ text: (spaceW ? ' ' : '') + word, style: style, x: line.width });
    }
    line.width += spaceW + w;
    pendingSpace = false;
  }

  segs.forEach(function (seg) {
    String(seg.text).split(/(\s+)/).forEach(function (token) {
      if (!token) return;
      if (/^\s+$/.test(token)) { pendingSpace = true; return; }
      // Break words that are wider than the line (long URLs) by characters.
      while (textWidth(token, family, seg.style, size) > maxWidth && token.length > 1) {
        var cut = token.length - 1;
        while (cut > 1 && textWidth(token.slice(0, cut), family, seg.style, size) > maxWidth) cut--;
        addWord(token.slice(0, cut), seg.style);
        token = token.slice(cut);
        pendingSpace = false;
        lines.push(line);
        line = { runs: [], width: 0 };
      }
      addWord(token, seg.style);
    });
    // A trailing space inside a run ("Skills: ") separates it from the next run.
    if (/\s$/.test(seg.text)) pendingSpace = true;
  });
  if (line.runs.length) lines.push(line);
  return lines;
}

CV.layout = function (blocks, theme) {
  var M = metricsFor(theme);
  var family = pdfFamily(theme);
  var left = M.margin;
  var right = PAGE_W - M.margin;
  var contentW = right - left;
  var pages = [[]];
  var y = M.margin;
  var afterHeading = false;

  function ops() { return pages[pages.length - 1]; }
  function lineH(size) { return size * M.lineHeight; }
  function newPage() { pages.push([]); y = M.margin; }
  function ensure(height) { if (y + height > PAGE_H - M.margin) newPage(); }
  function baseline(size) { return y + size * 0.8 + (lineH(size) - size) / 2; }

  function text(str, x, size, style, color, align) {
    ops().push({ t: 'text', text: str, x: x, y: baseline(size), size: size, family: family, style: style, color: color, align: align || 'left' });
  }
  function rule(atY, color, width, x2) {
    ops().push({ t: 'line', x1: left, y1: atY, x2: x2 || right, y2: atY, color: color, width: width });
  }
  function box(x, top, w, h, color) {
    ops().push({ t: 'rect', x: x, y: top, w: w, h: h, color: color });
  }
  function drawRuns(runs, x0, size, color) {
    runs.forEach(function (r) { text(r.text, x0 + r.x, size, r.style, color); });
  }
  function drawWrapped(segs, x0, width, size, color) {
    wrapSegs(segs, family, size, width).forEach(function (l) {
      ensure(lineH(size));
      drawRuns(l.runs, x0, size, color);
      y += lineH(size);
    });
  }

  var align = theme.align === 'center' ? 'center' : 'left';
  var alignX = align === 'center' ? PAGE_W / 2 : left;
  var banner = theme.header === 'banner';
  var nameColor = banner ? '#ffffff' : theme.accent;
  var headlineColor = banner ? '#ffffff' : BODY_COLOR;
  var contactColor = banner ? CV.tint(theme.accent, 0.82) : MUTED_COLOR;
  var bulletChar = theme.bullet === 'dash' ? '–' : '•';
  var headerOpen = true;

  // Called once the name, headline and contact lines are placed.
  function closeHeader() {
    if (!headerOpen) return;
    headerOpen = false;
    if (banner) {
      y += 10;
      // Drawn first so the white header text sits on top of it.
      ops().unshift({ t: 'rect', x: 0, y: 0, w: PAGE_W, h: y, color: theme.accent });
      y += 4;
    } else if (theme.header === 'rule') {
      y += 3;
      rule(y, theme.accent, 2);
      y += 5;
    }
  }

  blocks.forEach(function (b, i) {
    var next = blocks[i + 1];
    if (['name', 'headline', 'contact'].indexOf(b.type) === -1) closeHeader();
    switch (b.type) {
      case 'name': {
        var name = theme.nameCase === 'upper' ? b.text.toUpperCase() : b.text;
        text(name, alignX, M.name, 'bold', nameColor, align);
        y += lineH(M.name);
        break;
      }
      case 'headline':
        text(b.text, alignX, M.headline, 'normal', headlineColor, align);
        y += lineH(M.headline) + 1;
        break;
      case 'contact': {
        // Wrap whole items so a phone number or email is never split.
        var sep = '  |  ';
        var lines = [];
        var current = '';
        b.items.forEach(function (item) {
          var trial = current ? current + sep + item : item;
          if (current && textWidth(trial, family, 'normal', M.contact) > contentW) {
            lines.push(current);
            current = item;
          } else {
            current = trial;
          }
        });
        if (current) lines.push(current);
        lines.forEach(function (l) {
          text(l, alignX, M.contact, 'normal', contactColor, align);
          y += lineH(M.contact);
        });
        break;
      }
      case 'heading': {
        var style = theme.heading;
        var label = /caps|solid/.test(style) ? b.text.toUpperCase() : b.text;
        var h = lineH(M.heading);
        y += M.gapBeforeHeading;
        // Keep the heading with at least the first few lines of its section.
        ensure(h + 8 + lineH(M.body) * 2);
        if (style === 'overline') {
          rule(y, theme.accent, 0.8);
          y += 4;
        }
        if (style === 'band' || style === 'solid') {
          // A filled strip behind the heading; the heading itself stays real text.
          box(left, y, contentW, h + 3, style === 'solid' ? theme.accent : CV.tint(theme.accent, 0.86));
          y += 1.5;
          text(label, left + 6, M.heading, 'bold', style === 'solid' ? '#ffffff' : theme.accent);
          y += h + 1.5;
        } else if (style === 'bar') {
          box(left, y + 1, 3.5, h - 2, theme.accent);
          text(label, left + 10, M.heading, 'bold', theme.accent);
          y += h;
        } else {
          text(label, left, M.heading, 'bold', theme.accent);
          y += h;
        }
        if (style === 'rule' || style === 'capsrule') {
          rule(y - 1, theme.accent, 0.8);
          y += 2;
        } else if (style === 'underline') {
          rule(y, theme.accent, 2, left + 36);
          y += 3;
        }
        y += M.gapAfterHeading;
        afterHeading = true;
        return;
      }
      case 'entry': {
        if (!afterHeading) y += M.gapBetweenEntries;
        var titleSize = M.body + 0.5;
        var inline = theme.dates === 'inline';
        var dateW = !inline && b.date ? textWidth(b.date, family, 'normal', M.body) + 12 : 0;
        var titleLines = wrapSegs([{ text: b.title, style: 'bold' }], family, titleSize, contentW - dateW);
        var subText = inline ? [b.sub, b.date].filter(Boolean).join('  |  ') : b.sub;
        ensure(lineH(titleSize) * titleLines.length + (subText ? lineH(M.body) : 0) + lineH(M.body));
        titleLines.forEach(function (l, li) {
          drawRuns(l.runs, left, titleSize, BODY_COLOR);
          if (li === 0 && dateW) text(b.date, right, M.body, 'normal', BODY_COLOR, 'right');
          y += lineH(titleSize);
        });
        if (subText) drawWrapped([{ text: subText, style: 'italic' }], left, contentW, M.body, MUTED_COLOR);
        y += 1.5;
        break;
      }
      case 'item': {
        var itemDateW = b.date ? textWidth(b.date, family, 'normal', M.body) + 12 : 0;
        wrapSegs(b.segs, family, M.body, contentW - itemDateW).forEach(function (l, li) {
          ensure(lineH(M.body));
          drawRuns(l.runs, left, M.body, BODY_COLOR);
          if (li === 0 && itemDateW) text(b.date, right, M.body, 'normal', BODY_COLOR, 'right');
          y += lineH(M.body);
        });
        if (next && next.type === 'item') y += 1.5;
        break;
      }
      case 'para':
        drawWrapped(b.segs, left, contentW, M.body, BODY_COLOR);
        y += 1.5;
        break;
      case 'bullets':
        b.items.forEach(function (item) {
          var lines = wrapSegs([{ text: item, style: 'normal' }], family, M.body, contentW - M.bulletIndent);
          lines.forEach(function (l, li) {
            ensure(lineH(M.body));
            if (li === 0) text(bulletChar, left + 3, M.body, 'normal', BODY_COLOR);
            drawRuns(l.runs, left + M.bulletIndent, M.body, BODY_COLOR);
            y += lineH(M.body);
          });
          y += 1.5;
        });
        break;
    }
    afterHeading = false;
  });

  closeHeader();
  return { width: PAGE_W, height: PAGE_H, pages: pages, family: family };
};

})();
