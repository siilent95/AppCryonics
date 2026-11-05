# Revisión de seguridad para el piloto offline

Fecha: 5 de noviembre de 2026. Alcance: cambios de la PWA, almacenamiento local, sincronización y cierre de sesión antes de publicar en `cryopm.cryogenicssolution.com`.

## Hallazgo corregido antes del despliegue

Una descarga/preparación que terminaba después del cierre de sesión podía volver a escribir información del técnico anterior en IndexedDB. La interfaz separaba propietarios, pero esto incumplía la limpieza esperada al entregar la tablet.

Todas las escrituras privadas y actualizaciones comprueban ahora, dentro de la transacción de guardado, tanto el técnico activo como una generación de su almacenamiento. El cifrado no permite volver a crear una clave de un titular que ya salió. Una respuesta cifrada antes de la salida también se rechaza si el mismo usuario vuelve a entrar con otra generación. El descifrado nunca crea claves nuevas. Limpiar un titular antiguo no elimina los metadatos del nuevo técnico.

Además, la entrega se detiene si la comprobación remota muestra otra identidad o una sesión inválida. El cierre HTTP vincula opcionalmente la identidad esperada a la sesión actual, de modo que una petición tardía no revoque la sesión de otro técnico.

## Verificaciones

- 46 pruebas de la suite completa aprobadas, incluidas 12 de almacenamiento/sincronización y dos regresiones específicas del hallazgo.
- 20 pruebas PostgreSQL/HTTP de producción aprobadas. Incluyen rechazo del cierre con identidad distinta sin revocar la sesión válida, CSP, aislamiento de cuentas, revisiones, firmas, reversión e idempotencia.
- Compilación y TypeScript correctos; ESLint de los cambios de seguridad sin errores ni avisos.
- `npm audit --omit=dev --json`: cero vulnerabilidades conocidas en las dependencias de producción al realizar esta revisión. El resultado no garantiza ausencia de fallos desconocidos.
- Escaneo de patrones de claves privadas y tokens sin hallazgos reales. Las coincidencias de URL de base fueron ejemplos o datos sintéticos en `.env.example`, el generador del entorno local y las pruebas TLS.
- Baseline remoto: las seis huellas de migración coinciden con el repositorio; `cryopm_app` no tiene superusuario, creación de bases/roles ni bypass de RLS. Dos PMs existentes antes de la migración.
- Baseline HTTPS: login del piloto 200 con CSP, HSTS y caché privada; API de PMs sin sesión 401. Las dos webs del cliente responden 200.

## Publicación estática en Hostinger

La comprobación remota detectó que Hostinger sirve `public/design-study/index.html` directamente (200), aunque el proxy de Next.js lo bloquea en las pruebas locales. Son propuestas sintéticas, pero no deben publicarse en el piloto. `scripts/package-pilot.py` las excluye físicamente del ZIP, además de rechazar secretos y rutas generadas. Se verificará el 404 después de publicar.

La auditoría completa presenta 12 avisos moderados en dependencias de desarrollo; todas esas versiones ya estaban en el piloto anterior. No aparecen en la auditoría de producción. No se exponen servidores de desarrollo ni se aplican actualizaciones incompatibles forzadas para silenciar esos avisos.

## Controles que se conservan

Sesión HttpOnly/Secure y SameSite, comprobación de Origin, permisos actuales por administrador/creador/asignado, validación y límites de entrada, TLS verificado a Supabase y rol de aplicación limitado. La nueva migración es aditiva, transaccional y habilita RLS. Sus políticas son para el backend `cryopm_app`; no se añade una política de acceso público.

El navegador guarda la interfaz pública separada de los datos privados cifrados. No se guardan contraseñas, cookies ni credenciales del servidor en la PWA. El modo sin PIN presupone una tablet desbloqueada a cargo del técnico activo; no ofrece defensa frente a alguien que ya controle ese dispositivo o ejecute código en su origen.

La disponibilidad offline en Safari/PWA y el comportamiento de suspensión deben comprobarse en el dispositivo Apple durante el piloto. Son pruebas pendientes de dispositivo, no una promesa de certificación ni una autorización para usar información clínica en los PMs.
