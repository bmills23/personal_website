export const personalInfo = {
  name: 'Bryan G. Mills',
  title: 'Software Developer & Geologist-in-Training',
  tagline: 'Bridging environmental science and software engineering in Colorado.',
  location: 'Colorado',
  email: 'millsbryang@gmail.com',
  bio: [
    'I\'m a software developer and Geologist-in-Training (G.I.T.) at the State of Colorado, combining a passion for environmental science with full-stack web development.',
    'My work spans building data-driven tools for environmental analysis — from contaminant transport modeling to VOC trend analysis — alongside modern web applications using JavaScript, Python, and C.',
    'I enjoy tackling complex problems at the intersection of science and technology, whether that\'s reverse-engineering hydrological models or crafting interactive web experiences from scratch.',
    'When I\'m not coding or studying geology, you can find me working through Advent of Code challenges, experimenting with creative coding projects, or exploring Colorado\'s outdoors.',
  ],
  quote: '"The best way to predict the future is to invent it." — Alan Kay',
}

export const socialLinks = [
  { name: 'linkedin', url: 'https://www.linkedin.com/in/bryangmills/' },
  { name: 'github', url: 'https://github.com/bmills23/' },
]

export const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Contact', href: '#contact' },
  { label: 'Experience', href: '#experience' },
  { label: 'Projects', href: '#projects' },
]

export const skills = [
  {
    category: 'Languages & Frameworks',
    items: [
      { name: 'JavaScript', level: 90, label: 'Expert' },
      { name: 'Python', level: 80, label: 'Advanced' },
      { name: 'C', level: 75, label: 'Advanced' },
      { name: 'Ruby / Rails', level: 60, label: 'Proficient' },
      { name: 'HTML / CSS', level: 90, label: 'Expert' },
      { name: 'SQL / MySQL', level: 78, label: 'Advanced' },
    ],
  },
  {
    category: 'Tools & Infrastructure',
    items: [
      { name: 'Node.js / Express', level: 85, label: 'Expert' },
      { name: 'React', level: 80, label: 'Advanced' },
      { name: 'Git / GitHub', level: 88, label: 'Expert' },
      { name: 'Docker / Fly.io', level: 70, label: 'Advanced' },
      { name: 'AWS (S3)', level: 68, label: 'Proficient' },
      { name: 'Linux / PowerShell', level: 75, label: 'Advanced' },
    ],
  },
  {
    category: 'Science & Data',
    items: [
      { name: 'Environmental Modeling', level: 82, label: 'Advanced' },
      { name: 'Data Analysis (Python)', level: 80, label: 'Advanced' },
      { name: 'AI / Neural Networks', level: 65, label: 'Proficient' },
      { name: 'GIS / Mapping', level: 70, label: 'Advanced' },
    ],
  },
]

export const experience = [
  {
    company: 'State of Colorado',
    role: 'Software Developer / Geologist-in-Training',
    period: 'Present',
    location: 'Colorado',
    description: 'Building software tools and performing environmental analysis for state government operations.',
    highlights: [
      'Developed data conversion tools for CDLE Excel-to-CSV processing',
      'Environmental data analysis including Mann-Kendall VOC trend analysis',
      'Contaminant transport modeling and hydrological research',
      'Built internal web applications with JavaScript, Node.js, and MySQL',
    ],
    tech: ['JavaScript', 'Python', 'Node.js', 'MySQL', 'Express'],
  },
]

export const projects = [
  {
    title: 'ModelFlow',
    description: 'Reverse-engineering a paid contaminant transport application using modern hydrological methods. Built with Python for environmental modeling.',
    tech: ['Python', 'Hydrology', 'Environmental Modeling'],
    url: 'https://github.com/bmills23/model_flow',
    featured: true,
  },
  {
    title: 'Mann-Kendall Analysis',
    description: 'Statistical trend analysis tool for Volatile Organic Compound (VOC) data using the Mann-Kendall test for environmental monitoring.',
    tech: ['Python', 'Statistics', 'Environmental Science'],
    url: 'https://github.com/bmills23/mann-kendall',
    featured: true,
  },
  {
    title: 'Personal Website',
    description: 'This portfolio site — a modern static React app with dark/light theme, smooth animations, and GitHub Pages deployment.',
    tech: ['React', 'Vite', 'Tailwind CSS', 'Framer Motion'],
    url: 'https://github.com/bmills23/personal_website',
    featured: true,
  },
  {
    title: 'Neural Numbers',
    description: 'A neural network experiment that predicts drawn numbers. Exploring machine learning concepts with JavaScript.',
    tech: ['JavaScript', 'Neural Networks', 'ML'],
    url: 'https://github.com/bmills23/neural-numbers',
    featured: false,
  },
  {
    title: 'Brewery Finder',
    description: 'A web application for discovering and exploring breweries. Built with JavaScript.',
    tech: ['JavaScript', 'API Integration', 'Web App'],
    url: 'https://github.com/bmills23/breweryFinder',
    featured: false,
  },
  {
    title: 'PLSS Map',
    description: 'Interactive mapping tool for the Public Land Survey System, useful for geological and land management work.',
    tech: ['JavaScript', 'Mapping', 'GIS'],
    url: 'https://github.com/bmills23/PLSSMap',
    featured: false,
  },
]

export const interests = [
  'Environmental Science',
  'Geology',
  'Web Development',
  'Data Analysis',
  'Creative Coding',
  'AI & Machine Learning',
  'Open Source',
  'Colorado Outdoors',
]
