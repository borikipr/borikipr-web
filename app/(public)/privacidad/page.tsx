import type { Metadata } from "next";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "Privacidad",
  description:
    "Información sobre el uso y la protección de datos en BorikíPR y Erickson Real Estate.",
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="section-shell py-14 sm:py-20">
        <article className="mx-auto max-w-3xl text-[#263746]">
          <p className="eyebrow !text-[#765f12]">Privacidad</p>
          <h1 className="mt-3 text-4xl font-bold text-[#0d1b2a]">
            Cómo utilizamos tu información
          </h1>
          <p className="mt-5 leading-7">
            BorikíPR y Erickson Real Estate recopilan la información que
            compartes voluntariamente para atender consultas de bienes raíces,
            evaluar tu interés en propiedades y dar seguimiento al proceso de
            compra, venta, alquiler, Open House o visita privada.
          </p>

          <div className="mt-10 space-y-8">
            <section>
              <h2 className="text-2xl font-semibold text-[#11518b]">
                Información y documentos
              </h2>
              <p className="mt-3 leading-7">
                Los formularios pueden solicitar datos de contacto, preferencias
                inmobiliarias, respuestas de cualificación y, cuando corresponda,
                cartas de precalificación o evidencia de fondos. Los documentos
                financieros se almacenan de forma privada y solo se acceden
                mediante controles administrativos autorizados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#11518b]">
                Comunicaciones y seguimiento
              </h2>
              <p className="mt-3 leading-7">
                Utilizamos la información para responder, coordinar seguimiento,
                confirmar registros y enviar avisos relacionados con la propiedad
                o solicitud que originó el contacto. No publicamos tus documentos
                ni sus enlaces privados.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#11518b]">
                Analítica y datos del navegador
              </h2>
              <p className="mt-3 leading-7">
                Las páginas públicas pueden usar Google Analytics, Microsoft
                Clarity y Vercel Analytics para comprender uso, rendimiento y
                errores. Los formularios sensibles se marcan para ocultar su
                contenido en grabaciones. El área administrativa y las rutas con
                enlaces privados se excluyen de la analítica del cliente.
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-[#11518b]">
                Retención y tus solicitudes
              </h2>
              <p className="mt-3 leading-7">
                Conservamos la información durante el tiempo razonablemente
                necesario para prestar el servicio, mantener la continuidad del
                proceso y cumplir obligaciones aplicables. Puedes solicitar
                acceso, corrección o eliminación escribiendo a
                {" "}
                <a
                  className="font-semibold text-[#11518b] underline"
                  href="mailto:ericksonrealestatepr@gmail.com"
                >
                  ericksonrealestatepr@gmail.com
                </a>
                . Algunas solicitudes pueden requerir verificar tu identidad.
              </p>
            </section>
          </div>

          <p className="mt-10 rounded-2xl bg-[#eef5fb] p-5 text-sm leading-6">
            Esta página describe el funcionamiento actual del sistema con fines
            informativos y debe revisarse periódicamente con asesoría comercial o
            legal aplicable.
          </p>
        </article>
      </main>
    </>
  );
}
