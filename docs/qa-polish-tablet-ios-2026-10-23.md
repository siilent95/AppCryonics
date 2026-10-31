# CryoPM — pulido aplicado y comprobación de tablet/iOS

23 de octubre de 2026. Continuación de [la auditoría de diseño y textos](qa-design-and-copy-2026-10-23.md).

## Cambios aplicados

- Se conserva la identidad azul/cian y el cristal. El cuerpo y los controles usan peso 500; los títulos, 600. Las alertas y ayudas operativas se amplían a 13–14 px y los inputs a 16 px.
- Se corrigen los contrastes de Completed, OK, Ready, cálculo válido, número de etapa actual y texto gris de la portada. El verde oscuro sobre superficie clara y el blanco sobre verde oscuro sustituyen los pares insuficientes.
- La cabecera estrecha conserva Save draft, Save & exit y Sign out sin solaparlos con la ruta.
- En tablet, la navegación inferior se mantiene hasta 1180 px. Los campos de identificación usan dos columnas; las mediciones de Examination también desde 768 px. Familia/modelo se apilan en anchos pequeños para leer el modelo completo.
- Se recuperan los nombres de las cinco etapas que una regla antigua ocultaba en tablet. Se añade un nombre accesible estable, estado de etapa actual y contexto de completado. En móvil, la tira de etapas desplaza dentro de su contenedor.
- Reports usa lista/detalle con Back to reports hasta 1180 px. Al abrir enfoca el detalle; al volver enfoca la fila anterior y conserva filtros/listado. Trash y la eliminación regresan a la lista. Escritorio conserva ambas columnas.
- La lista distingue cuenta asignada, nombre firmante y referencia a firmas anteriores. El endpoint incluye el nombre del técnico asignado dentro del alcance de lectura existente.
- Users muestra tarjetas con acciones junto a cada cuenta en tablet/móvil. Conserva semántica explícita de tabla y la presentación de tabla en escritorio.
- Los errores de resistencia, batería, nivel y configuración tienen estado inválido y referencias a la ayuda/error correspondiente. Las respuestas están agrupadas semánticamente. Se corrigen dos etiquetas HTML anidadas.
- Units se presenta antes de los valores. Se retiran introducciones genéricas y ayudas duplicadas. Se mantienen las preguntas y límites de ambos templates, reglas de guardado, privacidad, conservación y consecuencias de las invitaciones.
- Activación muestra el requisito de 12 caracteres, ayuda ante un enlace ausente y errores asociados. Login/activación incorporan mostrar/ocultar contraseña y mantienen autocompletado y pegado.
- El datasheet mantiene visor, descarga y apertura del original, y añade Read page text. El texto de la página se puede seleccionar y leer con tecnología de asistencia. La extracción no reconstruye la semántica de las tablas ni sustituye las ilustraciones; se indica que se consulte el PDF para esa disposición.

Los estilos de pulido viven en `app/field-qa.css`, importado después del sistema visual y limitado a pantalla. El generador de PDF y las reglas de impresión no se modifican en esta entrega.

## Preparación para iPad/iOS

- Se conservan `input type="date"` y selects nativos. No se sustituyen por calendarios dibujados ni se fuerza `showPicker()`. El sistema puede presentar sus propios controles.
- Los campos de fecha tienen ancho mínimo controlado, altura suficiente y ajuste del contenido WebKit. Los controles oscuros declaran `color-scheme: dark`; la vista de documento conserva contexto claro.
- Se mantienen `device-width`, escala inicial 1 y `viewport-fit=cover`, sin desactivar el zoom. Se utilizan márgenes de zona segura y alturas dinámicas en barras/diálogos.
- Se observan cambios del viewport visual mientras se edita: cuando hay una reducción grande compatible con teclado, se oculta temporalmente la navegación inferior y se procura que el campo enfocado permanezca visible. No se aplica esa detección durante el zoom. Este comportamiento requiere validación final con teclado virtual real, incluido teclado flotante de iPad.
- Los campos que admiten signo conservan teclado de texto para disponer del menos; el teclado decimal se mantiene en mediciones no negativas. Se desactivan corrección y mayúsculas automáticas en los campos con signo.
- Se corrige una pérdida de magnitud en entradas con coma decimal: `3,2` ahora se interpreta como `3.2`, en vez de `32`. Se admite también el signo menos Unicode: `−170,5` → `-170.5`. Los límites y validaciones del PM permanecen activos.
- Los objetivos de respuesta tienen al menos 48 px; los controles principales aumentan a 48 px con puntero táctil. La firma sigue admitiendo eventos de puntero y evita desplazar la página mientras se dibuja.

