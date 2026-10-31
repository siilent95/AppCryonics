# CryoPM — QA de diseño, accesibilidad y textos

Fecha: 23 de octubre de 2026. Entorno local, rama `migracion-postgresql-modular`.

**Actualización:** el pulido autorizado se aplicó después de esta auditoría. Consultar [cambios, verificación de tablet y pendientes de iOS](qa-polish-tablet-ios-2026-10-23.md). Los hallazgos siguientes documentan el estado anterior.

## Resultado

La dirección visual actual es consistente: fondo azul oscuro, superficies de cristal, acentos cian, navegación lateral en escritorio y navegación inferior con icono y texto en móvil. Conviene mantenerla y corregir detalles de adaptación, legibilidad y jerarquía.

Las tres prioridades son el solapamiento de la cabecera del PM a 320 px, los contrastes de algunos estados y la asociación accesible de los errores de medición. Después conviene compactar las cabeceras móviles y simplificar las ayudas repetidas.

Esta entrega documenta la auditoría; no aplica todavía los cambios de diseño o contenido propuestos.

## Cobertura y método

| Área | Revisión realizada |
| --- | --- |
| Overview | Escritorio 1280×720; anchos CSS 768, 390 y 320 px; gráficos, filtros, nombres accesibles y detalle de datos mediante teclado. |
| PM workspace | Las cinco etapas de MVE y Taylor-Wharton con borradores sintéticos; estado inicial y cabecera a 390/320 px; identificación, imágenes, campos, errores, revisión y áreas de firma. |
| Reports | Lista, búsqueda/filtros en código, borradores, informe completado y versiones; selección móvil, papelera existente y confirmación de eliminación cancelada. |
| Equipment | Familias, selección de modelo, fotografía, especificaciones y datasheet en escritorio y móvil. Revisión de los estilos y formularios de gestión. |
| Users | Directorio e invitación; edición de usuario y cancelación en escritorio/móvil. Sin modificar cuentas. |
| Acceso | Login y activación en escritorio y a 320 px; etiquetas, autocompletado, instrucciones y estados de activación en código. |
| Transversal | Estilos calculados, tamaños, desbordamiento, contraste de colores sólidos, estructura accesible, foco visible, enlace de salto, Escape y devolución del foco en diálogos. |

Los anchos pequeños se probaron mediante un iframe local del tamaño indicado. Es una prueba de adaptación CSS, no una prueba en un dispositivo físico. Se inspeccionaron DOM, árbol de accesibilidad y código. No se ejecutaron axe/Lighthouse ni VoiceOver/NVDA, ni una matriz completa de navegadores, zoom real al 200 % o teclado virtual. Tampoco se probaron en esta pasada las operaciones sensibles de cuentas, nuevas firmas o eliminación definitiva. No constituye una certificación WCAG ni una regresión funcional completa.

## Hallazgos de diseño y accesibilidad

### 1. Prioridad alta — Cabecera del PM solapada a 320 px

**Reproducción:** abrir PM workspace con un ancho de 320 px. El texto “PM workspace” invade la zona de “Save draft”. Los botones compiten con la ruta y las acciones de cuenta por la misma fila.

**Causa:** la regla de `.breadcrumb` de `app/workspace.css:23` vuelve a mostrar la ruta que `app/globals.css:490` ocultaba en móvil; las reglas de cabecera y acciones en `app/workspace.css:198` no resuelven el espacio mínimo.

**Propuesta:** esconder la ruta redundante en el ancho más estrecho o distribuir la cabecera en dos filas. Mantener acceso claro a Save draft y Save & exit. Verificar también nombres largos y un PM guardado.

Evidencia: [cabecera a 320 px](../work/qa-design-2026-10-23/mobile-pm-overlap-320.png).

### 2. Prioridad alta — Contraste insuficiente en estados concretos

Mediciones a partir de los colores CSS calculados, sin usar los bordes suavizados de las letras:

