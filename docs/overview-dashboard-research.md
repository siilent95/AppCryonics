# CryoPM — Referencias actuales y Overview estadístico A2

22 de octubre de 2026. La dirección A y su estructura a ventana completa fueron elegidas por el usuario. El Overview requiere una nueva propuesta estadística; la tabla de registros no debe dominar la primera pantalla. Esta decisión afina la propuesta visual y no aprueba todavía su integración funcional.

## Referencias consultadas

Se revisaron páginas oficiales actuales y ejemplos públicos; no se accedió a cuentas privadas ni se asumió acceso a dashboards autenticados.

| Referencia | Patrón observado o documentado | Aplicación propuesta a CryoPM |
|---|---|---|
| [Stripe Dashboard](https://support.stripe.com/questions/dashboard-home-page-charts-for-business-insights?locale=en-GB) | Gráficos con rango de fecha, granularidad y periodo de comparación. | Filtro temporal compartido y cifras comparadas con el periodo anterior equivalente. |
| [Linear Dashboards](https://linear.app/docs/dashboards) e [Insights](https://linear.app/docs/insights) | Mezcla de tendencias, distribuciones y tablas; filtros globales y apertura del detalle desde un gráfico. Se examinó también la imagen pública Bug Performance Dashboard. | Gráficos que responden preguntas distintas y permiten consultar los PM que componen un resultado. |
| [Grafana](https://grafana.com/docs/grafana/latest/visualizations/dashboards/build-dashboards/best-practices/) | Jerarquía de lo general al detalle, paneles con una pregunta y gráficos comprensibles. | Un gráfico temporal dominante, estado documental a su lado y dos distribuciones debajo. La paleta conserva la identidad de CryoPM. |
| [MaintainX Reporting](https://help.getmaintainx.com/about-reporting) | Analítica de órdenes y activos, filtros temporales, agrupaciones y detalle operativo. | Separar estado del documento de salud física del equipo. Inspiración de dominio para mantenimiento, respetando las métricas que CryoPM realmente registra. |

La recomendación propia es combinar la claridad temporal de Stripe, las interacciones de Linear y la jerarquía de paneles de Grafana dentro de la estructura A. No se propone copiar un producto ni adoptar sus funciones completas.

## Preguntas que debe responder Overview

1. ¿Cómo se distribuyen los registros PM en el tiempo?
2. ¿Qué parte está cerrada documentalmente y qué queda en borrador o revisión?
3. ¿En qué secciones se documentan más observaciones?
4. ¿Cómo se distribuye el trabajo registrado por laboratorio o marca?
5. ¿A qué equipo corresponde el contexto seleccionado y cómo se llega a sus registros?

## Composición A2

```text
| navegación A | título / periodo / marca / New PM                |
|              | registros / cerrados / abiertos / equipos        |
|              | actividad temporal             | estado de PM   |
|              | observaciones COVE | labs/marca | equipo        |
```

La imagen permanece en un bloque compacto de contexto. La tabla completa se consulta en Reports o al abrir un segmento estadístico. Se conservan navy, cian, navegación lateral y usuario integrado. Los gráficos usan ejes y escalas claras, etiquetas, estados con texto, foco de teclado y una alternativa tabular en los detalles.

## Definiciones y viabilidad

| Panel o indicador | Definición propuesta | Fuente disponible | Trabajo necesario para producción |
|---|---|---|---|
| Registros del periodo | PM no archivados con `performed_on` dentro del rango. Los que no tienen fecha se deben informar por separado. | `pm_records.performed_on`, `status` | Consulta agregada completa. |
| Actividad temporal | Cantidad de registros agrupados por fecha de ejecución declarada, segmentada por su estado actual: cerrados y abiertos. | `performed_on`, `status` | Serie agregada; no interpretarla como historial de transiciones ni cierres ocurridos en esa fecha. |
| Cierre documental | Completados / (completados + borradores); división por cero muestra ausencia de datos. | `status` | Agregado por cohorte. No es cumplimiento del calendario ni condición del equipo. |
| En revisión | Borradores cuyo `current_step` es `review`; es una subcategoría visual de los abiertos. | `status`, `current_step` | Regla calculada; `ready_for_signature` existe en el esquema pero el flujo actual no lo establece normalmente. |
| Observaciones COVE | PM con texto no vacío en las notas de cada sección; un PM puede aparecer en varias secciones. | `payload_json.notes` | Agregación del payload en el servidor. No confundir una observación ni N/A con una avería. |
| Por laboratorio / marca | Conteo de PM dentro de la misma cohorte y filtros. | `lab_name`, `brand` | Agrupación; conservar una categoría para laboratorio no informado. |
| Equipos con PM | Series únicas por marca dentro de los registros filtrados. | `brand`, `freezer_serial` | Normalización y conteo; excluir series ausentes y reportarlas. No representa cobertura de una flota registrada independientemente. |
| Comparación anterior | Misma longitud de periodo y mismos filtros, inmediatamente antes del rango actual. | Fechas y campos anteriores | Calcular ambos periodos sobre la base completa, sin seleccionar solo los registros recientes. |

Para analizar cierres por su fecha real de firma se usaría `technician_signature_captured_at` o el evento `signature_captured`, con otra etiqueta. No usar `updated_at` como si fuese una fecha de ejecución, cierre o duración de trabajo.

La API de listado actual retorna solo los últimos 50 registros y está limitada al propietario autenticado. La analítica implementada utiliza endpoints de agregación con el mismo aislamiento de acceso; no calcular totales históricos o de toda la empresa a partir de ese listado parcial. El payload de notas tampoco viene en el resumen de listado. La implementación añade consultas y respuestas sin cambiar el esquema.

## Métricas que requieren ampliar los datos

- Cumplimiento de PM programados y vencimientos: requieren programación y fechas previstas.
- MTTR, MTBF, disponibilidad y downtime: requieren fallos, intervalos de reparación y transiciones operativas.
- Temperatura en vivo y alarmas actuales: requieren telemetría.
- Horas trabajadas, costes y productividad horaria: requieren captura de duración y costes.

## Muestra A2

El comparador mantiene las propuestas B y C y permite consultar la A anterior mediante `preview.html?concept=a&overview=records`. La A principal incorpora ahora una muestra estadística con datos sintéticos y filtros. El conjunto ilustrativo no se importa a PostgreSQL ni representa los registros del usuario.

Decisión posterior: A2 aprobada por el usuario y aplicada a la app local; ver la implementación al final.

## Verificación de la muestra

- La A2 usa 120 registros sintéticos distribuidos en 180 días. La selección inicial de 90 días incluye 61 registros: 41 completados y 20 abiertos, repartidos en 11 borradores y 9 en Review. El porcentaje de cierre mostrado es 67% por redondeo.
- En 1440, 1280, 768 y 375 px el documento no desborda horizontalmente. La serie muestra 13 intervalos semanales en escritorio/tablet y 6 agrupaciones en móvil. En cada caso la suma de los intervalos y la de los estados coincide con los 61 registros de la selección.
- Se verificó el cambio a 30 días y marca MVE: 11 registros, 7 completados y 4 abiertos. Abrir Review devuelve los 2 registros de esa subcategoría; Escape cierra el detalle.
- Se revisó la distribución por marca: en la selección inicial hay 32 PM MVE y 29 Taylor-Wharton. Son cantidades de registros, no tamaños de flota.
- Las muestras B, C y la A anterior se conservan. Ningún dato ilustrativo se guardó en PostgreSQL; los componentes y API de la app funcional siguen sin cambios por este estudio.

## Implementación aprobada

Fecha: 22 de octubre de 2026. A2 está integrada en la app autenticada, con agregados reales y componentes separados.

- `GET /api/pm-analytics?days=7|30|90&brand=all|mve|taylor&end=YYYY-MM-DD`: totales del propietario, comparación anterior, serie diaria, estados, observaciones, distribución y último equipo de la selección. El cliente agrupa por día/semana y adapta los intervalos en móvil.
- `GET /api/pm-analytics/records` aplica la misma cohorte y admite segmentos de período, estado, sección, laboratorio, marca y equipo. Devuelve 25 registros por página; desde el detalle se abre el informe almacenado.
- Registros eliminados y archivados quedan excluidos. Las fechas ausentes o inválidas se informan fuera de la cohorte temporal. Las series ausentes no cuentan como equipos; las presentes se normalizan con mayúsculas y espacios exteriores, por marca.
- Review incluye `ready_for_signature` y borradores en el paso review. Los otros abiertos son Draft; Completed depende del estado del registro. La tasa es completados / total de registros de la cohorte.
- Las observaciones cuentan texto con contenido en cada sección, excluyendo espacios, saltos de línea y tipos no textuales. Los payloads importados malformados o no convertibles a JSONB no interrumpen el dashboard.
- Consultas parametrizadas, sesión obligatoria, aislamiento por propietario y respuestas privadas sin caché. El cliente cancela las cargas anteriores al cambiar filtros para evitar mezclar selecciones.
- No se agregaron índices o migraciones ni se importaron datos del prototipo. El entorno local conserva su PM sintético ya existente.

La imagen del equipo es una referencia del catálogo, no una fotografía del activo. Las estadísticas siguen representando documentación registrada; no incorporan telemetría, calendario ni condición física del equipo.

## Tres modelos con más PMs

El panel «Most used equipment» muestra los tres modelos con más registros dentro del periodo, marca y permisos seleccionados. Agrupa por fabricante real, familia y modelo: un mismo código en HEco y CryoVerse conserva dos entradas distintas. Incluye completados y abiertos; excluye eliminados, archivados y fechas fuera de la selección, igual que el resto del dashboard. Empates se resuelven por fabricante, familia y modelo para mantener un orden estable.

Cada tarjeta muestra foto del catálogo, cantidad de PMs y porcentaje del total filtrado. Al abrirla se consultan los registros de esa combinación exacta, con la misma autorización y paginación. Si existen menos de tres modelos, solo se muestran los disponibles; una selección vacía muestra un mensaje. La agregación ocurre en PostgreSQL sobre todos los registros permitidos, sin depender del límite de Reports.

Prueba local solicitada: `npm run qa:catalog` crea de forma idempotente seis registros sintéticos usando los identificadores reales del catálogo: tres HEco 800 / 815P-190, dos K-Series / 24K y uno HE Series CryoVerse Connect / 815P-190. Cuatro se completan con las marcas QA de prueba ya usadas por el proyecto y dos quedan en borrador. Se guardan bajo la cuenta técnica local de prueba y el administrador puede verlos. El script se limita a la base local administrada, pasa por los validadores de creación/firma y no sobrescribe registros de usuario. El resultado se registra en work/catalog-qa-records.json.

Verificado el 23 de octubre de 2026: 19 pruebas aprobadas; tipos y lint de los archivos cambiados sin errores (advertencia habitual de img). La integración comprueba el límite de tres, códigos compartidos entre familias, filtros, exclusión de archivados/eliminados, aislamiento de cuentas, acceso conservado por el creador tras reasignación y detalle por modelo. La carga local se ejecutó dos veces y conservó 9 PMs totales, sin duplicar los seis nuevos. Ranking local: HEco 800 / 815P-190 (4), K-Series / 24K (2), HE Series CryoVerse Connect / 815P-190 (1). Se revisó la app en escritorio y a 390 px con un iframe temporal retirado al terminar. Capturas: work/cryopm-top-equipment.png y work/cryopm-top-equipment-mobile.png.

## Verificación de la implementación local

- `npm test`: 13 pruebas aprobadas. La nueva prueba de integración usa 75 PM del propietario en la cohorte, cinco en el período anterior y registros de otra cuenta, archivados, eliminados o sin fecha. Comprueba el agregado completo, filtros, dos páginas de detalle, exclusión de datos privados, normalización de series, series ausentes, estado Review y payloads no convertibles a JSONB.
- `npm run build -- --webpack`: compilación de producción y TypeScript correctos. `npm run typecheck` también pasó durante la integración.
- `npm run lint`: sin errores; ocho advertencias `no-img-element`, incluidas las imágenes existentes y la nueva referencia de equipo.
- Revisión de UI real: Overview sin desbordamiento horizontal a 375, 768, 1280 y 1440 px. A 1280 px el contenedor empieza en x=0, llega a x=1280 y tiene margen/radio exterior de 0 px. Serie de 13 intervalos en 90 días de escritorio/tablet y seis en móvil.
- A 375 px se comprobaron filtro de marca con estado vacío, detalle estadístico con desplazamiento de tabla contenido, bloqueo del formulario incompleto, Equipment, Reports e informe abierto, sin ampliar el documento horizontalmente.
- Se abrió el informe real desde View data. Escape cierra el diálogo y devuelve el foco al botón de origen. Se verificó la legibilidad de la pantalla de acceso tras aplicar el nuevo fondo.
- Las reglas de impresión existentes permanecen fuera de las nuevas reglas de pantalla. La prueba de estructura del informe completo sigue pasando; en esta iteración no se generó un PDF firmado nuevo.
- Capturas: `work/cryopm-a2-applied.png` y `work/cryopm-a2-applied-panels.png`. El archivo de apoyo temporal para comprobar tamaños fue retirado.
- App y PostgreSQL persistente quedaron ejecutándose mediante `npm run dev:local`. La base de uso local conserva el único borrador QA anterior; los datos adicionales de las pruebas usan PostgreSQL temporal separado.
