export type PaginationItem = number | "ellipsis-left" | "ellipsis-right";

/**
 * Keeps operational lists directly navigable without rendering an unbounded
 * collection of page buttons as the directory grows.
 */
export function getPaginationItems(
  currentPage: number,
  totalPages: number,
): PaginationItem[] {
  if (totalPages <= 1) return [1];

  const safeCurrentPage = Math.min(Math.max(currentPage, 1), totalPages);
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const items: PaginationItem[] = [1];
  const leftSibling = Math.max(safeCurrentPage - 1, 2);
  const rightSibling = Math.min(safeCurrentPage + 1, totalPages - 1);

  if (leftSibling > 2) items.push("ellipsis-left");
  for (let page = leftSibling; page <= rightSibling; page += 1) {
    items.push(page);
  }
  if (rightSibling < totalPages - 1) items.push("ellipsis-right");
  items.push(totalPages);

  return items;
}
