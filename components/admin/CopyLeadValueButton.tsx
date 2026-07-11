"use client";

import { useState } from "react";

export default function CopyLeadValueButton({
  value,
  label,
}: {
  value?: string | null;
  label: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!value) {
    return <span className="text-xs text-[#8a8a8a]">No disponible</span>;
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setCopied(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleCopy}
      className="text-sm font-medium text-[#11518b] transition hover:text-[#0d406d]"
    >
      {copied ? "Copiado" : label}
    </button>
  );
}
