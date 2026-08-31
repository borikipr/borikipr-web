import Image from "next/image";
import type { PublicListingProfessional } from "@/lib/queries/propiedades";

type Props = {
  professional: PublicListingProfessional;
  sectionLabel: string;
  roleLabel: string;
  licenseLabel: string;
  photoAlt: string;
};

function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase())
    .join("") || "BR";
}

export default function ListingProfessionalCard({
  professional,
  sectionLabel,
  roleLabel,
  licenseLabel,
  photoAlt,
}: Props) {
  return (
    <section aria-labelledby="listing-professional-heading" className="border-b border-[#e8e8e8] pb-5">
      <h2
        id="listing-professional-heading"
        className="text-xs font-semibold uppercase tracking-[0.18em] text-[#765f12]"
      >
        {sectionLabel}
      </h2>

      <div className="mt-3 flex min-w-0 items-center gap-3.5">
        {professional.avatarUrl ? (
          <Image
            src={professional.avatarUrl}
            alt={photoAlt}
            width={64}
            height={64}
            className="h-14 w-14 shrink-0 rounded-full object-cover ring-1 ring-[#e8e8e8] sm:h-16 sm:w-16"
          />
        ) : (
          <div
            role="img"
            aria-label={photoAlt}
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-[#0d1b2a] text-sm font-bold tracking-[0.08em] text-[#d4af37] ring-1 ring-[#d4af37]/40 sm:h-16 sm:w-16"
          >
            {initials(professional.displayName)}
          </div>
        )}

        <div className="min-w-0">
          <p className="break-words text-base font-semibold leading-snug text-[#0d1b2a]">
            {professional.displayName}
          </p>
          <p className="mt-1 break-words text-sm leading-snug text-[#4d4d4d]">
            {roleLabel} · {licenseLabel} {professional.licenseNumber}
          </p>
        </div>
      </div>
    </section>
  );
}
