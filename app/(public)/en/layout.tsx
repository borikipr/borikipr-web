import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { isMultilingualEnabled } from "@/lib/i18n/locales";

export default function EnglishPreviewLayout({
  children,
}: {
  children: ReactNode;
}) {
  if (!isMultilingualEnabled()) {
    notFound();
  }

  return children;
}
