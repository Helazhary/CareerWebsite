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
  /**
   * What the road says where it runs out. Deliberately not "get in touch":
   * the career is not finished, and a closing CTA would say it was
   * (DESIGN.md §2.3).
   */
  closingSign: 'still driving',
  /**
   * The About panel.
   *
   * Empty on purpose. The panel falls back to `pitch`, `role` and `location` —
   * all facts already in this file — so it works today without anything being
   * invented on Hussein's behalf.
   *
   * TODO(hussein): write two or three short paragraphs in your own voice.
   * Where you're from, what you like building and why, what you are looking
   * for next. This is the one place on the site that is allowed to be personal
   * rather than factual, and it is the thing a hiring manager reads after they
   * have decided they like the work.
   */
  about: [] as readonly string[],
} as const;

export const DISTRICT_LABELS: Record<string, string> = {
  garage: 'The Garage',
  lab: 'The Lab',
  agents: 'Agent Alley',
  workshop: 'The Workshop',
  arcade: 'The Arcade',
  highway: 'The Highway',
};
