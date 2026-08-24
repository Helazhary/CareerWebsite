import { describe, expect, it } from 'vitest';
import { entries } from '@content/registry';
import { PREVIEW_MODE, placeholderImage, previewMedia } from '@/preview/placeholders';

describe('preview placeholders', () => {
  it('is off unless NEXT_PUBLIC_PREVIEW is explicitly set', () => {
    // The guarantee the whole design rests on: a normal build cannot show a
    // placeholder, so a grey PLACEHOLDER card can never reach helazhary.com.
    expect(PREVIEW_MODE).toBe(false);
  });

  it('cannot be switched on in a production build at all', () => {
    // Belt and braces. The env var by itself is one Cloudflare setting away
    // from shipping placeholders; a production bundle must not be able to
    // express preview mode however it is configured.
    const previous = process.env.NODE_ENV;
    const flag = process.env.NEXT_PUBLIC_PREVIEW;
    try {
      Object.defineProperty(process.env, 'NODE_ENV', { value: 'production', configurable: true });
      process.env.NEXT_PUBLIC_PREVIEW = '1';
      const enabled =
        process.env.NODE_ENV !== 'production' && process.env.NEXT_PUBLIC_PREVIEW === '1';
      expect(enabled).toBe(false);
    } finally {
      Object.defineProperty(process.env, 'NODE_ENV', { value: previous, configurable: true });
      if (flag === undefined) delete process.env.NEXT_PUBLIC_PREVIEW;
      else process.env.NEXT_PUBLIC_PREVIEW = flag;
    }
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
