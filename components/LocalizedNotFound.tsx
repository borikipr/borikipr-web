import Link from "next/link";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import type { AppLocale } from "@/lib/i18n/locales";
import { getEquivalentRoute } from "@/lib/i18n/routing";

export default function LocalizedNotFound({ locale }: { locale: AppLocale }) {
  const dictionary = getDictionary(locale);
  const homeHref = getEquivalentRoute("/", locale) ?? "/";
  const listingsHref =
    getEquivalentRoute("/listados", locale) ?? "/listados";

  return (
    <main className="flex min-h-screen items-center bg-white py-24">
      <section className="section-shell w-full text-center">
        <p className="eyebrow">{dictionary.notFound.eyebrow}</p>
        <h1 className="heading-display heading-display-blue mx-auto mt-4 max-w-3xl">
          {dictionary.notFound.title}
        </h1>
        <p className="body-lg mx-auto mt-6 max-w-2xl">
          {dictionary.notFound.description}
        </p>
        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <Link href={homeHref} className="btn-primary">
            {dictionary.notFound.homeAction}
          </Link>
          <Link href={listingsHref} className="btn-secondary">
            {dictionary.notFound.listingsAction}
          </Link>
        </div>
      </section>
    </main>
  );
}
