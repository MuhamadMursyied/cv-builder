/*
 * CV themes.
 *
 * Every theme is ATS-safe by construction: one column, real text, standard
 * fonts (Helvetica/Arial or Times), no images, icons, tables or text boxes.
 * Themes only change typography, accent colour and heading treatment, so the
 * same few parameters drive the preview, the PDF and the DOCX export.
 *
 *   font     'sans'  -> Helvetica (PDF) / Arial (DOCX)
 *            'serif' -> Times (PDF) / Times New Roman (DOCX)
 *   heading  'rule'      bold heading with a line underneath
 *            'caps'      UPPERCASE bold heading, no line
 *            'capsrule'  UPPERCASE bold heading with a line underneath
 *            'overline'  line above, bold heading below
 *            'plain'     bold heading only
 *   align    'left' | 'center'  (name, headline and contact line)
 *   nameCase 'normal' | 'upper'
 *   dates    'right'  dates right-aligned on the job title line
 *            'inline' dates follow the organisation on the second line
 *   density  'normal' | 'compact'
 *   tiers    which tiers the theme is recommended for
 */
window.CV = window.CV || {};

CV.THEMES = [
  { id: 'modern',     name: 'Modern',     font: 'sans',  accent: '#1d5c72', heading: 'rule',     align: 'left',   nameCase: 'normal', dates: 'right',  density: 'normal',  tiers: ['mid'] },
  { id: 'classic',    name: 'Classic',    font: 'serif', accent: '#1f3a5f', heading: 'rule',     align: 'center', nameCase: 'normal', dates: 'right',  density: 'normal',  tiers: ['mid', 'senior'] },
  { id: 'executive',  name: 'Executive',  font: 'serif', accent: '#2b2b2b', heading: 'capsrule', align: 'center', nameCase: 'upper',  dates: 'right',  density: 'normal',  tiers: ['senior'] },
  { id: 'minimal',    name: 'Minimal',    font: 'sans',  accent: '#111111', heading: 'caps',     align: 'left',   nameCase: 'normal', dates: 'inline', density: 'normal',  tiers: ['mid'] },
  { id: 'compact',    name: 'Compact',    font: 'sans',  accent: '#33507a', heading: 'rule',     align: 'left',   nameCase: 'normal', dates: 'right',  density: 'compact', tiers: ['student'] },
  { id: 'corporate',  name: 'Corporate',  font: 'sans',  accent: '#0b3d91', heading: 'overline', align: 'left',   nameCase: 'upper',  dates: 'right',  density: 'normal',  tiers: ['mid', 'senior'] },
  { id: 'scholar',    name: 'Scholar',    font: 'serif', accent: '#2f5233', heading: 'plain',    align: 'left',   nameCase: 'normal', dates: 'inline', density: 'compact', tiers: ['student'] },
  { id: 'engineer',   name: 'Engineer',   font: 'sans',  accent: '#3a4f63', heading: 'capsrule', align: 'left',   nameCase: 'normal', dates: 'right',  density: 'compact', tiers: ['student', 'mid'] },
  { id: 'heritage',   name: 'Heritage',   font: 'serif', accent: '#6e1f2a', heading: 'caps',     align: 'center', nameCase: 'upper',  dates: 'right',  density: 'normal',  tiers: ['senior'] },
  { id: 'monochrome', name: 'Monochrome', font: 'serif', accent: '#000000', heading: 'rule',     align: 'left',   nameCase: 'normal', dates: 'right',  density: 'compact', tiers: ['mid', 'senior'] }
];

CV.getTheme = function (id) {
  return CV.THEMES.find(function (t) { return t.id === id; }) || CV.THEMES[0];
};
