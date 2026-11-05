# CryoPM: implementación offline

Rama: `codex/offline-persistence`. Fecha: 5 de noviembre de 2026.

Implementación y verificación local. Aún no publicada en el piloto.

## Uso durante una visita

1. Iniciar sesión con conexión. En una compilación de producción, la primera sesión prepara automáticamente la interfaz pública, los PMs autorizados, sus detalles/versiones/firmas y las imágenes del catálogo.
2. Consultar **Device status**. Confirmar que indica **Prepared for offline visits**, revisar cantidades y fecha. **Prepare / update device** actualiza la copia antes de una visita. **Include datasheets** descarga además los documentos y el visor PDF.
3. Los campos y trazos terminados se guardan automáticamente en la tablet. **Save draft**, **Save and continue** y **Save & exit** confirman el borrador local y permiten enviarlo. Después de ese primer guardado, las modificaciones se sincronizan automáticamente cuando hay acceso al servidor.
4. Sin señal se puede reabrir la app, consultar datos preparados, continuar PMs, guardar y salir, crear otros y previsualizarlos. Un cierre queda pendiente hasta que el servidor valida datos y firmas. Las funciones de administración y el PDF oficial requieren conexión.
5. Al recuperar conexión se comprueba la identidad y se envían los pendientes. También se puede pulsar **Synchronize now**. Si venció la sesión, iniciar sesión como el mismo técnico; sus copias siguen conservadas.
6. Antes de entregar la tablet, sincronizar todos los PMs como borrador o completos y cerrar sesión. La salida se bloquea con trabajo pendiente o pestañas de edición de otro documento. Tras una salida confirmada se eliminan copias privadas y claves del técnico; los datos confirmados permanecen en el servidor.

No se requiere PIN adicional. Safari y la PWA instalada deben prepararse y probarse por separado; no asumir que comparten almacenamiento.

## Arquitectura y garantías

- IndexedDB `cryopm-offline-v1`: datos privados cifrados con AES-GCM y clave no exportable por técnico. La clave permanece en IndexedDB para la continuidad sin PIN; esto no protege frente a quien ya usa la tablet desbloqueada ni frente a código malicioso en el mismo origen. No se almacenan contraseñas ni cookies de sesión.
- Escrituras locales con transacciones y comparación de versión cifrada. Los errores de cuota o almacenamiento aparecen como fallos; no se convierten en confirmaciones de guardado.
- Una operación en vuelo es inmutable y se conserva hasta recibir una confirmación válida. Las ediciones posteriores se mantienen separadas de la versión enviada.
- `POST /api/pm-sync`: transacción que actualiza/crea el PM, conserva capturas provisionales o finaliza, registra auditoría y confirma la operación. Tabla `pm_sync_operations` con clave única técnico + operación, huella del contenido y respuesta durable. Un reintento tras perder la respuesta devuelve la confirmación original.
- Sesión, origen y cabecera de titular se comprueban en cada envío. Cambiar la cookie entre la comprobación previa y el POST no puede atribuir trabajo al nuevo usuario. Las lecturas preparadas comprueban también el titular devuelto por el servidor.
- Revisiones atómicas del PM conservan los controles existentes de permisos e identidad fija del equipo. Un conflicto bloquea ese PM; otros siguen sincronizando. La pantalla permite comparar copias, conservar el servidor o aplicar explícitamente la local sobre la revisión actual. Se conserva una copia de recuperación hasta el cierre de sesión.
- Web Locks evita editar el mismo PM en dos pestañas y libera el bloqueo al destruirse el documento. Hay una concesión temporal como respaldo para navegadores sin Web Locks. No hay bloqueo global de técnicos o PMs.
- El service worker guarda únicamente la interfaz pública y recursos públicos en Cache API. Los documentos e imágenes privados se recuperan de la bóveda del técnico activo. No se guardan páginas autenticadas, respuestas de inicio de sesión, JSON privado de API ni mutaciones en la caché pública.
- La preparación recorre todas las páginas autorizadas, no solo los 25 PMs de la página visible. Descarga detalles e historial, capturas provisionales y firmas vigentes. Si cambia la colección o falta espacio, avisa de preparación incompleta y conserva borradores. Las imágenes se preparan aunque no se haya visitado cada modelo.
- Ninguna actualización del service worker fuerza una recarga ni descarta una cola activa. Se conservan los recursos anteriores mientras existan clientes. Actualizar la preparación con conexión carga la interfaz vigente para la siguiente apertura offline.
- La hora declarada por el dispositivo se conserva para auditoría. La confirmación, revisión y retención oficiales siguen basadas en la hora del servidor.

