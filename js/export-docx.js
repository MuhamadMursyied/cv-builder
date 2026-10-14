/*
 * DOCX export with no dependencies.
 *
 * A .docx file is a ZIP of a few XML files. We write the minimum Word needs
 * (content types, relationships, styles, the document and its properties)
 * and pack them with a tiny uncompressed ZIP writer.
 *
 * The document is a plain single-column flow: paragraphs and text runs only,
 * dates on a right tab stop, headings with a paragraph border. No tables,
 * text boxes, headers/footers or images, which ATS parsers often skip.
 */
window.CV = window.CV || {};

(function () {

/* ---------- minimal ZIP (store, no compression) ---------- */

var CRC_TABLE = (function () {
  var table = new Uint32Array(256);
  for (var n = 0; n < 256; n++) {
    var c = n;
    for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes) {
  var crc = 0xFFFFFFFF;
  for (var i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function zip(files) {
  var encoder = new TextEncoder();
  var chunks = [];
  var central = [];
  var offset = 0;

  files.forEach(function (f) {
    var name = encoder.encode(f.name);
    var data = encoder.encode(f.content);
    var crc = crc32(data);

    var local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);          // version needed
    local.setUint16(6, 0x0800, true);      // UTF-8 names
    local.setUint16(8, 0, true);           // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    var dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);

    offset += 30 + name.length + data.length;
  });

  var centralSize = central.reduce(function (sum, c) { return sum + c.length; }, 0);
  var end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  return new Blob(chunks.concat(central, [new Uint8Array(end.buffer)]), {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  });
}

/* ---------- WordprocessingML helpers ---------- */

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function hex(color) { return color.replace('#', '').toUpperCase(); }

// size is in points; Word uses half-points.
function run(text, o) {
  o = o || {};
  var props = '';
  if (o.bold) props += '<w:b/>';
  if (o.italic) props += '<w:i/>';
  if (o.color) props += '<w:color w:val="' + hex(o.color) + '"/>';
  if (o.size) props += '<w:sz w:val="' + Math.round(o.size * 2) + '"/><w:szCs w:val="' + Math.round(o.size * 2) + '"/>';
  var body = o.tab ? '<w:tab/>' : '<w:t xml:space="preserve">' + esc(text) + '</w:t>';
  return '<w:r>' + (props ? '<w:rPr>' + props + '</w:rPr>' : '') + body + '</w:r>';
}

// spacing values are in points; Word uses twentieths of a point (twips).
function para(runs, o) {
  o = o || {};
  var props = '';
  if (o.keepNext) props += '<w:keepNext/>';
  if (o.border) {
    props += '<w:pBdr><w:' + o.border + ' w:val="single" w:sz="' + (o.borderSize || 6) + '" w:space="' + (o.borderSpace || 1) + '" w:color="' + hex(o.borderColor) + '"/></w:pBdr>';
  }
  if (o.box) {
    // Same border on every side in the fill colour: Word merges neighbouring
    // paragraphs with identical borders into one padded block.
    props += '<w:pBdr>' + ['top', 'left', 'bottom', 'right'].map(function (side) {
      return '<w:' + side + ' w:val="single" w:sz="4" w:space="6" w:color="' + hex(o.box) + '"/>';
    }).join('') + '</w:pBdr>';
  }
  if (o.fill) props += '<w:shd w:val="clear" w:color="auto" w:fill="' + hex(o.fill) + '"/>';
  if (o.tabRight) props += '<w:tabs><w:tab w:val="right" w:pos="' + Math.round(o.tabRight) + '"/></w:tabs>';
  props += '<w:spacing w:before="' + Math.round((o.before || 0) * 20) + '" w:after="' + Math.round((o.after || 0) * 20) + '"/>';
  if (o.indent) props += '<w:ind w:left="' + o.indent + '" w:hanging="' + o.hanging + '"/>';
  if (o.align) props += '<w:jc w:val="' + o.align + '"/>';
  return '<w:p><w:pPr>' + props + '</w:pPr>' + runs.join('') + '</w:p>';
}

function segRuns(segs, size, color) {
  return segs.map(function (s) {
    return run(s.text, { bold: s.style === 'bold', italic: s.style === 'italic', size: size, color: color });
  });
}

/* ---------- document ---------- */

CV.buildDocx = function (cv) {
  var theme = CV.getTheme(cv.theme);
  var compact = theme.density === 'compact';
  var marginPt = compact ? 40 : 48;
  var bodySize = compact ? 9.5 : 10;
  var font = theme.font === 'serif' ? 'Times New Roman' : 'Arial';
  var body = '#1F2328';
  var muted = '#4A4F57';
  var align = theme.align === 'center' ? 'center' : 'left';
  var tabPos = (595.28 - marginPt * 2) * 20;
  var hs = theme.heading;
  var headingOpts = { before: compact ? 9 : 12, after: compact ? 4 : 6, keepNext: true, borderColor: theme.accent };
  if (hs === 'overline') headingOpts.border = 'top';
  if (/rule/.test(hs)) headingOpts.border = 'bottom';
  if (hs === 'underline') { headingOpts.border = 'bottom'; headingOpts.borderSize = 12; }
  if (hs === 'bar') { headingOpts.border = 'left'; headingOpts.borderSize = 24; headingOpts.borderSpace = 6; }
  if (hs === 'band') headingOpts.fill = CV.tint(theme.accent, 0.86);
  if (hs === 'solid') headingOpts.fill = theme.accent;
  var headingColor = hs === 'solid' ? '#FFFFFF' : theme.accent;

  var banner = theme.header === 'banner';
  var header = [];   // name/headline/contact paragraphs, styled once complete
  function headerPara(runs) {
    header.push({ runs: runs, opts: { align: align, after: 2 } });
  }
  function closeHeader() {
    if (!header.length) return;
    header.forEach(function (h) {
      if (banner) { h.opts.fill = theme.accent; h.opts.box = theme.accent; h.opts.after = 0; }
    });
    var last = header[header.length - 1].opts;
    if (theme.header === 'rule') { last.border = 'bottom'; last.borderSize = 16; last.borderSpace = 4; last.borderColor = theme.accent; }
    if (banner) last.after = 6;
    header.forEach(function (h) { xml.push(para(h.runs, h.opts)); });
    header = [];
  }

  var xml = [];
  var afterHeading = false;
  var bulletChar = theme.bullet === 'dash' ? '–' : '•';

  CV.buildBlocks(cv).forEach(function (b) {
    if (['name', 'headline', 'contact'].indexOf(b.type) === -1) closeHeader();
    switch (b.type) {
      case 'name':
        headerPara([run(theme.nameCase === 'upper' ? b.text.toUpperCase() : b.text, { bold: true, size: compact ? 20 : 22, color: banner ? '#FFFFFF' : theme.accent })]);
        break;
      case 'headline':
        headerPara([run(b.text, { size: compact ? 11 : 11.5, color: banner ? '#FFFFFF' : body })]);
        break;
      case 'contact':
        headerPara([run(b.items.join('  |  '), { size: compact ? 9 : 9.5, color: banner ? CV.tint(theme.accent, 0.82) : muted })]);
        break;
      case 'heading':
        xml.push(para([run(/caps|solid/.test(hs) ? b.text.toUpperCase() : b.text, { bold: true, size: compact ? 11 : 11.5, color: headingColor })], headingOpts));
        afterHeading = true;
        return;
      case 'entry': {
        var before = afterHeading ? 0 : (compact ? 5 : 7);
        if (theme.dates === 'inline') {
          xml.push(para([run(b.title, { bold: true, size: bodySize + 0.5, color: body })], { before: before, keepNext: true }));
          var sub = [b.sub, b.date].filter(Boolean).join('  |  ');
          if (sub) xml.push(para([run(sub, { italic: true, size: bodySize, color: muted })], { after: 1.5, keepNext: true }));
        } else {
          var runs = [run(b.title, { bold: true, size: bodySize + 0.5, color: body })];
          if (b.date) runs.push(run('', { tab: true }), run(b.date, { size: bodySize, color: body }));
          xml.push(para(runs, { before: before, tabRight: tabPos, keepNext: true }));
          if (b.sub) xml.push(para([run(b.sub, { italic: true, size: bodySize, color: muted })], { after: 1.5, keepNext: true }));
        }
        break;
      }
      case 'item': {
        var itemRuns = segRuns(b.segs, bodySize, body);
        if (b.date) itemRuns.push(run('', { tab: true }), run(b.date, { size: bodySize, color: body }));
        xml.push(para(itemRuns, { tabRight: tabPos, after: 1.5 }));
        break;
      }
      case 'para':
        xml.push(para(segRuns(b.segs, bodySize, body), { after: 1.5 }));
        break;
      case 'bullets':
        b.items.forEach(function (item) {
          xml.push(para([run(bulletChar, { size: bodySize, color: body }), run('', { tab: true }), run(item, { size: bodySize, color: body })], { indent: 240, hanging: 240, after: 1.5 }));
        });
        break;
    }
    afterHeading = false;
  });

  closeHeader();
  var margin = Math.round(marginPt * 20);
  var document = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' +
    xml.join('') +
    '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
    '<w:pgMar w:top="' + margin + '" w:right="' + margin + '" w:bottom="' + margin + '" w:left="' + margin + '" w:header="0" w:footer="0" w:gutter="0"/>' +
    '</w:sectPr></w:body></w:document>';

  var styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults>' +
    '<w:rPrDefault><w:rPr><w:rFonts w:ascii="' + font + '" w:hAnsi="' + font + '" w:cs="' + font + '" w:eastAsia="' + font + '"/>' +
    '<w:sz w:val="' + bodySize * 2 + '"/><w:szCs w:val="' + bodySize * 2 + '"/><w:lang w:val="en-MY"/></w:rPr></w:rPrDefault>' +
    '<w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="' + (compact ? 248 : 256) + '" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
    '</w:docDefaults></w:styles>';

  var name = CV.cleanText(cv.personal.fullName) || 'CV';
  var core = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">' +
    '<dc:title>' + esc(name + ' - CV') + '</dc:title><dc:creator>' + esc(name) + '</dc:creator></cp:coreProperties>';

  return zip([
    { name: '[Content_Types].xml', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
      '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
      '<Default Extension="xml" ContentType="application/xml"/>' +
      '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
      '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
      '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
      '</Types>' },
    { name: '_rels/.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
      '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>' +
      '</Relationships>' },
    { name: 'word/_rels/document.xml.rels', content: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
      '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
      '</Relationships>' },
    { name: 'word/document.xml', content: document },
    { name: 'word/styles.xml', content: styles },
    { name: 'docProps/core.xml', content: core }
  ]);
};

})();
