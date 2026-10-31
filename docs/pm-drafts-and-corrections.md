# Borradores, salida y correcciones

23 de octubre de 2026. Flujo actualizado según la última decisión del usuario.

## Guardar, cerrar y crear otro PM

PM workspace abre un formulario nuevo cuando no hay un PM retomado en esa sesión. Cambiar entre secciones conserva campos y paso en memoria. Save draft y Save and continue guardan en PostgreSQL. Save & exit guarda los cambios pendientes, cierra el contexto del PM y vuelve a Reports. Un error de guardado conserva el formulario abierto y muestra el error. Si no se introdujo contenido, cerrar un formulario vacío no genera un registro. Los PM ya completados muestran Close PM y no intentan guardarse como borradores.

New PM en Reports permite iniciar un formulario limpio. Si había otro PM abierto, primero conserva sus cambios. El contexto nuevo limpia identificación, respuestas, observaciones, mediciones y firmas; el borrador anterior sigue disponible con Continue draft. Retomar restaura el paso guardado, limitado por las validaciones de las secciones anteriores. El formulario no se guarda en localStorage ni sessionStorage. Las firmas de un PM original se almacenan al completarlo; una firma pendiente de completar no forma parte del guardado de borrador.

## Identidad del equipo

Después del primer guardado, marca, familia y modelo quedan fijos tanto en interfaz como en PUT del servidor, también para admin y para correcciones. La marca real del catálogo tampoco puede reemplazarse por otra equivalente en plantilla. Para otro equipo se inicia un PM nuevo. El técnico asignado y admin conservan los permisos de edición del resto de campos; el creador conserva consulta tras una reasignación.

## Correcciones sin solicitar firmas nuevas

El administrador o el técnico asignado crean una corrección de la última versión completada con un motivo obligatorio. Se copian los campos y se agrega R2, R3, etc., con numeración documental independiente de las revisiones de guardado. El documento anterior no se modifica.

Finalize correction valida identificación, comprobaciones COVE, observaciones necesarias, mediciones y ajustes; registra autor, fecha y motivo y cierra la versión sin capturar firmas nuevas. Las firmas originales se mantienen exclusivamente en su documento de origen. La vista y el PDF corregidos incluyen su referencia de versión y fecha originales, distinguiéndolas de la corrección y de su autor. No se copian blobs, claves o fechas como si fueran firmas nuevas. Si hubo una versión posterior firmada con el flujo anterior, esa es la referencia más reciente. La retención original de seis años continúa aplicándose, incluida la eliminación de firmas vencidas.

POST /api/pm-records/[id]/corrections/finalize exige sesión, mismo origen, permisos de escritura y revisión actual. Solo cierra una corrección en borrador, conserva asignación y creador y añade el evento correction_finalized. El PM original sigue necesitando las firmas iniciales. No fue necesaria otra migración: las columnas de la migración 0004 y la auditoría existente conservan los datos del nuevo flujo.

## Historial y estadísticas

Version history usa un selector con contador y navegación anterior/siguiente, con altura independiente de la cantidad de versiones. El motivo se consulta en un desplegable con desplazamiento limitado. La prueba visual del componente real con 2 y 500 versiones conserva la misma composición y altura.

Las versiones anteriores siguen disponibles para consulta y PDF. El acceso al historial sigue los permisos de la última versión de la cadena: admin, técnico asignado o creador original. Reasignar la versión actual revoca el acceso del técnico anterior que no sea creador, también para las firmas y PDFs de versiones anteriores.

Reports y el dashboard utilizan la última versión no eliminada de cada cadena y cuentan un mantenimiento por PM. Mientras una corrección esté abierta, su estado actual es borrador. Las versiones históricas conservan su estado y contenido anteriores.

## Verificación local

20 pruebas aprobadas: identidad fija, permisos, control de revisión, finalización sin firmas nuevas, validación de valores incompletos, referencias de firmas a través de varias correcciones, conservación del documento original, PDF con autor y aclaración de firmas originales, conteo único y reasignación. Tipos y lint sin errores (advertencias habituales de img).

En navegador se creó y finalizó PM-8BA59282-R2 usando datos sintéticos: se modificó una nota, Save & exit la conservó, New PM mostró un formulario limpio, Continue draft recuperó nota y paso Review y Finalize correction cerró sin solicitar firmas. Los campos de marca/familia/modelo quedaron bloqueados. Se verificó Save & exit a 390 px con la app real en un iframe temporal. Las páginas auxiliares se retiraron al terminar.

Evidencia local: work/cryopm-history-500-versions.png, work/cryopm-save-exit-mobile.png y work/cryopm-correction-workflow.png. La primera corresponde a una prueba visual estática del componente real con datos de estrés; no añadió 500 PMs ni versiones a PostgreSQL.