## Migración y operación

Aplicar `drizzle/0006_offline_sync.sql` mediante el flujo habitual de migraciones, usando un propietario autorizado. Crea `pm_sync_operations` y `pm_draft_captures`, activa RLS y permite solo el rol backend `cryopm_app` si existe. No concede acceso a `anon`/`authenticated` de Supabase. El proceso normal de la aplicación sigue usando el rol limitado, sin DDL.

No eliminar el registro de operaciones al borrar un PM: es necesario para impedir que un reintento antiguo vuelva a crearlo. La captura provisional se elimina al completar o al eliminar definitivamente su PM mediante cascada. La tabla de operaciones contiene identificadores, huellas y confirmaciones; no contiene formularios ni imágenes.

Para validar la PWA local con recursos estables:

```sh
node scripts/dev-local.mjs --production
```

Este comando usa únicamente el PostgreSQL administrado local en `127.0.0.1:15433` y compila antes de iniciar. No ejecutar simultáneamente con otro servidor que use el mismo directorio `.next`. El modo de desarrollo con HMR sirve para editar, pero no certifica la reapertura offline.

## Evidencia local

- Suite completa final: 44 pruebas aprobadas. También pasó la suite PostgreSQL con pruebas HTTP contra el build de producción (20 pruebas), incluidas sesión, CSP, controles de acceso y salida. Compilación y comprobación TypeScript correctas; ESLint sin errores (con avisos informativos sobre imágenes sin optimizador y navegación completa al salir).
- PostgreSQL: reintentos concurrentes de la misma operación, conflicto de revisiones, técnico distinto con PM distinto, capturas provisionales, cierre firmado, repetición del cierre, rechazo por sesión/origen/titular, reversión completa de cierre inválido y coincidencia de estadísticas offline con SQL.
- IndexedDB simulado: cifrado y separación, clave no exportable, alteración detectada, actualizaciones simultáneas, recarga, respuesta perdida, edición posterior al envío, aislamiento del conflicto, fallo de almacenamiento y salida con limpieza después de confirmar.
- Navegador local, build de producción: formulario recuperado y editable tras recargar; servidor pausado y reapertura desde el service worker; edición, Save & exit y segundo PM independiente; vista previa offline. Al volver el servidor, ambos llegaron una sola vez: `PM-3F2442FF` (revisión 2, conserva la observación escrita offline) y `PM-AAD0C445` (revisión 1).
- Preparación comprobada: 10 informes, 26/26 imágenes disponibles del catálogo y 30/30 datasheets. Catálogo con imágenes cargadas a 820 × 1180. Vista previa a 390 × 844 sin desbordamiento horizontal. Datasheet de HEco 800 visualizado con servidor pausado, navegación a página 2 y texto legible, sin errores de consola.

## Pendiente antes de campo

Validar Safari y PWA instalada en iPad físico: modo avión real, suspensión/cierre forzado, lápiz/firma, rotación, teclado y almacenamiento. El navegador local simula indisponibilidad del servidor; no sustituye esa prueba de iPadOS. Probar además un historial y cantidad de tablets representativos, reautenticación real y relevo entre cuentas QA.

El navegador puede borrar datos locales por una decisión del usuario o por sus políticas de almacenamiento. Solicitar almacenamiento persistente no garantiza su conservación. Preparar antes de la visita, comprobar las confirmaciones y sincronizar antes del relevo sigue siendo parte del flujo.
