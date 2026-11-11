'use strict';
/* Trazo · lectura y escritura de SVG. Los SVG se limpian al abrirlos (sin scripts ni referencias
 * externas), se muestran rasterizados en el lienzo y se conservan como vector al guardar. */
(function () {
  const T = window.T, U = T.util, V = T.vec;
  const IO = T.svg = {};
  const NS = 'http://www.w3.org/2000/svg', XL = 'http://www.w3.org/1999/xlink';

  /* Convierte una longitud SVG a píxeles (null si es relativa o no se entiende). */
  function len(s) {
    if (s == null) return null;
    const m = /^\s*([+-]?[\d.]+(?:e[+-]?\d+)?)\s*(px|pt|pc|mm|cm|in|em|ex)?\s*$/i.exec(s);
    if (!m) return null;
    const v = parseFloat(m[1]);
    const u = { px: 1, pt: 96 / 72, pc: 16, mm: 96 / 25.4, cm: 96 / 2.54, in: 96, em: 16, ex: 8 }[(m[2] || 'px').toLowerCase()];
    return v * u;
  }

  const isSafeUrl = v => {
    v = v.trim();
    if (v.startsWith('#')) return true;
    return /^data:image\/(png|jpe?g|gif|webp|bmp|svg\+xml)[;,]/i.test(v);
  };

  /* Quita lo que no debe ejecutarse ni salir a internet. */
  function clean(root) {
    root.querySelectorAll('script, foreignObject, iframe, object, embed, audio, video, canvas, handler, listener').forEach(n => n.remove());
    const all = [root].concat(Array.from(root.querySelectorAll('*')));
    for (const e of all) {
      for (const a of Array.from(e.attributes)) {
        const nm = a.name.toLowerCase();
        if (nm.startsWith('on')) { e.removeAttribute(a.name); continue; }
        if (nm === 'href' || nm === 'xlink:href' || nm === 'src') {
          if (!isSafeUrl(a.value)) e.removeAttribute(a.name);
          continue;
        }
        if (/url\(\s*['"]?(?!#|data:image)/i.test(a.value)) e.removeAttribute(a.name);
      }
      if (e.localName === 'style') e.textContent = e.textContent.replace(/@import[^;]*;?/gi, '').replace(/url\(\s*['"]?(?!#|data:image)[^)]*\)/gi, 'none');
    }
    root.querySelectorAll('a').forEach(a => { a.removeAttribute('href'); a.removeAttribute('xlink:href'); });
  }

  /* Analiza texto SVG → { src, w, h } (src ya limpio, con ancho, alto y viewBox explícitos). */
  IO.parse = function (text) {
    const doc = new DOMParser().parseFromString(text.replace(/^﻿/, ''), 'image/svg+xml');
    const err = doc.querySelector('parsererror');
    const root = doc.documentElement;
    if (err || !root || root.localName !== 'svg') throw new Error('El archivo no es un SVG válido.');
    clean(root);
    let w = len(root.getAttribute('width')), h = len(root.getAttribute('height'));
    const vb = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number);
    const hasVb = vb.length === 4 && vb.every(isFinite) && vb[2] > 0 && vb[3] > 0;
    if (!w && !h) { if (hasVb) { w = vb[2]; h = vb[3]; } else { w = 300; h = 150; } }
    else if (!w) w = hasVb ? h * vb[2] / vb[3] : h;
    else if (!h) h = hasVb ? w * vb[3] / vb[2] : w;
    if (!hasVb) root.setAttribute('viewBox', '0 0 ' + V.n(w) + ' ' + V.n(h));
    w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
    root.setAttribute('width', w); root.setAttribute('height', h);
    if (!root.getAttribute('xmlns')) root.setAttribute('xmlns', NS);
    return { src: new XMLSerializer().serializeToString(root), w, h };
  };

  /* Dibuja un SVG (texto) a un lienzo del tamaño pedido. */
  IO.rasterize = async function (src, w, h) {
    const sized = src.replace(/<svg\b[^>]*>/i, tag => {
      let t = tag.replace(/\s(width|height)\s*=\s*("[^"]*"|'[^']*')/gi, '');
      if (!/preserveAspectRatio/i.test(t)) t = t.replace(/>$/, ' preserveAspectRatio="none">').replace('/ preserve', ' preserve');
      return t.replace(/^<svg/i, '<svg width="' + w + '" height="' + h + '"');
    });
    const url = 'data:image/svg+xml;base64,' + U.bytesToBase64(U.textToBytes(sized));
    const im = await U.loadImage(url);
    const c = U.canvas(w, h);
    c.ctx.drawImage(im, 0, 0, w, h);
    return c;
  };

  /* Antepone un prefijo a todos los id para que no choquen dentro de un documento combinado. */
  function namespaceIds(src, p) {
    return src
      .replace(/\bid\s*=\s*"([^"]+)"/g, (m, v) => 'id="' + p + v + '"')
      .replace(/\bid\s*=\s*'([^']+)'/g, (m, v) => "id='" + p + v + "'")
      .replace(/url\(\s*(['"]?)#([^)'"]+)\1\s*\)/g, (m, q, v) => 'url(#' + p + v + ')')
      .replace(/((?:xlink:)?href)\s*=\s*"#([^"]+)"/g, (m, a, v) => a + '="#' + p + v + '"')
      .replace(/((?:xlink:)?href)\s*=\s*'#([^']+)'/g, (m, a, v) => a + "='#" + p + v + "'")
      .replace(/(begin\s*=\s*")([\w-]+)\./g, (m, a, v) => a + p + v + '.');
  }

  function imageDataUrl(im) { return U.imageDataToCanvas(im).toDataURL('image/png'); }

  function makeContext() {
    let n = 0, ne = 0;
    const cx = {
      defs: [],
      uid: () => 't' + (++n),
      png: im => imageDataUrl(im),
      embed(op) {
        const pfx = 'e' + (++ne) + '-';
        if (/<style[\s>]/i.test(op.src)) {
          // Las hojas de estilo afectan a todo el documento: queda aislado como imagen vectorial.
          return '<image x="' + V.n(op.x) + '" y="' + V.n(op.y) + '" width="' + V.n(op.w) + '" height="' + V.n(op.h) +
            '" preserveAspectRatio="none" xlink:href="data:image/svg+xml;base64,' + U.bytesToBase64(U.textToBytes(op.src)) + '"/>';
        }
        const inner = namespaceIds(op.src, pfx).replace(/<\?xml[^>]*\?>/i, '');
        return inner.replace(/<svg\b([^>]*)>/i, (m, attrs) => {
          const clean = attrs.replace(/\s(x|y|width|height|preserveAspectRatio)\s*=\s*("[^"]*"|'[^']*')/gi, '');
          return '<svg' + clean + ' x="' + V.n(op.x) + '" y="' + V.n(op.y) + '" width="' + V.n(op.w) + '" height="' + V.n(op.h) + '" preserveAspectRatio="none">';
        });
      }
    };
    return cx;
  }

  function wrapDoc(w, h, defs, body) {
    return '<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="' + NS + '" xmlns:xlink="' + XL + '" width="' + w + '" height="' + h +
      '" viewBox="0 0 ' + w + ' ' + h + '">\n' + (defs.length ? '<defs>' + defs.join('') + '</defs>\n' : '') + body + '\n</svg>\n';
  }

  /* Si la página es exactamente un SVG abierto sin tocar, devuelve el original. */
  function untouched(page) {
    if (page.bg.visible || page.layers.length !== 1) return null;
    const v = page.layers[0].vec;
    if (v.length === 1 && v[0].k === 'svg' && v[0].x === 0 && v[0].y === 0 && v[0].w === page.w && v[0].h === page.h) return v[0].src;
    return null;
  }

  /* Modo «vector»: una capa → un grupo con lo que se haya dibujado. */
  IO.exportVector = function (page) {
    const same = untouched(page);
    if (same) return same.startsWith('<?xml') ? same : '<?xml version="1.0" encoding="UTF-8"?>\n' + same + '\n';
    const cx = makeContext();
    let body = '';
    if (page.bg.visible) body += '<rect id="fondo" width="' + page.w + '" height="' + page.h + '" fill="' + page.bg.color + '"/>\n';
    page.layers.forEach((L, i) => {
      if (!L.visible) return;
      const inner = V.serialize(L.vec, cx);
      if (inner) body += '<g id="capa-' + (i + 1) + '" data-name="' + U.escXml(L.name) + '">' + inner + '</g>\n';
    });
    return wrapDoc(page.w, page.h, cx.defs, body);
  };

  /* Modo «píxeles»: cada color se convierte en una ruta. Ideal para iconos y pixel art. */
  IO.exportPixels = function (page, maxColors) {
    const w = page.w, h = page.h;
    const data = page.composite().ctx.getImageData(0, 0, w, h).data;
    const groups = new Map();
    for (let i = 0; i < w * h; i++) {
      const o = i * 4, a = data[o + 3];
      if (!a) continue;
      const key = (data[o] * 16777216 + (data[o + 1] << 16) + (data[o + 2] << 8) + a);
      let g = groups.get(key);
      if (!g) {
        if (groups.size >= (maxColors || 4096)) return null;
        g = { list: [], x0: w, y0: h, x1: 0, y1: 0 };
        groups.set(key, g);
      }
      g.list.push(i);
      const x = i % w, y = (i - x) / w;
      if (x < g.x0) g.x0 = x; if (x > g.x1) g.x1 = x;
      if (y < g.y0) g.y0 = y; if (y > g.y1) g.y1 = y;
    }
    let body = '<g shape-rendering="crispEdges">';
    for (const [key, g] of groups) {
      const a = key % 256, rgb = (key - a) / 256;
      // máscara solo del rectángulo que ocupa el color: con muchos colores evita recorrer toda la imagen
      const bw = g.x1 - g.x0 + 1, bh = g.y1 - g.y0 + 1, mask = new Uint8Array(bw * bh);
      for (const i of g.list) { const x = i % w, y = (i - x) / w; mask[(y - g.y0) * bw + x - g.x0] = 1; }
      body += '<path fill="#' + ('00000' + rgb.toString(16)).slice(-6) + '"' + (a < 255 ? ' fill-opacity="' + V.n(a / 255) + '"' : '') + ' d="' + V.traceMask(mask, bw, bh, g.x0, g.y0) + '"/>';
    }
    return wrapDoc(w, h, [], body + '</g>');
  };

  /* Modo «imagen»: un único PNG dentro del SVG. */
  IO.exportImage = function (page) {
    const url = page.composite().toDataURL('image/png');
    return wrapDoc(page.w, page.h, [], '<image width="' + page.w + '" height="' + page.h + '" xlink:href="' + url + '"/>');
  };

  /* Qué contiene la página: para explicar al guardar. */
  IO.describe = function (page) {
    let pure = true, any = false;
    for (const L of page.layers) { if (!L.visible) continue; if (V.hasContent(L.vec)) any = true; if (!V.isPure(L.vec)) pure = false; }
    return { pure, any };
  };

  /* Rasteriza solo lo vectorial de una capa a otro tamaño (para reescalar sin perder nitidez). */
  IO.renderLayer = async function (page, layer, nw, nh) {
    const cx = makeContext();
    const inner = V.serialize(layer.vec, cx);
    let src = wrapDoc(page.w, page.h, cx.defs, inner);
    src = src.replace(/^<\?xml[^>]*\?>\s*/, '');
    return IO.rasterize(src, nw, nh);
  };
  /* Rasteriza toda la página a otro tamaño (para generar resoluciones de icono nítidas). */
  IO.renderPage = async function (page, nw, nh) {
    const src = IO.exportVector(page).replace(/^<\?xml[^>]*\?>\s*/, '');
    return IO.rasterize(src, nw, nh);
  };
})();
