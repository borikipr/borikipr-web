import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { getPaginationItems } from "@/lib/admin/pagination";

type LeadsPaginationProps = {
  currentPage: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
};

export function LeadsPagination({
  currentPage,
  totalPages,
  hrefForPage,
}: LeadsPaginationProps) {
  if (totalPages <= 1) return null;

  const pages = getPaginationItems(currentPage, totalPages);
  const hasPreviousPage = currentPage > 1;
  const hasNextPage = currentPage < totalPages;

  return (
    <nav aria-label="Paginación de leads" className="lead-pagination">
      <p className="text-sm text-slate-600">
        Página <strong className="font-semibold text-slate-900">{currentPage}</strong> de{" "}
        <strong className="font-semibold text-slate-900">{totalPages}</strong>
      </p>
      <div className="lead-pagination-controls">
        {hasPreviousPage ? (
          <Link
            aria-label="Página anterior"
            className="lead-pagination-control"
            href={hrefForPage(currentPage - 1)}
          >
            <ChevronLeft aria-hidden="true" size={16} />
            <span className="hidden sm:inline">Anterior</span>
          </Link>
        ) : (
          <span aria-disabled="true" className="lead-pagination-control is-disabled">
            <ChevronLeft aria-hidden="true" size={16} />
            <span className="hidden sm:inline">Anterior</span>
          </span>
        )}

        <div className="lead-pagination-pages">
          {pages.map((item) =>
            typeof item === "number" ? (
              item === currentPage ? (
                <span
                  aria-current="page"
                  aria-label={`Página actual, ${item}`}
                  className="lead-pagination-page is-current"
                  key={item}
                >
                  {item}
                </span>
              ) : (
                <Link
                  aria-label={`Ir a la página ${item}`}
                  className="lead-pagination-page"
                  href={hrefForPage(item)}
                  key={item}
                >
                  {item}
                </Link>
              )
            ) : (
              <span aria-hidden="true" className="lead-pagination-ellipsis" key={item}>
                …
              </span>
            ),
          )}
        </div>

        {hasNextPage ? (
          <Link
            aria-label="Página siguiente"
            className="lead-pagination-control"
            href={hrefForPage(currentPage + 1)}
          >
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight aria-hidden="true" size={16} />
          </Link>
        ) : (
          <span aria-disabled="true" className="lead-pagination-control is-disabled">
            <span className="hidden sm:inline">Siguiente</span>
            <ChevronRight aria-hidden="true" size={16} />
          </span>
        )}
      </div>
    </nav>
  );
}
