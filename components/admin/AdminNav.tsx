"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { ModuleKey } from "@/lib/admin/access-types";

const baseNavItems: Array<{ href: string; label: string; module?: ModuleKey; match: (path: string) => boolean }> = [
  { href: "/admin", label: "Dashboard", match: (path: string) => path === "/admin" },
  { href: "/admin/propiedades", label: "Propiedades", module: "properties", match: (path: string) => path.startsWith("/admin/propiedades") },
  { href: "/admin/leads", label: "Leads", module: "leads", match: (path: string) => path.startsWith("/admin/leads") },
  { href: "/admin/signatures", label: "Firmas", module: "signatures", match: (path: string) => path.startsWith("/admin/signatures") },
  { href: "/admin/testimonios", label: "Testimonios", module: "testimonials", match: (path: string) => path.startsWith("/admin/testimonios") },
  { href: "/admin/analytics", label: "Analytics", module: "analytics", match: (path: string) => path.startsWith("/admin/analytics") },
  { href: "/admin/profile", label: "Mi perfil", match: (path: string) => path.startsWith("/admin/profile") },
  { href: "/", label: "Ver website", match: () => false },
] as const;

const teamNavItem = { href: "/admin/equipo", label: "Equipo", match: (path: string) => path.startsWith("/admin/equipo") } as const;

function getNavItems(showTeam: boolean, allowedModules: ModuleKey[]) {
  const filtered = baseNavItems.filter((item) => !item.module || allowedModules.includes(item.module));
  return showTeam ? [...filtered.slice(0, -2), teamNavItem, ...filtered.slice(-2)] : filtered;
}

function NavLinks({ pathname, onNavigate, mobile = false, showTeam, allowedModules }: { pathname: string; onNavigate?: () => void; mobile?: boolean; showTeam: boolean; allowedModules: ModuleKey[] }) {
  return getNavItems(showTeam, allowedModules).map((item) => {
    const active = item.match(pathname);
    return (
      <Link
        key={item.href}
        href={item.href}
        prefetch={false}
        aria-current={active ? "page" : undefined}
        onClick={() => { if (onNavigate) window.setTimeout(onNavigate, 0); }}
        className={`${mobile ? "flex min-h-12 w-full items-center rounded-xl px-4 py-3" : "rounded-full border px-3 py-2 text-sm sm:px-4"} font-medium transition ${
          active
            ? "border-[#d4af37] bg-[#d4af37] text-[#0d1b2a]"
            : mobile
              ? "text-white/90 hover:bg-white/10 hover:text-[#d4af37]"
              : "border-white/10 bg-white/5 text-white/85 hover:border-[#d4af37] hover:text-[#d4af37]"
        }`}
      >
        {item.label}
      </Link>
    );
  });
}

export default function AdminNav({ displayName, showTeam = false, allowedModules = [] }: { displayName: string; showTeam?: boolean; allowedModules?: ModuleKey[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const section = getNavItems(showTeam, allowedModules).find((item) => item.match(pathname))?.label ?? "Panel interno";

  useEffect(() => {
    if (!open) return;
    const trigger = triggerRef.current;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    function keydown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
      if (event.key !== "Tab") return;
      const drawer = closeRef.current?.closest("[role=dialog]");
      const focusable = drawer ? [...drawer.querySelectorAll<HTMLElement>('a[href],button:not([disabled])')] : [];
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener("keydown", keydown);
    return () => { document.body.style.overflow = previousOverflow; document.removeEventListener("keydown", keydown); trigger?.focus(); };
  }, [open]);

  return (
    <>
      <div className="flex min-w-0 flex-1 items-center justify-end gap-3 lg:hidden">
        <p className="min-w-0 truncate text-sm font-semibold text-white" aria-live="polite">{section}</p>
        <button
          ref={triggerRef}
          aria-controls="admin-mobile-drawer"
          aria-expanded={open}
          aria-label="Abrir menú de administración"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#d4af37]"
          onClick={() => setOpen(true)}
          type="button"
        ><Menu aria-hidden size={22} /></button>
      </div>

      <nav className="hidden min-w-0 flex-wrap gap-2 lg:flex lg:justify-center" aria-label="Navegación admin">
        <NavLinks pathname={pathname} showTeam={showTeam} allowedModules={allowedModules} />
      </nav>

      {open && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] lg:hidden" data-admin-drawer-overlay>
          <button aria-label="Cerrar menú" className="fixed inset-0 bg-black/55 animate-[admin-backdrop-in_180ms_ease-out]" data-admin-drawer-backdrop onClick={() => setOpen(false)} type="button" />
          <aside
            id="admin-mobile-drawer"
            aria-label="Menú de administración"
            aria-modal="true"
            className="fixed inset-y-0 left-0 flex h-dvh w-[88vw] max-w-[380px] flex-col overflow-hidden bg-[#0d1b2a] shadow-2xl animate-[admin-drawer-in_220ms_ease-out]"
            data-admin-mobile-drawer
            role="dialog"
          >
            <div className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5">
              <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#d4af37]">Borikí Admin</p><p className="mt-1 truncate text-sm text-white/75">{displayName}</p></div>
              <button ref={closeRef} aria-label="Cerrar menú de administración" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-[#d4af37]" onClick={() => setOpen(false)} type="button"><X aria-hidden size={22} /></button>
            </div>
            <nav aria-label="Navegación admin móvil" className="grid min-h-0 flex-1 gap-2 overflow-y-auto overscroll-contain p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]"><NavLinks pathname={pathname} showTeam={showTeam} allowedModules={allowedModules} mobile onNavigate={() => setOpen(false)} /></nav>
          </aside>
        </div>,
        document.body,
      )}
    </>
  );
}
