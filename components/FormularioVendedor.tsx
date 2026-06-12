"use client";

import { useRef, useState } from "react";

const municipiosPR = [
  "Adjuntas",
  "Aguada",
  "Aguadilla",
  "Aguas Buenas",
  "Aibonito",
  "Arecibo",
  "Arroyo",
  "Barceloneta",
  "Barranquitas",
  "Bayamón",
  "Cabo Rojo",
  "Caguas",
  "Camuy",
  "Canóvanas",
  "Carolina",
  "Cataño",
  "Cayey",
  "Ceiba",
  "Ciales",
  "Cidra",
  "Coamo",
  "Comerío",
  "Corozal",
  "Culebra",
  "Dorado",
  "Fajardo",
  "Florida",
  "Guánica",
  "Guayama",
  "Guayanilla",
  "Guaynabo",
  "Gurabo",
  "Hatillo",
  "Hormigueros",
  "Humacao",
  "Isabela",
  "Jayuya",
  "Juana Díaz",
  "Juncos",
  "Lajas",
  "Lares",
  "Las Marías",
  "Las Piedras",
  "Loíza",
  "Luquillo",
  "Manatí",
  "Maricao",
  "Maunabo",
  "Mayagüez",
  "Moca",
  "Morovis",
  "Naguabo",
  "Naranjito",
  "Orocovis",
  "Patillas",
  "Peñuelas",
  "Ponce",
  "Quebradillas",
  "Rincón",
  "Río Grande",
  "Sabana Grande",
  "Salinas",
  "San Germán",
  "San Juan",
  "San Lorenzo",
  "San Sebastián",
  "Santa Isabel",
  "Toa Alta",
  "Toa Baja",
  "Trujillo Alto",
  "Utuado",
  "Vega Alta",
  "Vega Baja",
  "Vieques",
  "Villalba",
  "Yabucoa",
  "Yauco",
];

const tiposPropiedad = [
  "Casa",
  "Apartamento",
  "Terreno",
  "Multifamiliar",
  "Propiedad Comercial",
];

const interesesPrincipales = ["Vender", "Alquilar", "Evaluar ambas opciones"];

export default function FormularioVendedor() {
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess(false);

    const form = formRef.current!;
    const formData = new FormData(form);
    const data = {
      nombre: formData.get("nombre"),
      email: formData.get("email"),
      telefono: formData.get("telefono"),
      tipoPropiedad: formData.get("tipoPropiedad"),
      ubicacion: formData.get("ubicacion"),
      razonVenta: formData.get("razonVenta"),
      comentarios: formData.get("comentarios"),
    };

    try {
      const response = await fetch("/api/formulario/vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Error al enviar el formulario");
      }

      setSuccess(true);
      formRef.current?.reset();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-7">
      <div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4af37]">
          Información de contacto
        </p>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <Field label="Nombre completo" htmlFor="nombre" required>
          <input
            id="nombre"
            name="nombre"
            type="text"
            required
            placeholder="Tu nombre y apellido"
            className="input-premium"
          />
        </Field>

        <Field label="Email" htmlFor="email" required>
          <input
            id="email"
            name="email"
            type="email"
            required
            placeholder="tu@email.com"
            className="input-premium"
          />
        </Field>

        <Field label="Teléfono" htmlFor="telefono" required>
          <input
            id="telefono"
            name="telefono"
            type="tel"
            required
            placeholder="(787) 123-4567"
            className="input-premium"
          />
        </Field>

        <Field label="Municipio" htmlFor="ubicacion">
          <select id="ubicacion" name="ubicacion" className="input-premium">
            <option value="">Selecciona un municipio</option>
            {municipiosPR.map((municipio) => (
              <option key={municipio} value={municipio}>
                {municipio}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <ChoiceGroup
          legend="Tipo de propiedad"
          name="tipoPropiedad"
          options={tiposPropiedad}
          type="radio"
          required
        />

        <ChoiceGroup
          legend="¿Cuál es tu interés principal?"
          name="razonVenta"
          options={interesesPrincipales}
          type="radio"
          required
        />
      </div>

      <Field label="Comentarios adicionales" htmlFor="comentarios">
        <textarea
          id="comentarios"
          name="comentarios"
          rows={5}
          placeholder="Ejemplo: remodelaciones recientes, placas solares, generador, piscina, mejoras importantes, etc."
          className="input-premium resize-none"
        />
      </Field>

      {success && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm font-medium text-green-800">
          Gracias. Tu solicitud fue enviada correctamente y nos comunicaremos pronto.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full justify-center py-3.5 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Enviando..." : "Enviar solicitud"}
      </button>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  required,
  children,
}: {
  label: string;
  htmlFor: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-[#000000]">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {children}
    </div>
  );
}

function ChoiceGroup({
  legend,
  helper,
  name,
  options,
  type,
  required,
  columns = "grid-cols-1",
}: {
  legend: string;
  helper?: string;
  name: string;
  options: string[];
  type: "radio" | "checkbox";
  required?: boolean;
  columns?: string;
}) {
  return (
    <fieldset className="space-y-3">
      <div>
        <legend className="text-sm font-semibold text-[#000000]">
          {legend} {required && <span className="text-red-500">*</span>}
        </legend>
        {helper && <p className="mt-1 text-sm text-[#4d4d4d]">{helper}</p>}
      </div>
      <div className={`grid gap-2 ${columns}`}>
        {options.map((option) => (
          <label
            key={option}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-[#d9d9d9] bg-white px-4 py-2.5 text-sm text-[#333333] transition hover:border-[#11518b] hover:bg-[#f7fbff]"
          >
            <input
              type={type}
              name={name}
              value={option}
              required={required}
              className="h-4 w-4 border-[#d9d9d9] accent-[#11518b]"
            />
            <span>{option}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
