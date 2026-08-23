export const site = {
  name: 'Hussein Elazhary',
  role: 'Software Engineer · AI / ML Engineer',
  location: 'Cairo, Egypt',
  pitch:
    'AI/ML and software engineer who builds intelligent systems end-to-end, from computer-vision and NLP models to production applications and agentic AI pipelines.',
  url: 'https://helazhary.com',
  // Split so the plain address never appears in the served HTML.
  emailUser: 'h.eazhary',
  emailDomain: 'gmail.com',
  github: 'https://github.com/Helazhary',
  linkedin: 'https://linkedin.com/in/husseinelazhary/',
  /** Drop the PDF at public/Hussein_Elazhary_Resume.pdf to enable this. */
  resumePdf: '/Hussein_Elazhary_Resume.pdf',
} as const;

export const DISTRICT_LABELS: Record<string, string> = {
  garage: 'The Garage',
  lab: 'The Lab',
  agents: 'Agent Alley',
  workshop: 'The Workshop',
  arcade: 'The Arcade',
  highway: 'The Highway',
};
