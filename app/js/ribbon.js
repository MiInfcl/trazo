'use strict';
/* Trazo · barra de menús y cinta de herramientas. */
(function () {
  const T = window.T, U = T.util, el = U.el, UI = T.ui;
  const R = T.ribbon = {};
  const A = () => T.app, D = () => T.dialogs, F = () => T.files, S = () => T.state;

  /* ---------- Menús ---------- */
  function fileMenu() {
    const icon = T.doc.kind === 'icon';
    return [
      { label: 'Nuevo', icon: 'newDoc', key: 'Ctrl+N', run: () => D().newImage() },
      { label: 'Nuevo icono con varias resoluciones…', icon: 'iconFile', run: () => D().newIcon() },
      { label: 'Abrir', icon: 'open', key: 'Ctrl+O', run: () => F().open() },
      T.host.desktop ? { label: 'Recientes', icon: 'recent', sub: recentMenu } : null,
      { label: 'Importar al lienzo', icon: 'importImg', key: 'Ctrl+Mayús+O', run: () => F().importToCanvas() },
      { sep: true },
      { label: 'Guardar', icon: 'save', key: 'Ctrl+S', run: () => F().save() },
      { label: 'Guardar como', icon: 'saveAs', sub: saveAsMenu },
      { sep: true },
      { label: 'Imprimir', icon: 'print', key: 'Ctrl+P', run: () => F().print() },
      T.host.desktop ? { label: 'Establecer como fondo de escritorio', icon: 'desktop', sub: [
        { label: 'Rellenar', run: () => F().wallpaper('fill') },
        { label: 'Mosaico', run: () => F().wallpaper('tile') },
        { label: 'Centrar', run: () => F().wallpaper('center') }
      ], disabled: icon } : null,
      { sep: true },
      { label: 'Propiedades de imagen', icon: 'image', key: 'Ctrl+E', run: () => D().properties() },
      { label: 'Acerca de Trazo', icon: 'info', run: () => D().about() },
      { sep: true },
      { label: 'Salir', icon: 'exit', run: () => A().quit() }
    ];
  }
  function recentMenu() {
    const list = F().recentList();
    if (!list.length) return [{ label: 'No hay archivos recientes', disabled: true }];
    return list.map(r => ({ label: r.name, run: () => F().openRecent(r) }));
  }
  function saveAsMenu() {
    const icon = T.doc.kind === 'icon';
    const page = icon ? ' (esta resolución)' : '';
    return [
      { label: 'PNG' + page, run: () => F().saveAs('png') },
      { label: 'JPEG' + page, run: () => F().saveAs('jpg') },
      { label: 'BMP' + page, run: () => F().saveAs('bmp') },
      { label: 'GIF' + page, run: () => F().saveAs('gif') },
      { label: 'TIFF' + page, run: () => F().saveAs('tiff') },
      { label: 'WebP' + page, run: () => F().saveAs('webp') },
      { sep: true },
      { label: 'SVG (vectorial)' + page, icon: 'vector', run: () => F().saveAs('svg') },
      { label: icon ? 'ICO (todas las resoluciones)' : 'ICO (generar varias resoluciones)', icon: 'iconFile', run: () => F().saveAs('ico') },
      { sep: true },
      { label: 'Proyecto de Trazo (conserva capas)', icon: 'project', run: () => F().saveAs('trazo') }
    ];
  }
  function editMenu() {
    const p = T.view.page, sel = !!T.selection.cur;
    return [
      { label: 'Deshacer', icon: 'undo', key: 'Ctrl+Z', disabled: !p.canUndo && !A().hasPending(), run: () => A().undo() },
      { label: 'Rehacer', icon: 'redo', key: 'Ctrl+Y', disabled: !p.canRedo, run: () => A().redo() },
      { sep: true },
      { label: 'Cortar', icon: 'cut', key: 'Ctrl+X', disabled: !sel, run: () => A().cut() },
      { label: 'Copiar', icon: 'copy', key: 'Ctrl+C', disabled: !sel, run: () => A().copy() },
      { label: 'Pegar', icon: 'paste', key: 'Ctrl+V', run: () => A().pasteButton() },
      { sep: true },
      { label: 'Seleccionar todo', icon: 'selectAll', key: 'Ctrl+A', run: () => A().selectAll() },
      { label: 'Invertir selección', icon: 'invertSel', run: () => A().invertSelection() },
      { label: 'Eliminar', icon: 'trash', key: 'Supr', disabled: !sel, run: () => T.selection.remove() },
      { sep: true },
      { label: 'Invertir colores', icon: 'invertColors', key: 'Ctrl+Mayús+I', run: () => A().invertColors() }
    ];
  }
  R.editMenu = editMenu;
  function viewMenu() {
    const v = S().view, vw = T.view;
    const flag = (label, key, k, run) => ({ label, key, checked: !!v[k], keepOpen: false, run: run || (() => A().toggleView(k)) });
    return [
      { label: 'Acercar', icon: 'zoomIn', key: 'Ctrl+RePág', run: () => vw.zoomIn() },
      { label: 'Alejar', icon: 'zoomOut', key: 'Ctrl+AvPág', run: () => vw.zoomOut() },
      { label: '100 %', icon: 'image', key: 'Ctrl+1', run: () => vw.setZoom(1) },
      { label: 'Ajustar a la ventana', icon: 'fit', key: 'Ctrl+0', run: () => vw.fit() },
      { sep: true },
      flag('Reglas', 'Ctrl+R', 'rulers'),
      flag('Cuadrícula', 'Ctrl+G', 'grid'),
      flag('Barra de estado', '', 'status'),
      flag('Cinta', '', 'ribbon'),
      flag('Miniatura', '', 'thumb'),
      { sep: true },
      { label: 'Pantalla completa', icon: 'fullscreen', key: 'F11', run: () => A().fullView() }
    ];
  }

  R.buildMenubar = function () {
    const bar = document.getElementById('menubar');
    const mb = (label, items) => {
      const b = el('button.mbtn', { text: label, onclick: () => { if (UI.menuOwner === b) UI.closeMenus(0); else UI.menu(b, items, { owner: b }); } });
      b.addEventListener('pointerenter', () => { if (UI.menuOpen() && UI.menuOwner && UI.menuOwner !== b && UI.menuOwner.classList.contains('mbtn')) UI.menu(b, items, { owner: b }); });
      return b;
    };
    R.undoBtn = el('button.ibtn', { html: T.icon('undo', 20), data: { tip: 'Deshacer', key: 'Ctrl+Z' }, 'aria-label': 'Deshacer', onclick: () => A().undo() });
    R.redoBtn = el('button.ibtn', { html: T.icon('redo', 20), data: { tip: 'Rehacer', key: 'Ctrl+Y' }, 'aria-label': 'Rehacer', onclick: () => A().redo() });
    R.unfoldBtn = el('button.ibtn', { html: T.icon('chevDown', 16), data: { tip: 'Mostrar la cinta' }, 'aria-label': 'Mostrar la cinta', onclick: () => A().toggleView('ribbon') });
    U.append(bar, [
      mb('Archivo', fileMenu), mb('Editar', editMenu), mb('Ver', viewMenu), el('div.msep'),
      el('button.ibtn', { html: T.icon('save', 20), data: { tip: 'Guardar', key: 'Ctrl+S' }, 'aria-label': 'Guardar', onclick: () => F().save() }),
      el('button.ibtn', { html: T.icon('open', 20), data: { tip: 'Abrir', key: 'Ctrl+O' }, 'aria-label': 'Abrir', onclick: () => F().open() }),
      el('div.msep'), R.undoBtn, R.redoBtn, el('div.mspacer'), R.unfoldBtn,
      el('button.ibtn', { html: T.icon('settings', 20), data: { tip: 'Configuración' }, 'aria-label': 'Configuración', onclick: () => D().settings() })
    ]);
  };

  /* ---------- Piezas de la cinta ---------- */
  const group = (label, ...kids) => el('div.rgroup', null, el('div.rgroup-body', null, kids), el('div.rgroup-label', { text: label }));
  function tbtn(icon, tip, key, onclick, html) {
    return el('button.tbtn', { html: html || T.icon(icon, 20), data: key ? { tip, key } : { tip }, 'aria-label': tip, onclick });
  }
  function bigSplit(iconFn, tip, onTop, menu) {
    const top = el('button.top', { html: iconFn(), data: { tip }, 'aria-label': tip, onclick: onTop });
    const bot = el('button.bot', { html: T.icon('chevDown', 12), 'aria-label': tip + ': opciones' });
    const node = el('div.bigbtn', null, top, bot);
    bot.addEventListener('click', () => { if (UI.menuOwner === bot) UI.closeMenus(0); else UI.menu(node, menu, { owner: bot }); });
    node.setIcon = () => { top.innerHTML = iconFn(); };
    return node;
  }

  const TOOLS = [
    ['pencil', 'Lápiz', 'pencil'], ['fill', 'Relleno con color', 'fill'], ['text', 'Texto', 'text'],
    ['eraser', 'Borrador', 'eraser'], ['picker', 'Selector de color', 'picker'], ['magnifier', 'Lupa', 'magnifier']
  ];

  function sizeItems() {
    const presets = S().tool === 'shape' ? [1, 3, 5, 8] : S().tool === 'pencil' ? [1, 2, 3, 4] : S().tool === 'eraser' ? [4, 8, 16, 32] : [1, 3, 5, 8, 16, 32];
    return presets.map(p => ({
      label: p + ' px', checked: T.tools.size() === p, radio: true,
      leading: el('span', { style: { display: 'block', width: '44px', height: Math.min(p, 16) + 'px', background: 'currentColor', borderRadius: '1px', flex: 'none' } }),
      run: () => T.tools.setSize(p)
    }));
  }
  function styleMenu(field, noneLabel) {
    return () => [{ label: noneLabel, icon: 'none', checked: S()[field] === 'none', radio: true, run: () => setOpt(field, 'none') }, { sep: true }].concat(
      T.shapes.STYLES.map(s => ({ label: s.name, checked: S()[field] === s.id, radio: true, run: () => setOpt(field, s.id) })));
  }
  function setOpt(field, v) { S()[field] = v; T.bus.emit('toolopts'); }

  R.buildRibbon = function () {
    const rb = document.getElementById('ribbon');

    /* Selección */
    const selBtn = bigSplit(() => T.icon(S().selMode === 'free' ? 'selFree' : 'selRect', 26), 'Seleccionar', () => T.tools.set('select'), () => [
      { label: 'Rectángulo', icon: 'selRect', checked: S().selMode === 'rect', radio: true, run: () => T.tools.set('select', 'rect') },
      { label: 'Forma libre', icon: 'selFree', checked: S().selMode === 'free', radio: true, run: () => T.tools.set('select', 'free') },
      { sep: true },
      { label: 'Seleccionar todo', icon: 'selectAll', key: 'Ctrl+A', run: () => A().selectAll() },
      { label: 'Invertir selección', icon: 'invertSel', run: () => A().invertSelection() },
      { label: 'Selección transparente', checked: !!S().selTransparent, run: () => { S().selTransparent = !S().selTransparent; T.selection.refreshTransparent(); } },
      { sep: true },
      { label: 'Eliminar', icon: 'trash', key: 'Supr', disabled: !T.selection.cur, run: () => T.selection.remove() }
    ]);
    R.selBtn = selBtn;

    /* Imagen */
    const chevBtn = (icon, tip, menu) => {
      const b = el('button.tbtn.chev', { data: { tip }, 'aria-label': tip, onclick: () => UI.menu(b, menu) },
        el('span', { html: T.icon(icon, 20), style: { display: 'flex' } }), el('span.chv', { html: T.icon('chevDown', 11) }));
      return b;
    };
    const rotateBtn = chevBtn('rotate', 'Girar', [
      { label: 'Girar 90° a la derecha', icon: 'rotR', run: () => A().transform('r90') },
      { label: 'Girar 90° a la izquierda', icon: 'rotL', run: () => A().transform('r270') },
      { label: 'Girar 180°', icon: 'rot180', run: () => A().transform('r180') }
    ]);
    const flipBtn = chevBtn('flip', 'Voltear', [
      { label: 'Voltear horizontalmente', icon: 'flipH', run: () => A().transform('fh') },
      { label: 'Voltear verticalmente', icon: 'flipV', run: () => A().transform('fv') }
    ]);
    const imageGrid = el('div.rgrid', { style: { gridTemplateColumns: 'auto auto' } },
      tbtn('crop', 'Recortar a la selección', 'Ctrl+Mayús+X', () => A().crop()), rotateBtn,
      tbtn('resize', 'Cambiar tamaño y sesgar', 'Ctrl+W', () => D().resizeSkew()), flipBtn);

    /* Herramientas */
    R.toolBtns = {};
    const toolGrid = el('div.rgrid', { style: { gridTemplateColumns: 'repeat(3, auto)' } });
    for (const [id, name, icon] of TOOLS) {
      const b = tbtn(icon, name, null, () => T.tools.set(id), T.icon(icon, 22));
      R.toolBtns[id] = b; toolGrid.appendChild(b);
    }

    /* Pinceles */
    const brushBtn = bigSplit(() => T.icon(S().brush, 26), 'Pinceles', () => T.tools.set('brush'), () =>
      T.brushes.KINDS.map(k => ({ label: k.name, icon: k.id, checked: undefined, run: () => T.tools.set('brush', k.id) })));
    R.brushBtn = brushBtn;

    /* Formas */
    R.shapeBtns = {};
    const shapeGallery = () => el('div.gallery', null, T.shapes.LIST.map(s => {
      const b = tbtn(null, s.name, null, () => { UI.closeMenus(0); T.tools.set('shape', s.id); }, T.shapes.icon(s.id, 18));
      b.dataset.shape = s.id;
      return b;
    }));
    const gallery = shapeGallery();
    const galleryWrap = el('div.gallery-wrap', null, gallery);
    const shapesCollapsed = el('button.tbtn.rcollapsed.shapes-c', { html: T.icon('shapes', 24), data: { tip: 'Formas' }, style: { width: '44px', height: '44px' }, onclick: ev => UI.menu(ev.currentTarget, [{ custom: shapeGallery() }, { sep: true }, { label: 'Contorno', icon: 'outline', sub: styleMenu('outline', 'Sin contorno') }, { label: 'Relleno', icon: 'shapeFill', sub: styleMenu('fill', 'Sin relleno') }]) });
    const opt = (icon, label, menu) => {
      const b = el('button.optbtn', { 'aria-label': label, onclick: () => { if (UI.menuOwner === b) UI.closeMenus(0); else UI.menu(b, menu, { owner: b }); } },
        el('span', { html: T.icon(icon, 20), style: { display: 'flex' } }), el('span.chev', { html: T.icon('chevDown', 11), style: { display: 'flex' } }));
      b.dataset.tip = label;
      return b;
    };
    R.outlineBtn = opt('penOutline', 'Contorno', styleMenu('outline', 'Sin contorno'));
    R.fillBtn = opt('bucketShape', 'Relleno', styleMenu('fill', 'Sin relleno'));
    const shapeOpts = el('div.shape-opts', null, R.outlineBtn, R.fillBtn);

    /* Tamaño de la forma */
    const sizeBtn = el('button.sizebtn', { data: { tip: 'Tamaño' }, 'aria-label': 'Tamaño', onclick: ev => UI.menu(ev.currentTarget, sizeItems()) },
      el('span', { html: T.icon('sizeLines', 24), style: { display: 'flex' } }), el('span.chv', { html: T.icon('chevDown', 11) }));
    R.sizeBtn = sizeBtn;

    /* Colores */
    const well = slot => {
      const dot = el('div.dot');
      const b = el('button.colorwell', { 'aria-label': 'Color ' + slot, data: { tip: 'Color ' + slot + (slot === 1 ? ' (botón izquierdo)' : ' (botón derecho)') }, onclick: () => T.colors.select(slot) }, dot);
      b.dot = dot;
      return b;
    };
    R.well1 = well(1); R.well2 = well(2);
    R.palette = el('div.palette');
    const wheel = el('button.wheelbtn', { data: { tip: 'Editar colores' }, 'aria-label': 'Editar colores', onclick: () => T.colors.pick() }, el('div.wheel'));
    const colorsCollapsed = el('button.tbtn.rcollapsed.colors-c', { html: '<div class="wheel" style="width:28px;height:28px"></div>', data: { tip: 'Paleta' }, style: { width: '44px', height: '44px' }, onclick: ev => UI.menu(ev.currentTarget, [{ custom: paletteNode() }, { sep: true }, { label: 'Editar colores…', run: () => T.colors.pick() }]) });

    /* Capas */
    R.layersBtn = el('button.bigbtn.single', { html: T.icon('layers', 28), data: { tip: 'Capas' }, 'aria-label': 'Capas', onclick: () => A().toggleView('layers') });

    U.append(rb, [
      group('Selección', selBtn),
      group('Imagen', imageGrid),
      group('Herramientas', toolGrid),
      group('Pinceles', brushBtn),
      group('Formas', galleryWrap, shapesCollapsed, shapeOpts, sizeBtn),
      group('Colores', el('div.wells', null, R.well1, R.well2), R.palette, colorsCollapsed, wheel),
      group('Capas', R.layersBtn),
      el('button.rfold', { html: T.icon('chevUp', 13), data: { tip: 'Ocultar la cinta' }, 'aria-label': 'Ocultar la cinta', onclick: () => A().toggleView('ribbon') })
    ]);
    R.gallery = gallery;

    // Se compacta por pasos solo si de verdad no cabe; en pantallas muy angostas se desplaza.
    new ResizeObserver(() => {
      rb.classList.remove('c1', 'c2', 'c3');
      for (const c of ['c1', 'c2', 'c3']) {
        if (rb.scrollWidth <= rb.clientWidth) break;
        rb.classList.add(c);
      }
    }).observe(rb);
    drawPalette();
    T.bus.on('tool', R.sync); T.bus.on('toolopts', R.sync); T.bus.on('color', () => { drawPalette(); R.sync(); });
    T.bus.on('history', R.sync); T.bus.on('selection', R.sync); T.bus.on('doc', R.sync);
    R.sync();
  };

  function paletteNode() {
    const box = el('div.palette');
    const add = c => {
      if (c) {
        box.appendChild(el('button.swatch', {
          'aria-label': c, data: { tip: c },
          onclick: () => { T.colors.setActive(c); UI.closeMenus(0); },
          oncontextmenu: ev => { ev.preventDefault(); T.colors.set(2, c); }
        }, el('i', { style: { background: c } })));
      } else box.appendChild(el('button.swatch.empty', { 'aria-label': 'Sin color', onclick: () => T.colors.pick() }, el('i')));
    };
    T.colors.PALETTE.forEach(add);
    for (let i = 0; i < 10; i++) add(S().custom[i] || null);
    return box;
  }
  function drawPalette() {
    const n = paletteNode();
    U.clear(R.palette);
    while (n.firstChild) R.palette.appendChild(n.firstChild);
  }

  R.sync = function () {
    const s = S(), vw = T.view, p = vw.page;
    for (const id in R.toolBtns) R.toolBtns[id].classList.toggle('on', s.tool === id);
    R.selBtn.classList.toggle('on', s.tool === 'select'); R.selBtn.setIcon();
    R.brushBtn.classList.toggle('on', s.tool === 'brush'); R.brushBtn.setIcon();
    R.gallery.querySelectorAll('.tbtn').forEach(b => b.classList.toggle('on', s.tool === 'shape' && b.dataset.shape === s.shape));
    R.well1.dot.style.background = s.color1; R.well2.dot.style.background = s.color2;
    R.well1.classList.toggle('on', s.activeSlot === 1); R.well2.classList.toggle('on', s.activeSlot === 2);
    const onShape = s.tool === 'shape';
    for (const b of [R.sizeBtn, R.outlineBtn, R.fillBtn]) b.classList.toggle('dim', !onShape);
    R.layersBtn.classList.toggle('on', !!s.view.layers);
    document.getElementById('ribbon').hidden = !s.view.ribbon;
    R.unfoldBtn.hidden = !!s.view.ribbon;
    if (p) {
      R.undoBtn.disabled = !p.canUndo && !A().hasPending();
      R.redoBtn.disabled = !p.canRedo;
    }
  };
})();
