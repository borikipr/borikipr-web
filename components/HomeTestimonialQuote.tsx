"use client";

import { useEffect, useId, useRef, useState } from "react";

type HomeTestimonialQuoteProps = {
  text: string;
  readMoreLabel: string;
  readLessLabel: string;
};

export default function HomeTestimonialQuote({
  text,
  readMoreLabel,
  readLessLabel,
}: HomeTestimonialQuoteProps) {
  const quoteId = useId();
  const quoteRef = useRef<HTMLParagraphElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    if (expanded) return;

    const quote = quoteRef.current;
    if (!quote) return;

    const measureOverflow = () => {
      setIsTruncated(quote.scrollHeight > quote.clientHeight + 1);
    };

    measureOverflow();

    const resizeObserver = new ResizeObserver(measureOverflow);
    resizeObserver.observe(quote);

    return () => resizeObserver.disconnect();
  }, [expanded, text]);

  return (
    <div>
      <p
        ref={quoteRef}
        id={quoteId}
        className={`text-[#4d4d4d] leading-relaxed ${expanded ? "" : "line-clamp-4"}`}
      >
        &ldquo;{text}&rdquo;
      </p>

      {isTruncated && (
        <button
          type="button"
          className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-[#11518b] underline-offset-4 transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11518b] focus-visible:ring-offset-2"
          aria-expanded={expanded}
          aria-controls={quoteId}
          onClick={() => setExpanded((current) => !current)}
        >
          {expanded ? readLessLabel : readMoreLabel}
        </button>
      )}
    </div>
  );
}
