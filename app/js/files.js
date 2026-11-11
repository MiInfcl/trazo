'use strict';
/* Trazo · abrir, guardar, importar, imprimir y operar con las resoluciones de un icono. */
(function () {
  const T = window.T, U = T.util, V = T.vec, UI = T.ui, K = T.codecs;
  const F = T.files = {};
  const page = () => T.view.page;

  const IMAGE_EXT = ['png', 'jpg', 'jpeg', 'jfif', 'bmp', 'dib', 'gif', 'webp', 'avif', 'heic', 'heif', 'tif', 'tiff', 'svg', 'ico', 'cur', 'trazo'];
  const OPEN_TYPES = [
    { name: 'Todos los archivos de imagen', ext: IMAGE_EXT },
    { name: 'SVG', ext: ['svg'] }, { name: 'Iconos', ext: ['ico', 'cur'] }, { name: 'Proyecto de Trazo', ext: ['trazo'] }
  ];
  const FORMATS = {
    png: { name: 'PNG', ext: ['png'] }, jpg: { name: 'JPEG', ext: ['jpg', 'jpeg'] }, bmp: { name: 'Mapa de bits', ext: ['bmp'] },
    gif: { name: 'GIF', ext: ['gif'] }, tiff: { name: 'TIFF', ext: ['tiff', 'tif'] }, webp: { name: 'WebP', ext: ['webp'] },
    svg: { name: 'SVG', ext: ['svg'] }, ico: { name: 'Icono', ext: ['ico'] }, trazo: { name: 'Proyecto de Trazo', ext: ['trazo'] }
  };
  const fmtOfExt = e => (e === 'jpeg' || e === 'jfif' ? 'jpg' : e === 'tif' ? 'tiff' : e === 'dib' ? 'bmp' : e);

  function looksSVG(bytes) {
    const head = U.bytesToText(bytes.subarray(0, Math.min(bytes.length, 2048))).trimStart().toLowerCase();
    return head.startsWith('<svg') || (head.startsWith('<?xml') && head.includes('<svg')) || head.startsWith('<!doctype svg') || (head.startsWith('<!--') && head.includes('<svg'));
  }

  async function decodeRaster(bytes) {
    const url = URL.createObjectURL(new Blob([bytes]));
    try {
      const im = await U.loadImage(url);
      const c = U.canvas(im.naturalWidth, im.naturalHeight);
      c.ctx.drawImage(im, 0, 0);
      return c;
    } finally { URL.revokeObjectURL(url); }
  }
  const canvasFromRGBA = (w, h, rgba) => U.imageDataToCanvas(new ImageData(new Uint8ClampedArray(rgba), w, h));

  /* Convierte bytes en un documento. */
  async function parse(name, bytes, handle, size) {
    const ext = U.ext(name);
    const base = { name, handle: handle || null, fileSize: size != null ? size : bytes.length, savedAt: Date.now() };
    if (ext === 'trazo') return loadProject(bytes, base);
    if (ext === 'svg' || looksSVG(bytes)) {
      const svg = T.svg.parse(U.bytesToText(bytes));
      const c = await T.svg.rasterize(svg.src, svg.w, svg.h);
      const p = T.Page.fromCanvas(c, { transparent: true });
      p.layers[0].vec = [V.svg(0, 0, svg.w, svg.h, svg.src)];
      p.rebase();
      return new T.Doc([p], Object.assign(base, { format: 'svg' }));
    }
    if (ext === 'ico' || ext === 'cur') {
      const ico = K.readICO(bytes);
      const pages = [];
      for (const e of ico.entries) {
        const c = e.png ? await decodeRaster(e.png) : canvasFromRGBA(e.w, e.h, e.rgba);
        const p = T.Page.fromCanvas(c, { transparent: true });
        p.meta = { bpp: e.bpp };
        pages.push(p);
      }
      sortPages(pages);
      if (ico.errors.length) UI.toast('Se omitieron ' + ico.errors.length + ' imágenes dañadas del icono.', 4000);
      return new T.Doc(pages, Object.assign(base, { format: ext === 'cur' ? null : 'ico', kind: 'icon', name: ext === 'cur' ? U.baseName(name) + '.ico' : name }));
    }
    if (ext === 'tif' || ext === 'tiff') {
      const t = K.readTIFF(bytes);
      const p = T.Page.fromCanvas(canvasFromRGBA(t.w, t.h, t.rgba), { transparent: false });
      return new T.Doc([p], Object.assign(base, { format: 'tiff' }));
    }
    if (ext === 'heic' || ext === 'heif') {
      if (!T.host.desktop) throw new Error('El navegador no sabe leer HEIC. Ábrelo en la versión de escritorio de Trazo, o conviértelo antes a JPEG o PNG.');
      const r = await T.host.call('decodeImage', { b64: U.bytesToBase64(bytes) });
      const c = await decodeRaster(U.base64ToBytes(r.png));
      return new T.Doc([T.Page.fromCanvas(c, { transparent: false })], Object.assign(base, { format: null, handle: null, name: U.baseName(name) + '.png' }));
    }
    const c = await decodeRaster(bytes);
    // Si trae transparencia, el fondo blanco la taparía y se perdería al guardar.
    const p = T.Page.fromCanvas(c, { transparent: hasAlpha(c) });
    return new T.Doc([p], Object.assign(base, { format: FORMATS[fmtOfExt(ext)] ? fmtOfExt(ext) : null }));
  }
  function hasAlpha(c) {
    const d = c.ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < d.length; i += 4) if (d[i] < 255) return true;
    return false;
  }
  function sortPages(pages) { pages.sort((a, b) => b.w * b.h - a.w * a.h); }

  F.openBytes = async function (name, bytes, handle, size) {
    try {
      const doc = await parse(name, bytes, handle, size);
      T.app.setDoc(doc);
      addRecent(name, handle);
    } catch (e) {
      console.error(e);
      UI.alert('No se pudo abrir el archivo', name + '\n\n' + (e.message || e));
    }
  };

  F.open = async function () {
    T.app.finishPending();
    if (!await T.app.confirmDiscard()) return;
    const list = await T.host.pickOpen(OPEN_TYPES, false);
    if (list.length) await F.openBytes(list[0].name, list[0].bytes, list[0].handle, list[0].size);
  };

  /* ---------- Recientes ---------- */
  F.recentList = () => U.store.get('recent', []);
  function addRecent(name, handle) {
    if (!handle || !handle.path) return;
    const l = F.recentList().filter(r => r.path !== handle.path);
    l.unshift({ name, path: handle.path });
    U.store.set('recent', l.slice(0, 12));
  }
  F.openRecent = async function (r) {
    if (!await T.app.confirmDiscard()) return;
    try {
      const f = await T.host.readRecent(r);
      if (f) await F.openBytes(f.name, f.bytes, f.handle, f.size);
    } catch (e) {
      U.store.set('recent', F.recentList().filter(x => x.path !== r.path));
      UI.alert('No se pudo abrir el archivo', r.name + '\n\n' + (e.message || e));
    }
  };

  /* ---------- Importar y pegar ---------- */
  F.placeBytes = async function (name, bytes) {
    if (U.ext(name) === 'svg' || looksSVG(bytes)) {
      const svg = T.svg.parse(U.bytesToText(bytes));
      const c = await T.svg.rasterize(svg.src, svg.w, svg.h);
      T.selection.paste(c, { svg: svg.src, x: 0, y: 0 });
      return;
    }
    let c;
    if (U.ext(name) === 'ico' || U.ext(name) === 'cur') {
      const e = K.readICO(bytes).entries.reduce((a, b) => (b.w * b.h > a.w * a.h ? b : a));
      c = e.png ? await decodeRaster(e.png) : canvasFromRGBA(e.w, e.h, e.rgba);
    } else if (/^tiff?$/.test(U.ext(name))) {
      const t = K.readTIFF(bytes);
      c = canvasFromRGBA(t.w, t.h, t.rgba);
    } else c = await decodeRaster(bytes);
    T.selection.paste(c, { x: 0, y: 0 });
  };
  F.importToCanvas = async function () {
    const list = await T.host.pickOpen(OPEN_TYPES.slice(0, 3), false);
    if (!list.length) return;
    try { await F.placeBytes(list[0].name, list[0].bytes); }
    catch (e) { UI.alert('No se pudo importar el archivo', e.message || String(e)); }
  };

  /* ---------- Codificar ---------- */
  async function canvasBytes(c, mime, q) { return U.blobToBytes(await U.canvasToBlob(c, mime, q)); }
  function flatOnWhite(pg) {
    const c = U.canvas(pg.w, pg.h);
    c.ctx.fillStyle = '#fff';
    c.ctx.fillRect(0, 0, pg.w, pg.h);
    c.ctx.drawImage(pg.composite(), 0, 0);
    return c;
  }
  const rgbaOf = c => c.ctx.getImageData(0, 0, c.width, c.height).data;

  async function encodePage(pg, fmt) {
    const comp = pg.composite();
    switch (fmt) {
      case 'png': return canvasBytes(comp, 'image/png');
      case 'jpg': return canvasBytes(flatOnWhite(pg), 'image/jpeg', 0.92);
      case 'webp': return canvasBytes(comp, 'image/webp', 0.95);
      case 'bmp': return K.writeBMP(rgbaOf(comp), pg.w, pg.h);
      case 'gif': return K.writeGIF(rgbaOf(comp), pg.w, pg.h);
      case 'tiff': return K.writeTIFF(rgbaOf(comp), pg.w, pg.h);
      default: throw new Error('Formato desconocido');
    }
  }

  async function encodeICO(images, policy) {
    const out = [];
    for (const im of images) {
      const big = im.c.width >= 256 || im.c.height >= 256;
      const usePng = policy === 'png' || (policy === 'auto' && big);
      out.push({ w: im.c.width, h: im.c.height, rgba: rgbaOf(im.c), png: usePng ? await canvasBytes(im.c, 'image/png') : null });
    }
    return K.writeICO(out);
  }

  function encodeSVG(pg, mode) {
    if (mode === 'pixels') {
      const s = T.svg.exportPixels(pg, 4096);
      if (s === null) throw new Error('La imagen tiene demasiados colores para convertir los píxeles a vector. Elige «Vectorial» o «Imagen incrustada».');
      return U.textToBytes(s);
    }
    return U.textToBytes(mode === 'image' ? T.svg.exportImage(pg) : T.svg.exportVector(pg));
  }

  /* Comprueba que un icono se puede guardar; si no, avisa. */
  function checkIconSizes(doc) {
    const bad = doc.pages.find(p => p.w > 256 || p.h > 256);
    if (bad) { UI.alert('No se puede guardar el icono', 'Hay una resolución de ' + bad.w + ' × ' + bad.h + '. El formato ICO admite hasta 256 × 256.'); return false; }
    return true;
  }

  /* Bytes del documento en su formato. */
  async function encodeDoc(doc, fmt) {
    if (fmt === 'trazo') return saveProject(doc);
    if (fmt === 'ico') return encodeICO(doc.pages.map(p => ({ c: p.composite() })), doc.icoPng);
    if (fmt === 'svg') return encodeSVG(doc.page, doc.svgMode);
    return encodePage(doc.page, fmt);
  }

  async function writeTo(target, bytes, doc, fmt) {
    await T.host.write(target, bytes);
    if (doc) {
      doc.name = target.name; doc.titled = true; doc.format = fmt; doc.handle = target.handle;
      doc.fileSize = bytes.length; doc.savedAt = Date.now(); doc.dirty = false;
      addRecent(target.name, target.handle);
      T.bus.emit('doc');
      T.app.refreshTitle();
    }
  }
  const withExt = (doc, ext) => U.baseName(doc.name) + '.' + ext;

  /* Guarda en su archivo. Devuelve true si quedó guardado. */
  F.save = async function () {
    T.app.finishPending();
    const doc = T.doc;
    if (!doc.format || (!doc.handle && !doc.titled)) return F.saveAs(doc.format || (doc.kind === 'icon' ? 'ico' : 'png'));
    if (!doc.handle) return F.saveAs(doc.format);
    try {
      if (doc.format === 'ico' && !checkIconSizes(doc)) return false;
      await writeTo({ name: doc.name, handle: doc.handle }, await encodeDoc(doc, doc.format), doc, doc.format);
      UI.toast('Guardado');
      return true;
    } catch (e) {
      UI.alert('No se pudo guardar', e.message || String(e));
      return false;
    }
  };

  F.saveAs = async function (fmt) {
    T.app.finishPending();
    const doc = T.doc, info = FORMATS[fmt];
    try {
      /* Un icono guardado como otra cosa exporta solo la resolución actual: el documento sigue siendo el icono. */
      if (doc.kind === 'icon' && fmt !== 'ico' && fmt !== 'trazo') {
        const pg = doc.page;
        let bytes;
        if (fmt === 'svg') {
          const mode = await T.dialogs.svgOptions();
          if (!mode) return false;
          bytes = encodeSVG(pg, mode);
        } else bytes = await encodePage(pg, fmt);
        const t = await T.host.pickSave(U.baseName(doc.name) + '-' + pg.w + 'x' + pg.h + '.' + info.ext[0], [info]);
        if (!t) return false;
        await T.host.write(t, bytes);
        UI.toast('Exportado: ' + t.name);
        return true;
      }
      /* Una imagen guardada como ICO genera las resoluciones: el documento sigue siendo la imagen. */
      if (fmt === 'ico' && doc.kind !== 'icon') {
        const sizes = await T.dialogs.exportIco();
        if (!sizes) return false;
        const images = [];
        for (const s of sizes) images.push({ c: await fitted(doc.page, s, s) });
        const bytes = await encodeICO(images, 'auto');
        const t = await T.host.pickSave(withExt(doc, 'ico'), [info]);
        if (!t) return false;
        await T.host.write(t, bytes);
        UI.toast('Icono exportado con ' + sizes.length + ' resoluciones: ' + t.name, 3500);
        return true;
      }
      if (fmt === 'ico') {
        if (!checkIconSizes(doc)) return false;
        const pol = await T.dialogs.icoOptions();
        if (!pol) return false;
        doc.icoPng = pol;
      }
      if (fmt === 'svg') {
        const mode = await T.dialogs.svgOptions();
        if (!mode) return false;
        doc.svgMode = mode;
      }
      const bytes = await encodeDoc(doc, fmt);
      const t = await T.host.pickSave(withExt(doc, info.ext[0]), [info]);
      if (!t) return false;
      await writeTo(t, bytes, doc, fmt);
      UI.toast('Guardado: ' + t.name);
      return true;
    } catch (e) {
      console.error(e);
      UI.alert('No se pudo guardar', e.message || String(e));
      return false;
    }
  };

  /* Bytes para una prueba o uso externo (también lo usan las pruebas de la app). */
  F.encodeDoc = encodeDoc;
  F.parse = parse;

  /* ---------- Proyecto de Trazo: conserva capas, vector y resoluciones ---------- */
  function vecToJson(vec) {
    return vec.map(op => {
      const o = Object.assign({}, op);
      if (op.im) o.im = imageDataUrl(op.im);
      if (op.kids) o.kids = vecToJson(op.kids);
      return o;
    });
  }
  const imageDataUrl = im => U.imageDataToCanvas(im).toDataURL('image/png');
  async function vecFromJson(list) {
    const out = [];
    for (const o of list) {
      const op = Object.assign({}, o);
      if (typeof o.im === 'string') {
        if (!/^data:image\/png;base64,/.test(o.im)) throw new Error('Proyecto dañado.');
        const im = await U.loadImage(o.im), c = U.canvas(im.naturalWidth, im.naturalHeight);
        c.ctx.drawImage(im, 0, 0);
        op.im = c.ctx.getImageData(0, 0, c.width, c.height);
      }
      if (o.kids) op.kids = await vecFromJson(o.kids);
      if (o.k === 'svg') op.src = T.svg.parse(o.src).src;
      if (o.k === 'raw' && /<script|\son\w+\s*=|javascript:/i.test(o.s)) throw new Error('El proyecto contiene marcado no permitido.');
      out.push(op);
    }
    return out;
  }
  function saveProject(doc) {
    const data = {
      app: 'trazo', version: 1, kind: doc.kind,
      pages: doc.pages.map(p => ({
        w: p.w, h: p.h, bg: p.bg, active: p.activeIndex,
        layers: p.layers.map(L => ({ name: L.name, visible: L.visible, png: L.canvas.toDataURL('image/png'), vec: vecToJson(L.vec) }))
      }))
    };
    return U.textToBytes(JSON.stringify(data));
  }
  async function loadProject(bytes, base) {
    let data;
    try { data = JSON.parse(U.bytesToText(bytes)); } catch (e) { throw new Error('El proyecto está dañado.'); }
    if (data.app !== 'trazo' || !Array.isArray(data.pages)) throw new Error('No es un proyecto de Trazo.');
    const pages = [];
    for (const pd of data.pages) {
      const p = new T.Page(pd.w, pd.h, { transparent: !pd.bg.visible, bgColor: pd.bg.color });
      p.layers = [];
      for (const ld of pd.layers) {
        const L = new T.Layer(pd.w, pd.h, ld.name);
        L.visible = ld.visible;
        if (!/^data:image\/png;base64,/.test(ld.png)) throw new Error('Proyecto dañado.');
        L.ctx.drawImage(await U.loadImage(ld.png), 0, 0);
        L.vec = await vecFromJson(ld.vec);
        p.layers.push(L);
      }
      p.activeId = p.layers[U.clamp(pd.active | 0, 0, p.layers.length - 1)].id;
      p.rebase();
      pages.push(p);
    }
    if (!pages.length) throw new Error('El proyecto no tiene páginas.');
    return new T.Doc(pages, Object.assign(base, { format: 'trazo', kind: data.kind === 'icon' ? 'icon' : 'image' }));
  }

  /* ---------- Imprimir y fondo de escritorio ---------- */
  F.print = function () {
    T.app.finishPending();
    const area = document.getElementById('printArea');
    U.clear(area).appendChild(U.el('img', { src: page().composite().toDataURL('image/png') }));
    setTimeout(() => window.print(), 50);
  };
  F.wallpaper = async function (mode) {
    T.app.finishPending();
    try {
      await T.host.setWallpaper(K.writeBMP(rgbaOf(page().composite()), page().w, page().h), mode);
      UI.toast('Fondo de escritorio actualizado');
    } catch (e) { UI.alert('No se pudo establecer el fondo', e.message || String(e)); }
  };

  /* ---------- Resoluciones de icono ---------- */
  /* Dibuja una página a otro tamaño: desde el vector si es vector puro; si no, escalando. */
  async function scaledFrom(src, w, h) {
    const info = T.svg.describe(src);
    if (info.any && info.pure) {
      try { return await T.svg.renderPage(src, w, h); } catch (e) { /* se escala el mapa de bits */ }
    }
    const c = U.canvas(w, h);
    const comp = src.composite();
    const up = w > src.w || h > src.h;
    c.ctx.imageSmoothingEnabled = !up; c.ctx.imageSmoothingQuality = 'high';
    U.drawScaled(c.ctx, comp, w, h);
    return c;
  }
  /* Igual, pero sin deformar: la imagen queda centrada dentro del tamaño pedido. */
  async function fitted(src, w, h) {
    const k = Math.min(w / src.w, h / src.h);
    const iw = Math.max(1, Math.round(src.w * k)), ih = Math.max(1, Math.round(src.h * k));
    const inner = await scaledFrom(src, iw, ih);
    if (iw === w && ih === h) return inner;
    const c = U.canvas(w, h);
    c.ctx.drawImage(inner, Math.floor((w - iw) / 2), Math.floor((h - ih) / 2));
    return c;
  }
  F.scaledFrom = scaledFrom;

  const ICO = T.ico = {};
  ICO.add = async function (sizes, method, src) {
    const doc = T.doc;
    let last = null;
    for (const [w, h] of sizes) {
      let p;
      if (method === 'scale') p = T.Page.fromCanvas(await fitted(src, w, h), { transparent: true });
      else p = new T.Page(w, h, { transparent: true });
      doc.pages.push(p);
      last = p;
    }
    const cur = doc.page;
    sortPages(doc.pages);
    doc.index = doc.pages.indexOf(last || cur);
    doc.dirty = true;
    T.app.showPage(doc.index, true);
  };
  ICO.duplicate = async function (pg) {
    const doc = T.doc;
    T.app.finishPending();
    const p = new T.Page(pg.w, pg.h, { transparent: !pg.bg.visible, bgColor: pg.bg.color });
    p.layers = pg.layers.map(L => {
      const n = new T.Layer(pg.w, pg.h, L.name);
      n.ctx.drawImage(L.canvas, 0, 0);
      n.vec = L.vec; n.visible = L.visible;
      return n;
    });
    p.activeId = p.layers[pg.activeIndex].id;
    p.rebase();
    doc.pages.splice(doc.pages.indexOf(pg) + 1, 0, p);
    doc.index = doc.pages.indexOf(p);
    doc.dirty = true;
    T.app.showPage(doc.index, true);
  };
  ICO.remove = async function (pg) {
    const doc = T.doc;
    if (doc.pages.length < 2) return;
    const ok = await UI.confirm('Eliminar resolución', 'Se eliminará la resolución ' + pg.w + ' × ' + pg.h + ' con todo su contenido. Esta acción no se puede deshacer.', 'Eliminar');
    if (!ok) return;
    T.app.finishPending();
    const i = doc.pages.indexOf(pg);
    doc.pages.splice(i, 1);
    doc.index = Math.min(doc.index > i ? doc.index - 1 : doc.index, doc.pages.length - 1);
    doc.dirty = true;
    T.app.showPage(doc.index, true);
  };
  /* Sustituye el contenido de la capa activa; se puede deshacer. */
  ICO.regenerate = async function (pg, src) {
    T.app.finishPending();
    const c = await fitted(src, pg.w, pg.h);
    const L = pg.active;
    L.ctx.clearRect(0, 0, pg.w, pg.h);
    L.ctx.drawImage(c, 0, 0);
    L.setVec([V.img(0, 0, pg.w, pg.h, L.ctx.getImageData(0, 0, pg.w, pg.h))]);
    pg.commit('Regenerar');
    T.bus.emit('structure', pg);
  };
})();
