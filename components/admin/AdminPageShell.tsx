import Link from "next/link";
import { ReactNode } from "react";

type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function AdminPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="px-4 py-5 sm:py-6 md:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1480px] space-y-5">{children}</div>
    </main>
  );
}

export function AdminBreadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm text-[#4d4d4d]">
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={`${item.label}-${index}`} className="flex items-center gap-2">
              {index > 0 && <span className="text-[#b5b5b5]">/</span>}
              {item.href && !isLast ? (
                <Link
                  href={item.href}
                  prefetch={false}
                  className="font-medium text-[#11518b] transition hover:text-[#0d406d]"
                >
                  {item.label}
                </Link>
              ) : (
                <span aria-current={isLast ? "page" : undefined}>
                  {item.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function AdminPageHeader({
  actions,
  breadcrumbs,
  children,
  description,
  eyebrow,
  title,
}: {
  actions?: ReactNode;
  breadcrumbs?: BreadcrumbItem[];
  children?: ReactNode;
  description: string;
  eyebrow: string;
  title: string;
}) {
  return (
    <header className="admin-page-header surface-card px-5 py-5 md:px-6 md:py-6">
      {breadcrumbs && <AdminBreadcrumbs items={breadcrumbs} />}
      <div className={`${breadcrumbs ? "mt-3" : ""} flex flex-col gap-4 md:flex-row md:items-end md:justify-between`}>
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.02em] text-[#111827] md:text-[1.75rem]">{title}</h1>
          <p className="body-base mt-2 max-w-3xl text-sm md:text-base">{description}</p>
          {children}
        </div>
        {actions && <div className="admin-page-actions flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
