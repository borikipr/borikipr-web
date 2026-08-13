"use client";

import { ReactNode, useEffect, useId, useState } from "react";

type Props = {
  children: ReactNode;
  count?: number;
  countLabel?: string;
  defaultOpen?: boolean;
  level?: 2 | 3;
  storageKey: string;
  subtitle?: string;
  title: string;
};

export default function CollapsibleAdminSection({
  children,
  count,
  countLabel,
  defaultOpen = false,
  level = 3,
  storageKey,
  subtitle,
  title,
}: Props) {
  const reactId = useId();
  const contentId = `admin-section-${reactId.replace(/:/g, "")}`;
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    const stored = window.sessionStorage.getItem(storageKey);
    if (stored !== "open" && stored !== "closed") return;

    const timeoutId = window.setTimeout(() => {
      setOpen(stored === "open");
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [storageKey]);

  const toggleOpen = () => {
    setOpen((current) => {
      const next = !current;
      window.sessionStorage.setItem(storageKey, next ? "open" : "closed");
      return next;
    });
  };

  const headingClass =
    level === 2
      ? "text-xl font-semibold text-[#000000]"
      : "text-lg font-semibold text-[#000000]";

  return (
    <section className="surface-card overflow-hidden">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex w-full items-start justify-between gap-4 px-5 py-4 text-left transition hover:bg-slate-50 md:px-6"
        aria-controls={contentId}
        aria-expanded={open}
      >
        <div>
          <h2 className={headingClass}>
            <span className="mr-2 text-[#11518b]">{open ? "▼" : "▶"}</span>
            {title}
            {(countLabel || typeof count === "number") && (
              <span className="ml-2 text-[#4d4d4d]">
                {countLabel ?? `(${count})`}
              </span>
            )}
          </h2>
          {subtitle && (
            <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
              {subtitle}
            </p>
          )}
        </div>
      </button>

      {open && (
        <div id={contentId} className="border-t border-slate-200">
          {children}
        </div>
      )}
    </section>
  );
}
