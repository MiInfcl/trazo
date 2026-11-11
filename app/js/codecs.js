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

  /* ---------- Proyecto de Paint (.paint) ----------
   * Contenedor HEIF/MIAF: cada capa es un elemento «unci» (ISO 23001-17) comprimido con DEFLATE
   * y un elemento «iovl» las superpone. Microsoft no publicó el formato: el lector es tolerante
   * (respeta lo que declara el archivo) y el escritor reproduce la disposición que genera Paint. */
  const ascii = (d, o, n) => String.fromCharCode.apply(null, d.subarray(o, o + n));

  async function inflate(bytes, format, expected) {
    const ds = new DecompressionStream(format);
    const w = ds.writable.getWriter();
    w.write(bytes).catch(() => {});
    w.close().catch(() => {});
    const r = ds.readable.getReader();
    const out = new Uint8Array(expected);
    let p = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      if (p + value.length > expected) { r.cancel().catch(() => {}); throw new Error('una capa tiene más datos de los declarados'); }
      out.set(value, p);
      p += value.length;
    }
    if (p !== expected) throw new Error('una capa tiene menos datos de los declarados');
    return out;
  }
  async function deflateRaw(bytes) {
    const cs = new CompressionStream('deflate-raw');
    const w = cs.writable.getWriter();
    w.write(bytes).catch(() => {});
    w.close().catch(() => {});
    const r = cs.readable.getReader(), parts = [];
    let total = 0;
    for (;;) {
      const { done, value } = await r.read();
      if (done) break;
      parts.push(value);
      total += value.length;
    }
    const out = new Uint8Array(total);
    let p = 0;
    for (const v of parts) { out.set(v, p); p += v.length; }
    return out;
  }

  C.isPaint = d => d.length > 16 && ascii(d, 4, 4) === 'ftyp' && ['mif1', 'miaf'].includes(ascii(d, 8, 4));

  /* Devuelve { w, h, fill: [r, g, b, a], layers: [{ x, y, w, h, rgba }] } de abajo arriba. */
  C.readPaint = async function (bytes) {
    try {
      return await parsePaint(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
    } catch (e) {
      if (e instanceof RangeError || e instanceof TypeError) throw new Error('El archivo .paint está dañado.');
      throw e;
    }
  };

  async function parsePaint(d) {
    const dv = new DataView(d.buffer, d.byteOffset, d.byteLength);
    const u16 = o => dv.getUint16(o), u32 = o => dv.getUint32(o);
    const un = (o, n) => (n === 0 ? 0 : n === 4 ? u32(o) : n === 8 ? u32(o) * 4294967296 + u32(o + 4) : (() => { throw new Error('El archivo .paint usa tamaños no admitidos.'); })());
    function boxes(a, b) {
      const out = [];
      while (a + 8 <= b) {
        let n = u32(a), h = 8;
        const t = ascii(d, a + 4, 4);
        if (n === 1) { n = un(a + 8, 8); h = 16; } else if (n === 0) n = b - a;
        if (n < h || a + n > b) throw new Error('El archivo .paint está dañado o incompleto.');
        out.push({ t, a: a + h, b: a + n });
        a += n;
      }
      return out;
    }
    const find = (list, t) => list.find(x => x.t === t);
    const top = boxes(0, d.length);
    const ftyp = find(top, 'ftyp'), metaBox = find(top, 'meta');
    if (!ftyp || !metaBox) throw new Error('No es un proyecto .paint válido.');
    const meta = boxes(metaBox.a + 4, metaBox.b);
    for (const need of ['pitm', 'iinf', 'iloc', 'iprp']) if (!find(meta, need)) throw new Error('No es un proyecto .paint válido.');

    const pb = find(meta, 'pitm');
    const primary = d[pb.a] === 0 ? u16(pb.a + 4) : u32(pb.a + 4);

    /* Tipos de elemento */
    const types = new Map();
    const ib = find(meta, 'iinf'), ic = d[ib.a] === 0 ? 6 : 8;
    for (const e of boxes(ib.a + ic, ib.b)) {
      if (e.t !== 'infe') continue;
      const v = d[e.a];
      if (v === 2) types.set(u16(e.a + 4), ascii(d, e.a + 8, 4));
      else if (v === 3) types.set(u32(e.a + 4), ascii(d, e.a + 10, 4));
    }

    /* Ubicación de los datos */
    const idat = find(meta, 'idat');
    const locs = new Map();
    {
      const l = find(meta, 'iloc'), v = d[l.a];
      let p = l.a + 4;
      const offS = d[p] >> 4, lenS = d[p] & 15, baseS = d[p + 1] >> 4, idxS = v > 0 ? d[p + 1] & 15 : 0;
      p += 2;
      const count = v < 2 ? u16(p) : u32(p);
      p += v < 2 ? 2 : 4;
      for (let i = 0; i < count; i++) {
        const id = v < 2 ? u16(p) : u32(p);
        p += v < 2 ? 2 : 4;
        let cm = 0;
        if (v > 0) { cm = u16(p) & 15; p += 2; }
        p += 2; // índice de referencia de datos
        const base = un(p, baseS);
        p += baseS;
        const ec = u16(p);
        p += 2;
        const ext = [];
        for (let k = 0; k < ec; k++) {
          p += idxS;
          const off = un(p, offS); p += offS;
          const len = un(p, lenS); p += lenS;
          ext.push({ off: base + off, len });
        }
        locs.set(id, { cm, ext });
      }
    }
    function itemBytes(id) {
      const loc = locs.get(id);
      if (!loc || loc.cm > 1 || (loc.cm === 1 && !idat)) throw new Error('El archivo .paint usa una ubicación de datos no admitida.');
      const start = loc.cm === 1 ? idat.a : 0, end = loc.cm === 1 ? idat.b : d.length;
      let total = 0;
      for (const e of loc.ext) {
        if (e.off < 0 || start + e.off + e.len > end) throw new Error('El archivo .paint está dañado o incompleto.');
        total += e.len;
      }
      if (loc.ext.length === 1) return d.subarray(start + loc.ext[0].off, start + loc.ext[0].off + total);
      const out = new Uint8Array(total);
      let p = 0;
      for (const e of loc.ext) { out.set(d.subarray(start + e.off, start + e.off + e.len), p); p += e.len; }
      return out;
    }

    /* Propiedades */
    const iprp = boxes(find(meta, 'iprp').a, find(meta, 'iprp').b);
    const ipco = find(iprp, 'ipco'), ipma = find(iprp, 'ipma');
    if (!ipco || !ipma) throw new Error('No es un proyecto .paint válido.');
    const propList = boxes(ipco.a, ipco.b);
    const assoc = new Map();
    {
      const v = d[ipma.a], wide = dv.getUint32(ipma.a) & 1;
      let p = ipma.a + 4;
      const count = u32(p);
      p += 4;
      for (let i = 0; i < count; i++) {
        const id = v < 1 ? u16(p) : u32(p);
        p += v < 1 ? 2 : 4;
        const n = d[p++], list = [];
        for (let k = 0; k < n; k++) {
          const idx = wide ? u16(p) & 0x7fff : d[p] & 0x7f;
          p += wide ? 2 : 1;
          if (idx > 0) { if (idx > propList.length) throw new Error('El archivo .paint está dañado.'); list.push(propList[idx - 1]); }
        }
        assoc.set(id, list);
      }
    }

    /* Referencias: qué capas forman la superposición */
    let inputs = [];
    const ir = find(meta, 'iref');
    if (ir) {
      const v = d[ir.a];
      for (const r of boxes(ir.a + 4, ir.b)) {
        if (r.t !== 'dimg') continue;
        let p = r.a;
        const from = v === 0 ? u16(p) : u32(p);
        p += v === 0 ? 2 : 4;
        if (from !== primary) continue;
        const n = u16(p);
        p += 2;
        for (let i = 0; i < n; i++) { inputs.push(v === 0 ? u16(p) : u32(p)); p += v === 0 ? 2 : 4; }
      }
    }

    function decodeInfo(id) {
      const props = assoc.get(id) || [];
      const ispe = find(props, 'ispe'), unc = find(props, 'uncC'), cmpd = find(props, 'cmpd'), cmpC = find(props, 'cmpC');
      if (!ispe || !unc) throw new Error('Una capa del .paint no declara su formato.');
      const w = u32(ispe.a + 4), h = u32(ispe.a + 8);
      if (!w || !h || w > 30000 || h > 30000 || w * h > 268435456) throw new Error('Una capa del .paint tiene dimensiones no admitidas.');
      const CH = { 4: 0, 5: 1, 6: 2, 7: 3 };
      let order;
      if (d[unc.a] === 1) {
        const profile = ascii(d, unc.a + 4, 4);
        order = { rgb3: [0, 1, 2], rgba: [0, 1, 2, 3], abgr: [3, 2, 1, 0] }[profile];
        if (!order) throw new Error('El .paint usa un perfil de color no admitido: ' + profile);
      } else {
        if (!cmpd) throw new Error('Una capa del .paint no declara sus canales.');
        const nc = u32(cmpd.a), kinds = [];
        for (let i = 0; i < nc; i++) kinds.push(u16(cmpd.a + 4 + i * 2));
        let p = unc.a + 8;
        const count = u32(p);
        p += 4;
        order = [];
        for (let i = 0; i < count; i++) {
          const idx = u16(p), depth = d[p + 2] + 1, fmt = d[p + 3];
          p += 5;
          if (depth !== 8 || fmt !== 0 || !(kinds[idx] in CH)) throw new Error('El .paint usa un formato de píxel no admitido.');
          order.push(CH[kinds[idx]]);
        }
        const sampling = d[p], interleave = d[p + 1], pixelSize = u32(p + 4), rowAlign = u32(p + 8), cols = u32(p + 16), rows = u32(p + 20);
        if (sampling !== 0 || interleave !== 1 || (pixelSize && pixelSize !== count) || rowAlign > 1 || cols || rows) throw new Error('El .paint usa una disposición de píxeles no admitida.');
      }
      let format = null;
      if (cmpC) {
        const algo = ascii(d, cmpC.a + 4, 4);
        if (d[cmpC.a + 8] !== 0) throw new Error('El .paint usa una compresión por partes no admitida.');
        format = { defl: 'deflate-raw', zlib: 'deflate' }[algo];
        if (!format) throw new Error('El .paint usa una compresión no admitida: ' + algo);
      }
      return { w, h, order, format };
    }

    async function decodeLayer(id, x, y) {
      const info = decodeInfo(id), cc = info.order.length, expected = info.w * info.h * cc;
      const raw = itemBytes(id);
      let px;
      if (info.format) {
        try { px = await inflate(raw, info.format, expected); }
        catch (e) { throw new Error('Una capa del .paint no se pudo descomprimir: ' + e.message); }
      } else {
        if (raw.length !== expected) throw new Error('El archivo .paint está dañado o incompleto.');
        px = raw;
      }
      const rgba = new Uint8ClampedArray(info.w * info.h * 4);
      const hasA = info.order.includes(3);
      for (let i = 0, n = info.w * info.h; i < n; i++) {
        const o = i * 4, s = i * cc;
        if (!hasA) rgba[o + 3] = 255;
        for (let c = 0; c < cc; c++) rgba[o + info.order[c]] = px[s + c];
      }
      return { x, y, w: info.w, h: info.h, rgba };
    }

    const type = types.get(primary);
    if (type === 'unci') {
      const l = await decodeLayer(primary, 0, 0);
      return { w: l.w, h: l.h, fill: [255, 255, 255, 0], layers: [l] };
    }
    if (type !== 'iovl') throw new Error('Este archivo HEIF no es un proyecto de Paint.');
    if (!inputs.length) throw new Error('El proyecto .paint no tiene capas.');
    if (inputs.some(id => types.get(id) !== 'unci')) throw new Error('El proyecto .paint contiene capas de un tipo no admitido.');

    const iv = itemBytes(primary), ov = new DataView(iv.buffer, iv.byteOffset, iv.byteLength);
    const big = iv[1] & 1, S = big ? 4 : 2;
    const rd = o => (big ? ov.getUint32(o) : ov.getUint16(o)), rs = o => (big ? ov.getInt32(o) : ov.getInt16(o));
    if (iv.length < 10 + 2 * S + inputs.length * 2 * S) throw new Error('El archivo .paint está dañado.');
    const fill = [0, 2, 4, 6].map(k => iv[2 + k]); // byte alto de cada canal de 16 bits
    const w = rd(10), h = rd(10 + S);
    if (!w || !h || w > 30000 || h > 30000 || w * h > 268435456) throw new Error('El lienzo del .paint tiene dimensiones no admitidas.');
    const layers = [];
    for (let i = 0; i < inputs.length; i++) {
      const o = 10 + 2 * S + i * 2 * S;
      layers.push(await decodeLayer(inputs[i], rs(o), rs(o + S)));
    }
    return { w, h, fill, layers };
  }

  /* layers: Uint8ClampedArray RGBA del tamaño del lienzo, de abajo arriba. */
  C.writePaint = async function (w, h, layers) {
    if (!layers.length) throw new Error('El proyecto necesita al menos una capa.');
    if (w > 65535 || h > 65535) throw new Error('El lienzo es demasiado grande para un archivo .paint.');
    const n = layers.length, ovl = n + 1;
    const data = [];
    for (const rgba of layers) {
      const bgra = new Uint8Array(rgba.length);
      for (let i = 0; i < rgba.length; i += 4) { bgra[i] = rgba[i + 2]; bgra[i + 1] = rgba[i + 1]; bgra[i + 2] = rgba[i]; bgra[i + 3] = rgba[i + 3]; }
      data.push(await deflateRaw(bgra));
    }
    const num = (v, s) => { const a = []; for (let i = s - 1; i >= 0; i--) a.push(Math.floor(v / Math.pow(256, i)) & 255); return a; };
    const txt = s => Array.from(s, c => c.charCodeAt(0));
    const box = (t, ...parts) => { const body = parts.flat(); return num(body.length + 8, 4).concat(txt(t), body); };
    const full = (t, v, ...parts) => box(t, [v, 0, 0, 0], ...parts);

    /* La superposición: mismo relleno que escribe Paint (blanco con alfa 0). */
    const iovl = [0, 0, 255, 255, 255, 255, 255, 255, 0, 0].concat(num(w, 2), num(h, 2));
    for (let i = 0; i < n; i++) iovl.push(0, 0, 0, 0);

    const buildMeta = base => {
      let off = base;
      const iloc = [0x44, 0].concat(num(n + 1, 2));
      for (let i = 0; i < n; i++) {
        iloc.push(...num(i + 1, 2), 0, 0, 0, 0, 0, 1, ...num(off, 4), ...num(data[i].length, 4));
        off += data[i].length;
      }
      iloc.push(...num(ovl, 2), 0, 1, 0, 0, 0, 1, 0, 0, 0, 0, ...num(iovl.length, 4));
      const infes = [];
      for (let i = 1; i <= ovl; i++) infes.push(...full('infe', 2, num(i, 2), [0, 0], txt(i === ovl ? 'iovl' : 'unci'), [0]));
      const ipco = box('ipco',
        full('cmpC', 0, txt('defl'), [0]),
        full('ispe', 0, num(w, 4), num(h, 4)),
        box('colr', txt('nclx'), [0, 1, 0, 13, 0, 0, 0x80]),
        box('cmpd', num(4, 4), [0, 4, 0, 5, 0, 6, 0, 7]),
        full('uncC', 0, txt('gene'), num(4, 4), [0, 2, 7, 0, 0, 0, 1, 7, 0, 0, 0, 0, 7, 0, 0, 0, 3, 7, 0, 0], [0, 1, 0, 0], new Array(20).fill(0)),
        full('pixi', 0, [4, 8, 8, 8, 8]));
      const ipma = num(n + 1, 4);
      for (let i = 1; i <= n; i++) ipma.push(...num(i, 2), 6, 0x81, 2, 3, 0x84, 0x85, 6);
      ipma.push(...num(ovl, 2), 2, 2, 6);
      const refs = num(ovl, 2).concat(num(n, 2));
      for (let i = 1; i <= n; i++) refs.push(...num(i, 2));
      return full('meta', 0,
        full('hdlr', 0, new Array(4).fill(0), txt('pict'), new Array(13).fill(0)),
        full('pitm', 0, num(ovl, 2)),
        full('iinf', 0, num(ovl, 2), infes),
        full('iloc', 1, iloc),
        box('iprp', ipco, full('ipma', 0, ipma)),
        full('iref', 0, box('dimg', refs)),
        box('idat', iovl));
    };
    const ftyp = box('ftyp', txt('mif1'), [0, 0, 0, 0], txt('mif1'), txt('gcmi'), txt('isoa'), txt('miaf'));
    const free = box('free', new Array(56).fill(0));
    const metaLen = buildMeta(0).length;
    const mdatStart = ftyp.length + metaLen + free.length + 8;
    const meta = buildMeta(mdatStart);
    const dataLen = data.reduce((s, x) => s + x.length, 0);
    const out = new Uint8Array(mdatStart + dataLen);
    out.set(ftyp, 0);
    out.set(meta, ftyp.length);
    out.set(free, ftyp.length + metaLen);
    out.set(num(dataLen + 8, 4).concat(txt('mdat')), mdatStart - 8);
    let p = mdatStart;
    for (const x of data) { out.set(x, p); p += x.length; }
    return out;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = C;
  else { root.T = root.T || {}; root.T.codecs = C; }
})(typeof window !== 'undefined' ? window : globalThis);
