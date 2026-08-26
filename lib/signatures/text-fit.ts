export const SIGNATURE_TEXT_MIN_FONT_SIZE = 6;
export const SIGNATURE_DATE_PREFERRED_FONT_SIZE = 10;

export type SignatureTextFitInput = Readonly<{
  value: string;
  availableWidth: number;
  availableHeight: number;
  preferredFontSize: number;
  minimumFontSize?: number;
  widthAtSize: (value: string, size: number) => number;
  heightAtSize: (size: number) => number;
}>;

export type SignatureTextFit = Readonly<{
  fontSize: number;
  width: number;
  height: number;
  fits: boolean;
}>;

export function fitSignatureText(input: SignatureTextFitInput): SignatureTextFit {
  const minimum = input.minimumFontSize ?? SIGNATURE_TEXT_MIN_FONT_SIZE;
  const preferred = Math.max(minimum, input.preferredFontSize);
  const preferredWidth = input.widthAtSize(input.value, preferred);
  const preferredHeight = input.heightAtSize(preferred);
  const widthScale = preferredWidth > 0 ? input.availableWidth / preferredWidth : 1;
  const heightScale = preferredHeight > 0 ? input.availableHeight / preferredHeight : 1;
  const fontSize = Math.max(minimum, Math.min(preferred, preferred * widthScale, preferred * heightScale));
  const width = input.widthAtSize(input.value, fontSize);
  const height = input.heightAtSize(fontSize);
  const epsilon = 0.01;
  return {
    fontSize,
    width,
    height,
    fits: width <= input.availableWidth + epsilon && height <= input.availableHeight + epsilon,
  };
}

// Helvetica's digits and hyphen are stable enough to predict the automatic ISO
// date before finalization. The final renderer still performs an exact embedded-
// font measurement and fails closed if the prediction cannot be honored.
export function estimateHelveticaDateWidth(value: string, size: number) {
  const relativeWidth: Readonly<Record<string, number>> = {
    "0": 0.556, "1": 0.556, "2": 0.556, "3": 0.556, "4": 0.556,
    "5": 0.556, "6": 0.556, "7": 0.556, "8": 0.556, "9": 0.556,
    "-": 0.333, "/": 0.278,
  };
  return [...value].reduce((sum, character) => sum + (relativeWidth[character] ?? 0.556), 0) * size;
}

export function signatureDateTextFits(input: {
  value?: string;
  widthPoints: number;
  heightPoints: number;
}) {
  const padding = Math.min(4, input.heightPoints * 0.12);
  return fitSignatureText({
    value: input.value ?? "2026-08-25",
    availableWidth: Math.max(0, input.widthPoints - padding * 2),
    availableHeight: Math.max(0, input.heightPoints - padding * 2),
    preferredFontSize: SIGNATURE_DATE_PREFERRED_FONT_SIZE,
    widthAtSize: estimateHelveticaDateWidth,
    heightAtSize: (size) => size,
  });
}
