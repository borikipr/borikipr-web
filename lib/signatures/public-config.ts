export const SIGNING_PUBLIC_ENABLED_ENV = "SIGNING_PUBLIC_ENABLED";

export function isPublicSigningEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  return environment[SIGNING_PUBLIC_ENABLED_ENV]?.trim().toLowerCase() === "true";
}

export function assertPublicSigningEnabled(
  environment: Readonly<Record<string, string | undefined>> = process.env
) {
  if (!isPublicSigningEnabled(environment)) {
    throw new Error("public_signing_disabled");
  }
}
