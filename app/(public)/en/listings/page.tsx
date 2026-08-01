import {
  renderListingsPage,
  type ListingsSearchParams,
} from "../../listados/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";
import { buildStaticPageMetadata } from "@/lib/i18n/seo";

export const metadata = buildStaticPageMetadata("listings", ENGLISH_LOCALE);

export default function EnglishListingsPage({
  searchParams,
}: {
  searchParams: ListingsSearchParams;
}) {
  return renderListingsPage({ searchParams, locale: ENGLISH_LOCALE });
}
