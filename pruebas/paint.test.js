'use strict';
/* Proyectos .paint: ida y vuelta, disposición de bytes y archivos dañados. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const zlib = require('node:zlib');
const C = require(path.join(__dirname, '..', 'app', 'js', 'codecs.js'));

function capa(w, h, semilla) {
  let s = semilla >>> 0;
  const r = () => { s = (s * 1664525 + 1013904223) >>> 0; return s >>> 24; };
  const px = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < px.length; i++) px[i] = r();
  return px;
}
const be = (v, n) => { const a = []; for (let i = n - 1; i >= 0; i--) a.push(Math.floor(v / Math.pow(256, i)) & 255); return a; };
const txt = s => Array.from(s, c => c.charCodeAt(0));
const box = (t, ...p) => { const b = p.flat(); return be(b.length + 8, 4).concat(txt(t), b); };
const full = (t, v, ...p) => box(t, [v, 0, 0, 0], ...p);

/* Archivo hecho a mano para probar lo que el escritor propio no genera. */
function fabricar({ w, h, cw, ch, x, y, orden, canales, alg = 'defl', bytes, fill = [255, 255, 255, 0], pixelSize = 0 }) {
  const cc = orden.length;
  const raw = bytes || new Uint8Array(w * h * cc).map((_, i) => i * 7);
  const datos = alg === 'defl' ? zlib.deflateRawSync(raw) : alg === 'zlib' ? zlib.deflateSync(raw) : Buffer.from(raw);
  const iovl = [0, 0, fill[0], fill[0], fill[1], fill[1], fill[2], fill[2], fill[3], fill[3]].concat(be(cw, 2), be(ch, 2), be(x & 65535, 2), be(y & 65535, 2));
  const comp = [];
  orden.forEach(i => comp.push(...be(i, 2), 7, 0, 0));
  const props = [
    ...(alg === 'none' ? [] : full('cmpC', 0, txt(alg), [0])),
    ...full('ispe', 0, be(w, 4), be(h, 4)),
    ...box('cmpd', be(canales.length, 4), canales.flatMap(c => be(c, 2))),
    ...full('uncC', 0, txt('gene'), be(cc, 4), comp, [0, 1, 0, 0], be(pixelSize, 4), new Array(16).fill(0)),
    ...full('ispe', 0, be(cw, 4), be(ch, 4))
  ];
  const ipma = alg === 'none'
    ? be(2, 4).concat(be(1, 2), 3, 0x81, 0x82, 0x83, be(2, 2), 1, 4)
    : be(2, 4).concat(be(1, 2), 4, 0x81, 0x82, 0x83, 0x84, be(2, 2), 1, 5);
  const construir = base => full('meta', 0,
    full('hdlr', 0, [0, 0, 0, 0], txt('pict'), new Array(13).fill(0)),
    full('pitm', 0, be(2, 2)),
    full('iinf', 0, be(2, 2), full('infe', 2, be(1, 2), [0, 0], txt('unci'), [0]), full('infe', 2, be(2, 2), [0, 0], txt('iovl'), [0])),
    full('iloc', 1, [0x44, 0], be(2, 2), be(1, 2), [0, 0, 0, 0, 0, 1], be(base, 4), be(datos.length, 4), be(2, 2), [0, 1, 0, 0, 0, 1], [0, 0, 0, 0], be(iovl.length, 4)),
    box('iprp', box('ipco', props), full('ipma', 0, ipma)),
    full('iref', 0, box('dimg', be(2, 2), be(1, 2), be(1, 2))),
    box('idat', iovl));
  const ftyp = box('ftyp', txt('mif1'), [0, 0, 0, 0], txt('mif1'), txt('miaf'));
  const inicio = ftyp.length + construir(0).length + 8;
  return Uint8Array.from([...ftyp, ...construir(inicio), ...be(datos.length + 8, 4), ...txt('mdat'), ...datos]);
}

test('.paint: ida y vuelta con varias capas', async () => {
  const w = 37, h = 19, capas = [capa(w, h, 1), capa(w, h, 2), capa(w, h, 3)];
  const f = await C.readPaint(await C.writePaint(w, h, capas));
  assert.equal(f.w, w); assert.equal(f.h, h);
  assert.deepEqual(f.fill, [255, 255, 255, 0]);
  assert.equal(f.layers.length, 3);
  f.layers.forEach((l, i) => {
    assert.deepEqual([l.x, l.y, l.w, l.h], [0, 0, w, h]);
    assert.deepEqual(Buffer.from(l.rgba.buffer), Buffer.from(capas[i].buffer));
  });
});

