'use strict';
/* Trazo · paneles: capas, resoluciones de icono, barra de estado, deslizadores y miniatura. */
(function () {
  const T = window.T, U = T.util, el = U.el, UI = T.ui;
  const P = T.panels = {};
  const S = () => T.state;
  const page = () => T.view.page;

  function thumbCanvas(srcDraw, w, h, maxW, maxH) {
    const k = Math.min(maxW / w, maxH / h, h <= 64 && w <= 64 ? Math.floor(Math.min(maxW / w, maxH / h)) || 1 : 1);
    const c = U.canvas(Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    c.ctx.imageSmoothingEnabled = k < 1;
    c.ctx.imageSmoothingQuality = 'high';
    srcDraw(c.ctx, c.width, c.height);
    return c;
  }

  /* ---------- Capas ---------- */
  P.drawLayers = function () {
    const root = document.getElementById('layersPanel');
    root.hidden = !S().view.layers;
    if (root.hidden) return;
    const pg = page();
    U.clear(root);
    const list = el('div.panel-list');
    root.appendChild(el('div.panel-head', null, el('span.grow', { text: 'Capas' }),
      el('button.ibtn', { html: T.icon('plus', 16), data: { tip: 'Agregar capa' }, 'aria-label': 'Agregar capa', onclick: () => { T.app.finishPending(); pg.addLayer(); } }),
      el('button.ibtn', { html: T.icon('close', 14), data: { tip: 'Cerrar panel' }, 'aria-label': 'Cerrar panel', onclick: () => T.app.toggleView('layers') })));
    root.appendChild(list);
    for (let i = pg.layers.length - 1; i >= 0; i--) list.appendChild(layerThumb(pg, pg.layers[i], i));
    list.appendChild(backgroundThumb(pg));
  };

  function layerMenu(pg, L, i) {
    return [
      { label: 'Duplicar capa', icon: 'copy', run: () => { T.app.finishPending(); pg.duplicateLayer(L.id); } },
      { label: 'Combinar hacia abajo', icon: 'mergeDown', disabled: i === 0, run: () => { T.app.finishPending(); pg.mergeDown(L.id); } },
      { sep: true },
      { label: 'Subir', icon: 'arrowUp', disabled: i === pg.layers.length - 1, run: () => { T.app.finishPending(); pg.moveLayer(L.id, 1); } },
      { label: 'Bajar', icon: 'arrowDown', disabled: i === 0, run: () => { T.app.finishPending(); pg.moveLayer(L.id, -1); } },
      { sep: true },
      { label: 'Cambiar nombre', run: () => T.dialogs.renameLayer(pg, L) },
      { label: 'Eliminar capa', icon: 'trash', disabled: pg.layers.length < 2, run: () => { T.app.finishPending(); pg.removeLayer(L.id); } }
    ];
  }

  function layerThumb(pg, L, i) {
    const c = thumbCanvas((x, w, h) => x.drawImage(L.canvas, 0, 0, w, h), pg.w, pg.h, 100, 76);
    const pic = el('div.pic', { class: pg.w <= 64 ? 'pixelated' : '' }, c);
    const eye = el('button.eye', {
      html: T.icon(L.visible ? 'eye' : 'eyeOff', 14), 'aria-label': L.visible ? 'Ocultar capa' : 'Mostrar capa',
      onclick: ev => { ev.stopPropagation(); T.app.finishPending(); pg.setLayerVisible(L.id, !L.visible); }
    });
    const node = el('div.thumb', { class: (L.id === pg.activeId ? 'on ' : '') + (L.visible ? '' : 'hiddenlayer'), role: 'button', 'aria-label': L.name }, pic, el('div.cap', { text: L.name }), eye);
    node.addEventListener('contextmenu', ev => { ev.preventDefault(); UI.menu({ x: ev.clientX, y: ev.clientY }, layerMenu(pg, L, i)); });
    node.addEventListener('pointerdown', ev => {
      if (ev.button !== 0 || ev.target.closest('.eye')) return;
      const startY = ev.clientY;
      let dragging = false, target = null;
      node.setPointerCapture(ev.pointerId);
      const clearMarks = () => node.parentNode.querySelectorAll('.drop-above,.drop-below').forEach(n => n.classList.remove('drop-above', 'drop-below'));
      const move = e => {
        if (!dragging && Math.abs(e.clientY - startY) < 6) return;
        dragging = true;
        node.classList.add('dragging');
        clearMarks();
        target = null;
        const items = Array.from(node.parentNode.querySelectorAll('.thumb:not(.bgthumb)'));
        for (const n of items) {
          const r = n.getBoundingClientRect();
          if (e.clientY >= r.top && e.clientY <= r.bottom) {
            const above = e.clientY < r.top + r.height / 2;
            n.classList.add(above ? 'drop-above' : 'drop-below');
            target = { n, above, idx: items.length - 1 - items.indexOf(n) };
          }
        }
      };
      const up = e => {
        node.removeEventListener('pointermove', move); node.removeEventListener('pointerup', up); node.removeEventListener('pointercancel', up);
        if (dragging) {
          node.classList.remove('dragging'); clearMarks();
          if (e.type === 'pointerup' && target) {
            T.app.finishPending();
            let to = target.idx + (target.above ? 1 : 0);
            if (i < to) to--;
            pg.moveLayerTo(L.id, to);
          }
        } else if (e.type === 'pointerup') {
          T.app.finishPending();
          pg.setActive(L.id);
        }
      };
      node.addEventListener('pointermove', move); node.addEventListener('pointerup', up); node.addEventListener('pointercancel', up);
    });
    return node;
  }

  function backgroundThumb(pg) {
    const pic = el('div.pic', null, el('div', { style: { width: '100%', height: '100%', background: pg.bg.visible ? pg.bg.color : 'transparent' } }));
    const eye = el('button.eye', {
      html: T.icon(pg.bg.visible ? 'eye' : 'eyeOff', 14), 'aria-label': pg.bg.visible ? 'Ocultar fondo' : 'Mostrar fondo',
      onclick: ev => { ev.stopPropagation(); T.app.finishPending(); pg.setBackground(null, !pg.bg.visible); }
    });
    const node = el('div.thumb.bgthumb', { class: pg.bg.visible ? '' : 'hiddenlayer', data: { tip: 'Fondo: clic para cambiar su color' } }, pic, el('div.cap', { text: 'Fondo' }), eye);
    node.addEventListener('click', async ev => {
      if (ev.target.closest('.eye')) return;
      const c = await T.colors.edit(pg.bg.color);
      if (c) { T.app.finishPending(); pg.setBackground(c, true); }
    });
    return node;
  }

  /* ---------- Resoluciones de icono ---------- */
  P.drawPages = function () {
    const root = document.getElementById('pagesPanel');
    root.hidden = T.doc.kind !== 'icon';
    if (root.hidden) return;
    U.clear(root);
    const list = el('div.panel-list');
    root.appendChild(el('div.panel-head', null, el('span.grow', { text: 'Resoluciones' }),
      el('button.ibtn', { html: T.icon('plus', 16), data: { tip: 'Agregar resolución' }, 'aria-label': 'Agregar resolución', onclick: () => T.dialogs.addIconSize() })));
    root.appendChild(list);
    T.doc.pages.forEach((pg, i) => list.appendChild(pageThumb(pg, i)));
    root.appendChild(el('div.panel-foot', null, el('div.fnote', { style: { margin: 0 }, text: 'Cada resolución se edita por separado, con sus capas y su historial.' })));
  };

  function pageMenu(pg, i) {
    const others = T.doc.pages.filter(q => q !== pg);
    return [
      { label: 'Regenerar desde otra resolución', icon: 'regen', disabled: !others.length, sub: () => others.map(q => ({ label: q.w + ' × ' + q.h, run: () => T.ico.regenerate(pg, q) })) },
      { label: 'Duplicar', icon: 'copy', run: () => T.ico.duplicate(pg) },
      { label: 'Exportar como PNG', icon: 'image', run: () => { T.app.showPage(i); T.files.saveAs('png'); } },
      { sep: true },
      { label: 'Eliminar', icon: 'trash', disabled: T.doc.pages.length < 2, run: () => T.ico.remove(pg) }
    ];
  }

  function pageThumb(pg, i) {
    const comp = pg.composite();
    const c = thumbCanvas((x, w, h) => x.drawImage(comp, 0, 0, w, h), pg.w, pg.h, 112, 96);
    const label = pg.w + ' × ' + pg.h + (pg.meta && pg.meta.bpp && pg.meta.bpp < 32 ? ' · ' + pg.meta.bpp + ' bits' : '');
    const more = el('button.eye', { html: T.icon('more', 14), 'aria-label': 'Opciones de la resolución ' + label, onclick: ev => { ev.stopPropagation(); UI.menu(ev.currentTarget, pageMenu(pg, i)); } });
    const node = el('div.thumb', { class: i === T.doc.index ? 'on' : '', role: 'button', 'aria-label': label, onclick: () => T.app.showPage(i) },
      el('div.pic.pixelated', null, c), el('div.cap', { text: label }), more);
    node.addEventListener('contextmenu', ev => { ev.preventDefault(); UI.menu({ x: ev.clientX, y: ev.clientY }, pageMenu(pg, i)); });
    return node;
  }

  /* ---------- Barra de estado ---------- */
  P.buildStatus = function () {
    const bar = document.getElementById('statusbar');
    const v = T.view;
    P.sPos = el('span'); P.sSel = el('span'); P.sSize = el('span'); P.sFile = el('span');
    const zoomT = z => Math.log(z / v.MIN) / Math.log(v.MAX / v.MIN);
    const tZoom = t => {
      const raw = v.MIN * Math.pow(v.MAX / v.MIN, t);
      for (const s of v.STEPS) if (Math.abs(Math.log(raw / s)) < 0.06) return s;
      return raw;
    };
    P.zoomSlider = UI.hslider({ min: v.MIN, max: v.MAX, value: 1, toT: zoomT, fromT: tZoom, onInput: z => v.setZoom(z), step: (cur, d) => v.stepZoom(d) });
    P.zoomLabel = el('span');
    const zb = el('button.zoombtn', { 'aria-label': 'Nivel de zoom', onclick: () => UI.menu(zb, v.PRESETS.slice().reverse().map(z => ({ label: Math.round(z * 1000) / 10 + ' %', checked: Math.abs(z - v.zoom) < 1e-6 ? true : undefined, radio: true, run: () => v.setZoom(z) })).concat([{ sep: true }, { label: 'Ajustar a la ventana', icon: 'fit', run: () => v.fit() }]), { owner: zb }) },
      P.zoomLabel, el('span', { html: T.icon('chevDown', 12), style: { display: 'flex' } }));
    P.fileItem = el('div.sitem', null, el('span', { html: T.icon('save', 15), style: { display: 'flex' } }), P.sFile);
    const ic = n => el('span', { html: T.icon(n, 16), style: { display: 'flex' } });
    U.append(bar, [
      el('div.sitem', null, ic('cursor'), P.sPos),
      el('div.sitem', null, ic('selRect'), P.sSel),
      el('div.sitem.wide', null, ic('canvasSize'), P.sSize),
      P.fileItem,
      el('div.sgrow'),
      el('div.zoomctl', null,
        el('button.ibtn', { html: T.icon('fit', 20), 'aria-label': 'Ajustar a la ventana', data: { tip: 'Ajustar a la ventana', key: 'Ctrl+0' }, onclick: () => v.fit() }),
        zb,
        el('button.ibtn', { html: T.icon('zoomOut', 18), 'aria-label': 'Alejar', data: { tip: 'Alejar' }, onclick: () => v.zoomOut() }),
        P.zoomSlider.el,
        el('button.ibtn', { html: T.icon('zoomIn', 18), 'aria-label': 'Acercar', data: { tip: 'Acercar' }, onclick: () => v.zoomIn() }))
    ]);
    T.bus.on('pointer', (p, inside) => { P.sPos.textContent = p && inside ? Math.floor(p.x) + ', ' + Math.floor(p.y) + 'px' : ''; });
    T.bus.on('sizehint', (w, h) => { P.hint = w == null ? null : [w, h]; P.syncStatus(); });
    T.bus.on('selection', () => P.syncStatus());
    T.bus.on('view', () => P.syncStatus());
    T.bus.on('zoom', () => P.syncStatus());
    T.bus.on('history', () => P.syncStatus());
    T.bus.on('doc', () => P.syncStatus());
  };
  P.syncStatus = function () {
    const v = T.view, pg = v.page;
    if (!pg) return;
    const c = T.selection.cur;
    P.sSel.textContent = P.hint ? P.hint[0] + ' × ' + P.hint[1] + 'px' : c ? c.w + ' × ' + c.h + 'px' : '';
    P.sSize.textContent = T.tr(pg.w + ' × ' + pg.h + ' píxeles');
    P.sFile.textContent = T.doc && T.doc.fileSize != null ? U.fmtBytes(T.doc.fileSize) : '';
    P.fileItem.hidden = !P.sFile.textContent;
    P.zoomLabel.textContent = (Math.round(v.zoom * 1000) / 10) + ' %';
    P.zoomSlider.set(v.zoom);
  };

  /* ---------- Deslizadores de tamaño y opacidad ---------- */
  P.buildSide = function () {
    const root = document.getElementById('sidePanel');
    P.sizeS = UI.vslider({ min: 1, max: 100, value: 5, icon: 'sizeLines', format: v => T.tr('Tamaño: ' + v + ' px'), onInput: v => T.tools.setSize(v) });
    P.opS = UI.vslider({ min: 1, max: 100, value: 100, icon: 'drop', format: v => T.tr('Opacidad: ' + v + ' %'), onInput: v => T.tools.setOpacity(v) });
    U.append(root, [P.sizeS.el, P.opS.el]);
    const sync = () => {
      const show = T.tools.usesSize();
      root.hidden = !show;
      if (show) { P.sizeS.set(T.tools.size()); P.opS.set(S().opacities[T.tools.sizeKey()]); requestAnimationFrame(() => { P.sizeS.paint(); P.opS.paint(); }); }
    };
    T.bus.on('tool', sync); T.bus.on('toolopts', sync);
    sync();
  };

  /* ---------- Miniatura ---------- */
  P.drawThumb = function () {
    const root = document.getElementById('thumbPanel');
    root.hidden = !S().view.thumb;
    if (root.hidden || !page()) return;
    const pg = page(), comp = pg.composite();
    const c = thumbCanvas((x, w, h) => x.drawImage(comp, 0, 0, w, h), pg.w, pg.h, 200, 160);
    U.clear(root).appendChild(c);
  };

  /* Tras cambiar de idioma: lo que se escribe con textContent. */
  P.relabel = function () { P.syncStatus(); P.sizeS.paint(); P.opS.paint(); };

  const refresh = U.debounce(() => { P.drawLayers(); P.drawPages(); P.drawThumb(); }, 40);
  P.refresh = refresh;
  P.init = function () {
    P.buildStatus(); P.buildSide();
    T.bus.on('history', refresh); T.bus.on('structure', refresh); T.bus.on('doc', () => { P.drawLayers(); P.drawPages(); P.drawThumb(); });
    T.bus.on('viewopts', () => { P.drawLayers(); P.drawThumb(); document.getElementById('statusbar').hidden = !S().view.status; });
  };
})();
