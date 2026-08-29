import { ReactNode } from "react";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import AdminFooter from "@/components/admin/AdminFooter";
import { getAdminAccessContext } from "@/lib/admin/access-context";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const access = await getAdminAccessContext();
  const user = access?.user;
  const isLoggedIn = Boolean(access);

  return (
    <div className="admin-app flex min-h-screen flex-col bg-[#f4f6f8]">
      {isLoggedIn && (
        <a
          className="sr-only fixed left-4 top-4 z-[60] rounded-lg bg-white px-4 py-3 text-sm font-semibold text-[#0d1b2a] shadow-lg outline-none focus:not-sr-only focus:ring-2 focus:ring-[#d4af37]"
          href="#admin-content"
        >
          Saltar al contenido principal
        </a>
      )}
      {isLoggedIn && (
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1b2a]/95 backdrop-blur">
          <div className="mx-auto flex w-full min-w-0 max-w-[1480px] items-center justify-between gap-3 overflow-hidden px-4 py-3 md:px-6 lg:gap-4 lg:px-8 lg:py-3.5">
            <Link href="/admin" className="min-w-0 rounded-md outline-none focus-visible:ring-2 focus-visible:ring-[#d4af37]">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d4af37]">
                Borikí Admin
              </p>
              <p className="mt-1 hidden text-xl font-semibold text-white sm:block">
                Panel interno
              </p>
            </Link>

            <AdminNav displayName={user?.displayName ?? "Admin"} />

            <Link href="/admin/profile" className="hidden max-w-full break-words text-sm text-white/70 transition hover:text-[#d4af37] xl:block">
              Sesión: <span className="font-semibold text-white">{user?.displayName}</span>
            </Link>
          </div>
        </header>
      )}

      <div className="min-w-0 flex-1 outline-none" id="admin-content" tabIndex={-1}>{children}</div>
      <AdminFooter />
    </div>
  );
}
