"use client";

import { useState, useRef } from "react";

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
  "Buena Vista",
  "Cabo Rojo",
  "Caguas",
  "Camuy",
  "Canóvanas",
  "Carolina",
  "Catano",
  "Cayey",
  "Ceiba",
  "Ciales",
  "Cidra",
  "Coamo",
  "Comerío",
  "Corozal",
  "Corrales",
  "Culebra",
  "Dorado",
  "Ensenada",
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
  "Puerto Real",
  "Quebradillas",
  "Rincón",
  "Río Grande",
  "Sabana Grande",
  "Salinas",
  "San Blas",
  "San Carlos",
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
    <div className="w-full max-w-2xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8 pb-6 border-b border-gray-200">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          Evaluación para Venta de Propiedad
        </h1>
        <p className="text-gray-600 mb-2">
          Completa este formulario para brindarte una orientación precisa sobre la venta de tu propiedad.
        </p>
        <p className="text-gray-600">
          Nos comunicaremos contigo lo antes posible. 📞✨
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
        {/* Nombre completo */}
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
            Nombre completo <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="nombre"
            name="nombre"
            required
            placeholder="Tu nombre"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
            Email <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            placeholder="tu@email.com"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Teléfono */}
        <div>
          <label htmlFor="telefono" className="block text-sm font-medium text-gray-700 mb-2">
            Teléfono <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            id="telefono"
            name="telefono"
            required
            placeholder="(787) 123-4567"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tipo Propiedad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Tipo Propiedad <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {["Casa", "Apartamento", "Terreno", "Multifamiliar", "Propiedad Comercial"].map((option) => (
              <label key={option} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="tipoPropiedad"
                  value={option}
                  required
                  className="w-4 h-4"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Ubicación de la Propiedad (Municipio) */}
        <div>
          <label htmlFor="ubicacion" className="block text-sm font-medium text-gray-700 mb-2">
            Ubicación de la Propiedad
          </label>
          <select
            id="ubicacion"
            name="ubicacion"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Selecciona un municipio</option>
            {municipiosPR.map((municipio) => (
              <option key={municipio} value={municipio}>
                {municipio}
              </option>
            ))}
          </select>
        </div>

        {/* ¿Por qué deseas vender? */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            ¿Por qué deseas vender? <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {["Mudanza", "Inversión", "Otro"].map((option) => (
              <label key={option} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="razonVenta"
                  value={option}
                  required
                  className="w-4 h-4"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Mensajes de estado */}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700">
            ¡Gracias! Tu solicitud ha sido enviada correctamente. Nos pondremos en contacto pronto.
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md text-red-700">
            {error}
          </div>
        )}

        {/* Botón */}
        <button
          type="submit"
          disabled={loading}
          className="w-full px-6 py-2 bg-purple-600 text-white font-medium rounded-md hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? "Enviando..." : "Submit"}
        </button>
      </form>
    </div>
  );
}
