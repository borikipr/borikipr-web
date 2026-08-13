import type { ReactNode } from "react";

function join(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function AdminCard({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={join("surface-card", className)}>{children}</section>;
}

export function SectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}) {
  return (
    <header className="admin-section-header">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-[-0.01em] text-slate-950">{title}</h2>
        {description && <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-600">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </header>
  );
}

export function SummaryCard({ label, value, detail }: { label: string; value: ReactNode; detail?: string }) {
  return (
    <div className="surface-card px-4 py-4 md:px-5">
      <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-[-0.02em] text-slate-950">{value}</p>
      {detail && <p className="mt-1 text-sm text-slate-600">{detail}</p>}
    </div>
  );
}

export function FilterBar({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={join("admin-filter-bar", className)}>{children}</section>;
}

export function FormSection({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="text-base font-semibold text-slate-950">{title}</legend>
      {description && <p className="mt-1 text-sm leading-relaxed text-slate-600">{description}</p>}
      <div className="mt-4 grid min-w-0 gap-4">{children}</div>
    </fieldset>
  );
}

export function EmptyState({ action, description, title }: { action?: ReactNode; description: string; title: string }) {
  return (
    <section className="surface-card px-5 py-9 text-center md:py-11">
      <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600">{description}</p>
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}

export function DetailSection({ children, description, title }: { children: ReactNode; description?: string; title: string }) {
  return (
    <details className="surface-card group overflow-hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 [&::-webkit-details-marker]:hidden">
        <div className="min-w-0"><h2 className="font-semibold text-slate-950">{title}</h2>{description && <p className="mt-1 text-sm text-slate-600">{description}</p>}</div>
        <span aria-hidden="true" className="text-lg text-slate-500 transition group-open:rotate-45">+</span>
      </summary>
      <div className="border-t border-slate-100 p-5">{children}</div>
    </details>
  );
}
