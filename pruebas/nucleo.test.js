'use strict';
/* Pruebas del núcleo sin navegador: node --test pruebas/ */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const V = require(path.join(__dirname, '..', 'app', 'js', 'vec.js'));
const C = require(path.join(__dirname, '..', 'app', 'js', 'codecs.js'));

/* Generador determinista. */
function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

/* Rasteriza un d rectilíneo (M/h/v/z) con la regla par-impar para comprobar el trazado. */
function rasterPath(d, w, h) {
  const loops = [];
  const re = /([Mhvz])\s*(-?\d+)?(?:\s+(-?\d+))?/g;
  let m, cur = null, x = 0, y = 0;
  while ((m = re.exec(d))) {
    const c = m[1];
    if (c === 'M') { x = +m[2]; y = +m[3]; cur = [[x, y]]; loops.push(cur); }
    else if (c === 'h') { x += +m[2]; cur.push([x, y]); }
    else if (c === 'v') { y += +m[2]; cur.push([x, y]); }
  }
  const out = new Uint8Array(w * h);
  for (let py = 0; py < h; py++) {
    for (let px = 0; px < w; px++) {
      const cx = px + 0.5, cy = py + 0.5;
      let inside = false;
      for (const lp of loops) {
        for (let i = 0; i < lp.length; i++) {
          const a = lp[i], b = lp[(i + 1) % lp.length];
          if (a[0] === b[0] && ((a[1] > cy) !== (b[1] > cy)) && a[0] > cx) inside = !inside;
        }
      }
      out[py * w + px] = inside ? 1 : 0;
    }
  }
  return out;
}

/* Número de vueltas (regla no-cero) para comprobar la orientación de los agujeros. */
function windingAt(d, cx, cy) {
  const re = /([Mhvz])\s*(-?\d+)?(?:\s+(-?\d+))?/g;
  let m, x = 0, y = 0, sx = 0, sy = 0, wn = 0;
  const seg = (x0, y0, x1, y1) => {
    if (x0 !== x1 || x0 <= cx) return;
    if (y0 <= cy && y1 > cy) wn++;
    else if (y0 > cy && y1 <= cy) wn--;
  };
  while ((m = re.exec(d))) {
    const c = m[1];
    if (c === 'M') { x = sx = +m[2]; y = sy = +m[3]; }
    else if (c === 'h') { x += +m[2]; }
    else if (c === 'v') { const ny = y + (+m[2]); seg(x, y, x, ny); y = ny; }
    else if (c === 'z') { seg(x, y, sx, sy); x = sx; y = sy; }
  }
  return wn;
}

test('traceMask: un píxel', () => {
  assert.equal(V.traceMask(new Uint8Array([1]), 1, 1), 'M0 0h1v1h-1z');
  assert.equal(V.traceMask(new Uint8Array([0]), 1, 1), '');
});

test('traceMask: desplazamiento', () => {
  assert.equal(V.traceMask(new Uint8Array([1, 1]), 2, 1, 10, 20), 'M10 20h2v1h-2z');
});

test('traceMask: anillo con agujero (no-cero y par-impar)', () => {
  const m = new Uint8Array([1, 1, 1, 1, 0, 1, 1, 1, 1]);
  const d = V.traceMask(m, 3, 3);
  assert.deepEqual(Array.from(rasterPath(d, 3, 3)), Array.from(m));
  assert.equal(windingAt(d, 1.5, 1.5), 0, 'el agujero debe anular la vuelta');
  assert.notEqual(windingAt(d, 0.5, 0.5), 0);
});

test('traceMask: máscaras aleatorias se reconstruyen exactas', () => {
  const r = rng(7);
  for (let t = 0; t < 150; t++) {
    const w = 1 + Math.floor(r() * 18), h = 1 + Math.floor(r() * 18);
    const m = new Uint8Array(w * h);
    const dens = r();
    for (let i = 0; i < m.length; i++) m[i] = r() < dens ? 1 : 0;
    const d = V.traceMask(m, w, h);
    assert.deepEqual(Array.from(rasterPath(d, w, h)), Array.from(m), 'par-impar ' + w + 'x' + h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const wn = windingAt(d, x + 0.5, y + 0.5);
      assert.equal(wn !== 0, m[y * w + x] === 1, 'no-cero en ' + x + ',' + y);
    }
  }
});

