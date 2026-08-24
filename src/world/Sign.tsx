'use client';

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import type { Footprint } from './layout';
import { fitSign, type Measure } from './signText';

/**
 * A building's sign, rendered to a canvas texture at runtime from the entry
 * title (DESIGN.md §2.5).
 *
 * This is the single mechanism that makes the site modular: a new entry in
 * `content/` produces a correctly-signed building with no art work and no
 * change to the renderer.
 */

const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 256;
const FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

function drawSign(text: string, panel: string, ink: string): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = CANVAS_WIDTH;
  canvas.height = CANVAS_HEIGHT;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  ctx.fillStyle = panel;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  const measure: Measure = (value, fontSize) => {
    ctx.font = `600 ${fontSize}px ${FONT_STACK}`;
    return ctx.measureText(value).width;
  };

  const { lines, fontSize } = fitSign(text, measure, {
    maxWidth: CANVAS_WIDTH * 0.9,
    maxHeight: CANVAS_HEIGHT * 0.78,
  });

  ctx.fillStyle = ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `600 ${fontSize}px ${FONT_STACK}`;

  const lineHeight = fontSize * 1.16;
  const start = CANVAS_HEIGHT / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, CANVAS_WIDTH / 2, start + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function Sign({
  text,
  footprint,
  panel = '#11151d',
  ink = '#e7eaf0',
}: {
  text: string;
  footprint: Footprint;
  panel?: string;
  ink?: string;
}): React.JSX.Element | null {
  const texture = useMemo(() => drawSign(text, panel, ink), [text, panel, ink]);

  // Canvas textures hold a bitmap on the GPU. Without this, driving past a few
  // hundred buildings would leak every one of them.
  useEffect(() => () => texture?.dispose(), [texture]);

  if (texture === null) return null;

  const width = footprint.width * 0.78;
  const height = width * (CANVAS_HEIGHT / CANVAS_WIDTH);
  // Just under the roofline, clear of doors and window bands below.
  const y = Math.max(footprint.height - height * 0.85, footprint.height * 0.55);

  return (
    <group position={[0, y, footprint.depth / 2 + 0.12]}>
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial
          map={texture}
          transparent={false}
          roughness={0.6}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.55}
        />
      </mesh>
    </group>
  );
}
