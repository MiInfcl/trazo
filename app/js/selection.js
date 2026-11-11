'use strict';
/* Trazo · selección rectangular y de forma libre, flotante con tiradores. */
(function () {
  const T = window.T, U = T.util, V = T.vec, VW = () => T.view;
  const S = T.selection = { cur: null, drag: null };

  /* Prueba de tiradores: devuelve nw, n, ne, e, se, s, sw, w, 'move' o null. */
  T.hitBox = function (b, p, zoom) {
    const t = 6 / zoom;
    const near = (a, c) => Math.abs(a - c) <= t;
    const xs = { l: b.x, c: b.x + b.w / 2, r: b.x + b.w }, ys = { t: b.y, c: b.y + b.h / 2, b: b.y + b.h };
    const list = [['nw', xs.l, ys.t], ['n', xs.c, ys.t], ['ne', xs.r, ys.t], ['e', xs.r, ys.c], ['se', xs.r, ys.b], ['s', xs.c, ys.b], ['sw', xs.l, ys.b], ['w', xs.l, ys.c]];
    for (const h of list) if (near(p.x, h[1]) && near(p.y, h[2])) return h[0];
    if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return 'move';
    return null;
  };
  T.boxHandles = b => [
    { x: b.x, y: b.y }, { x: b.x + b.w / 2, y: b.y }, { x: b.x + b.w, y: b.y }, { x: b.x + b.w, y: b.y + b.h / 2 },
    { x: b.x + b.w, y: b.y + b.h }, { x: b.x + b.w / 2, y: b.y + b.h }, { x: b.x, y: b.y + b.h }, { x: b.x, y: b.y + b.h / 2 }
  ];
  T.handleCursor = h => ({ nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize', move: 'move' }[h] || '');
  /* Aplica el arrastre de un tirador a una caja. */
  T.resizeBox = function (o, h, p, keep) {
    let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
    if (h.includes('w')) x0 = p.x; if (h.includes('e')) x1 = p.x;
    if (h.includes('n')) y0 = p.y; if (h.includes('s')) y1 = p.y;
    if (keep && h.length === 2 && o.w && o.h) {
      const s = Math.max(Math.abs(x1 - x0) / o.w, Math.abs(y1 - y0) / o.h), nw = o.w * s, nh = o.h * s;
      if (h.includes('w')) x0 = x1 - nw; else x1 = x0 + nw;
      if (h.includes('n')) y0 = y1 - nh; else y1 = y0 + nh;
    }
    const x = Math.round(Math.min(x0, x1)), y = Math.round(Math.min(y0, y1));
    return { x, y, w: Math.max(1, Math.round(Math.abs(x1 - x0))), h: Math.max(1, Math.round(Math.abs(y1 - y0))) };
  };

  const page = () => T.view.page;
  const layer = () => page().active;

  S.active = () => !!S.cur;

  function maskPath(cur) {
    if (!cur.mask) return null;
    if (cur.maskD !== undefined) return cur.maskD;
    const m = cur.mask, w = m.width, h = m.height, d = m.ctx.getImageData(0, 0, w, h).data;
    const bits = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) bits[i] = d[i * 4 + 3] >= 128 ? 1 : 0;
    cur.maskD = V.traceMask(bits, w, h);
    return cur.maskD;
  }

  S.redraw = function () {
    const v = VW(), c = S.cur;
    if (!c) {
      if (S.owner) { v.setOverlay(''); v.setHandles(null); S.owner = false; }
      return;
    }
    S.owner = true;
    const rotating = S.drag && S.drag.mode === 'rotate';
    const rh = rotHandle(c, v.sx);
    const stem = '<line class="guide-bg" x1="' + rh.x + '" y1="' + c.y + '" x2="' + rh.x + '" y2="' + rh.y + '"/><line class="guide" x1="' + rh.x + '" y1="' + c.y + '" x2="' + rh.x + '" y2="' + rh.y + '"/>';
    if (rotating && c.rot && c.rot.poly) {
      // durante el giro se muestra el contorno de la caja original girada
      const d = 'M' + c.rot.poly.map(q => V.n(q.x) + ' ' + V.n(q.y)).join('L') + 'Z';
      v.setOverlay('<path class="ants-bg" d="' + d + '"/><path class="ants" d="' + d + '"/>' + stem);
      v.setHandles([{ x: rh.x, y: rh.y, rot: true }, { x: rh.x, y: rh.y, label: c.rot.angle + '°' }]);
      return;
    }
    let shape;
    if (c.mask) {
      const d = maskPath(c), sx = c.w / c.mask.width, sy = c.h / c.mask.height;
      const tf = 'translate(' + c.x + ' ' + c.y + ') scale(' + sx + ' ' + sy + ')';
      shape = '<path class="ants-bg" transform="' + tf + '" d="' + d + '"/><path class="ants" transform="' + tf + '" d="' + d + '"/>';
    } else {
      const r = 'x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '"';
      shape = '<rect class="ants-bg" ' + r + '/><rect class="ants" ' + r + '/>';
    }
    v.setOverlay(shape + stem);
    v.setHandles(T.boxHandles(c).concat([{ x: rh.x, y: rh.y, rot: true }]));
  };

  /* ---------- Giro libre ----------
   * La manija queda 24 px de pantalla sobre el centro del borde superior. Cada giro se calcula
   * desde la imagen original de la selección (rot.base), así girar varias veces no la degrada. */
  const ROT_GAP = 24;
  function rotHandle(c, zoom) { return { x: c.x + c.w / 2, y: c.y - ROT_GAP / zoom }; }
  function hitRot(c, p, zoom) { const h = rotHandle(c, zoom); return Math.hypot(p.x - h.x, p.y - h.y) * zoom <= 9; }

  function startRotate(c, p) {
    lift();
    const r = c.rot;
    if (!r || c.float !== r.out || c.w !== r.out.width || c.h !== r.out.height) {
      // nueva base: lo que se ve ahora, a su tamaño en pantalla
      const smooth = !(T.doc && T.doc.kind === 'icon');
      const base = U.canvas(c.w, c.h), mask = U.canvas(c.w, c.h);
      base.ctx.imageSmoothingEnabled = smooth; base.ctx.imageSmoothingQuality = 'high';
      base.ctx.drawImage(c.float, 0, 0, c.w, c.h);
      if (c.mask) mask.ctx.drawImage(c.mask, 0, 0, c.w, c.h); else mask.ctx.fillRect(0, 0, c.w, c.h);
      c.rot = { base, mask, hadMask: !!c.mask, angle: 0, out: null, ox: c.w / 2, oy: c.h / 2, poly: null };
    }
    const cx = c.x + c.rot.ox, cy = c.y + c.rot.oy;
    S.drag = { mode: 'rotate', cx, cy, a0: Math.atan2(p.y - cy, p.x - cx), angle0: c.rot.angle };
  }

  function applyRotate(c, angle, cx, cy) {
    const r = c.rot, bw = r.base.width, bh = r.base.height;
    const rad = angle * Math.PI / 180, cos = Math.cos(rad), sin = Math.sin(rad);
    const fix = v => Math.round(v * 1000) / 1000;
    const W = Math.max(1, Math.ceil(fix(Math.abs(bw * cos) + Math.abs(bh * sin)))), H = Math.max(1, Math.ceil(fix(Math.abs(bw * sin) + Math.abs(bh * cos))));
    const smooth = !(T.doc && T.doc.kind === 'icon');
    const draw = (src, binary) => {
      const o = U.canvas(W, H);
      o.ctx.imageSmoothingEnabled = smooth && !binary; o.ctx.imageSmoothingQuality = 'high';
      o.ctx.translate(W / 2, H / 2); o.ctx.rotate(rad); o.ctx.drawImage(src, -bw / 2, -bh / 2);
      return o;
    };
    const out = draw(r.base);
    let mask = null;
    if (r.hadMask || angle % 90 !== 0) {
      mask = draw(r.mask, true);
      const im = mask.ctx.getImageData(0, 0, W, H), d = im.data;
      for (let i = 3; i < d.length; i += 4) d[i] = d[i] >= 128 ? 255 : 0;
      mask.ctx.putImageData(im, 0, 0);
    }
    c.float = out; c.mask = mask; delete c.maskD; c.shown = null; c.touched = true;
    c.w = W; c.h = H; c.x = Math.round(cx - W / 2); c.y = Math.round(cy - H / 2);
    r.angle = angle; r.out = out; r.ox = cx - c.x; r.oy = cy - c.y;
    r.poly = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([sx, sy]) => {
      const x = sx * bw / 2, y = sy * bh / 2;
      return { x: cx + x * cos - y * sin, y: cy + x * sin + y * cos };
    });
  }

  /* Gira la selección un ángulo exacto (en grados), sumado al giro que ya tenga. */
  S.rotateBy = function (deg) {
    const c = S.cur;
    if (!c) return false;
    startRotate(c, { x: c.x + c.w / 2, y: c.y });
    const d = S.drag;
    S.drag = null;
    applyRotate(c, normAngle(c.rot.angle + deg), d.cx, d.cy);
    drawFloat();
    S.redraw();
    T.bus.emit('selection');
    return true;
  };
  const normAngle = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
  T.bus.on('view', () => { if (S.cur) S.redraw(); });

  function drawFloat() {
    const c = S.cur, v = VW();
    v.clearPreview();
    if (!c || !c.float) return;
    const src = shownFloat(c);
    v.pctx.imageSmoothingEnabled = !(T.doc && T.doc.kind === 'icon');
    v.pctx.imageSmoothingQuality = 'high';
    v.pctx.drawImage(src, c.x, c.y, c.w, c.h);
  }

  /* Con «selección transparente», lo que tenga el color 2 no se lleva. */
  function shownFloat(c) {
    if (!T.state.selTransparent) return c.float;
    if (c.shown && c.shownKey === T.state.color2) return c.shown;
    const out = U.cloneCanvas(c.float), im = out.ctx.getImageData(0, 0, out.width, out.height), d = im.data;
    const k = U.hexToRgb(T.state.color2);
    for (let i = 0; i < d.length; i += 4) if (d[i] === k[0] && d[i + 1] === k[1] && d[i + 2] === k[2]) d[i + 3] = 0;
    out.ctx.putImageData(im, 0, 0);
    c.shown = out; c.shownKey = T.state.color2;
    return out;
  }
  S.refreshTransparent = () => { if (S.cur && S.cur.float) { drawFloat(); } };

  /* Separa el contenido seleccionado de la capa. */
  function lift(copyOnly) {
    const c = S.cur;
    if (!c || c.float) return;
    const L = layer();
    const f = U.canvas(c.w, c.h);
    f.ctx.drawImage(L.canvas, -c.x, -c.y);
    if (c.mask) {
      f.ctx.globalCompositeOperation = 'destination-in';
      f.ctx.drawImage(c.mask, 0, 0);
      f.ctx.globalCompositeOperation = 'source-over';
    }
    c.float = f;
    if (!copyOnly) {
      if (c.mask) {
        L.ctx.globalCompositeOperation = 'destination-out';
        L.ctx.drawImage(c.mask, c.x, c.y);
        L.ctx.globalCompositeOperation = 'source-over';
      } else L.ctx.clearRect(c.x, c.y, c.w, c.h);
    }
    drawFloat();
  }

  /* Coloca la selección y termina. */
  S.commit = function () {
    const c = S.cur;
    if (!c) return;
    S.cur = null;
    if (c.float) {
      const L = layer();
      const src = shownFloat(c);
      L.ctx.imageSmoothingEnabled = !(T.doc && T.doc.kind === 'icon');
      L.ctx.imageSmoothingQuality = 'high';
      L.ctx.drawImage(src, c.x, c.y, c.w, c.h);
      if (c.svg && !c.touched && !T.state.selTransparent) L.pushVec(V.svg(c.x, c.y, c.w, c.h, c.svg));
      VW().clearPreview();
      page().commit(c.pasted ? 'Pegar' : 'Mover selección');
    }
    S.redraw();
    T.bus.emit('selection');
  };

  /* Abandona la selección sin aplicarla. */
  S.cancel = function () {
    const c = S.cur;
    if (!c) return;
    S.cur = null;
    if (c.float) {
      VW().clearPreview();
      if (!c.pasted) page().revert();
    }
    S.redraw();
    T.bus.emit('selection');
  };
  S.clear = function () {
    S.cur = null;
    S.redraw();
    T.bus.emit('selection');
  };

  S.select = function (x, y, w, h, mask) {
    S.commit();
    const r = U.rectClip({ x, y, w, h }, page().w, page().h);
    if (!r) return;
    S.cur = { x: r.x, y: r.y, w: r.w, h: r.h, mask: mask || null, float: null };
    S.redraw();
    T.bus.emit('selection');
  };
  S.selectAll = function () { S.commit(); S.select(0, 0, page().w, page().h); };

  S.invert = function () {
    const p = page();
    if (!S.cur) { S.selectAll(); return; }
    const c = S.cur;
    const full = U.canvas(p.w, p.h);
    full.ctx.fillRect(0, 0, p.w, p.h);
    full.ctx.globalCompositeOperation = 'destination-out';
    if (c.mask) full.ctx.drawImage(c.mask, c.x, c.y, c.w, c.h); else full.ctx.fillRect(c.x, c.y, c.w, c.h);
    S.commit();
    S.select(0, 0, p.w, p.h, full);
  };

  /* Pixeles de la selección actual (para copiar). */
  S.pixels = function () {
    const c = S.cur;
    if (!c) return null;
    const out = U.canvas(c.w, c.h);
    if (c.float) out.ctx.drawImage(shownFloat(c), 0, 0, c.w, c.h);
    else {
      out.ctx.drawImage(layer().canvas, -c.x, -c.y);
      if (c.mask) {
        out.ctx.globalCompositeOperation = 'destination-in';
        out.ctx.drawImage(c.mask, 0, 0);
      }
    }
    return out;
  };

  S.remove = function () {
    const c = S.cur;
    if (!c) return false;
    if (c.float) {
      S.cur = null;
      VW().clearPreview();
      if (!c.pasted) page().commit('Eliminar selección');
    } else {
      const L = layer();
      if (c.mask) {
        L.ctx.globalCompositeOperation = 'destination-out';
        L.ctx.drawImage(c.mask, c.x, c.y);
        L.ctx.globalCompositeOperation = 'source-over';
      } else L.ctx.clearRect(c.x, c.y, c.w, c.h);
      S.cur = null;
      page().commit('Eliminar selección');
    }
    S.redraw();
    T.bus.emit('selection');
    return true;
  };

  /* Pega un lienzo como selección flotante. svg: fuente vectorial, si la tiene. */
  S.paste = function (canvas, opts) {
    opts = opts || {};
    T.app.finishPending();
    T.tools.set('select'); // antes de crear la selección: cambiar de herramienta la confirmaría
    const v = VW();
    const vis = v.visibleRect();
    let x = opts.x != null ? opts.x : vis.x, y = opts.y != null ? opts.y : vis.y;
    x = Math.max(0, x); y = Math.max(0, y);
    S.cur = { x, y, w: canvas.width, h: canvas.height, mask: null, float: canvas, pasted: true, svg: opts.svg || null };
    drawFloat();
    S.redraw();
    T.bus.emit('selection');
  };

  /* Gira o voltea la selección. */
  S.transform = function (kind) {
    const c = S.cur;
    if (!c) return false;
    lift();
    const f = c.float, w = f.width, h = f.height;
    const swap = kind === 'r90' || kind === 'r270';
    const m = {
      r90: [0, 1, -1, 0, h, 0], r270: [0, -1, 1, 0, 0, w], r180: [-1, 0, 0, -1, w, h], fh: [-1, 0, 0, 1, w, 0], fv: [1, 0, 0, -1, 0, h]
    }[kind];
    const apply = src => {
      const o = U.canvas(swap ? src.height : src.width, swap ? src.width : src.height);
      o.ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
      o.ctx.drawImage(src, 0, 0);
      o.ctx.setTransform(1, 0, 0, 1, 0, 0);
      return o;
    };
    c.float = apply(f);
    if (c.mask && c.mask.width === w && c.mask.height === h) { c.mask = apply(c.mask); delete c.maskD; }
    c.shown = null; c.touched = true;
    if (swap) { const t = c.w; c.w = c.h; c.h = t; }
    drawFloat();
    S.redraw();
    return true;
  };

  /* Invierte los colores de la selección. */
  S.invertColors = function () {
    const c = S.cur;
    if (!c) return false;
    lift();
    const f = c.float, im = f.ctx.getImageData(0, 0, f.width, f.height), d = im.data;
    for (let i = 0; i < d.length; i += 4) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    f.ctx.putImageData(im, 0, 0);
    c.shown = null; c.touched = true; c.rot = null;
    drawFloat();
    return true;
  };

  S.nudge = function (dx, dy) {
    const c = S.cur;
    if (!c) return;
    lift();
    c.x += dx; c.y += dy;
    drawFloat();
    S.redraw();
  };

  /* Recorta la imagen a la selección. */
  S.crop = function () {
    const c = S.cur;
    if (!c) return false;
    const box = { x: c.x, y: c.y, w: c.w, h: c.h };
    const mask = c.mask, d = mask ? maskPath(c) : null;
    if (c.float) S.commit(); else S.clear();
    return page().crop(box.x, box.y, box.w, box.h, mask, d);
  };

  /* ---------- Interacción ---------- */
  function freeMask(pts) {
    const b = new U.BBox();
    for (const p of pts) b.add(p.x, p.y);
    const P = page();
    const r = U.rectClip({ x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 }, P.w, P.h);
    if (!r) return null;
    const m = U.canvas(r.w, r.h);
    m.ctx.fillStyle = '#000';
    m.ctx.beginPath();
    pts.forEach((p, i) => (i ? m.ctx.lineTo(p.x - r.x, p.y - r.y) : m.ctx.moveTo(p.x - r.x, p.y - r.y)));
    m.ctx.closePath(); m.ctx.fill();
    const im = m.ctx.getImageData(0, 0, r.w, r.h), d = im.data;
    let any = false;
    for (let i = 3; i < d.length; i += 4) { d[i] = d[i] >= 128 ? 255 : 0; if (d[i]) any = true; }
    m.ctx.putImageData(im, 0, 0);
    return any ? { r, m } : null;
  }

  S.tool = {
    cursor: 'crosshair',
    down(p, ev) {
      const c = S.cur, v = VW();
      if (c) {
        if (ev.button === 0 && hitRot(c, p, v.sx)) { startRotate(c, p); S.redraw(); return; }
        const h = T.hitBox(c, p, v.sx);
        if (h) {
          if (ev.button === 2) return;
          if (ev.ctrlKey && h === 'move') {
            // Ctrl + arrastrar deja una copia donde estaba
            if (c.float) layer().ctx.drawImage(shownFloat(c), c.x, c.y, c.w, c.h); else lift(true);
            c.pasted = false;
          } else lift();
          S.drag = { mode: h, sx: p.x, sy: p.y, box: { x: c.x, y: c.y, w: c.w, h: c.h } };
          return;
        }
        S.commit();
      }
      if (ev.button === 2) return;
      S.drag = T.state.selMode === 'free' ? { mode: 'free', pts: [p] } : { mode: 'rect', sx: p.x, sy: p.y, ex: p.x, ey: p.y };
    },
    move(p, ev) {
      const d = S.drag, v = VW();
      if (!d) return;
      const pg = page();
      if (d.mode === 'rect') {
        d.ex = U.clamp(p.x, 0, pg.w); d.ey = U.clamp(p.y, 0, pg.h);
        let x1 = d.ex, y1 = d.ey;
        if (ev.shiftKey) {
          const s = Math.max(Math.abs(x1 - d.sx), Math.abs(y1 - d.sy));
          x1 = d.sx + Math.sign(x1 - d.sx || 1) * s; y1 = d.sy + Math.sign(y1 - d.sy || 1) * s;
          d.ex = x1; d.ey = y1;
        }
        const x = Math.floor(Math.min(d.sx, x1)), y = Math.floor(Math.min(d.sy, y1));
        const w = Math.ceil(Math.max(d.sx, x1)) - x, h = Math.ceil(Math.max(d.sy, y1)) - y;
        const r = 'x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"';
        S.owner = true;
        v.setOverlay('<rect class="ants-bg" ' + r + '/><rect class="ants" ' + r + '/>');
        T.bus.emit('sizehint', w, h);
      } else if (d.mode === 'free') {
        d.pts.push({ x: U.clamp(p.x, 0, pg.w), y: U.clamp(p.y, 0, pg.h) });
        const dd = V.polyD(d.pts);
        S.owner = true;
        v.setOverlay('<path class="ants-bg" d="' + dd + '"/><path class="ants" d="' + dd + '"/>');
      } else {
        const c = S.cur;
        if (!c) return;
        if (d.mode === 'rotate') {
          const deg = (Math.atan2(p.y - d.cy, p.x - d.cx) - d.a0) * 180 / Math.PI;
          let a = d.angle0 + deg;
          a = ev.shiftKey ? Math.round(a / 15) * 15 : Math.round(a); // grado a grado; con Mayús, de 15 en 15
          a = normAngle(a);
          if (a !== c.rot.angle || !c.rot.out) { applyRotate(c, a, d.cx, d.cy); drawFloat(); }
          S.redraw();
          return;
        }
        if (d.mode === 'move') {
          c.x = Math.round(d.box.x + p.x - d.sx);
          c.y = Math.round(d.box.y + p.y - d.sy);
        } else {
          Object.assign(c, T.resizeBox(d.box, d.mode, p, ev.shiftKey));
          T.bus.emit('sizehint', c.w, c.h);
        }
        drawFloat();
        S.redraw();
      }
    },
    up() {
      const d = S.drag;
      S.drag = null;
      T.bus.emit('sizehint', null);
      if (!d) return;
      if (d.mode === 'rotate') { S.redraw(); return; }
      if (d.mode === 'rect') {
        const x = Math.floor(Math.min(d.sx, d.ex)), y = Math.floor(Math.min(d.sy, d.ey));
        const w = Math.ceil(Math.max(d.sx, d.ex)) - x, h = Math.ceil(Math.max(d.sy, d.ey)) - y;
        if (w < 1 || h < 1 || (w <= 1 && h <= 1)) { S.clear(); return; }
        S.select(x, y, w, h);
      } else if (d.mode === 'free') {
        if (d.pts.length < 3) { S.clear(); return; }
        const fm = freeMask(d.pts);
        if (!fm) { S.clear(); return; }
        S.select(fm.r.x, fm.r.y, fm.r.w, fm.r.h, fm.m);
      } else if (S.cur && S.cur.svg && d.mode !== 'move') {
        // vuelve a dibujar el vector al tamaño final para que quede nítido
        const c = S.cur, src = c.svg, w = c.w, h = c.h;
        T.svg.rasterize(src, w, h).then(cv => {
          if (S.cur === c && c.w === w && c.h === h) { c.float = cv; c.shown = null; drawFloat(); }
        }).catch(() => {});
      }
    },
    hover(p) {
      const c = S.cur, v = VW();
      if (!c) return 'crosshair';
      if (hitRot(c, p, v.sx)) return 'rotate';
      const h = T.hitBox(c, p, v.sx);
      return h ? T.handleCursor(h) : 'crosshair';
    }
  };
})();
