type ProtectedTerminology = {
  providerText: string;
  restore(translatedText: string): string;
};

const TERMINOLOGY = [
  {
    pattern: /propiedad bajo contrato/giu,
    translation: "property under contract",
  },
  { pattern: /bajo contrato/giu, translation: "under contract" },
  {
    pattern: /responsable del listado/giu,
    translation: "listing representative",
  },
  { pattern: /casa expandible/giu, translation: "expandable home" },
  { pattern: /dos niveles/giu, translation: "two levels" },
  { pattern: /marquesina/giu, translation: "carport" },
  { pattern: /cuerdas/giu, translation: "cuerdas" },
  { pattern: /cuerda/giu, translation: "cuerda" },
  { pattern: /opcionada/giu, translation: "under option" },
] as const;

const LITERAL_MEASUREMENTS = [
  /\b\d+(?:[.,]\d+)?\s+cuerdas?\b/giu,
] as const;

function preserveInitialCase(source: string, translation: string) {
  if (!/^\p{Lu}/u.test(source)) return translation;
  return translation.charAt(0).toUpperCase() + translation.slice(1);
}

export function protectBorikiTerminology(
  sourceText: string
): ProtectedTerminology {
  let providerText = sourceText;
  const replacements = new Map<string, string>();
  let index = 0;

  for (const pattern of LITERAL_MEASUREMENTS) {
    providerText = providerText.replace(pattern, (sourceTerm) => {
      const token = `ZQBORIKITERM${String(index).padStart(3, "0")}QZ`;
      index += 1;
      replacements.set(token, sourceTerm);
      return token;
    });
  }

  for (const term of TERMINOLOGY) {
    providerText = providerText.replace(term.pattern, (sourceTerm) => {
      const token = `ZQBORIKITERM${String(index).padStart(3, "0")}QZ`;
      index += 1;
      replacements.set(
        token,
        preserveInitialCase(sourceTerm, term.translation)
      );
      return token;
    });
  }

  return {
    providerText,
    restore(translatedText) {
      let restored = translatedText;
      for (const [token, translation] of replacements) {
        if (!restored.includes(token)) {
          throw new Error("boriki_terminology_token_missing");
        }
        restored = restored.replaceAll(token, translation);
      }
      return restored;
    },
  };
}