test('rdp: conserva extremos y quita puntos alineados', () => {
  const pts = [];
  for (let i = 0; i <= 10; i++) pts.push({ x: i, y: 0 });
  pts.push({ x: 10, y: 5 });
  const s = V.rdp(pts, 0.1);
  assert.deepEqual(s, [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 }]);
  assert.equal(V.rdp([{ x: 1, y: 1 }], 1).length, 1);
});

test('serialize: borrar envuelve lo anterior en una máscara; wrap recorta y transforma', () => {
  const cx = { defs: [], n: 0, uid() { return 'id' + (++this.n); }, png: () => 'data:x', embed: () => '<svg/>' };
  const vec = [V.raw('<a/>'), V.eraseRect(1, 2, 3, 4, 10, 10), V.eraseRect(5, 5, 1, 1, 10, 10), V.raw('<b/>'),
    V.wrap('matrix(1 0 0 1 2 3)', { x: 0, y: 0, w: 5, h: 5 })];
  const s = V.serialize(vec, cx);
  assert.equal(cx.defs.length, 2, 'dos borrados seguidos comparten una máscara');
  assert.match(s, /^<g transform="matrix\(1 0 0 1 2 3\)"><g clip-path="url\(#id2\)"><g mask="url\(#id1\)"><a\/><\/g><b\/><\/g><\/g>$/);
});

test('autoPatch: funde parches cercanos', () => {
  const px = r => ({ tag: r.x + ',' + r.y + ',' + r.w + ',' + r.h });
  let v = V.autoPatch(V.EMPTY, { x: 0, y: 0, w: 10, h: 10 }, 100, 100, px);
  v = V.autoPatch(v, { x: 5, y: 5, w: 10, h: 10 }, 100, 100, px);
  assert.equal(v.length, 1);
  assert.equal(v[0].im.tag, '0,0,15,15');
  v = V.autoPatch(v, { x: 5000, y: 5000, w: 400, h: 400 }, 9000, 9000, px);
  assert.equal(v.length, 2, 'uno lejano y grande no se funde');
});

function randomImage(w, h, r, alphaMode) {
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    rgba[i * 4] = Math.floor(r() * 256); rgba[i * 4 + 1] = Math.floor(r() * 256); rgba[i * 4 + 2] = Math.floor(r() * 256);
    rgba[i * 4 + 3] = alphaMode === 'opaque' ? 255 : alphaMode === 'binary' ? (r() < 0.5 ? 0 : 255) : Math.floor(r() * 256);
  }
  return { w, h, rgba };
}

test('ICO: ida y vuelta con varias resoluciones (32 bits con alfa)', () => {
  const r = rng(11);
  const imgs = [randomImage(16, 16, r), randomImage(32, 32, r), randomImage(48, 48, r), randomImage(20, 24, r), randomImage(256, 256, r)];
  const bytes = C.writeICO(imgs);
  const ico = C.readICO(bytes);
  assert.equal(ico.type, 1);
  assert.equal(ico.entries.length, imgs.length);
  ico.entries.forEach((e, i) => {
    assert.equal(e.w, imgs[i].w); assert.equal(e.h, imgs[i].h); assert.equal(e.bpp, 32);
    // píxeles con alfa 0 pueden diferir en RGB solo si el lector los normaliza; aquí deben ser idénticos
    assert.deepEqual(Buffer.from(e.rgba.buffer), Buffer.from(imgs[i].rgba.buffer));
  });
  // 256 se guarda como 0 en el directorio
  assert.equal(bytes[6 + 16 * 4], 0);
});

test('ICO: una entrada PNG se conserva tal cual', () => {
  const png = new Uint8Array(40);
  png.set([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1, 0, 0, 0, 1, 0]);
  const r = rng(3);
  const bytes = C.writeICO([{ w: 256, h: 256, png }, randomImage(16, 16, r)]);
  const ico = C.readICO(bytes);
  assert.equal(ico.entries[0].w, 256);
  assert.equal(ico.entries[0].h, 256);
  assert.deepEqual(Array.from(ico.entries[0].png), Array.from(png));
  assert.ok(ico.entries[1].rgba);
});

test('ICO: rechaza tamaños fuera de 1..256 y archivos que no son iconos', () => {
  assert.throws(() => C.writeICO([{ w: 300, h: 300, rgba: new Uint8ClampedArray(300 * 300 * 4) }]), /256/);
  assert.throws(() => C.readICO(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])), /ICO/);
  assert.throws(() => C.readICO(new Uint8Array(3)), /corto/);
});

