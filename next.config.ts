import type { NextConfig } from 'next';

/**
 * Static export: `next build` emits plain files into `out/`.
 * There is no server at runtime — Cloudflare Pages just serves the folder.
 */
const nextConfig: NextConfig = {
  output: 'export',
  trailingSlash: true,
  reactStrictMode: true,
  images: { unoptimized: true },
};

export default nextConfig;
