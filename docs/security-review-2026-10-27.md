# Revisión de seguridad de CryoPM — 27 de octubre de 2026

**Resultado:** se corrigieron riesgos verificables del código y dependencias. La aplicación superó la revisión local y de producción descrita abajo. El piloto con datos reales queda condicionado a verificar el servidor HTTPS, aislamiento de PostgreSQL, copias de seguridad y límites por IP. No se ha inspeccionado todavía un servidor o dominio del cliente.

Esta revisión no certifica ausencia total de vulnerabilidades ni demuestra que nunca haya existido una filtración. No se revisaron logs de una instalación publicada, servicios externos ni versiones desplegadas de la beta. Las conclusiones corresponden a esta copia local de `migracion-postgresql-modular`.

## Alcance y método

Se revisaron autenticación, sesiones, activaciones/reset, roles, autorización de PMs y versiones, estadísticas, firmas, PDFs, catálogo y archivos adjuntos, SQL, entradas, secretos, caché, cabeceras, exportaciones y dependencias. Se ejecutaron pruebas negativas y de funcionamiento contra PostgreSQL temporal, separado de la base de trabajo. Las comprobaciones en navegador usaron una compilación de producción con cuentas y marcas de firma sintéticas en `127.0.0.1:3101` y PostgreSQL aislado en `127.0.0.1:15434`.

No se enviaron PMs, firmas reales, contraseñas ni código de la aplicación a escáneres externos. npm audit consultó avisos públicos a partir del árbol de dependencias. No se hizo explotación destructiva ni pruebas de carga sobre servicios del cliente.

## Hallazgos y correcciones

| Prioridad | Hallazgo confirmado | Acción y resultado |
| --- | --- | --- |
| Crítica / alta | La instalación contenía Next.js 16.3.8 y Sharp 0.35.4, con avisos publicados de ejecución de código y denegación de servicio bajo determinadas condiciones. La presencia de una versión afectada no demuestra explotación. | Next.js y eslint-config-next actualizados a **16.4.3**, Sharp a **0.35.5**; source-map-js a **1.2.2** y Zod a **4.6.7**. Compilación y regresión verificadas. |
| Media | Lecturas completas de JSON/formularios permitían consumir memoria antes de comprobar el tamaño, especialmente sin Content-Length. Algunas mutaciones de PM analizaban el cuerpo antes de autenticar. | Límites por bytes durante la lectura, incluso con tamaños declarados falsos; autenticación antes del cuerpo; rechazo 413; JSON limitado a 32 niveles. PM: 192 KB de petición y 128 KB de payload; cuentas: 8 KB; login: 4 KB; firmas: 1.04 MB de petición. |
| Media | Faltaban protecciones generales del navegador y una política de scripts. | CSP con nonce aleatorio por documento, sin unsafe-inline/unsafe-eval para scripts de producción; bloqueo de objetos, formularios externos, enmarcado y conexiones de datos a terceros. X-Frame-Options DENY, nosniff, Referrer-Policy same-origin, CORP y COOP same-origin y restricciones de permisos. Respuestas privadas sin caché; HSTS en las rutas de aplicación cuando APP_ORIGIN usa HTTPS. |
| Media | Una celda CSV entrecomillada podía seguir ejecutándose como fórmula en una hoja de cálculo. | Neutralización de prefijos de fórmula y controles iniciales, conservando comillas, comas y saltos de línea. Pruebas de regresión incluidas. |
| Media | Las firmas se validaban por cabecera PNG, pero sin comprobar su decodificación completa ni dimensiones. | PNG completamente decodificable, sin animación, con tope de 2 megapíxeles y 384 KB por firma. Las imágenes válidas conservan sus bytes y comprobantes. Se rechazan PNG falsos y dimensiones excesivas. |
| Media | La creación de sesión podía ocurrir tras comprobar una contraseña que hubiera cambiado concurrentemente. El coste de scrypt quedaba en los valores predeterminados antiguos. | Relectura y bloqueo del usuario antes de crear la sesión; rechazo si cambió el hash o el estado de la cuenta. Scrypt explícito N=32768, r=8, p=3 y sal aleatoria; hashes antiguos compatibles y actualizados al iniciar sesión correctamente. La contraseña del usuario no cambia. |
| Baja / disponibilidad | Activaciones con tokens inventados podían calcular un hash costoso y registrar intentos antes de verificar el enlace. | Los enlaces inexistentes, caducados, revocados o de cuentas deshabilitadas se rechazan antes de ese trabajo. Se mantiene la comprobación transaccional final y el uso único. |
| Baja | Los prototipos de diseño seguían accesibles como archivos públicos de producción. | `/design-study` devuelve 404 en producción. No contiene documentos PM; los archivos del fabricante en public siguen siendo recursos públicos intencionales. |

La CSP permite estilos inline porque gráficos, firmas y canvas PDF asignan dimensiones dinámicas. Permite compilación WebAssembly para PDF.js; no permite eval general en producción. La configuración de desarrollo admite eval y WebSocket exclusivamente para las herramientas de Next.js. **El piloto debe ejecutar la compilación de producción.**

## Controles comprobados

