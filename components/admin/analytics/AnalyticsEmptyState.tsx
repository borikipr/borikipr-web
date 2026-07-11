export function AnalyticsEmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-[#d9d9d9] bg-[#fafafa] p-5">
      <p className="text-sm text-[#4d4d4d]">{message}</p>
    </div>
  );
}

