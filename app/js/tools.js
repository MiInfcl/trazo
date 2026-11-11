'use strict';
/* Trazo · herramientas: lápiz, relleno, borrador, cuentagotas, lupa, pinceles y formas. */
(function () {
  const T = window.T, U = T.util, V = T.vec;
  const Tools = T.tools = { current: 'pencil', map: {} };
  const view = () => T.view;
  const page = () => T.view.page;
  const st = () => T.state;

  /* Tamaños que ofrece cada grupo de herramientas. */
  Tools.sizeKey = function () {
    const t = st().tool;
    return t === 'pencil' ? 'pencil' : t === 'eraser' ? 'eraser' : t === 'shape' ? 'shape' : 'brush';
  };
  Tools.size = () => st().sizes[Tools.sizeKey()];
  Tools.opacity = () => st().opacities[Tools.sizeKey()] / 100;
  Tools.usesSize = () => ['pencil', 'eraser', 'brush', 'shape'].indexOf(st().tool) >= 0;
  Tools.setSize = function (v) {
    st().sizes[Tools.sizeKey()] = U.clamp(Math.round(v), 1, 100);
    T.bus.emit('toolopts');
    if (Tools.pendingShape) Tools.pendingShape.redraw();
  };
  Tools.setOpacity = function (v) {
    st().opacities[Tools.sizeKey()] = U.clamp(Math.round(v), 1, 100);
    T.bus.emit('toolopts');
  };

  Tools.set = function (name, sub) {
    if (name !== st().tool) {
      T.app.finishPending();
      if (name === 'picker') st().prevTool = st().tool;
    }
    st().tool = name;
    if (sub !== undefined) {
      if (name === 'brush') st().brush = sub;
      if (name === 'shape') st().shape = sub;
      if (name === 'select') st().selMode = sub;
    }
    Tools.current = name;
    T.bus.emit('tool');
  };

  function colorFor(btn) { return (btn === 2) === !st().swapped ? st().color2 : st().color1; }

  /* Vuelca la vista previa a la capa activa con la opacidad indicada. */
  function flushPreview(alpha, rect) {
    const L = page().active, v = view();
    L.ctx.save();
    L.ctx.globalAlpha = alpha;
    L.ctx.drawImage(v.preview, 0, 0);
    L.ctx.restore();
    v.clearPreview();
    return rect;
  }

  /* Convierte los píxeles de la vista previa en una ruta exacta. */
  function previewToPath(r) {
    const v = view();
    if (!r || !r.w || !r.h) return '';
    const d = v.pctx.getImageData(r.x, r.y, r.w, r.h).data;
    const bits = new Uint8Array(r.w * r.h);
    for (let i = 0; i < r.w * r.h; i++) bits[i] = d[i * 4 + 3] ? 1 : 0;
    return V.traceMask(bits, r.w, r.h, r.x, r.y);
  }

  /* ---------- Lápiz: píxeles duros ---------- */
  Tools.map.pencil = {
    cursor: 'none',
    down(p, ev) {
      const c = colorFor(ev.button), s = Tools.size();
      this.color = c; this.bbox = new U.BBox(); this.size = s;
      this.last = { x: Math.floor(p.x), y: Math.floor(p.y) };
      this.active = true;
      view().previewAlpha(Tools.opacity());
      this.plot(this.last.x, this.last.y);
    },
    plot(x, y) {
      const v = view(), s = this.size, o = Math.floor((s - 1) / 2);
      v.pctx.fillStyle = this.color;
      v.pctx.fillRect(x - o, y - o, s, s);
      this.bbox.add(x - o, y - o, s, s);
    },
    move(p) {
      if (!this.active) return;
      const x = Math.floor(p.x), y = Math.floor(p.y);
      U.line(this.last.x, this.last.y, x, y, (a, b) => this.plot(a, b));
      this.last = { x, y };
    },
    up() {
      if (!this.active) return;
      this.active = false;
      const pg = page(), r = this.bbox.rect(1, pg.w, pg.h), a = Tools.opacity();
      if (!r) { view().clearPreview(); return; }
      const d = previewToPath(r);
      const L = pg.active;
      flushPreview(a);
      if (d) L.pushVec(V.raw('<path shape-rendering="crispEdges" d="' + d + '" fill="' + this.color + '"' + (a < 1 ? ' opacity="' + V.n(a) + '"' : '') + '/>'));
      pg.commit('Lápiz', { rect: r });
    }
  };

  /* ---------- Borrador ---------- */
  Tools.map.eraser = {
    cursor: 'none',
    down(p, ev) {
      this.active = true;
      this.bbox = new U.BBox();
      this.size = Tools.size();
      this.alpha = Tools.opacity();
      this.replace = ev.button === 2; // botón derecho: cambia solo el color 1 por el 2
      this.mask = this.replace ? null : U.canvas(page().w, page().h);
      this.base = !this.replace && this.alpha < 1 ? U.cloneCanvas(page().active.canvas) : null;
      if (this.replace) { this.from = U.hexToRgb(st().color1); this.to = U.hexToRgb(st().color2); }
      this.last = { x: Math.floor(p.x), y: Math.floor(p.y) };
      this.plot(this.last.x, this.last.y);
    },
    plot(x, y) {
      const s = this.size, o = Math.floor((s - 1) / 2), pg = page(), L = pg.active;
      this.bbox.add(x - o, y - o, s, s);
      if (this.replace) {
        const r = U.rectClip({ x: x - o, y: y - o, w: s, h: s }, pg.w, pg.h);
        if (!r) return;
        const im = L.ctx.getImageData(r.x, r.y, r.w, r.h), d = im.data;
        for (let i = 0; i < d.length; i += 4) {
          if (d[i + 3] && d[i] === this.from[0] && d[i + 1] === this.from[1] && d[i + 2] === this.from[2]) { d[i] = this.to[0]; d[i + 1] = this.to[1]; d[i + 2] = this.to[2]; }
        }
        L.ctx.putImageData(im, r.x, r.y);
        return;
      }
      this.mask.ctx.fillRect(x - o, y - o, s, s);
      L.ctx.save();
      if (this.alpha < 1) {
        // con opacidad parcial cada píxel se borra una sola vez por trazo
        const r = U.rectClip({ x: x - o, y: y - o, w: s, h: s }, pg.w, pg.h);
        if (r) {
          L.ctx.clearRect(r.x, r.y, r.w, r.h);
          L.ctx.drawImage(this.base, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
          L.ctx.globalCompositeOperation = 'destination-out';
          L.ctx.globalAlpha = this.alpha;
          L.ctx.drawImage(this.mask, r.x, r.y, r.w, r.h, r.x, r.y, r.w, r.h);
        }
      } else {
        L.ctx.globalCompositeOperation = 'destination-out';
        L.ctx.fillRect(x - o, y - o, s, s);
      }
      L.ctx.restore();
    },
    move(p) {
      if (!this.active) return;
      const x = Math.floor(p.x), y = Math.floor(p.y);
      U.line(this.last.x, this.last.y, x, y, (a, b) => this.plot(a, b));
      this.last = { x, y };
    },
    up() {
      if (!this.active) return;
      this.active = false;
      const pg = page(), r = this.bbox.rect(1, pg.w, pg.h);
      if (!r) return;
      if (this.mask && this.alpha >= 1) {
        const d = this.mask.ctx.getImageData(r.x, r.y, r.w, r.h).data;
        const bits = new Uint8Array(r.w * r.h);
        for (let i = 0; i < r.w * r.h; i++) bits[i] = d[i * 4 + 3] ? 1 : 0;
        pg.active.pushVec(V.erase(V.traceMask(bits, r.w, r.h, r.x, r.y), pg.w, pg.h, true));
      }
      pg.commit('Borrador', { rect: r });
    }
  };

  /* ---------- Relleno ---------- */
  Tools.map.fill = {
    cursor: 'crosshair',
    down(p, ev) {
      const pg = page(), L = pg.active, x = Math.floor(p.x), y = Math.floor(p.y);
      if (x < 0 || y < 0 || x >= pg.w || y >= pg.h) return;
      const color = U.hexToRgb(colorFor(ev.button));
      const w = pg.w, h = pg.h;
      const im = L.ctx.getImageData(0, 0, w, h), d = new Uint32Array(im.data.buffer);
      const target = d[y * w + x];
      const fillV = (255 << 24 | color[2] << 16 | color[1] << 8 | color[0]) >>> 0;
      if (target === fillV) return;
      const mask = new Uint8Array(w * h);
      const stack = [x, y];
      let x0 = x, x1 = x, y0 = y, y1 = y;
      while (stack.length) {
        const cy = stack.pop();
        let cx = stack.pop();
        let i = cy * w + cx;
        if (mask[i] || d[i] !== target) continue;
        while (cx > 0 && d[i - 1] === target && !mask[i - 1]) { cx--; i--; }
        let up = false, down = false;
        for (; cx < w && d[i] === target && !mask[i]; cx++, i++) {
          mask[i] = 1; d[i] = fillV;
          if (cx < x0) x0 = cx; if (cx > x1) x1 = cx;
          if (cy < y0) y0 = cy; if (cy > y1) y1 = cy;
          if (cy > 0) {
            const a = d[i - w] === target && !mask[i - w];
            if (a && !up) stack.push(cx, cy - 1);
            up = a;
          }
          if (cy < h - 1) {
            const a = d[i + w] === target && !mask[i + w];
            if (a && !down) stack.push(cx, cy + 1);
            down = a;
          }
        }
      }
      L.ctx.putImageData(im, 0, 0);
      const rw = x1 - x0 + 1, rh = y1 - y0 + 1;
      const bits = new Uint8Array(rw * rh);
      for (let yy = 0; yy < rh; yy++) for (let xx = 0; xx < rw; xx++) bits[yy * rw + xx] = mask[(yy + y0) * w + xx + x0];
      const dd = V.traceMask(bits, rw, rh, x0, y0);
      L.pushVec(V.raw('<path shape-rendering="crispEdges" d="' + dd + '" fill="' + U.rgbToHex(color[0], color[1], color[2]) + '"/>'));
      pg.commit('Relleno', { rect: { x: x0, y: y0, w: rw, h: rh } });
    }
  };

  /* ---------- Cuentagotas ---------- */
  Tools.map.picker = {
    cursor: 'crosshair',
    down(p, ev) { this.btn = ev.button; this.active = true; this.apply(p); },
    move(p) { if (this.active) this.apply(p); },
    apply(p) {
      const c = page().pick(p.x, p.y);
      if (c) T.colors.set(this.btn === 2 ? 2 : 1, c);
    },
    up() {
      if (!this.active) return;
      this.active = false;
      Tools.set(st().prevTool || 'pencil');
    }
  };

  /* ---------- Lupa ---------- */
  Tools.map.magnifier = {
    cursor: 'zoom-in',
    down(p, ev) {
      const v = view();
      v.setZoom(v.stepZoom(ev.button === 2 ? -1 : 1), ev.clientX, ev.clientY);
    }
  };

  /* ---------- Pinceles ---------- */
  Tools.map.brush = {
    cursor: 'none',
    down(p, ev) {
      const v = view();
      this.kind = st().brush;
      this.alpha = Tools.opacity() * T.brushes.baseAlpha(this.kind);
      v.previewAlpha(this.alpha);
      this.stroke = new T.brushes.Stroke(v.pctx, this.kind, colorFor(ev.button), Tools.size());
      this.stroke.start(p.x, p.y);
      if (this.kind === 'airbrush') this.timer = setInterval(() => this.stroke && this.stroke.idle(), 40);
    },
    move(p) { if (this.stroke) this.stroke.to(p.x, p.y); },
    up() {
      const s = this.stroke;
      if (!s) return;
      clearInterval(this.timer);
      this.stroke = null;
      const pg = page(), r = s.bbox.rect(s.pad, pg.w, pg.h);
      flushPreview(this.alpha);
      const mk = s.vector(this.alpha);
      if (mk) pg.active.pushVec(V.raw(mk));
      pg.commit(T.brushes.KINDS.find(k => k.id === this.kind).name, r ? { rect: r } : null);
    }
  };

  /* ---------- Formas ---------- */
  const shapeStyle = () => {
    const s = st();
    return { outline: s.outline, fill: s.fill, colorOutline: s.color1, colorFill: s.color2, size: s.sizes.shape };
  };

  class PendingShape {
    constructor(sh, btn) { this.sh = sh; this.btn = btn; this.stage = 0; }
    style() {
      const o = shapeStyle();
      if (this.btn === 2) { const t = o.colorOutline; o.colorOutline = o.colorFill; o.colorFill = t; }
      return o;
    }
    alpha() { return Tools.opacity(); }
    redraw() {
      const v = view(), pg = page();
      v.clearPreview();
      v.previewAlpha(this.alpha());
      T.shapes.render(v.pctx, this.sh, this.style(), pg.w, pg.h);
      this.overlay();
    }
    box() {
      const sh = this.sh;
      if (sh.pts) return T.shapes.tightBox(sh);
      return { x: Math.min(sh.x0, sh.x1), y: Math.min(sh.y0, sh.y1), w: Math.abs(sh.x1 - sh.x0), h: Math.abs(sh.y1 - sh.y0) };
    }
    overlay() {
      const v = view(), sh = this.sh;
      if (sh.kind === 'line' || sh.kind === 'curve') {
        v.setOverlay('');
        v.setHandles(sh.pts.slice(0, 2).map(p => ({ x: p.x, y: p.y, round: true })));
        return;
      }
      if (sh.kind === 'polygon') { v.setOverlay(''); v.setHandles(null); return; }
      const b = this.box(), r = 'x="' + V.n(b.x) + '" y="' + V.n(b.y) + '" width="' + V.n(b.w) + '" height="' + V.n(b.h) + '"';
      v.setOverlay('<rect class="guide-bg" ' + r + '/><rect class="guide" ' + r + '/>');
      v.setHandles(T.boxHandles(b));
    }
    commit() {
      const v = view(), pg = page();
      v.clearPreview(); v.setOverlay(''); v.setHandles(null);
      const L = pg.active, a = this.alpha();
      L.ctx.save();
      L.ctx.globalAlpha = a;
      const mk = T.shapes.render(L.ctx, this.sh, this.style(), pg.w, pg.h);
      L.ctx.restore();
      if (mk) L.pushVec(V.raw(a < 1 ? '<g opacity="' + V.n(a) + '">' + mk + '</g>' : mk));
      pg.commit('Forma');
    }
    cancel() { const v = view(); v.clearPreview(); v.setOverlay(''); v.setHandles(null); }
  }
  T.bus.on('view', () => { if (Tools.pendingShape) Tools.pendingShape.overlay(); });
  T.bus.on('color', () => { if (Tools.pendingShape) Tools.pendingShape.redraw(); });
  T.bus.on('toolopts', () => { if (Tools.pendingShape) Tools.pendingShape.redraw(); });

  function constrain(sx, sy, p, ev, kind) {
    let x = p.x, y = p.y;
    if (ev.shiftKey) {
      if (kind === 'line' || kind === 'curve' || kind === 'polygon') {
        const a = Math.round(Math.atan2(y - sy, x - sx) / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(x - sx, y - sy);
        x = sx + Math.cos(a) * l; y = sy + Math.sin(a) * l;
      } else {
        const s = Math.max(Math.abs(x - sx), Math.abs(y - sy));
        x = sx + Math.sign(x - sx || 1) * s; y = sy + Math.sign(y - sy || 1) * s;
      }
    }
    return { x: Math.round(x), y: Math.round(y) };
  }

  Tools.map.shape = {
    cursor: 'crosshair',
    finish() {
      const P = Tools.pendingShape;
      if (!P) return;
      Tools.pendingShape = null;
      P.commit();
    },
    cancel() {
      const P = Tools.pendingShape;
      if (!P) return false;
      Tools.pendingShape = null;
      P.cancel();
      return true;
    },
    down(p, ev) {
      const P = Tools.pendingShape, v = view(), kind = st().shape;
      if (P) {
        const sh = P.sh;
        if (sh.kind === 'polygon') {
          const f = sh.pts[0], near = Math.hypot(p.x - f.x, p.y - f.y) * v.sx < 8;
          if (near && sh.pts.length > 2) { sh.pts.pop(); sh.closed = true; this.drag = null; P.redraw(); this.finish(); return; }
          const q = constrain(sh.pts[sh.pts.length - 1].x, sh.pts[sh.pts.length - 1].y, p, ev, 'polygon');
          sh.pts.push(q);
          this.drag = { mode: 'poly' };
          P.redraw();
          return;
        }
        if (sh.kind === 'curve' && P.stage < 3) {
          // dos arrastres para doblar la curva
          P.stage++;
          this.drag = { mode: 'bend', i: P.stage === 1 ? 2 : 3 };
          if (P.stage === 1) { sh.pts[2] = { x: p.x, y: p.y }; sh.pts[3] = { x: p.x, y: p.y }; } else sh.pts[3] = { x: p.x, y: p.y };
          P.redraw();
          return;
        }
        if (sh.kind === 'line' || sh.kind === 'curve') {
          for (let i = 0; i < 2; i++) {
            if (Math.hypot(p.x - sh.pts[i].x, p.y - sh.pts[i].y) * v.sx < 8) { this.drag = { mode: 'end', i }; return; }
          }
          this.finish();
        } else {
          const h = T.hitBox(P.box(), p, v.sx);
          if (h) {
            const b = P.box();
            this.drag = { mode: h, sx: p.x, sy: p.y, box: b, x0: sh.x0, y0: sh.y0, x1: sh.x1, y1: sh.y1 };
            return;
          }
          this.finish();
        }
      }
      const q = { x: Math.round(p.x), y: Math.round(p.y) };
      let sh;
      if (kind === 'line' || kind === 'curve') sh = { kind, pts: [q, { x: q.x, y: q.y }] };
      else if (kind === 'polygon') sh = { kind, pts: [q, { x: q.x, y: q.y }], closed: false };
      else sh = { kind, x0: q.x, y0: q.y, x1: q.x, y1: q.y };
      Tools.pendingShape = new PendingShape(sh, ev.button);
      this.drag = { mode: 'new', sx: q.x, sy: q.y };
    },
    move(p, ev) {
      const d = this.drag, P = Tools.pendingShape;
      if (!d || !P) return;
      const sh = P.sh;
      if (d.mode === 'new') {
        const q = constrain(d.sx, d.sy, p, ev, sh.kind);
        if (sh.pts) sh.pts[1] = q; else { sh.x1 = q.x; sh.y1 = q.y; }
        T.bus.emit('sizehint', Math.abs(q.x - d.sx), Math.abs(q.y - d.sy));
      } else if (d.mode === 'poly') {
        const n = sh.pts.length;
        sh.pts[n - 1] = constrain(sh.pts[n - 2].x, sh.pts[n - 2].y, p, ev, 'polygon');
      } else if (d.mode === 'bend') {
        sh.pts[d.i] = { x: p.x, y: p.y };
        if (d.i === 2) sh.pts[3] = { x: p.x, y: p.y };
      } else if (d.mode === 'end') {
        sh.pts[d.i] = { x: Math.round(p.x), y: Math.round(p.y) };
      } else if (d.mode === 'move') {
        const dx = Math.round(p.x - d.sx), dy = Math.round(p.y - d.sy);
        sh.x0 = d.x0 + dx; sh.x1 = d.x1 + dx; sh.y0 = d.y0 + dy; sh.y1 = d.y1 + dy;
      } else {
        const b = T.resizeBox(d.box, d.mode, p, ev.shiftKey);
        const fx = d.x1 < d.x0, fy = d.y1 < d.y0;
        sh.x0 = fx ? b.x + b.w : b.x; sh.x1 = fx ? b.x : b.x + b.w;
        sh.y0 = fy ? b.y + b.h : b.y; sh.y1 = fy ? b.y : b.y + b.h;
      }
      P.redraw();
    },
    up() {
      const d = this.drag, P = Tools.pendingShape;
      this.drag = null;
      T.bus.emit('sizehint', null);
      if (!d || !P) return;
      if (d.mode === 'new') {
        const sh = P.sh;
        const empty = sh.pts ? (sh.pts[0].x === sh.pts[1].x && sh.pts[0].y === sh.pts[1].y) : (sh.x0 === sh.x1 || sh.y0 === sh.y1);
        if (empty && sh.kind !== 'polygon') { this.cancel(); return; }
        P.redraw();
      }
      if (d.mode === 'bend' && P.stage >= 2) { P.stage = 3; P.redraw(); }
    },
    dblclick() {
      const P = Tools.pendingShape;
      if (P && P.sh.kind === 'polygon') {
        if (P.sh.pts.length > 3) P.sh.pts.pop();
        P.sh.closed = true;
        this.drag = null;
        P.redraw();
        this.finish();
      }
    },
    hover(p) {
      const P = Tools.pendingShape, v = view();
      if (!P) return 'crosshair';
      const sh = P.sh;
      if (sh.kind === 'polygon') return 'crosshair';
      if (sh.kind === 'line' || sh.kind === 'curve') {
        return P.stage === 3 || sh.kind === 'line' ? (sh.pts.slice(0, 2).some(q => Math.hypot(p.x - q.x, p.y - q.y) * v.sx < 8) ? 'grab' : 'crosshair') : 'crosshair';
      }
      const h = T.hitBox(P.box(), p, v.sx);
      return h ? T.handleCursor(h) : 'crosshair';
    }
  };

  /* ---------- Reparto de eventos ---------- */
  Tools.init = function () {
    Tools.map.select = T.selection.tool;
    Tools.map.text = T.text.tool;
    const v = view(), ws = v.ws;
    let activeId = null, active = null, panning = null;

    const tool = () => Tools.map[st().tool];

    function onCanvas(ev) {
      const r = v.wrap.getBoundingClientRect();
      return ev.clientX >= r.left && ev.clientX < r.right && ev.clientY >= r.top && ev.clientY < r.bottom;
    }

    ws.addEventListener('contextmenu', ev => {
      ev.preventDefault();
      if (st().tool === 'select' && onCanvas(ev)) T.ui.menu({ x: ev.clientX, y: ev.clientY }, T.ribbon.editMenu);
    });
    ws.addEventListener('pointerdown', ev => {
      // no empezar sobre las barras de desplazamiento ni sobre el editor de texto
      if (ev.target === ws && (ev.offsetX >= ws.clientWidth || ev.offsetY >= ws.clientHeight)) return;
      if (ev.target.closest && ev.target.closest('.text-editor')) return;
      if (ev.target.classList && ev.target.classList.contains('canvas-handle')) return;
      if (ev.button === 1 || (T.app.spaceDown && ev.button === 0)) {
        panning = { x: ev.clientX, y: ev.clientY, l: ws.scrollLeft, t: ws.scrollTop };
        ws.setPointerCapture(ev.pointerId);
        ws.style.cursor = 'grabbing';
        ev.preventDefault();
        return;
      }
      if (ev.button !== 0 && ev.button !== 2) return;
      ws.focus({ preventScroll: true });
      const t = tool();
      const inside = onCanvas(ev);
      const modal = T.selection.cur || Tools.pendingShape || T.text.editing;
      if (!inside && !modal) return;
      if (!inside && st().tool !== 'select' && st().tool !== 'shape' && st().tool !== 'text') return;
      if (T.selection.cur && st().tool !== 'select') T.selection.commit();
      activeId = ev.pointerId; active = t;
      ws.setPointerCapture(ev.pointerId);
      ev.preventDefault();
      t.down(v.toImage(ev.clientX, ev.clientY), ev);
    });
    ws.addEventListener('pointermove', ev => {
      if (panning) {
        ws.scrollLeft = panning.l - (ev.clientX - panning.x);
        ws.scrollTop = panning.t - (ev.clientY - panning.y);
        return;
      }
      const p = v.toImage(ev.clientX, ev.clientY);
      v.pointer = { cx: ev.clientX, cy: ev.clientY };
      T.bus.emit('pointer', p, onCanvas(ev));
      v.drawRulers();
      if (ev.pointerId === activeId && active && active.move) {
        const list = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [];
        if (list.length > 1) { for (const e of list) active.move(v.toImage(e.clientX, e.clientY), e); }
        else active.move(p, ev);
      } else if (activeId === null) hover(p, ev);
      updateCursor(ev);
    });
    const finish = ev => {
      if (panning) { panning = null; ws.style.cursor = ''; refreshCursor(); return; }
      if (ev.pointerId !== activeId) return;
      const t = active;
      activeId = null; active = null;
      if (t && t.up) t.up(v.toImage(ev.clientX, ev.clientY), ev);
      refreshCursor();
    };
    ws.addEventListener('pointerup', finish);
    ws.addEventListener('pointercancel', finish);
    ws.addEventListener('dblclick', () => { const t = tool(); if (t.dblclick) t.dblclick(); });
    ws.addEventListener('pointerleave', () => { v.brushCursor(null); v.pointer = null; T.bus.emit('pointer', null, false); v.drawRulers(); });

    function hover(p) {
      const t = tool();
      const c = t.hover ? t.hover(p) : t.cursor;
      ws.style.cursor = c || 'default';
    }
    function refreshCursor() { const t = tool(); ws.style.cursor = t.cursor === 'none' ? 'none' : t.cursor || 'default'; }
    function updateCursor(ev) {
      const t = tool();
      if (t.cursor === 'none' && onCanvas(ev)) {
        const zoomed = Tools.size() * v.sx;
        v.brushCursor(ev.clientX, ev.clientY, zoomed, st().tool !== 'brush');
        ws.style.cursor = 'none';
      } else {
        v.brushCursor(null);
        if (t.cursor === 'none') ws.style.cursor = 'crosshair';
      }
    }
    T.bus.on('tool', () => { v.brushCursor(null); refreshCursor(); });
    refreshCursor();
  };
})();
