'use strict';
/* Trazo · iconos propios (trazo de 1.4 sobre cuadrícula de 20). Sin emojis ni arte ajeno.
 * Clases dentro de los iconos: .f = relleno con el color del texto, .a = relleno de acento. */
(function () {
  const T = window.T;

  function gear() {
    const cx = 10, cy = 10, n = 8, ro = 7.6, ri = 5.9;
    let d = '';
    const step = Math.PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const a = i * step - Math.PI / 2;
      const pts = [[ro, a - step * 0.16], [ro, a + step * 0.16], [ri, a + step * 0.34], [ri, a + step * 0.66]];
      for (const [r, ang] of pts) d += (d ? 'L' : 'M') + (cx + r * Math.cos(ang)).toFixed(2) + ' ' + (cy + r * Math.sin(ang)).toFixed(2);
    }
    return '<path d="' + d + 'Z"/><circle cx="10" cy="10" r="2.4"/>';
  }

  const I = {
    /* genéricos */
    flip: '<path d="M10 2.5v15" stroke-dasharray="2 1.8"/><path d="M7.5 5.8v8.4L3 10z" fill="#4da6ea" stroke="none"/><path d="M12.5 5.8v8.4L17 10z"/>',
    sizeLines: '<path d="M3 4.5h14" stroke-width="1"/><path d="M3 9h14" stroke-width="2"/><path d="M3 14.5h14" stroke-width="3.2"/>',
    penOutline: '<rect x="2.5" y="6.5" width="11" height="11" rx="1.5"/><path d="M9 12.5l.6-2.4 6-6a1.3 1.3 0 0 1 1.9 1.9l-6 6z" fill="#7a7a7a"/>',
    bucketShape: '<rect x="2.5" y="6.5" width="11" height="11" rx="1.5" fill="#7a7a7a"/><path d="M15.5 3s2.2 2.7 2.2 4.3a2.2 2.2 0 0 1-4.4 0c0-1.6 2.2-4.3 2.2-4.3z"/>',
    cursor: '<path d="M5 3l10.5 6.2-4.6 1.2-2 4.6z"/>',
    drop: '<path d="M10 2.5s5.5 6 5.5 9.5a5.5 5.5 0 0 1-11 0C4.5 8.5 10 2.5 10 2.5z"/><path d="M4.6 11.5h10.9a5.5 5.5 0 0 1-10.9 0z" class="f" stroke="none"/>',
    chevDown: '<path d="M5 7.5l5 5 5-5"/>',
    chevUp: '<path d="M5 12.5l5-5 5 5"/>',
    chevRight: '<path d="M7.5 5l5 5-5 5"/>',
    check: '<path d="M4 10.5l4 4 8-9"/>',
    dot: '<circle cx="10" cy="10" r="2.6" class="f" stroke="none"/>',
    close: '<path d="M5 5l10 10M15 5L5 15"/>',
    plus: '<path d="M10 4v12M4 10h12"/>',
    minus: '<path d="M4 10h12"/>',
    more: '<circle cx="4.5" cy="10" r="1.1" class="f" stroke="none"/><circle cx="10" cy="10" r="1.1" class="f" stroke="none"/><circle cx="15.5" cy="10" r="1.1" class="f" stroke="none"/>',
    info: '<circle cx="10" cy="10" r="7.2"/><path d="M10 9v5"/><circle cx="10" cy="6.4" r=".9" class="f" stroke="none"/>',
    warn: '<path d="M10 3l7.5 13.5h-15z"/><path d="M10 8.2v4"/><circle cx="10" cy="14.3" r=".9" class="f" stroke="none"/>',

    /* barra de menús */
    save: '<path d="M4 3.5h9.6l2.9 2.9V16a.5.5 0 0 1-.5.5H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5z"/><path d="M6.5 3.5v3.8h6V3.5"/><path d="M6 16.5V11h8v5.5"/>',
    undo: '<path d="M7.5 4.5L4 8l3.5 3.5"/><path d="M4 8h7.5a4.5 4.5 0 0 1 0 9H8"/>',
    redo: '<path d="M12.5 4.5L16 8l-3.5 3.5"/><path d="M16 8H8.5a4.5 4.5 0 0 0 0 9H12"/>',
    settings: gear(),

    /* archivo */
    newDoc: '<path d="M5 2.5h6.5l4 4V17a.5.5 0 0 1-.5.5H5a.5.5 0 0 1-.5-.5V3a.5.5 0 0 1 .5-.5z"/><path d="M11.5 2.5v4h4"/>',
    open: '<path d="M2.5 5.5a1 1 0 0 1 1-1h4l1.5 2h7.5a1 1 0 0 1 1 1v7.5a1 1 0 0 1-1 1h-13a1 1 0 0 1-1-1z"/>',
    recent: '<circle cx="10" cy="10" r="7"/><path d="M10 6v4.2l2.8 1.8"/>',
    importImg: '<path d="M10 3v9M6.5 8.5L10 12l3.5-3.5"/><path d="M3.5 13v2.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V13"/>',
    saveAs: '<path d="M10 16.5H4a.5.5 0 0 1-.5-.5V4a.5.5 0 0 1 .5-.5h9.6l2.9 2.9V9"/><path d="M6.5 3.5v3.8h6V3.5"/><path d="M12 17.5l.6-2.4 4-4a1.1 1.1 0 0 1 1.6 1.6l-4 4z"/>',
    print: '<path d="M6 7V3.5h8V7"/><rect x="2.5" y="7" width="15" height="7" rx="1.2"/><path d="M6 12h8v4.5H6z"/>',
    share: '<path d="M12 3.5l4.5 4.5-4.5 4.5V10c-4 0-6.5 1.2-8.5 4.5 0-5 3-8.3 8.5-8.5z"/>',
    desktop: '<rect x="2.5" y="3.5" width="15" height="10" rx="1.2"/><path d="M7 17h6M10 13.5V17"/>',
    image: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><circle cx="7" cy="8" r="1.3"/><path d="M3 14.5l4.5-4 3 2.5 3-3.5 4 4.5"/>',
    exit: '<path d="M8 3.5H4.5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1H8"/><path d="M12.5 6.5L16 10l-3.5 3.5M16 10H7.5"/>',
    project: '<path d="M10 3l7.5 4-7.5 4-7.5-4z"/><path d="M3.5 11l6.5 3.5 6.5-3.5"/>',
    iconFile: '<rect x="3" y="3" width="14" height="14" rx="2.5"/><rect x="6" y="6" width="4" height="4" rx=".6"/><rect x="11.2" y="11.2" width="2.8" height="2.8" rx=".5"/><rect x="11.4" y="6.2" width="2" height="2" rx=".4"/>',
    vector: '<path d="M4 15.5C5 8 8 5 15.5 4.5"/><rect x="2.5" y="14" width="3" height="3" rx=".5"/><rect x="14.2" y="3" width="3" height="3" rx=".5"/><path d="M4 9.5V5h4.5"/>',

    /* editar */
    cut: '<circle cx="5.5" cy="14.5" r="2.2"/><circle cx="14.5" cy="14.5" r="2.2"/><path d="M7 12.8L14.5 3M13 12.8L5.5 3"/>',
    copy: '<rect x="7" y="6.5" width="9.5" height="11" rx="1.3"/><path d="M4.5 13.5h-.3a.7.7 0 0 1-.7-.7V3.5a1 1 0 0 1 1-1h7.3a.7.7 0 0 1 .7.7v.8"/>',
    paste: '<rect x="4" y="4" width="12" height="13.5" rx="1.3"/><path d="M7.5 4v-.8a.7.7 0 0 1 .7-.7h3.6a.7.7 0 0 1 .7.7V4a1 1 0 0 1-1 1h-3a1 1 0 0 1-1-1z"/>',
    selectAll: '<rect x="3" y="3" width="14" height="14" rx="1" stroke-dasharray="2.4 2.2"/><rect x="6.5" y="6.5" width="7" height="7" rx=".5"/>',
    invertSel: '<rect x="3" y="3" width="14" height="14" rx="1"/><rect x="7" y="7" width="6" height="6" stroke-dasharray="2 1.8"/>',
    trash: '<path d="M4 5.5h12M8 5.5V4a.8.8 0 0 1 .8-.8h2.4a.8.8 0 0 1 .8.8v1.5M5.5 5.5l.7 10.3a1 1 0 0 0 1 .9h5.6a1 1 0 0 0 1-.9l.7-10.3M8.5 8.5v5M11.5 8.5v5"/>',
    invertColors: '<circle cx="10" cy="10" r="7"/><path d="M10 3a7 7 0 0 1 0 14z" class="f"/>',

    /* ver */
    zoomIn: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.2 12.2L17 17M6.3 8.5h4.4M8.5 6.3v4.4"/>',
    zoomOut: '<circle cx="8.5" cy="8.5" r="5"/><path d="M12.2 12.2L17 17M6.3 8.5h4.4"/>',
    rulers: '<rect x="2.5" y="6.5" width="15" height="7" rx="1"/><path d="M5.5 6.5V9M8.5 6.5v3.5M11.5 6.5V9M14.5 6.5v3.5"/>',
    grid: '<rect x="3" y="3" width="14" height="14" rx="1.5"/><path d="M3 7.7h14M3 12.3h14M7.7 3v14M12.3 3v14"/>',
    statusbar: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><path d="M2.5 13h15"/>',
    fullscreen: '<path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4"/>',
    thumbnail: '<rect x="2.5" y="3.5" width="15" height="13" rx="1.5"/><rect x="10" y="9.5" width="5.5" height="5" rx=".6"/>',
    fit: '<rect x="2.5" y="4" width="15" height="12" rx="1.5"/><path d="M6 10h8M6 10l2-2M6 10l2 2M14 10l-2-2M14 10l-2 2"/>',

    /* selección */
    selRect: '<rect x="2.5" y="3.5" width="15" height="13" rx=".5" stroke-dasharray="2.8 2.2"/>',
    selFree: '<path d="M10 3.5c4 0 7 2.2 7 5.2 0 2.9-2.6 5-6.2 5.3-1 .1-1.6.6-1.8 1.5-.3 1.3-1.6 1.7-2.6 1-1.9-1.3-3.4-4-3.4-7 0-3.6 3-6 7-6z" stroke-dasharray="2.6 2.2"/>',

    /* imagen */
    crop: '<path d="M6 2.5V14h11.5" stroke="#6fc3f5"/><path d="M2.5 6H14v11.5"/>',
    resize: '<rect x="2.5" y="8.5" width="9" height="9" rx="1" stroke="#6fc3f5"/><path d="M8.5 5.5v-2a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1h-2"/><path d="M11 9l4-4M12.2 5H15v2.8"/>',
    rotate: '<rect x="2.5" y="9" width="8.5" height="8.5" rx="1" fill="#4da6ea" stroke="none"/><path d="M8 5.5h4a4 4 0 0 1 4 4v2.3"/><path d="M13.8 9.8l2.2 2.2 2.2-2.2"/>',
    rotR: '<rect x="2.5" y="9" width="8.5" height="8.5" rx="1"/><path d="M8 5.5h4a4 4 0 0 1 4 4v2.3"/><path d="M13.8 9.8l2.2 2.2 2.2-2.2"/>',
    rotL: '<rect x="9" y="9" width="8.5" height="8.5" rx="1"/><path d="M12 5.5H8a4 4 0 0 0-4 4v2.3"/><path d="M1.8 9.8L4 12l2.2-2.2"/>',
    rot180: '<path d="M4 8a6.2 6.2 0 0 1 11.6-1.4"/><path d="M16 3.3v3.4h-3.4"/><path d="M16 12a6.2 6.2 0 0 1-11.6 1.4"/><path d="M4 16.7v-3.4h3.4"/>',
    flipH: '<path d="M10 2.5v15" stroke-dasharray="2 1.8"/><path d="M7.5 6.2v7.6L3 10z"/><path d="M12.5 6.2v7.6L17 10z" class="f"/>',
    flipV: '<path d="M2.5 10h15" stroke-dasharray="2 1.8"/><path d="M6.2 7.5h7.6L10 3z"/><path d="M6.2 12.5h7.6L10 17z" class="f"/>',

    /* herramientas */
    pencil: '<path d="M13.9 3.2l2.9 2.9-9.9 9.9-2.9-2.9z" fill="#f6d77c" stroke="none"/><path d="M13.9 3.2l1-1a1.2 1.2 0 0 1 1.7 0l1.2 1.2a1.2 1.2 0 0 1 0 1.7l-1 1z" fill="#e8983a" stroke="none"/><path d="M4 13.1L6.9 16l-4 1.1z" fill="#f3e6c4" stroke="none"/><path d="M3.3 15.6l-.4 1.5 1.5-.4z" fill="#6b4e1e" stroke="none"/>',
    fill: '<path d="M9.3 3l6.9 6.9-5.6 5.6a1.5 1.5 0 0 1-2.1 0l-4.8-4.8a1.5 1.5 0 0 1 0-2.1z" fill="#4da6ea" stroke="none"/><path d="M3.2 9.6h11.1l1.9.3-5.6 5.6a1.5 1.5 0 0 1-2.1 0L3.7 10.7a1.5 1.5 0 0 1-.5-1.1z" fill="#f2f2f2" stroke="none" opacity=".35"/><path d="M7.3 1.6l3 3" stroke="#d0d0d0"/><path d="M16.7 12.4s1.7 2.2 1.7 3.4a1.7 1.7 0 0 1-3.4 0c0-1.2 1.7-3.4 1.7-3.4z" fill="#f28c38" stroke="none"/>',
    text: '<path d="M4.5 16L10 3.5 15.5 16M6.6 11.5h6.8"/>',
    eraser: '<path d="M9.4 3.4a1.5 1.5 0 0 1 2.1 0l5.1 5.1a1.5 1.5 0 0 1 0 2.1l-3 3L6.4 6.4z" fill="#f3a3b8" stroke="none"/><path d="M6.4 6.4l7.2 7.2-3.3 3.3a1.5 1.5 0 0 1-2.1 0l-5.1-5.1a1.5 1.5 0 0 1 0-2.1z" fill="#f4f4f4" stroke="none"/>',
    picker: '<path d="M11.2 7L4.7 13.5l-.9 2.7 2.7-.9L13 8.8z" fill="#7fdc8c" stroke="none"/><path d="M12.1 4.9l1.6-1.6a2 2 0 0 1 2.8 0l.2.2a2 2 0 0 1 0 2.8l-1.6 1.6 1 1-1.4 1.4-4-4 1.4-1.4z" fill="#3f9fe8" stroke="none"/>',
    magnifier: '<circle cx="8.5" cy="8.5" r="5" stroke="#6fc3f5" stroke-width="1.8"/><path d="M12.4 12.4L17 17" stroke="#d9d9d9" stroke-width="2.2"/>',

    /* pinceles */
    brush: '<path d="M16.8 3.2c-3 1-6.6 4.4-8.3 7.6l1.7 1.7c3.2-1.7 6.6-5.3 7.6-8.3.2-.7-.3-1.2-1-1z" class="a"/><path d="M16.8 3.2c-3 1-6.6 4.4-8.3 7.6l1.7 1.7c3.2-1.7 6.6-5.3 7.6-8.3.2-.7-.3-1.2-1-1z"/><path d="M8.3 11c-2.1-.3-3.7 1-3.8 2.9-.1 1.4-.9 2.3-1.9 2.8 2.8.9 6.7-.2 7.2-3.3"/>',
    calligBrush: '<path d="M15.5 2.5l2 2-7 8.5-3.5-3.5z" class="a"/><path d="M15.5 2.5l2 2-7 8.5-3.5-3.5z"/><path d="M7 9.5l-3 2.5-1.5 5.5L8 16l2.5-3"/>',
    calligPen: '<path d="M10 2.5l4.3 6.8-2.3 5.2H8L5.7 9.3z" class="a"/><path d="M10 2.5l4.3 6.8-2.3 5.2H8L5.7 9.3z"/><path d="M10 9.5v5M7.5 17.5h5"/><circle cx="10" cy="8.3" r="1" />',
    airbrush: '<rect x="4.5" y="8.5" width="7" height="9" rx="1.3" class="a"/><rect x="4.5" y="8.5" width="7" height="9" rx="1.3"/><path d="M6.5 8.5v-2h3v2"/><g stroke-width="1.7"><path d="M13 4.8h.01M15.3 3h.01M15.3 6.3h.01M17.5 4.7h.01M13.2 7.8h.01M17.3 8.2h.01"/></g>',
    oil: '<path d="M6.5 8.5h7v3h-7z" class="a"/><path d="M8.5 2.5h3v6h-3z"/><path d="M6.5 8.5h7v3h-7z"/><path d="M6.5 11.5c0 3 .5 4.5 1 6h5c.5-1.5 1-3 1-6"/><path d="M9 13.5v4M11 13.5v4"/>',
    crayon: '<g transform="rotate(45 10 10)"><rect x="7.2" y="1" width="5.6" height="11.5" rx="1" class="a"/><rect x="7.2" y="1" width="5.6" height="11.5" rx="1"/><path d="M7.7 12.5l2.3 5.5 2.3-5.5M7.2 5h5.6"/></g>',
    marker: '<g transform="rotate(45 10 10)"><rect x="7" y="1" width="6" height="9.5" rx="1.2" class="a"/><rect x="7" y="1" width="6" height="9.5" rx="1.2"/><path d="M8 10.5h4v2.5l-1 4.5H9L8 13z"/></g>',
    natPencil: '<g transform="rotate(45 10 10)"><path d="M8.2 1.5h3.6v11L10 18l-1.8-5.5z" class="a"/><path d="M8.2 1.5h3.6v11L10 18l-1.8-5.5z"/><path d="M8.2 12.5h3.6M8.2 4h3.6"/></g>',
    watercolor: '<g transform="rotate(45 10 10)"><path d="M10 8c2.2 0 3 2 3 4 0 2.5-1.5 4-3 6.5-1.5-2.5-3-4-3-6.5 0-2 .8-4 3-4z" class="a"/><path d="M9 1h2v7H9z"/><path d="M10 8c2.2 0 3 2 3 4 0 2.5-1.5 4-3 6.5-1.5-2.5-3-4-3-6.5 0-2 .8-4 3-4z"/></g>',

    /* formas: contorno y relleno */
    outline: '<rect x="3.5" y="3.5" width="13" height="13" rx="2" stroke-width="2"/>',
    shapeFill: '<rect x="3.5" y="3.5" width="13" height="13" rx="2" class="f"/>',
    none: '<circle cx="10" cy="10" r="6.5"/><path d="M5.4 14.6l9.2-9.2"/>',
    shapes: '<rect x="2.5" y="2.5" width="8" height="8" rx="1"/><circle cx="13.2" cy="13.2" r="4.3"/>',

    /* capas */
    layers: '<path d="M10 2.8l7.5 4-7.5 4-7.5-4z"/><path d="M3.5 10.5L10 14l6.5-3.5"/><path d="M3.5 13.7L10 17.2l6.5-3.5"/>',
    eye: '<path d="M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10z"/><circle cx="10" cy="10" r="2.5"/>',
    eyeOff: '<path d="M3 3l14 14"/><path d="M8.2 4.8A8 8 0 0 1 10 4.5c5 0 8 5.5 8 5.5a13.7 13.7 0 0 1-2.3 2.9M12.9 14.9a7.5 7.5 0 0 1-2.9.6c-5 0-8-5.5-8-5.5a13.5 13.5 0 0 1 3.2-3.7"/><path d="M8.2 8.3a2.5 2.5 0 0 0 3.5 3.5"/>',
    mergeDown: '<path d="M10 2.5v8M6.5 7L10 10.5 13.5 7"/><path d="M3.5 14h13M3.5 17h13"/>',
    arrowUp: '<path d="M10 16V4M5.5 8.5L10 4l4.5 4.5"/>',
    arrowDown: '<path d="M10 4v12M5.5 11.5L10 16l4.5-4.5"/>',
    regen: '<path d="M15.5 8A6 6 0 0 0 4.6 7"/><path d="M4.5 3.5V7H8"/><path d="M4.5 12a6 6 0 0 0 10.9 1"/><path d="M15.5 16.5V13H12"/>',

    /* barra de estado */
    pos: '<path d="M10 2.5v15M2.5 10h15"/><path d="M8 4.5l2-2 2 2M8 15.5l2 2 2-2M4.5 8l-2 2 2 2M15.5 8l2 2-2 2"/>',
    canvasSize: '<rect x="3" y="4" width="14" height="12" rx="1.2"/><path d="M11 8.5h3v3M14 8.5L9.5 13"/>',

    /* texto */
    alignL: '<path d="M3 5h14M3 9h9M3 13h14M3 17h9"/>',
    alignC: '<path d="M3 5h14M5.5 9h9M3 13h14M5.5 17h9"/>',
    alignR: '<path d="M3 5h14M8 9h9M3 13h14M8 17h9"/>',
    textBg: '<rect x="3" y="3" width="14" height="14" rx="2" class="a"/><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M7 14l3-8 3 8M8.1 11.3h3.8"/>',

    /* tamaño y opacidad */
    sizeBig: '<circle cx="10" cy="10" r="6" class="f" stroke="none"/>',
    sizeSmall: '<circle cx="10" cy="10" r="2" class="f" stroke="none"/>',
    opacity: '<path d="M10 2.5s5.5 6 5.5 9.5a5.5 5.5 0 0 1-11 0C4.5 8.5 10 2.5 10 2.5z"/><path d="M10 6.5v11a5.5 5.5 0 0 0 5.5-5.5c0-1.8-2.2-4-5.5-5.5z" class="f" stroke="none"/>'
  };

  /* Devuelve el marcado de un icono. */
  T.icon = function (name, size, extraClass) {
    const s = size || 20;
    const body = I[name];
    if (!body) return '';
    return '<svg class="ic' + (extraClass ? ' ' + extraClass : '') + '" viewBox="0 0 20 20" width="' + s + '" height="' + s +
      '" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + body + '</svg>';
  };
  T.iconEl = function (name, size, extraClass) {
    const span = document.createElement('span');
    span.className = 'ic-wrap';
    span.innerHTML = T.icon(name, size, extraClass);
    return span.firstChild;
  };
  T.icons = I;
})();
