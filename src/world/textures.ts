/**
 * Procedurally generated textures.
 *
 * Drawn to a canvas at runtime rather than shipped as image files, for the same
 * reason the signs are: no art pipeline, no asset budget, nothing to keep in
 * sync. It also keeps the strict CSP intact — there is no external host to
 * fetch a texture from.
 *
 * Everything here is seeded. The ground must look identical on every build or
 * visual review is impossible.
 */

import * as THREE from 'three';

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size: number): { ctx: CanvasRenderingContext2D; el: HTMLCanvasElement } | null {
  const el = document.createElement('canvas');
  el.width = size;
  el.height = size;
  const ctx = el.getContext('2d');
  return ctx === null ? null : { ctx, el };
}

/**
 * Rough ground: grass worked over with patches of dirt and dry growth.
 *
 * The point is not realism, it is *variation*. A single flat colour under a few
 * hundred trees is what makes a scene read as a render of nothing rather than
 * as a place, however good the models on top of it are.
 */
export function makeGroundTexture(size = 512, seed = 7): THREE.CanvasTexture | null {
  const surface = canvas(size);
  if (surface === null) return null;
  const { ctx, el } = surface;
  const random = mulberry32(seed);

  ctx.fillStyle = '#2c3a2c';
  ctx.fillRect(0, 0, size, size);

  // Broad tonal patches first — the large-scale unevenness of real ground.
  const patches = ['#334227', '#283524', '#3a4530', '#2f3a2b', '#3c3f2c'];
  for (let i = 0; i < 90; i += 1) {
    const shade = patches[Math.floor(random() * patches.length)] ?? '#2c3a2c';
    ctx.fillStyle = shade;
    ctx.globalAlpha = 0.35 + random() * 0.4;
    ctx.beginPath();
    ctx.ellipse(
      random() * size,
      random() * size,
      18 + random() * 90,
      14 + random() * 70,
      random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Then worn earth showing through.
  ctx.globalAlpha = 0.5;
  for (let i = 0; i < 40; i += 1) {
    ctx.fillStyle = random() > 0.5 ? '#413524' : '#4a3d2a';
    ctx.beginPath();
    ctx.ellipse(
      random() * size,
      random() * size,
      6 + random() * 34,
      5 + random() * 26,
      random() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }

  // Finally blades, which is what stops it reading as blur at close range.
  ctx.globalAlpha = 0.55;
  for (let i = 0; i < 5200; i += 1) {
    const x = random() * size;
    const y = random() * size;
    const length = 1.5 + random() * 3.5;
    ctx.strokeStyle = random() > 0.62 ? '#465a38' : '#26331f';
    ctx.lineWidth = 0.8 + random() * 0.7;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (random() - 0.5) * 2, y - length);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(el);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** Coarse asphalt, so the carriageway is not a flat grey sheet. */
export function makeRoadTexture(size = 256, seed = 19): THREE.CanvasTexture | null {
  const surface = canvas(size);
  if (surface === null) return null;
  const { ctx, el } = surface;
  const random = mulberry32(seed);

  ctx.fillStyle = '#3b434f';
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 9000; i += 1) {
    const grey = 40 + Math.floor(random() * 46);
    ctx.fillStyle = `rgb(${grey},${grey + 4},${grey + 10})`;
    ctx.globalAlpha = 0.25 + random() * 0.45;
    ctx.fillRect(random() * size, random() * size, 1 + random() * 2, 1 + random() * 2);
  }

  // Patched repairs and old joints.
  ctx.globalAlpha = 0.22;
  for (let i = 0; i < 14; i += 1) {
    ctx.fillStyle = random() > 0.5 ? '#333a45' : '#454d59';
    ctx.fillRect(random() * size, random() * size, 10 + random() * 60, 6 + random() * 30);
  }
  ctx.globalAlpha = 1;

  const texture = new THREE.CanvasTexture(el);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/**
 * A dusk sky, top to horizon.
 *
 * A flat background colour is the single biggest tell that a scene is a render
 * rather than a place: real skies have a gradient and a warm band where the sun
 * went down.
 */
export function makeSkyTexture(height = 512): THREE.CanvasTexture | null {
  const el = document.createElement('canvas');
  el.width = 8;
  el.height = height;
  const ctx = el.getContext('2d');
  if (ctx === null) return null;

  // On a sphere the horizon is at v = 0.5, and v = 0 is straight down. Putting
  // the sunset band near the bottom of the canvas paints it *below ground*,
  // where the ground plane hides it — so the whole sky reads as flat navy.
  // Everything interesting has to sit just above the midpoint.
  const gradient = ctx.createLinearGradient(0, 0, 0, height);
  gradient.addColorStop(0, '#070b14');
  gradient.addColorStop(0.22, '#0e1626');
  gradient.addColorStop(0.36, '#1b2740');
  gradient.addColorStop(0.44, '#3a3b52');
  gradient.addColorStop(0.475, '#7a5a56');
  gradient.addColorStop(0.495, '#c07a4a');
  gradient.addColorStop(0.5, '#d99257');
  gradient.addColorStop(0.52, '#7c5238');
  gradient.addColorStop(0.6, '#2a2620');
  gradient.addColorStop(1, '#14161a');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, 8, height);

  const texture = new THREE.CanvasTexture(el);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
