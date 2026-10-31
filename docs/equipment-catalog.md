# Equipment: catálogo independiente

Implementado localmente el 23 de octubre de 2026. Equipment contiene modelos y marcas compartidos, no unidades deducidas de los PM. Los números de serie, clientes, laboratorios y ubicaciones siguen perteneciendo al registro de mantenimiento.

## Uso

Todos los usuarios autenticados consultan el catálogo. El administrador puede añadir marcas, asignarles una plantilla PM existente, registrar modelos, editar sus datos, desactivar su uso en PM nuevos y cargar imágenes o fichas PDF. El catálogo inicial incluye 30 modelos MVE y Taylor-Wharton, con documentos oficiales compartidos por familia. La opción antigua MVE 1400 Series era un marcador de familia, no un modelo concreto; no se incorpora como modelo nuevo. Los PM históricos que la incluyan siguen siendo legibles y pueden retomarse si son borradores propios.

Los selectores de marca, familia y modelo del PM consultan el catálogo de PostgreSQL. Use model in PM prepara un borrador con el modelo elegido. Una nueva marca puede usar la plantilla MVE o Taylor-Wharton, elegida expresamente por el administrador. La marca real y el identificador de plantilla se guardan por separado: cambiar la configuración del catálogo no altera esos datos en PM ya creados. Informes, CSV, PDF y estadísticas usan el fabricante real; las preguntas y límites siguen la plantilla seleccionada. Las marcas sin plantilla se pueden consultar y documentar mientras se configura su uso en PM.

La identidad de un modelo (marca, familia y nombre) permanece estable al editar. Para otro modelo se crea una entrada nueva; las revisiones controlan ediciones simultáneas. Desactivar un modelo evita seleccionarlo en PM nuevos, conservando el historial existente.

La navegación comienza por las 8 familias del catálogo inicial. Cada tarjeta muestra marca, imagen de referencia, cantidad de modelos y variantes. Abrir una familia muestra sus modelos en un selector y la ficha del modelo elegido, con acceso al PDF y al PM. La búsqueda sigue encontrando modelos concretos y abre el resultado correspondiente dentro de su familia. Las familias se distinguen por marca y nombre; las variantes conservan sus datos individuales y se ordenan numéricamente. Esta agrupación cambia la presentación, sin modificar los 30 registros ni los selectores del PM.

El usuario confirmó que las plantillas MVE y Taylor-Wharton corresponden a los formatos usados actualmente por marca. Crear plantillas adicionales queda pendiente. La interfaz de marcas solo permite elegir una de esas dos plantillas existentes; se retiró la opción «Pending / catalog only». La compatibilidad interna con marcas históricas sin asignación se conserva.

## Archivos y visor

Los archivos cargados se guardan en PostgreSQL y se sirven mediante rutas que requieren sesión. Imágenes JPG/PNG/WebP: hasta 6 MB, máximo 30 megapíxeles, normalizadas a WebP. PDFs: hasta 12 MB. Se comprueban tamaño y formato en servidor; la carga binaria se limita mientras se lee. Se auditan altas, cambios y cargas de archivos.

Las imágenes cargadas se orientan automáticamente, se reducen a un máximo de 1400 × 1400 px sin ampliar originales pequeños y se comprimen a WebP con calidad 88. Los activos actuales pesan entre 14 y 68 KB y se conservan sin recomprimir. Los marcos de miniaturas, catálogo y resumen limitan ancho y alto, centran la imagen y usan contain para mantener la proporción y mostrar el equipo completo. La miniatura del encabezado PM ocupa 56 × 56 px y no se contrae al cambiar a una foto vertical; los nombres largos pueden pasar a otra línea.

View datasheet abre un diálogo con PDF.js alojado en la misma app. Incluye paginación, zoom, descarga y enlace a la fuente. El navegador integrado no dibujaba el PDF nativo en un iframe; el visor propio resuelve esa limitación. El runtime de PDF.js se sirve mediante una lista de rutas permitidas y queda incluido en la distribución standalone, sin CDN. Las preferencias y datos del documento no se envían a servicios externos.

