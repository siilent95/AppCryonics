# Descarga directa de informes PDF

Implementado el 23 de octubre de 2026 a petición del usuario.

## Comportamiento

- Reports ofrece **Download PDF** para PM completados y firmados. El botón prepara y descarga el archivo; no llama a `window.print()` ni abre el diálogo de impresión. Los borradores mantienen el botón deshabilitado.
- El navegador guarda en su carpeta de descargas configurada o solicita ubicación si el usuario tiene activada esa preferencia. Una aplicación web no elige libremente una carpeta del equipo.
- `GET /api/pm-records/[id]/pdf` exige sesión y propiedad del registro. Devuelve 401 sin sesión, 404 para registros ajenos/eliminados y 409 para PM no completados. La respuesta PDF lleva `Content-Disposition: attachment`, `no-store, private` y `nosniff`.
- El servidor genera texto y tablas vectoriales, imagen de referencia, todas las secciones COVE, mediciones, observaciones y ambas firmas disponibles. Respeta la retención: una firma retirada se indica como no disponible, sin recuperarla de copias antiguas.
- No se usa un servicio externo ni un navegador sin interfaz. PDFKit y Sharp operan localmente en Node. Las fuentes DejaVu y su licencia acompañan el renderer. Los recursos se incluyen explícitamente en el paquete standalone.
- Los informes se generan al solicitar la descarga; no se añade un archivo permanente del PDF en la base. El guardado del PM, eventos y firmas sigue siendo PostgreSQL.

## PM sintéticos de prueba

Cuenta: `tester@cryopm.local`. Se crearon dos registros mediante los handlers reales de creación y firma, sin modificar registros anteriores:

| Marca | Registro | Serie | Estado |
|---|---|---|---|
| MVE | PM-A5771A46 | QA-PDF-MVE-001 | completed, revisión 2 |
| Taylor-Wharton | PM-5A11CBFF | QA-PDF-TAYLOR-001 | completed, revisión 2 |

Todos los campos de identificación, cuestionarios, notas y mediciones tienen valores de prueba. El técnico se identifica como `QA Technician - synthetic`; las imágenes dicen `QA ... - TEST ONLY`. No representan inspecciones ni firmas personales reales.

`npm run qa:seed` permite reproducir la preparación únicamente en la base local administrada `127.0.0.1:15433/cryopm`. Reutiliza esos registros completados y no crea duplicados al repetirse. Revoca la sesión temporal que utiliza al terminar. Los archivos de apoyo se guardan en `output/pdf/`, excluido de Git.

## Verificación

- 14 pruebas aprobadas. La prueba PDF comprueba estado, sesión, propiedad, cabeceras, texto, caracteres Ω/°C, campos MVE/Taylor, imagen de equipo y ambas firmas. Comprueba además notas largas completas y exportación tras expirar las firmas.
- Compilación webpack de producción y TypeScript correctos. Lint sin errores; permanecen ocho advertencias sobre imágenes HTML.
- Inspección visual de las doce páginas de los dos PDF finales: seis páginas cada uno. Se revisó también un informe de diez páginas con notas largas; no se observaron cortes ni superposiciones.
- Descarga real desde el botón de Reports comprobada para ambas marcas. Archivos guardados por el navegador en `~/Downloads/PM-A5771A46-mve.pdf` y `~/Downloads/PM-5A11CBFF-taylor.pdf`.
- Se comprobó que el trace del endpoint y el directorio standalone incluyen fuentes, licencia, logo e imágenes.
- App y PostgreSQL local quedaron nuevamente en ejecución mediante `npm run dev:local`.
