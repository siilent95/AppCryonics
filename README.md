# AppCryonics / CryoPM

Aplicación web beta para registrar mantenimientos preventivos de congeladores MVE y Taylor-Wharton y generar un informe completo por marca. Proyecto para Cryogenics Solution Inc.

## Funciones incluidas

- Identificación del equipo mediante catálogo de modelos.
- Formularios Construction, Operation, Verification y Examination específicos por marca.
- Validaciones de mediciones, rangos y observaciones obligatorias.
- Firma del técnico responsable y firma de quien recibe el mantenimiento.
- Vistas Overview, Equipment y Reports, con búsqueda y filtros.
- Informe completo que se puede imprimir o guardar como PDF desde el navegador.

## Tecnología

React, TypeScript, vinext, Cloudflare Workers, D1 y R2. Las migraciones de la base de datos están en `drizzle/`. La configuración de publicación de la beta está en `.openai/hosting.json`.

Para compilar localmente se requiere Node.js 22.13 o posterior:

```bash
npm install
npm run build
```

Para probar la app localmente, inicia `npm run dev` y abre la URL local que muestra Vite. El servidor de desarrollo simula el inicio de sesión de Sites solo para solicitudes de loopback. No uses datos reales en esa instancia de prueba. La identidad simulada nunca se empaqueta en la compilación de producción.

Antes de usar Overview, Equipment y Reports con una base D1 local nueva, compila y aplica, en orden, los archivos `drizzle/*.sql` con Wrangler y `--local --config dist/server/wrangler.json --persist-to .wrangler/state`. Las migraciones ya aplicadas no deben ejecutarse de nuevo sobre la misma base.

En producción, las API de PM requieren la identidad autenticada que entrega Sites, D1/R2 y `IDENTITY_HMAC_SECRET`. El secreto se configura en el entorno de despliegue y no debe guardarse en Git. El identificador de propietario sigue derivándose del correo autenticado para conservar el acceso a los PM beta existentes; el correo no se guarda en los registros.

## Estado de la beta

El PDF se obtiene mediante la opción de imprimir o guardar como PDF del navegador. El almacenamiento automático de esos PDF todavía no está implementado. Este repositorio contiene el código y los recursos de la aplicación, no los PM ni las firmas capturadas durante su uso.

## Licencia

Se conserva la licencia GPL-3.0 incluida en este repositorio.