| Elemento | Texto / fondo | Tamaño observado | Ratio |
| --- | --- | --- | --- |
| Completed en Reports; OK de pasos completados; cálculo válido | `#0f8a65` / `#e9f7f1` | 8–11 px | 3,93:1 |
| Número del paso actual | `#ffffff` / `#00a9ce` | 11 px | 2,78:1 |
| Badge Ready | `#ffffff` / `#0f8a65` | 8 px | 4,34:1 |
| Fecha secundaria en portada del informe | `#6d7888` / `#ffffff` | 11 px | 4,48:1 |

Son textos normales y necesitan al menos 4,5:1 conforme a [WCAG 2.2, contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html). El último caso está muy cerca, pero sigue por debajo del umbral. Oscurecer el verde en las superficies claras, usar texto oscuro en el círculo cian y ajustar el gris de la portada. No hace falta alterar la paleta general.

Referencias: `app/globals.css:144`, `:145`, `:182`, `:271`, `:335`; `app/workspace.css:83`. Datos y cálculo reproducible en `work/qa-design-2026-10-23/*-dom.json` y `contrast.py`. El archivo de candidatos también contiene casos con gradientes o elementos decorativos que requieren revisión manual: no todos sus resultados son fallos.

### 3. Prioridad alta — Error de medición sin asociación con el campo

**Reproducción:** en el borrador sintético MVE, Verification → Room temperature resistance, introducir 100 en vez de 1050. Aparece el error visible y el rango correcto, pero el input no tiene `aria-invalid` ni `aria-describedby`; el aviso tampoco es una región de anuncio.

**Consecuencia:** el usuario ve el error, pero una persona que navega por los campos con tecnología de asistencia puede no recibir ese contexto al enfocar la medición.

