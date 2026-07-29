import type { Metadata } from "next";
import Header from "@/components/Header";
import { getDictionary } from "@/lib/i18n/get-dictionary";
import { DEFAULT_LOCALE, type AppLocale } from "@/lib/i18n/locales";

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Información sobre el uso y la protección de datos en BorikíPR y Erickson Real Estate.",
};

export function renderPrivacyPage(locale: AppLocale) {
  const copy = getDictionary(locale).privacyPage;

  return (
    <>
      <Header />
      <main className="section-shell pb-14 pt-[120px] sm:pb-20 sm:pt-[140px]">
        <article className="mx-auto max-w-3xl text-[#263746]">
          <p className="eyebrow !text-[#765f12]">{copy.eyebrow}</p>
          <h1 className="mt-3 text-4xl font-bold text-[#0d1b2a]">
            {copy.title}
          </h1>
          <p className="mt-5 leading-7">{copy.introduction}</p>

          <div className="mt-10 space-y-8">
            {copy.sections.map((section) => (
              <section key={section.title}>
                <h2 className="text-2xl font-semibold text-[#11518b]">
                  {section.title}
                </h2>
                <p className="mt-3 leading-7">{section.body}</p>
              </section>
            ))}

            <section>
              <h2 className="text-2xl font-semibold text-[#11518b]">
                {copy.retention.title}
              </h2>
              <p className="mt-3 leading-7">
                {copy.retention.beforeEmail}
                {" "}
                <a
                  className="font-semibold text-[#11518b] underline"
                  href="mailto:ericksonrealestatepr@gmail.com"
                >
                  ericksonrealestatepr@gmail.com
                </a>
                . {copy.retention.afterEmail}
              </p>
            </section>
          </div>

          <p className="mt-10 rounded-2xl bg-[#eef5fb] p-5 text-sm leading-6">
            {copy.notice}
          </p>
        </article>
      </main>
    </>
  );
}

export default function PrivacyPage() {
  return renderPrivacyPage(DEFAULT_LOCALE);
}
