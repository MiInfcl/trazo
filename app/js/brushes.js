'use strict';
/* Trazo · pinceles. Cada trazo se pinta en la capa de vista previa y al soltar se funde con la capa.
 * Los pinceles lisos dan además su equivalente vectorial; los de textura se guardan como imagen. */
(function () {
  const T = window.T, U = T.util, V = T.vec;
  const B = T.brushes = {};

  B.KINDS = [
    { id: 'brush', name: 'Pincel' }, { id: 'calligBrush', name: 'Pincel caligráfico' }, { id: 'calligPen', name: 'Pluma caligráfica' },
    { id: 'airbrush', name: 'Aerógrafo' }, { id: 'oil', name: 'Pincel para óleo' }, { id: 'crayon', name: 'Crayón' },
    { id: 'marker', name: 'Marcador' }, { id: 'natPencil', name: 'Lápiz natural' }, { id: 'watercolor', name: 'Pincel para acuarela' }
  ];

  /* Opacidad propia del pincel (se multiplica por la del deslizador). */
  B.baseAlpha = kind => (kind === 'marker' ? 0.55 : kind === 'watercolor' ? 0.8 : 1);

  const cssRgba = (c, a) => 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')';
  let seedCounter = 1;

  class Stroke {
    constructor(ctx, kind, color, size) {
      this.ctx = ctx; this.kind = kind; this.color = color; this.rgb = U.hexToRgb(color); this.size = Math.max(1, size);
      this.seed = seedCounter++ * 7919;
      this.bbox = new U.BBox();
      this.pts = [];
      this.quads = '';
      this.last = null;
      this.left = 0; // distancia pendiente hasta el siguiente sello
      this.rand = rng(this.seed);
      if (kind === 'oil') this.initOil();
    }
    get pad() { return this.size * 1.2 + 3; }

    start(x, y) {
      this.last = { x, y };
      this.pts.push({ x, y });
      this.bbox.add(x, y);
      this.segment(x, y, x, y, true);
    }
    to(x, y) {
      const l = this.last;
      if (!l || (l.x === x && l.y === y)) return;
      this.segment(l.x, l.y, x, y, false);
      this.last = { x, y };
      this.pts.push({ x, y });
      this.bbox.add(x, y);
    }
    /* Mientras se mantiene pulsado (solo el aerógrafo sigue pintando quieto). */
    idle() { if (this.kind === 'airbrush' && this.last) { this.spray(this.last.x, this.last.y); } }

    segment(x0, y0, x1, y1, first) {
      const c = this.ctx, s = this.size;
      switch (this.kind) {
        case 'brush': case 'marker':
          c.strokeStyle = this.color; c.lineWidth = s;
          c.lineCap = this.kind === 'marker' ? 'square' : 'round'; c.lineJoin = 'round';
          c.beginPath(); c.moveTo(x0, y0); c.lineTo(first ? x0 + 0.01 : x1, y1); c.stroke();
          break;
        case 'calligBrush': case 'calligPen': this.callig(x0, y0, x1, y1, first); break;
        case 'oil': this.oil(x0, y0, x1, y1, first); break;
        default: this.stamp(x0, y0, x1, y1, first);
      }
    }

    callig(x0, y0, x1, y1, first) {
      const c = this.ctx, s = this.size * (this.kind === 'calligPen' ? 0.8 : 1);
      const a = this.kind === 'calligBrush' ? -Math.PI / 4 : Math.PI / 4;
      const dx = Math.cos(a) * s / 2, dy = Math.sin(a) * s / 2;
      let q = first
        ? [x0 - dx - 0.5, y0 - dy - 0.5, x0 + dx + 0.5, y0 + dy - 0.5, x0 + dx + 0.5, y0 + dy + 0.5, x0 - dx - 0.5, y0 - dy + 0.5]
        : [x0 - dx, y0 - dy, x0 + dx, y0 + dy, x1 + dx, y1 + dy, x1 - dx, y1 - dy];
      // misma orientación en todos los cuadriláteros: si no, la regla no-cero abriría huecos al cruzarse
      let area = 0;
      for (let i = 0; i < 8; i += 2) { const j = (i + 2) % 8; area += q[i] * q[j + 1] - q[j] * q[i + 1]; }
      if (area < 0) q = [q[6], q[7], q[4], q[5], q[2], q[3], q[0], q[1]];
      c.fillStyle = this.color; c.strokeStyle = this.color; c.lineWidth = 0.5; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(q[0], q[1]);
      for (let i = 2; i < 8; i += 2) c.lineTo(q[i], q[i + 1]);
      c.closePath(); c.fill(); c.stroke();
      let d = 'M' + V.n(q[0]) + ' ' + V.n(q[1]);
      for (let i = 2; i < 8; i += 2) d += 'L' + V.n(q[i]) + ' ' + V.n(q[i + 1]);
      this.quads += d + 'Z';
    }

    initOil() {
      const n = Math.max(5, Math.round(this.size * 0.9));
      this.bristles = [];
      for (let i = 0; i < n; i++) {
        this.bristles.push({
          o: (i / (n - 1) - 0.5) + (this.rand() - 0.5) * 0.08,
          a: 0.55 + this.rand() * 0.45,
          d: (this.rand() - 0.5) * 34,
          w: 0.8 + this.rand() * 1.5
        });
      }
    }
    oil(x0, y0, x1, y1, first) {
      const c = this.ctx, s = this.size;
      let dx = x1 - x0, dy = y1 - y0;
      const len = Math.hypot(dx, dy);
      if (len > 0) { this.nx = -dy / len; this.ny = dx / len; }
      const nx = this.nx === undefined ? 0.7 : this.nx, ny = this.ny === undefined ? -0.7 : this.ny;
      const px = this.pnx === undefined ? nx : this.pnx, py = this.pny === undefined ? ny : this.pny;
      c.lineCap = 'round'; c.lineJoin = 'round';
      for (const b of this.bristles) {
        const r = U.clamp(this.rgb[0] + b.d, 0, 255) | 0, g = U.clamp(this.rgb[1] + b.d, 0, 255) | 0, bl = U.clamp(this.rgb[2] + b.d, 0, 255) | 0;
        c.strokeStyle = 'rgba(' + r + ',' + g + ',' + bl + ',' + b.a + ')';
        c.lineWidth = b.w * Math.max(1, s / 14);
        c.beginPath();
        c.moveTo(x0 + px * b.o * s, y0 + py * b.o * s);
        c.lineTo(x1 + nx * b.o * s + (first ? 0.01 : 0), y1 + ny * b.o * s);
        c.stroke();
      }
      this.pnx = nx; this.pny = ny;
    }

    /* Sellos a lo largo del segmento. */
    stamp(x0, y0, x1, y1, first) {
      const spacing = this.kind === 'watercolor' ? Math.max(1, this.size / 6)
        : this.kind === 'airbrush' ? Math.max(1, this.size / 4)
          : Math.max(1, this.size / 4);
      const len = Math.hypot(x1 - x0, y1 - y0);
      if (first) { this.dab(x0, y0); this.left = spacing; return; }
      let d = this.left;
      while (d <= len) {
        const t = len ? d / len : 0;
        this.dab(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t);
        d += spacing;
      }
      this.left = d - len;
    }
    dab(x, y) {
      if (this.kind === 'airbrush') this.spray(x, y);
      else if (this.kind === 'crayon') this.grain(x, y, this.size / 2, 0.55, 1);
      else if (this.kind === 'natPencil') this.grain(x, y, Math.max(1, this.size * 0.3), 0.5, 0.75);
      else if (this.kind === 'watercolor') this.water(x, y);
    }
    spray(x, y) {
      const c = this.ctx, r = this.size / 2 * 1.3, n = Math.max(6, Math.round(this.size * 1.4));
      c.fillStyle = this.color;
      for (let i = 0; i < n; i++) {
        const a = this.rand() * Math.PI * 2, m = r * Math.sqrt(this.rand()) * (0.35 + 0.65 * this.rand());
        c.fillRect(Math.round(x + Math.cos(a) * m), Math.round(y + Math.sin(a) * m), 1, 1);
      }
    }
    /* Grano fijo por coordenada: pasar dos veces no rellena los huecos. */
    grain(x, y, r, density, alpha) {
      const c = this.ctx, x0 = Math.floor(x - r), y0 = Math.floor(y - r), x1 = Math.ceil(x + r), y1 = Math.ceil(y + r);
      c.fillStyle = cssRgba(this.rgb, alpha);
      const r2 = r * r + 0.5;
      for (let py = y0; py <= y1; py++) {
        for (let px = x0; px <= x1; px++) {
          const dx = px - x, dy = py - y, d2 = dx * dx + dy * dy;
          if (d2 > r2) continue;
          if (this.painted(px, py)) continue;
          const coarse = U.hash2(px >> 1, py >> 1, 17);
          const edge = 1 - d2 / r2 * 0.35;
          if ((U.hash2(px, py, 3) * 0.6 + coarse * 0.4) < density * edge * 1.5 - 0.15) c.fillRect(px, py, 1, 1);
        }
      }
    }
    painted(px, py) {
      const m = this._seen || (this._seen = new Set());
      const k = px * 65536 + py;
      if (m.has(k)) return true;
      m.add(k);
      return false;
    }
    water(x, y) {
      const c = this.ctx, r = this.size / 2 + 1;
      const g = c.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, cssRgba(this.rgb, 0.05));
      g.addColorStop(0.82, cssRgba(this.rgb, 0.12));
      g.addColorStop(1, cssRgba(this.rgb, 0));
      c.fillStyle = g;
      c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
    }
    /* Marcado SVG equivalente, o null si el pincel es de textura. */
    vector(alpha) {
      const op = alpha < 1 ? ';opacity:' + V.n(alpha) : '';
      if (this.kind === 'brush' || this.kind === 'marker') {
        const pts = V.rdp(this.pts, 0.2);
        return '<path d="' + V.polyD(pts) + '" style="fill:none;stroke:' + this.color + ';stroke-width:' + V.n(this.size) +
          ';stroke-linecap:' + (this.kind === 'marker' ? 'square' : 'round') + ';stroke-linejoin:round' + op + '"/>';
      }
      if (this.kind === 'calligBrush' || this.kind === 'calligPen') {
        return '<path d="' + this.quads + '" style="fill:' + this.color + ';stroke:' + this.color + ';stroke-width:.5;stroke-linejoin:round' + op + '"/>';
      }
      return null;
    }
  }
  B.Stroke = Stroke;

  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* Contorno de una forma con un pincel de textura. */
  B.strokePolys = function (ctx, polys, kind, color, size, W, H) {
    const tmp = U.canvas(W, H);
    for (const poly of polys) {
      if (!poly.length) continue;
      const s = new Stroke(tmp.ctx, kind, color, size);
      s.start(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) s.to(poly[i].x, poly[i].y);
    }
    ctx.save();
    ctx.globalAlpha *= B.baseAlpha(kind);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  };

  /* Relleno de una forma con una textura de pincel. */
  B.fillTexture = function (ctx, path, box, kind, color, W, H) {
    const tmp = U.canvas(W, H), c = tmp.ctx;
    const r = U.rectClip(box, W, H);
    if (!r) return;
    const step = kind === 'watercolor' ? 10 : kind === 'oil' ? 9 : 5;
    const size = kind === 'watercolor' ? 26 : kind === 'oil' ? 14 : 12;
    if (kind === 'marker') { c.fillStyle = color; c.fillRect(r.x, r.y, r.w, r.h); }
    else {
      // pasadas horizontales de un lado a otro
      let flip = false;
      for (let y = r.y; y <= r.y + r.h; y += step) {
        const s = new Stroke(c, kind, color, size);
        s.start(flip ? r.x + r.w : r.x, y);
        const n = Math.ceil(r.w / 8);
        for (let i = 1; i <= n; i++) s.to(flip ? r.x + r.w - i * 8 : r.x + i * 8, y + (kind === 'oil' ? Math.sin(i * 0.8 + y) * 1.5 : 0));
        flip = !flip;
      }
    }
    ctx.save();
    ctx.clip(path);
    ctx.globalAlpha *= B.baseAlpha(kind);
    ctx.drawImage(tmp, 0, 0);
    ctx.restore();
  };
})();
