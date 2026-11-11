'use strict';
/* Trazo · diálogos: nuevo, nuevo icono, tamaño y sesgo, propiedades, configuración y resoluciones. */
(function () {
  const T = window.T, U = T.util, el = U.el, UI = T.ui;
  const D = T.dialogs = {};
  const page = () => T.view.page;

  /* ---------- Nuevo ---------- */
  D.newImage = async function () {
    if (!await T.app.confirmDiscard()) return;
    const w = UI.num(1152, 1, 20000), h = UI.num(648, 1, 20000);
    w.dataset.autofocus = '';
    const bgName = UI.radioName();
    const white = UI.radio(bgName, 'white', 'Fondo blanco', true);
    const clear = UI.radio(bgName, 'clear', 'Fondo transparente');
    const body = el('div', null, el('div.frow', null, UI.field('Ancho (px)', w), UI.field('Alto (px)', h)), white, clear);
    const ok = await UI.dialog({
      title: 'Nueva imagen', body, width: 340, cancelValue: false,
      buttons: [{
        label: 'Crear', primary: true,
        onClick: () => w.getValue() != null && h.getValue() != null ? true : false
      }, { label: 'Cancelar', value: false }]
    });
    if (!ok) return;
    T.app.setDoc(new T.Doc([new T.Page(w.getValue(), h.getValue(), { transparent: UI.radioValue(body, bgName) === 'clear' })]));
  };

  /* Selector de tamaños de icono (chips + personalizado). */
  function sizePicker(initial) {
    const sizes = [16, 20, 24, 32, 40, 48, 64, 72, 96, 128, 180, 256];
    const on = new Set(initial);
    const box = el('div.sizes', null, sizes.map(s => {
      const b = el('button.chip', { type: 'button', text: s + ' × ' + s, class: on.has(s) ? 'on' : '', onclick: () => { if (on.has(s)) on.delete(s); else on.add(s); b.classList.toggle('on', on.has(s)); } });
      return b;
    }));
    return { node: box, values: () => Array.from(on).sort((a, b) => b - a) };
  }

  D.newIcon = async function () {
    if (!await T.app.confirmDiscard()) return;
    const pick = sizePicker([16, 32, 48, 256]);
    const body = el('div', null, el('div.fnote', { text: 'Elige las resoluciones del icono. Cada una se dibuja por separado; después puedes agregar más.' }), pick.node);
    const r = await UI.dialog({
      title: 'Nuevo icono', body, width: 460, cancelValue: null,
      buttons: [{ label: 'Crear', primary: true, onClick: () => (pick.values().length ? pick.values() : false) }, { label: 'Cancelar', value: null }]
    });
    if (!r) return;
    T.app.setDoc(new T.Doc(r.map(s => new T.Page(s, s, { transparent: true })), { kind: 'icon', format: 'ico' }));
  };

  /* ---------- Cambiar tamaño y sesgar ---------- */
  D.resizeSkew = async function () {
    const pg = page(), sel = T.selection.cur, baseW = sel ? sel.w : pg.w, baseH = sel ? sel.h : pg.h;
    const name = UI.radioName();
    const pct = UI.radio(name, 'pct', 'Porcentaje', true), px = UI.radio(name, 'px', 'Píxeles');
    const hI = UI.num(100, 0.1, 20000, { float: true }), vI = UI.num(100, 0.1, 20000, { float: true });
    hI.dataset.autofocus = '';
    const keep = UI.check('Mantener relación de aspecto', true);
    const skX = UI.num(0, -89, 89), skY = UI.num(0, -89, 89);
    if (sel) { skX.disabled = true; skY.disabled = true; }
    const isPct = () => UI.radioValue(body, name) === 'pct';
    const body = el('div', null,
      el('div.fsection', { text: 'Cambiar tamaño' }), el('div.frow', null, pct, px),
      el('div.frow', null, UI.field('Horizontal', hI), UI.field('Vertical', vI)), keep,
      el('div.fsection', { text: 'Sesgar (grados)' }),
      sel ? el('div.fnote', { text: 'El sesgo se aplica a toda la imagen: quita la selección para usarlo.' }) : null,
      el('div.frow', null, UI.field('Horizontal', skX), UI.field('Vertical', skY)));
    const link = from => {
      if (!keep.input.checked) return;
      const v = from.getValue();
      if (v == null) return;
      const other = from === hI ? vI : hI;
      if (isPct()) other.value = String(v);
      else other.value = String(Math.max(1, Math.round(from === hI ? v * baseH / baseW : v * baseW / baseH)));
      other.classList.remove('bad');
    };
    hI.addEventListener('input', () => link(hI));
    vI.addEventListener('input', () => link(vI));
    [pct, px].forEach(r => r.input.addEventListener('change', () => {
      if (isPct()) { hI.value = '100'; vI.value = '100'; } else { hI.value = String(baseW); vI.value = String(baseH); }
    }));
    const res = await UI.dialog({
      title: 'Cambiar tamaño y sesgar', body, width: 360, cancelValue: null,
      buttons: [{
        label: 'Aceptar', primary: true,
        onClick: () => {
          const a = hI.getValue(), b = vI.getValue(), c = skX.getValue(), d = skY.getValue();
          if (a == null || b == null || c == null || d == null) return false;
          const nw = isPct() ? Math.round(baseW * a / 100) : Math.round(a), nh = isPct() ? Math.round(baseH * b / 100) : Math.round(b);
          if (nw < 1 || nh < 1 || nw > 20000 || nh > 20000) return false;
          return { nw, nh, c, d };
        }
      }, { label: 'Cancelar', value: null }]
    });
    if (!res) return;
    await T.app.applyResize(res.nw, res.nh, res.c, res.d);
  };

  /* ---------- Propiedades ---------- */
  D.properties = async function () {
    const pg = page(), doc = T.doc;
    const name = UI.radioName();
    const DPI = 96;
    const toUnit = (v, u) => u === 'in' ? v / DPI : u === 'cm' ? v / DPI * 2.54 : v;
    const fromUnit = (v, u) => Math.round(u === 'in' ? v * DPI : u === 'cm' ? v / 2.54 * DPI : v);
    let unit = 'px';
    const w = UI.num(pg.w, 0.01, 20000, { float: true }), h = UI.num(pg.h, 0.01, 20000, { float: true });
    w.dataset.autofocus = '';
    const radios = [['px', 'Píxeles'], ['in', 'Pulgadas'], ['cm', 'Centímetros']].map(([v, l]) => {
      const r = UI.radio(name, v, l, v === 'px');
      r.input.addEventListener('change', () => {
        const a = w.getValue(), b = h.getValue();
        if (a == null || b == null) return;
        const pa = fromUnit(a, unit), pb = fromUnit(b, unit);
        unit = v;
        const fmt = n => (v === 'px' ? String(n) : (Math.round(toUnit(n, v) * 100) / 100).toString());
        w.value = fmt(pa); h.value = fmt(pb);
      });
      return r;
    });
    const transparent = UI.check('Fondo transparente', !pg.bg.visible);
    const fileInfo = el('dl.kv', null,
      el('dt', { text: 'Archivo' }), el('dd', { text: doc.name }),
      el('dt', { text: 'Última vez guardado' }), el('dd', { text: doc.savedAt ? new Date(doc.savedAt).toLocaleString('es') : 'No disponible' }),
      el('dt', { text: 'Tamaño en disco' }), el('dd', { text: doc.fileSize != null ? U.fmtBytes(doc.fileSize) : 'No disponible' }),
      el('dt', { text: 'Resolución' }), el('dd', { text: DPI + ' PPP' }),
      el('dt', { text: 'Capas' }), el('dd', { text: String(pg.layers.length) }),
      doc.kind === 'icon' ? el('dt', { text: 'Resoluciones' }) : null, doc.kind === 'icon' ? el('dd', { text: String(doc.pages.length) }) : null);
    const body = el('div', null, fileInfo, el('div.fsection', { text: 'Unidades' }), el('div.frow', null, radios), el('div.fsection', { text: 'Tamaño de imagen' }),
      el('div.frow', null, UI.field('Ancho', w), UI.field('Alto', h)), transparent);
    const res = await UI.dialog({
      title: 'Propiedades de imagen', body, width: 400, cancelValue: null,
      buttons: [{
        label: 'Aceptar', primary: true,
        onClick: () => {
          const a = w.getValue(), b = h.getValue();
          return a == null || b == null ? false : { w: fromUnit(a, unit), h: fromUnit(b, unit) };
        }
      }, { label: 'Cancelar', value: null }]
    });
    if (!res) return;
    if (res.w !== pg.w || res.h !== pg.h) T.app.resizeCanvas(res.w, res.h);
    if (transparent.input.checked === pg.bg.visible) { T.app.finishPending(); pg.setBackground(null, !transparent.input.checked); }
  };

  /* ---------- Configuración ---------- */
  D.settings = async function () {
    const name = UI.radioName(), cur = T.state.theme;
    const opts = [['light', 'Claro'], ['dark', 'Oscuro'], ['system', 'Usar la configuración del sistema']].map(([v, l]) => {
      const r = UI.radio(name, v, l, v === cur);
      r.input.addEventListener('change', () => { T.state.theme = v; T.app.applyTheme(); T.app.saveState(); });
      return r;
    });
    const lang = el('select.tselect', { 'aria-label': 'Idioma', style: { width: '100%' }, onchange: e => T.app.setLanguage(e.target.value) },
      el('option', { value: 'system', text: 'Usar el idioma del sistema' }),
      // cada idioma se nombra en su propia lengua, sin traducir
      [['es', 'Español'], ['en', 'English'], ['pt', 'Português']].map(([v, t]) => { const o = el('option', { value: v }); o.textContent = t; return o; }));
    lang.value = T.state.lang;
    const fname = UI.radioName(), f11 = T.app.f11Mode();
    const full = [
      ['window', 'F11: pantalla completa normal', 'Mayús+F11: solo la imagen, como en Paint.'],
      ['image', 'F11: solo la imagen, como en Paint', 'Mayús+F11: pantalla completa normal.']
    ].map(([v, l, sub]) => {
      const r = UI.radio(fname, v, l, v === f11, sub);
      r.input.addEventListener('change', () => T.app.setF11(v));
      return r;
    });
    await UI.dialog({
      title: 'Configuración', width: 380,
      body: el('div', null, el('div.fsection', { text: 'Idioma' }), lang, el('div.fsection', { text: 'Tema de la aplicación' }), opts,
        el('div.fsection', { text: 'Pantalla completa' }), full),
      buttons: [{ label: 'Cerrar', primary: true, value: true }]
    });
  };

  D.about = function () {
    return UI.dialog({
      title: 'Trazo', width: 400,
      body: el('div', null,
        el('p', { style: { marginTop: 0 }, text: 'Editor de imágenes de escritorio inspirado en el flujo de trabajo de Paint, sin funciones de inteligencia artificial.' }),
        el('p', { text: 'Trabaja con SVG como vector y con iconos ICO de varias resoluciones editables por separado.' }),
        el('p', { style: { marginBottom: 0, color: 'var(--text2)' }, text: 'Todo se procesa en tu equipo: la aplicación no se conecta a internet.' })),
      buttons: [{ label: 'Cerrar', primary: true, value: true }]
    });
  };

  D.renameLayer = async function (pg, L) {
    const input = el('input.tinput', { type: 'text', value: L.name, maxLength: 60 });
    input.dataset.autofocus = '';
    const r = await UI.dialog({
      title: 'Cambiar nombre de la capa', body: input, width: 340, cancelValue: null,
      buttons: [{ label: 'Aceptar', primary: true, onClick: () => input.value.trim() || false }, { label: 'Cancelar', value: null }]
    });
    if (r) { T.app.finishPending(); L.name = r; T.bus.emit('structure', pg); pg.commit('Cambiar nombre'); }
  };

  /* ---------- Opciones de guardado ---------- */
  D.svgOptions = function () {
    const pg = page(), info = T.svg.describe(pg), name = UI.radioName();
    const mode = T.doc.svgMode || 'vector';
    const body = el('div', null,
      el('div.fnote', { style: { marginTop: 0 }, text: info.pure ? 'Todo lo dibujado se puede guardar como vector.' : 'Esta imagen contiene partes de mapa de bits (fotos o pinceles con textura).' }),
      UI.radio(name, 'vector', 'Vectorial', mode === 'vector', info.pure ? 'Trazos, formas y texto como elementos SVG editables.' : 'Lo dibujado queda como vector; los mapas de bits se incrustan tal cual.'),
      UI.radio(name, 'pixels', 'Píxeles a vector', mode === 'pixels', 'Cada color se convierte en una ruta. Ideal para iconos y pixel art.'),
      UI.radio(name, 'image', 'Imagen incrustada', mode === 'image', 'Un único PNG dentro del SVG.'));
    return UI.dialog({
      title: 'Guardar como SVG', body, width: 440, cancelValue: null,
      buttons: [{ label: 'Guardar', primary: true, onClick: () => UI.radioValue(body, name) }, { label: 'Cancelar', value: null }]
    });
  };

  D.paintHidden = function () {
    return UI.dialog({
      title: 'Capas ocultas', width: 420, cancelValue: null,
      body: 'Este proyecto tiene capas ocultas y el formato .paint no guarda esa información. ¿Qué quieres hacer con ellas?',
      buttons: [{ label: 'Omitirlas', value: 'omit', primary: true }, { label: 'Incluirlas visibles', value: 'keep' }, { label: 'Cancelar', value: null }]
    });
  };

  D.exportIco = function () {
    const pg = page();
    const initial = [16, 32, 48, 256];
    const pick = sizePicker(initial);
    const body = el('div', null,
      el('div.fnote', { style: { marginTop: 0 }, text: 'Se generará un icono con estas resoluciones a partir de la imagen de ' + pg.w + ' × ' + pg.h + '. Si es vectorial, cada tamaño se dibuja nítido.' }), pick.node);
    return UI.dialog({
      title: 'Guardar como ICO', body, width: 460, cancelValue: null,
      buttons: [{ label: 'Guardar', primary: true, onClick: () => (pick.values().length ? pick.values() : false) }, { label: 'Cancelar', value: null }]
    });
  };

  D.icoOptions = function () {
    const name = UI.radioName(), mode = T.doc.icoPng || 'auto';
    const body = el('div', null,
      UI.radio(name, 'auto', 'Automático', mode === 'auto', 'PNG en 256 × 256 y mapa de bits en las demás: máxima compatibilidad.'),
      UI.radio(name, 'png', 'Todo en PNG', mode === 'png', 'Archivo más pequeño. Requiere Windows Vista o posterior.'),
      UI.radio(name, 'bmp', 'Todo en mapa de bits', mode === 'bmp', 'El formato clásico, sin comprimir.'));
    return UI.dialog({
      title: 'Formato interno del icono', body, width: 420, cancelValue: null,
      buttons: [{ label: 'Guardar', primary: true, onClick: () => UI.radioValue(body, name) }, { label: 'Cancelar', value: null }]
    });
  };

  /* ---------- Agregar resolución ---------- */
  D.addIconSize = async function () {
    const doc = T.doc;
    T.app.finishPending();
    const pick = sizePicker([]);
    const w = UI.num('', 1, 256), h = UI.num('', 1, 256);
    const name = UI.radioName();
    const blank = UI.radio(name, 'blank', 'En blanco', false);
    const scale = UI.radio(name, 'scale', 'Generar a partir de', true);
    const src = el('select.tselect', null, doc.pages.map((p, i) => el('option', { value: i, text: p.w + ' × ' + p.h })));
    src.value = String(doc.index);
    const body = el('div', null, pick.node, el('div.fsection', { text: 'Tamaño personalizado' }), el('div.frow', null, UI.field('Ancho', w), UI.field('Alto', h)),
      el('div.fsection', { text: 'Contenido' }), blank, el('div.frow', null, scale, src));
    const r = await UI.dialog({
      title: 'Agregar resolución', body, width: 460, cancelValue: null,
      buttons: [{
        label: 'Agregar', primary: true,
        onClick: () => {
          const sizes = pick.values().map(s => [s, s]);
          const cw = w.getValue(), ch = h.getValue();
          if (cw != null && ch != null && String(w.value).trim() && String(h.value).trim()) sizes.push([cw, ch]);
          return sizes.length ? { sizes, method: UI.radioValue(body, name), src: +src.value } : false;
        }
      }, { label: 'Cancelar', value: null }]
    });
    if (r) await T.ico.add(r.sizes, r.method, doc.pages[r.src]);
  };
})();
