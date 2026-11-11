'use strict';
/* Trazo · herramienta de texto: cuadro editable sobre el lienzo y barra de formato. */
(function () {
  const T = window.T, U = T.util, V = T.vec;
  const X = T.text = { editing: null };
  const view = () => T.view;
  const page = () => T.view.page;
  const ts = () => T.state.text;

  X.FONTS = ['Segoe UI', 'Arial', 'Bahnschrift', 'Calibri', 'Cambria', 'Candara', 'Comic Sans MS', 'Consolas', 'Constantia', 'Corbel', 'Courier New', 'Georgia', 'Impact', 'Lucida Console', 'Palatino Linotype', 'Tahoma', 'Times New Roman', 'Trebuchet MS', 'Verdana'];
  X.SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 72, 96];

  const fontPx = () => ts().size * 96 / 72;
  const lineH = () => Math.round(fontPx() * 1.25);
  function fontCss(px) {
    const s = ts();
    return (s.italic ? 'italic ' : '') + (s.bold ? 'bold ' : '') + px + 'px "' + s.font + '", sans-serif';
  }

  function styleEditor() {
    const e = X.editing;
    if (!e) return;
    const v = view(), s = ts(), z = v.sx, b = e.box;
    Object.assign(e.el.style, {
      left: b.x * z + 'px', top: b.y * z + 'px', width: b.w * z + 'px', minHeight: b.h * v.sy + 'px',
      font: fontCss(fontPx() * z), lineHeight: lineH() * z + 'px',
      color: T.state.color1, background: s.bg ? T.state.color2 : 'transparent',
      textAlign: s.align,
      textDecoration: [s.underline ? 'underline' : '', s.strike ? 'line-through' : ''].join(' ').trim() || 'none'
    });
    v.setOverlay('');
    v.setHandles(T.boxHandles(b));
  }
  X.restyle = styleEditor;
  T.bus.on('view', styleEditor);
  T.bus.on('color', styleEditor);

  function grow() {
    const e = X.editing;
    if (!e) return;
    const needed = Math.ceil(e.el.scrollHeight / view().sy);
    if (needed > e.box.h) { e.box.h = needed; styleEditor(); }
  }

  X.begin = function (box) {
    const v = view();
    const el = U.el('div.text-editor', { spellcheck: false });
    el.setAttribute('contenteditable', 'plaintext-only');
    v.wrap.appendChild(el);
    X.editing = { el, box };
    el.addEventListener('input', grow);
    el.addEventListener('keydown', ev => {
      ev.stopPropagation();
      if (ev.key === 'Escape') { ev.preventDefault(); X.cancel(); return; }
      if ((ev.ctrlKey || ev.metaKey) && !ev.altKey) {
        const k = ev.key.toLowerCase();
        const flag = k === 'b' || k === 'n' ? 'bold' : k === 'i' ? 'italic' : k === 'u' ? 'underline' : null;
        if (flag) { ev.preventDefault(); ts()[flag] = !ts()[flag]; styleEditor(); T.bus.emit('textopts'); }
      }
    });
    el.addEventListener('pointerdown', ev => ev.stopPropagation());
    styleEditor();
    el.focus();
    T.bus.emit('textopts');
  };

  function getText() {
    const e = X.editing;
    return e ? e.el.innerText.replace(/ /g, ' ').replace(/\n$/, '') : '';
  }

  function wrap(ctx, text, maxW) {
    const out = [];
    for (const para of text.split('\n')) {
      if (!para) { out.push(''); continue; }
      const parts = para.match(/\S+\s*|\s+/g) || [''];
      let line = '';
      for (const part of parts) {
        if (ctx.measureText((line + part).trimEnd()).width <= maxW) { line += part; continue; }
        if (line) { out.push(line.trimEnd()); line = ''; }
        let rest = part;
        while (ctx.measureText(rest.trimEnd()).width > maxW && rest.length > 1) {
          let i = rest.length - 1;
          while (i > 1 && ctx.measureText(rest.slice(0, i)).width > maxW) i--;
          out.push(rest.slice(0, i));
          rest = rest.slice(i);
        }
        line = rest;
      }
      out.push(line.trimEnd());
    }
    return out;
  }

  /* Pinta el texto en la capa y devuelve su SVG. */
  function render(ctx, text, b) {
    const s = ts(), px = fontPx(), lh = lineH(), color = T.state.color1, bgc = T.state.color2;
    ctx.save();
    ctx.font = fontCss(px);
    ctx.textBaseline = 'alphabetic';
    const lines = wrap(ctx, text, b.w);
    const m = ctx.measureText('Hg');
    const asc = m.fontBoundingBoxAscent, desc = m.fontBoundingBoxDescent;
    const offset = (lh - (asc + desc)) / 2 + asc;
    let svg = '';
    if (s.bg) {
      ctx.fillStyle = bgc;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      svg += '<rect x="' + b.x + '" y="' + b.y + '" width="' + b.w + '" height="' + b.h + '" fill="' + bgc + '"/>';
    }
    ctx.fillStyle = color;
    const anchor = s.align === 'center' ? 'middle' : s.align === 'right' ? 'end' : 'start';
    ctx.textAlign = s.align === 'center' ? 'center' : s.align === 'right' ? 'right' : 'left';
    const tx = s.align === 'center' ? b.x + b.w / 2 : s.align === 'right' ? b.x + b.w : b.x;
    const deco = [s.underline ? 'underline' : '', s.strike ? 'line-through' : ''].join(' ').trim();
    let tspans = '';
    lines.forEach((ln, i) => {
      const y = b.y + i * lh + offset;
      ctx.fillText(ln, tx, y);
      const w = ctx.measureText(ln).width;
      const lx = s.align === 'center' ? tx - w / 2 : s.align === 'right' ? tx - w : tx;
      const th = Math.max(1, Math.round(px / 16));
      if (s.underline) ctx.fillRect(lx, y + Math.round(px * 0.11), w, th);
      if (s.strike) ctx.fillRect(lx, y - Math.round(px * 0.28), w, th);
      if (ln) tspans += '<tspan x="' + V.n(tx) + '" y="' + V.n(y) + '">' + U.escXml(ln) + '</tspan>';
    });
    ctx.restore();
    if (tspans) {
      svg += '<text xml:space="preserve" text-anchor="' + anchor + '" style="font-family:\'' + U.escXml(s.font) + '\',sans-serif;font-size:' + V.n(px) + 'px;fill:' + color +
        (s.bold ? ';font-weight:bold' : '') + (s.italic ? ';font-style:italic' : '') + (deco ? ';text-decoration:' + deco : '') + '">' + tspans + '</text>';
    }
    return svg;
  }

  function stop() {
    const e = X.editing;
    if (!e) return;
    e.el.remove();
    X.editing = null;
    const v = view();
    v.setOverlay(''); v.setHandles(null);
    T.bus.emit('textopts');
  }

  X.commit = function () {
    const e = X.editing;
    if (!e) return;
    const text = getText(), box = e.box;
    stop();
    if (!text.trim()) return;
    const pg = page(), L = pg.active;
    const mk = render(L.ctx, text, box);
    L.pushVec(V.raw(mk));
    pg.commit('Texto');
  };
  X.cancel = function () { stop(); view().ws.focus({ preventScroll: true }); };

  X.tool = {
    cursor: 'text',
    down(p, ev) {
      if (ev.button !== 0) return;
      const e = X.editing, v = view();
      if (e) {
        const h = T.hitBox(e.box, p, v.sx);
        const b = e.box, m = 8 / v.sx;
        const nearEdge = p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m;
        if (h && h !== 'move') { this.drag = { mode: h, box: Object.assign({}, b) }; ev.preventDefault(); return; }
        if (nearEdge) { this.drag = { mode: 'move', sx: p.x, sy: p.y, box: Object.assign({}, b) }; return; }
        X.commit();
        return;
      }
      this.drag = { mode: 'new', sx: Math.round(p.x), sy: Math.round(p.y), x: p.x, y: p.y };
    },
    move(p, ev) {
      const d = this.drag, v = view();
      if (!d) return;
      if (d.mode === 'new') {
        d.x = p.x; d.y = p.y;
        const x = Math.round(Math.min(d.sx, p.x)), y = Math.round(Math.min(d.sy, p.y)), w = Math.round(Math.abs(p.x - d.sx)), h = Math.round(Math.abs(p.y - d.sy));
        const r = 'x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '"';
        v.setOverlay('<rect class="guide-bg" ' + r + '/><rect class="guide" ' + r + '/>');
        T.bus.emit('sizehint', w, h);
      } else if (d.mode === 'move') {
        X.editing.box.x = Math.round(d.box.x + p.x - d.sx);
        X.editing.box.y = Math.round(d.box.y + p.y - d.sy);
        styleEditor();
      } else {
        Object.assign(X.editing.box, T.resizeBox(d.box, d.mode, p, ev.shiftKey));
        styleEditor();
      }
    },
    up() {
      const d = this.drag, pg = page();
      this.drag = null;
      T.bus.emit('sizehint', null);
      if (!d) return;
      if (d.mode === 'new') {
        view().setOverlay('');
        let x = Math.round(Math.min(d.sx, d.x)), y = Math.round(Math.min(d.sy, d.y));
        let w = Math.round(Math.abs(d.x - d.sx)), h = Math.round(Math.abs(d.y - d.sy));
        if (w < 8 || h < 8) { w = Math.max(40, Math.min(240, pg.w - x)); h = Math.max(lineH(), Math.min(lineH() * 3, pg.h - y)); }
        X.begin({ x, y, w, h });
        // el enfoque no debe perderse al soltar el botón
        setTimeout(() => { if (X.editing) X.editing.el.focus(); }, 0);
      } else if (X.editing) X.editing.el.focus();
    },
    hover(p) {
      const e = X.editing, v = view();
      if (!e) return 'text';
      const h = T.hitBox(e.box, p, v.sx);
      if (h && h !== 'move') return T.handleCursor(h);
      const b = e.box, m = 8 / v.sx;
      return p.x >= b.x - m && p.x <= b.x + b.w + m && p.y >= b.y - m && p.y <= b.y + b.h + m ? 'move' : 'text';
    }
  };

  /* ---------- Barra de formato ---------- */
  X.initBar = function () {
    const el = U.el, bar = document.getElementById('textbar');
    const fontSel = el('select.tselect', { style: { width: '170px' }, onchange: e => { ts().font = e.target.value; apply(); } },
      X.FONTS.map(f => el('option', { value: f, text: f })));
    const sizeSel = el('select.tselect', { style: { width: '70px' }, onchange: e => { ts().size = +e.target.value; apply(); } },
      X.SIZES.map(s => el('option', { value: s, text: s })));
    const toggle = (key, content, tip, style) => el('button.gbtn', { html: content, data: { tip, flag: key }, style, onmousedown: e => e.preventDefault(), onclick: () => { ts()[key] = !ts()[key]; apply(); } });
    const bold = toggle('bold', '<b>N</b>', 'Negrita'), ital = toggle('italic', '<i>K</i>', 'Cursiva'),
      und = toggle('underline', '<u>S</u>', 'Subrayado'), str = toggle('strike', '<s>T</s>', 'Tachado'),
      bg = toggle('bg', T.icon('textBg', 18), 'Relleno de fondo (usa el color 2)');
    const aligns = ['left', 'center', 'right'].map((a, i) => el('button.gbtn', {
      html: T.icon(['alignL', 'alignC', 'alignR'][i], 18), data: { tip: ['Alinear a la izquierda', 'Centrar', 'Alinear a la derecha'][i] },
      onmousedown: e => e.preventDefault(), onclick: () => { ts().align = a; apply(); }
    }));
    U.append(bar, [fontSel, sizeSel, el('div.sep'), bold, ital, und, str, el('div.sep'), aligns, el('div.sep'), bg]);
    function apply() { styleEditor(); grow(); sync(); if (X.editing) X.editing.el.focus(); }
    function sync() {
      const s = ts();
      fontSel.value = s.font; sizeSel.value = s.size;
      for (const b of [bold, ital, und, str, bg]) b.classList.toggle('on', !!s[b.dataset.flag]);
      ['left', 'center', 'right'].forEach((a, i) => aligns[i].classList.toggle('on', s.align === a));
    }
    function visible() { bar.hidden = !(T.state.tool === 'text' || X.editing); sync(); }
    T.bus.on('tool', visible);
    T.bus.on('textopts', visible);
    visible();
  };
})();
