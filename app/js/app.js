'use strict';
/* Trazo · arranque, estado general, portapapeles y atajos de teclado. */
(function () {
  const T = window.T, U = T.util, UI = T.ui;
  const A = T.app = { spaceDown: false, clip: null };

  const DEFAULTS = {
    tool: 'brush', brush: 'brush', shape: 'rect', selMode: 'rect', selTransparent: false,
    outline: 'solid', fill: 'none',
    color1: '#000000', color2: '#ffffff', activeSlot: 1, custom: [],
    sizes: { pencil: 1, brush: 5, eraser: 8, shape: 3 },
    opacities: { pencil: 100, brush: 100, eraser: 100, shape: 100 },
    view: { rulers: false, grid: false, status: true, thumb: false, layers: false, ribbon: true },
    text: { font: 'Segoe UI', size: 18, bold: false, italic: false, underline: false, strike: false, align: 'left', bg: false },
    theme: 'system', lang: 'system',
    f11: 'auto' // qué abre F11: 'window' (pantalla completa normal) o 'image' (solo la imagen, como Paint)
  };

  function loadState() {
    const s = U.store.get('state', {});
    const out = JSON.parse(JSON.stringify(DEFAULTS));
    for (const k in out) {
      if (s[k] === undefined) continue;
      if (out[k] && typeof out[k] === 'object' && !Array.isArray(out[k])) Object.assign(out[k], s[k]);
      else out[k] = s[k];
    }
    if (out.tool === 'picker' || out.tool === 'magnifier') out.tool = 'pencil';
    return out;
  }
  A.saveState = U.debounce(() => U.store.set('state', T.state), 300);

  /* ---------- Tema ---------- */
  const dark = matchMedia('(prefers-color-scheme: dark)');
  A.applyTheme = function () {
    const t = T.state.theme === 'system' ? (dark.matches ? 'dark' : 'light') : T.state.theme;
    document.documentElement.dataset.theme = t;
    T.view.drawRulers();
  };
  dark.addEventListener('change', () => A.applyTheme());

  A.setLanguage = function (choice) {
    T.state.lang = choice;
    T.i18n.set(choice);
    T.i18n.apply();
    if (!T.doc.titled) T.doc.name = T.tr('Sin título');
    A.refreshTitle();
    T.panels.relabel();
    T.panels.refresh();
    A.saveState();
  };

  /* ---------- Documento ---------- */
  A.titleText = function () {
    const d = T.doc;
    const size = d.kind === 'icon' ? ' · ' + d.page.w + ' × ' + d.page.h : '';
    return (d.dirty ? '*' : '') + d.name + size;
  };
  A.refreshTitle = function () {
    T.host.setTitle((T.doc.dirty ? '*' : '') + T.doc.name + ' - Trazo');
    T.ribbon.sync();
  };

  A.setDoc = function (doc) {
    A.finishPending();
    T.doc = doc;
    T.view.setPage(doc.page);
    T.view.applyOptions();
    T.bus.emit('doc');
    A.refreshTitle();
  };
  A.showPage = function (i, force) {
    const d = T.doc;
    A.finishPending();
    if (i === d.index && !force) return;
    d.index = U.clamp(i, 0, d.pages.length - 1);
    T.view.setPage(d.page);
    T.bus.emit('doc');
    A.refreshTitle();
  };

  A.hasPending = () => !!(T.selection.cur || T.tools.pendingShape || T.text.editing);
  A.finishPending = function () {
    if (T.text.editing) T.text.commit();
    if (T.tools.pendingShape) T.tools.map.shape.finish();
    if (T.selection.cur) T.selection.commit();
  };

  /* Pregunta qué hacer con los cambios sin guardar. true = se puede continuar. */
  A.confirmDiscard = async function () {
    A.finishPending();
    if (!T.doc.dirty) return true;
    const r = await UI.dialog({
      title: 'Trazo', body: '¿Quieres guardar los cambios de ' + T.doc.name + '?', cancelValue: 'cancel', width: 400,
      buttons: [{ label: 'Guardar', value: 'save', primary: true }, { label: 'No guardar', value: 'discard' }, { label: 'Cancelar', value: 'cancel' }]
    });
    if (r === 'cancel') return false;
    if (r === 'save') return await T.files.save();
    return true;
  };
  A.quit = async function () {
    if (await A.confirmDiscard()) { T.doc.dirty = false; T.host.forceClose(); }
  };
  T.host.closeHandler = () => A.quit();
  window.addEventListener('beforeunload', ev => { if (!T.host.desktop && T.doc && T.doc.dirty) { ev.preventDefault(); ev.returnValue = ''; } });

  /* ---------- Edición ---------- */
  A.undo = function () {
    if (T.text.editing) { T.text.cancel(); return; }
    if (T.tools.pendingShape) { T.tools.map.shape.cancel(); return; }
    if (T.selection.cur) {
      const hadFloat = !!T.selection.cur.float;
      T.selection.cancel();
      if (hadFloat) return;
    }
    T.view.page.undo();
  };
  A.redo = function () { A.finishPending(); T.view.page.redo(); };

  A.selectAll = function () { A.finishPending(); T.tools.set('select'); T.selection.selectAll(); };
  A.invertSelection = function () {
    if (T.text.editing) T.text.commit();
    if (T.tools.pendingShape) T.tools.map.shape.finish();
    T.tools.set('select');
    T.selection.invert();
  };

  A.copy = async function () {
    const c = T.selection.pixels();
    if (!c) return;
    const cur = T.selection.cur;
    A.clip = { canvas: c, svg: cur.svg && !cur.touched ? cur.svg : null };
    try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': await U.canvasToBlob(c, 'image/png') })]); }
    catch (e) { console.warn('Portapapeles del sistema no disponible', e); }
  };
  A.cut = async function () { await A.copy(); T.selection.remove(); };

  async function pasteImageBlob(blob) {
    const bytes = await U.blobToBytes(blob);
    const url = URL.createObjectURL(new Blob([bytes]));
    try {
      const im = await U.loadImage(url);
      const c = U.canvas(im.naturalWidth, im.naturalHeight);
      c.ctx.drawImage(im, 0, 0);
      const svg = A.clip && A.clip.svg && A.clip.canvas.width === c.width && A.clip.canvas.height === c.height ? A.clip.svg : null;
      place(c, svg);
    } finally { URL.revokeObjectURL(url); }
  }
  /* Si lo pegado no cabe, ofrece ampliar el lienzo (como hace Paint). */
  async function place(c, svg) {
    const p = T.view.page;
    A.finishPending();
    if (c.width > p.w || c.height > p.h) {
      const grow = T.doc.kind !== 'icon' && await UI.confirm('La imagen es mayor que el lienzo', '¿Quieres ampliar el lienzo para que quepa la imagen pegada?', 'Ampliar', 'No ampliar');
      if (grow) p.resizeCanvas(Math.max(p.w, c.width), Math.max(p.h, c.height));
    }
    T.selection.paste(c, { svg: svg || null });
  }
  async function pasteSvgText(text) {
    const svg = T.svg.parse(text);
    const c = await T.svg.rasterize(svg.src, svg.w, svg.h);
    place(c, svg.src);
  }
  const looksSvgText = s => /^\s*(<\?xml[^>]*\?>\s*)?(<!--[\s\S]*?-->\s*)*<svg[\s>]/i.test(s);

  /* Pegar desde el botón del menú. */
  A.pasteButton = async function () {
    try {
      const items = await navigator.clipboard.read();
      for (const it of items) {
        const type = it.types.find(t => t.startsWith('image/') && t !== 'image/svg+xml');
        if (type) { await pasteImageBlob(await it.getType(type)); return; }
        if (it.types.includes('text/plain')) {
          const text = await (await it.getType('text/plain')).text();
          if (looksSvgText(text)) { await pasteSvgText(text); return; }
        }
      }
    } catch (e) { console.warn('Portapapeles del sistema no disponible', e); }
    if (A.clip) place(U.cloneCanvas(A.clip.canvas), A.clip.svg);
    else UI.toast('El portapapeles no contiene una imagen.');
  };

  document.addEventListener('paste', ev => {
    if (UI.dialogOpen() || T.text.editing) return;
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA')) return;
    const data = ev.clipboardData;
    if (!data) return;
    for (const it of data.items) {
      if (it.type.startsWith('image/') && it.type !== 'image/svg+xml') {
        ev.preventDefault();
        pasteImageBlob(it.getAsFile()).catch(e => UI.alert('No se pudo pegar', e.message));
        return;
      }
    }
    const text = data.getData('text/plain');
    if (text && looksSvgText(text)) {
      ev.preventDefault();
      pasteSvgText(text).catch(e => UI.alert('No se pudo pegar', e.message));
      return;
    }
    if (A.clip) { ev.preventDefault(); place(U.cloneCanvas(A.clip.canvas), A.clip.svg); }
  });

  /* ---------- Imagen ---------- */
  A.resizeCanvas = function (w, h, ox, oy) {
    A.finishPending();
    T.view.page.resizeCanvas(w, h, ox, oy);
  };
  A.crop = function () {
    if (T.text.editing) T.text.commit();
    if (T.tools.pendingShape) T.tools.map.shape.finish();
    if (!T.selection.cur) { UI.toast('Primero haz una selección para recortar.'); return; }
    T.selection.crop();
  };
  A.transform = function (kind) {
    if (T.text.editing) T.text.commit();
    if (T.tools.pendingShape) T.tools.map.shape.finish();
    if (T.selection.cur) { T.selection.transform(kind); return; }
    T.view.page.transform(kind);
  };
  A.applyResize = async function (nw, nh, skewX, skewY) {
    if (T.text.editing) T.text.commit();
    if (T.tools.pendingShape) T.tools.map.shape.finish();
    const sel = T.selection.cur, pg = T.view.page;
    if (sel) {
      T.selection.nudge(0, 0); // separa la selección de la capa
      sel.w = nw; sel.h = nh;
      if (sel.svg) { try { sel.float = await T.svg.rasterize(sel.svg, nw, nh); sel.shown = null; } catch (e) { /* se escala */ } }
      T.selection.nudge(0, 0);
      T.bus.emit('selection');
      return;
    }
    await pg.scaleTo(nw, nh, T.svg.renderLayer);
    if (skewX || skewY) pg.skew(skewX, skewY);
  };
  A.invertColors = function () {
    if (T.text.editing) T.text.commit();
    if (T.tools.pendingShape) T.tools.map.shape.finish();
    if (T.selection.cur) { T.selection.invertColors(); return; }
    const pg = T.view.page, L = pg.active;
    const im = L.ctx.getImageData(0, 0, pg.w, pg.h), d = im.data;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3]) { d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2]; }
    L.ctx.putImageData(im, 0, 0);
    pg.commit('Invertir colores');
  };

  /* ---------- Vista ---------- */
  A.toggleView = function (k) {
    T.state.view[k] = !T.state.view[k];
    T.bus.emit('viewopts');
    T.ribbon.sync();
    A.saveState();
  };
  /* F11 y Mayús+F11: una abre la pantalla completa normal y la otra la de Paint (solo la imagen).
   * En la web F11 es la normal; en el .exe, la de Paint. Se intercambian en Configuración. */
  A.f11Mode = () => T.state.f11 === 'window' || T.state.f11 === 'image' ? T.state.f11 : (T.host.desktop ? 'image' : 'window');
  A.fullKeys = function () {
    const f = A.f11Mode();
    return { window: f === 'window' ? 'F11' : 'Mayús+F11', image: f === 'image' ? 'F11' : 'Mayús+F11' };
  };
  A.fullKey = function (shift) {
    const f = A.f11Mode(), which = shift ? (f === 'window' ? 'image' : 'window') : f;
    if (which === 'window') A.windowFull(); else A.fullView();
  };
  A.setF11 = function (mode) { T.state.f11 = mode; A.saveState(); };
  A.windowFull = function () {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    const r = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    if (r && r.catch) r.catch(() => UI.toast('No se pudo activar la pantalla completa.'));
  };
  A.fullView = function () {
    A.finishPending();
    const c = T.view.page.composite();
    const box = U.el('div#fullview', null, c);
    const close = () => { box.remove(); document.removeEventListener('keydown', onKey, true); };
    const onKey = ev => { ev.preventDefault(); ev.stopPropagation(); close(); };
    box.addEventListener('pointerdown', close);
    document.addEventListener('keydown', onKey, true);
    document.body.appendChild(box);
  };

  /* ---------- Teclado ---------- */
  function editingText(ev) {
    const t = ev.target;
    return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  }
  function onKey(ev) {
    if (UI.menuOpen()) { if (UI.menuKey(ev)) { ev.preventDefault(); ev.stopPropagation(); } return; }
    if (UI.dialogOpen() || editingText(ev)) return;
    const ctrl = ev.ctrlKey || ev.metaKey, k = ev.key, lk = k.length === 1 ? k.toLowerCase() : k;
    const F = T.files, D = T.dialogs, V = T.view;
    let done = true;
    if (ctrl) {
      if (lk === 'n') D.newImage();
      else if (lk === 'o' && ev.shiftKey) F.importToCanvas();
      else if (lk === 'o') F.open();
      else if (lk === 's' && ev.shiftKey) F.saveAs(T.doc.format || 'png');
      else if (lk === 's') F.save();
      else if (lk === 'p') F.print();
      else if (lk === 'z') A.undo();
      else if (lk === 'y') A.redo();
      else if (lk === 'a') A.selectAll();
      else if (lk === 'x' && ev.shiftKey) A.crop();
      else if (lk === 'x') A.cut();
      else if (lk === 'c') A.copy();
      else if (lk === 'v') done = false; // lo atiende el evento «paste»
      else if (lk === 'w') D.resizeSkew();
      else if (lk === 'e') D.properties();
      else if (lk === 'r') A.toggleView('rulers');
      else if (lk === 'g') A.toggleView('grid');
      else if (lk === 'i' && ev.shiftKey) A.invertColors();
      else if (k === 'PageUp') V.zoomIn();
      else if (k === 'PageDown') V.zoomOut();
      else if (k === '0') V.fit();
      else if (k === '1') V.setZoom(1);
      else if (k === '+' || k === '=') T.tools.setSize(T.tools.size() + 1);
      else if (k === '-') T.tools.setSize(T.tools.size() - 1);
      else done = false;
    } else {
      switch (k) {
        case 'F12': F.saveAs(T.doc.format || 'png'); break;
        case 'F11': A.fullKey(ev.shiftKey); break;
        case 'Delete': if (!T.selection.remove()) done = false; break;
        case 'Escape':
          if (T.tools.pendingShape) T.tools.map.shape.cancel();
          else if (T.selection.cur) { if (T.selection.cur.float) T.selection.commit(); else T.selection.clear(); }
          else done = false;
          break;
        case 'Enter':
          if (T.tools.pendingShape || T.selection.cur) A.finishPending(); else done = false;
          break;
        case 'ArrowLeft': case 'ArrowRight': case 'ArrowUp': case 'ArrowDown':
          if (T.selection.cur) {
            const st = ev.shiftKey ? 10 : 1;
            T.selection.nudge(k === 'ArrowLeft' ? -st : k === 'ArrowRight' ? st : 0, k === 'ArrowUp' ? -st : k === 'ArrowDown' ? st : 0);
          } else done = false;
          break;
        case ' ': if (ev.target.tagName === 'BUTTON') { done = false; break; } A.spaceDown = true; V.ws.style.cursor = 'grab'; break;
        default: done = false;
      }
    }
    if (done) { ev.preventDefault(); ev.stopPropagation(); }
  }

  /* ---------- Soltar archivos ---------- */
  function initDrop() {
    let depth = 0, hint = null;
    const show = v => {
      if (v && !hint) { hint = U.el('div#dropHint', { text: 'Suelta el archivo para abrirlo' }); document.body.appendChild(hint); }
      if (!v && hint) { hint.remove(); hint = null; }
    };
    window.addEventListener('dragenter', ev => { if (ev.dataTransfer && Array.from(ev.dataTransfer.types).includes('Files')) { depth++; show(true); ev.preventDefault(); } });
    window.addEventListener('dragover', ev => ev.preventDefault());
    window.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) show(false); });
    window.addEventListener('drop', async ev => {
      ev.preventDefault();
      depth = 0; show(false);
      const f = ev.dataTransfer.files[0];
      if (!f) return;
      if (!await A.confirmDiscard()) return;
      await T.files.openBytes(f.name, await U.blobToBytes(f), null, f.size);
    });
  }

  /* ---------- Arranque ---------- */
  function init() {
    T.state = loadState();
    T.i18n.set(T.state.lang);
    T.view.init();
    T.doc = new T.Doc([new T.Page(1152, 648)]);
    T.ribbon.buildMenubar();
    T.ribbon.buildRibbon();
    T.text.initBar();
    T.panels.init();
    T.tools.init();
    A.applyTheme();
    T.view.setPage(T.doc.page);
    T.view.applyOptions();
    T.bus.emit('viewopts');
    T.bus.emit('tool');
    T.bus.emit('doc');
    A.refreshTitle();

    const markDirty = () => { if (T.doc && !T.doc.dirty) { T.doc.dirty = true; A.refreshTitle(); } };
    T.bus.on('history', p => { if (T.doc.pages.includes(p)) markDirty(); });
    for (const ev of ['tool', 'toolopts', 'color', 'viewopts', 'textopts']) T.bus.on(ev, A.saveState);

    document.addEventListener('keydown', onKey, true);
    document.addEventListener('keyup', ev => { if (ev.key === ' ') { A.spaceDown = false; T.bus.emit('tool'); } });
    initDrop();
    T.bus.on('host-open', async m => {
      if (await A.confirmDiscard()) T.files.openBytes(m.name, U.base64ToBytes(m.b64), { path: m.path }, m.size);
    });
    T.host.startupFiles().then(list => { if (list.length) T.files.openBytes(list[0].name, list[0].bytes, list[0].handle, list[0].size); }).catch(e => console.warn(e));
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
