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
- Never invent a date, a metric, a technology, a link, or a specification. Not
  even as filler to make a page look finished. If a fact is unknown, leave a
  `// TODO(hussein):` comment and ask.
- This applies to alt text and captions too. Describe what is visible in the
  photograph and nothing more — no inferred engine specs, no guessed locations,
  no paint codes.
- To see the site looking complete before the real media exists, use
  `npm run dev:preview`, which fills empty galleries with visibly labelled
  placeholders. Never put placeholder content in `content/entries/` — that
  ships.
- Photographs are checked before they are published: number plates, faces, and
  anything identifying a third party. Crop rather than publish and apologise.
- After adding or removing an entry file, run `npm run content:sync`.
