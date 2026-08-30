import type { PublicProfileApprovalState } from "@/lib/admin/professional-profile";

const labels: Record<PublicProfileApprovalState, string> = {
  draft: "No publicado", pending_review: "Pendiente de revisión", approved: "Aprobado", disabled: "No habilitado",
};
const classes: Record<PublicProfileApprovalState, string> = {
  draft: "border-slate-200 bg-slate-100 text-slate-700", pending_review: "border-amber-200 bg-amber-50 text-amber-900", approved: "border-emerald-200 bg-emerald-50 text-emerald-800", disabled: "border-slate-200 bg-slate-100 text-slate-700",
};

export default function PublicProfileStatusBadge({ state }: { state: PublicProfileApprovalState }) {
  return <span className={`inline-flex min-h-7 items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${classes[state]}`}>{labels[state]}</span>;
}