## Fuentes e imágenes

- [MVE HEco](https://mvebio.com/our-products/life-science-freezers/mve-heco-series/).
- [MVE High Efficiency](https://mvebio.com/our-products/life-science-freezers/mve-high-efficiency-series/).
- [MVE HE con CryoVerse Connect](https://mvebio.com/our-products/life-science-freezers/mve-he-series-cryoverse-connect-controller/).
- [MVE Series](https://mvebio.com/our-products/life-science-freezers/mve-series/).
- [IC Biomedical K-Series](https://icbiomedical.com/products/k-series/) y [LABS Precision](https://icbiomedical.com/products/labs-precision-series/), conservando Taylor-Wharton como marca histórica del catálogo del cliente.

Las cuatro fotos K-Series corresponden a cada modelo. Se extrajeron fotografías de las fichas oficiales para HEco 800, HEco 1500 y LABS Precision 94K. Los modelos que usan una referencia de familia se identifican expresamente. Los LABS Precision 20K, 38K, 40K y 80K quedan sin fotografía individual verificada; sus PDFs sí están disponibles. Las fotos y documentos conservan los derechos del fabricante; no se consideran activos originales GPL del proyecto.

`lib/equipment/asset-sources.json` registra los enlaces de origen. `lib/equipment/seed.json` conserva la instantánea inicial; las migraciones 0002 y 0003 crean y cargan el catálogo y añaden la instantánea de fabricante a los PM. Los documentos iniciales se distribuyen en public/equipment-assets; los archivos subidos por el usuario viven en la base.

## Verificación

Pruebas con PostgreSQL temporal: catálogo inicial independiente de los PM, permisos de técnico/admin, duplicados, control de revisión, tamaño/formato de archivos, lectura protegida, desactivación, asignación de plantilla a una marca nueva, conservación del fabricante y plantilla en un PM existente, PDF y filtros de estadísticas por fabricante. Se verifica además la lista de archivos permitidos del runtime de PDF.js.

Revisión de navegador: catálogo y fotos, selección de 24K en PM, ficha K-Series de una página y LABS Precision de cuatro páginas, paginación y zoom. Evidencia local en work/cryopm-equipment-catalog.png y work/cryopm-equipment-datasheet.png.

Dependencias: PDF.js no añade avisos conocidos al audit de producción. El audit existente señala actualizaciones disponibles de Next.js, sharp y source-map-js; no se ha realizado una actualización general del framework en este cambio. La carga de imágenes rechaza formatos distintos de PNG/JPEG/WebP antes de invocar el decodificador.

Validación final: 18 pruebas pasan, lint sin errores (10 advertencias de imágenes) y compilación de producción con Webpack correcta. El trazado standalone incluye el worker de PDF.js, sus fuentes/CMaps/WASM y los archivos iniciales del catálogo. Las cargas y las pruebas de marcas nuevas se comprobaron en una base temporal; no se dejaron marcas ni PM sintéticos adicionales en la base local del usuario.

Comprobación móvil adicional: catálogo y PDF.js revisados en una ventana de 390 px. El popup queda por encima de la navegación inferior y permite desplazarse por el documento. Captura en work/cryopm-equipment-mobile.png. Tras reiniciar el lanzador independiente, la comprobación HTTP devuelve catálogo 200 (2 marcas, 30 modelos, 26 con imagen, 30 con documento), imagen 200, ficha PDF 200 y worker PDF.js 200.

Agrupación por familias: revisión de tipos y lint del componente sin errores. Comprobados en navegador: 8 tarjetas de familia, cambio entre modelos K-Series, búsqueda de 24K con selección directa, retorno a familias y apertura de PDF. Revisado el diseño de 390 px mediante la app real en un iframe local temporal (retirado tras la comprobación). Evidencia: work/cryopm-equipment-families.png, work/cryopm-equipment-family-model.png y work/cryopm-equipment-family-mobile.png.
