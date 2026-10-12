/*
 * Career tiers and CV sections.
 *
 * A tier decides which sections are shown, their order, their headings and
 * the guidance text in the editor. Headings stay close to the standard names
 * ATS parsers look for ("Work Experience", "Education", "Skills").
 */
window.CV = window.CV || {};

CV.TIERS = {
  student: {
    name: 'Student / Fresh graduate',
    short: 'Student',
    blurb: 'Education first. Show CGPA, internship (Latihan Industri), final-year project and co-curriculum.',
    pages: [1, 1],
    summaryWords: [30, 70],
    defaultTheme: 'compact',
    order: ['summary', 'education', 'experience', 'projects', 'activities', 'skills', 'achievements', 'certifications', 'languages', 'additional', 'referees'],
    titles: {
      summary: 'Profile',
      experience: 'Internship & Work Experience',
      achievements: 'Achievements & Awards'
    }
  },
  mid: {
    name: 'Mid-career professional',
    short: 'Mid-career',
    blurb: 'Experience first, with measurable results. Two pages at most, keep the last 10 years in detail.',
    pages: [1, 2],
    summaryWords: [40, 90],
    defaultTheme: 'classic',
    order: ['summary', 'skills', 'experience', 'education', 'certifications', 'projects', 'achievements', 'languages', 'additional', 'referees'],
    titles: {
      summary: 'Professional Summary'
    }
  },
  senior: {
    name: 'Senior / Executive',
    short: 'Senior',
    blurb: 'Lead with scope and impact: P&L, team size, revenue, transformation. Two to three pages.',
    pages: [2, 3],
    summaryWords: [50, 120],
    defaultTheme: 'executive',
    order: ['summary', 'achievements', 'skills', 'experience', 'education', 'certifications', 'activities', 'languages', 'additional', 'referees'],
    titles: {
      summary: 'Executive Summary',
      achievements: 'Key Achievements',
      skills: 'Core Competencies',
      experience: 'Professional Experience',
      activities: 'Board & Industry Roles'
    }
  }
};

/*
 * Section definitions. `kind` tells the editor and renderer how to treat it:
 *   text   one paragraph
 *   lines  one bullet per line
 *   list   repeatable entries with `fields`
 */
CV.SECTIONS = {
  summary: { title: 'Summary', kind: 'text' },
  experience: {
    title: 'Work Experience', kind: 'list', addLabel: 'Add position',
    fields: [
      { key: 'title', label: 'Job title', placeholder: 'Software Engineer' },
      { key: 'org', label: 'Company', placeholder: 'Example Sdn. Bhd.' },
      { key: 'location', label: 'Location', placeholder: 'Kuala Lumpur' },
      { key: 'start', label: 'Start', type: 'month' },
      { key: 'end', label: 'End', type: 'month', present: true },
      { key: 'bullets', label: 'Achievements (one per line)', type: 'bullets', placeholder: 'Reduced report turnaround from 3 days to 4 hours by automating data extraction' }
    ]
  },
  education: {
    title: 'Education', kind: 'list', addLabel: 'Add qualification',
    fields: [
      { key: 'qualification', label: 'Qualification', placeholder: 'Bachelor of Engineering (Hons) Mechatronics' },
      { key: 'institution', label: 'Institution', placeholder: 'Universiti Teknologi Malaysia' },
      { key: 'location', label: 'Location', placeholder: 'Johor Bahru' },
      { key: 'start', label: 'Start', type: 'month' },
      { key: 'end', label: 'End (future = expected)', type: 'month' },
      { key: 'grade', label: 'Result', placeholder: 'CGPA 3.72 / 4.00, Dean\'s List' },
      { key: 'bullets', label: 'Details (one per line)', type: 'bullets', placeholder: 'Final-year project: ...' }
    ]
  },
  skills: {
    title: 'Skills', kind: 'list', addLabel: 'Add skill group',
    fields: [
      { key: 'category', label: 'Group', placeholder: 'Technical' },
      { key: 'items', label: 'Skills (comma separated)', placeholder: 'Python, SQL, Power BI' }
    ]
  },
  projects: {
    title: 'Projects', kind: 'list', addLabel: 'Add project',
    fields: [
      { key: 'name', label: 'Project', placeholder: 'Autonomous delivery robot' },
      { key: 'role', label: 'Role / context', placeholder: 'Final-year project' },
      { key: 'link', label: 'Link (optional)', placeholder: 'github.com/you/project' },
      { key: 'start', label: 'Start', type: 'month' },
      { key: 'end', label: 'End', type: 'month', present: true },
      { key: 'bullets', label: 'What you did (one per line)', type: 'bullets' }
    ]
  },
  activities: {
    title: 'Co-curricular & Leadership', kind: 'list', addLabel: 'Add activity',
    fields: [
      { key: 'role', label: 'Role', placeholder: 'President' },
      { key: 'org', label: 'Organisation', placeholder: 'Robotics Club' },
      { key: 'start', label: 'Start', type: 'month' },
      { key: 'end', label: 'End', type: 'month', present: true },
      { key: 'bullets', label: 'Contribution (one per line)', type: 'bullets' }
    ]
  },
  certifications: {
    title: 'Certifications', kind: 'list', addLabel: 'Add certification',
    fields: [
      { key: 'name', label: 'Certification', placeholder: 'AWS Certified Solutions Architect - Associate' },
      { key: 'issuer', label: 'Issuer', placeholder: 'Amazon Web Services' },
      { key: 'date', label: 'Date', type: 'month' }
    ]
  },
  achievements: { title: 'Achievements', kind: 'lines', placeholder: 'Champion, National Robotics Competition 2025' },
  languages: {
    title: 'Languages', kind: 'list', addLabel: 'Add language',
    fields: [
      { key: 'language', label: 'Language', placeholder: 'Bahasa Malaysia' },
      { key: 'level', label: 'Proficiency', placeholder: 'Native / Fluent / MUET Band 5' }
    ]
  },
  additional: {
    title: 'Additional Information', kind: 'list', addLabel: 'Add detail',
    fields: [
      { key: 'label', label: 'Label', placeholder: 'Notice period' },
      { key: 'value', label: 'Detail', placeholder: '1 month' }
    ]
  },
  referees: {
    title: 'References', kind: 'list', addLabel: 'Add referee',
    fields: [
      { key: 'name', label: 'Name', placeholder: 'Dr. Ahmad Faizal' },
      { key: 'position', label: 'Position & organisation', placeholder: 'Senior Lecturer, Universiti Teknologi Malaysia' },
      { key: 'contact', label: 'Contact', placeholder: 'ahmad.faizal@utm.my | +60 12-345 6789' }
    ]
  }
};