/* Construye a mano un DIB de icono con paleta para probar 1, 4 y 8 bits y la máscara AND. */
function paletteDIB(w, h, bpp, indices, palette, maskBits) {
  const xorStride = ((w * bpp + 31) >> 5) << 2, andStride = ((w + 31) >> 5) << 2;
  const n = 1 << bpp;
  const buf = new Uint8Array(40 + n * 4 + xorStride * h + andStride * h);
  const dv = new DataView(buf.buffer);
  dv.setUint32(0, 40, true); dv.setInt32(4, w, true); dv.setInt32(8, h * 2, true);
  dv.setUint16(12, 1, true); dv.setUint16(14, bpp, true);
  for (let i = 0; i < palette.length; i++) { buf[40 + i * 4] = palette[i][2]; buf[41 + i * 4] = palette[i][1]; buf[42 + i * 4] = palette[i][0]; }
  const xo = 40 + n * 4;
  for (let y = 0; y < h; y++) {
    const row = xo + (h - 1 - y) * xorStride;
    for (let x = 0; x < w; x++) {
      const v = indices[y * w + x];
      if (bpp === 8) buf[row + x] = v;
      else if (bpp === 4) buf[row + (x >> 1)] |= (x & 1) ? v : v << 4;
      else buf[row + (x >> 3)] |= v << (7 - (x & 7));
    }
  }
  const ao = xo + xorStride * h;
  for (let y = 0; y < h; y++) {
    const row = ao + (h - 1 - y) * andStride;
    for (let x = 0; x < w; x++) if (maskBits[y * w + x]) buf[row + (x >> 3)] |= 0x80 >> (x & 7);
  }
  return buf;
}

test('ICO: lee mapas de bits con paleta de 1, 4 y 8 bits y su máscara', () => {
  const r = rng(5);
  for (const bpp of [1, 4, 8]) {
    const w = 10, h = 7, n = 1 << bpp;
    const palette = [];
    for (let i = 0; i < n; i++) palette.push([Math.floor(r() * 256), Math.floor(r() * 256), Math.floor(r() * 256)]);
    const indices = [], mask = [];
    for (let i = 0; i < w * h; i++) { indices.push(Math.floor(r() * n)); mask.push(r() < 0.3 ? 1 : 0); }
    const dib = paletteDIB(w, h, bpp, indices, palette, mask);
    // envolver en un ICO
    const file = new Uint8Array(22 + dib.length);
    const dv = new DataView(file.buffer);
    dv.setUint16(2, 1, true); dv.setUint16(4, 1, true);
    file[6] = w; file[7] = h; dv.setUint16(10, 1, true); dv.setUint16(12, bpp, true);
    dv.setUint32(14, dib.length, true); dv.setUint32(18, 22, true);
    file.set(dib, 22);
    const e = C.readICO(file).entries[0];
    assert.equal(e.w, w); assert.equal(e.h, h);
    for (let i = 0; i < w * h; i++) {
      const p = palette[indices[i]];
      assert.deepEqual([e.rgba[i * 4], e.rgba[i * 4 + 1], e.rgba[i * 4 + 2], e.rgba[i * 4 + 3]], [p[0], p[1], p[2], mask[i] ? 0 : 255], bpp + ' bits, píxel ' + i);
    }
  }
});

test('BMP: cabecera, relleno de filas y orden BGR de abajo arriba', () => {
  const w = 3, h = 2;
  const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 10, 20, 30, 255, 0, 0, 0, 0, 255, 255, 255, 255]);
  const b = C.writeBMP(rgba, w, h);
  assert.equal(b[0], 0x42); assert.equal(b[1], 0x4D);
  const dv = new DataView(b.buffer);
  assert.equal(dv.getUint32(2, true), b.length);
  assert.equal(dv.getInt32(18, true), 3); assert.equal(dv.getInt32(22, true), 2);
  assert.equal(b.length, 54 + 12 * 2);
  // primera fila guardada = última de la imagen: (10,20,30), transparente→blanco, blanco
  assert.deepEqual(Array.from(b.subarray(54, 54 + 9)), [30, 20, 10, 255, 255, 255, 255, 255, 255]);
  assert.deepEqual(Array.from(b.subarray(66, 66 + 9)), [0, 0, 255, 0, 255, 0, 255, 0, 0]);
});

