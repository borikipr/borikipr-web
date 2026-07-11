export function AnalyticsLastUpdated({ timestamp }: { timestamp: string }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#4d4d4d]">
      Last updated:{" "}
      <span className="normal-case tracking-normal text-[#11518b]">
        {timestamp}
      </span>
    </p>
  );
}

