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
    <div className="flex min-h-screen flex-col bg-[#f8f8f8]">
      {isLoggedIn && (
        <header className="sticky top-0 z-40 border-b border-white/10 bg-[#0d1b2a]/95 backdrop-blur">
          <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-4 px-4 py-5 md:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#d4af37]">
                Borikí Admin
              </p>
              <h1 className="mt-1 text-xl font-semibold text-white">
                Panel interno
              </h1>
            </div>

            <AdminNav />

            <Link href="/admin/profile" className="text-sm text-white/70 transition hover:text-[#d4af37]">
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
