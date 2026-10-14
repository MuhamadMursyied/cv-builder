/*
 * Draws the layout as SVG pages. The SVG uses Arial / Times New Roman, which
 * share metrics with the PDF's Helvetica / Times, so line breaks and page
 * breaks on screen match the exported PDF.
 */
window.CV = window.CV || {};

(function () {

var FONTS = {
  helvetica: 'Arial, "Liberation Sans", Helvetica, sans-serif',
  times: '"Times New Roman", "Liberation Serif", Times, serif'
};
var ANCHOR = { left: 'start', right: 'end', center: 'middle' };

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function r(n) { return Math.round(n * 100) / 100; }

CV.renderPreview = function (container, layout) {
  var html = layout.pages.map(function (ops, i) {
    var body = ops.map(function (op) {
      if (op.t === 'rect') {
        return '<rect x="' + r(op.x) + '" y="' + r(op.y) + '" width="' + r(op.w) + '" height="' + r(op.h) + '" fill="' + op.color + '"/>';
      }
      if (op.t === 'line') {
        return '<line x1="' + r(op.x1) + '" y1="' + r(op.y1) + '" x2="' + r(op.x2) + '" y2="' + r(op.y2) + '" stroke="' + op.color + '" stroke-width="' + op.width + '"/>';
      }
      var weight = /bold/.test(op.style) ? ' font-weight="700"' : '';
      var italic = /italic/.test(op.style) ? ' font-style="italic"' : '';
      return '<text xml:space="preserve" x="' + r(op.x) + '" y="' + r(op.y) + '" font-size="' + op.size + '"' + weight + italic +
        ' fill="' + op.color + '" text-anchor="' + ANCHOR[op.align] + '">' + esc(op.text) + '</text>';
    }).join('');
    return '<figure class="page" aria-label="Page ' + (i + 1) + ' of ' + layout.pages.length + '">' +
      '<svg viewBox="0 0 ' + layout.width + ' ' + layout.height + '" font-family=\'' + FONTS[layout.family] + '\' style="white-space:pre">' +
      '<rect width="100%" height="100%" fill="#ffffff"/>' + body + '</svg>' +
      '<figcaption>Page ' + (i + 1) + ' of ' + layout.pages.length + '</figcaption></figure>';
  }).join('');
  container.innerHTML = html;
};

})();
