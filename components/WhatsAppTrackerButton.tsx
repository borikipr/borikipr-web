"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  url: string;
  slug: string;
  className?: string;
  children: React.ReactNode;
};

export default function WhatsAppTrackerButton({
  url,
  slug,
  className,
  children,
}: Props) {
  const pathname = usePathname();

  const handleClick = async () => {
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
      onClick={handleClick}
      className={className}
    >
      {children}
    </Link>
  );
}
