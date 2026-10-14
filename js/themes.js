/*
 * CV themes.
 *
 * Every theme is ATS-safe by construction: one column, real text, standard
 * fonts (Helvetica/Arial or Times), no images, icons, tables or text boxes.
 * Colour fills (banner, band, solid) sit behind real text, so parsers still
 * read every word in order. Themes only change typography, colour and
 * heading/header treatment, so the same few parameters drive the preview,
 * the PDF and the DOCX export.
 *
 *   font     'sans'  -> Helvetica (PDF) / Arial (DOCX)
 *            'serif' -> Times (PDF) / Times New Roman (DOCX)
 *   heading  'rule'      bold heading with a line underneath
 *            'caps'      UPPERCASE bold heading, no line
 *            'capsrule'  UPPERCASE bold heading with a line underneath
 *            'overline'  line above, bold heading below
 *            'plain'     bold heading only
 *            'underline' bold heading with a short thick accent line
 *            'bar'       accent bar to the left of the heading
 *            'band'      heading on a light tinted strip
 *            'solid'     UPPERCASE white heading on an accent strip
 *   header   'plain' (default) | 'rule' thick line under the contact line
 *            | 'banner' name and contact in white on an accent block
 *   bullet   'dot' (default) | 'dash'
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
  { id: 'monochrome', name: 'Monochrome', font: 'serif', accent: '#000000', heading: 'rule',     align: 'left',   nameCase: 'normal', dates: 'right',  density: 'compact', tiers: ['mid', 'senior'] },
  { id: 'ocean',      name: 'Ocean',      font: 'sans',  accent: '#0f5e7a', heading: 'band',     align: 'left',   nameCase: 'normal', dates: 'right',  density: 'normal',  tiers: ['mid'] },
  { id: 'emerald',    name: 'Emerald',    font: 'sans',  accent: '#1e6b4f', heading: 'bar',      align: 'left',   nameCase: 'normal', dates: 'right',  density: 'compact', tiers: ['student', 'mid'] },
  { id: 'navy',       name: 'Banner',     font: 'sans',  accent: '#1d3b6e', heading: 'rule',     align: 'left',   nameCase: 'normal', dates: 'right',  density: 'normal',  header: 'banner', tiers: ['mid', 'senior'] },
  { id: 'crimson',    name: 'Crimson',    font: 'serif', accent: '#8a1c2b', heading: 'underline', align: 'center', nameCase: 'normal', dates: 'right', density: 'normal',  header: 'rule', tiers: ['senior'] },
  { id: 'slate',      name: 'Slate',      font: 'sans',  accent: '#3d4b59', heading: 'solid',    align: 'left',   nameCase: 'normal', dates: 'right',  density: 'compact', tiers: ['student'] },
  { id: 'royal',      name: 'Royal',      font: 'serif', accent: '#3b2a6b', heading: 'band',     align: 'center', nameCase: 'upper',  dates: 'right',  density: 'normal',  header: 'rule', tiers: ['senior'] },
  { id: 'lagoon',     name: 'Lagoon',     font: 'sans',  accent: '#00695c', heading: 'underline', align: 'left',  nameCase: 'normal', dates: 'right',  density: 'compact', bullet: 'dash', tiers: ['student', 'mid'] },
  { id: 'graphite',   name: 'Graphite',   font: 'sans',  accent: '#2d3436', heading: 'caps',     align: 'center', nameCase: 'upper',  dates: 'right',  density: 'normal',  header: 'banner', tiers: ['senior'] },
  { id: 'sunrise',    name: 'Sunrise',    font: 'sans',  accent: '#a84a0c', heading: 'bar',      align: 'left',   nameCase: 'normal', dates: 'right',  density: 'compact', tiers: ['student'] },
  { id: 'nordic',     name: 'Nordic',     font: 'sans',  accent: '#4a6274', heading: 'underline', align: 'left',  nameCase: 'upper',  dates: 'inline', density: 'normal', bullet: 'dash', tiers: ['mid'] }
];

CV.getTheme = function (id) {
  return CV.THEMES.find(function (t) { return t.id === id; }) || CV.THEMES[0];
};
