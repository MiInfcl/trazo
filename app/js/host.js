'use strict';
/* Trazo · puente con el sistema: en el .exe usa la ventana nativa (WebView2);
 * en un navegador usa la API de archivos o, si no existe, descargas normales. */
(function () {
  const T = window.T, U = T.util;
  const H = T.host = {};
  const wv = window.chrome && window.chrome.webview;
  H.desktop = !!wv;
  H.closeHandler = null;

  let rid = 1;
  const waiting = new Map();
  function call(method, args) {
    return new Promise((resolve, reject) => {
      const id = rid++;
      waiting.set(id, { resolve, reject });
      wv.postMessage(JSON.stringify({ id, method, args: args || {} }));
    });
  }
  if (wv) {
    wv.addEventListener('message', ev => {
      const m = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      if (m.event === 'close') { if (H.closeHandler) H.closeHandler(); else call('forceClose'); return; }
      if (m.event === 'openFile') { T.bus.emit('host-open', m); return; }
      const w = waiting.get(m.id);
      if (!w) return;
      waiting.delete(m.id);
      if (m.error) w.reject(new Error(m.error)); else w.resolve(m.result);
    });
  }
  H.call = call;

  function acceptToFilter(types) {
    // types: [{ name, ext: ['png', ...] }] → filtro de los diálogos de Windows
    return types.map(t => T.tr(t.name) + '|' + t.ext.map(e => '*.' + e).join(';')).join('|');
  }

  /* Abre archivos. Devuelve [{ name, bytes, handle, size }] (vacío si se canceló). */
  H.pickOpen = async function (types, multiple) {
    if (H.desktop) {
      const r = await call('openDialog', { filter: acceptToFilter(types), multiple: !!multiple });
      return (r || []).map(f => ({ name: f.name, bytes: U.base64ToBytes(f.b64), handle: { path: f.path }, size: f.size }));
    }
    if (window.showOpenFilePicker) {
      try {
        const hs = await window.showOpenFilePicker({
          multiple: !!multiple,
          types: types.map(t => ({ description: T.tr(t.name), accept: { 'application/octet-stream': t.ext.map(e => '.' + e) } }))
        });
        const out = [];
        for (const h of hs) { const f = await h.getFile(); out.push({ name: f.name, bytes: await U.blobToBytes(f), handle: h, size: f.size }); }
        return out;
      } catch (e) { if (e.name === 'AbortError') return []; console.warn(e); }
    }
    return new Promise(resolve => {
      const input = U.el('input', { type: 'file', multiple: !!multiple, accept: types.flatMap(t => t.ext.map(e => '.' + e)).join(',') });
      input.addEventListener('change', async () => {
        const out = [];
        for (const f of input.files) out.push({ name: f.name, bytes: await U.blobToBytes(f), handle: null, size: f.size });
        resolve(out);
      });
      input.addEventListener('cancel', () => resolve([]));
      input.click();
    });
  };

  /* Pregunta dónde guardar. Devuelve { name, handle } o null. */
  H.pickSave = async function (suggested, types) {
    if (H.desktop) {
      const r = await call('saveDialog', { name: suggested, filter: acceptToFilter(types) });
      return r ? { name: r.name, handle: { path: r.path } } : null;
    }
    if (window.showSaveFilePicker) {
      try {
        const h = await window.showSaveFilePicker({
          suggestedName: suggested,
          types: types.map(t => ({ description: T.tr(t.name), accept: { 'application/octet-stream': t.ext.map(e => '.' + e) } }))
        });
        return { name: h.name, handle: h };
      } catch (e) { if (e.name === 'AbortError') return null; console.warn(e); }
    }
    return { name: suggested, handle: null };
  };

  /* Escribe bytes en el destino (o los descarga si el navegador no da acceso al archivo). */
  H.write = async function (target, bytes) {
    if (target.handle && target.handle.path) { await call('writeFile', { path: target.handle.path, b64: U.bytesToBase64(bytes) }); return; }
    if (target.handle && target.handle.createWritable) {
      const w = await target.handle.createWritable();
      await w.write(bytes);
      await w.close();
      return;
    }
    const url = URL.createObjectURL(new Blob([bytes]));
    const a = U.el('a', { href: url, download: target.name });
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  };

  /* Vuelve a leer un archivo reciente; null si ya no se puede. */
  H.readRecent = async function (rec) {
    if (H.desktop && rec.path) {
      const f = await call('readFile', { path: rec.path });
      return { name: f.name, bytes: U.base64ToBytes(f.b64), handle: { path: f.path }, size: f.size };
    }
    return null;
  };

  H.setTitle = t => { document.title = t; if (H.desktop) call('setTitle', { title: t }).catch(() => {}); };
  H.setWallpaper = (bytes, mode) => call('setWallpaper', { b64: U.bytesToBase64(bytes), mode });
  H.forceClose = () => { if (H.desktop) call('forceClose'); else window.close(); };
  H.startupFiles = async function () {
    if (!H.desktop) return [];
    const r = await call('startupFiles');
    return (r || []).map(f => ({ name: f.name, bytes: U.base64ToBytes(f.b64), handle: { path: f.path }, size: f.size }));
  };
})();
