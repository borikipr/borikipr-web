"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { trackAnalyticsEvent } from "@/lib/analytics";

type Props = {
  href: string;
  slug?: string | null;
  tipo: string;
  className?: string;
  target?: string;
  analyticsEventName?: string;
  analyticsParams?: Record<string, string | number | boolean | null | undefined>;
  ariaLabel?: string;
  children: React.ReactNode;
};

export default function TrackLinkButton({
  href,
  slug = null,
  tipo,
  className,
  target,
  analyticsEventName,
  analyticsParams,
  ariaLabel,
  children,
}: Props) {
  const pathname = usePathname();

  const handleClick = async () => {
    if (analyticsEventName) {
      trackAnalyticsEvent(analyticsEventName, analyticsParams);
    }

    try {
      await fetch("/api/track", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          slug,
          tipo,
          rutaOrigen: pathname,
        }),
      });
    } catch (error) {
      console.error("No se pudo registrar el evento", error);
    }
  };

  return (
    <Link
      href={href}
      target={target}
      rel={target === "_blank" ? "noopener noreferrer" : undefined}
      aria-label={ariaLabel}
      onClick={handleClick}
      className={className}
    >
      {children}
    </Link>
  );
}
