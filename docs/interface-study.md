# CryoPM — Estudio de interfaz

Fecha: 22 de octubre de 2026. Estado: el usuario aprobó A2 y pidió aplicarla. Implementada en la app local; los prototipos A/B/C se conservan como referencias. Base: `migracion-postgresql-modular`, `d33e8bf` más la preparación local existente. Ver [referencias y definición de A2](overview-dashboard-research.md).

## Objetivo y evidencia del diagnóstico inicial

Conservar la identidad técnica azul oscuro/cian, las imágenes de equipos y el flujo COVE. Rediseñar la experiencia para ocupar toda la ventana y facilitar el mantenimiento en escritorio y tablet.

- `app/globals.css:579`: `.appShell` limita el ancho a 1600 px y añade `margin: 16px auto`, radio de 25 px y sombra. Es la causa directa del marco exterior en escritorio.
- `app/globals.css:578`: el fondo exterior gris claro aumenta el contraste con la ventana oscura.
- `app/globals.css:794`: `.accountBar` introduce una franja clara fuera de la estructura principal.
- `app/globals.css:600`: contenido con altura mínima fija de 700 px. La cuadrícula del Overview tiene otra altura mínima de 675 px y columnas laterales de ancho fijo.
- A 850 px la imagen destacada pasa a la primera fila, con al menos 580 px de alto; a 560 px sigue reservando 570 px. En el navegador estrecho se observó que desplaza el estado del trabajo fuera de la primera vista.
- Las reglas de pantalla posteriores reducen numerosos textos de datos y controles a 9–11 px. La legibilidad merece prioridad; esto por sí solo no constituye un diagnóstico de incumplimiento WCAG.
- `PmWorkspace` oculta la identidad demo antigua mediante CSS, mientras el usuario real aparece fuera de la app. Unificar la cuenta en la navegación evita información contradictoria y dos cabeceras.
- Overview repite completados en actividad y tasa de cierre. Conviene priorizar registros pendientes, estado documental y acceso al equipo.
- Reports combina dos paneles con alturas máximas y scroll propio; revisar el recorrido de lectura y mantener el informe imprimible blanco dentro del área de trabajo.

No se identificó telemetría en vivo ni programación de vencimientos en el modelo actual. Las propuestas no muestran temperaturas en tiempo real, alarmas de equipo ni fechas de próximos PM como funciones existentes.

## Reglas comunes propuestas

- Estructura de aplicación a todo el ancho y `min-height: 100dvh`; sin margen exterior, radio exterior ni sombra de ventana. Separación interna de 16–32 px según pantalla.
- Cuenta, navegación y acciones integradas en una sola estructura. Cuatro destinos existentes: Overview, PM workspace, Equipment y Reports.
- Tamaños propuestos: cuerpo y formularios 16 px; tablas 14 px; metadatos 12–13 px; títulos 28–32 px. Controles de 44 px cuando son táctiles.
- Escala espacial 4/8/12/16/24/32. Radios 8–12 px para componentes; el contenedor de la aplicación no tiene radio.
- IBM Plex Sans para una voz técnica legible, con fuentes de sistema como respaldo; números tabulares en mediciones. La muestra usa la fuente pública de Google Fonts; el producto definitivo debería servirla localmente.
- Colores de identidad: navy `#071B2D`, superficie `#10293E`, panel `#193147`, cian `#00A9CE`, hielo `#E8F2F5`, texto secundario `#AFC0CC`. Ámbar reservado para estados pendientes y verde para completados, acompañados de texto.
- Escritorio: distribución fluida; tablet: una o dos columnas según tarea; móvil: trabajo pendiente y acción principal antes de imagen. Sin ocultar contenido esencial.
- Formularios: pasos y acciones claros, etiqueta y unidad visibles; contexto de equipo compacto. No ampliar párrafos o campos indefinidamente en pantallas grandes.
- Conservar el inglés de la app. El estudio y las explicaciones permanecen en español.

## A — Control operativo (recomendada)

Navegación lateral de 216 px, área de trabajo oscura continua, una cabecera con usuario real y acción New PM. La cola de trabajo ocupa el bloque principal; el equipo seleccionado tiene imagen y datos a la derecha.

```text
| navegación | título y acción principal                         |
|           | resumen de registros                              |
|           | cola de PM y estados         | equipo seleccionado |
|           | historial reciente           | identidad y acceso  |
```

