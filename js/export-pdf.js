/*
 * PDF export.
 *
 * Draws the layout with jsPDF's built-in Helvetica/Times fonts. Every word is
 * real, selectable text in reading order, which is what ATS parsers need.
 * No images, no canvas snapshots (html2canvas-style PDFs are unreadable to ATS).
 */
window.CV = window.CV || {};

CV.buildPdf = function (cv) {
  var theme = CV.getTheme(cv.theme);
  var layout = CV.layout(CV.buildBlocks(cv), theme);
  var doc = new window.jspdf.jsPDF({ unit: 'pt', format: 'a4', compress: true });

  var name = CV.cleanText(cv.personal.fullName) || 'CV';
  var skills = cv.skills.map(function (s) { return CV.cleanText(s.items); }).filter(Boolean).join(', ');
  doc.setProperties({
    title: name + ' - CV',
    author: name,
    subject: CV.cleanText(cv.personal.headline),
    keywords: skills,
    creator: 'CV Builder'
  });
  doc.setLanguage('en-MY');

  layout.pages.forEach(function (ops, pageIndex) {
    if (pageIndex > 0) doc.addPage('a4');
    ops.forEach(function (op) {
      if (op.t === 'text') {
        doc.setFont(op.family, op.style);
        doc.setFontSize(op.size);
        doc.setTextColor(op.color);
        doc.text(op.text, op.x, op.y, { align: op.align, baseline: 'alphabetic' });
      } else if (op.t === 'line') {
        doc.setDrawColor(op.color);
        doc.setLineWidth(op.width);
        doc.line(op.x1, op.y1, op.x2, op.y2);
      }
    });
  });

  return { doc: doc, pageCount: layout.pages.length };
};
