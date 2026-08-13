import { ReactNode } from "react";
import Link from "next/link";
import AdminNav from "@/components/admin/AdminNav";
import AdminFooter from "@/components/admin/AdminFooter";
import { getAdminSession } from "@/lib/admin/auth";

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getAdminSession();
  const isLoggedIn = Boolean(user);

  return (
    <div className="admin-app flex min-h-screen flex-col bg-[#f4f6f8]">
      {isLoggedIn && (
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1b2a]/95 backdrop-blur">
          <div className="mx-auto flex w-full min-w-0 max-w-[1480px] items-center justify-between gap-3 overflow-hidden px-4 py-3 md:px-6 lg:gap-4 lg:px-8 lg:py-3.5">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d4af37]">
                Borikí Admin
              </p>
              <h1 className="mt-1 hidden text-xl font-semibold text-white sm:block">
                Panel interno
              </h1>
            </div>

            <AdminNav displayName={user?.displayName ?? "Admin"} />

            <Link href="/admin/profile" className="hidden max-w-full break-words text-sm text-white/70 transition hover:text-[#d4af37] xl:block">
              Sesión: <span className="font-semibold text-white">{user?.displayName}</span>
            </Link>
          </div>
        </header>
      )}

      <div className="min-w-0 flex-1">{children}</div>
      <AdminFooter />
    </div>
  );
}
