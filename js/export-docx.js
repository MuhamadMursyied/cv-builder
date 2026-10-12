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
    props += '<w:pBdr><w:' + o.border + ' w:val="single" w:sz="6" w:space="1" w:color="' + hex(o.borderColor) + '"/></w:pBdr>';
  }
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
  var headingBorder = theme.heading === 'overline' ? 'top' : (/rule/.test(theme.heading) ? 'bottom' : null);

  var xml = [];
  var afterHeading = false;

  CV.buildBlocks(cv).forEach(function (b) {
    switch (b.type) {
      case 'name':
        xml.push(para([run(theme.nameCase === 'upper' ? b.text.toUpperCase() : b.text, { bold: true, size: compact ? 20 : 22, color: theme.accent })], { align: align, after: 2 }));
        break;
      case 'headline':
        xml.push(para([run(b.text, { size: compact ? 11 : 11.5, color: body })], { align: align, after: 2 }));
        break;
      case 'contact':
        xml.push(para([run(b.items.join('  |  '), { size: compact ? 9 : 9.5, color: muted })], { align: align, after: 2 }));
        break;
      case 'heading':
        xml.push(para([run(/caps/.test(theme.heading) ? b.text.toUpperCase() : b.text, { bold: true, size: compact ? 11 : 11.5, color: theme.accent })], {
          before: compact ? 9 : 12, after: compact ? 4 : 6, keepNext: true, border: headingBorder, borderColor: theme.accent
        }));
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
          xml.push(para([run('•', { size: bodySize, color: body }), run('', { tab: true }), run(item, { size: bodySize, color: body })], { indent: 240, hanging: 240, after: 1.5 }));
        });
        break;
    }
    afterHeading = false;
  });

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
