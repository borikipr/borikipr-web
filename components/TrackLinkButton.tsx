"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Props = {
  href: string;
  slug?: string | null;
  tipo: string;
  className?: string;
  target?: string;
  children: React.ReactNode;
};

export default function TrackLinkButton({
  href,
  slug = null,
  tipo,
  className,
  target,
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
      onClick={handleClick}
      className={className}
    >
      {children}
    </Link>
  );
}
