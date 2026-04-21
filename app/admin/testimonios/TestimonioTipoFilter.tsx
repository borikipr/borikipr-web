"use client";

import { useRouter } from "next/navigation";

type Props = {
  currentTipo?: string;
};

export default function TestimonioTipoFilter({ currentTipo }: Props) {
  const router = useRouter();

  const handleChange = (val: string) => {
    const url = val ? `/admin/testimonios?tipo=${val}` : "/admin/testimonios";
    router.push(url);
  };

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="tipo-filter" className="text-sm font-medium text-[#4d4d4d]">
        Filtrar por:
      </label>
      <select
        id="tipo-filter"
        value={currentTipo || ""}
        onChange={(e) => handleChange(e.target.value)}
        className="rounded-xl border border-[#d9d9d9] bg-white px-3 py-2 text-sm text-[#4d4d4d]"
      >
        <option value="">Todos los tipos</option>
        <option value="comprador">Compradores</option>
        <option value="vendedor">Vendedores</option>
      </select>
    </div>
  );
}
