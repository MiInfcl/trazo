'use strict';
/* Trazo · vista del lienzo: pila de capas en pantalla, zoom, desplazamiento, reglas,
 * cuadrícula, tiradores para cambiar el tamaño del lienzo y capas de adorno (selección). */
(function () {
  const T = window.T, U = T.util;
  const $ = id => document.getElementById(id);
  const MARGIN = 64; // deja libres los deslizadores laterales

  const V = T.view = {
    zoom: 1,
    page: null,
    MIN: 0.125,
    MAX: 64,
    STEPS: [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 24, 32, 48, 64],
    PRESETS: [0.125, 0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8, 16, 32, 64],
    pointer: null
  };

  V.init = function () {
    V.ws = $('workspace'); V.stage = $('stage'); V.wrap = $('canvasWrap');
    V.stack = $('layerStack'); V.bgEl = $('bgColor'); V.checker = $('checker');
    V.svg = $('overlaySvg'); V.dom = $('overlayDom'); V.gridCanvas = $('gridCanvas');
    V.rTop = $('rulerTop'); V.rLeft = $('rulerLeft'); V.rCorner = $('rulerCorner');
    V.ghost = $('resizeGhost'); V.cursorEl = $('brushCursor'); V.area = $('workarea');
    V.handles = Array.from(V.stage.querySelectorAll('.canvas-handle'));
    V.preview = U.canvas(1, 1);
    V.preview.className = 'preview';
    V.pctx = V.preview.ctx;

    V.ws.addEventListener('scroll', () => { V.drawGrid(); V.drawRulers(); }, { passive: true });
    new ResizeObserver(() => V.layout()).observe(V.ws);
    V.ws.addEventListener('wheel', ev => {
      if (ev.ctrlKey || ev.metaKey) {
        ev.preventDefault();
        const dir = ev.deltaY < 0 ? 1 : -1;
        V.setZoom(V.stepZoom(dir), ev.clientX, ev.clientY);
      }
    }, { passive: false });

    for (const h of V.handles) h.addEventListener('pointerdown', ev => startCanvasResize(ev, h));
    T.bus.on('structure', page => { if (page === V.page) { V.rebuild(); V.layout(); } });
    T.bus.on('viewopts', () => { V.applyOptions(); });
    matchMedia('(resolution: 1dppx)').addEventListener('change', () => { V.drawGrid(); V.drawRulers(); });
  };

  /* ---------- Página en pantalla ---------- */
  V.setPage = function (page, keepZoom) {
    V.page = page;
    V.rebuild();
    if (!keepZoom) V.zoom = V.initialZoom(page);
    V.layout();
    V.ws.scrollLeft = 0; V.ws.scrollTop = 0;
    T.bus.emit('view');
  };

  V.initialZoom = function (page) {
    const vw = V.ws.clientWidth - 2 * MARGIN, vh = V.ws.clientHeight - 2 * MARGIN;
    if (vw <= 0 || vh <= 0) return 1;
    const fit = Math.min(vw / page.w, vh / page.h);
    if (fit < 1) return Math.max(V.MIN, snapDown(fit));
    if (T.doc && T.doc.kind === 'icon') return U.clamp(snapDown(fit * 0.82), 1, 32);
    return 1;
  };
  function snapDown(z) {
    // redondea hacia abajo a un valor «bonito» (12,5 %, 25 %, 33 %, 50 %, 67 %, 75 %, 100 %, 200 %...)
    const nice = [0.125, 0.167, 0.25, 0.333, 0.5, 0.667, 0.75, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 24, 32, 48, 64];
    let best = nice[0];
    for (const n of nice) if (n <= z + 1e-9) best = n;
    return best;
  }

  V.rebuild = function () {
    const p = V.page;
    if (!p) return;
    if (V.preview.width !== p.w || V.preview.height !== p.h) { V.preview.width = p.w; V.preview.height = p.h; }
    U.clear(V.stack);
    const act = p.active;
    for (const L of p.layers) {
      L.canvas.style.display = L.visible ? '' : 'none';
      V.stack.appendChild(L.canvas);
      if (L === act) V.stack.appendChild(V.preview);
    }
    V.bgEl.style.background = p.bg.color;
    V.bgEl.style.display = p.bg.visible ? '' : 'none';
    V.svg.setAttribute('viewBox', '0 0 ' + p.w + ' ' + p.h);
    V.svg.setAttribute('preserveAspectRatio', 'none');
  };

  V.clearPreview = function () {
    const p = V.page;
    V.pctx.setTransform(1, 0, 0, 1, 0, 0);
    V.pctx.globalAlpha = 1; V.pctx.globalCompositeOperation = 'source-over';
    V.pctx.clearRect(0, 0, p.w, p.h);
    V.preview.style.opacity = '';
  };
  V.previewAlpha = function (a) { V.preview.style.opacity = a >= 1 ? '' : String(a); };

  /* ---------- Disposición ---------- */
  V.layout = function () {
    const p = V.page;
    if (!p) return;
    const vw = V.ws.clientWidth, vh = V.ws.clientHeight;
    const cw = Math.max(1, Math.round(p.w * V.zoom)), ch = Math.max(1, Math.round(p.h * V.zoom));
    const sw = Math.max(vw, cw + 2 * MARGIN), sh = Math.max(vh, ch + 2 * MARGIN);
    V.stage.style.width = sw + 'px'; V.stage.style.height = sh + 'px';
    const left = Math.max(MARGIN, Math.round((sw - cw) / 2)), top = Math.max(MARGIN, Math.round((sh - ch) / 2));
    V.wrap.style.left = left + 'px'; V.wrap.style.top = top + 'px';
    V.wrap.style.width = cw + 'px'; V.wrap.style.height = ch + 'px';
    V.wrap.classList.toggle('pix', V.zoom > 1);
    V.cw = cw; V.ch = ch; V.left = left; V.top = top;
    V.sx = cw / p.w; V.sy = ch / p.h;
    const xs = { w: left - 6, c: left + cw / 2 - 3, e: left + cw }, ys = { n: top - 6, c: top + ch / 2 - 3, s: top + ch };
    for (const h of V.handles) {
      const d = h.dataset.h, x = d.includes('w') ? xs.w : d.includes('e') ? xs.e : xs.c, y = d.includes('n') ? ys.n : d.includes('s') ? ys.s : ys.c;
      h.style.left = Math.round(x) + 'px'; h.style.top = Math.round(y) + 'px';
    }
    V.drawGrid(); V.drawRulers();
    T.bus.emit('view');
  };

  V.applyOptions = function () {
    const o = T.state.view;
    V.rTop.hidden = V.rLeft.hidden = V.rCorner.hidden = !o.rulers;
    requestAnimationFrame(() => { V.layout(); });
  };

  /* ---------- Coordenadas ---------- */
  V.toImage = function (cx, cy) {
    const r = V.wrap.getBoundingClientRect();
    return { x: (cx - r.left) / (r.width / V.page.w), y: (cy - r.top) / (r.height / V.page.h) };
  };
  V.toClient = function (x, y) {
    const r = V.wrap.getBoundingClientRect();
    return { x: r.left + x * (r.width / V.page.w), y: r.top + y * (r.height / V.page.h) };
  };
  /* Rectángulo de la imagen visible ahora mismo (en píxeles de imagen). */
  V.visibleRect = function () {
    const a = V.ws.getBoundingClientRect();
    const p0 = V.toImage(a.left, a.top), p1 = V.toImage(a.left + V.ws.clientWidth, a.top + V.ws.clientHeight);
    const x0 = U.clamp(Math.floor(p0.x), 0, V.page.w), y0 = U.clamp(Math.floor(p0.y), 0, V.page.h);
    const x1 = U.clamp(Math.ceil(p1.x), 0, V.page.w), y1 = U.clamp(Math.ceil(p1.y), 0, V.page.h);
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  };

  /* ---------- Zoom ---------- */
  V.setZoom = function (z, cx, cy) {
    z = U.clamp(z, V.MIN, V.MAX);
    if (!V.page || Math.abs(z - V.zoom) < 1e-6) return;
    const a = V.ws.getBoundingClientRect();
    if (cx == null) { cx = a.left + V.ws.clientWidth / 2; cy = a.top + V.ws.clientHeight / 2; }
    const before = V.toImage(cx, cy);
    V.zoom = z;
    V.layout();
    const r = V.wrap.getBoundingClientRect();
    V.ws.scrollLeft += r.left + before.x * V.sx - cx;
    V.ws.scrollTop += r.top + before.y * V.sy - cy;
    V.drawGrid(); V.drawRulers();
    T.bus.emit('zoom', z);
  };
  V.stepZoom = function (dir) {
    const s = V.STEPS;
    if (dir > 0) { for (const z of s) if (z > V.zoom + 1e-6) return z; return V.MAX; }
    for (let i = s.length - 1; i >= 0; i--) if (s[i] < V.zoom - 1e-6) return s[i];
    return V.MIN;
  };
  V.zoomIn = () => V.setZoom(V.stepZoom(1));
  V.zoomOut = () => V.setZoom(V.stepZoom(-1));
  V.fit = function () {
    const vw = V.ws.clientWidth - 2 * MARGIN, vh = V.ws.clientHeight - 2 * MARGIN;
    if (vw <= 0 || vh <= 0) return;
    const z = Math.min(vw / V.page.w, vh / V.page.h);
    V.setZoom(U.clamp(z, V.MIN, V.MAX));
    V.ws.scrollLeft = 0; V.ws.scrollTop = 0;
  };

  /* ---------- Adornos (selección, cajas, tiradores) ---------- */
  V.setOverlay = function (markup) { V.svg.innerHTML = markup || ''; }; // marcado propio, sin datos externos
  V.setHandles = function (pts) {
    U.clear(V.dom);
    if (!pts) return;
    for (const p of pts) {
      const h = document.createElement('div');
      h.className = 'hdl' + (p.round ? ' round' : '');
      h.style.left = (p.x * V.sx) + 'px';
      h.style.top = (p.y * V.sy) + 'px';
      V.dom.appendChild(h);
    }
  };

  /* Cursor de pincel (círculo o cuadrado del tamaño real). */
  V.brushCursor = function (cx, cy, sizePx, square) {
    const c = V.cursorEl;
    if (cx == null) { c.hidden = true; return; }
    const a = V.area.getBoundingClientRect();
    const s = Math.max(3, sizePx);
    c.hidden = false;
    c.classList.toggle('square', !!square);
    c.style.width = s + 'px'; c.style.height = s + 'px';
    c.style.transform = 'translate(' + (cx - a.left - s / 2) + 'px,' + (cy - a.top - s / 2) + 'px)';
  };

  /* ---------- Cuadrícula ---------- */
  V.drawGrid = function () {
    const g = V.gridCanvas;
    if (!T.state || !T.state.view.grid || !V.page) { g.style.display = 'none'; return; }
    const wr = V.wrap.getBoundingClientRect(), a = V.ws.getBoundingClientRect();
    const x0 = Math.max(wr.left, a.left), y0 = Math.max(wr.top, a.top);
    const x1 = Math.min(wr.right, a.left + V.ws.clientWidth), y1 = Math.min(wr.bottom, a.top + V.ws.clientHeight);
    if (x1 <= x0 || y1 <= y0) { g.style.display = 'none'; return; }
    const dpr = window.devicePixelRatio || 1;
    const w = x1 - x0, h = y1 - y0;
    g.style.display = 'block';
    g.style.left = (x0 - wr.left) + 'px'; g.style.top = (y0 - wr.top) + 'px';
    g.style.width = w + 'px'; g.style.height = h + 'px';
    g.width = Math.round(w * dpr); g.height = Math.round(h * dpr);
    const c = g.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    const z = V.sx;
    const step = z >= 4 ? 1 : z >= 0.5 ? 10 : 50;
    const strong = step === 1 ? 8 : step * 10;
    const ox = x0 - wr.left, oy = y0 - wr.top;
    const first = v => Math.ceil(v / z / step) * step;
    const line = (strongLine, vertical, pos, len) => {
      c.fillStyle = strongLine ? 'rgba(90,90,90,.55)' : 'rgba(110,110,110,.32)';
      const px = Math.round(pos * dpr) / dpr;
      if (vertical) c.fillRect(px, 0, 1 / dpr, len); else c.fillRect(0, px, len, 1 / dpr);
    };
    for (let ix = first(ox); ix * z - ox <= w; ix += step) if (ix > 0 && ix < V.page.w) line(ix % strong === 0, true, ix * z - ox, h);
    for (let iy = first(oy); iy * z - oy <= h; iy += step) if (iy > 0 && iy < V.page.h) line(iy % strong === 0, false, iy * z - oy, w);
  };

  /* ---------- Reglas ---------- */
  function niceStep(z) {
    const cands = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
    for (const c of cands) if (c * z >= 56) return c;
    return 10000;
  }
  V.drawRulers = U.rafThrottle(function () {
    if (!T.state || !T.state.view.rulers || !V.page) return;
    const dpr = window.devicePixelRatio || 1;
    const wr = V.wrap.getBoundingClientRect();
    const cs = getComputedStyle(document.documentElement);
    const ink = cs.getPropertyValue('--ruler-ink').trim() || '#666';
    const accent = cs.getPropertyValue('--accent').trim() || '#06c';
    const z = V.sx;
    const major = niceStep(z);
    const minor = major >= 10 ? major / 10 : (major === 5 ? 1 : major / 2);
    const draw = (cv, horizontal) => {
      const r = cv.getBoundingClientRect();
      const len = horizontal ? r.width : r.height, thick = 20;
      if (len <= 0) return;
      cv.width = Math.round((horizontal ? len : thick) * dpr);
      cv.height = Math.round((horizontal ? thick : len) * dpr);
      const c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.fillStyle = ink; c.font = '10px "Segoe UI", system-ui, sans-serif'; c.textBaseline = 'top';
      const origin = horizontal ? wr.left - r.left : wr.top - r.top;
      const size = horizontal ? V.page.w : V.page.h;
      const from = Math.max(0, Math.floor(-origin / z / minor) * minor), to = Math.min(size, Math.ceil((len - origin) / z));
      for (let v = from; v <= to; v += minor) {
        const pos = Math.round(origin + v * z) + 0.5;
        const isMajor = Math.abs(v / major - Math.round(v / major)) < 1e-6;
        const isMid = !isMajor && major >= 10 && Math.abs(v / (major / 2) - Math.round(v / (major / 2))) < 1e-6;
        const t = isMajor ? 9 : isMid ? 6 : 4;
        if (horizontal) c.fillRect(pos - 0.5, thick - t, 1, t); else c.fillRect(thick - t, pos - 0.5, t, 1);
        if (isMajor) {
          const label = String(Math.round(v));
          if (horizontal) c.fillText(label, pos + 2, 1);
          else { c.save(); c.translate(1, pos + 2); c.rotate(-Math.PI / 2); c.textAlign = 'right'; c.fillText(label, 0, 0); c.restore(); }
        }
      }
      if (V.pointer) {
        c.fillStyle = accent;
        const pp = horizontal ? V.pointer.cx - r.left : V.pointer.cy - r.top;
        if (horizontal) c.fillRect(Math.round(pp), 0, 1, thick); else c.fillRect(0, Math.round(pp), thick, 1);
      }
    };
    draw(V.rTop, true); draw(V.rLeft, false);
  });

  /* ---------- Tiradores del lienzo ---------- */
  function startCanvasResize(ev, h) {
    if (ev.button !== 0) return;
    ev.preventDefault(); ev.stopPropagation();
    T.app.finishPending();
    const p = V.page, mode = h.dataset.h;
    h.setPointerCapture(ev.pointerId);
    let x0 = 0, y0 = 0, x1 = p.w, y1 = p.h;
    const move = e => {
      const q = V.toImage(e.clientX, e.clientY);
      if (mode.includes('w')) x0 = U.clamp(Math.round(q.x), p.w - 20000, p.w - 1);
      if (mode.includes('e')) x1 = U.clamp(Math.round(q.x), 1, 20000);
      if (mode.includes('n')) y0 = U.clamp(Math.round(q.y), p.h - 20000, p.h - 1);
      if (mode.includes('s')) y1 = U.clamp(Math.round(q.y), 1, 20000);
      V.ghost.hidden = false;
      V.ghost.style.left = (V.left + x0 * V.sx) + 'px'; V.ghost.style.top = (V.top + y0 * V.sy) + 'px';
      V.ghost.style.width = ((x1 - x0) * V.sx) + 'px'; V.ghost.style.height = ((y1 - y0) * V.sy) + 'px';
      T.bus.emit('sizehint', x1 - x0, y1 - y0);
    };
    const up = e => {
      h.removeEventListener('pointermove', move); h.removeEventListener('pointerup', up); h.removeEventListener('pointercancel', up);
      V.ghost.hidden = true;
      T.bus.emit('sizehint', null);
      if (e.type === 'pointerup') T.app.resizeCanvas(x1 - x0, y1 - y0, -x0, -y0);
    };
    h.addEventListener('pointermove', move); h.addEventListener('pointerup', up); h.addEventListener('pointercancel', up);
  }
})();
