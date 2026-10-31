# Gestión de cuentas y permisos

Fecha: 23 de octubre de 2026. Estado: implementado y verificado en el entorno local.

## Roles y PM

- Técnico: consulta los PM que creó o que tiene asignados actualmente. Puede continuar y firmar los borradores que tiene asignados.
- Administrador: consulta todos los PM y sus estadísticas, administra cuentas, asigna PM a técnicos activos y puede editar o firmar borradores sin cambiar su técnico asignado. Este permiso de edición se añadió a petición del usuario al revisar la recuperación de borradores.
- Al reasignar, el creador conserva acceso de consulta. Un técnico que solo estuvo asignado pierde ese acceso al transferirlo a otro técnico. El acceso al historial de versiones sigue al técnico asignado a la versión actual, con consulta permanente para el creador.
- Los PM completados conservan su contenido, revisión y firmas al cambiar de técnico; la reasignación queda en la auditoría.
- El administrador o el técnico asignado pueden crear una corrección del último PM completado. La nueva versión copia los campos y se finaliza con motivo, autor y fecha, sin solicitar firmas nuevas. Las firmas anteriores permanecen en su documento de origen y se referencian expresamente en el PDF corregido, con su retención original.

## Cuentas e invitaciones

Desde Users, el administrador crea nombre, correo, nombre de usuario opcional y rol. La nueva cuenta permanece pendiente hasta que su titular abre el enlace privado y establece su contraseña. El enlace vence en 24 horas, es de un solo uso y solo se almacena su hash. El token se entrega en el fragmento del enlace para evitar incluirlo en solicitudes HTTP.

No hay envío automático de correo configurado: el administrador copia y comparte la invitación manualmente. Generar una invitación nueva invalida la anterior. Restablecer contraseña bloquea el acceso hasta establecer la nueva y revoca las sesiones existentes. Desactivar o cambiar el rol también revoca las sesiones. Se protegen los cambios que dejarían la app sin un administrador activo y se auditan las operaciones administrativas.

El inicio de sesión acepta correo o nombre de usuario sin distinguir mayúsculas. La contraseña exige entre 12 y 256 caracteres y se almacena con scrypt. Fuera de localhost, configurar APP_ORIGIN con HTTPS.

## Cuenta local solicitada

Se creó el administrador `silentCryo` con la contraseña indicada por el usuario, incluido su punto final. No se guarda la contraseña en esta documentación. El correo interno `silentcryo@cryopm.local` identifica esta cuenta local y no recibe mensajes.

## Validación

Las 16 pruebas pasan, incluidas las de permisos de consulta y escritura, PDF y firmas, reasignación, activación simultánea, vencimiento y rotación de invitaciones, revocación de sesiones y protección concurrente del último administrador. La compilación de producción con Webpack pasa. La migración `0001_roles_and_invitations.sql` se aplicó a la base local; conserva la atribución original de los PM existentes.

## Edición de datos básicos — 23 de octubre de 2026

Users incorpora **Edit details** por cuenta. El administrador puede cambiar nombre visible, correo y nombre de usuario opcional, incluso en cuentas pendientes o desactivadas. El nombre de usuario vacío permite continuar usando el correo para entrar. Los valores de correo/usuario se recortan y normalizan a minúsculas; se validan formato, longitud y duplicados.

`PATCH /api/admin/users/:id/profile` exige admin, origen válido y una copia de los datos originales (`expectedProfile`). Bloquea la fila durante la transacción y rechaza con 409 una edición desactualizada. Este endpoint solo permite los tres campos básicos; rol, activación, contraseña y estado de acceso se gestionan por sus acciones existentes. No necesita migración de base de datos.

La cuenta mantiene su ID, sesiones válidas, asignaciones y autoría. Los PM firmados y sus nombres capturados permanecen intactos. Las siguientes entradas aceptan el correo y/o usuario nuevos con la contraseña existente. La sesión actual ve el nombre actualizado; el cliente refresca los datos del servidor al guardar.

Cada cambio efectivo queda en `admin_events` como `user_profile_updated`, con administrador, usuario afectado y valores anteriores/nuevos de los campos modificados. Una operación sin cambios no genera otro evento. Si cambia el correo se revocan invitaciones/restablecimientos pendientes; la pantalla avisa cuando es necesario emitir un enlace nuevo.

`tests/user-profile-integration.ts` verifica permisos, origen, validación, duplicados, conflictos simultáneos, nuevos identificadores de acceso, sesiones existentes, eliminación del alias opcional, auditoría, estabilidad de los PM firmados, cuentas pendientes/desactivadas y edición del propio administrador. Suite completa actual: 23 pruebas pasan.
