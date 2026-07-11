export function AnalyticsChartCard({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="surface-card p-5">
      <div className="mb-4">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#d4af37]">
          {eyebrow}
        </p>
        <h2 className="mt-2 text-xl font-semibold text-[#000000]">{title}</h2>
        <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
          {description}
        </p>
      </div>
      {children}
    </section>
  );
}

