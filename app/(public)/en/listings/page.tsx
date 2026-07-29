import {
  renderListingsPage,
  type ListingsSearchParams,
} from "../../listados/page";
import { ENGLISH_LOCALE } from "@/lib/i18n/locales";

export default function EnglishListingsPage({
  searchParams,
}: {
  searchParams: ListingsSearchParams;
}) {
  return renderListingsPage({ searchParams, locale: ENGLISH_LOCALE });
}
