# Phase 2N: cierre operacional del Admin

## Antes del canary interno

El operador debe completar únicamente estas decisiones humanas:

1. Aprobar internamente la clasificación exacta del documento de corretaje.
2. Aprobar el consentimiento del locale incluido en el canary. Para un canary sólo en español se exige `es-PR`; `en-US` se exige únicamente si habrá firmantes en inglés.
3. Aprobar la divulgación de privacidad vigente. El modelo actual conserva un snapshot bilingüe único; la evidencia de cada firmante queda ligada a la versión y al hash de su locale.
4. Aprobar y activar una política de retención. Ingeniería no decide duraciones.
5. Decidir la postura de recuperación Neon y R2 descrita abajo.
6. Crear una autorización de canary con participantes sintéticos exactos, clasificación exacta, hash de readiness y expiración.
7. Autorizar separadamente la activación temporal de `SIGNING_INTERNAL_CANARY_ENABLED`.

`READY != ENABLED`. La autorización no cambia variables de Vercel.

## Showing Report - Venta pendiente

La versión pendiente `transaction_acknowledgment` se preserva sin reescribir su historia. En **Admin → Firmas → Gobernanza → Clasificaciones de documentos**:

1. Abrir **3. Registrar decisión**.
2. Seleccionar la versión pendiente.
3. Elegir **Aprobación interna de Erickson Real Estate**.
4. Indicar el rol del operador autorizado, referencia real de la decisión, fecha efectiva y fecha de decisión.
5. Revisar el resumen inmutable, marcar el reconocimiento y escribir la frase de confirmación mostrada.
6. Registrar la versión. No se requieren campos de abogado/revisor externo salvo que se seleccione voluntariamente **Revisión externa**.

No ejecutar estos pasos hasta que la decisión empresarial real exista.

## Decisión de riesgo de recuperación

No se crea una aceptación automática. La decisión debe existir fuera del sistema y su referencia debe incluirse en las notas de la futura autorización de canary.

Registrar, como mínimo:

- identificador del riesgo;
- sistema (`Neon` o `R2`);
- riesgo residual exacto;
- alcance (`canary interno` o `lanzamiento público`);
- persona que acepta;
- fecha y hora;
- fecha de revisión/expiración;
- referencia verificable de la decisión;
- confirmación expresa.

### Neon

Conocido: historia de restauración limitada y snapshot manual según el plan actual. No probado: restauración real hacia una rama/base aislada. Para cerrar técnicamente, un operador autenticado debe crear un target aislado desde un punto de recuperación, verificar migraciones, constraints, eventos y hashes, y destruir únicamente el target de prueba. Si esa operación consume un recurso escaso o requiere upgrade, detenerse y obtener aprobación de costo.

### R2

Probado: una copia privada controlada por la aplicación puede restaurarse byte por byte y con el mismo SHA-256. No probado: recuperación independiente ante compromiso/borrado de toda la cuenta. Para canary, el propietario puede aceptar expresamente el riesgo same-account; para lanzamiento público debe decidir si exige respaldo independiente.

## Activación y emergencia

La bandera interna no aparece como botón cotidiano del Admin. Después de una autorización válida, un operador de despliegue puede configurarla temporalmente. Para deshabilitar: retirar la bandera y readiness hash, desplegar, revocar autorización/tokens/sesiones sintéticas y confirmar que `SIGNING_PUBLIC_ENABLED` continúa ausente y `/firmar/<token>` devuelve el 404 protegido.
