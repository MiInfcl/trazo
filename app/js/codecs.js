'use strict';
/* Trazo · códecs propios: ICO (varias resoluciones), BMP y GIF.
 * Sin DOM: recibe y devuelve bytes y píxeles RGBA. También se prueba con Node. */
(function (root) {
  const C = {};

  const isPNG = d => d.length > 24 && d[0] === 0x89 && d[1] === 0x50 && d[2] === 0x4E && d[3] === 0x47;
  C.isPNG = isPNG;
  const be32 = (d, o) => ((d[o] << 24) | (d[o + 1] << 16) | (d[o + 2] << 8) | d[o + 3]) >>> 0;

  /* ---------- ICO / CUR: lectura ----------
   * Devuelve { type: 1|2, entries: [{ w, h, bpp, png: Uint8Array|null, rgba: Uint8ClampedArray|null }] }
   * Las entradas PNG se devuelven sin decodificar (las decodifica el navegador). */
  C.readICO = function (bytes) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    if (bytes.length < 6) throw new Error('El archivo es demasiado corto para ser un icono.');
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const reserved = dv.getUint16(0, true), type = dv.getUint16(2, true), count = dv.getUint16(4, true);
    if (reserved !== 0 || (type !== 1 && type !== 2) || count === 0) throw new Error('No es un archivo ICO válido.');
    const entries = [];
    const errors = [];
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 16;
      if (o + 16 > bytes.length) break;
      const dw = bytes[o] || 256, dh = bytes[o + 1] || 256;
      const planes = dv.getUint16(o + 4, true), bitCount = dv.getUint16(o + 6, true);
      const size = dv.getUint32(o + 8, true), off = dv.getUint32(o + 12, true);
      if (size < 8 || off + size > bytes.length) { errors.push('Entrada ' + (i + 1) + ' fuera del archivo'); continue; }
      const data = bytes.subarray(off, off + size);
      const e = { w: dw, h: dh, bpp: bitCount, png: null, rgba: null, hotspot: type === 2 ? { x: planes, y: bitCount } : null };
      try {
        if (isPNG(data)) {
          e.png = data; e.w = be32(data, 16); e.h = be32(data, 20); e.bpp = 32;
        } else {
          const d = C.decodeDIB(data, dw, dh);
          e.rgba = d.rgba; e.w = d.w; e.h = d.h; e.bpp = d.bpp;
        }
        entries.push(e);
      } catch (err) {
        errors.push('Entrada ' + (i + 1) + ': ' + err.message);
      }
    }
    if (!entries.length) throw new Error('El icono no contiene imágenes legibles.' + (errors.length ? ' (' + errors[0] + ')' : ''));
    return { type, entries, errors };
  };

  /* DIB de icono: BITMAPINFOHEADER + paleta + XOR + máscara AND. */
  C.decodeDIB = function (d, dirW, dirH) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const hs = dv.getUint32(0, true);
    if (hs < 40 || hs > d.length) throw new Error('cabecera de mapa de bits no admitida');
    const w = dv.getInt32(4, true);
    let h2 = dv.getInt32(8, true);
    const bpp = dv.getUint16(14, true), comp = dv.getUint32(16, true);
    const clrUsed = dv.getUint32(32, true);
    const topDown = h2 < 0;
    h2 = Math.abs(h2);
    if (w <= 0 || h2 <= 0 || w > 4096 || h2 > 8192) throw new Error('dimensiones no válidas');
    if (comp !== 0 && comp !== 3) throw new Error('compresión no admitida');
    if ([1, 4, 8, 16, 24, 32].indexOf(bpp) < 0) throw new Error('profundidad de color no admitida');
    // La altura del DIB es el doble (imagen + máscara); algunos archivos rotos guardan la altura real.
    let h, hasMask = true;
    if (dirH && h2 === dirH * 2) h = dirH;
    else if (dirH && h2 === dirH && w === dirW) { h = dirH; hasMask = false; }
    else h = h2 >> 1;
    if (h <= 0) throw new Error('altura no válida');

    let p = hs;
    let rm = 0, gm = 0, bm = 0;
    if (comp === 3) {
      if (hs === 40) { rm = dv.getUint32(p, true); gm = dv.getUint32(p + 4, true); bm = dv.getUint32(p + 8, true); p += 12; }
      else { rm = dv.getUint32(40, true); gm = dv.getUint32(44, true); bm = dv.getUint32(48, true); }
    }
    let palette = null;
    if (bpp <= 8) {
      const n = clrUsed || (1 << bpp);
      palette = d.subarray(p, p + n * 4);
      p += n * 4;
    }
    const xorStride = ((w * bpp + 31) >> 5) << 2;
    const andStride = ((w + 31) >> 5) << 2;
    const xorSize = xorStride * h;
    if (p + xorSize > d.length) throw new Error('datos de imagen incompletos');
    if (p + xorSize + andStride * h > d.length) hasMask = false;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const shiftOf = m => { let s = 0; if (!m) return 0; while (!((m >> s) & 1)) s++; return s; };
    const scale = (v, m, s) => { const mx = m >>> s; return mx ? Math.round(((v & m) >>> s) * 255 / mx) : 0; };
    const rs = shiftOf(rm), gs = shiftOf(gm), bs = shiftOf(bm);
    let anyAlpha = false;
    for (let y = 0; y < h; y++) {
      const srcRow = p + (topDown ? y : h - 1 - y) * xorStride;
      let o = y * w * 4;
      for (let x = 0; x < w; x++, o += 4) {
        let r, g, b, a = 255;
        if (bpp === 32) {
          const q = srcRow + x * 4;
          if (comp === 3) {
            const v = dv.getUint32(q, true);
            r = scale(v, rm, rs); g = scale(v, gm, gs); b = scale(v, bm, bs); a = d[q + 3];
          } else { b = d[q]; g = d[q + 1]; r = d[q + 2]; a = d[q + 3]; }
          if (a) anyAlpha = true;
        } else if (bpp === 24) {
          const q = srcRow + x * 3; b = d[q]; g = d[q + 1]; r = d[q + 2];
        } else if (bpp === 16) {
          const v = dv.getUint16(srcRow + x * 2, true);
          if (comp === 3) { r = scale(v, rm, rs); g = scale(v, gm, gs); b = scale(v, bm, bs); }
          else { r = ((v >> 10) & 31) * 255 / 31; g = ((v >> 5) & 31) * 255 / 31; b = (v & 31) * 255 / 31; }
        } else {
          let idx;
          if (bpp === 8) idx = d[srcRow + x];
          else if (bpp === 4) idx = (x & 1) ? d[srcRow + (x >> 1)] & 15 : d[srcRow + (x >> 1)] >> 4;
          else idx = (d[srcRow + (x >> 3)] >> (7 - (x & 7))) & 1;
          const q = idx * 4;
          if (q + 2 < palette.length) { b = palette[q]; g = palette[q + 1]; r = palette[q + 2]; } else { r = g = b = 0; }
        }
        rgba[o] = r; rgba[o + 1] = g; rgba[o + 2] = b; rgba[o + 3] = a;
      }
    }
    // Transparencia: alfa propio (32 bits con algún alfa) o máscara AND.
    const useMask = hasMask && !(bpp === 32 && anyAlpha);
    if (useMask) {
      const mp = p + xorSize;
      for (let y = 0; y < h; y++) {
        const srcRow = mp + (topDown ? y : h - 1 - y) * andStride;
        for (let x = 0; x < w; x++) {
          const bit = (d[srcRow + (x >> 3)] >> (7 - (x & 7))) & 1;
          rgba[(y * w + x) * 4 + 3] = bit ? 0 : 255;
        }
      }
    } else if (bpp === 32 && !anyAlpha) {
      for (let i = 3; i < rgba.length; i += 4) rgba[i] = 255;
    }
    return { w, h, bpp, rgba };
  };

  /* ---------- ICO: escritura ----------
   * images: [{ w, h, rgba, png?: Uint8Array }]. Si trae png se guarda comprimido;
   * si no, como mapa de bits de 32 bits con máscara (máxima compatibilidad). */
  C.encodeDIB32 = function (im) {
    const w = im.w, h = im.h, src = im.rgba;
    const andStride = ((w + 31) >> 5) << 2;
    const xorSize = w * h * 4, andSize = andStride * h;
    const out = new Uint8Array(40 + xorSize + andSize);
    const dv = new DataView(out.buffer);
    dv.setUint32(0, 40, true);
    dv.setInt32(4, w, true);
    dv.setInt32(8, h * 2, true);
    dv.setUint16(12, 1, true);
    dv.setUint16(14, 32, true);
    dv.setUint32(16, 0, true);
    dv.setUint32(20, xorSize + andSize, true);
    let p = 40;
    for (let y = h - 1; y >= 0; y--) {
      let s = y * w * 4;
      for (let x = 0; x < w; x++, s += 4, p += 4) {
        out[p] = src[s + 2]; out[p + 1] = src[s + 1]; out[p + 2] = src[s]; out[p + 3] = src[s + 3];
      }
    }
    for (let y = h - 1; y >= 0; y--) {
      const rowStart = p;
      for (let x = 0; x < w; x++) {
        if (src[(y * w + x) * 4 + 3] === 0) out[rowStart + (x >> 3)] |= 0x80 >> (x & 7);
      }
      p += andStride;
    }
    return out;
  };

  C.writeICO = function (images) {
    if (!images.length) throw new Error('El icono necesita al menos una imagen.');
    for (const im of images) {
      if (im.w < 1 || im.h < 1 || im.w > 256 || im.h > 256) throw new Error('Cada imagen de un icono debe medir entre 1 y 256 píxeles por lado (hay una de ' + im.w + ' × ' + im.h + ').');
    }
    const blobs = images.map(im => (im.png ? im.png : C.encodeDIB32(im)));
    let off = 6 + 16 * images.length;
    const total = blobs.reduce((s, b) => s + b.length, off);
    const out = new Uint8Array(total);
    const dv = new DataView(out.buffer);
    dv.setUint16(0, 0, true); dv.setUint16(2, 1, true); dv.setUint16(4, images.length, true);
    images.forEach((im, i) => {
      const o = 6 + i * 16;
      out[o] = im.w >= 256 ? 0 : im.w;
      out[o + 1] = im.h >= 256 ? 0 : im.h;
      out[o + 2] = 0; out[o + 3] = 0;
      dv.setUint16(o + 4, 1, true);
      dv.setUint16(o + 6, 32, true);
      dv.setUint32(o + 8, blobs[i].length, true);
      dv.setUint32(o + 12, off, true);
      out.set(blobs[i], off);
      off += blobs[i].length;
    });
    return out;
  };

  /* ---------- BMP de 24 bits ---------- */
  C.writeBMP = function (rgba, w, h) {
    const stride = ((w * 24 + 31) >> 5) << 2;
    const size = 54 + stride * h;
    const out = new Uint8Array(size);
    const dv = new DataView(out.buffer);
    out[0] = 0x42; out[1] = 0x4D;
    dv.setUint32(2, size, true);
    dv.setUint32(10, 54, true);
    dv.setUint32(14, 40, true);
    dv.setInt32(18, w, true);
    dv.setInt32(22, h, true);
    dv.setUint16(26, 1, true);
    dv.setUint16(28, 24, true);
    dv.setUint32(34, stride * h, true);
    dv.setInt32(38, 3780, true); // 96 ppp
    dv.setInt32(42, 3780, true);
    for (let y = 0; y < h; y++) {
      let p = 54 + (h - 1 - y) * stride, s = y * w * 4;
      for (let x = 0; x < w; x++, s += 4, p += 3) {
        // lo transparente se mezcla sobre blanco
        const a = rgba[s + 3];
        if (a === 255) { out[p] = rgba[s + 2]; out[p + 1] = rgba[s + 1]; out[p + 2] = rgba[s]; }
        else {
          const k = 255 - a;
          out[p] = (rgba[s + 2] * a + 255 * k) / 255;
          out[p + 1] = (rgba[s + 1] * a + 255 * k) / 255;
          out[p + 2] = (rgba[s] * a + 255 * k) / 255;
        }
      }
    }
    return out;
  };

  /* ---------- Cuantización de color (corte por mediana) ---------- */
  C.quantize = function (rgba, maxColors) {
    const n = rgba.length >> 2;
    // 1) ¿Caben los colores exactos?
    const exact = new Map();
    let overflow = false;
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (rgba[o + 3] < 128) continue;
      const key = (rgba[o] << 16) | (rgba[o + 1] << 8) | rgba[o + 2];
      if (!exact.has(key)) {
        if (exact.size >= maxColors) { overflow = true; break; }
        exact.set(key, exact.size);
      }
    }
    if (!overflow) {
      const palette = new Uint8Array(exact.size * 3);
      for (const [key, idx] of exact) { palette[idx * 3] = key >> 16; palette[idx * 3 + 1] = (key >> 8) & 255; palette[idx * 3 + 2] = key & 255; }
      return { palette, count: exact.size, index: (r, g, b) => exact.get((r << 16) | (g << 8) | b) };
    }
    // 2) Histograma a 5 bits por canal y corte por mediana.
    const BINS = 32768;
    const cnt = new Uint32Array(BINS), sr = new Float64Array(BINS), sg = new Float64Array(BINS), sb = new Float64Array(BINS);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      if (rgba[o + 3] < 128) continue;
      const b = ((rgba[o] >> 3) << 10) | ((rgba[o + 1] >> 3) << 5) | (rgba[o + 2] >> 3);
      cnt[b]++; sr[b] += rgba[o]; sg[b] += rgba[o + 1]; sb[b] += rgba[o + 2];
    }
    const used = [];
    for (let b = 0; b < BINS; b++) if (cnt[b]) used.push(b);
    const mkBox = list => {
      let r0 = 31, r1 = 0, g0 = 31, g1 = 0, b0 = 31, b1 = 0, total = 0;
      for (const b of list) {
        const r = b >> 10, g = (b >> 5) & 31, bl = b & 31;
        if (r < r0) r0 = r; if (r > r1) r1 = r;
        if (g < g0) g0 = g; if (g > g1) g1 = g;
        if (bl < b0) b0 = bl; if (bl > b1) b1 = bl;
        total += cnt[b];
      }
      return { list, total, dr: r1 - r0, dg: g1 - g0, db: b1 - b0 };
    };
    let boxes = [mkBox(used)];
    while (boxes.length < maxColors) {
      let bi = -1, best = -1;
      for (let i = 0; i < boxes.length; i++) {
        const bx = boxes[i];
        if (bx.list.length < 2) continue;
        const score = Math.max(bx.dr, bx.dg, bx.db) * Math.log(bx.total + 1);
        if (score > best) { best = score; bi = i; }
      }
      if (bi < 0) break;
      const bx = boxes[bi];
      const ch = bx.dr >= bx.dg && bx.dr >= bx.db ? 10 : bx.dg >= bx.db ? 5 : 0;
      bx.list.sort((a, b) => ((a >> ch) & 31) - ((b >> ch) & 31));
      let acc = 0, cut = 0;
      const half = bx.total / 2;
      for (let i = 0; i < bx.list.length - 1; i++) { acc += cnt[bx.list[i]]; cut = i + 1; if (acc >= half) break; }
      boxes.splice(bi, 1, mkBox(bx.list.slice(0, cut)), mkBox(bx.list.slice(cut)));
    }
    const palette = new Uint8Array(boxes.length * 3);
    const binToIdx = new Int16Array(BINS).fill(-1);
    boxes.forEach((bx, i) => {
      let r = 0, g = 0, b = 0, t = 0;
      for (const bin of bx.list) { r += sr[bin]; g += sg[bin]; b += sb[bin]; t += cnt[bin]; binToIdx[bin] = i; }
      palette[i * 3] = Math.round(r / t); palette[i * 3 + 1] = Math.round(g / t); palette[i * 3 + 2] = Math.round(b / t);
    });
    return { palette, count: boxes.length, index: (r, g, b) => binToIdx[((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3)] };
  };

  /* ---------- GIF89a (un cuadro, con transparencia de 1 bit) ---------- */
  function lzw(indices, minCode) {
    const clear = 1 << minCode, eoi = clear + 1;
    let codeSize = minCode + 1, next = eoi + 1;
    const out = [];
    let cur = 0, curBits = 0;
    const emit = c => {
      cur |= c << curBits; curBits += codeSize;
      while (curBits >= 8) { out.push(cur & 255); cur >>>= 8; curBits -= 8; }
    };
    let dict = new Map();
    emit(clear);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i];
      const key = (prefix << 8) | k;
      const f = dict.get(key);
      if (f !== undefined) { prefix = f; continue; }
      emit(prefix);
      if (next === 4096) {
        emit(clear);
        next = eoi + 1; codeSize = minCode + 1; dict = new Map();
      } else {
        if (next >= (1 << codeSize)) codeSize++;
        dict.set(key, next++);
      }
      prefix = k;
    }
    emit(prefix);
    emit(eoi);
    if (curBits > 0) out.push(cur & 255);
    return out;
  }

  C.writeGIF = function (rgba, w, h) {
    const n = w * h;
    let hasAlpha = false;
    for (let i = 3; i < rgba.length; i += 4) if (rgba[i] < 128) { hasAlpha = true; break; }
    const q = C.quantize(rgba, hasAlpha ? 255 : 256);
    const colors = q.count + (hasAlpha ? 1 : 0);
    let bits = 1;
    while ((1 << bits) < colors) bits++;
    const tableSize = 1 << bits;
    const tIdx = hasAlpha ? q.count : 0;
    const indices = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const o = i * 4;
      indices[i] = rgba[o + 3] < 128 ? tIdx : q.index(rgba[o], rgba[o + 1], rgba[o + 2]);
    }
    const minCode = Math.max(2, bits);
    const data = lzw(indices, minCode);
    const out = [];
    const push16 = v => { out.push(v & 255, (v >> 8) & 255); };
    for (const ch of 'GIF89a') out.push(ch.charCodeAt(0));
    push16(w); push16(h);
    out.push(0x80 | ((bits - 1) << 4) | (bits - 1), 0, 0);
    for (let i = 0; i < tableSize; i++) {
      if (i < q.count) out.push(q.palette[i * 3], q.palette[i * 3 + 1], q.palette[i * 3 + 2]);
      else out.push(0, 0, 0);
    }
    if (hasAlpha) out.push(0x21, 0xF9, 0x04, 0x01, 0, 0, tIdx, 0);
    out.push(0x2C); push16(0); push16(0); push16(w); push16(h); out.push(0);
    out.push(minCode);
    for (let i = 0; i < data.length; i += 255) {
      const len = Math.min(255, data.length - i);
      out.push(len);
      for (let j = 0; j < len; j++) out.push(data[i + j]);
    }
    out.push(0, 0x3B);
    return new Uint8Array(out);
  };

  /* ---------- TIFF ----------
   * Escribe RGBA de 8 bits sin compresión. Lee lo habitual: sin compresión, PackBits y LZW;
   * escala de grises, RGB(A) y paleta a 8 bits (y 1 bit en blanco y negro). */
  C.writeTIFF = function (rgba, w, h) {
    const tags = 12, ifd = 8, valuesAt = ifd + 2 + tags * 12 + 4, bitsAt = valuesAt, dataAt = valuesAt + 8;
    const size = w * h * 4;
    const out = new Uint8Array(dataAt + size);
    const dv = new DataView(out.buffer);
    out[0] = 0x49; out[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, ifd, true);
    dv.setUint16(ifd, tags, true);
    const entries = [
      [256, 4, 1, w], [257, 4, 1, h], [258, 3, 4, bitsAt], [259, 3, 1, 1], [262, 3, 1, 2], [273, 4, 1, dataAt],
      [277, 3, 1, 4], [278, 4, 1, h], [279, 4, 1, size], [284, 3, 1, 1], [305, 2, 4, 0x00617254], [338, 3, 1, 2]
    ];
    entries.forEach((e, i) => {
      const o = ifd + 2 + i * 12;
      dv.setUint16(o, e[0], true); dv.setUint16(o + 2, e[1], true); dv.setUint32(o + 4, e[2], true); dv.setUint32(o + 8, e[3], true);
    });
    for (let i = 0; i < 4; i++) dv.setUint16(bitsAt + i * 2, 8, true);
    out.set(rgba, dataAt);
    return out;
  };

  function tiffLZW(src, expected) {
    const out = new Uint8Array(expected);
    let op = 0, bit = 0, width = 9, next = 258, prev = null;
    let table = [];
    const reset = () => { table = []; for (let i = 0; i < 256; i++) table[i] = [i]; next = 258; width = 9; };
    reset();
    const total = src.length * 8;
    while (bit + width <= total && op < expected) {
      let code = 0;
      for (let i = 0; i < width; i++) code = (code << 1) | ((src[(bit + i) >> 3] >> (7 - ((bit + i) & 7))) & 1);
      bit += width;
      if (code === 257) break;
      if (code === 256) { reset(); prev = null; continue; }
      let entry;
      if (prev === null) entry = table[code];
      else if (code < next && table[code]) entry = table[code];
      else if (code === next) entry = prev.concat(prev[0]);
      else throw new Error('datos LZW no válidos');
      for (let i = 0; i < entry.length && op < expected; i++) out[op++] = entry[i];
      if (prev !== null && next < 4096) table[next++] = prev.concat(entry[0]);
      if (next >= 2047) width = 12; else if (next >= 1023) width = 11; else if (next >= 511) width = 10;
      prev = entry;
    }
    return out;
  }
  function packBits(src, expected) {
    const out = new Uint8Array(expected);
    let i = 0, o = 0;
    while (i < src.length && o < expected) {
      const n = (src[i++] << 24) >> 24;
      if (n >= 0) { for (let k = 0; k <= n && o < expected; k++) out[o++] = src[i++]; }
      else if (n !== -128) { const v = src[i++]; for (let k = 0; k <= -n && o < expected; k++) out[o++] = v; }
    }
    return out;
  }

  C.readTIFF = function (bytes) {
    const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const le = bytes[0] === 0x49;
    if (!(le || bytes[0] === 0x4D) || dv.getUint16(2, le) !== 42) throw new Error('No es un archivo TIFF válido.');
    const ifd = dv.getUint32(4, le), n = dv.getUint16(ifd, le);
    const SZ = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1 };
    const tag = {};
    for (let i = 0; i < n; i++) {
      const o = ifd + 2 + i * 12, id = dv.getUint16(o, le), type = dv.getUint16(o + 2, le), count = dv.getUint32(o + 4, le);
      const sz = (SZ[type] || 1) * count;
      const at = sz <= 4 ? o + 8 : dv.getUint32(o + 8, le);
      const vals = [];
      for (let k = 0; k < count && k < 200000; k++) {
        const p = at + k * (SZ[type] || 1);
        vals.push(type === 3 ? dv.getUint16(p, le) : type === 4 ? dv.getUint32(p, le) : bytes[p]);
      }
      tag[id] = vals;
    }
    const w = tag[256][0], h = tag[257][0];
    const bits = (tag[258] || [1])[0], comp = (tag[259] || [1])[0], photo = (tag[262] || [1])[0];
    const spp = (tag[277] || [1])[0], rps = (tag[278] || [h])[0], pred = (tag[317] || [1])[0];
    const planar = (tag[284] || [1])[0];
    if (planar !== 1) throw new Error('TIFF con planos separados no admitido.');
    if (bits !== 8 && !(bits === 1 && spp === 1)) throw new Error('TIFF de ' + bits + ' bits no admitido.');
    if (comp !== 1 && comp !== 5 && comp !== 32773) throw new Error('Compresión TIFF no admitida.');
    if (tag[322]) throw new Error('TIFF por mosaicos no admitido.');
    const offs = tag[273], counts = tag[279];
    const stride = bits === 1 ? (w + 7) >> 3 : w * spp;
    const rgba = new Uint8ClampedArray(w * h * 4);
    const pal = tag[320];
    let y = 0;
    for (let s = 0; s < offs.length && y < h; s++) {
      const rows = Math.min(rps, h - y), expected = rows * stride;
      const raw = bytes.subarray(offs[s], offs[s] + counts[s]);
      const d = comp === 1 ? raw : comp === 5 ? tiffLZW(raw, expected) : packBits(raw, expected);
      for (let r = 0; r < rows; r++, y++) {
        const start = r * stride;
        if (pred === 2 && bits === 8) for (let i = spp; i < stride; i++) d[start + i] = (d[start + i] + d[start + i - spp]) & 255;
        for (let x = 0; x < w; x++) {
          const o = (y * w + x) * 4;
          if (bits === 1) {
            const b = (d[start + (x >> 3)] >> (7 - (x & 7))) & 1;
            const v = (photo === 0 ? !b : b) ? 255 : 0;
            rgba[o] = rgba[o + 1] = rgba[o + 2] = v; rgba[o + 3] = 255;
            continue;
          }
          const p = start + x * spp;
          if (photo === 3 && pal) {
            const q = d[p], m = pal.length / 3;
            rgba[o] = pal[q] >> 8; rgba[o + 1] = pal[m + q] >> 8; rgba[o + 2] = pal[2 * m + q] >> 8; rgba[o + 3] = 255;
          } else if (photo === 2) {
            rgba[o] = d[p]; rgba[o + 1] = d[p + 1]; rgba[o + 2] = d[p + 2]; rgba[o + 3] = spp >= 4 ? d[p + 3] : 255;
          } else if (photo === 0 || photo === 1) {
            const v = photo === 0 ? 255 - d[p] : d[p];
            rgba[o] = rgba[o + 1] = rgba[o + 2] = v; rgba[o + 3] = spp >= 2 ? d[p + 1] : 255;
          } else throw new Error('Espacio de color TIFF no admitido.');
        }
      }
    }
    return { w, h, rgba };
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else { root.T = root.T || {}; root.T.codecs = C; }
})(typeof window !== 'undefined' ? window : globalThis);