test('.paint: el escritor reproduce la disposición de Paint', async () => {
  const b = await C.writePaint(1920, 1080, [new Uint8ClampedArray(1920 * 1080 * 4), new Uint8ClampedArray(1920 * 1080 * 4)]);
  assert.equal(Buffer.from(b.subarray(0, 32)).toString('hex'), '00000020' + Buffer.from('ftypmif1').toString('hex') + '00000000' + Buffer.from('mif1gcmiisoamiaf').toString('hex'));
  // Mismo tamaño de caja meta y mismos tramos que un archivo real con dos capas
  assert.equal(new DataView(b.buffer).getUint32(32), 470);
  const hex = Buffer.from(b).toString('hex');
  assert.ok(hex.includes('000000030001068102038485060002068102038485060003020206'), 'ipma');
  assert.ok(hex.includes('0000ffffffffffff0000' + '07800438' + '0000000000000000'), 'iovl');
  assert.equal(C.isPaint(b), true);
});

test('.paint: respeta el orden de canales que declara el archivo', async () => {
  const bytes = Uint8Array.from([10, 20, 30, 40]);
  const f = await C.readPaint(fabricar({ w: 1, h: 1, cw: 1, ch: 1, x: 0, y: 0, orden: [3, 0, 1, 2], canales: [4, 5, 6, 7], bytes }));
  assert.deepEqual(Array.from(f.layers[0].rgba), [20, 30, 40, 10]);
});

test('.paint: capa sin alfa, sin comprimir y zlib', async () => {
  const bytes = Uint8Array.from([1, 2, 3, 4, 5, 6]);
  for (const alg of ['none', 'zlib']) {
    const f = await C.readPaint(fabricar({ w: 2, h: 1, cw: 2, ch: 1, x: 0, y: 0, orden: [0, 1, 2], canales: [4, 5, 6], bytes, alg }));
    assert.deepEqual(Array.from(f.layers[0].rgba), [1, 2, 3, 255, 4, 5, 6, 255]);
  }
});

test('.paint: capa más chica que el lienzo con desplazamiento negativo', async () => {
  const f = await C.readPaint(fabricar({ w: 2, h: 2, cw: 10, ch: 8, x: -1, y: 3, orden: [2, 1, 0, 3], canales: [4, 5, 6, 7], fill: [1, 2, 3, 255] }));
  assert.deepEqual([f.w, f.h], [10, 8]);
  assert.deepEqual([f.layers[0].x, f.layers[0].y, f.layers[0].w, f.layers[0].h], [-1, 3, 2, 2]);
  assert.deepEqual(f.fill, [1, 2, 3, 255]);
});

test('.paint: rechaza formatos no admitidos con un mensaje claro', async () => {
  const base = { w: 1, h: 1, cw: 1, ch: 1, x: 0, y: 0, orden: [2, 1, 0, 3], canales: [4, 5, 6, 7] };
  await assert.rejects(C.readPaint(fabricar({ ...base, canales: [1, 5, 6, 7] })), /píxel/);
  await assert.rejects(C.readPaint(fabricar({ ...base, alg: 'none', bytes: new Uint8Array(4), pixelSize: 9 })), /disposición/);
  await assert.rejects(C.readPaint(txtBytes('esto no es un paint, para nada')), /válido|dañado/);
});
const txtBytes = s => Uint8Array.from(txt(s));

test('.paint: datos que se expanden de más no se aceptan', async () => {
  const malo = fabricar({ w: 1, h: 1, cw: 1, ch: 1, x: 0, y: 0, orden: [2, 1, 0, 3], canales: [4, 5, 6, 7], bytes: new Uint8Array(4000) });
  await assert.rejects(C.readPaint(malo), /descomprimir/);
});

test('.paint: un archivo truncado nunca revienta sin mensaje', async () => {
  const b = await C.writePaint(16, 16, [capa(16, 16, 9)]);
  for (let n = 0; n < b.length; n += 37) {
    await assert.rejects(C.readPaint(b.subarray(0, n)), e => e instanceof Error && e.message.length > 0, 'corte en ' + n);
  }
});
