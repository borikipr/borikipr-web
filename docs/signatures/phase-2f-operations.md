# Operación y lanzamiento de firmas electrónicas

Estado: procedimiento técnico previo al lanzamiento. No constituye aprobación legal. La firma pública debe permanecer desactivada hasta un cambio separado y autorizado.

## Reglas invariables

- Nunca copiar, mostrar ni registrar tokens, secretos de sesión, firmas, texto PDF, correos, claves R2 o direcciones IP sin anonimizar.
- No editar documentos enviados, evidencia finalizada ni eventos históricos.
- Reemitir crea un token nuevo y revoca el anterior; no se reutilizan enlaces.
- Un PDF o certificado con hash o tamaño incorrecto no se entrega y se escala como incidente de integridad.
- Una solicitud completada no se reabre, anula ni modifica. Una corrección requiere una solicitud/version nueva.
- Los recordatorios automáticos permanecen desactivados.

## Procedimientos de soporte

1. **No recibió la invitación:** revisar el estado agregado de entrega. Si falló o no llegó, usar Reemitir una sola vez; nunca copiar el enlace anterior.
2. **Perdió el correo:** verificar que la solicitud siga vigente y reemitir. El token anterior queda revocado.
3. **Enlace expirado:** no ampliar el token ni reabrir el historial. Expirar la solicitud y crear/reemitir según la política aprobada.
4. **Enlace reenviado:** revocar o reemitir inmediatamente. La identidad sigue ligada al participante; no cambiarla en la solicitud enviada.
5. **Reemisión:** usar solo la acción idempotente por participante. Confirmar que el intento anterior quedó supersedido.
6. **Correo incorrecto:** anular la solicitud con razón. Crear una nueva solicitud con un snapshot de identidad correcto; no reescribir evidencia enviada.
7. **Anulación:** exigir razón y confirmación. La operación revoca tokens/sesiones, cancela entregas pendientes y agrega eventos inmutables.
8. **Participante declina:** registrar el estado y evento; detener acceso y escalar al responsable contractual. No sustituir al participante en la misma versión.
9. **Sesión expira durante el proceso:** el participante vuelve a usar una invitación todavía vigente. La sesión anterior no se reactiva.
10. **No puede descargar el documento completado:** validar hashes/tamaño en R2 y emitir un acceso corto ligado al participante. Nunca crear URL pública.
11. **Resend falla:** el intento queda fallido y el token se revoca. Una respuesta ambigua no se reintenta automáticamente; el Admin decide una reemisión explícita.
12. **Finalización falla:** conservar el estado y la evidencia, impedir entrega, revisar el bloqueo idempotente y escalar. Nunca fabricar o reemplazar el PDF manualmente.
13. **Integridad R2 falla:** bloquear la descarga, preservar el objeto, comparar el hash persistido y restaurar únicamente mediante el procedimiento de recuperación verificado.

## Retención y privacidad

La configuración `SIGNATURE_RETENTION_POLICY_JSON` es obligatoria antes del lanzamiento. Debe incluir una versión, referencia de aprobación, referencia de privacidad y periodos separados para fuentes, finales, certificados, manifiestos, tokens, sesiones, evidencia de red, borradores fallidos/cancelados y eventos.

- Una retención legal suspende toda limpieza del registro afectado.
- Si no existe una política aprobada, la limpieza de evidencia completada permanece desactivada.
- Tokens y sesiones expirados pueden limpiarse solo después de sus periodos aprobados.
- Los eventos de auditoría y objetos completados no se eliminan automáticamente salvo política explícita y aprobada.

## Preparación del remitente

La auditoría de Phase 2F confirmó un dominio verificado por Resend y registros de autenticación del proveedor en estado verificado. La plantilla de firma usa la identidad existente de Erickson Real Estate y no configura un `Reply-To` específico. No se encontró una política DMARC en el dominio visible del remitente durante la comprobación DNS; debe configurarse y verificarse antes del canary. Los límites de envío de la cuenta deben documentarse en el registro operativo porque la API disponible no expuso una cuota contractual fiable. Ninguna de estas comprobaciones envió correo.

## Rotación de claves HMAC

1. Generar la clave nueva fuera del repositorio y de los registros.
2. Agregarla al anillo con versión `N+1`, conservando todas las versiones encontradas en `signature_events`.
3. Desplegar primero el anillo ampliado con la versión actual todavía en `N`.
4. Verificar cobertura histórica y cadenas existentes.
5. Cambiar la versión actual a `N+1` y desplegar.
6. Confirmar que los eventos nuevos usan `N+1` y los históricos siguen verificando con `N`.
7. No retirar una clave histórica mientras exista un evento que la referencie. Los datos no se reescriben durante la rotación.

## Recuperación

La recuperación requiere tres conjuntos coordinados: Neon, objetos privados R2 y el anillo histórico de claves HMAC.

1. Restaurar Neon a un punto consistente y confirmar migraciones.
2. Confirmar que cada versión finalizada conserva sus objetos fuente, final y certificado en R2.
3. Restaurar los secretos de despliegue incluyendo todas las versiones HMAC usadas.
4. Recalcular y comparar SHA-256 y byte count antes de servir cualquier objeto.
5. Verificar la cadena completa de eventos para cada documento restaurado.
6. Mantener la firma pública desactivada durante toda la recuperación.
7. No reemitir invitaciones ni generar finales hasta completar la verificación.

Antes del lanzamiento deben existir evidencia documentada de restauración Neon y garantías de durabilidad/recuperación R2. La mera existencia de copias del proveedor no sustituye un simulacro de recuperación aprobado.

## Lista previa al cambio de feature flag

- Aprobación legal activa por cada tipo permitido.
- Consentimiento aprobado e inmutable para `es-PR` y `en-US`.
- Política de retención y aviso de privacidad aprobados.
- Dominio remitente autenticado y simulacros de entrega aprobados.
- Simulacros de reemisión, expiración, anulación, escritorio, móvil, integridad y rotación completados.
- Copias/recuperación verificadas.
- CI y despliegue verdes.
- Auditoría de producción sin registros, sesiones, objetos ni correos inesperados.
- Autorización humana separada antes de establecer `SIGNING_PUBLIC_ENABLED=true`.
