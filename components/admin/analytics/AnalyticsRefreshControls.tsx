"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState, useTransition } from "react";
import { AnalyticsLastUpdated } from "./AnalyticsLastUpdated";

type RefreshInterval = "off" | "30" | "60" | "120";

const intervalLabels: Record<RefreshInterval, string> = {
  off: "Off",
  "30": "30s",
  "60": "60s",
  "120": "2m",
};

function intervalMs(value: RefreshInterval) {
  if (value === "off") return null;
  return Number(value) * 1000;
}

export function AnalyticsRefreshControls({
  lastUpdated,
  mode = "manual",
  note,
}: {
  lastUpdated: string;
  mode?: "manual" | "live" | "disabled";
  note?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [interval, setIntervalValue] = useState<RefreshInterval>("off");
  const [error, setError] = useState<string | null>(null);

  const refreshNow = useCallback(() => {
    setError(null);

    try {
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError("No se pudo refrescar la información. Inténtalo nuevamente.");
    }
  }, [router, startTransition]);

  useEffect(() => {
    if (mode !== "live") return;

    const delay = intervalMs(interval);
    if (!delay) return;

    const timer = window.setInterval(() => {
      refreshNow();
    }, delay);

    return () => window.clearInterval(timer);
  }, [interval, mode, refreshNow]);

  return (
    <div className="rounded-2xl border border-[#e8e8e8] bg-[#fafafa] p-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <AnalyticsLastUpdated timestamp={lastUpdated} />
          {note && <p className="mt-2 text-sm text-[#4d4d4d]">{note}</p>}
          {mode === "live" && (
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-[#11518b]">
              LIVE · Auto refresh: {intervalLabels[interval]}
            </p>
          )}
          {error && <p className="mt-2 text-sm text-red-700">{error}</p>}
        </div>

        {mode !== "disabled" && (
          <div className="flex flex-wrap items-center gap-3">
            {mode === "live" && (
              <label className="flex items-center gap-2 text-sm font-semibold text-[#4d4d4d]">
                Auto refresh
                <select
                  value={interval}
                  onChange={(event) =>
                    setIntervalValue(event.target.value as RefreshInterval)
                  }
                  className="rounded-full border border-[#d9d9d9] bg-white px-4 py-2 text-sm font-semibold text-[#000000]"
                >
                  <option value="off">Off</option>
                  <option value="30">30 seconds</option>
                  <option value="60">60 seconds</option>
                  <option value="120">2 minutes</option>
                </select>
              </label>
            )}

            <button
              type="button"
              onClick={refreshNow}
              disabled={isPending}
              className="btn-secondary disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPending ? "Refreshing..." : "Refresh now"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
