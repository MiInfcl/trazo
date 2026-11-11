# Trazo

Editor de imágenes para Windows y navegador, con el flujo de trabajo de un Paint moderno y **sin ninguna función de inteligencia artificial**. Todo se procesa en tu equipo: la app no se conecta a internet ni envía tus imágenes a ninguna parte.

Trazo es un proyecto independiente. No está afiliado a Microsoft ni usa su código o sus gráficos.

## Qué hace

- **Dibujo:** lápiz, 9 pinceles, relleno, borrador, selector de color, lupa y texto.
- **23 formas** editables hasta confirmarlas, con contorno y relleno.
- **Selección** rectangular y de forma libre: mover, copiar con Ctrl, escalar, girar, voltear, invertir, selección transparente.
- **Capas** con visibilidad, orden, duplicar y combinar; fondo aparte, que puede ser transparente.
- **Imagen:** recortar, cambiar tamaño, sesgar, girar, voltear, invertir colores y cambiar el lienzo desde sus 8 tiradores.
- Reglas, cuadrícula, miniatura, pantalla completa, tema claro y oscuro.

### SVG de verdad

Abrir un SVG no lo convierte en píxeles: lo que dibujas se guarda como elementos vectoriales encima del original. Un SVG sin tocar se guarda igual que llegó. Los SVG se limpian al abrirlos (sin scripts ni referencias externas). Al guardar eliges entre vectorial, píxeles a vector (ideal para iconos) o imagen incrustada.

### ICO con varias resoluciones

Cada resolución de un icono es una página independiente, con sus propias capas y su propio historial de deshacer. Puedes agregar tamaños, generarlos desde otro, regenerarlos o exportar uno solo. Una imagen vectorial se dibuja nítida en cada tamaño.

## Formatos

| Formato | Abrir | Guardar |
|---|---|---|
| PNG, JPEG, BMP, GIF, WebP | Sí | Sí |
| TIFF | Sin comprimir, PackBits y LZW | Sin comprimir |
| SVG | Sí | Sí |
| ICO | Sí, 1 a 32 bits y PNG | Sí, 32 bits o PNG |
| CUR | Sí | Se guarda como ICO |
| AVIF | Sí | No |
| HEIC | Solo en escritorio, con las Extensiones HEIF de Windows | No |
| `.trazo` (proyecto con capas y vector) | Sí | Sí |

## Usarlo

**En el navegador:** abre el sitio publicado. Funciona mejor en Chrome o Edge, que permiten guardar directamente en tus archivos.

**En Windows:** compila el `.exe` (1 MB; usa el WebView2 que trae Windows 11):

```bash
python escritorio/compilar.py
```

Necesita Python con Pillow y Microsoft Edge para generar el icono. El resultado queda en `entregables/Trazo.exe`.

**Para probarlo en local:**

```bash
python -m http.server 5180 --directory app
```

## Pruebas

```bash
node --test pruebas/
```

## Atajos principales

`Ctrl+N` nuevo · `Ctrl+O` abrir · `Ctrl+S` guardar · `F12` guardar como · `Ctrl+P` imprimir · `Ctrl+Z` / `Ctrl+Y` deshacer y rehacer · `Ctrl+A` seleccionar todo · `Ctrl+X` / `C` / `V` cortar, copiar y pegar · `Ctrl+W` cambiar tamaño · `Ctrl+E` propiedades · `Ctrl+R` reglas · `Ctrl+G` cuadrícula · `Ctrl+RePág` / `AvPág` zoom · `F11` pantalla completa
