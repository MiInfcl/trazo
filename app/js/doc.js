'use strict';
/* Trazo · modelo del documento: páginas (una por resolución en los ICO), capas e historial.
 * Las herramientas solo pintan en layer.ctx y llaman a page.commit(): el historial se
 * calcula solo comparando con la última instantánea, y la sombra vectorial se mantiene
 * exacta (si la herramienta no dio su equivalente vectorial, se guarda un parche de imagen). */
(function () {
  const T = window.T, U = T.util, V = T.vec;
  let lid = 1;
  const HISTORY_MAX = 60;
  const HISTORY_BYTES = 640 * 1024 * 1024;

  class Layer {
    constructor(w, h, name, id) {
      this.id = id || ('L' + (lid++));
      this.name = name || 'Capa';
      this.visible = true;
      this.canvas = U.canvas(w, h);
      this.canvas.className = 'layer';
      this.ctx = this.canvas.ctx;
      this.vec = V.EMPTY;
      this._vecExplicit = false;
      this._touched = false;
    }
    /* Añade el equivalente vectorial de lo recién pintado. */
    pushVec(op) { this.vec = this.vec.concat([op]); this._vecExplicit = true; }
    setVec(v) { this.vec = v; this._vecExplicit = true; }
    resize(w, h) {
      this.canvas.width = Math.max(1, w); this.canvas.height = Math.max(1, h);
    }
  }

  /* Rectángulo mínimo que difiere entre dos lienzos del mismo tamaño (o null). */
  function diffRect(a, b, hint) {
    const W = a.width, H = a.height;
    const r = hint ? U.rectClip(hint, W, H) : { x: 0, y: 0, w: W, h: H };
    if (!r) return null;
    const da = new Uint32Array(a.ctx.getImageData(r.x, r.y, r.w, r.h).data.buffer);
    const db = new Uint32Array(b.ctx.getImageData(r.x, r.y, r.w, r.h).data.buffer);
    const w = r.w, h = r.h;
    let top = -1;
    for (let i = 0, n = w * h; i < n; i++) if (da[i] !== db[i]) { top = (i / w) | 0; break; }
    if (top < 0) return null;
    let bottom = top;
    for (let i = w * h - 1; i >= (top + 1) * w; i--) if (da[i] !== db[i]) { bottom = (i / w) | 0; break; }
    let left = w, right = -1;
    for (let y = top; y <= bottom; y++) {
      const o = y * w;
      for (let x = 0; x < left; x++) if (da[o + x] !== db[o + x]) { left = x; break; }
      for (let x = w - 1; x > right; x--) if (da[o + x] !== db[o + x]) { right = x; break; }
    }
    return { x: r.x + left, y: r.y + top, w: right - left + 1, h: bottom - top + 1 };
  }

  class Page {
    constructor(w, h, opts) {
      opts = opts || {};
      this.w = Math.max(1, Math.round(w));
      this.h = Math.max(1, Math.round(h));
      this.bg = { color: opts.bgColor || '#ffffff', visible: !opts.transparent };
      this.layers = [];
      this.undoStack = [];
      this.redoStack = [];
      this._seq = 1;
      const L = new Layer(this.w, this.h, T.tr('Capa') + ' 1');
      this.layers.push(L);
      this.activeId = L.id;
      this.rebase();
    }

    /* Página a partir de una imagen ya decodificada (lienzo). */
    static fromCanvas(src, opts) {
      const p = new Page(src.width, src.height, opts);
      const L = p.layers[0];
      L.ctx.drawImage(src, 0, 0);
      L.vec = [V.img(0, 0, p.w, p.h, L.ctx.getImageData(0, 0, p.w, p.h))];
      p.rebase();
      return p;
    }

    get active() { return this.layers.find(l => l.id === this.activeId) || this.layers[this.layers.length - 1]; }
    get activeIndex() { return this.layers.indexOf(this.active); }
    layer(id) { return this.layers.find(l => l.id === id) || null; }
    get canUndo() { return this.undoStack.length > 0; }
    get canRedo() { return this.redoStack.length > 0; }

    /* ---------- Historial ---------- */
    _capture(prev) {
      const prevMap = new Map();
      if (prev && prev.w === this.w && prev.h === this.h) for (const s of prev.layers) prevMap.set(s.id, s);
      return {
        w: this.w, h: this.h,
        bg: { color: this.bg.color, visible: this.bg.visible },
        activeId: this.activeId,
        layers: this.layers.map(L => {
          const p = prevMap.get(L.id);
          let snap = null;
          if (p) {
            const r = diffRect(p.snap, L.canvas);
            if (!r) snap = p.snap;
            else if (!L._vecExplicit) L.vec = V.autoPatch(L.vec, r, this.w, this.h, q => L.ctx.getImageData(q.x, q.y, q.w, q.h));
          }
          if (!snap) snap = U.cloneCanvas(L.canvas);
          L._vecExplicit = false; L._touched = false;
          return { id: L.id, name: L.name, visible: L.visible, snap, vec: L.vec };
        })
      };
    }

    /* Fija el estado actual como punto de partida, sin historial. */
    rebase() {
      this._base = this._capture(null);
      this.undoStack.length = 0;
      this.redoStack.length = 0;
    }

    /* Registra un paso de historial con lo que haya cambiado. Devuelve true si hubo cambio.
     * opts.all: revisar todas las capas (por defecto, la activa y las marcadas _touched).
     * opts.rect: zona máxima donde pudo cambiar algo (acelera la comparación). */
    commit(label, opts) {
      opts = opts || {};
      const base = this._base;
      const same = base.w === this.w && base.h === this.h && base.layers.length === this.layers.length &&
        base.layers.every((b, i) => b.id === this.layers[i].id);
      let entry;
      if (same) {
        const act = this.active;
        const patches = [];
        let bytes = 0;
        this.layers.forEach((L, i) => {
          const b = base.layers[i];
          let rect = null, before = null, after = null;
          if (opts.all || L === act || L._touched) {
            rect = diffRect(b.snap, L.canvas, opts.rect);
            if (rect) {
              before = b.snap.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
              after = L.ctx.getImageData(rect.x, rect.y, rect.w, rect.h);
              if (!L._vecExplicit) L.vec = V.autoPatch(L.vec, rect, this.w, this.h, q => L.ctx.getImageData(q.x, q.y, q.w, q.h));
              b.snap.ctx.putImageData(after, rect.x, rect.y);
              bytes += before.data.length * 2;
            }
          }
          if (rect || b.vec !== L.vec || b.name !== L.name || b.visible !== L.visible) {
            patches.push({ i, rect, before, after, vec0: b.vec, vec1: L.vec, name0: b.name, name1: L.name, vis0: b.visible, vis1: L.visible });
            b.vec = L.vec; b.name = L.name; b.visible = L.visible;
          }
          L._vecExplicit = false; L._touched = false;
        });
        const bg0 = base.bg, bg1 = { color: this.bg.color, visible: this.bg.visible };
        const bgChanged = bg0.color !== bg1.color || bg0.visible !== bg1.visible;
        const act0 = base.activeId, act1 = this.activeId;
        base.activeId = act1;
        if (!patches.length && !bgChanged) return false;
        base.bg = bg1;
        entry = { type: 'patch', label, patches, bg0, bg1, act0, act1, bytes };
      } else {
        const next = this._capture(base);
        let bytes = 0;
        const old = new Set(base.layers.map(s => s.snap));
        for (const s of next.layers) if (!old.has(s.snap)) bytes += s.snap.width * s.snap.height * 4;
        entry = { type: 'full', label, before: base, after: next, bytes };
        this._base = next;
      }
      this.undoStack.push(entry);
      this.redoStack.length = 0;
      this._trim();
      T.bus.emit('history', this, label);
      return true;
    }

    _trim() {
      let total = 0;
      for (const e of this.undoStack) total += e.bytes || 0;
      while (this.undoStack.length > HISTORY_MAX || (total > HISTORY_BYTES && this.undoStack.length > 1)) {
        total -= this.undoStack.shift().bytes || 0;
      }
    }

    _apply(e, redo) {
      if (e.type === 'patch') {
        const base = this._base;
        for (const p of e.patches) {
          const L = this.layers[p.i], b = base.layers[p.i];
          if (p.rect) {
            const im = redo ? p.after : p.before;
            L.ctx.putImageData(im, p.rect.x, p.rect.y);
            b.snap.ctx.putImageData(im, p.rect.x, p.rect.y);
          }
          L.vec = b.vec = redo ? p.vec1 : p.vec0;
          L.name = b.name = redo ? p.name1 : p.name0;
          L.visible = b.visible = redo ? p.vis1 : p.vis0;
          L._vecExplicit = false; L._touched = false;
        }
        const bg = redo ? e.bg1 : e.bg0;
        this.bg = { color: bg.color, visible: bg.visible };
        base.bg = { color: bg.color, visible: bg.visible };
        this.activeId = base.activeId = redo ? e.act1 : e.act0;
        T.bus.emit('structure', this);
      } else {
        this._restore(redo ? e.after : e.before);
      }
    }

    _restore(state) {
      this.w = state.w; this.h = state.h;
      this.bg = { color: state.bg.color, visible: state.bg.visible };
      const old = new Map(this.layers.map(l => [l.id, l]));
      this.layers = state.layers.map(s => {
        let L = old.get(s.id);
        if (!L) L = new Layer(state.w, state.h, s.name, s.id);
        if (L.canvas.width !== state.w || L.canvas.height !== state.h) L.resize(state.w, state.h);
        else L.ctx.clearRect(0, 0, state.w, state.h);
        L.ctx.setTransform(1, 0, 0, 1, 0, 0);
        L.ctx.globalAlpha = 1; L.ctx.globalCompositeOperation = 'source-over';
        L.ctx.drawImage(s.snap, 0, 0);
        L.vec = s.vec; L.name = s.name; L.visible = s.visible;
        L._vecExplicit = false; L._touched = false;
        return L;
      });
      this.activeId = this.layers.some(l => l.id === state.activeId) ? state.activeId : this.layers[this.layers.length - 1].id;
      this._base = state;
      T.bus.emit('structure', this);
    }

    undo() {
      const e = this.undoStack.pop();
      if (!e) return false;
      this._apply(e, false);
      this.redoStack.push(e);
      T.bus.emit('history', this, null);
      return true;
    }
    redo() {
      const e = this.redoStack.pop();
      if (!e) return false;
      this._apply(e, true);
      this.undoStack.push(e);
      T.bus.emit('history', this, null);
      return true;
    }

    /* Descarta cambios no confirmados: vuelve a la última instantánea. */
    revert() { this._restore(this._base); }

    /* ---------- Capas ---------- */
    addLayer() {
      let n = this.layers.length + 1;
      while (this.layers.some(l => l.name === T.tr('Capa') + ' ' + n)) n++;
      const L = new Layer(this.w, this.h, T.tr('Capa') + ' ' + n);
      this.layers.splice(this.activeIndex + 1, 0, L);
      this.activeId = L.id;
      T.bus.emit('structure', this);
      this.commit('Agregar capa');
      return L;
    }
    removeLayer(id) {
      if (this.layers.length <= 1) return false;
      const i = this.layers.findIndex(l => l.id === id);
      if (i < 0) return false;
      this.layers.splice(i, 1);
      if (this.activeId === id) this.activeId = this.layers[Math.max(0, i - 1)].id;
      T.bus.emit('structure', this);
      this.commit('Eliminar capa');
      return true;
    }
    duplicateLayer(id) {
      const i = this.layers.findIndex(l => l.id === id);
      if (i < 0) return null;
      const src = this.layers[i];
      const L = new Layer(this.w, this.h, src.name + T.tr(' (copia)'));
      L.ctx.drawImage(src.canvas, 0, 0);
      L.vec = src.vec;
      L.visible = src.visible;
      this.layers.splice(i + 1, 0, L);
      this.activeId = L.id;
      T.bus.emit('structure', this);
      this.commit('Duplicar capa');
      return L;
    }
    mergeDown(id) {
      const i = this.layers.findIndex(l => l.id === id);
      if (i <= 0) return false;
      const up = this.layers[i], low = this.layers[i - 1];
      low.ctx.setTransform(1, 0, 0, 1, 0, 0);
      low.ctx.globalAlpha = 1; low.ctx.globalCompositeOperation = 'source-over';
      low.ctx.drawImage(up.canvas, 0, 0);
      low.setVec(V.hasContent(up.vec) ? low.vec.concat([V.group(up.vec)]) : low.vec);
      low.visible = low.visible || up.visible;
      this.layers.splice(i, 1);
      this.activeId = low.id;
      T.bus.emit('structure', this);
      this.commit('Combinar hacia abajo');
      return true;
    }
    moveLayer(id, delta) {
      const i = this.layers.findIndex(l => l.id === id);
      const j = i + delta;
      if (i < 0 || j < 0 || j >= this.layers.length) return false;
      const L = this.layers.splice(i, 1)[0];
      this.layers.splice(j, 0, L);
      T.bus.emit('structure', this);
      this.commit('Mover capa');
      return true;
    }
    moveLayerTo(id, index) {
      const i = this.layers.findIndex(l => l.id === id);
      if (i < 0) return false;
      index = U.clamp(index, 0, this.layers.length - 1);
      if (i === index) return false;
      const L = this.layers.splice(i, 1)[0];
      this.layers.splice(index, 0, L);
      T.bus.emit('structure', this);
      this.commit('Mover capa');
      return true;
    }
    setLayerVisible(id, v) {
      const L = this.layer(id);
      if (!L || L.visible === v) return;
      L.visible = v;
      T.bus.emit('structure', this);
      this.commit(v ? 'Mostrar capa' : 'Ocultar capa');
    }
    setActive(id) {
      if (this.activeId === id || !this.layer(id)) return;
      this.activeId = id;
      this._base.activeId = id;
      T.bus.emit('structure', this);
    }
    setBackground(color, visible) {
      if (color != null) this.bg.color = color;
      if (visible != null) this.bg.visible = visible;
      T.bus.emit('structure', this);
      this.commit('Fondo');
    }

    /* ---------- Operaciones sobre toda la imagen ---------- */
    _each(fn) {
      for (const L of this.layers) {
        const tmp = U.cloneCanvas(L.canvas);
        fn(L, tmp);
        L.ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }

    /* Cambia el tamaño del lienzo. ox y oy desplazan el contenido (al tirar desde arriba o la izquierda). */
    resizeCanvas(nw, nh, ox, oy) {
      nw = Math.max(1, Math.round(nw)); nh = Math.max(1, Math.round(nh));
      ox = Math.round(ox || 0); oy = Math.round(oy || 0);
      if (nw === this.w && nh === this.h && !ox && !oy) return false;
      const cx = Math.max(0, -ox), cy = Math.max(0, -oy);
      const clip = { x: cx, y: cy, w: Math.max(1, Math.min(this.w, nw - ox) - cx), h: Math.max(1, Math.min(this.h, nh - oy) - cy) };
      this._each((L, tmp) => {
        L.resize(nw, nh);
        L.ctx.drawImage(tmp, ox, oy);
        if (L.vec.length) L.setVec(L.vec.concat([V.wrap(ox || oy ? V.matrix(1, 0, 0, 1, ox, oy) : null, clip)]));
      });
      this.w = nw; this.h = nh;
      T.bus.emit('structure', this);
      this.commit('Cambiar tamaño del lienzo');
      return true;
    }

    /* Recorta la imagen a un rectángulo; maskCanvas (opcional, del tamaño del recorte)
     * deja transparente lo que quede fuera de una selección de forma libre. */
    crop(x, y, w, h, maskCanvas, maskD) {
      const r = U.rectClip({ x, y, w, h }, this.w, this.h);
      if (!r) return false;
      this._each((L, tmp) => {
        L.resize(r.w, r.h);
        L.ctx.drawImage(tmp, -r.x, -r.y);
        if (maskCanvas) {
          L.ctx.globalCompositeOperation = 'destination-in';
          L.ctx.drawImage(maskCanvas, 0, 0);
          L.ctx.globalCompositeOperation = 'source-over';
        }
        if (L.vec.length) {
          let v = L.vec.concat([V.wrap(V.matrix(1, 0, 0, 1, -r.x, -r.y), { x: r.x, y: r.y, w: r.w, h: r.h })]);
          if (maskD) v = v.concat([V.erase('M0 0h' + r.w + 'v' + r.h + 'h-' + r.w + 'z' + maskD, r.w, r.h, true)]);
          L.setVec(v);
        }
      });
      this.w = r.w; this.h = r.h;
      T.bus.emit('structure', this);
      this.commit('Recortar');
      return true;
    }

    /* kind: 'r90' (derecha), 'r270' (izquierda), 'r180', 'fh', 'fv'. */
    transform(kind) {
      const w = this.w, h = this.h;
      const swap = kind === 'r90' || kind === 'r270';
      const nw = swap ? h : w, nh = swap ? w : h;
      const m = {
        r90: [0, 1, -1, 0, h, 0], r270: [0, -1, 1, 0, 0, w], r180: [-1, 0, 0, -1, w, h],
        fh: [-1, 0, 0, 1, w, 0], fv: [1, 0, 0, -1, 0, h]
      }[kind];
      if (!m) return false;
      this._each((L, tmp) => {
        if (swap) L.resize(nw, nh); else L.ctx.clearRect(0, 0, w, h);
        L.ctx.imageSmoothingEnabled = false;
        L.ctx.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);
        L.ctx.drawImage(tmp, 0, 0);
        if (L.vec.length) L.setVec(L.vec.concat([V.wrap(V.matrix.apply(null, m), null)]));
      });
      this.w = nw; this.h = nh;
      T.bus.emit('structure', this);
      this.commit({ r90: 'Girar a la derecha', r270: 'Girar a la izquierda', r180: 'Girar 180°', fh: 'Voltear horizontalmente', fv: 'Voltear verticalmente' }[kind], { all: true });
      return true;
    }

    /* Escala toda la imagen. renderVec(layer, nw, nh) → Promise<canvas|null> permite
     * volver a dibujar desde el vector (nítido) las capas que son vector puro. */
    async scaleTo(nw, nh, renderVec) {
      nw = Math.max(1, Math.round(nw)); nh = Math.max(1, Math.round(nh));
      if (nw === this.w && nh === this.h) return false;
      const sx = nw / this.w, sy = nh / this.h;
      const crisp = new Map();
      if (renderVec) {
        for (const L of this.layers) {
          if (V.hasContent(L.vec) && V.isPure(L.vec)) {
            try { const c = await renderVec(this, L, nw, nh); if (c) crisp.set(L.id, c); } catch (e) { /* se escala el mapa de bits */ }
          }
        }
      }
      this._each((L, tmp) => {
        L.resize(nw, nh);
        const c = crisp.get(L.id);
        if (c) L.ctx.drawImage(c, 0, 0);
        else {
          L.ctx.imageSmoothingEnabled = true; L.ctx.imageSmoothingQuality = 'high';
          drawScaled(L.ctx, tmp, nw, nh);
        }
        if (L.vec.length) L.setVec(L.vec.concat([V.wrap(V.matrix(sx, 0, 0, sy, 0, 0), null)]));
      });
      this.w = nw; this.h = nh;
      T.bus.emit('structure', this);
      this.commit('Cambiar tamaño');
      return true;
    }

    /* Sesga (inclina) la imagen: grados en horizontal y vertical. */
    skew(degX, degY) {
      let did = false;
      const step = (tx, ty) => {
        const w = this.w, h = this.h;
        const nw = Math.round(w + Math.abs(tx) * h), nh = Math.round(h + Math.abs(ty) * w);
        const ex = tx < 0 ? -tx * h : 0, ey = ty < 0 ? -ty * w : 0;
        this._each((L, tmp) => {
          L.resize(nw, nh);
          L.ctx.imageSmoothingEnabled = true; L.ctx.imageSmoothingQuality = 'high';
          L.ctx.setTransform(1, ty, tx, 1, ex, ey);
          L.ctx.drawImage(tmp, 0, 0);
          if (L.vec.length) L.setVec(L.vec.concat([V.wrap(V.matrix(1, ty, tx, 1, ex, ey), { x: 0, y: 0, w, h })]));
        });
        this.w = nw; this.h = nh;
        did = true;
      };
      if (degX) step(Math.tan(degX * Math.PI / 180), 0);
      if (degY) step(0, Math.tan(degY * Math.PI / 180));
      if (!did) return false;
      T.bus.emit('structure', this);
      this.commit('Sesgar');
      return true;
    }

    /* ---------- Lectura ---------- */
    /* Imagen final (capas visibles; con el fondo si está visible y withBg no es false). */
    composite(withBg) {
      const c = U.canvas(this.w, this.h);
      if (this.bg.visible && withBg !== false) { c.ctx.fillStyle = this.bg.color; c.ctx.fillRect(0, 0, this.w, this.h); }
      for (const L of this.layers) if (L.visible) c.ctx.drawImage(L.canvas, 0, 0);
      return c;
    }
    get hasTransparency() {
      if (this.bg.visible) return false;
      const d = this.composite().ctx.getImageData(0, 0, this.w, this.h).data;
      for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
      return false;
    }
    /* Color visible en un píxel (hex) o null si está fuera. */
    pick(x, y) {
      x = Math.floor(x); y = Math.floor(y);
      if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
      let r = 255, g = 255, b = 255, a = 0;
      if (this.bg.visible) { const c = U.hexToRgb(this.bg.color); r = c[0]; g = c[1]; b = c[2]; a = 255; }
      for (const L of this.layers) {
        if (!L.visible) continue;
        const d = L.ctx.getImageData(x, y, 1, 1).data;
        const sa = d[3] / 255;
        if (!sa) continue;
        const da = a / 255, oa = sa + da * (1 - sa);
        r = (d[0] * sa + r * da * (1 - sa)) / oa;
        g = (d[1] * sa + g * da * (1 - sa)) / oa;
        b = (d[2] * sa + b * da * (1 - sa)) / oa;
        a = oa * 255;
      }
      if (a < 1) return null;
      return U.rgbToHex(Math.round(r), Math.round(g), Math.round(b));
    }
  }

  /* Escalado de calidad: al reducir mucho, baja por mitades para no perder detalle. */
  function drawScaled(ctx, src, nw, nh) {
    let cur = src, cw = src.width, ch = src.height;
    while (cw / 2 >= nw && ch / 2 >= nh && cw > 2 && ch > 2) {
      const hw = Math.max(1, Math.round(cw / 2)), hh = Math.max(1, Math.round(ch / 2));
      const t = U.canvas(hw, hh);
      t.ctx.imageSmoothingEnabled = true; t.ctx.imageSmoothingQuality = 'high';
      t.ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, hw, hh);
      cur = t; cw = hw; ch = hh;
    }
    ctx.drawImage(cur, 0, 0, cw, ch, 0, 0, nw, nh);
  }
  U.drawScaled = drawScaled;

  class Doc {
    constructor(pages, opts) {
      opts = opts || {};
      this.pages = pages;
      this.index = 0;
      this.name = opts.name || T.tr('Sin título');
      this.titled = !!opts.name;
      this.format = opts.format || null;   // 'png' | 'jpg' | 'bmp' | 'gif' | 'webp' | 'ico' | 'svg' | 'trazo'
      this.kind = opts.kind || 'image';    // 'image' | 'icon' (varias resoluciones)
      this.handle = opts.handle || null;   // identificador para volver a guardar en el mismo archivo
      this.fileSize = opts.fileSize == null ? null : opts.fileSize;
      this.savedAt = opts.savedAt || null;
      this.svgMode = 'vector';
      this.icoPng = 'auto';
      this.dirty = false;
    }
    get page() { return this.pages[this.index]; }
  }

  T.Layer = Layer;
  T.Page = Page;
  T.Doc = Doc;
  T.docUtil = { diffRect };
})();
