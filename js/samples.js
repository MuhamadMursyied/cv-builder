/*
 * Example CVs, one per tier. All names, contact details and companies are
 * dummy data (example.com addresses, +60 12-345 6789).
 */
window.CV = window.CV || {};

CV.emptyCV = function (tier) {
  tier = tier || 'student';
  return {
    version: 1,
    tier: tier,
    theme: CV.TIERS[tier].defaultTheme,
    order: CV.TIERS[tier].order.slice(),
    hidden: {},
    personal: { fullName: '', headline: '', email: '', phone: '', location: '', linkedin: '', website: '' },
    summary: '',
    experience: [],
    education: [],
    skills: [],
    projects: [],
    activities: [],
    certifications: [],
    achievements: '',
    languages: [],
    additional: [],
    referees: []
  };
};

CV.SAMPLES = {
  student: {
    personal: {
      fullName: 'Ali bin Abu',
      headline: 'Final-year Mechatronics Engineering Student',
      email: 'ali.abu@example.com',
      phone: '+60 12-345 6789',
      location: 'Johor Bahru, Johor',
      linkedin: 'linkedin.com/in/example',
      website: 'github.com/example'
    },
    summary: 'Final-year Mechatronics Engineering student (CGPA 3.72) with hands-on experience in robot software, embedded systems and automated testing. Built a ROS 2 autonomous ground vehicle for my final-year project and completed a 24-week internship in electronics manufacturing. Seeking a graduate engineer role in robotics or automation from July 2026.',
    education: [
      { qualification: 'Bachelor of Engineering (Hons) Mechatronics', institution: 'Universiti Teknologi Malaysia', location: 'Johor Bahru', start: '2022-09', end: '2026-07', grade: 'CGPA 3.72 / 4.00, Dean\'s List (5 semesters)', bullets: '' }
    ],
    experience: [
      { title: 'Engineering Intern, Test Development', org: 'ABC Electronics Sdn. Bhd.', location: 'Bayan Lepas, Penang', start: '2025-03', end: '2025-08', bullets: 'Automated functional testing of 3 PCB assemblies in Python, cutting test time per unit by 35%\nDesigned a fixture alignment check that reduced false test failures from 4.1% to 1.2%\nDocumented test procedures in English and Bahasa Malaysia for 20 production operators' },
      { title: 'Part-time Robotics Instructor', org: 'XYZ STEM Centre', location: 'Johor Bahru', start: '2023-06', end: '2024-12', bullets: 'Coached 2 teams for the National Robotics Competition, both reaching the state final' }
    ],
    projects: [
      { name: 'Autonomous Campus Delivery Robot', role: 'Final-year project', link: 'github.com/example/campus-robot', start: '2025-09', end: 'present', bullets: 'Built a ROS 2 Jazzy navigation stack (Nav2, SLAM Toolbox) for a 4-wheel UGV on a Jetson Orin Nano\nAchieved 92% successful deliveries over 50 trial runs on a 1.2 km campus route\nIntegrated a 2D LiDAR and wheel odometry with an EKF for localisation' }
    ],
    activities: [
      { role: 'Vice President', org: 'UTM Robotics Club', start: '2024-09', end: '2025-08', bullets: 'Led a committee of 15 and organised a robotics workshop for 120 secondary school students\nSecured RM 8,000 in sponsorship from 3 industry partners' }
    ],
    skills: [
      { category: 'Programming', items: 'Python, C++, MATLAB, Bash' },
      { category: 'Robotics', items: 'ROS 2, Nav2, Gazebo, OpenCV, SLAM' },
      { category: 'Hardware', items: 'Arduino, ESP32, NVIDIA Jetson, PLC (Siemens S7-1200)' },
      { category: 'Tools', items: 'Git, Linux (Ubuntu), SolidWorks, Microsoft Excel' }
    ],
    achievements: 'Yayasan Sime Darby Scholarship recipient, 2022 to 2026\nGold Award, UTM Innovation Showcase 2025',
    certifications: [],
    languages: [
      { language: 'Bahasa Malaysia', level: 'Native' },
      { language: 'English', level: 'Fluent, MUET Band 5' },
      { language: 'Mandarin', level: 'Basic' }
    ],
    additional: [],
    referees: []
  },

  mid: {
    personal: {
      fullName: 'Tan Ah Kow',
      headline: 'Senior Software Engineer, Backend & Cloud',
      email: 'tan.ahkow@example.com',
      phone: '+60 12-345 6789',
      location: 'Petaling Jaya, Selangor',
      linkedin: 'linkedin.com/in/example',
      website: ''
    },
    summary: 'Senior software engineer with 7 years of experience building payment and logistics platforms in Go, Java and AWS. Led the migration of a monolith serving 2 million users to microservices, reducing infrastructure cost by 28%. Comfortable owning systems end to end, from design reviews to on-call, and mentoring engineers across Malaysia and Vietnam.',
    skills: [
      { category: 'Languages', items: 'Go, Java, Python, SQL, TypeScript' },
      { category: 'Cloud & DevOps', items: 'AWS (ECS, Lambda, RDS), Terraform, Docker, Kubernetes, GitHub Actions' },
      { category: 'Data', items: 'PostgreSQL, Redis, Kafka, Elasticsearch' },
      { category: 'Practices', items: 'Microservices, REST and gRPC APIs, observability, agile delivery' }
    ],
    experience: [
      { title: 'Senior Software Engineer', org: 'ABC Logistics Sdn. Bhd.', location: 'Kuala Lumpur', start: '2022-04', end: 'present', bullets: 'Led a team of 5 engineers to split a delivery-tracking monolith into 9 Go services on AWS ECS, cutting infrastructure cost by 28%\nReduced p95 API latency from 820 ms to 190 ms by redesigning caching with Redis\nIntroduced on-call runbooks and SLOs that lowered monthly incidents from 14 to 4\nMentored 4 junior engineers, 2 of whom were promoted within 18 months' },
      { title: 'Software Engineer', org: 'XYZ Payments Sdn. Bhd.', location: 'Kuala Lumpur', start: '2019-07', end: '2022-03', bullets: 'Built a DuitNow QR settlement service in Java processing RM 40 million per month\nAutomated bank reconciliation, saving the finance team 60 hours per month\nAchieved PCI DSS compliance for 3 services with the security team' },
      { title: 'Junior Developer', org: 'DEF Tech Solutions', location: 'Melaka', start: '2018-01', end: '2019-06', bullets: 'Delivered 6 client web applications in Python (Django) and PostgreSQL' }
    ],
    education: [
      { qualification: 'Bachelor of Computer Science (Hons)', institution: 'Universiti Malaya', location: 'Kuala Lumpur', start: '2014-09', end: '2017-11', grade: 'Second Class Upper', bullets: '' }
    ],
    certifications: [
      { name: 'AWS Certified Solutions Architect - Associate', issuer: 'Amazon Web Services', date: '2023-02' },
      { name: 'Certified Kubernetes Application Developer (CKAD)', issuer: 'The Linux Foundation', date: '2024-06' }
    ],
    projects: [],
    activities: [],
    achievements: 'Engineering Excellence Award, ABC Logistics, 2023',
    languages: [
      { language: 'English', level: 'Fluent' },
      { language: 'Mandarin', level: 'Fluent' },
      { language: 'Bahasa Malaysia', level: 'Good' }
    ],
    additional: [
      { label: 'Notice period', value: '2 months' }
    ],
    referees: []
  },

  senior: {
    personal: {
      fullName: 'Siti binti Ahmad',
      headline: 'Chief Operating Officer | Manufacturing & Supply Chain',
      email: 'siti.ahmad@example.com',
      phone: '+60 12-345 6789',
      location: 'Shah Alam, Selangor',
      linkedin: 'linkedin.com/in/example',
      website: ''
    },
    summary: 'Operations executive with 19 years in electronics and medical device manufacturing across Malaysia, Thailand and China. Currently COO of a RM 1.2 billion contract manufacturer with 3,400 employees and 4 plants. Known for turnaround leadership: restored a loss-making plant to 14% EBITDA in 2 years, and led an Industry 4.0 programme that raised overall equipment effectiveness from 61% to 83%. Board-facing, MIDA- and investor-experienced, and committed to building Malaysian engineering talent.',
    achievements: 'Grew group revenue from RM 780 million to RM 1.2 billion in 4 years while holding operating margin above 11%\nTurned around the Kulim plant from a RM 18 million loss to 14% EBITDA within 24 months\nSecured RM 150 million in new medical-device programmes from 2 US customers\nCut finished-goods inventory by RM 42 million through S&OP redesign',
    skills: [
      { category: 'Leadership', items: 'P&L ownership, turnaround management, M&A integration, board reporting' },
      { category: 'Operations', items: 'Lean Six Sigma, S&OP, Industry 4.0, supplier development, ISO 13485, IATF 16949' },
      { category: 'People', items: 'Organisation design, succession planning, union relations, ESG and labour compliance' }
    ],
    experience: [
      { title: 'Chief Operating Officer', org: 'ABC Manufacturing Berhad', location: 'Shah Alam, Selangor', start: '2021-01', end: 'present', bullets: 'Lead 4 plants, 3,400 employees and an operating budget of RM 310 million, reporting to the Group CEO and Board\nDelivered RM 65 million in cost savings over 3 years through automation and procurement consolidation\nLed the RM 90 million Kulim expansion, completed on time and 6% under budget\nAchieved zero findings in 2 consecutive RBA (Responsible Business Alliance) audits' },
      { title: 'Vice President, Operations', org: 'XYZ Medical Devices Sdn. Bhd.', location: 'Penang', start: '2015-06', end: '2020-12', bullets: 'Ran manufacturing for 2 plants in Penang and Thailand with 1,800 staff\nRaised on-time delivery from 87% to 98% and cut scrap rate by 40%\nBuilt a graduate engineer programme that hired and developed 120 Malaysian engineers' },
      { title: 'Plant Manager', org: 'DEF Electronics (M) Sdn. Bhd.', location: 'Senai, Johor', start: '2010-03', end: '2015-05', bullets: 'Managed a 900-person SMT and box-build plant with RM 400 million annual output\nDeployed Lean across 12 lines, improving labour productivity by 22%' },
      { title: 'Process Engineer to Production Manager', org: 'DEF Electronics (M) Sdn. Bhd.', location: 'Senai, Johor', start: '2006-07', end: '2010-02', bullets: 'Promoted 3 times in 4 years' }
    ],
    education: [
      { qualification: 'Master of Business Administration', institution: 'Universiti Putra Malaysia, Putra Business School', location: 'Serdang', start: '2012-01', end: '2014-06', grade: '', bullets: '' },
      { qualification: 'Bachelor of Engineering (Hons) Electrical & Electronic', institution: 'Universiti Sains Malaysia', location: 'Nibong Tebal, Penang', start: '2002-07', end: '2006-06', grade: 'First Class Honours', bullets: '' }
    ],
    certifications: [
      { name: 'Lean Six Sigma Black Belt', issuer: 'ASQ', date: '2012-09' },
      { name: 'Professional Engineer (Ir.)', issuer: 'Board of Engineers Malaysia', date: '2013-04' }
    ],
    activities: [
      { role: 'Council Member', org: 'Example Manufacturers Association', start: '2022-01', end: 'present', bullets: '' },
      { role: 'Industry Advisory Panel', org: 'Faculty of Engineering, Universiti Sains Malaysia', start: '2019-01', end: 'present', bullets: '' }
    ],
    projects: [],
    languages: [
      { language: 'English', level: 'Fluent' },
      { language: 'Bahasa Malaysia', level: 'Fluent' },
      { language: 'Tamil', level: 'Native' }
    ],
    additional: [],
    referees: []
  }
};

CV.sampleCV = function (tier) {
  var cv = CV.emptyCV(tier);
  var sample = JSON.parse(JSON.stringify(CV.SAMPLES[tier]));
  Object.keys(sample).forEach(function (k) { cv[k] = sample[k]; });
  return cv;
};
