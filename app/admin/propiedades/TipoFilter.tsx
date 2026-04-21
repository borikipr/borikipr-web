"use client";

import { useRouter } from "next/navigation";

type Props = {
  currentTipo?: string;
};

export default function TipoFilter({ currentTipo }: Props) {
  const router = useRouter();

  const handleChange = (val: string) => {
    const url = val ? `/admin/propiedades?tipo=${val}` : "/admin/propiedades";
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
        <option value="Casa">Casas</option>
        <option value="Apartamento">Apartamentos</option>
        <option value="Condominio">Condominios</option>
        <option value="Terreno">Terrenos</option>
        <option value="Comercial">Comercial</option>
      </select>
    </div>
  );
}
