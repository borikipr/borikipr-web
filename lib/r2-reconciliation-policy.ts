import { createHash } from "node:crypto";
import type { ManagedR2Object } from "@/lib/r2";

const PUBLIC_MEDIA_SAFETY_DELAY_MS = 7 * 24 * 60 * 60 * 1000;

export function redactR2Identifier(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 12);
}

export function classifyR2Objects(input: {
  objects: ManagedR2Object[];
  publicReferences: Set<string>;
  financialReferences: Set<string>;
  now: Date;
}) {
  const cutoff = input.now.getTime() - PUBLIC_MEDIA_SAFETY_DELAY_MS;
  const orphans = input.objects.filter(
    (object) =>
      !input.publicReferences.has(object.key) &&
      !input.financialReferences.has(object.key)
  );
  const eligiblePublicMedia = orphans.filter(
    (object) =>
      (object.key.startsWith("propiedades/") ||
        object.key.startsWith("testimonios/")) &&
      object.lastModified !== null &&
      object.lastModified.getTime() <= cutoff
  );
  return {
    orphanPropertyMedia: orphans.filter((object) =>
      object.key.startsWith("propiedades/")
    ),
    orphanTestimonialMedia: orphans.filter((object) =>
      object.key.startsWith("testimonios/")
    ),
    financialOrphansExcluded: orphans.filter((object) =>
      object.key.startsWith("lead-documents/")
    ),
    eligiblePublicMedia,
  };
}

