'use strict';
/* Trazo · geometría y dibujo de las formas. La misma ruta («d») sirve para el lienzo y para el SVG. */
(function () {
  const T = window.T, U = T.util, V = T.vec;
  const n = V.n;
  const S = T.shapes = {};
  const K = 0.5523; // constante para aproximar cuartos de círculo con curvas cúbicas

  S.LIST = [
    { id: 'line', name: 'Línea' }, { id: 'curve', name: 'Curva' }, { id: 'oval', name: 'Óvalo' },
    { id: 'rect', name: 'Rectángulo' }, { id: 'roundrect', name: 'Rectángulo redondeado' }, { id: 'polygon', name: 'Polígono' },
    { id: 'triangle', name: 'Triángulo' }, { id: 'rtriangle', name: 'Triángulo rectángulo' }, { id: 'diamond', name: 'Rombo' },
    { id: 'pentagon', name: 'Pentágono' }, { id: 'hexagon', name: 'Hexágono' }, { id: 'arrowR', name: 'Flecha a la derecha' },
    { id: 'arrowL', name: 'Flecha a la izquierda' }, { id: 'arrowU', name: 'Flecha arriba' }, { id: 'arrowD', name: 'Flecha abajo' },
    { id: 'star4', name: 'Estrella de cuatro puntas' }, { id: 'star5', name: 'Estrella de cinco puntas' }, { id: 'star6', name: 'Estrella de seis puntas' },
    { id: 'calloutRound', name: 'Llamada rectangular redondeada' }, { id: 'calloutOval', name: 'Llamada ovalada' }, { id: 'calloutCloud', name: 'Llamada de nube' },
    { id: 'heart', name: 'Corazón' }, { id: 'lightning', name: 'Rayo' }
  ];
  S.STYLES = [
    { id: 'solid', name: 'Color sólido' }, { id: 'crayon', name: 'Crayón' }, { id: 'marker', name: 'Marcador' },
    { id: 'oil', name: 'Óleo' }, { id: 'natPencil', name: 'Lápiz natural' }, { id: 'watercolor', name: 'Acuarela' }
  ];

  function star(points, inner, rot) {
    const out = [];
    for (let i = 0; i < points * 2; i++) {
      const r = i % 2 ? inner : 1, a = rot + i * Math.PI / points;
      out.push([Math.cos(a) * r, Math.sin(a) * r]);
    }
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const p of out) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    return out.map(p => [(p[0] - x0) / (x1 - x0), (p[1] - y0) / (y1 - y0)]);
  }
  const POLY = {
    triangle: [[.5, 0], [1, 1], [0, 1]],
    rtriangle: [[0, 0], [1, 1], [0, 1]],
    diamond: [[.5, 0], [1, .5], [.5, 1], [0, .5]],
    pentagon: [[.5, 0], [1, .382], [.809, 1], [.191, 1], [0, .382]],
    hexagon: [[.5, 0], [1, .25], [1, .75], [.5, 1], [0, .75], [0, .25]],
    arrowR: [[0, .25], [.5, .25], [.5, 0], [1, .5], [.5, 1], [.5, .75], [0, .75]],
    arrowL: [[1, .25], [.5, .25], [.5, 0], [0, .5], [.5, 1], [.5, .75], [1, .75]],
    arrowU: [[.25, 1], [.25, .5], [0, .5], [.5, 0], [1, .5], [.75, .5], [.75, 1]],
    arrowD: [[.25, 0], [.25, .5], [0, .5], [.5, 1], [1, .5], [.75, .5], [.75, 0]],
    star4: [[.5, 0], [.625, .375], [1, .5], [.625, .625], [.5, 1], [.375, .625], [0, .5], [.375, .375]],
    star5: star(5, 0.382, -Math.PI / 2),
    star6: star(6, 0.577, -Math.PI / 2),
    lightning: [[.42, 0], [.66, .3], [.52, .34], [.82, .6], [.68, .64], [1, 1], [.46, .72], [.58, .67], [.2, .47], [.36, .4], [0, .16]]
  };

  /* Arco de elipse como curvas cúbicas (radianes; a1 < a0 recorre en sentido contrario). */
  function arc(c, cx, cy, rx, ry, a0, a1) {
    const total = a1 - a0;
    const segs = Math.max(1, Math.ceil(Math.abs(total) / (Math.PI / 2) - 1e-9));
    const da = total / segs, k = 4 / 3 * Math.tan(da / 4);
    let a = a0;
    for (let i = 0; i < segs; i++) {
      const b = a + da;
      const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
      c.push(['C', cx + rx * (ca - k * sa), cy + ry * (sa + k * ca), cx + rx * (cb + k * sb), cy + ry * (sb - k * cb), cx + rx * cb, cy + ry * sb]);
      a = b;
    }
  }
  /* Esquina redondeada: del punto actual (px, py) al punto (ex, ey) pasando junto al vértice (vx, vy). */
  function corner(c, px, py, vx, vy, ex, ey) {
    c.push(['C', px + K * (vx - px), py + K * (vy - py), ex + K * (vx - ex), ey + K * (vy - ey), ex, ey]);
  }
  function roundedBox(c, x0, y0, x1, y1, ru, rv, tail) {
    c.push(['M', x0 + ru, y0], ['L', x1 - ru, y0]);
    corner(c, x1 - ru, y0, x1, y0, x1, y0 + rv);
    c.push(['L', x1, y1 - rv]);
    corner(c, x1, y1 - rv, x1, y1, x1 - ru, y1);
    if (tail) for (const p of tail) c.push(['L', p[0], p[1]]);
    c.push(['L', x0 + ru, y1]);
    corner(c, x0 + ru, y1, x0, y1, x0, y1 - rv);
    c.push(['L', x0, y0 + rv]);
    corner(c, x0, y0 + rv, x0, y0, x0 + ru, y0);
    c.push(['Z']);
  }

  /* Forma en el cuadrado unidad (0..1). w y h reales sirven para que las esquinas queden redondas. */
  function unit(k, w, h) {
    const c = [];
    if (POLY[k]) {
      POLY[k].forEach((p, i) => c.push([i ? 'L' : 'M', p[0], p[1]]));
      c.push(['Z']);
      return { c, round: false };
    }
    switch (k) {
      case 'rect':
        c.push(['M', 0, 0], ['L', 1, 0], ['L', 1, 1], ['L', 0, 1], ['Z']);
        return { c, round: false };
      case 'oval':
        c.push(['M', 1, .5]);
        arc(c, .5, .5, .5, .5, 0, Math.PI * 2);
        c.push(['Z']);
        return { c, round: true };
      case 'roundrect': {
        const r = Math.min(w, h) * 0.2;
        roundedBox(c, 0, 0, 1, 1, r / w, r / h, null);
        return { c, round: true };
      }
      case 'calloutRound': {
        const bv = 0.75, r = Math.min(w, h * bv) * 0.2;
        roundedBox(c, 0, 0, 1, bv, Math.min(0.2, r / w), Math.min(bv / 2, r / h), [[.4, bv], [.14, 1], [.2, bv]]);
        return { c, round: true };
      }
      case 'calloutOval': {
        const t1 = 105 * Math.PI / 180, t2 = 140 * Math.PI / 180;
        c.push(['M', .5 + .5 * Math.cos(t1), .4 + .4 * Math.sin(t1)]);
        arc(c, .5, .4, .5, .4, t1, t2 - Math.PI * 2); // por el camino largo
        c.push(['L', .16, 1], ['Z']);
        return { c, round: true };
      }
      case 'calloutCloud': {
        const N = 9, cx = .5, cy = .37, rx = .43, ry = .29;
        for (let i = 0; i <= N; i++) {
          const a = i * 2 * Math.PI / N - Math.PI / 2;
          const qx = cx + rx * Math.cos(a), qy = cy + ry * Math.sin(a);
          if (i === 0) c.push(['M', qx, qy]);
          else {
            const am = a - Math.PI / N;
            c.push(['Q', cx + rx * 1.42 * Math.cos(am), cy + ry * 1.5 * Math.sin(am), qx, qy]);
          }
        }
        c.push(['Z']);
        const bubble = (u, v, ru, rv) => { c.push(['M', u + ru, v]); arc(c, u, v, ru, rv, 0, Math.PI * 2); c.push(['Z']); };
        bubble(.25, .8, .075, .055);
        bubble(.11, .93, .045, .035);
        return { c, round: true };
      }
      case 'heart':
        c.push(['M', .5, .25], ['C', .5, .1, .4, 0, .26, 0], ['C', .1, 0, 0, .13, 0, .3], ['C', 0, .55, .25, .75, .5, 1],
          ['C', .75, .75, 1, .55, 1, .3], ['C', 1, .13, .9, 0, .74, 0], ['C', .6, 0, .5, .1, .5, .25], ['Z']);
        return { c, round: true };
      default:
        return { c, round: false };
    }
  }

  /* Comandos de ruta de una forma. Las de caja usan (x0, y0)-(x1, y1) y se voltean según el arrastre. */
  S.commands = function (sh, inset) {
    inset = inset || 0;
    const k = sh.kind;
    if (k === 'line') return { cmds: [['M', sh.pts[0].x, sh.pts[0].y], ['L', sh.pts[1].x, sh.pts[1].y]], closed: false, round: true };
    if (k === 'curve') {
      const p = sh.pts, c1 = p[2] || null, c2 = p[3] || c1;
      if (!c1) return { cmds: [['M', p[0].x, p[0].y], ['L', p[1].x, p[1].y]], closed: false, round: true };
      return { cmds: [['M', p[0].x, p[0].y], ['C', c1.x, c1.y, c2.x, c2.y, p[1].x, p[1].y]], closed: false, round: true };
    }
    if (k === 'polygon') {
      const cmds = sh.pts.map((p, i) => [i ? 'L' : 'M', p.x, p.y]);
      if (sh.closed) cmds.push(['Z']);
      return { cmds, closed: !!sh.closed, round: !sh.closed };
    }
    let x = Math.min(sh.x0, sh.x1) + inset, y = Math.min(sh.y0, sh.y1) + inset;
    let w = Math.abs(sh.x1 - sh.x0) - 2 * inset, h = Math.abs(sh.y1 - sh.y0) - 2 * inset;
    if (w < 0.01) { x += w / 2; w = 0.01; }
    if (h < 0.01) { y += h / 2; h = 0.01; }
    const fx = sh.x1 < sh.x0, fy = sh.y1 < sh.y0;
    const g = unit(k, w, h);
    const cmds = g.c.map(c => {
      const o = [c[0]];
      for (let i = 1; i < c.length; i += 2) {
        o.push(x + (fx ? 1 - c[i] : c[i]) * w, y + (fy ? 1 - c[i + 1] : c[i + 1]) * h);
      }
      return o;
    });
    return { cmds, closed: true, round: g.round };
  };

  S.toD = function (cmds) {
    let d = '';
    for (const c of cmds) {
      d += c[0];
      for (let i = 1; i < c.length; i++) d += (i > 1 ? ' ' : '') + n(c[i]);
    }
    return d;
  };

  /* Aplana la ruta a polilíneas (para pinceles con textura y para medir). */
  S.flatten = function (cmds) {
    const polys = [];
    let cur = null, sx = 0, sy = 0, px = 0, py = 0;
    for (const c of cmds) {
      if (c[0] === 'M') { cur = [{ x: c[1], y: c[2] }]; polys.push(cur); sx = px = c[1]; sy = py = c[2]; }
      else if (c[0] === 'L') { cur.push({ x: c[1], y: c[2] }); px = c[1]; py = c[2]; }
      else if (c[0] === 'Q') {
        const N = 16;
        for (let i = 1; i <= N; i++) { const t = i / N, m = 1 - t; cur.push({ x: m * m * px + 2 * m * t * c[1] + t * t * c[3], y: m * m * py + 2 * m * t * c[2] + t * t * c[4] }); }
        px = c[3]; py = c[4];
      } else if (c[0] === 'C') {
        const N = 24;
        for (let i = 1; i <= N; i++) {
          const t = i / N, m = 1 - t;
          cur.push({ x: m * m * m * px + 3 * m * m * t * c[1] + 3 * m * t * t * c[3] + t * t * t * c[5], y: m * m * m * py + 3 * m * m * t * c[2] + 3 * m * t * t * c[4] + t * t * t * c[6] });
        }
        px = c[5]; py = c[6];
      } else if (c[0] === 'Z') { cur.push({ x: sx, y: sy }); px = sx; py = sy; }
    }
    return polys;
  };

  /* Caja que encierra la forma (con holgura para el grosor del contorno). */
  S.bounds = function (sh, size) {
    const polys = S.flatten(S.commands(sh, 0).cmds);
    const b = new U.BBox();
    for (const poly of polys) for (const p of poly) b.add(p.x, p.y);
    const pad = (size || 0) * 1.5 + 3;
    return { x: b.x0 - pad, y: b.y0 - pad, w: b.x1 - b.x0 + 2 * pad, h: b.y1 - b.y0 + 2 * pad };
  };
  /* Caja ajustada (sin holgura), para los tiradores. */
  S.tightBox = function (sh) {
    const polys = S.flatten(S.commands(sh, 0).cmds);
    const b = new U.BBox();
    for (const poly of polys) for (const p of poly) b.add(p.x, p.y);
    return { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
  };

  /* Dibuja la forma en ctx. st: { outline, fill, colorOutline, colorFill, size }.
   * Devuelve el marcado SVG equivalente, o null si usa texturas (entonces se guarda como imagen). */
  S.render = function (ctx, sh, st, pageW, pageH) {
    const open = sh.kind === 'line' || sh.kind === 'curve' || (sh.kind === 'polygon' && !sh.closed);
    const hasOutline = st.outline !== 'none' || open;
    const outlineKind = st.outline === 'none' ? 'solid' : st.outline;
    const inset = hasOutline && !open && sh.kind !== 'polygon' ? st.size / 2 : 0;
    const g = S.commands(sh, inset);
    const d = S.toD(g.cmds);
    const path = new Path2D(d);
    const hasFill = st.fill !== 'none' && g.closed;
    let vector = true;
    ctx.save();
    if (hasFill) {
      if (st.fill === 'solid') { ctx.fillStyle = st.colorFill; ctx.fill(path); }
      else { vector = false; T.brushes.fillTexture(ctx, path, S.bounds(sh, st.size), st.fill, st.colorFill, pageW, pageH); }
    }
    if (hasOutline) {
      if (outlineKind === 'solid') {
        ctx.strokeStyle = st.colorOutline; ctx.lineWidth = st.size;
        ctx.lineJoin = g.round ? 'round' : 'miter'; ctx.lineCap = open ? 'round' : 'butt'; ctx.miterLimit = 10;
        ctx.stroke(path);
      } else {
        vector = false;
        T.brushes.strokePolys(ctx, S.flatten(g.cmds), outlineKind, st.colorOutline, st.size, pageW, pageH);
      }
    }
    ctx.restore();
    if (!vector) return null;
    const style = 'fill:' + (hasFill ? st.colorFill : 'none') + ';' + (hasOutline
      ? 'stroke:' + st.colorOutline + ';stroke-width:' + n(st.size) + ';stroke-linejoin:' + (g.round ? 'round' : 'miter') + ';stroke-linecap:' + (open ? 'round' : 'butt') + ';stroke-miterlimit:10'
      : 'stroke:none');
    if (sh.kind === 'line') {
      return '<line x1="' + n(sh.pts[0].x) + '" y1="' + n(sh.pts[0].y) + '" x2="' + n(sh.pts[1].x) + '" y2="' + n(sh.pts[1].y) + '" style="' + style + '"/>';
    }
    return '<path d="' + d + '" style="' + style + '"/>';
  };

  /* Icono de la galería, generado con la misma geometría. */
  S.icon = function (kind, size) {
    let sh;
    if (kind === 'line') sh = { kind, pts: [{ x: 3.5, y: 16.5 }, { x: 16.5, y: 3.5 }] };
    else if (kind === 'curve') sh = { kind, pts: [{ x: 3, y: 15 }, { x: 17, y: 5 }, { x: 5, y: 2 }, { x: 15, y: 18 }] };
    else if (kind === 'polygon') sh = { kind, closed: true, pts: [{ x: 4, y: 4 }, { x: 13, y: 3 }, { x: 17, y: 10 }, { x: 11, y: 17 }, { x: 3, y: 13 }] };
    else {
      const flat = kind === 'oval' || kind === 'rect' || kind === 'roundrect' || kind === 'arrowR' || kind === 'arrowL' || kind.indexOf('callout') === 0;
      const tall = kind === 'arrowU' || kind === 'arrowD' || kind === 'lightning';
      sh = flat ? { kind, x0: 2.5, y0: 4.5, x1: 17.5, y1: 15.5 } : tall ? { kind, x0: 4.5, y0: 2.5, x1: 15.5, y1: 17.5 } : { kind, x0: 3, y0: 3, x1: 17, y1: 17 };
    }
    const d = S.toD(S.commands(sh, 0).cmds);
    const s = size || 20;
    return '<svg class="ic" viewBox="0 0 20 20" width="' + s + '" height="' + s + '" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="' + d + '"/></svg>';
  };
})();
