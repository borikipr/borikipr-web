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

La divulgación específica para firmantes se configura por separado en
`SIGNATURE_PRIVACY_DISCLOSURE_JSON`. Debe contener versión, referencia de
aprobación, vigencia y el texto exacto en `es-PR` y `en-US`. La aplicación
normaliza cada texto con NFC y muestra su SHA-256 en Gobernanza. La ausencia o
una sola traducción mantienen el lanzamiento bloqueado. No se debe copiar texto
legal desde otra jurisdicción ni usar esta ranura como sustituto de la política
general de privacidad o del consentimiento contractual.

## Pasos para aprobaciones de clasificación y consentimiento

1. El abogado licenciado entrega la decisión por tipo, alcance, referencia y fecha efectiva.
2. El operador crea una decisión pendiente y registra la decisión recibida; no cambia `pending` a `approved` sin esa evidencia.
3. El operador crea borradores separados del consentimiento `es-PR` y `en-US` con identificadores de versión nuevos.
4. Legal compara el texto exacto y su SHA-256; el operador registra la referencia y fecha efectiva.
5. Una versión aprobada nunca se edita. Para reemplazarla se retira y se crea una versión nueva.
6. Gobernanza debe mostrar la clasificación vigente, ambos consentimientos y sus hashes antes de cualquier autorización de canary.

## Matriz de retención propuesta para revisión

Esta matriz es una recomendación operativa, no una decisión legal ni una
configuración autorizada:

| Evidencia | Propuesta inicial | Regla de seguridad |
| --- | ---: | --- |
| PDF fuente | 10 años | No borrar con retención legal ni mientras exista solicitud completada. |
| PDF completado | Preservación indefinida hasta política aprobada | Limpieza desactivada. |
| Certificado | Preservación indefinida hasta política aprobada | Mantener junto al PDF final. |
| Manifiesto de evidencia | Preservación indefinida hasta política aprobada | Mantener para verificación. |
| Tokens | 30 días después de expirar/revocar | Nunca conservar texto plano. |
| Sesiones | 24 horas después de expirar/revocar | Solo digest; plazo máximo configurable 168 h. |
| Digest de red | 90 días | Pseudónimo; sin IP cruda. |
| Borradores fallidos/cancelados | 90 días | Solo si no hay hold ni obligación de conservar. |
| Eventos | Preservación indefinida hasta política aprobada | Append-only; no limpieza automática. |

Todo cambio aprobado debe producir una nueva versión JSON. El hash determinista
de la política se muestra en Admin y debe registrarse junto a la referencia del
cambio en el historial de despliegue. Esto hace el cambio detectable/auditable;
no reemplaza un futuro registro legal duradero si la política exige evidencia en
base de datos.

## Preparación del remitente

La auditoría de Phase 2F confirmó `borikipr.com` como dominio verificado por Resend. La plantilla de firma usa la identidad existente de Erickson Real Estate y no configura un `Reply-To` específico. No se encontró una política DMARC en el dominio visible del remitente durante la comprobación DNS; debe configurarse y verificarse antes del canary. El punto de partida recomendado por Resend es un TXT `_dmarc` con `v=DMARC1; p=none; rua=mailto:<buzón-aprobado-para-reportes>;`, seguido de verificación de todos los remitentes antes de endurecer a `quarantine` o `reject`. No publicar el placeholder. El propietario debe decidir un buzón `Reply-To` monitorizado.

Resend documenta un límite inicial de 5 solicitudes/segundo por equipo. En una
cuenta Free documenta 100 correos/día y 3,000/mes, pero el operador debe confirmar
el plan y límites efectivos en **Resend → Settings → Usage**, y revisar respuestas
`429` en **Resend → Logs**. Ninguna de estas comprobaciones envía correo.

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

Cloudflare documenta que la durabilidad de R2 no protege contra borrados
intencionales o accidentales. Los borrados son irreversibles si no existe una
copia separada. Antes del canary se debe elegir y probar una de estas medidas:
una regla de Bucket Lock aprobada para los prefijos final/certificates/manifests,
o una copia independiente con credenciales y ciclo de vida separados. No activar
una regla de borrado/lifecycle para evidencia completada sin política aprobada.

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
