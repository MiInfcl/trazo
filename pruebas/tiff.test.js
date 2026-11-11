'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const C = require(path.join(__dirname, '..', 'app', 'js', 'codecs.js'));

test('TIFF: ida y vuelta con alfa', () => {
  let s = 31;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return Math.floor(s / 16777216); };
  const w = 23, h = 17, rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < rgba.length; i++) rgba[i] = r();
  const t = C.readTIFF(C.writeTIFF(rgba, w, h));
  assert.equal(t.w, w); assert.equal(t.h, h);
  assert.deepEqual(Buffer.from(t.rgba.buffer), Buffer.from(rgba.buffer));
});

/* TIFF hecho a mano para probar la lectura de otras variantes. */
function makeTIFF(w, h, spp, comp, photo, data, le) {
  const tags = [[256, 4, 1, w], [257, 4, 1, h], [258, 3, 1, 8], [259, 3, 1, comp], [262, 3, 1, photo], [273, 4, 1, 0], [277, 3, 1, spp], [278, 4, 1, h], [279, 4, 1, data.length]];
  const dataAt = 8 + 2 + tags.length * 12 + 4;
  tags[5][3] = dataAt;
  const out = new Uint8Array(dataAt + data.length);
  const dv = new DataView(out.buffer);
  out[0] = out[1] = le ? 0x49 : 0x4D;
  dv.setUint16(2, 42, le); dv.setUint32(4, 8, le); dv.setUint16(8, tags.length, le);
  tags.forEach((t, i) => {
    const o = 10 + i * 12;
    dv.setUint16(o, t[0], le); dv.setUint16(o + 2, t[1], le); dv.setUint32(o + 4, t[2], le);
    if (t[1] === 3) dv.setUint16(o + 8, t[3], le); else dv.setUint32(o + 8, t[3], le);
  });
  out.set(data, dataAt);
  return out;
}

test('TIFF: PackBits en RGB y escala de grises en big-endian', () => {
  const pb = Uint8Array.from([5, 255, 0, 0, 255, 0, 0]);
  const a = C.readTIFF(makeTIFF(2, 1, 3, 32773, 2, pb, true));
  assert.deepEqual(Array.from(a.rgba), [255, 0, 0, 255, 255, 0, 0, 255]);
  const b = C.readTIFF(makeTIFF(2, 1, 1, 1, 1, Uint8Array.from([10, 200]), false));
  assert.deepEqual(Array.from(b.rgba), [10, 10, 10, 255, 200, 200, 200, 255]);
});

test('TIFF: LZW', () => {
  // Códigos MSB primero de 9 bits: Clear(256), 7, 7, 258 (7,7), EOI(257)
  const codes = [256, 7, 7, 258, 257];
  let bits = '';
  for (const c of codes) bits += c.toString(2).padStart(9, '0');
  while (bits.length % 8) bits += '0';
  const data = Uint8Array.from(bits.match(/.{8}/g).map(x => parseInt(x, 2)));
  const t = C.readTIFF(makeTIFF(4, 1, 1, 5, 1, data, true));
  assert.deepEqual(Array.from(t.rgba), [7, 7, 7, 255, 7, 7, 7, 255, 7, 7, 7, 255, 7, 7, 7, 255]);
});
