import Link from "next/link";
import { ReactNode } from "react";
import { getAdminSessionUser } from "@/lib/admin/auth";
import { redirect } from "next/navigation";

function NavLink({
  href,
  label,
}: {
  href: string;
  label: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-medium text-white/85 transition hover:border-[#d4af37] hover:text-[#d4af37]"
    >
      {label}
    </Link>
  );
}

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAdminSessionUser();

  if (!user) {
    redirect("/admin/login");
  }

  return (
    <div className="min-h-screen bg-[#f8f8f8]">
      <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1b2a]/95 backdrop-blur">
        <div className="section-shell flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d4af37]">
              Borikí Admin
            </p>
            <h1 className="mt-1 text-xl font-semibold text-white">
              Panel interno
            </h1>
          </div>

          <nav className="flex flex-wrap gap-3">
            <NavLink href="/admin" label="Dashboard" />
            <NavLink href="/admin/propiedades" label="Propiedades" />
            <NavLink href="/admin/testimonios" label="Testimonios" />
            <NavLink href="/" label="Ver website" />
          </nav>

          <div className="text-sm text-white/70">
            Sesión: <span className="font-semibold text-white">{user}</span>
          </div>
        </div>
      </header>

      <div>{children}</div>
    </div>
  );
}