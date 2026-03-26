"use client";

import Header from "@/components/Header";
import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";

type StatusType = "idle" | "success" | "error";

export default function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState(""); // honeypot anti-spam
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<StatusType>("idle");

  const emailIsValid = useMemo(() => {
    if (!email) return true;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }, [email]);

  const telefonoNormalizado = telefono.replace(/[^\d+()\-\s]/g, "").trim();

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (loading) return;

    setStatus("");
    setStatusType("idle");

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanMessage = message.trim();

    if (website) {
      setStatus("No se pudo enviar el mensaje.");
      setStatusType("error");
      return;
    }

    if (!cleanName || !cleanEmail || !cleanMessage) {
      setStatus("Por favor completa nombre, email y mensaje.");
      setStatusType("error");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setStatus("Por favor escribe un email válido.");
      setStatusType("error");
      return;
    }

    if (cleanMessage.length < 10) {
      setStatus("El mensaje debe tener al menos 10 caracteres.");
      setStatusType("error");
      return;
    }

    try {
      setLoading(true);

      const fullMessage = telefonoNormalizado
        ? `Teléfono: ${telefonoNormalizado}\n\n${cleanMessage}`
        : cleanMessage;

      const res = await fetch("/api/contact", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: cleanName,
          email: cleanEmail,
          message: fullMessage,
          lang: "es",
        }),
      });

      let data: { ok?: boolean; error?: string } | null = null;

      try {
        data = await res.json();
      } catch {
        data = null;
      }

      if (!res.ok || !data?.ok) {
        setStatus(
          data?.error || "No se pudo enviar el mensaje. Intenta de nuevo."
        );
        setStatusType("error");
        return;
      }

      setStatus("Mensaje enviado correctamente.");
      setStatusType("success");
      setName("");
      setEmail("");
      setTelefono("");
      setMessage("");
      setWebsite("");
    } catch {
      setStatus("Ocurrió un error al enviar el mensaje.");
      setStatusType("error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Header />

      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-4xl">
            <p className="eyebrow">Contacto</p>

            <h1 className="heading-display mt-4">
              Una conversación clara puede abrir la puerta correcta.
            </h1>

            <p className="body-lg mt-8 max-w-3xl">
              Ya sea para comprar, vender o explorar tus opciones en Puerto
              Rico, este es un buen lugar para comenzar con claridad,
              estrategia y atención personalizada.
            </p>
          </div>
        </section>

        <section className="pb-24">
          <div className="section-shell grid gap-10 xl:grid-cols-[0.95fr_1.05fr]">
            <div className="space-y-8">
              <div className="surface-muted card-hover p-8">
                <p className="eyebrow">Conecta</p>

                <h2 className="mt-4 text-3xl font-bold leading-tight text-[#000000]">
                  Atención profesional y orientación personalizada.
                </h2>

                <p className="body-base mt-5">
                  Cada cliente, propiedad y objetivo requiere una conversación
                  distinta. Escríbenos y da el primer paso con una experiencia
                  clara y mejor guiada.
                </p>

                <div className="mt-8 space-y-5 text-sm text-[#4d4d4d]">
                  <div className="border-b border-[#ececec] pb-4">
                    <p className="font-semibold text-[#000000]">Email</p>
                    <p className="mt-1">ivonneerickson@borikipr.com</p>
                  </div>

                  <div className="border-b border-[#ececec] pb-4">
                    <p className="font-semibold text-[#000000]">WhatsApp</p>
                    <p className="mt-1">(787) 677-4900</p>
                  </div>

                  <div className="border-b border-[#ececec] pb-4">
                    <p className="font-semibold text-[#000000]">Ubicación</p>
                    <p className="mt-1">Puerto Rico</p>
                  </div>

                  <div>
                    <p className="font-semibold text-[#000000]">Licencia</p>
                    <p className="mt-1">C-25961</p>
                  </div>
                </div>

                <div className="mt-8 flex flex-wrap gap-4">
                  <Link
                    href="https://wa.me/17876774900"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-primary"
                  >
                    Escribir por WhatsApp
                  </Link>

                  <Link
                    href="https://www.instagram.com/ivonnerealestatepr/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary"
                  >
                    Ver Instagram
                  </Link>
                </div>
              </div>

              <div className="surface-card card-hover p-8">
                <p className="eyebrow">Qué puedes consultar</p>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="rounded-2xl bg-[#f8f8f8] p-5">
                    <p className="font-semibold text-[#000000]">
                      Compra de propiedad
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
                      Búsqueda, orientación y próximos pasos.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#f8f8f8] p-5">
                    <p className="font-semibold text-[#000000]">
                      Venta de propiedad
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
                      Estrategia, preparación y posicionamiento.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#f8f8f8] p-5">
                    <p className="font-semibold text-[#000000]">Inversión</p>
                    <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
                      Opciones con criterio y enfoque real.
                    </p>
                  </div>

                  <div className="rounded-2xl bg-[#f8f8f8] p-5">
                    <p className="font-semibold text-[#000000]">
                      Orientación general
                    </p>
                    <p className="mt-2 text-sm leading-relaxed text-[#4d4d4d]">
                      Dudas sobre proceso, mercado o estrategia.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="xl:sticky xl:top-[108px]">
              <div className="surface-card p-8 md:p-10">
                <p className="eyebrow">Formulario</p>

                <h2 className="mt-4 text-3xl font-bold leading-tight text-[#000000]">
                  Cuéntanos en qué podemos ayudarte.
                </h2>

                <p className="body-base mt-4">
                  Comparte tu consulta y nos pondremos en contacto contigo con
                  una orientación clara y profesional.
                </p>

                <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
                  <input
                    type="text"
                    name="website"
                    value={website}
                    onChange={(e) => setWebsite(e.target.value)}
                    className="hidden"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                  />

                  <div className="space-y-2">
                    <label
                      htmlFor="nombre"
                      className="text-sm font-medium text-[#000000]"
                    >
                      Nombre
                    </label>
                    <input
                      id="nombre"
                      type="text"
                      placeholder="Tu nombre completo"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="input-premium"
                      autoComplete="name"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="email"
                      className="text-sm font-medium text-[#000000]"
                    >
                      Email
                    </label>
                    <input
                      id="email"
                      type="email"
                      placeholder="tunombre@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className={`input-premium ${
                        !emailIsValid ? "border-red-500" : ""
                      }`}
                      autoComplete="email"
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="telefono"
                      className="text-sm font-medium text-[#000000]"
                    >
                      Teléfono
                    </label>
                    <input
                      id="telefono"
                      type="tel"
                      placeholder="(787) 000-0000"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      className="input-premium"
                      autoComplete="tel"
                    />
                  </div>

                  <div className="space-y-2">
                    <label
                      htmlFor="mensaje"
                      className="text-sm font-medium text-[#000000]"
                    >
                      Mensaje
                    </label>
                    <textarea
                      id="mensaje"
                      rows={6}
                      placeholder="Cuéntanos qué estás buscando o en qué necesitas orientación..."
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      className="input-premium"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="btn-primary w-full disabled:opacity-60"
                  >
                    {loading ? "Enviando..." : "Enviar mensaje"}
                  </button>

                  {status && (
                    <p
                      className={`text-sm ${
                        statusType === "success"
                          ? "text-green-700"
                          : "text-red-600"
                      }`}
                      aria-live="polite"
                    >
                      {status}
                    </p>
                  )}
                </form>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  );
}