Alineación a la izquierda. La imagen sigue siendo distintiva, pero ayuda a reconocer el equipo en lugar de consumir el centro completo. Adecuada para uso diario, múltiples equipos y documentos. Coste: la barra lateral ocupa espacio; se transforma en navegación horizontal en tablet y móvil.

## B — Equipo en foco

Evolución directa del dashboard actual. Barra superior integrada y equipo destacado a la izquierda, con cola de trabajo y documentación a la derecha. Una banda inferior reúne las métricas existentes.

```text
| marca       Overview / PM / Equipment / Reports       usuario |
| título y acción                                               |
| imagen del equipo y ficha      | cola de PM y documentación     |
| totales y estado de los registros                              |
```

Más cercana a la identidad visual actual y apropiada para revisar un equipo a la vez. En móvil la imagen se reduce a un bloque compacto y la cola de trabajo aparece primero. Coste: tiene menor densidad documental que A.

## C — Mesa técnica

Navegación azul oscuro y área operativa clara de borde a borde. El formulario es el centro: pasos laterales, preguntas grandes, controles legibles y resumen del equipo en un lateral. Las superficies claras son parte de la aplicación, no un marco exterior.

```text
| navegación | cabecera de la orden                              |
|           | pasos | formulario e identificación | ficha equipo |
|           |       | preguntas y mediciones      | resumen      |
|           |       | volver / guardar / continuar               |
```

Adecuada para sesiones prolongadas de diligenciamiento y uso en ambientes iluminados. Coste: cambia más la apariencia respecto al dashboard oscuro.

## Revisión del plan

La recomendación automática de la skill sugería verde como acento y una estructura de landing con CTA comerciales. Se descartaron: CryoPM ya tiene identidad azul/cian y es una herramienta operativa autenticada. También se descartaron gráficos decorativos, indicadores de salud en vivo y métricas sin respaldo. Las tres propuestas comparten el flujo existente y cambian la jerarquía espacial, no solo los colores.

## Alcance de las muestras

En `public/design-study/` se ofrecen muestras interactivas independientes de la app. Sus datos son sintéticos, no consultan PostgreSQL ni guardan registros. Incluyen navegación entre vistas, selección de equipo, búsqueda de registros y vista de formulario para comparar estructuras. No representan funcionalidades completas ni implican aprobación de implementación.

Secuencia prevista en el estudio inicial (ya aprobada): aplicar el contenedor y navegación, Overview, formulario, Equipment y Reports; verificar 375/768/1280/1440 px, teclado, contraste, zoom, estados vacíos/error y paridad del informe impreso. El alcance backend permanece separado.

## Verificación original de las propuestas

- Las tres pantallas iniciales se verificaron en 1440, 1280, 768 y 375 px: el ancho del documento coincide con la ventana, sin desbordamiento horizontal.
- En A a 1280 px, el contenedor ocupa desde x=0 hasta x=1280, con margen exterior y radio de 0 px.
- Se comprobó la selección de respuesta, avance al paso Operation, navegación a Reports, búsqueda de PM-1047 y selección de ese informe en la muestra C a 375 px.
- Se revisaron visualmente las tres direcciones en escritorio y A en móvil; hay capturas locales en `work/cryopm-proposal-{a,b,c}.png`.
- JavaScript sin errores de sintaxis; lint sin errores y con las siete advertencias de imágenes ya existentes en la app. No se modificaron componentes, estilos ni datos de la aplicación funcional.
- Esta comprobación es de prototipos: no certifica accesibilidad ni sustituye la QA funcional y de impresión de una futura implementación.

## Referencias

