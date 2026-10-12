/*
 * Plain-text export, for pasting into job portals (JobStreet, Hiredly,
 * MYFutureJobs, LinkedIn Easy Apply) and for checking what an ATS "sees".
 */
window.CV = window.CV || {};

CV.buildText = function (cv) {
  var out = [];
  CV.buildBlocks(cv).forEach(function (b) {
    switch (b.type) {
      case 'name': out.push(b.text.toUpperCase()); break;
      case 'headline': out.push(b.text); break;
      case 'contact': out.push(b.items.join(' | ')); break;
      case 'heading': out.push('', b.text.toUpperCase()); break;
      case 'entry':
        out.push([b.title, b.date].filter(Boolean).join(' | '));
        if (b.sub) out.push(b.sub);
        break;
      case 'item':
        out.push(b.segs.map(function (s) { return s.text; }).join('') + (b.date ? ' | ' + b.date : ''));
        break;
      case 'para': out.push(b.segs.map(function (s) { return s.text; }).join('')); break;
      case 'bullets': b.items.forEach(function (i) { out.push('- ' + i); }); break;
    }
  });
  return out.join('\n') + '\n';
};
