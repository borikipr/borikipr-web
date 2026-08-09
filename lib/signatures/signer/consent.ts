import { sha256SignatureValue } from "../domain/crypto";

export const SIGNATURE_PROTOTYPE_CONSENT_VERSION = "phase2d-synthetic-v1";
export const SIGNATURE_PROTOTYPE_CONSENT_TEXT =
  "PROTOTIPO SINTETICO — NO APROBADO LEGALMENTE. Confirmo que deseo usar una firma electrónica únicamente en esta prueba técnica y que adopté los valores que enviaré.";

export const SIGNATURE_PROTOTYPE_CONSENT_SHA256 = sha256SignatureValue(
  SIGNATURE_PROTOTYPE_CONSENT_TEXT.normalize("NFC")
);
