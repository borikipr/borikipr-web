type Variant = "success" | "error" | "info";

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
      className={`rounded-2xl border px-5 py-4 text-sm ${getClasses(variant)}`}
    >
      {children}
    </div>
  );
}