# Phase 2O: pre-flight y guardas de activación

## Principio operativo

`PREPARADO != LISTO`, `LISTO != AUTORIZADO` y `AUTORIZADO != HABILITADO`.

La preparación del documento, la gobernanza, la decisión de recuperación, la autorización y la activación son controles separados. La interfaz Admin no edita variables de entorno ni secretos.

## Flujo del primer canary interno

1. Preparar un único documento sintético/interno: PDF válido, vencimiento futuro, de uno a ocho participantes exactos y campos requeridos propios.
2. Aprobar exactamente su clasificación operacional.
3. Aprobar el consentimiento y la privacidad del único locale del canary.
4. Aprobar y activar una política de retención. La activación ejecuta la vista previa, pero no elimina nada.
5. Probar recuperación o registrar, mediante confirmación fuerte, una aceptación de riesgo que se limita al canary interno y expira.
6. Ejecutar el pre-flight del servidor. Los bloqueos se corrigen en la sección indicada; no existe “ignorar advertencias”.
7. Crear una autorización de producción acotada al documento, clasificación, locale y correos exactos. Expira en un máximo de 24 horas y referencia un snapshot inmutable y su SHA-256.
8. Mediante un cambio de despliegue separado y autorizado, configurar temporalmente `SIGNING_INTERNAL_CANARY_ENABLED=true` y `SIGNING_INTERNAL_CANARY_READINESS_SHA256=<hash exacto>`.
9. Enviar únicamente a los participantes exactos de la autorización. El servidor vuelve a evaluar el pre-flight antes de crear el token y justo antes del envío.
10. Al terminar, deshabilitar el flag y revocar la autorización.

Los comodines de correo, clientes/leads existentes, múltiples clasificaciones o locales y autorizaciones indefinidas se rechazan para el primer canary. Un cambio material en participantes, campos, clasificación, consentimiento, privacidad, retención, riesgos o expiración cambia el hash y deja la autorización anterior inutilizable.

## Canary interno y firma pública

El canary interno es una prueba controlada y no está disponible para clientes. Su autorización y sus aceptaciones de riesgo nunca satisfacen un lanzamiento público.

La firma pública requiere una autorización `production_public_launch`, un snapshot público independiente, los requisitos públicos más estrictos y `SIGNING_PUBLIC_ENABLED=true`. No existe promoción automática del canary a público.

## Confirmaciones fuertes

- Aprobación inmutable de gobernanza: `APROBAR VERSION INMUTABLE`
- Activación de retención: `ACTIVAR POLITICA DE RETENCION`
- Aceptación temporal de recuperación: `ACEPTAR RIESGO PARA CANARY INTERNO`
- Autorización de canary: `AUTORIZAR CANARY INTERNO`
- Envío de canary: `CONFIRMAR ENVIO CANARY INTERNO`

Cada mutación también exige sesión Admin, confirmación explícita y registro del actor. Las versiones aprobadas, snapshots, aceptaciones de riesgo y eventos son inmutables.

## Recuperación

- Neon: mientras no haya restore aislado probado, permanece `NO PROBADO`. Una aceptación sólo puede cubrir el canary interno, debe describir el riesgo residual, aportar referencia y expirar dentro de 90 días.
- R2: está probada la restauración desde una copia privada de la misma cuenta. Eso no es recuperación independiente. La aceptación del riesgo residual tiene el mismo alcance y expiración limitada.

Una aceptación vencida deja de satisfacer el pre-flight. No se renueva automáticamente ni cuenta para lanzamiento público.

## Retención

La activación valida el hash exacto, las reglas y la vista previa agregada. No ejecuta limpieza. Cualquier limpieza futura seguirá requiriendo política activa y efectiva, retención legal, elegibilidad por clase de evidencia, dry-run, lote acotado y evento inmutable.

## Parada de emergencia

1. Quitar o fijar `SIGNING_INTERNAL_CANARY_ENABLED=false` en producción y desplegar.
2. Revocar la autorización activa desde Firmas > Gobernanza.
3. Revocar o expirar tokens y sesiones sintéticos activos con el procedimiento administrativo existente.
4. Cancelar entregas pendientes; no reintentar enlaces bearer automáticamente.
5. Conservar eventos, snapshots, hashes y demás evidencia inmutable.
6. Verificar que `SIGNING_PUBLIC_ENABLED` continúa ausente/false y que `/firmar/<token>` vuelve a 404 protegido.

No existe un botón de borrado general.

## Limitación de autorización administrativa

El sistema actual tiene un grupo Admin pequeño y confiable, sin RBAC empresarial que distinga de forma verificable a Cedric e Ivonne. Las acciones críticas se protegen con autenticación Admin, identidad del actor, frase fuerte, revalidación de servidor e historial inmutable. Esta limitación debe considerarse al decidir quién recibe acceso Admin; no se inventan roles legales ni de propietario.
