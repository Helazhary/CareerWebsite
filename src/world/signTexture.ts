'use client';

import * as THREE from 'three';
import { fitSign, type Measure } from './signText';

/**
 * Text rendered to a canvas texture. Shared by building signs and roadside
 * billboards, so both use the same fitting rules and neither needs art.
 */

const FONT_STACK =
  'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

export interface SignTextureOptions {
  readonly width: number;
  readonly height: number;
  readonly panel: string;
  readonly ink: string;
  readonly accent?: string;
  readonly uppercase?: boolean;
}

export function createSignTexture(
  text: string,
  options: SignTextureOptions,
): THREE.CanvasTexture | null {
  const canvas = document.createElement('canvas');
  canvas.width = options.width;
  canvas.height = options.height;
  const ctx = canvas.getContext('2d');
  if (ctx === null) return null;

  ctx.fillStyle = options.panel;
  ctx.fillRect(0, 0, options.width, options.height);

  if (options.accent !== undefined) {
    ctx.fillStyle = options.accent;
    ctx.fillRect(0, 0, options.width, Math.max(6, options.height * 0.045));
    ctx.fillRect(0, options.height - Math.max(6, options.height * 0.045), options.width, options.height);
  }

  const label = options.uppercase === true ? text.toUpperCase() : text;
  const measure: Measure = (value, fontSize) => {
    ctx.font = `700 ${fontSize}px ${FONT_STACK}`;
    return ctx.measureText(value).width;
  };

  const { lines, fontSize } = fitSign(label, measure, {
    maxWidth: options.width * 0.88,
    maxHeight: options.height * 0.7,
    maxFontSize: Math.round(options.height * 0.62),
  });

  ctx.fillStyle = options.ink;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `700 ${fontSize}px ${FONT_STACK}`;

  const lineHeight = fontSize * 1.16;
  const start = options.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, index) => {
    ctx.fillText(line, options.width / 2, start + index * lineHeight);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
