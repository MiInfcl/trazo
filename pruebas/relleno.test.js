'use strict';
/* Relleno: no deja píxeles sin pintar en bordes suavizados y no se sale de contornos cerrados. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const V = require(path.join(__dirname, '..', 'app', 'js', 'vec.js'));

/* Lienzo blanco con un anillo negro suavizado (radio 20, grosor 3) centrado en (32, 32). */
function anillo(fondoAlfa) {
  const w = 64, h = 64, px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const d = Math.abs(Math.hypot(x + 0.5 - 32, y + 0.5 - 32) - 20);
    const cov = Math.max(0, Math.min(1, 2 - d)); // 1 en el centro del trazo, 0 a más de 2 px
    const o = (y * w + x) * 4;
    if (fondoAlfa) { px[o] = px[o + 1] = px[o + 2] = 255 * (1 - cov); px[o + 3] = 255; }
    else { px[o] = px[o + 1] = px[o + 2] = 0; px[o + 3] = Math.round(255 * cov); }
  }
  return { w, h, px };
}

test('relleno: en un anillo suavizado no queda ningún píxel claro sin pintar', () => {
  const { w, h, px } = anillo(true);
  const r = V.floodFill(px, w, h, 32, 32, [255, 0, 0]);
  assert.ok(r);
  // dentro del anillo (radio < 18): ningún píxel debe conservar verde o azul altos (blanco o gris claro)
  let restos = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.hypot(x + 0.5 - 32, y + 0.5 - 32) > 20) continue;
    const o = (y * w + x) * 4;
    if (px[o + 1] > 40) restos++;
  }
  assert.equal(restos, 0);
  // no se salió: afuera sigue blanco
  assert.deepEqual(Array.from(px.slice(0, 4)), [255, 255, 255, 255]);
  assert.ok(r.edge.length > 0 && r.edgeOpaque);
});

test('relleno: sobre transparente con trazo semitransparente el borde queda cubierto', () => {
  const { w, h, px } = anillo(false);
  V.floodFill(px, w, h, 32, 32, [0, 0, 255]);
  let huecos = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (Math.hypot(x + 0.5 - 32, y + 0.5 - 32) > 20) continue;
    if (px[(y * w + x) * 4 + 3] < 200) huecos++;
  }
  assert.equal(huecos, 0);
  assert.equal(px[3], 0); // afuera sigue transparente
});

test('relleno: un trazo negro duro no cambia y una línea de 1 px no deja pasar el relleno', () => {
  const w = 10, h = 10, px = new Uint8ClampedArray(w * h * 4).fill(255);
  for (let y = 0; y < h; y++) { const o = (y * w + 5) * 4; px[o] = px[o + 1] = px[o + 2] = 0; }
  V.floodFill(px, w, h, 1, 1, [0, 255, 0]);
  assert.deepEqual(Array.from(px.slice((3 * w + 5) * 4, (3 * w + 5) * 4 + 4)), [0, 0, 0, 255]);
  assert.deepEqual(Array.from(px.slice((3 * w + 8) * 4, (3 * w + 8) * 4 + 4)), [255, 255, 255, 255]);
  assert.deepEqual(Array.from(px.slice((3 * w + 2) * 4, (3 * w + 2) * 4 + 4)), [0, 255, 0, 255]);
});

test('relleno: rellenar con el mismo color no hace nada', () => {
  const px = new Uint8ClampedArray(4 * 4 * 4).fill(255);
  assert.equal(V.floodFill(px, 4, 4, 0, 0, [255, 255, 255]), null);
});