/* Editor guidance, tuned to Malaysian hiring practice. */
CV.HINTS = {
  personal: 'Leave out your photo, IC number, race, religion, age and marital status. ATS software ignores photos, and employers collect personal data later under PDPA 2010. Use a Malaysian mobile format such as +60 12-345 6789.',
  summary: {
    student: '2 to 3 sentences: your programme, what you are good at, and the role you want (e.g. graduate trainee, internship).',
    mid: '3 to 4 sentences: years of experience, specialism, one or two measurable results, and the value you bring.',
    senior: '4 to 5 sentences: leadership scope (team size, budget, markets), signature results and the transformation you lead.'
  },
  experience: {
    student: 'Internships and part-time jobs count. Start each line with an action verb and add a number where you can.',
    mid: 'Most recent first. 3 to 6 bullets per role, each with a result: %, RM, time saved, users, uptime.',
    senior: 'Open each role with scope (team, budget, region), then 3 to 5 results with RM or % impact.'
  },
  education: {
    student: 'Latest first. Show CGPA when 3.00 or above. Add SPM/STPM only if it is your highest or a strong result.',
    mid: 'Degree, institution and year are enough. CGPA is optional after a few years of work.',
    senior: 'Highest qualifications only. Executive programmes (e.g. INSEAD, Harvard) go here or under Certifications.'
  },
  skills: 'Mirror the exact wording in the job ad (e.g. "Microsoft Excel" vs "Excel"). Group skills so a recruiter can scan them.',
  projects: 'Final-year project, hackathons and side projects. Say what you built, with what tools, and the result.',
  activities: {
    student: 'Clubs, societies, volunteering and sports, especially leadership roles and events you organised.',
    mid: 'Professional bodies and volunteering that support your target role.',
    senior: 'Board seats, advisory roles, industry associations and speaking engagements.'
  },
  certifications: 'Professional bodies matter in Malaysia: BEM, MBOT, MIA, ACCA, HRD Corp, CIDB, PMP and vendor certificates.',
  achievements: {
    student: 'Dean\'s List, scholarships (JPA, PETRONAS, Yayasan), competitions and awards.',
    mid: 'Awards, promotions and recognitions that show impact.',
    senior: '3 to 5 headline results a CEO or board would remember, each with a number.'
  },
  languages: 'Bahasa Malaysia and English are expected by most employers. Add MUET band, IELTS or HSK scores if you have them.',
  additional: 'Common in Malaysia: notice period, availability, driving licence, willingness to relocate. Add expected salary only when the job ad asks for it.',
  referees: 'Optional. Many employers accept "Available upon request"; if you list referees, ask their permission first.'
};

CV.sectionTitle = function (key, tier) {
  var t = CV.TIERS[tier];
  return (t.titles && t.titles[key]) || CV.SECTIONS[key].title;
};

CV.sectionHint = function (key, tier) {
  var h = CV.HINTS[key];
  if (!h) return '';
  return typeof h === 'string' ? h : (h[tier] || '');
};