- [Carbon: cuadrícula y estructura de navegación](https://www.carbondesignsystem.com/building-blocks/foundations/2x-grid/guidelines): referencia para el contenedor fluido y la relación entre navegación y contenido; las decisiones específicas de CryoPM son propuestas propias.
- [W3C: Reflow](https://www.w3.org/WAI/WCAG22/Understanding/reflow.html): referencia para reorganizar contenido en anchos pequeños y al ampliar la página.
- [W3C: tamaño mínimo de objetivos](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html): WCAG 2.2 define 24×24 CSS px con excepciones; 44 px es aquí una decisión de comodidad táctil, no una afirmación del mínimo AA.

## Aplicación aprobada — 22 de octubre de 2026

El usuario aprobó A2 con “aplícalo y luego vamos puliendo”. La app funcional ahora usa el contenedor completo y la navegación A; el Overview incorpora la composición estadística A2 y datos reales de PostgreSQL. La cuenta real y Sign out están dentro de la cabecera. Se retiró el marco exterior y el bloque visual de identidad demo; los formularios COVE, controles secuenciales y cierre firmado conservan su lógica.

- `app/workspace.css`: estructura, componentes operativos y adaptación responsive; estilos de pantalla separados del informe impreso.
- `features/pm/analytics/`: contratos, carga, gráficos, paneles y detalle paginado. IBM Plex Sans se sirve localmente mediante Fontsource.
- `app/api/pm-analytics/` y `lib/pm/analytics.ts`: agregados del historial completo del propietario autenticado. La selección de fechas usa `performed_on`; el período anterior tiene la misma duración. Los segmentos abren registros paginados y permiten abrir el informe real.
- Se conservan las muestras independientes en `/design-study/index.html`. Los 120 registros ilustrativos no se incorporaron a la base local.
- Equipment y Reports mantienen su listado existente de hasta 50 registros recientes; su alcance está indicado en pantalla. Overview y su detalle paginado consultan toda la cohorte filtrada.

Las referencias y capturas antiguas de este documento describen el estado previo, no la interfaz ahora implementada. Ver [implementación y pruebas](overview-dashboard-research.md#implementación-aprobada).

## Liquid glass y navegación móvil — 23 de octubre de 2026

El usuario aprobó un vidrio moderado y pidió navegación inferior con icono y texto para móvil. La implementación conserva IBM Plex Sans, la estructura A2 y los datos del Overview. Paleta: navy `#081D30`, superficie `#10293E`, cian `#22B8D5`, reflejo `#8BE3F0`, texto `#F4F8FB` y líneas translúcidas de azul hielo. La profundidad se concentra en la navegación, cabecera y superficies exteriores; las mediciones y campos conservan fondos legibles.

`app/glass.css` agrupa el acabado de pantalla: transparencias, degradados discretos, reflejos interiores y desenfoque CSS con alternativa más opaca cuando no hay soporte. Se respetan las preferencias de movimiento y transparencia reducidos. El documento blanco de los PM y los PDF conservan su presentación.

Hasta 950 px, la navegación existente se convierte en un dock inferior fijo, centrado, con icono y etiqueta, estado activo y cuatro o cinco destinos según el rol. PM workspace se abrevia visualmente a PMs y conserva su nombre accesible. Hay reserva de espacio inferior para los últimos controles y uso de safe-area para dispositivos con indicador de inicio. Desde 951 px se mantiene la navegación lateral.

Verificación: lint sin errores (ocho advertencias de imágenes existentes), TypeScript sin errores; revisión visual local de escritorio, móvil de 320 y 390 px y tablet de 768 px. Se comprobó el cambio entre secciones desde el dock, su posición al desplazarse y que las acciones del final del formulario quedan descubiertas. La revisión de tamaños se hace con la app real dentro de ventanas iframe del ancho indicado, sin simular hardware ni certificar el comportamiento de un dispositivo físico. Evidencia en `work/cryopm-liquid-glass-{desktop,mobile,tablet}.png`.

### Transparencia y luces de fondo

A petición del usuario, se aumentó la transparencia y se sustituyó el fondo casi uniforme por un campo fijo de luces difusas: cian en el lateral superior derecho, azul profundo en la zona inferior y un reflejo tenue a la izquierda. En móvil, las luces se dimensionan respecto a la ventana para conservar el efecto en pantallas estrechas. Las luces no se animan y la capa decorativa no captura interacciones.

Con soporte de backdrop-filter, las tarjetas usan opacidades entre 35 % y 48 %, la cabecera 48 % y el dock móvil entre 42 % y 55 %, combinadas con desenfoque y bordes iluminados. Los navegadores sin ese soporte conservan superficies más opacas. Las preferencias de menor transparencia o mayor contraste desactivan el campo de luces y el desenfoque en las superficies. Verificación visual local en escritorio y una ventana móvil de 390 px, incluida la posición del dock tras desplazarse. Evidencia: `work/cryopm-glass-lights-desktop.png` y `work/cryopm-glass-lights-mobile.png`.