- Acceso anónimo rechazado a PMs, detalles, estadísticas, directorio de usuarios, firmas, PDFs y archivos protegidos del catálogo.
- Un técnico ajeno no puede leer, modificar, eliminar ni descargar PMs de otro. Se preservan las reglas aprobadas de creador/asignado y las facultades del administrador, también con revisiones.
- Tokens de sesión aleatorios de 256 bits, almacenados como hash, vencimiento de 12 horas y cookies HttpOnly/SameSite=Lax. Secure se activa para APP_ORIGIN HTTPS. Cierre de sesión, deshabilitación y reset revocan el acceso.
- Mutaciones requieren Origin exacto; se rechazan solicitudes de otro origen. No se confía en cabeceras externas para identidad o roles.
- Consultas del recorrido revisado parametrizadas con Drizzle/PostgreSQL; no se identificó un recorrido con SQL concatenado desde entradas del usuario.
- UI React sin inserción de HTML arbitrario en el recorrido revisado. No se guardan tokens ni PMs en localStorage/sessionStorage.
- Subida del catálogo solo por admin, con límite de tamaño y conversión de imágenes a WebP. El backend no descarga los enlaces de fuentes facilitados por usuarios; se validan como HTTPS sin credenciales. Rutas de recursos PDF.js restringidas, con pruebas contra lectura arbitraria de archivos.
- Firma y PDF generados se entregan a través de endpoints autenticados y autorizados. Las descargas realizadas voluntariamente quedan en el equipo del usuario; no pueden revocarse eliminando el PM del servidor.
- PDF.js y fuentes se sirven desde la misma aplicación, con `isEvalSupported: false`. Visor, texto accesible y descarga del PM probados bajo CSP de producción, sin errores de seguridad en consola.

## Evidencia

- **31 pruebas aprobadas, 0 fallidas**, incluyendo integración con PostgreSQL real, matriz de acceso y HTTP de producción.
- `npm run build`: aprobado con Next.js 16.4.3.
- TypeScript: aprobado. ESLint: 0 errores; permanecen 11 advertencias preexistentes sobre imágenes nativas.
- `npm audit --omit=dev`: **0 vulnerabilidades conocidas** en el resultado del 27/10/2026. No es una garantía frente a fallos todavía desconocidos.
- Auditoría completa: **4 avisos moderados** en la cadena de herramientas de desarrollo/migración `drizzle-kit → @esbuild-kit → esbuild`. Corresponden al aviso de servidor de desarrollo de esbuild. No están en el árbol de producción auditado. No se aplicó la solución forzada que propone una versión incompatible de Drizzle Kit. No exponer herramientas de desarrollo ni migración en el servidor del piloto.
- Escaneo por patrones de claves privadas/tokens: 187 archivos de texto y 210 objetos del historial Git local revisados, sin coincidencias de esos patrones. El escaneo tiene límites y no acredita la ausencia de toda clase de secreto.
- Comparación de valores sensibles del entorno local con 15 archivos estáticos de cliente compilados: sin coincidencias. `.env.local` permanece fuera de Git y del contexto Docker.
- Login y logout nativos, redirección a login tras cerrar sesión, visor del fabricante y descarga de un PM sintético de 916589 bytes verificados en navegador de producción. No se sustituyeron por peticiones HTTP manuales.

Los logs de pruebas, informes npm y capturas están en la carpeta ignorada `work/security-audit-2026-10-27/`. El archivo de evidencia de pruebas finales es `tests-production.log`.

## Antes de usar datos reales en campo

1. Configurar **APP_ORIGIN=https://dominio-real** y ejecutar build/start de producción o la imagen Docker. Confirmar desde la tablet que certificado, redirección HTTPS, CSP, HSTS y cookie Secure estén presentes. No exponer el servidor de desarrollo de localhost.
2. Publicar solo el proxy HTTPS; restringir el puerto de la app y PostgreSQL mediante firewall/red privada. Usar un usuario PostgreSQL sin privilegios de superusuario para la app. Para una base externa, validar TLS y certificado (`sslmode=verify-full`, según el proveedor).
3. Configurar límites por IP en el proxy o plataforma, además del límite de cuenta de la aplicación: login y activación, tamaños de petición, tiempos de espera y protección de carga general. La app no usa X-Forwarded-For del cliente como identidad confiable. Se entrega un **ejemplo sin desplegar** en `deploy/nginx-cryopm.conf.example`; debe adaptarse y validarse en el servidor elegido.
4. Habilitar cifrado de discos/base de datos y backups, restringir credenciales fuera del repositorio y probar una restauración que incluya firmas. No se ha verificado que el servidor o proveedor elegido ya lo haga.
5. Crear cuentas individuales para los participantes y revisar los permisos antes del piloto. Cambiar mediante el flujo privado las credenciales conocidas de pruebas antes de una puesta en producción. No reutilizar datos o cuentas sintéticas como credenciales del cliente.
6. Restringir y definir retención de logs; no registrar contraseñas, cookies, cuerpos de activación, enlaces privados ni PMs completos. Registrar y revisar eventos relevantes de acceso y administración. Rotar secretos si existen indicios de exposición en algún entorno publicado.
7. Aceptar únicamente datasheets obtenidos de fuentes de confianza. La comprobación de formato y límites no sustituye un análisis antimalware de documentos. Para admitir PDFs de terceros no confiables, añadir antivirus/CDR y revisar el aislamiento de archivos antes de abrir esa capacidad.
8. Verificar en las tablets reales el cierre de sesión y la gestión local de PDFs descargados. Una descarga es una copia fuera del control de acceso del servidor. La revisión visual del navegador local no equivale a probar Safari/iOS físico ni la gestión del dispositivo.

## Referencias técnicas

- [Aviso de Next.js sobre optimización de imágenes](https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw).
- [Aviso de Next.js sobre use cache](https://github.com/vercel/next.js/security/advisories/GHSA-673q-mjm6-r5xr).
- [Aviso de Sharp/librsvg](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).
- [OWASP: gestión de sesiones](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html).
- [OWASP: almacenamiento de contraseñas](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- [OWASP: subida de archivos](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html).
- [Next.js: Content Security Policy](https://nextjs.org/docs/app/guides/content-security-policy).
