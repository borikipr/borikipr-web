type Variant =
  | "blue"
  | "gold"
  | "green"
  | "gray"
  | "red"
  | "outline";

type Props = {
  children: React.ReactNode;
  variant?: Variant;
};

function getClasses(variant: Variant) {
  switch (variant) {
    case "blue":
      return "bg-[#11518b] text-white border-[#11518b]";
    case "gold":
      return "bg-[#d4af37] text-black border-[#d4af37]";
    case "green":
      return "bg-green-100 text-green-800 border-green-200";
    case "gray":
      return "bg-[#4d4d4d] text-white border-[#4d4d4d]";
    case "red":
      return "bg-red-100 text-red-700 border-red-200";
    case "outline":
      return "bg-white text-[#4d4d4d] border-[#d9d9d9]";
    default:
      return "bg-white text-[#4d4d4d] border-[#d9d9d9]";
  }
}

export default function StatusBadge({
  children,
  variant = "outline",
}: Props) {
  return (
    <span
      className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] ${getClasses(
        variant
      )}`}
    >
      {children}
    </span>
  );
}