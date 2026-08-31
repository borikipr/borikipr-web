"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = {
  url: string;
  slug: string;
  className?: string;
  ctaLocation?: string;
  ariaLabel?: string;
  children: React.ReactNode;
};

export default function WhatsAppTrackerButton({
  url,
  slug,
  className,
  ctaLocation = "property_detail",
  ariaLabel,
  children,
}: Props) {
  const pathname = usePathname();

  const handleClick = async () => {
    trackAnalyticsEvent("property_whatsapp_click", {
      property_slug: slug,
      cta_location: ctaLocation,
    });

    try {
      await fetch("/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          tipo: "whatsapp_click",
          rutaOrigen: pathname,
        }),
      });
    } catch (error) {
      console.error("No se pudo registrar el click de WhatsApp", error);
    }
  };

  return (
    <Link
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={ariaLabel}
      onClick={handleClick}
      className={className}
    >
      {children}
    </Link>
  );
}