Base de referencia: [viewport de Safari](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/UsingtheViewport/UsingtheViewport.html), [diseño para Safari y zonas seguras](https://developer.apple.com/videos/play/wwdc2021/10029/) y [diferencias del viewport con teclado en WebKit](https://bugs.webkit.org/show_bug.cgi?id=259770). Estas referencias orientan la implementación; no sustituyen pruebas sobre el sistema operativo objetivo.

## Verificación realizada

| Tamaño CSS | Comprobación |
| --- | --- |
| 1280×720 | Escritorio; cinco etapas MVE; contraste por estilos calculados; error de resistencia y coma decimal; controles de acceso. |
| 820×1180 | Tablet vertical: Overview, PM, cinco etapas, Units, revisión sin firmar, Reports y retorno de foco, Users y datasheet. |
| 1180×820 | Tablet horizontal: Overview, identificación y reflujo de un PM abierto. |
| 768×1024 | Tablet vertical estrecha: conservación de valores y configuración en dos columnas. |
| 1024×768 | Overview en tablet horizontal; filtros y gráficos. |
| 390×844 y 320×704 | Formulario inicial, cabecera, identificación y navegación. |

Las dimensiones se aplicaron a un iframe local. El selector de tamaño del arnés permite cambiar el tamaño del mismo iframe sin recargar la aplicación. Se introdujo `−170,5`, se cambió de orientación y se comprobó que el formulario conservó `-170.5`. Después se restauró el valor original. No se guardaron esos cambios de prueba ni se recogieron firmas.

Se comprobó la apertura del calendario nativo del navegador integrado, los nombres de controles y el texto extraído de un datasheet MVE real. También se verificaron ayudas de contraseña y el toggle sobre campos vacíos, sin entrar ni guardar nuevas credenciales.

Validación técnica:

- Suite completa: **24 pruebas correctas**, con PostgreSQL temporal independiente. Incluye sesiones, permisos, reasignación, catálogo, firmas/PDF, correcciones, paginación, papelera y edición de cuentas.
- Prueba adicional de coma decimal, signo menos Unicode y límites abiertos de resistencia.
- TypeScript sin errores. ESLint de los archivos revisados sin errores; permanecen avisos existentes sobre imágenes `<img>`.
- En las capturas DOM de las cinco etapas MVE no se detectó desbordamiento de página en escritorio. El recálculo de contraste no dejó candidatos de texto sobre fondo sólido por debajo de su umbral; los gradientes se revisan aparte y no se tratan como fondos sólidos.

Evidencia en `work/qa-polish-2026-10-23/`: [PM vertical](../work/qa-polish-2026-10-23/tablet-820-pm-final.png), [etapas visibles](../work/qa-polish-2026-10-23/tablet-820-stages.png), [configuración a 768 px](../work/qa-polish-2026-10-23/tablet-768-examination.png), [cuentas](../work/qa-polish-2026-10-23/tablet-820-users.png), [cabecera a 320 px](../work/qa-polish-2026-10-23/mobile-320-final.png).

## Validación pendiente en equipo real

No se dispone aquí de un iPad físico ni de un simulador iPadOS conectado. El navegador integrado y los anchos CSS no prueban el comportamiento de Safari/iPadOS. Antes de usarlo en servicio se debe revisar en el modelo y versión adquiridos:

1. Calendario de PM y filtros: abrir, elegir fecha, cancelar y cerrar en ambas orientaciones.
2. Teclado virtual/físico/flotante: signo menos, coma/punto, autocompletado, foco, barras de Safari y cierre de teclado.
3. Diálogos con teclado abierto, zoom al 200 %, pantalla dividida y zonas seguras.
4. Firma táctil y con Pencil, rotación del equipo y limpieza del trazo, con datos de prueba.
5. Datasheet: zoom, cambio de página y lectura de texto; PDF del informe mediante descarga, apertura y guardado en Files según las opciones que ofrezca iOS.
6. VoiceOver, orden del foco y lectura de estados/errores. No se afirma certificación WCAG.

La alternativa a la firma dibujada para usuarios que no puedan realizar trazos requiere una decisión del responsable del producto. Se conserva el mecanismo y las declaraciones vigentes. El historial de secciones mediante URL queda como mejora posterior; no forma parte de esta corrección visual.
