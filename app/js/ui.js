'use strict';
/* Trazo · componentes de interfaz: menús, diálogos, deslizadores, ayudas y avisos. */
(function () {
  const T = window.T, U = T.util, el = U.el;
  const UI = T.ui = {};
  const host = () => document.getElementById('overlays');

  /* ================= Menús desplegables ================= */
  const stack = []; // menús abiertos, del raíz al último submenú
  UI.menuOwner = null;

  UI.closeMenus = function (level) {
    level = level || 0;
    while (stack.length > level) {
      const m = stack.pop();
      m.el.remove();
      if (m.parentItem) m.parentItem.classList.remove('act');
      if (stack.length === 0) {
        if (m.root && m.root.anchorEl) m.root.anchorEl.classList.remove('open');
        const cb = m.root && m.root.onClose;
        UI.menuOwner = null;
        if (cb) cb();
      }
    }
  };
  UI.menuOpen = () => stack.length > 0;

  function place(box, anchor, side, alignRight) {
    const vw = window.innerWidth, vh = window.innerHeight;
    const r = anchor.getBoundingClientRect ? anchor.getBoundingClientRect() : { left: anchor.x, right: anchor.x, top: anchor.y, bottom: anchor.y, width: 0, height: 0 };
    const bw = box.offsetWidth, bh = box.offsetHeight;
    let x, y;
    if (side === 'right') {
      x = r.right - 2; y = r.top - 5;
      if (x + bw > vw - 6) x = Math.max(6, r.left - bw + 2);
    } else {
      x = alignRight ? r.right - bw : r.left;
      y = r.bottom + 3;
      if (y + bh > vh - 6 && r.top - bh - 3 > 6) y = r.top - bh - 3;
    }
    x = U.clamp(x, 6, Math.max(6, vw - bw - 6));
    y = U.clamp(y, 6, Math.max(6, vh - bh - 6));
    box.style.left = Math.round(x) + 'px';
    box.style.top = Math.round(y) + 'px';
  }

  function buildMenu(items, level, root) {
    const box = el('div.flyout', { role: 'menu', tabIndex: -1 });
    const entry = { el: box, level, root, parentItem: null, items: [] };
    const list = typeof items === 'function' ? items() : items;
    for (const it of list) {
      if (!it) continue;
      if (it.sep) { box.appendChild(el('div.mline')); continue; }
      if (it.head) { box.appendChild(el('div.mhead', { text: it.head })); continue; }
      if (it.custom) { box.appendChild(it.custom); continue; }
      const checked = typeof it.checked === 'function' ? it.checked() : it.checked;
      const disabled = typeof it.disabled === 'function' ? it.disabled() : it.disabled;
      let iconHtml = '';
      if (checked) iconHtml = T.icon(it.radio ? 'dot' : 'check', 16);
      else if (it.icon && checked === undefined) iconHtml = T.icon(it.icon, 18);
      const row = el('div.mi', { role: 'menuitem', class: (disabled ? 'disabled ' : '') + (checked ? 'checked' : '') },
        el('span.mic', { html: iconHtml }),
        it.swatch ? el('span', { style: { width: '14px', height: '14px', borderRadius: '50%', background: it.swatch, border: '1px solid var(--stroke-strong)', flex: 'none' } }) : null,
        el('span.mlabel', { text: it.label }),
        it.key ? el('span.mkey', { text: it.key }) : null,
        it.sub ? el('span.msub', { html: T.icon('chevRight', 14) }) : null);
      if (it.leading) row.insertBefore(it.leading, row.children[1]);
      const openSub = () => {
        if (stack.length > level + 1 && stack[level + 1].parentItem === row) return;
        UI.closeMenus(level + 1);
        const sub = buildMenu(it.sub, level + 1, root);
        sub.parentItem = row;
        row.classList.add('act');
        host().appendChild(sub.el);
        place(sub.el, row, 'right');
        stack.push(sub);
      };
      let timer = 0;
      row.addEventListener('pointerenter', () => {
        setActive(entry, row);
        clearTimeout(timer);
        timer = setTimeout(() => {
          if (!box.isConnected) return;
          if (it.sub) openSub(); else UI.closeMenus(level + 1);
        }, it.sub ? 140 : 220);
      });
      row.addEventListener('pointerleave', () => clearTimeout(timer));
      row.addEventListener('click', ev => {
        ev.stopPropagation();
        if (disabled) return;
        if (it.sub) { openSub(); return; }
        if (!it.keepOpen) UI.closeMenus(0);
        if (it.run) it.run();
      });
      row._openSub = it.sub ? openSub : null;
      row._disabled = !!disabled;
      entry.items.push(row);
      box.appendChild(row);
    }
    return entry;
  }

  function setActive(entry, row) {
    for (const r of entry.items) if (r !== row && !(stack[entry.level + 1] && stack[entry.level + 1].parentItem === r)) r.classList.remove('act');
    if (row) row.classList.add('act');
    entry.active = row;
  }

  /* Abre un menú junto a un elemento (o en un punto {x, y}). */
  UI.menu = function (anchor, items, opts) {
    opts = opts || {};
    UI.closeMenus(0);
    const root = { anchorEl: anchor.getBoundingClientRect ? anchor : null, onClose: opts.onClose };
    const m = buildMenu(items, 0, root);
    if (opts.minWidth) m.el.style.minWidth = opts.minWidth + 'px';
    host().appendChild(m.el);
    place(m.el, anchor, opts.side || 'bottom', opts.alignRight);
    stack.push(m);
    if (root.anchorEl) root.anchorEl.classList.add('open');
    UI.menuOwner = opts.owner || null;
    return m;
  };

  document.addEventListener('pointerdown', ev => {
    if (!stack.length) return;
    for (const m of stack) if (m.el.contains(ev.target)) return;
    const root = stack[0].root;
    if (root.anchorEl && root.anchorEl.contains(ev.target)) return; // el botón decide (alternar)
    UI.closeMenus(0);
  }, true);
  window.addEventListener('blur', () => UI.closeMenus(0));
  window.addEventListener('resize', () => UI.closeMenus(0));

  UI.menuKey = function (ev) {
    if (!stack.length) return false;
    const m = stack[stack.length - 1];
    const rows = m.items.filter(r => !r._disabled);
    const i = rows.indexOf(m.active);
    switch (ev.key) {
      case 'Escape': UI.closeMenus(stack.length - 1); return true;
      case 'ArrowDown': setActive(m, rows[(i + 1) % rows.length]); return true;
      case 'ArrowUp': setActive(m, rows[(i - 1 + rows.length) % rows.length]); return true;
      case 'ArrowRight': if (m.active && m.active._openSub) { m.active._openSub(); const s = stack[stack.length - 1]; setActive(s, s.items.find(r => !r._disabled)); } return true;
      case 'ArrowLeft': if (stack.length > 1) UI.closeMenus(stack.length - 1); return true;
      case 'Enter': case ' ': if (m.active) m.active.click(); return true;
      default: return true; // el menú abierto se queda con el teclado
    }
  };

  /* ================= Diálogos ================= */
  const dialogs = [];
  UI.dialogOpen = () => dialogs.length > 0;

  /* opts: { title, body, buttons: [{ label, value, primary, onClick() → false para no cerrar }],
   *         width, cancelValue, onOpen(api) }. Devuelve una promesa con el valor del botón. */
  UI.dialog = function (opts) {
    UI.closeMenus(0);
    return new Promise(resolve => {
      const body = el('div.dialog-body');
      if (typeof opts.body === 'string') body.appendChild(el('div', { text: opts.body, style: { whiteSpace: 'pre-line' } }));
      else if (opts.body) U.append(body, opts.body);
      const foot = el('div.dialog-foot');
      const dlg = el('div.dialog', { role: 'dialog', 'aria-modal': 'true', style: opts.width ? { width: opts.width + 'px' } : null },
        opts.title ? el('div.dialog-title', { text: opts.title }) : null, body, foot);
      const back = el('div.backdrop', null, dlg);
      const prevFocus = document.activeElement;
      let done = false;
      const api = {
        el: dlg, body, buttons: {},
        close(value) {
          if (done) return;
          done = true;
          const i = dialogs.indexOf(api);
          if (i >= 0) dialogs.splice(i, 1);
          back.remove();
          if (prevFocus && prevFocus.focus && document.contains(prevFocus)) { try { prevFocus.focus({ preventScroll: true }); } catch (e) { /* nada */ } }
          resolve(value);
        }
      };
      let primaryBtn = null;
      (opts.buttons || [{ label: 'Aceptar', value: true, primary: true }]).forEach(b => {
        if (b.spacer) { foot.appendChild(el('div.spacer')); return; }
        const btn = el('button.btn', { text: b.label, class: b.primary ? 'primary' : '', type: 'button' });
        btn.addEventListener('click', async () => {
          if (b.onClick) {
            const r = await b.onClick(api);
            if (r === false) return;
            api.close(r === undefined ? b.value : r);
          } else api.close(b.value);
        });
        if (b.primary) primaryBtn = btn;
        if (b.id) api.buttons[b.id] = btn;
        foot.appendChild(btn);
      });
      api.primary = primaryBtn;
      api.cancel = () => api.close(opts.cancelValue === undefined ? null : opts.cancelValue);
      back.addEventListener('pointerdown', ev => { if (ev.target === back) ev.preventDefault(); });
      dlg.addEventListener('keydown', ev => {
        if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); api.cancel(); }
        else if (ev.key === 'Enter' && !ev.shiftKey) {
          const t = ev.target;
          if (t.tagName === 'TEXTAREA' || (t.tagName === 'BUTTON' && t !== primaryBtn)) return;
          if (primaryBtn && !primaryBtn.disabled) { ev.preventDefault(); ev.stopPropagation(); primaryBtn.click(); }
        } else if (ev.key === 'Tab') {
          const f = Array.from(dlg.querySelectorAll('button, input, select, textarea, [tabindex]')).filter(n => !n.disabled && n.tabIndex >= 0 && n.offsetParent !== null);
          if (!f.length) return;
          const first = f[0], last = f[f.length - 1];
          if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        }
        ev.stopPropagation();
      });
      host().appendChild(back);
      dialogs.push(api);
      if (opts.onOpen) opts.onOpen(api);
      const auto = dlg.querySelector('[data-autofocus]') || primaryBtn || dlg.querySelector('button');
      if (auto) { auto.focus(); if (auto.select) auto.select(); }
    });
  };

  UI.alert = (title, text) => UI.dialog({ title, body: text, buttons: [{ label: 'Aceptar', value: true, primary: true }] });
  UI.confirm = (title, text, ok, cancel) => UI.dialog({
    title, body: text, cancelValue: false,
    buttons: [{ label: ok || 'Aceptar', value: true, primary: true }, { label: cancel || 'Cancelar', value: false }]
  });

  /* ---------- Piezas de formulario ---------- */
  let uid = 0;
  UI.radio = function (name, value, label, checked, sub) {
    const input = el('input', { type: 'radio', name, value, checked: !!checked });
    const node = el('label.choice.radio', null, input, el('span.mark'),
      el('span.ctext', null, el('span', { text: label }), sub ? el('span.csub', { text: sub }) : null));
    node.input = input;
    return node;
  };
  UI.check = function (label, checked, sub) {
    const input = el('input', { type: 'checkbox', checked: !!checked });
    const node = el('label.choice.check', null, input, el('span.mark', { html: T.icon('check', 14) }),
      el('span.ctext', null, el('span', { text: label }), sub ? el('span.csub', { text: sub }) : null));
    node.input = input;
    return node;
  };
  UI.radioValue = (root, name) => { const r = root.querySelector('input[name="' + name + '"]:checked'); return r ? r.value : null; };
  UI.radioName = () => 'r' + (++uid);
  UI.num = function (value, min, max, opts) {
    opts = opts || {};
    const input = el('input.tinput.num', { type: 'text', inputMode: 'decimal', value: String(value), spellcheck: false, autocomplete: 'off' });
    input.getValue = () => {
      const v = parseFloat(String(input.value).replace(',', '.'));
      if (!isFinite(v)) return null;
      if (min != null && v < min) return null;
      if (max != null && v > max) return null;
      return opts.float ? v : Math.round(v);
    };
    input.addEventListener('input', () => input.classList.toggle('bad', input.getValue() == null));
    input.addEventListener('focus', () => input.select());
    return input;
  };
  UI.field = (label, control) => el('div.field', null, el('label', { text: label }), control);

  /* ================= Deslizadores ================= */
  function slider(vertical, opts) {
    const fill = el('div.fill'), thumb = el('div.thumb');
    const track = el('div.track', null, fill);
    const val = vertical ? el('div.val') : null;
    const node = el(vertical ? 'div.vslider' : 'div.hslider', { tabIndex: 0, role: 'slider' },
      vertical && opts.icon ? el('div.cap', { html: T.icon(opts.icon, 16) }) : null, track, thumb, val);
    const s = { el: node, min: opts.min, max: opts.max, value: opts.value, toT: opts.toT || null, fromT: opts.fromT || null };
    const tOf = v => (s.toT ? s.toT(v) : (v - s.min) / ((s.max - s.min) || 1));
    const vOf = t => (s.fromT ? s.fromT(t) : Math.round(s.min + t * (s.max - s.min)));
    function paint() {
      const t = U.clamp(tOf(s.value), 0, 1);
      if (vertical) {
        const top = track.offsetTop, h = track.offsetHeight || 100;
        thumb.style.top = (top + (1 - t) * h) + 'px';
        fill.style.height = (t * 100) + '%';
        if (val) { val.textContent = opts.format ? opts.format(s.value) : String(s.value); val.style.top = (top + (1 - t) * h) + 'px'; }
      } else {
        const left = track.offsetLeft, w = track.offsetWidth || 100;
        thumb.style.left = (left + t * w) + 'px';
        fill.style.width = (t * 100) + '%';
      }
      node.setAttribute('aria-valuenow', s.value);
    }
    function fromEvent(ev) {
      const r = track.getBoundingClientRect();
      const t = vertical ? 1 - (ev.clientY - r.top) / r.height : (ev.clientX - r.left) / r.width;
      const v = U.clamp(vOf(U.clamp(t, 0, 1)), s.min, s.max);
      if (v !== s.value) { s.value = v; paint(); if (opts.onInput) opts.onInput(v); }
    }
    node.addEventListener('pointerdown', ev => {
      if (ev.button !== 0) return;
      node.setPointerCapture(ev.pointerId);
      node.classList.add('drag');
      fromEvent(ev);
      ev.preventDefault();
    });
    node.addEventListener('pointermove', ev => { if (node.hasPointerCapture(ev.pointerId)) fromEvent(ev); });
    const end = ev => { node.classList.remove('drag'); if (node.hasPointerCapture(ev.pointerId)) node.releasePointerCapture(ev.pointerId); if (opts.onChange) opts.onChange(s.value); };
    node.addEventListener('pointerup', end);
    node.addEventListener('pointercancel', end);
    node.addEventListener('keydown', ev => {
      let d = 0;
      if (ev.key === 'ArrowUp' || ev.key === 'ArrowRight') d = 1;
      else if (ev.key === 'ArrowDown' || ev.key === 'ArrowLeft') d = -1;
      if (!d) return;
      ev.preventDefault(); ev.stopPropagation();
      const v = opts.step ? opts.step(s.value, d) : U.clamp(s.value + d, s.min, s.max);
      if (v !== s.value) { s.value = v; paint(); if (opts.onInput) opts.onInput(v); if (opts.onChange) opts.onChange(v); }
    });
    s.set = v => { s.value = v; paint(); };
    s.setRange = (min, max) => { s.min = min; s.max = max; s.value = U.clamp(s.value, min, max); paint(); };
    s.paint = paint;
    new ResizeObserver(paint).observe(node);
    requestAnimationFrame(paint);
    return s;
  }
  UI.vslider = opts => slider(true, opts);
  UI.hslider = opts => slider(false, opts);

  /* ================= Ayudas emergentes ================= */
  let tipEl = null, tipTimer = 0, tipFor = null;
  function hideTip() { clearTimeout(tipTimer); if (tipEl) { tipEl.remove(); tipEl = null; } tipFor = null; }
  document.addEventListener('pointerover', ev => {
    const t = ev.target.closest && ev.target.closest('[data-tip]');
    if (t === tipFor) return;
    hideTip();
    if (!t || ev.pointerType === 'touch') return;
    tipFor = t;
    tipTimer = setTimeout(() => {
      if (!t.isConnected || stack.length) return;
      tipEl = el('div.tip', null, t.dataset.tip, t.dataset.key ? el('span.tkey', { text: t.dataset.key }) : null);
      document.body.appendChild(tipEl);
      const r = t.getBoundingClientRect();
      let x = r.left + r.width / 2 - tipEl.offsetWidth / 2, y = r.bottom + 8;
      if (y + tipEl.offsetHeight > window.innerHeight - 4) y = r.top - tipEl.offsetHeight - 8;
      tipEl.style.left = U.clamp(x, 4, window.innerWidth - tipEl.offsetWidth - 4) + 'px';
      tipEl.style.top = y + 'px';
    }, 600);
  });
  document.addEventListener('pointerdown', hideTip, true);
  document.addEventListener('keydown', hideTip, true);
  document.addEventListener('pointerleave', hideTip);

  /* ================= Avisos breves ================= */
  let toastEl = null, toastTimer = 0;
  UI.toast = function (text, ms) {
    if (toastEl) toastEl.remove();
    clearTimeout(toastTimer);
    toastEl = el('div.toast', { text });
    document.body.appendChild(toastEl);
    toastTimer = setTimeout(() => { if (toastEl) { toastEl.remove(); toastEl = null; } }, ms || 2600);
  };
})();
