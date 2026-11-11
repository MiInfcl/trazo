'use strict';
/* Trazo · sombra vectorial.
 * Cada capa guarda, además de sus píxeles, una lista inmutable de operaciones
 * vectoriales («vec») que reproduce lo dibujado. Sirve para guardar SVG de verdad.
 * Operaciones (en orden de pintado):
 *   raw   : marcado SVG de un elemento (trazo, forma, texto, relleno)
 *   img   : imagen de mapa de bits que se suma encima
 *   svg   : SVG importado, incrustado como vector
 *   group : contenido de otra capa (al combinar capas)
 *   erase : borra una figura de todo lo anterior de la capa
 *   patch : borra un rectángulo de lo anterior y pone una imagen (comodín exacto)
 *   wrap  : recorta y/o transforma todo lo anterior (rotar, escalar, recortar...)
 * Este archivo no usa DOM: también se prueba con Node. */
(function (root) {
  const V = {};

  V.EMPTY = Object.freeze([]);

  /* Número compacto para SVG (2 decimales). */
  V.n = function (v) {
    const r = Math.round(v * 100) / 100;
    return r === 0 ? '0' : String(r);
  };

  /* ---------- Trazado de máscaras a contornos rectilíneos ----------
   * mask: Uint8Array w*h (≠0 = dentro). Devuelve el atributo d de un <path>
   * con contornos exteriores en sentido horario y agujeros antihorario. */
  V.traceMask = function (mask, w, h, ox, oy) {
    ox = ox || 0; oy = oy || 0;
    const W1 = w + 1;
    // Aristas salientes por vértice: bit0 = E, bit1 = S, bit2 = O, bit3 = N
    const edges = new Uint8Array(W1 * (h + 1));
    let any = false;
    for (let y = 0; y < h; y++) {
      const row = y * w;
      for (let x = 0; x < w; x++) {
        if (!mask[row + x]) continue;
        any = true;
        if (y === 0 || !mask[row - w + x]) edges[y * W1 + x] |= 1;
        if (x === w - 1 || !mask[row + x + 1]) edges[y * W1 + x + 1] |= 2;
        if (y === h - 1 || !mask[row + w + x]) edges[(y + 1) * W1 + x + 1] |= 4;
        if (x === 0 || !mask[row + x - 1]) edges[(y + 1) * W1 + x] |= 8;
      }
    }
    if (!any) return '';
    const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
    const parts = [];
    const total = edges.length;
    for (let vi = 0; vi < total; vi++) {
      while (edges[vi]) {
        const sx = vi % W1, sy = (vi - sx) / W1;
        let x = sx, y = sy;
        const e0 = edges[vi];
        let dir = (e0 & 1) ? 0 : (e0 & 2) ? 1 : (e0 & 4) ? 2 : 3;
        let d = 'M' + (x + ox) + ' ' + (y + oy);
        let runDir = dir, runLen = 0;
        for (;;) {
          edges[y * W1 + x] &= ~(1 << dir);
          x += DX[dir]; y += DY[dir];
          runLen++;
          if (x === sx && y === sy) break; // el último tramo lo cierra «z»
          const e = edges[y * W1 + x];
          let nd = (dir + 1) & 3; // preferir girar a la derecha (regiones 4-conexas)
          if (!(e & (1 << nd))) {
            nd = dir;
            if (!(e & (1 << nd))) {
              nd = (dir + 3) & 3;
              if (!(e & (1 << nd))) break; // no debería ocurrir
            }
          }
          if (nd !== runDir) {
            d += (runDir === 0 ? 'h' + runLen : runDir === 1 ? 'v' + runLen : runDir === 2 ? 'h-' + runLen : 'v-' + runLen);
            runDir = nd; runLen = 0;
          }
          dir = nd;
        }
        parts.push(d + 'z');
      }
    }
    return parts.join('');
  };

  /* Simplificación Ramer-Douglas-Peucker de una polilínea [{x,y}]. */
  V.rdp = function (pts, eps) {
    const n = pts.length;
    if (n < 3) return pts.slice();
    const keep = new Uint8Array(n);
    keep[0] = keep[n - 1] = 1;
    const stack = [0, n - 1];
    const e2 = eps * eps;
    while (stack.length) {
      const b = stack.pop(), a = stack.pop();
      const ax = pts[a].x, ay = pts[a].y, dx = pts[b].x - ax, dy = pts[b].y - ay;
      const len2 = dx * dx + dy * dy;
      let maxD = 0, idx = -1;
      for (let i = a + 1; i < b; i++) {
        let ex, ey;
        if (len2 === 0) { ex = pts[i].x - ax; ey = pts[i].y - ay; }
        else {
          let t = ((pts[i].x - ax) * dx + (pts[i].y - ay) * dy) / len2;
          t = t < 0 ? 0 : t > 1 ? 1 : t;
          ex = pts[i].x - (ax + t * dx); ey = pts[i].y - (ay + t * dy);
        }
        const dd = ex * ex + ey * ey;
        if (dd > maxD) { maxD = dd; idx = i; }
      }
      if (maxD > e2 && idx > 0) { keep[idx] = 1; stack.push(a, idx, idx, b); }
    }
    const out = [];
    for (let i = 0; i < n; i++) if (keep[i]) out.push(pts[i]);
    return out;
  };

  /* Polilínea a atributo d. */
  V.polyD = function (pts, close) {
    let d = '';
    for (let i = 0; i < pts.length; i++) d += (i ? 'L' : 'M') + V.n(pts[i].x) + ' ' + V.n(pts[i].y);
    if (pts.length === 1) d += 'L' + V.n(pts[0].x) + ' ' + V.n(pts[0].y);
    return d + (close ? 'Z' : '');
  };

  /* ---------- Constructores de operaciones ---------- */
  V.raw = s => ({ k: 'raw', s });
  V.img = (x, y, w, h, im, o) => ({ k: 'img', x, y, w, h, im, o: o == null ? 1 : o });
  V.svg = (x, y, w, h, src, par) => ({ k: 'svg', x, y, w, h, src, par: par || null });
  V.group = kids => ({ k: 'group', kids });
  V.erase = (d, W, H, crisp) => ({ k: 'erase', d, W, H, crisp: !!crisp });
  V.eraseRect = (x, y, w, h, W, H) => ({ k: 'erase', d: 'M' + x + ' ' + y + 'h' + w + 'v' + h + 'h-' + w + 'z', W, H, crisp: true });
  V.wrap = (tf, clip) => ({ k: 'wrap', tf: tf || null, clip: clip || null });

  /* Comodín exacto: «lo que hay en este rectángulo ahora es esta imagen».
   * Funde parches consecutivos cercanos para que la lista no crezca sin control. */
  V.autoPatch = function (vec, rect, W, H, getPixels) {
    const last = vec[vec.length - 1];
    if (last && last.k === 'patch') {
      const x = Math.min(last.x, rect.x), y = Math.min(last.y, rect.y);
      const x1 = Math.max(last.x + last.w, rect.x + rect.w), y1 = Math.max(last.y + last.h, rect.y + rect.h);
      const aU = (x1 - x) * (y1 - y), aSum = last.w * last.h + rect.w * rect.h;
      if (aU <= aSum * 1.6 + 4096) {
        const u = { x, y, w: x1 - x, h: y1 - y };
        return vec.slice(0, -1).concat([{ k: 'patch', x: u.x, y: u.y, w: u.w, h: u.h, W, H, im: getPixels(u) }]);
      }
    }
    return vec.concat([{ k: 'patch', x: rect.x, y: rect.y, w: rect.w, h: rect.h, W, H, im: getPixels(rect) }]);
  };

  /* ¿La lista es vector puro (sin mapas de bits)? */
  V.isPure = function (vec) {
    for (const op of vec) {
      if (op.k === 'img' || op.k === 'patch') return false;
      if (op.k === 'group' && !V.isPure(op.kids)) return false;
    }
    return true;
  };
  V.hasContent = function (vec) {
    for (const op of vec) {
      if (op.k === 'raw' || op.k === 'img' || op.k === 'svg' || op.k === 'patch') return true;
      if (op.k === 'group' && V.hasContent(op.kids)) return true;
    }
    return false;
  };

  /* ---------- Serialización a marcado SVG ----------
   * cx: { defs: [], uid(): string, png(im): dataURL|null, embed(op, cx): string } */
  function imageTag(op, cx) {
    const url = cx.png(op.im);
    if (!url) return '';
    return '<image x="' + op.x + '" y="' + op.y + '" width="' + op.w + '" height="' + op.h + '"' +
      (op.o != null && op.o < 1 ? ' opacity="' + V.n(op.o) + '"' : '') +
      ' preserveAspectRatio="none" xlink:href="' + url + '"/>';
  }

  V.serialize = function (vec, cx) {
    let acc = '';
    for (let i = 0; i < vec.length; i++) {
      const op = vec[i];
      switch (op.k) {
        case 'raw': acc += op.s; break;
        case 'img': acc += imageTag(op, cx); break;
        case 'svg': acc += cx.embed(op, cx); break;
        case 'group': {
          const inner = V.serialize(op.kids, cx);
          if (inner) acc += '<g>' + inner + '</g>';
          break;
        }
        case 'erase': {
          let shapes = '', W = op.W, H = op.H, j = i;
          for (; j < vec.length && vec[j].k === 'erase'; j++) {
            shapes += '<path fill-rule="evenodd"' + (vec[j].crisp ? ' shape-rendering="crispEdges"' : '') + ' d="' + vec[j].d + '"/>';
            if (vec[j].W > W) W = vec[j].W;
            if (vec[j].H > H) H = vec[j].H;
          }
          i = j - 1;
          if (acc) {
            const id = cx.uid();
            cx.defs.push('<mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="' + W + '" height="' + H + '">' +
              '<rect width="' + W + '" height="' + H + '" fill="#fff"/><g fill="#000">' + shapes + '</g></mask>');
            acc = '<g mask="url(#' + id + ')">' + acc + '</g>';
          }
          break;
        }
        case 'patch': {
          if (acc) {
            const id = cx.uid();
            cx.defs.push('<mask id="' + id + '" maskUnits="userSpaceOnUse" x="0" y="0" width="' + op.W + '" height="' + op.H + '">' +
              '<rect width="' + op.W + '" height="' + op.H + '" fill="#fff"/>' +
              '<rect x="' + op.x + '" y="' + op.y + '" width="' + op.w + '" height="' + op.h + '" fill="#000" shape-rendering="crispEdges"/></mask>');
            acc = '<g mask="url(#' + id + ')">' + acc + '</g>';
          }
          acc += imageTag(op, cx);
          break;
        }
        case 'wrap': {
          if (acc) {
            if (op.clip) {
              const id = cx.uid(), c = op.clip;
              cx.defs.push('<clipPath id="' + id + '"><rect x="' + c.x + '" y="' + c.y + '" width="' + c.w + '" height="' + c.h + '"/></clipPath>');
              acc = '<g clip-path="url(#' + id + ')">' + acc + '</g>';
            }
            if (op.tf) acc = '<g transform="' + op.tf + '">' + acc + '</g>';
          }
          break;
        }
        default: break;
      }
    }
    return acc;
  };

  /* Matriz SVG compacta. */
  V.matrix = (a, b, c, d, e, f) => 'matrix(' + [a, b, c, d, e, f].map(v => String(Math.round(v * 1e6) / 1e6)).join(' ') + ')';

  if (typeof module !== 'undefined' && module.exports) module.exports = V;
  else { root.T = root.T || {}; root.T.vec = V; }
})(typeof window !== 'undefined' ? window : globalThis);
