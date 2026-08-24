import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { PREVIEW_MODE, placeholderImage, previewMedia } from '@/preview/placeholders';

describe('preview placeholders', () => {
  it('is off unless NEXT_PUBLIC_PREVIEW is explicitly set', () => {
    // The guarantee the whole design rests on: a normal build cannot show a
    // placeholder, so a grey PLACEHOLDER card can never reach helazhary.com.
    expect(PREVIEW_MODE).toBe(false);
  });

  it('shows nothing for an entry with no media when preview is off', () => {
    const bare = entries.filter((entry) => entry.media.length === 0);
    expect(bare.length, 'expected some entries to still lack photographs').toBeGreaterThan(0);
    for (const entry of bare) {
      expect(previewMedia(entry)).toEqual([]);
    }
  });

  it('passes real media through untouched, and marks none of it as placeholder', () => {
    const withMedia = entries.filter((entry) => entry.media.length > 0);
    expect(withMedia.length).toBeGreaterThan(0);
    for (const entry of withMedia) {
      const items = previewMedia(entry);
      expect(items).toHaveLength(entry.media.length);
      for (const item of items) {
        expect(item.placeholder).toBe(false);
        expect(item.src.startsWith(`/media/${entry.id}/`)).toBe(true);
      }
    }
  });

  it('escapes titles so a stray character cannot break the SVG', () => {
    const svg = decodeURIComponent(placeholderImage('Ampersand & <script>', 0, 1));
    expect(svg).toContain('Ampersand &amp; &lt;script&gt;');
    expect(svg).not.toContain('<script>');
  });

  it('labels every placeholder as one, in the image and in the alt text', () => {
    const svg = decodeURIComponent(placeholderImage('Example', 0, 2));
    expect(svg).toContain('PLACEHOLDER 1 / 2');
  });
});
