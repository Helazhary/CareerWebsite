---
paths:
  - "content/**"
---

# Content rules

- Every field must satisfy `content/schema.ts`. If a change needs a new field,
  add it to the schema first, with a comment explaining what it is for.
- `summary` is one line, under 200 characters. It appears on cards and in
  `<meta name="description">`.
- `bullets` is the entire body of an entry — three to five, past tense, each one
  a concrete thing that was built or measured. No filler.
- `id` is a permanent public URL. Renaming one breaks any link already shared.
- Dates are `YYYY-MM`. Use `'present'` for a current role.
- Never invent a date, a metric, or a technology. If a fact is unknown, leave a
  `// TODO(hussein):` comment and ask.
- After adding or removing an entry file, run `npm run content:sync`.