**Propuesta:** IDs para ayuda y error, `aria-describedby`, estado `aria-invalid` y resumen accesible cuando se intenta avanzar con errores. Conservar los límites técnicos exactos. El mensaje visible ya identifica el problema; la ausencia de ARIA por sí sola no prueba un incumplimiento de 3.3.1. La mejora se centra en la asociación y comunicación del estado, siguiendo las guías de [identificación de errores](https://www.w3.org/WAI/WCAG22/Understanding/error-identification.html) y [relaciones entre información](https://www.w3.org/WAI/WCAG22/Understanding/info-and-relationships.html).

Referencias: `features/pm/MaintenanceForm.tsx:342` y `:409`. Evidencia: [validación de medición](../work/qa-design-2026-10-23/desktop-mve-invalid.png). Se restauró el valor correcto sin guardar el cambio de prueba.

### 4. Prioridad media — Textos operativos demasiado pequeños

Los mensajes de bloqueo conservan tamaños de 9–10 px; las etiquetas del cálculo de nivel y Ready llegan a 8 px. Desentonan con los campos y textos principales, que ya tienen una escala más cómoda.

**Propuesta:** cuerpo de alertas y ayudas en 13–14 px, metadatos secundarios en 12 px y valores principales al menos en la escala del formulario. WCAG no prescribe aquí un tamaño mínimo universal: es un problema de legibilidad y consistencia, además de los contrastes del punto 2.

Referencias: `app/globals.css:177`, `:178`, `:184`, `:185`, `:186`, `:271`. Conviene consolidar estos estados en los estilos actuales para evitar que sobrevivan reglas antiguas aisladas.

### 5. Prioridad media — Demasiado contenido antes del trabajo en móvil

En 390 px, Overview dedica gran parte de la primera pantalla a introducción y filtros; Equipment no muestra una familia completa en la primera pantalla. En PM workspace se acumulan introducción, marca, ayuda de guardado e identificación antes de llegar a los campos.

El aviso de privacidad del encabezado de identificación queda además limitado a `14ch`, formando una columna muy estrecha y alta.

**Propuesta:** encabezados compactos; filtros secundarios plegables con resumen visible; un solo aviso contextual de guardado; privacidad a todo el ancho. Mantener periodo y alcance de las estadísticas visibles. Evitar reducir los controles para ganar espacio.

Referencia principal: `app/workspace.css:214`. Evidencias: [PM a 390 px](../work/qa-design-2026-10-23/mobile-pm-top-390.png), [catálogo móvil](../work/qa-design-2026-10-23/mobile-equipment-390.png), [Overview móvil](../work/qa-design-2026-10-23/mobile-overview-390.png).

### 6. Prioridad media — Seleccionar un informe en móvil no conduce al detalle

La fila cambia de selección y el informe carga debajo de la lista. La persona permanece viendo las filas y debe descubrir que la vista previa está más abajo. Además hay desplazamiento dentro de la lista y dentro de la página.

**Propuesta:** en móvil abrir un detalle con “Back to reports”, o desplazar y enfocar el encabezado del informe una vez cargado, conservando filtros y posición al volver. Mantener la distribución de dos columnas en escritorio.

Referencias: `features/pm/components/ReportsView.tsx:97`, `features/pm/usePmWorkspace.ts:386`. Evidencia: [detalle bajo la lista](../work/qa-design-2026-10-23/mobile-report-preview-390.png).

### 7. Prioridad media — Gestión de cuentas incómoda en móvil

El directorio conserva una tabla de ancho mínimo 980 px. El desplazamiento horizontal funciona, pero los botones de editar, desactivar y restablecer contraseña quedan lejos del nombre del usuario en 390 px.

**Propuesta:** tarjetas por usuario en móvil con nombre, correo, estado y acciones; tabla en escritorio. Esto es una mejora de uso, no se declara un fallo automático de reflujo por tratarse de una tabla de datos.

Referencias: `app/globals.css:363`, `features/accounts/UsersView.tsx:43`. Evidencia: [directorio móvil](../work/qa-design-2026-10-23/mobile-users-390.png). El [diálogo de edición](../work/qa-design-2026-10-23/mobile-user-edit-390.png) ya se adapta correctamente.

### 8. Prioridad media — Activación con instrucciones incompletas

Se exige una contraseña de 12 caracteres mediante `minLength`, pero el requisito no aparece antes de escribir. Visitar `/activate` sin enlace válido también presenta un formulario normal; el problema del enlace solo se descubre al enviar.

**Propuesta:** ayuda visible “Use at least 12 characters”, asociada a ambos campos cuando corresponda; detectar la ausencia de token y mostrar “Open the invitation or reset link shared by your admin.” La validez de un token existente debe confirmarse en el servidor. Añadir en login una ayuda breve para pedir recuperación al administrador. Evaluar un botón accesible para mostrar/ocultar contraseña.

Referencias: `app/activate/page.tsx:9`, `:26`; `app/login/page.tsx`. Evidencia: [activación a 320 px](../work/qa-design-2026-10-23/mobile-activation-320.png).

### 9. Prioridad media — Etiqueta de técnico ambigua en versiones corregidas

La lista muestra “Technician not recorded” en PM-8BA59282-R2, aunque hay un técnico asignado y la corrección conserva la referencia a la firma anterior. La lista usa `record.technicianName`; el informe sí resuelve `signatureReference`.

**Propuesta:** distinguir “Assigned to”, técnico firmante original y autor de la corrección. En un borrador sin firma, “Not signed yet” comunica mejor el estado que insinuar que falta la cuenta asignada. La solución debe respetar esas tres identidades y no sustituir silenciosamente una por otra.

Referencias: `features/pm/components/ReportsView.tsx:99`, `features/pm/components/ReportPreview.tsx:23` y `:79`.

## Puntos que requieren validación adicional

| Punto | Evidencia y siguiente paso |
| --- | --- |
| Respuestas Yes / No / N/A | El contenedor tiene `aria-label`, pero es un `div` sin rol de grupo (`features/pm/components/Choice.tsx:6`). El árbol inspeccionado sí mostró contexto y estado de las respuestas. Usar `fieldset/legend` o `role="group"` y comprobar con lector de pantalla antes de declarar un fallo. No modificar la terminología técnica de los dos templates sin validación del negocio. |
| Lectura accesible del datasheet | El visor expone cada página como una imagen de canvas (`features/equipment/PdfViewer.tsx:39`), sin texto navegable. Existen Open PDF y Download PDF. Conservar esas salidas y comprobar accesibilidad del documento original; valorar capa de texto. La etiqueta de la imagen no sustituye al contenido del documento. |
| Firma con teclado o movilidad limitada | SignaturePad solo admite trazos con puntero; no ofrece alternativa de teclado (`features/pm/components/SignaturePad.tsx:70`). Definir con el responsable del producto una alternativa aceptable. La forma del trazo puede ser esencial y existen excepciones en [WCAG sobre movimientos de arrastre](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html); no se declara un incumplimiento automático. |
| Historial del navegador | Las secciones se gestionan con estado interno. Valorar URL por sección para recuperar vista, compartir enlaces y usar Atrás, manteniendo el comportamiento acordado de borradores. |

## Textos: retirar, simplificar o conservar

Se propone conservar el idioma inglés actual de la interfaz. Son propuestas de microcopy; las preguntas de mantenimiento, límites, firmas y reglas de conservación no se reinterpretan en esta pasada.

| Ubicación / texto actual | Recomendación |
| --- | --- |
| Overview: “A clear view of recorded work, document progress and equipment.” | Retirar. Describe la pantalla sin aportar una decisión o una regla. |
| “Open PM workspace ↗” | “PM workspace”, o “Continue PM” cuando haya trabajo en curso. No llamarlo siempre New PM: el botón puede recuperar el formulario actual. Retirar la flecha de enlace externo en esta acción interna. |
| “How far the recorded work has progressed.” / “Where the recorded PM activity belongs.” | Retirar subtítulos que repiten el título del gráfico. Mantener títulos, etiquetas y cifras. |
| Notas sobre fecha de ejecución, estado actual y “Notes are not necessarily failures.” | Conservar donde aclaran la interpretación de las estadísticas. El detalle metodológico más largo puede ir en “About these metrics”. |
| “Complete every applicable PM field before review.” | Retirar la introducción permanente; indicar lo que falta cuando realmente impide avanzar. |
| Ayuda extensa “Your progress stays when switching sections…” | Acortar. Mostrar estado Saved / Unsaved changes y una ayuda contextual precisa sobre refrescar/cerrar. No sugerir que existe autoguardado si todavía depende de Save draft. |
| “Required fields”, “COVE inspection” y “Sequential validation active” repetidos | Reducir repeticiones. Si una etapa está bloqueada, mostrar “Complete Construction to continue.” adaptado a la etapa real. Confirmar si “COVE” tiene significado operativo para los técnicos antes de retirarlo de títulos. |
| Privacidad repetida en identificación y panel lateral | Un aviso claro: “Use equipment and organization details only. Do not enter patient or sample data.” Mantener el alcance de la regla completa en la ayuda de privacidad. |
| “Hard stop · Value outside approved range” | “Reading outside the permitted range”, seguido del límite exacto y qué debe revisar. Eliminar jerga interna, no el bloqueo ni su explicación. |
| “Select temperature and level units first…” | La ayuda es útil, pero los selectores están debajo de los valores. Mover Units antes de los campos; mantener la instrucción breve. Referencias: `MaintenanceForm.tsx:442` y `:484`. |
| Review: “PM questionnaire complete” / “No active hard stops” | “Ready for signatures” cuando corresponda; en correcciones, “Ready to finalize”. Mostrar pendientes concretos si los hay. |
| Párrafo de firma que enumera presión, velocidad, timing e IP no recolectados | Mantener junto a la firma el plazo y la finalidad relevantes. Mover el detalle completo a una ayuda de privacidad; conservar las declaraciones de responsabilidad y recepción. Referencia: `MaintenanceForm.tsx:585`. |
| Reports: “Continue drafts… 25 PMs per page…” | Retirar la introducción genérica. El paginador ya indica 25 por página. Mantener el alcance del CSV en su acción o ayuda si hace falta. |
| Aviso de Trash de 25 días | Conservar. En la vista activa puede bastar un enlace/ayuda; en Trash, mostrar regla y fecha de recuperación de cada PM. |
| Equipment: “Browse by family, then choose a model…” | Se puede retirar cuando la estructura y los botones Explore models ya lo explican. Conservar “Series reference image · verify the equipment label”: distingue una imagen de familia de una fotografía específica del modelo. |
| Users: introducción general “Create accounts, edit user details…” | Retirar. Las secciones y acciones ya expresan esas capacidades. |
| “No email is sent automatically.” y validez de invitación | Conservar y hacer accionable: “Copy and share the invitation link. It expires in 24 hours.” Mantener también consecuencias de reset y revocación de enlaces. |
| Reglas del username | Mostrarlas también al invitar, no solo al editar. Incluir que empieza con letra o número, conforme al patrón real. |
| Activación sin requisito visible | Añadir “Use at least 12 characters.” y ayuda para enlaces inválidos. Son instrucciones útiles, no texto decorativo. |

## Lo que ya funciona bien

- Ventana completa y lenguaje visual coherente; las imágenes inspeccionadas se contienen en sus marcos.
- La navegación móvil combina texto e icono y tiene objetivos táctiles amplios. Los controles principales inspeccionados rondan 44 px de alto. WCAG AA pide 24×24 px o sus excepciones de separación; 44 px es una recomendación más exigente, no el mínimo AA. Referencia: [tamaño mínimo de objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html).
- No se detectó desbordamiento horizontal de página en las capturas DOM de escritorio revisadas. La tabla móvil de Users desplaza dentro de su contenedor.
- Etiquetas y nombres presentes en los campos inspeccionados de ambas plantillas; estados de respuesta visibles.
- Skip to content enfoca el contenido; el siguiente Tab tiene un foco visible. Los diálogos comprobados admiten Escape y devuelven el foco al disparador.
- La eliminación enfoca primero Keep PM, identifica el registro y explica la recuperación.
- Gráficos con etiquetas y acceso al detalle; selector compacto para versiones; búsqueda y estados de carga explícitos.
- Hay reglas para reducir movimiento y transparencia. Se revisó su presencia en código; queda probarlas en dispositivos y preferencias reales.

## Orden recomendado para el pulido

1. Resolver cabecera a 320 px, contrastes y errores asociados a campos.
2. Unificar escala tipográfica de avisos; compactar móvil y corregir el orden de Units.
3. Mejorar navegación lista/detalle de Reports y directorio móvil de Users.
4. Aplicar la limpieza de textos, ayudas de activación e identidades de técnico.
5. Repetir teclado completo, lector de pantalla, zoom y dispositivos reales; decidir alternativas para firma y documentos.

Referencia adicional de criterios de interfaz: [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), consultadas durante esta auditoría.

## Evidencia y limpieza

Las capturas y lecturas de estilos están en `work/qa-design-2026-10-23/`. Se crearon exclusivamente dos borradores sintéticos para inspeccionar las etapas: PM-AF37F97D y PM-9B9E183C. Ambos se movieron a la papelera recuperable al terminar; no participan ya en las estadísticas activas. La eliminación previa PM-A430D453 no se modificó. Se retiró la página temporal de prueba responsive. No se emitieron invitaciones, no se cambiaron roles/contraseñas y no se recogieron nuevas firmas.
