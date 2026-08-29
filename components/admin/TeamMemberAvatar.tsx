export function teamMemberInitials(value: string) {
  const parts = value.trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] ?? "A"}${parts.length > 1 ? parts.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}

export default function TeamMemberAvatar({ imageUrl, name, size = "default" }: { imageUrl: string | null; name: string; size?: "default" | "large" }) {
  const sizeClass = size === "large" ? "h-20 w-20 text-xl" : "h-11 w-11 text-sm";
  return (
    <div className={`flex ${sizeClass} shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#0d1b2a] font-bold text-[#d4af37]`}>
      {imageUrl ? <img src={imageUrl} alt={`Foto de perfil de ${name}`} className="h-full w-full object-cover" /> : <span aria-label={`Iniciales de ${name}`}>{teamMemberInitials(name)}</span>}
    </div>
  );
}
