export const SIGNATURE_STYLES = [
  {
    id: "great-vibes",
    label: "Clásica",
    fontFamily: "Boriki Signature Great Vibes",
    publicPath: "/fonts/signatures/great-vibes/GreatVibes-Regular.ttf",
  },
  {
    id: "allura",
    label: "Fluida",
    fontFamily: "Boriki Signature Allura",
    publicPath: "/fonts/signatures/allura/Allura-Regular.ttf",
  },
  {
    id: "alex-brush",
    label: "Distinguida",
    fontFamily: "Boriki Signature Alex Brush",
    publicPath: "/fonts/signatures/alex-brush/AlexBrush-Regular.ttf",
  },
  {
    id: "parisienne",
    label: "Contemporánea",
    fontFamily: "Boriki Signature Parisienne",
    publicPath: "/fonts/signatures/parisienne/Parisienne-Regular.ttf",
  },
  {
    id: "sacramento",
    label: "Ligera",
    fontFamily: "Boriki Signature Sacramento",
    publicPath: "/fonts/signatures/sacramento/Sacramento-Regular.ttf",
  },
] as const;

export type SignatureStyleId = (typeof SIGNATURE_STYLES)[number]["id"];

export const DEFAULT_SIGNATURE_STYLE_ID: SignatureStyleId = "great-vibes";

export function isSignatureStyleId(value: unknown): value is SignatureStyleId {
  return typeof value === "string" && SIGNATURE_STYLES.some((style) => style.id === value);
}

export function normalizeSignatureStyleId(value: unknown): SignatureStyleId {
  return isSignatureStyleId(value) ? value : DEFAULT_SIGNATURE_STYLE_ID;
}

export function deriveSuggestedInitials(name: string) {
  const words = name.normalize("NFC").trim().split(/\s+/u).filter(Boolean);
  return words.slice(0, 4).map((word) => Array.from(word)[0] ?? "").join("").toLocaleUpperCase("es-PR");
}
