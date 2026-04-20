"use client";

import { useState, useRef } from "react";

export default function FormularioComprador() {
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
    
    // Obtener checkboxes de tipo de propiedad
    const tiposPropiedad = Array.from(
      form.querySelectorAll('input[name="tipoPropiedad"]:checked')
    ).map((el: any) => el.value);

    const data = {
      nombre: formData.get("nombre"),
      email: formData.get("email"),
      telefono: formData.get("telefono"),
      presupuesto: formData.get("presupuesto"),
      metodoCompra: formData.get("metodoCompra"),
      preAprobado: formData.get("preAprobado"),
      municipios: formData.get("municipios"),
      tipoPropiedad: tiposPropiedad,
      habitaciones: formData.get("habitaciones"),
      banos: formData.get("banos"),
      comentarios: formData.get("comentarios"),
    };

    try {
      const response = await fetch("/api/formulario/comprador", {
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
          Solicitud de Compra de Propiedad
        </h1>
        <p className="text-gray-600 mb-2">
          Bienvenido 👋
        </p>
        <p className="text-gray-600 mb-2">
          Completa este formulario para ayudarte a encontrar la propiedad ideal según tus necesidades.
        </p>
        <p className="text-gray-600">
          Toma menos de 2 minutos ✨
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-8">
        {/* Nombre Completo */}
        <div>
          <label htmlFor="nombre" className="block text-sm font-medium text-gray-700 mb-2">
            Nombre Completo <span className="text-red-500">*</span>
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
            Email
          </label>
          <input
            type="email"
            id="email"
            name="email"
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

        {/* Presupuesto aproximado */}
        <div>
          <label htmlFor="presupuesto" className="block text-sm font-medium text-gray-700 mb-2">
            Presupuesto aproximado 💰 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="presupuesto"
            name="presupuesto"
            required
            placeholder="$200,000 - $500,000"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Método de compra */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Método de compra <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {["Financiamiento", "Cash", "R3 o CDBG"].map((option) => (
              <label key={option} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="metodoCompra"
                  value={option}
                  required
                  className="w-4 h-4"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* ¿Estás pre-aprobado? */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            ¿Estás pre-aprobado por un banco?
          </label>
          <div className="space-y-2">
            {["Sí", "No", "En Proceso"].map((option) => (
              <label key={option} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="preAprobado"
                  value={option}
                  className="w-4 h-4"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Municipios de interés */}
        <div>
          <label htmlFor="municipios" className="block text-sm font-medium text-gray-700 mb-2">
            Municipios de interés <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="municipios"
            name="municipios"
            required
            placeholder="Ej: San Juan, Dorado, Guaynabo"
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Tipo de Propiedad */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Tipo de Propiedad <span className="text-red-500">*</span>
          </label>
          <div className="space-y-2">
            {["Casa", "Apartamento", "Terreno", "Propiedad Comercial"].map((option) => (
              <label key={option} className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="tipoPropiedad"
                  value={option}
                  className="w-4 h-4"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Habitaciones deseadas */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Habitaciones deseadas
          </label>
          <div className="space-y-2">
            {["1", "2", "3", "4+"].map((option) => (
              <label key={option} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="habitaciones"
                  value={option}
                  className="w-4 h-4"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Baños deseados */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Baños deseados
          </label>
          <div className="space-y-2">
            {["1", "2", "3+"].map((option) => (
              <label key={option} className="flex items-center cursor-pointer">
                <input
                  type="radio"
                  name="banos"
                  value={option}
                  className="w-4 h-4"
                />
                <span className="ml-2 text-gray-700">{option}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Comentarios adicionales */}
        <div>
          <label htmlFor="comentarios" className="block text-sm font-medium text-gray-700 mb-2">
            Comentarios adicionales
          </label>
          <textarea
            id="comentarios"
            name="comentarios"
            rows={4}
            placeholder="Cuéntanos más sobre lo que buscas..."
            className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
          />
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
