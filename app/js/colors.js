'use strict';
/* Trazo · colores: los dos colores activos, la paleta y el editor de color. */
(function () {
  const T = window.T, U = T.util, el = U.el, UI = T.ui;
  const C = T.colors = {};

  C.PALETTE = [
    '#000000', '#7f7f7f', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4',
    '#ffffff', '#c3c3c3', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7'
  ];
  C.BASIC = [
    '#000000', '#404040', '#7f7f7f', '#c3c3c3', '#ffffff', '#880015', '#ed1c24', '#ff7f27', '#ffc90e', '#fff200', '#b5e61d', '#22b14c',
    '#00a2e8', '#3f48cc', '#a349a4', '#ff7cc4', '#b97a57', '#efe4b0', '#99d9ea', '#7092be', '#c8bfe7', '#5c2e91', '#0f6cbd', '#107c10'
  ];

  C.set = function (slot, color) {
    T.state['color' + slot] = color;
    T.bus.emit('color');
    if (T.selection.cur && slot === 2) T.selection.refreshTransparent();
  };
  C.setActive = color => C.set(T.state.activeSlot, color);
  C.select = slot => { T.state.activeSlot = slot; T.bus.emit('color'); };
  C.swap = function () {
    const s = T.state, a = s.color1;
    s.color1 = s.color2; s.color2 = a;
    T.bus.emit('color');
  };
  C.addCustom = function (color) {
    const list = T.state.custom;
    const i = list.indexOf(color);
    if (i >= 0) list.splice(i, 1);
    list.unshift(color);
    list.length = Math.min(list.length, 10);
    T.bus.emit('color');
  };

  /* Elige un color nuevo para la ranura activa. */
  C.pick = async function () {
    const r = await C.edit(T.state['color' + T.state.activeSlot]);
    if (r) { C.setActive(r); C.addCustom(r); }
  };

  /* Editor de color. Devuelve el color o null. */
  C.edit = function (initial) {
    const rgb0 = U.hexToRgb(initial);
    let [h, s, v] = U.rgbToHsv(rgb0[0], rgb0[1], rgb0[2]);
    const sv = U.canvas(256, 200);
    const svKnob = el('div.knob'), valKnob = el('div.knob');
    const svBox = el('div.sv', null, sv, svKnob);
    const valBar = el('div.val', null, valKnob);
    const after = el('div'), before = el('div', { style: { background: initial } });
    const mk = (min, max) => { const i = UI.num(0, min, max); i.classList.remove('num'); return i; };
    const R = mk(0, 255), G = mk(0, 255), B = mk(0, 255), H = mk(0, 360), S = mk(0, 100), Vv = mk(0, 100);
    const hex = el('input.tinput', { type: 'text', spellcheck: false, autocomplete: 'off', 'data-autofocus': '' });
    hex.dataset.autofocus = '';
    const lab = (t, i) => el('label', null, t, i);
    const basic = el('div.cbasic', null, C.BASIC.map(c => el('button.swatch', {
      type: 'button', 'aria-label': c, onclick: () => { const q = U.hexToRgb(c); [h, s, v] = U.rgbToHsv(q[0], q[1], q[2]); paint(); }
    }, el('i', { style: { background: c } }))));

    function drawSV() {
      const c = sv.ctx, W = sv.width, Hh = sv.height, im = c.createImageData(W, Hh), d = im.data;
      for (let y = 0; y < Hh; y++) for (let x = 0; x < W; x++) {
        const q = U.hsvToRgb(x / (W - 1) * 360, 1 - y / (Hh - 1), 1), o = (y * W + x) * 4;
        d[o] = q[0]; d[o + 1] = q[1]; d[o + 2] = q[2]; d[o + 3] = 255;
      }
      c.putImageData(im, 0, 0);
    }
    function current() { const q = U.hsvToRgb(h, s, v); return U.rgbToHex(q[0], q[1], q[2]); }
    function paint(from) {
      const q = U.hsvToRgb(h, s, v), col = U.rgbToHex(q[0], q[1], q[2]);
      svKnob.style.left = (h / 360 * 100) + '%'; svKnob.style.top = ((1 - s) * 100) + '%';
      svKnob.style.background = U.rgbToHex.apply(null, U.hsvToRgb(h, s, 1));
      valKnob.style.left = (v * 100) + '%'; valKnob.style.background = col;
      const top = U.hsvToRgb(h, s, 1);
      valBar.style.background = 'linear-gradient(to right,#000,rgb(' + top.join(',') + '))';
      after.style.background = col;
      if (from !== 'rgb') { R.value = q[0]; G.value = q[1]; B.value = q[2]; }
      if (from !== 'hsv') { H.value = Math.round(h); S.value = Math.round(s * 100); Vv.value = Math.round(v * 100); }
      if (from !== 'hex') hex.value = col;
    }
    function drag(node, fn) {
      node.addEventListener('pointerdown', ev => { node.setPointerCapture(ev.pointerId); fn(ev); });
      node.addEventListener('pointermove', ev => { if (node.hasPointerCapture(ev.pointerId)) fn(ev); });
    }
    drag(svBox, ev => {
      const r = svBox.getBoundingClientRect();
      h = U.clamp((ev.clientX - r.left) / r.width, 0, 1) * 360;
      s = 1 - U.clamp((ev.clientY - r.top) / r.height, 0, 1);
      paint();
    });
    drag(valBar, ev => { const r = valBar.getBoundingClientRect(); v = U.clamp((ev.clientX - r.left) / r.width, 0, 1); paint(); });
    const fromRgb = () => {
      const a = R.getValue(), b = G.getValue(), c = B.getValue();
      if (a == null || b == null || c == null) return;
      [h, s, v] = U.rgbToHsv(a, b, c); paint('rgb');
    };
    const fromHsv = () => {
      const a = H.getValue(), b = S.getValue(), c = Vv.getValue();
      if (a == null || b == null || c == null) return;
      h = a; s = b / 100; v = c / 100; paint('hsv');
    };
    [R, G, B].forEach(i => i.addEventListener('input', fromRgb));
    [H, S, Vv].forEach(i => i.addEventListener('input', fromHsv));
    hex.addEventListener('input', () => {
      const ok = U.validHex(hex.value);
      hex.classList.toggle('bad', !ok);
      if (ok) { const q = U.hexToRgb(U.normHex(hex.value)); [h, s, v] = U.rgbToHsv(q[0], q[1], q[2]); paint('hex'); }
    });

    const body = el('div.cedit', null,
      el('div', null, svBox, valBar),
      el('div.side', null,
        el('div.preview', null, after, before),
        U.el('div.field', null, el('label', { text: 'Hexadecimal' }), hex),
        el('div.triple', null, lab('Rojo', R), lab('Verde', G), lab('Azul', B)),
        el('div.triple', null, lab('Matiz', H), lab('Sat. %', S), lab('Valor %', Vv))));
    const wrap = el('div', null, body, el('div.fsection', { text: 'Colores básicos' }), basic);
    drawSV();
    paint();
    return UI.dialog({
      title: 'Editar colores', body: wrap, width: 540, cancelValue: null,
      buttons: [{ label: 'Aceptar', primary: true, onClick: () => current() }, { label: 'Cancelar', value: null }]
    });
  };
})();
