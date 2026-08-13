import Link from "next/link";
import { ReactNode } from "react";

type BreadcrumbItem = {
  href?: string;
  label: string;
};

export function AdminPageShell({ children }: { children: ReactNode }) {
  return (
    <main className="px-4 py-8 md:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[1600px] space-y-6">{children}</div>
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
    <div className="surface-card p-6 md:p-8">
      {breadcrumbs && <AdminBreadcrumbs items={breadcrumbs} />}
      <div className="mt-4 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="mt-3 text-3xl font-bold text-[#000000]">{title}</h1>
          <p className="body-base mt-3 max-w-3xl">{description}</p>
          {children}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
      </div>
    </div>
  );
}
