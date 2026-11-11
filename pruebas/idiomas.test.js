'use strict';
/* Cada texto visible del código debe tener traducción (o ser igual en todos los idiomas). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const dir = path.join(__dirname, '..', 'app', 'js');
globalThis.window = { T: {} };
const idiomaSistema = v => Object.defineProperty(globalThis, 'navigator', { value: { languages: [v] }, configurable: true });
idiomaSistema('es-CL');
require(path.join(dir, 'i18n.js'));
const T = globalThis.window.T, I = T.i18n;

const SIN_TRADUCIR = new Set(['PNG', 'JPEG', 'BMP', 'GIF', 'TIFF', 'WebP', 'SVG', 'Trazo']);

function textosVisibles() {
  const out = new Set();
  const re = /(?:\b(?:label|text|tip|head|title|body)|'aria-label'):\s*'((?:[^'\\\n]|\\.)*)'/g;
  for (const f of fs.readdirSync(dir)) {
    if (f === 'i18n.js' || f === 'icons.js') continue;
    const s = fs.readFileSync(path.join(dir, f), 'utf8');
    for (const m of s.matchAll(re)) out.add(m[1]);
    for (const m of s.matchAll(/(?:group|mb|UI\.field|UI\.toast|UI\.alert|new Error|Error)\(\s*'((?:[^'\\\n]|\\.)*)'/g)) out.add(m[1]);
  }
  return [...out].filter(t => t.length > 1 && /[a-záéíóúñ]/i.test(t));
}

function comprobar(lang) {
  I.lang = lang;
  const faltan = textosVisibles().filter(t => !SIN_TRADUCIR.has(t) && !/ $|^ /.test(t) && !I.D[t] && T.tr(t) === t);
  assert.deepEqual(faltan, []);
}

test('idiomas: inglés cubre los textos visibles', () => comprobar('en'));
test('idiomas: portugués cubre los textos visibles', () => comprobar('pt'));

test('idiomas: cada entrada tiene todos los idiomas', () => {
  for (const k in I.D) {
    assert.equal(I.D[k].length, 2, k);
    assert.ok(I.D[k].every(v => typeof v === 'string' && v), k);
  }
});

test('idiomas: textos con datos variables', () => {
  I.lang = 'en';
  assert.equal(T.tr('1152 × 648 píxeles'), '1152 × 648 pixels');
  assert.equal(T.tr('¿Quieres guardar los cambios de foto.png?'), 'Do you want to save changes to foto.png?');
  assert.equal(T.tr('PNG (esta resolución)'), 'PNG (this resolution)');
  assert.equal(T.tr('Pinceles: opciones'), 'Brushes: options');
  I.lang = 'pt';
  assert.equal(T.tr('Color 1 (botón izquierdo)'), 'Cor 1 (botão esquerdo)');
  I.lang = 'es';
  assert.equal(T.tr('Archivo'), 'Archivo');
});

test('idiomas: el sistema decide y los desconocidos van a inglés', () => {
  idiomaSistema('fr-FR');
  assert.equal(I.system(), 'en');
  idiomaSistema('pt-BR');
  assert.equal(I.system(), 'pt');
  idiomaSistema('es-419');
  assert.equal(I.system(), 'es');
});
