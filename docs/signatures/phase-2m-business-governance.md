# Phase 2M: gobernanza interna y borradores

Borikí Signing sirve el flujo operacional de corretaje de Erickson Real Estate. No es una plataforma de cierre, notaría ni sustituto de formalidades externas.

## Modos de decisión

- **Aprobación interna:** ruta normal para documentos ordinarios del corretaje. Significa que Erickson Real Estate aprobó esa versión para su flujo de firma electrónica; no significa asesoría legal ni notarización.
- **Revisión externa:** evidencia opcional cuando Erickson Real Estate obtuvo una revisión independiente. Requiere identificar al revisor y la referencia de evidencia.
- **Fuera de alcance:** restringe una versión que pertenece al cierre o puede requerir una formalidad externa. La advertencia no pretende emitir una conclusión legal automática.

Las versiones aprobadas o restringidas son inmutables. Toda corrección requiere crear una versión nueva. El operador que registra una decisión se conserva separado de cualquier revisor externo.

## Procedimiento seguro del operador

1. Abra `/admin/signatures/gobernanza` con una sesión Admin autorizada.
2. Cree el borrador de clasificación y describa el uso permitido.
3. Envíelo a revisión.
4. Seleccione el modo real de decisión, identifique el rol del operador y la fuente de aprobación.
5. Si hubo revisión externa, complete exclusivamente los datos reales del revisor. Si no ocurrió, use aprobación interna.
6. Verifique la versión y la fecha, marque el reconocimiento de inmutabilidad y escriba la frase solicitada.
7. Registre consentimientos, privacidad y retención como versiones separadas. Aprobar retención no la activa; la activación es una acción explícita adicional.

La clasificación pendiente `transaction_acknowledgment` puede continuar desde su estado pendiente y registrarse como aprobación interna, revisión externa o fuera de alcance. No se reescribe su historial y no se presume aprobación externa.

## Preparar no es enviar

Con ambas puertas de firma desactivadas, un Admin puede cargar el PDF, añadir participantes, definir campos y fecha de expiración. El envío continúa bloqueado hasta que la gobernanza, la activación y las puertas correspondientes estén completas.

## Borradores inertes

`Eliminar borrador` exige escribir `ELIMINAR BORRADOR`. Solo se permite si no existen participantes, valores, sesiones, tokens, entregas, finalización, artefactos finales ni retención legal. El PDF fuente privado se elimina por coincidencia exacta y queda un evento inmutable de auditoría.

Si existe actividad, se debe archivar o cancelar según el estado. Archivar preserva el PDF y la evidencia, y nunca deja tokens, sesiones o entregas existentes activos.

## Controles que permanecen

Consentimiento, privacidad, retención, legal holds, HMAC, cadena de eventos, sesiones, tokens, propiedad de campos y finalización siguen fail-closed. `SIGNING_PUBLIC_ENABLED` y `SIGNING_INTERNAL_CANARY_ENABLED` no se modifican desde la interfaz de gobernanza.
