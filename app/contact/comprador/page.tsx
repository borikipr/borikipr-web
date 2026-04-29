import Header from "@/components/Header";
import FormularioComprador from "@/components/FormularioComprador";

export const metadata = {
  title: "Formulario para Compradores | Erickson Real Estate",
  description: "Solicita orientación para comprar tu propiedad ideal en Puerto Rico",
};

export default function CompradorPage() {
  return (
    <>
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Compradores</p>
            <h1 className="heading-display mt-4">
              Cuéntanos qué buscas
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              Completa este formulario con la información sobre la propiedad que buscas. Nos pondremos en contacto para ayudarte a encontrar la opción correcta.
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="max-w-2xl">
            <div className="surface-card p-8 md:p-12">
              <FormularioComprador />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
