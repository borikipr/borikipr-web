import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowUpRight,
  BarChart3,
  Building2,
  CheckCircle2,
  FileSignature,
  Globe2,
  Handshake,
  KeyRound,
  LogOut,
  MessageSquareQuote,
  Plus,
  Star,
  UsersRound,
  type LucideIcon,
} from "lucide-react";
import { AdminPageShell } from "@/components/admin/AdminPageShell";
import TranslationUsageStatusPanel from "@/components/admin/TranslationUsageStatus";
import { getAdminSession } from "@/lib/admin/auth";
import { getAdminDashboardStats } from "@/lib/admin/queries";
import { sql } from "@/lib/db";
import { createPostgresTranslationDatabase } from "@/lib/i18n/translations/repository";
import { getTranslationUsageStatus } from "@/lib/i18n/translations/usage-budget";
import { logoutAdmin } from "./actions";

type Metric = { description: string; icon: LucideIcon; label: string; value: number };
type DashboardTool = { description: string; href: string; icon: LucideIcon; label: string };

function MetricTile({ description, icon: Icon, label, value }: Metric) {
  return (
    <article className="dashboard-metric-tile">
      <span className="dashboard-metric-icon" aria-hidden="true"><Icon size={18} strokeWidth={1.9} /></span>
      <div className="min-w-0">
        <p className="text-[0.7rem] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tracking-[-0.03em] text-slate-950">{value}</p>
        <p className="mt-0.5 text-xs leading-snug text-slate-500">{description}</p>
      </div>
    </article>
  );
}

function ToolLink({ description, href, icon: Icon, label }: DashboardTool) {
  return (
    <Link href={href} className="dashboard-tool-link">
      <span className="dashboard-tool-icon" aria-hidden="true"><Icon size={19} strokeWidth={1.8} /></span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-slate-950">{label}</span>
        <span className="mt-0.5 block text-sm leading-snug text-slate-500">{description}</span>
      </span>
      <ArrowUpRight className="shrink-0 text-slate-400" size={17} aria-hidden="true" />
    </Link>
  );
}

export default async function AdminPage() {
  const user = await getAdminSession();
  if (!user) redirect("/admin/login");

  const [stats, translationUsage] = await Promise.all([
    getAdminDashboardStats(),
    getTranslationUsageStatus(createPostgresTranslationDatabase(sql)).catch(() => null),
  ]);

  const metrics: Metric[] = [
    { label: "Total", value: stats.total, description: "Propiedades registradas", icon: Building2 },
    { label: "Disponibles", value: stats.disponibles, description: "Listas para promoción", icon: CheckCircle2 },
    { label: "Bajo contrato", value: stats.bajoContrato, description: "En proceso de cierre", icon: Handshake },
    { label: "Cerradas", value: stats.cerradas, description: "Vendidas o alquiladas", icon: KeyRound },
    { label: "Destacadas", value: stats.destacadas, description: "Con prioridad visual", icon: Star },
  ];
  const tools: DashboardTool[] = [
    { label: "Propiedades", description: "Inventario y publicación", href: "/admin/propiedades", icon: Building2 },
    { label: "Firmas", description: "Documentos y solicitudes", href: "/admin/signatures", icon: FileSignature },
    { label: "Leads", description: "Contactos y seguimiento", href: "/admin/leads", icon: UsersRound },
    { label: "Testimonios", description: "Experiencias de clientes", href: "/admin/testimonios", icon: MessageSquareQuote },
    { label: "Analytics", description: "Tráfico y comportamiento", href: "/admin/analytics", icon: BarChart3 },
    { label: "Sitio web", description: "Revisar experiencia pública", href: "/", icon: Globe2 },
  ];

  return (
    <AdminPageShell>
      <div className="dashboard-page space-y-4 md:space-y-5">
        <header className="dashboard-welcome surface-card">
          <div className="min-w-0">
            <p className="eyebrow">Resumen operativo</p>
            <h1 className="mt-2 text-2xl font-bold tracking-[-0.03em] text-slate-950 md:text-[1.75rem]">Bienvenido, {user.displayName}</h1>
            <p className="mt-1.5 max-w-2xl text-sm leading-relaxed text-slate-600 md:text-[0.95rem]">Revisa el estado del negocio y entra directamente a las herramientas de trabajo.</p>
          </div>
          <div className="dashboard-welcome-actions">
            <Link href="/admin/propiedades/nueva" className="btn-primary gap-2"><Plus size={17} aria-hidden="true" />Nueva propiedad</Link>
            <form action={logoutAdmin}><button type="submit" className="btn-secondary gap-2"><LogOut size={16} aria-hidden="true" />Cerrar sesión</button></form>
          </div>
        </header>

        <section className="dashboard-metrics-panel surface-card" aria-labelledby="dashboard-inventory-title">
          <div className="dashboard-section-heading">
            <div><p className="eyebrow">Estado del negocio</p><h2 id="dashboard-inventory-title" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">Inventario de propiedades</h2></div>
            <Link href="/admin/propiedades" className="dashboard-section-link">Ver inventario <ArrowUpRight size={15} aria-hidden="true" /></Link>
          </div>
          <div className="dashboard-metric-grid">{metrics.map((metric) => <MetricTile key={metric.label} {...metric} />)}</div>
        </section>

        <div className="dashboard-workspace-grid">
          <section className="surface-card overflow-hidden" aria-labelledby="dashboard-tools-title">
            <div className="dashboard-section-heading"><div><p className="eyebrow">Navegación directa</p><h2 id="dashboard-tools-title" className="mt-1 text-lg font-semibold tracking-[-0.02em] text-slate-950">Accesos rápidos</h2></div></div>
            <div className="dashboard-tools-grid">{tools.map((tool) => <ToolLink key={tool.label} {...tool} />)}</div>
          </section>
          <TranslationUsageStatusPanel status={translationUsage} workerEnabled={process.env.TRANSLATION_WORKER_ENABLED === "true"} provider={process.env.TRANSLATION_PROVIDER?.trim() || null} />
        </div>

      </div>
    </AdminPageShell>
  );
}
