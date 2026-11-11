'use strict';
/* Trazo · idiomas. El código está escrito en español; aquí está cada texto en los otros idiomas.
 * Formato: 'texto en español': ['English', 'Português']. Lo que no aparece se muestra tal cual. */
(function () {
  const T = window.T;
  const IDX = { en: 0, pt: 1 };
  const D = {
    /* Barra de menús */
    'Archivo': ['File', 'Arquivo'], 'Editar': ['Edit', 'Editar'], 'Ver': ['View', 'Exibir'],
    'Nuevo': ['New', 'Novo'], 'Nuevo icono con varias resoluciones…': ['New multi-resolution icon…', 'Novo ícone com várias resoluções…'],
    'Abrir': ['Open', 'Abrir'], 'Recientes': ['Recent', 'Recentes'], 'No hay archivos recientes': ['No recent files', 'Nenhum arquivo recente'],
    'Importar al lienzo': ['Import to canvas', 'Importar para a tela'], 'Guardar': ['Save', 'Salvar'], 'Guardar como': ['Save as', 'Salvar como'],
    'Imprimir': ['Print', 'Imprimir'], 'Establecer como fondo de escritorio': ['Set as desktop background', 'Definir como tela de fundo'],
    'Rellenar': ['Fill', 'Preencher'], 'Mosaico': ['Tile', 'Lado a lado'], 'Centrar': ['Center', 'Centralizar'],
    'Propiedades de imagen': ['Image properties', 'Propriedades da imagem'], 'Acerca de Trazo': ['About Trazo', 'Sobre o Trazo'], 'Salir': ['Exit', 'Sair'],
    'SVG (vectorial)': ['SVG (vector)', 'SVG (vetorial)'], 'ICO (todas las resoluciones)': ['ICO (all resolutions)', 'ICO (todas as resoluções)'],
    'ICO (generar varias resoluciones)': ['ICO (generate several resolutions)', 'ICO (gerar várias resoluções)'],
    'Proyecto de Paint (.paint)': ['Paint project (.paint)', 'Projeto do Paint (.paint)'],
    'Proyecto de Trazo (conserva capas y vector)': ['Trazo project (keeps layers and vector)', 'Projeto do Trazo (mantém camadas e vetor)'],
    'Deshacer': ['Undo', 'Desfazer'], 'Rehacer': ['Redo', 'Refazer'], 'Cortar': ['Cut', 'Recortar'], 'Copiar': ['Copy', 'Copiar'], 'Pegar': ['Paste', 'Colar'],
    'Seleccionar todo': ['Select all', 'Selecionar tudo'], 'Invertir selección': ['Invert selection', 'Inverter seleção'], 'Eliminar': ['Delete', 'Excluir'],
    'Invertir colores': ['Invert colors', 'Inverter cores'], 'Acercar': ['Zoom in', 'Ampliar'], 'Alejar': ['Zoom out', 'Reduzir'],
    'Ajustar a la ventana': ['Fit to window', 'Ajustar à janela'], 'Reglas': ['Rulers', 'Réguas'], 'Cuadrícula': ['Gridlines', 'Linhas de grade'],
    'Barra de estado': ['Status bar', 'Barra de status'], 'Cinta': ['Ribbon', 'Faixa de opções'], 'Miniatura': ['Thumbnail', 'Miniatura'], 'Pantalla completa': ['Full screen', 'Tela inteira'],
    'Configuración': ['Settings', 'Configurações'], 'Mostrar la cinta': ['Show the ribbon', 'Mostrar a faixa de opções'], 'Ocultar la cinta': ['Hide the ribbon', 'Ocultar a faixa de opções'],

    /* Teclas */
    'Supr': ['Del', 'Del'], 'Ctrl+Mayús+O': ['Ctrl+Shift+O', 'Ctrl+Shift+O'], 'Ctrl+Mayús+X': ['Ctrl+Shift+X', 'Ctrl+Shift+X'], 'Ctrl+Mayús+I': ['Ctrl+Shift+I', 'Ctrl+Shift+I'],
    'Ctrl+RePág': ['Ctrl+PgUp', 'Ctrl+PgUp'], 'Ctrl+AvPág': ['Ctrl+PgDn', 'Ctrl+PgDn'], 'Mayús+F11': ['Shift+F11', 'Shift+F11'],
    'Ver solo la imagen': ['View image only', 'Ver só a imagem'], 'No se pudo activar la pantalla completa.': ['Could not turn on full screen.', 'Não foi possível ativar a tela inteira.'],
    'F11: pantalla completa normal': ['F11: regular full screen', 'F11: tela inteira normal'],
    'Mayús+F11: solo la imagen, como en Paint.': ['Shift+F11: image only, like Paint.', 'Shift+F11: só a imagem, como no Paint.'],
    'F11: solo la imagen, como en Paint': ['F11: image only, like Paint', 'F11: só a imagem, como no Paint'],
    'Mayús+F11: pantalla completa normal.': ['Shift+F11: regular full screen.', 'Shift+F11: tela inteira normal.'],

    /* Cinta */
    'Selección': ['Selection', 'Seleção'], 'Imagen': ['Image', 'Imagem'], 'Herramientas': ['Tools', 'Ferramentas'], 'Pinceles': ['Brushes', 'Pincéis'],
    'Formas': ['Shapes', 'Formas'], 'Colores': ['Colors', 'Cores'], 'Capas': ['Layers', 'Camadas'],
    'Seleccionar': ['Select', 'Selecionar'], 'Rectángulo': ['Rectangle', 'Retângulo'], 'Forma libre': ['Free-form', 'Forma livre'], 'Selección transparente': ['Transparent selection', 'Seleção transparente'],
    'Recortar a la selección': ['Crop to selection', 'Cortar para a seleção'], 'Cambiar tamaño y sesgar': ['Resize and skew', 'Redimensionar e inclinar'],
    'Girar': ['Rotate', 'Girar'], 'Voltear': ['Flip', 'Inverter'], 'Girar 90° a la derecha': ['Rotate right 90°', 'Girar 90° à direita'], 'Girar 90° a la izquierda': ['Rotate left 90°', 'Girar 90° à esquerda'],
    'Girar 180°': ['Rotate 180°', 'Girar 180°'], 'Voltear horizontalmente': ['Flip horizontal', 'Inverter na horizontal'], 'Voltear verticalmente': ['Flip vertical', 'Inverter na vertical'],
    'Lápiz': ['Pencil', 'Lápis'], 'Relleno con color': ['Fill with color', 'Preencher com cor'], 'Texto': ['Text', 'Texto'], 'Borrador': ['Eraser', 'Borracha'], 'Selector de color': ['Color picker', 'Seletor de cor'], 'Lupa': ['Magnifier', 'Lupa'],
    'Pincel': ['Brush', 'Pincel'], 'Pincel caligráfico': ['Calligraphy brush', 'Pincel caligráfico'], 'Pluma caligráfica': ['Calligraphy pen', 'Caneta caligráfica'], 'Aerógrafo': ['Airbrush', 'Aerógrafo'],
    'Pincel para óleo': ['Oil brush', 'Pincel a óleo'], 'Crayón': ['Crayon', 'Giz de cera'], 'Marcador': ['Marker', 'Marcador'], 'Lápiz natural': ['Natural pencil', 'Lápis natural'], 'Pincel para acuarela': ['Watercolor brush', 'Pincel de aquarela'],
    'Contorno': ['Outline', 'Contorno'], 'Relleno': ['Fill', 'Preenchimento'], 'Sin contorno': ['No outline', 'Sem contorno'], 'Sin relleno': ['No fill', 'Sem preenchimento'],
    'Color sólido': ['Solid color', 'Cor sólida'], 'Óleo': ['Oil', 'Óleo'], 'Acuarela': ['Watercolor', 'Aquarela'], 'Tamaño': ['Size', 'Tamanho'], 'Sin color': ['No color', 'Sem cor'],
    'Editar colores': ['Edit colors', 'Editar cores'], 'Editar colores…': ['Edit colors…', 'Editar cores…'], 'Paleta': ['Palette', 'Paleta'],

    /* Formas */
    'Línea': ['Line', 'Linha'], 'Curva': ['Curve', 'Curva'], 'Óvalo': ['Oval', 'Oval'], 'Rectángulo redondeado': ['Rounded rectangle', 'Retângulo arredondado'], 'Polígono': ['Polygon', 'Polígono'],
    'Triángulo': ['Triangle', 'Triângulo'], 'Triángulo rectángulo': ['Right triangle', 'Triângulo retângulo'], 'Rombo': ['Diamond', 'Losango'], 'Pentágono': ['Pentagon', 'Pentágono'], 'Hexágono': ['Hexagon', 'Hexágono'],
    'Flecha a la derecha': ['Right arrow', 'Seta para a direita'], 'Flecha a la izquierda': ['Left arrow', 'Seta para a esquerda'], 'Flecha arriba': ['Up arrow', 'Seta para cima'], 'Flecha abajo': ['Down arrow', 'Seta para baixo'],
    'Estrella de cuatro puntas': ['Four-point star', 'Estrela de quatro pontas'], 'Estrella de cinco puntas': ['Five-point star', 'Estrela de cinco pontas'], 'Estrella de seis puntas': ['Six-point star', 'Estrela de seis pontas'],
    'Llamada rectangular redondeada': ['Rounded rectangular callout', 'Balão retangular arredondado'], 'Llamada ovalada': ['Oval callout', 'Balão oval'], 'Llamada de nube': ['Cloud callout', 'Balão de nuvem'], 'Corazón': ['Heart', 'Coração'], 'Rayo': ['Lightning', 'Raio'],

    /* Texto */
    'N': ['B', 'N'], 'K': ['I', 'I'], 'S': ['U', 'S'], 'T': ['S', 'T'],
    'Negrita': ['Bold', 'Negrito'], 'Cursiva': ['Italic', 'Itálico'], 'Subrayado': ['Underline', 'Sublinhado'], 'Tachado': ['Strikethrough', 'Tachado'],
    'Alinear a la izquierda': ['Align left', 'Alinhar à esquerda'], 'Alinear a la derecha': ['Align right', 'Alinhar à direita'], 'Relleno de fondo (usa el color 2)': ['Background fill (uses color 2)', 'Preenchimento de fundo (usa a cor 2)'],

    /* Paneles y barra de estado */
    'Capa': ['Layer', 'Camada'], ' (copia)': [' (copy)', ' (cópia)'], 'Agregar capa': ['Add layer', 'Adicionar camada'], 'Cerrar panel': ['Close panel', 'Fechar painel'],
    'Duplicar capa': ['Duplicate layer', 'Duplicar camada'], 'Combinar hacia abajo': ['Merge down', 'Mesclar para baixo'], 'Subir': ['Move up', 'Mover para cima'], 'Bajar': ['Move down', 'Mover para baixo'],
    'Cambiar nombre': ['Rename', 'Renomear'], 'Eliminar capa': ['Delete layer', 'Excluir camada'], 'Mostrar capa': ['Show layer', 'Mostrar camada'], 'Ocultar capa': ['Hide layer', 'Ocultar camada'],
    'Fondo': ['Background', 'Plano de fundo'], 'Mostrar fondo': ['Show background', 'Mostrar plano de fundo'], 'Ocultar fondo': ['Hide background', 'Ocultar plano de fundo'], 'Fondo: clic para cambiar su color': ['Background: click to change its color', 'Plano de fundo: clique para mudar a cor'],
    'Resoluciones': ['Resolutions', 'Resoluções'], 'Agregar resolución': ['Add resolution', 'Adicionar resolução'], 'Cada resolución se edita por separado, con sus capas y su historial.': ['Each resolution is edited separately, with its own layers and history.', 'Cada resolução é editada separadamente, com suas camadas e seu histórico.'],
    'Regenerar desde otra resolución': ['Regenerate from another resolution', 'Regenerar a partir de outra resolução'], 'Duplicar': ['Duplicate', 'Duplicar'], 'Exportar como PNG': ['Export as PNG', 'Exportar como PNG'], 'Nivel de zoom': ['Zoom level', 'Nível de zoom'],

    /* Diálogos */
    'Aceptar': ['OK', 'OK'], 'Cancelar': ['Cancel', 'Cancelar'], 'Crear': ['Create', 'Criar'], 'Cerrar': ['Close', 'Fechar'], 'Agregar': ['Add', 'Adicionar'],
    'Nueva imagen': ['New image', 'Nova imagem'], 'Ancho (px)': ['Width (px)', 'Largura (px)'], 'Alto (px)': ['Height (px)', 'Altura (px)'], 'Fondo blanco': ['White background', 'Fundo branco'], 'Fondo transparente': ['Transparent background', 'Fundo transparente'],
    'Nuevo icono': ['New icon', 'Novo ícone'], 'Elige las resoluciones del icono. Cada una se dibuja por separado; después puedes agregar más.': ['Choose the icon resolutions. Each one is drawn separately; you can add more later.', 'Escolha as resoluções do ícone. Cada uma é desenhada separadamente; depois você pode adicionar mais.'],
    'Cambiar tamaño': ['Resize', 'Redimensionar'], 'Porcentaje': ['Percentage', 'Porcentagem'], 'Píxeles': ['Pixels', 'Pixels'], 'Horizontal': ['Horizontal', 'Horizontal'], 'Vertical': ['Vertical', 'Vertical'],
    'Mantener relación de aspecto': ['Maintain aspect ratio', 'Manter proporção'], 'Sesgar (grados)': ['Skew (degrees)', 'Inclinar (graus)'], 'El sesgo se aplica a toda la imagen: quita la selección para usarlo.': ['Skew applies to the whole image: clear the selection to use it.', 'A inclinação se aplica à imagem inteira: remova a seleção para usá-la.'],
    'Pulgadas': ['Inches', 'Polegadas'], 'Centímetros': ['Centimeters', 'Centímetros'], 'Ancho': ['Width', 'Largura'], 'Alto': ['Height', 'Altura'], 'Unidades': ['Units', 'Unidades'], 'Tamaño de imagen': ['Image size', 'Tamanho da imagem'],
    'Última vez guardado': ['Last saved', 'Salvo pela última vez'], 'Tamaño en disco': ['Size on disk', 'Tamanho em disco'], 'Resolución': ['Resolution', 'Resolução'], 'No disponible': ['Not available', 'Não disponível'],
    'Tema de la aplicación': ['App theme', 'Tema do aplicativo'], 'Claro': ['Light', 'Claro'], 'Oscuro': ['Dark', 'Escuro'], 'Usar la configuración del sistema': ['Use system setting', 'Usar a configuração do sistema'],
    'Idioma': ['Language', 'Idioma'], 'Usar el idioma del sistema': ['Use system language', 'Usar o idioma do sistema'],
    'Editor de imágenes de escritorio inspirado en el flujo de trabajo de Paint, sin funciones de inteligencia artificial.': ['Desktop image editor inspired by the Paint workflow, with no artificial intelligence features.', 'Editor de imagens inspirado no fluxo de trabalho do Paint, sem recursos de inteligência artificial.'],
    'Trabaja con SVG como vector y con iconos ICO de varias resoluciones editables por separado.': ['Works with SVG as vector and with ICO icons whose resolutions are edited separately.', 'Trabalha com SVG como vetor e com ícones ICO de várias resoluções editáveis separadamente.'],
    'Todo se procesa en tu equipo: la aplicación no se conecta a internet.': ['Everything is processed on your computer: the app does not connect to the internet.', 'Tudo é processado no seu computador: o aplicativo não se conecta à internet.'],
    'Cambiar nombre de la capa': ['Rename layer', 'Renomear camada'], 'Guardar como SVG': ['Save as SVG', 'Salvar como SVG'], 'Guardar como ICO': ['Save as ICO', 'Salvar como ICO'],
    'Todo lo dibujado se puede guardar como vector.': ['Everything drawn can be saved as vector.', 'Tudo o que foi desenhado pode ser salvo como vetor.'], 'Esta imagen contiene partes de mapa de bits (fotos o pinceles con textura).': ['This image contains bitmap parts (photos or textured brushes).', 'Esta imagem contém partes em bitmap (fotos ou pincéis com textura).'],
    'Vectorial': ['Vector', 'Vetorial'], 'Trazos, formas y texto como elementos SVG editables.': ['Strokes, shapes and text as editable SVG elements.', 'Traços, formas e texto como elementos SVG editáveis.'], 'Lo dibujado queda como vector; los mapas de bits se incrustan tal cual.': ['Drawings stay as vector; bitmaps are embedded as they are.', 'O desenho fica como vetor; os bitmaps são incorporados como estão.'],
    'Píxeles a vector': ['Pixels to vector', 'Pixels para vetor'], 'Cada color se convierte en una ruta. Ideal para iconos y pixel art.': ['Each color becomes a path. Ideal for icons and pixel art.', 'Cada cor vira um caminho. Ideal para ícones e pixel art.'],
    'Imagen incrustada': ['Embedded image', 'Imagem incorporada'], 'Un único PNG dentro del SVG.': ['A single PNG inside the SVG.', 'Um único PNG dentro do SVG.'],
    'Capas ocultas': ['Hidden layers', 'Camadas ocultas'], 'Este proyecto tiene capas ocultas y el formato .paint no guarda esa información. ¿Qué quieres hacer con ellas?': ['This project has hidden layers and the .paint format does not store that information. What do you want to do with them?', 'Este projeto tem camadas ocultas e o formato .paint não guarda essa informação. O que você quer fazer com elas?'],
    'Omitirlas': ['Leave them out', 'Omitir'], 'Incluirlas visibles': ['Include them as visible', 'Incluir visíveis'],
    'Formato interno del icono': ['Internal icon format', 'Formato interno do ícone'], 'Automático': ['Automatic', 'Automático'], 'PNG en 256 × 256 y mapa de bits en las demás: máxima compatibilidad.': ['PNG at 256 × 256 and bitmap for the rest: maximum compatibility.', 'PNG em 256 × 256 e bitmap nas demais: compatibilidade máxima.'],
    'Todo en PNG': ['All PNG', 'Tudo em PNG'], 'Archivo más pequeño. Requiere Windows Vista o posterior.': ['Smaller file. Requires Windows Vista or later.', 'Arquivo menor. Requer Windows Vista ou posterior.'], 'Todo en mapa de bits': ['All bitmap', 'Tudo em bitmap'], 'El formato clásico, sin comprimir.': ['The classic uncompressed format.', 'O formato clássico, sem compressão.'],
    'Tamaño personalizado': ['Custom size', 'Tamanho personalizado'], 'Contenido': ['Content', 'Conteúdo'], 'En blanco': ['Blank', 'Em branco'], 'Generar a partir de': ['Generate from', 'Gerar a partir de'],
    'Eliminar resolución': ['Delete resolution', 'Excluir resolução'], 'Colores básicos': ['Basic colors', 'Cores básicas'], 'Hexadecimal': ['Hex', 'Hexadecimal'], 'Rojo': ['Red', 'Vermelho'], 'Verde': ['Green', 'Verde'], 'Azul': ['Blue', 'Azul'], 'Matiz': ['Hue', 'Matiz'], 'Sat. %': ['Sat. %', 'Sat. %'], 'Valor %': ['Value %', 'Valor %'],
    'No guardar': ["Don't save", 'Não salvar'], 'Ampliar': ['Enlarge', 'Ampliar'], 'No ampliar': ["Don't enlarge", 'Não ampliar'], 'La imagen es mayor que el lienzo': ['The image is larger than the canvas', 'A imagem é maior que a tela'], '¿Quieres ampliar el lienzo para que quepa la imagen pegada?': ['Do you want to enlarge the canvas to fit the pasted image?', 'Deseja ampliar a tela para caber a imagem colada?'],

    /* Avisos */
    'Guardado': ['Saved', 'Salvo'], 'Sin título': ['Untitled', 'Sem título'], 'Suelta el archivo para abrirlo': ['Drop the file to open it', 'Solte o arquivo para abri-lo'], 'Primero haz una selección para recortar.': ['Make a selection first to crop.', 'Faça uma seleção primeiro para cortar.'],
    'El portapapeles no contiene una imagen.': ['The clipboard does not contain an image.', 'A área de transferência não contém uma imagem.'], 'Fondo de escritorio actualizado': ['Desktop background updated', 'Tela de fundo atualizada'],
    'No se pudo abrir el archivo': ['The file could not be opened', 'Não foi possível abrir o arquivo'], 'No se pudo guardar': ['Could not save', 'Não foi possível salvar'], 'No se pudo importar el archivo': ['The file could not be imported', 'Não foi possível importar o arquivo'], 'No se pudo pegar': ['Could not paste', 'Não foi possível colar'], 'No se pudo establecer el fondo': ['Could not set the background', 'Não foi possível definir a tela de fundo'], 'No se puede guardar el icono': ['The icon cannot be saved', 'Não é possível salvar o ícone'],
    'La imagen tiene demasiados colores para convertir los píxeles a vector. Elige «Vectorial» o «Imagen incrustada».': ['The image has too many colors to convert pixels to vector. Choose “Vector” or “Embedded image”.', 'A imagem tem cores demais para converter pixels em vetor. Escolha “Vetorial” ou “Imagem incorporada”.'],
    'El navegador no sabe leer HEIC. Ábrelo en la versión de escritorio de Trazo, o conviértelo antes a JPEG o PNG.': ['Browsers cannot read HEIC. Open it in the desktop version of Trazo, or convert it to JPEG or PNG first.', 'O navegador não lê HEIC. Abra na versão para computador do Trazo ou converta antes para JPEG ou PNG.'],

    /* Tipos de archivo */
    'Todos los archivos de imagen': ['All image files', 'Todos os arquivos de imagem'], 'Iconos': ['Icons', 'Ícones'], 'Icono': ['Icon', 'Ícone'], 'Mapa de bits': ['Bitmap', 'Bitmap'], 'Proyecto de Paint': ['Paint project', 'Projeto do Paint'], 'Proyecto de Trazo': ['Trazo project', 'Projeto do Trazo'],

    /* Errores de archivo */
    'El archivo es demasiado corto para ser un icono.': ['The file is too short to be an icon.', 'O arquivo é curto demais para ser um ícone.'], 'No es un archivo ICO válido.': ['This is not a valid ICO file.', 'Não é um arquivo ICO válido.'], 'El icono no contiene imágenes legibles.': ['The icon contains no readable images.', 'O ícone não contém imagens legíveis.'], 'El icono necesita al menos una imagen.': ['The icon needs at least one image.', 'O ícone precisa de pelo menos uma imagem.'],
    'No es un archivo TIFF válido.': ['This is not a valid TIFF file.', 'Não é um arquivo TIFF válido.'], 'Compresión TIFF no admitida.': ['Unsupported TIFF compression.', 'Compressão TIFF não suportada.'], 'TIFF por mosaicos no admitido.': ['Tiled TIFF is not supported.', 'TIFF em blocos não suportado.'], 'TIFF con planos separados no admitido.': ['TIFF with separate planes is not supported.', 'TIFF com planos separados não suportado.'], 'Espacio de color TIFF no admitido.': ['Unsupported TIFF color space.', 'Espaço de cor TIFF não suportado.'],
    'El archivo no es un SVG válido.': ['The file is not a valid SVG.', 'O arquivo não é um SVG válido.'], 'No es un proyecto de Trazo.': ['This is not a Trazo project.', 'Não é um projeto do Trazo.'], 'El proyecto está dañado.': ['The project is damaged.', 'O projeto está danificado.'], 'Proyecto dañado.': ['Damaged project.', 'Projeto danificado.'], 'El proyecto no tiene páginas.': ['The project has no pages.', 'O projeto não tem páginas.'], 'El proyecto contiene marcado no permitido.': ['The project contains disallowed markup.', 'O projeto contém marcação não permitida.'],
    'No es un proyecto .paint válido.': ['This is not a valid .paint project.', 'Não é um projeto .paint válido.'], 'El archivo .paint está dañado.': ['The .paint file is damaged.', 'O arquivo .paint está danificado.'], 'El archivo .paint está dañado o incompleto.': ['The .paint file is damaged or incomplete.', 'O arquivo .paint está danificado ou incompleto.'], 'El proyecto .paint no tiene capas.': ['The .paint project has no layers.', 'O projeto .paint não tem camadas.'],
    'Este archivo HEIF no es un proyecto de Paint.': ['This HEIF file is not a Paint project.', 'Este arquivo HEIF não é um projeto do Paint.'], 'El proyecto .paint contiene capas de un tipo no admitido.': ['The .paint project contains an unsupported layer type.', 'O projeto .paint contém um tipo de camada não suportado.'], 'El .paint usa un formato de píxel no admitido.': ['The .paint file uses an unsupported pixel format.', 'O .paint usa um formato de pixel não suportado.'], 'El .paint usa una disposición de píxeles no admitida.': ['The .paint file uses an unsupported pixel layout.', 'O .paint usa uma disposição de pixels não suportada.'], 'El .paint usa una compresión por partes no admitida.': ['The .paint file uses unsupported partial compression.', 'O .paint usa uma compressão por partes não suportada.'],
    'El archivo .paint usa tamaños no admitidos.': ['The .paint file uses unsupported field sizes.', 'O arquivo .paint usa tamanhos não suportados.'], 'El archivo .paint usa una ubicación de datos no admitida.': ['The .paint file uses an unsupported data location.', 'O arquivo .paint usa um local de dados não suportado.'], 'Una capa del .paint no declara su formato.': ['A layer in the .paint file does not declare its format.', 'Uma camada do .paint não declara seu formato.'], 'Una capa del .paint no declara sus canales.': ['A layer in the .paint file does not declare its channels.', 'Uma camada do .paint não declara seus canais.'], 'Una capa del .paint tiene dimensiones no admitidas.': ['A layer in the .paint file has unsupported dimensions.', 'Uma camada do .paint tem dimensões não suportadas.'], 'El lienzo del .paint tiene dimensiones no admitidas.': ['The .paint canvas has unsupported dimensions.', 'A tela do .paint tem dimensões não suportadas.'],
    'cabecera de mapa de bits no admitida': ['unsupported bitmap header', 'cabeçalho de bitmap não suportado'], 'dimensiones no válidas': ['invalid dimensions', 'dimensões inválidas'], 'compresión no admitida': ['unsupported compression', 'compressão não suportada'], 'profundidad de color no admitida': ['unsupported color depth', 'profundidade de cor não suportada'], 'altura no válida': ['invalid height', 'altura inválida'], 'datos de imagen incompletos': ['incomplete image data', 'dados de imagem incompletos'], 'datos LZW no válidos': ['invalid LZW data', 'dados LZW inválidos'],
    'una capa tiene más datos de los declarados': ['a layer has more data than declared', 'uma camada tem mais dados do que o declarado'], 'una capa tiene menos datos de los declarados': ['a layer has less data than declared', 'uma camada tem menos dados do que o declarado'],
    'No se pudo codificar la imagen': ['The image could not be encoded', 'Não foi possível codificar a imagem'], 'No se pudo leer la imagen': ['The image could not be read', 'Não foi possível ler a imagem'],
    'El proyecto necesita al menos una capa.': ['The project needs at least one layer.', 'O projeto precisa de pelo menos uma camada.'], 'El lienzo es demasiado grande para un archivo .paint.': ['The canvas is too large for a .paint file.', 'A tela é grande demais para um arquivo .paint.'], 'Formato desconocido': ['Unknown format', 'Formato desconhecido']
  };

  /* Textos con datos variables: expresión y plantilla por idioma. */
  const P = [
    [/^Color (\d)$/, ['Color $1', 'Cor $1']],
    [/^Color (\d) \(botón izquierdo\)$/, ['Color $1 (left button)', 'Cor $1 (botão esquerdo)']],
    [/^Color (\d) \(botón derecho\)$/, ['Color $1 (right button)', 'Cor $1 (botão direito)']],
    [/^Tamaño: (.+) px$/, ['Size: $1 px', 'Tamanho: $1 px']],
    [/^Opacidad: (.+) %$/, ['Opacity: $1 %', 'Opacidade: $1 %']],
    [/^(\d+) × (\d+) píxeles$/, ['$1 × $2 pixels', '$1 × $2 pixels']],
    [/^Guardado: (.+)$/, ['Saved: $1', 'Salvo: $1']],
    [/^Exportado: (.+)$/, ['Exported: $1', 'Exportado: $1']],
    [/^Icono exportado con (\d+) resoluciones: (.+)$/, ['Icon exported with $1 resolutions: $2', 'Ícone exportado com $1 resoluções: $2']],
    [/^¿Quieres guardar los cambios de (.+)\?$/, ['Do you want to save changes to $1?', 'Deseja salvar as alterações em $1?']],
    [/^Se omitieron (\d+) imágenes dañadas del icono\.$/, ['$1 damaged images in the icon were skipped.', '$1 imagens danificadas do ícone foram ignoradas.']],
    [/^Se eliminará la resolución (.+) con todo su contenido\. Esta acción no se puede deshacer\.$/, ['Resolution $1 will be deleted with all its content. This cannot be undone.', 'A resolução $1 será excluída com todo o conteúdo. Esta ação não pode ser desfeita.']],
    [/^Se generará un icono con estas resoluciones a partir de la imagen de (.+)\. Si es vectorial, cada tamaño se dibuja nítido\.$/, ['An icon with these resolutions will be generated from the $1 image. If it is vector, each size is drawn sharp.', 'Será gerado um ícone com estas resoluções a partir da imagem de $1. Se for vetorial, cada tamanho será desenhado nítido.']],
    [/^Opciones de la resolución (.+)$/, ['Options for resolution $1', 'Opções da resolução $1']],
    [/^Hay una resolución de (.+)\. El formato ICO admite hasta 256 × 256\.$/, ['There is a resolution of $1. The ICO format allows up to 256 × 256.', 'Há uma resolução de $1. O formato ICO permite até 256 × 256.']],
    [/^Cada imagen de un icono debe medir entre 1 y 256 píxeles por lado \(hay una de (.+)\)\.$/, ['Each icon image must be between 1 and 256 pixels per side (there is one of $1).', 'Cada imagem de um ícone deve ter entre 1 e 256 pixels por lado (há uma de $1).']],
    [/^TIFF de (\d+) bits no admitido\.$/, ['$1-bit TIFF is not supported.', 'TIFF de $1 bits não suportado.']],
    [/^El \.paint usa un perfil de color no admitido: (.+)$/, ['The .paint file uses an unsupported color profile: $1', 'O .paint usa um perfil de cor não suportado: $1']],
    [/^El \.paint usa una compresión no admitida: (.+)$/, ['The .paint file uses unsupported compression: $1', 'O .paint usa uma compressão não suportada: $1']],
    [/^Una capa del \.paint no se pudo descomprimir: .+$/, ['A layer in the .paint file could not be decompressed.', 'Não foi possível descomprimir uma camada do .paint.']]
  ];

  const I = T.i18n = { lang: 'es', D, P };
  I.system = function () {
    const l = String((navigator.languages && navigator.languages[0]) || navigator.language || 'es').slice(0, 2).toLowerCase();
    return l === 'es' || l === 'pt' ? l : 'en';
  };

  T.tr = function (s) {
    if (I.lang === 'es' || typeof s !== 'string' || !s) return s;
    const k = IDX[I.lang], d = D[s];
    if (d) return d[k];
    for (const [re, tpl] of P) if (re.test(s)) return s.replace(re, tpl[k]);
    const m = /^(.+) \(esta resolución\)$/.exec(s);
    if (m) return T.tr(m[1]) + [' (this resolution)', ' (esta resolução)'][k];
    const o = /^(.+): opciones$/.exec(s);
    if (o) return T.tr(o[1]) + [': options', ': opções'][k];
    return s;
  };

  /* Vuelve a escribir en pantalla todo lo creado con U.el. */
  I.apply = function (root) {
    const base = root || document.body;
    for (const e of base.querySelectorAll('*')) {
      const s = e._src;
      if (!s) continue;
      if (s.text !== undefined) e.textContent = T.tr(s.text);
      if (s.aria !== undefined) e.setAttribute('aria-label', T.tr(s.aria));
      if (s.tip !== undefined) e.dataset.tip = T.tr(s.tip);
      if (s.key !== undefined) e.dataset.key = T.tr(s.key);
    }
    const w = document.createTreeWalker(base, NodeFilter.SHOW_TEXT);
    while (w.nextNode()) if (w.currentNode._src !== undefined) w.currentNode.nodeValue = T.tr(w.currentNode._src);
  };

  /* choice: 'system', 'es', 'en' o 'pt'. */
  I.set = function (choice) {
    I.lang = choice === 'system' || !choice ? I.system() : choice;
    document.documentElement.lang = I.lang;
  };
})();
