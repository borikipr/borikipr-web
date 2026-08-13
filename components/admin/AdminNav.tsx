"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/admin", label: "Dashboard", match: (path: string) => path === "/admin" },
  {
    href: "/admin/propiedades",
    label: "Propiedades",
    match: (path: string) => path.startsWith("/admin/propiedades"),
  },
  {
    href: "/admin/testimonios",
    label: "Testimonios",
    match: (path: string) => path.startsWith("/admin/testimonios"),
  },
  {
    href: "/admin/leads",
    label: "Leads",
    match: (path: string) => path.startsWith("/admin/leads"),
  },
  {
    href: "/admin/signatures",
    label: "Firmas",
    match: (path: string) => path.startsWith("/admin/signatures"),
  },
  {
    href: "/admin/analytics",
    label: "Analytics",
    match: (path: string) => path.startsWith("/admin/analytics"),
  },
  {
    href: "/admin/profile",
    label: "Mi perfil",
    match: (path: string) => path.startsWith("/admin/profile"),
  },
  { href: "/", label: "Ver website", match: () => false },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex w-full min-w-0 max-w-full flex-wrap gap-2 lg:w-auto lg:justify-center" aria-label="Navegación admin">
      {navItems.map((item) => {
        const active = item.match(pathname);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`max-w-full rounded-full border px-3 py-2 text-sm font-medium transition sm:px-4 ${
              active
                ? "border-[#d4af37] bg-[#d4af37] text-[#0d1b2a]"
                : "border-white/10 bg-white/5 text-white/85 hover:border-[#d4af37] hover:text-[#d4af37]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
