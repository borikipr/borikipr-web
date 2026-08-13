type Variant = "success" | "error" | "info" | "warning";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
};

function getClasses(variant: Variant) {
  switch (variant) {
    case "success":
      return "border-green-200 bg-green-50 text-green-800";
    case "error":
      return "border-red-200 bg-red-50 text-red-700";
    case "info":
      return "border-blue-200 bg-blue-50 text-blue-800";
    case "warning":
      return "border-amber-200 bg-amber-50 text-amber-900";
    default:
      return "border-blue-200 bg-blue-50 text-blue-800";
  }
}

export default function AdminAlert({
  children,
  variant = "info",
}: Props) {
  return (
    <div
      className={`rounded-xl border px-4 py-3 text-sm leading-relaxed ${getClasses(variant)}`}
    >
      {children}
    </div>
  );
}
