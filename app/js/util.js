'use strict';
/* Trazo · utilidades compartidas (DOM, color, lienzos, almacenamiento). */
(function () {
  const T = window.T = window.T || {};
  const U = T.util = {};

  U.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  /* Crea un elemento: el('div.clase#id', {props}, ...hijos). */
  U.el = function (tag, props) {
    let name = 'div', id = null;
    const cls = [];
    tag.replace(/([.#]?)([\w-]+)/g, (m, p, v) => {
      if (!p) name = v; else if (p === '.') cls.push(v); else id = v;
      return '';
    });
    const e = document.createElement(name);
    if (id) e.id = id;
    if (cls.length) e.className = cls.join(' ');
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (k === 'spellcheck') { e.setAttribute(k, String(v)); continue; }
        if (v == null || v === false) continue;
        if (k === 'style' && typeof v === 'object') Object.assign(e.style, v);
        else if (k === 'class') e.className += (e.className ? ' ' : '') + v;
        else if (k === 'text') { (e._src || (e._src = {})).text = v; e.textContent = T.tr(v); }
        else if (k === 'html') e.innerHTML = v; // solo marcado propio (iconos), nunca datos de archivos
        else if (k === 'data') {
          for (const dk in v) {
            if (dk === 'tip' || dk === 'key') { (e._src || (e._src = {}))[dk] = v[dk]; e.dataset[dk] = T.tr(v[dk]); }
            else e.dataset[dk] = v[dk];
          }
        }
        else if (k === 'aria-label') { (e._src || (e._src = {})).aria = v; e.setAttribute(k, T.tr(v)); }
        else if (k.startsWith('on') && typeof v === 'function') e.addEventListener(k.slice(2).toLowerCase(), v);
        else if (k.startsWith('aria-') || k === 'role' || k === 'for' || k === 'list') e.setAttribute(k, v);
        else if (k in e) { try { e[k] = v; } catch (err) { e.setAttribute(k, v); } }
        else e.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) U.append(e, arguments[i]);
    return e;
  };

  U.append = function (parent, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { for (const k of kid) U.append(parent, k); return; }
    if (typeof kid === 'string') {
      const n = document.createTextNode(T.tr(kid));
      n._src = kid;
      parent.appendChild(n);
      return;
    }
    parent.appendChild(typeof kid === 'number' ? document.createTextNode(String(kid)) : kid);
  };

  U.clear = function (e) { while (e.firstChild) e.removeChild(e.firstChild); return e; };

  /* Emisor de eventos mínimo. */
  class Emitter {
    constructor() { this._h = {}; }
    on(ev, fn) { (this._h[ev] || (this._h[ev] = [])).push(fn); return this; }
    off(ev, fn) { const l = this._h[ev]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } return this; }
    emit(ev) {
      const l = this._h[ev];
      if (!l) return;
      const args = Array.prototype.slice.call(arguments, 1);
      for (const f of l.slice()) {
        try { f.apply(null, args); } catch (err) { console.error('[bus ' + ev + ']', err); }
      }
    }
  }
  U.Emitter = Emitter;
  T.bus = new Emitter();

  /* ---------- Color ---------- */
  U.hexToRgb = function (h) {
    h = String(h).replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16) || 0;
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  U.rgbToHex = (r, g, b) => '#' + ((1 << 24) | ((r & 255) << 16) | ((g & 255) << 8) | (b & 255)).toString(16).slice(1);
  U.rgbToHsv = function (r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
    let h = 0;
    if (d) {
      if (mx === r) h = ((g - b) / d) % 6;
      else if (mx === g) h = (b - r) / d + 2;
      else h = (r - g) / d + 4;
      h *= 60; if (h < 0) h += 360;
    }
    return [h, mx ? d / mx : 0, mx];
  };
  U.hsvToRgb = function (h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s, x = c * (1 - Math.abs(((h / 60) % 2) - 1)), m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60) { r = c; g = x; } else if (h < 120) { r = x; g = c; } else if (h < 180) { g = c; b = x; }
    else if (h < 240) { g = x; b = c; } else if (h < 300) { r = x; b = c; } else { r = c; b = x; }
    return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
  };
  U.validHex = s => /^#?[0-9a-f]{6}$/i.test(String(s).trim()) || /^#?[0-9a-f]{3}$/i.test(String(s).trim());
  U.normHex = function (s) {
    s = String(s).trim().replace('#', '').toLowerCase();
    if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
    return '#' + s;
  };

  /* ---------- Lienzos ---------- */
  U.canvas = function (w, h) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w));
    c.height = Math.max(1, Math.round(h));
    c.ctx = c.getContext('2d', { willReadFrequently: true });
    return c;
  };
  U.cloneCanvas = function (src) {
    const c = U.canvas(src.width, src.height);
    c.ctx.drawImage(src, 0, 0);
    return c;
  };
  U.imageDataToCanvas = function (im) {
    const c = U.canvas(im.width, im.height);
    c.ctx.putImageData(im, 0, 0);
    return c;
  };
  U.canvasToBlob = (c, type, q) => new Promise((res, rej) => {
    c.toBlob(b => (b ? res(b) : rej(new Error('No se pudo codificar la imagen'))), type || 'image/png', q);
  });
  U.blobToBytes = async b => new Uint8Array(await b.arrayBuffer());
  U.loadImage = src => new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => res(im);
    im.onerror = () => rej(new Error('No se pudo leer la imagen'));
    im.src = src;
  });
  U.bytesToBase64 = function (bytes) {
    let s = '';
    const CH = 0x8000;
    for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode.apply(null, bytes.subarray(i, i + CH));
    return btoa(s);
  };
  U.base64ToBytes = function (b64) {
    const s = atob(b64);
    const out = new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
    return out;
  };
  U.textToBytes = s => new TextEncoder().encode(s);
  U.bytesToText = function (bytes) {
    // UTF-8 con BOM opcional; UTF-16 si trae BOM
    if (bytes.length >= 2 && bytes[0] === 0xFF && bytes[1] === 0xFE) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes.length >= 2 && bytes[0] === 0xFE && bytes[1] === 0xFF) return new TextDecoder('utf-16be').decode(bytes.subarray(2));
    return new TextDecoder('utf-8').decode(bytes);
  };

  /* ---------- Rectángulos ---------- */
  U.rectUnion = function (a, b) {
    if (!a) return b; if (!b) return a;
    const x = Math.min(a.x, b.x), y = Math.min(a.y, b.y);
    return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y };
  };
  U.rectClip = function (r, W, H) {
    const x = Math.max(0, Math.floor(r.x)), y = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(W, Math.ceil(r.x + r.w)), y1 = Math.min(H, Math.ceil(r.y + r.h));
    if (x1 <= x || y1 <= y) return null;
    return { x, y, w: x1 - x, h: y1 - y };
  };
  /* Caja que crece con puntos (para rectángulos sucios). */
  U.BBox = class {
    constructor() { this.x0 = Infinity; this.y0 = Infinity; this.x1 = -Infinity; this.y1 = -Infinity; }
    add(x, y, w, h) {
      w = w || 0; h = h || 0;
      if (x < this.x0) this.x0 = x; if (y < this.y0) this.y0 = y;
      if (x + w > this.x1) this.x1 = x + w; if (y + h > this.y1) this.y1 = y + h;
    }
    get empty() { return this.x1 < this.x0; }
    rect(pad, W, H) {
      if (this.empty) return null;
      pad = pad || 0;
      return U.rectClip({ x: this.x0 - pad, y: this.y0 - pad, w: this.x1 - this.x0 + 2 * pad, h: this.y1 - this.y0 + 2 * pad }, W, H);
    }
  };

  /* ---------- Varios ---------- */
  U.store = {
    get(k, def) {
      try { const v = localStorage.getItem('trazo.' + k); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
    },
    set(k, v) { try { localStorage.setItem('trazo.' + k, JSON.stringify(v)); } catch (e) { /* sin almacenamiento */ } }
  };
  U.fmtBytes = function (n) {
    if (n == null) return '';
    const f = v => (Math.round(v * 10) / 10).toLocaleString('es', { maximumFractionDigits: 1 });
    if (n < 1024) return n + ' bytes';
    if (n < 1048576) return f(n / 1024) + 'KB';
    return f(n / 1048576) + 'MB';
  };
  U.debounce = function (fn, ms) {
    let t = 0;
    return function () { const a = arguments; clearTimeout(t); t = setTimeout(() => fn.apply(null, a), ms); };
  };
  U.rafThrottle = function (fn) {
    let pending = false, lastArgs = null;
    return function () {
      lastArgs = arguments;
      if (pending) return;
      pending = true;
      requestAnimationFrame(() => { pending = false; fn.apply(null, lastArgs); });
    };
  };
  U.escXml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  U.baseName = function (name) { const i = name.lastIndexOf('.'); return i > 0 ? name.slice(0, i) : name; };
  U.ext = function (name) { const i = name.lastIndexOf('.'); return i >= 0 ? name.slice(i + 1).toLowerCase() : ''; };

  /* Bresenham: llama fn(x, y) en cada píxel entre dos puntos enteros. */
  U.line = function (x0, y0, x1, y1, fn) {
    const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    for (;;) {
      fn(x0, y0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x0 += sx; }
      if (e2 < dx) { err += dx; y0 += sy; }
    }
  };

  /* Ruido determinista por coordenada (0..1). */
  U.hash2 = function (x, y, seed) {
    let h = (x * 374761393 + y * 668265263 + (seed | 0) * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177 | 0;
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
})();
