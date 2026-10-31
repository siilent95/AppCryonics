# Desarrollo local de CryoPM

Base de trabajo: `migracion-postgresql-modular`. Este entorno usa Next.js con Webpack y PostgreSQL 17 local mediante la dependencia `embedded-postgres`, sin instalar Docker ni cambiar el sistema.

```sh
npm ci
npm run dev:local
```

Abrir http://localhost:3000. El primer arranque crea una cuenta sintética de prueba; el correo y la contraseña están en `CRYOPM_LOCAL_TEST_EMAIL` y `CRYOPM_LOCAL_TEST_PASSWORD` dentro de `.env.local`. El archivo se genera con permisos privados y queda excluido de Git. No usar datos reales en este entorno.

El comando arranca PostgreSQL en `127.0.0.1:15433`, aplica las migraciones pendientes y arranca la app en el puerto 3000. Ctrl+C detiene ambos procesos. Los registros y las firmas persisten en `work/postgres-local/` entre arranques; conservar esa carpeta y `.env.local` juntos. El lanzador no sustituye un `.env.local` existente y exige su configuración local propia.

Para pruebas automatizadas, que usan otra base temporal en el puerto 15432:

```sh
mkdir -p work
npm test
npm run lint
npm run build -- --webpack
```

La compilación con Webpack evita el bloqueo de puertos internos de Turbopack observado en el entorno de Codex de macOS. La rama conserva sus comandos originales para otros entornos.

Si las dependencias se instalaron con `--ignore-scripts` en macOS Apple Silicon, ejecutar `npm rebuild @embedded-postgres/darwin-arm64` antes del primer arranque para preparar los enlaces de sus bibliotecas nativas.

Este arranque no importa los datos de la beta ni cambia el despliegue publicado.

## Estado verificado — 22 de octubre de 2026

- Repositorio clonado en `Cryogenics/AppCryonics`, rama `migracion-postgresql-modular`, base `d33e8bf`.
- Arranque local, inicio de sesión y guardado de un borrador comprobados desde el navegador.
- El borrador sintético `LOCAL-QA-001` permanece visible en Reports después de detener y reiniciar la app y PostgreSQL.
- Las 12 pruebas automatizadas pasan; TypeScript pasa; lint termina sin errores y conserva siete advertencias de imágenes preexistentes.
- Los cambios de preparación local están sin commit ni push. El siguiente trabajo puede hacerse sobre este entorno en ejecución.

## PM completos para probar PDF

Desde el entorno local administrado, ejecutar `npm run qa:seed`. Crea o reutiliza un PM MVE y uno Taylor-Wharton con todos los campos y marcas de firma sintéticas. Ver [descarga de PDF y evidencia de QA](pdf-downloads.md). No ejecutar esta preparación contra bases de producción; el script valida el entorno y rechaza otros destinos.


## Recuperación del servicio local — 23 de octubre de 2026

Se encontró que no había procesos escuchando en los puertos 3000 ni 15433. Se reinició el lanzador en un proceso independiente de la sesión de ejecución, con salida en `work/dev-local.log` y PID en `work/dev-local.pid`. Esto no configura inicio automático al encender el equipo.

Comprobación HTTP posterior: inicio de sesión 303 con cookie, lista de registros 200 (tres PM, dos completados) y ambos endpoints PDF 200 con cabecera `%PDF-`. No fue necesario modificar el código ni restaurar datos.

Antes de iniciar otra instancia, comprobar si localhost:3000 ya responde. El comando manual `npm run dev:local` sigue disponible cuando el servicio esté detenido.

## Cuentas y permisos — 23 de octubre de 2026

La migración local incorpora los roles admin y technician, creador y técnico asignado de cada PM, invitaciones y auditoría administrativa. Ver [gestión de cuentas y permisos](account-management-proposal.md). La cuenta local `silentCryo` está activa como administrador; la contraseña fue la indicada por el usuario y no se registra aquí.

El comando de creación por consola admite `email displayName [technician|admin] [username]` y obtiene la contraseña de `CRYOPM_BOOTSTRAP_PASSWORD`. Las cuentas creadas desde Users se activan mediante una invitación privada válida por 24 horas y el titular establece su contraseña.

Validación actual: 16 pruebas pasan y la compilación de producción con Webpack pasa. El servidor local se deja ejecutándose con el lanzador independiente descrito arriba; no se configura inicio automático al encender el equipo.

## Catálogo de equipos — 23 de octubre de 2026

Las migraciones 0002 y 0003 se aplicaron a la base local. Equipment contiene 30 modelos iniciales sin depender de los PM de prueba. Las cargas de imagen/PDF posteriores persisten en PostgreSQL; incluir la base y public/equipment-assets al respaldar o desplegar. El worker y los recursos PDF.js se sirven desde la app, con trazado explícito para standalone. Ver [catálogo y fuentes](equipment-catalog.md).


## Limpieza de papelera — 23 de octubre de 2026

La migración 0005 añade un índice sobre deleted_at. Los PMs eliminados pueden restaurarse durante 25 días exactos; después el servidor elimina sus versiones, eventos y firmas sin referencias. Next.js activa el mantenimiento al arrancar y una vez cada 24 horas mientras el proceso Node esté activo. Reports ejecuta además una limpieza al entrar; filtros, paginación, refrescos y exportaciones no vuelven a solicitarla en esa visita. Para una ejecución operativa manual o un planificador externo existe `npm run trash:purge`. Ver [política y pruebas de Reports](reports-management.md).