/* Decodificador GIF mínimo para verificar el codificador. */
function decodeGIF(b) {
  assert.equal(String.fromCharCode(...b.subarray(0, 6)), 'GIF89a');
  const w = b[6] | (b[7] << 8), h = b[8] | (b[9] << 8);
  const bits = (b[10] & 7) + 1;
  let p = 13;
  const pal = b.subarray(p, p + 3 * (1 << bits)); p += 3 * (1 << bits);
  let trans = -1;
  if (b[p] === 0x21) { assert.equal(b[p + 1], 0xF9); trans = b[p + 6]; p += 8; }
  assert.equal(b[p], 0x2C); p += 10;
  const minCode = b[p++];
  const data = [];
  while (b[p]) { const len = b[p++]; for (let i = 0; i < len; i++) data.push(b[p++]); }
  assert.equal(b[p + 1], 0x3B);
  const clear = 1 << minCode, eoi = clear + 1;
  let codeSize = minCode + 1, dict = [], next = eoi + 1;
  const reset = () => { dict = []; for (let i = 0; i < clear; i++) dict[i] = [i]; dict[clear] = []; dict[eoi] = null; next = eoi + 1; codeSize = minCode + 1; };
  reset();
  const out = [];
  let bitPos = 0, prev = null;
  const read = () => {
    let v = 0;
    for (let i = 0; i < codeSize; i++) { v |= ((data[bitPos >> 3] >> (bitPos & 7)) & 1) << i; bitPos++; }
    return v;
  };
  for (;;) {
    const code = read();
    if (code === clear) { reset(); prev = null; continue; }
    if (code === eoi) break;
    let entry;
    if (code < next && dict[code]) entry = dict[code];
    else if (code === next && prev) entry = prev.concat(prev[0]);
    else throw new Error('código LZW inválido ' + code);
    for (const v of entry) out.push(v);
    if (prev && next < 4096) { dict[next++] = prev.concat(entry[0]); if (next === (1 << codeSize) && codeSize < 12) codeSize++; }
    prev = entry;
  }
  return { w, h, pal, trans, indices: out };
}

test('GIF: pocos colores se guardan exactos, con transparencia', () => {
  const r = rng(21);
  const w = 40, h = 30;
  const cols = [[255, 0, 0], [0, 255, 0], [0, 0, 255], [12, 34, 56], [255, 255, 255]];
  const rgba = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) {
    const c = cols[Math.floor(r() * cols.length)];
    rgba[i * 4] = c[0]; rgba[i * 4 + 1] = c[1]; rgba[i * 4 + 2] = c[2]; rgba[i * 4 + 3] = r() < 0.2 ? 0 : 255;
  }
  const g = decodeGIF(C.writeGIF(rgba, w, h));
  assert.equal(g.w, w); assert.equal(g.h, h); assert.equal(g.indices.length, w * h);
  for (let i = 0; i < w * h; i++) {
    const idx = g.indices[i];
    if (rgba[i * 4 + 3] === 0) assert.equal(idx, g.trans);
    else assert.deepEqual([g.pal[idx * 3], g.pal[idx * 3 + 1], g.pal[idx * 3 + 2]], [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]]);
  }
});

test('GIF: muchos colores se cuantizan a 256 y el flujo LZW es válido (tabla llena incluida)', () => {
  const r = rng(99);
  const img = randomImage(160, 120, r, 'opaque');
  const g = decodeGIF(C.writeGIF(img.rgba, img.w, img.h));
  assert.equal(g.indices.length, img.w * img.h);
  assert.equal(g.trans, -1);
  let err = 0;
  for (let i = 0; i < img.w * img.h; i++) {
    const idx = g.indices[i];
    err += Math.abs(g.pal[idx * 3] - img.rgba[i * 4]) + Math.abs(g.pal[idx * 3 + 1] - img.rgba[i * 4 + 1]) + Math.abs(g.pal[idx * 3 + 2] - img.rgba[i * 4 + 2]);
  }
  assert.ok(err / (img.w * img.h * 3) < 40, 'error medio por canal razonable: ' + (err / (img.w * img.h * 3)));
});

test('GIF: imagen de un solo color', () => {
  const rgba = new Uint8ClampedArray(8 * 8 * 4).fill(255);
  const g = decodeGIF(C.writeGIF(rgba, 8, 8));
  assert.equal(g.indices.length, 64);
  assert.ok(g.indices.every(v => v === 0));
});
