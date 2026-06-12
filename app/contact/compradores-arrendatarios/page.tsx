import Header from "@/components/Header";
import FormularioComprador from "@/components/FormularioComprador";

export const metadata = {
  title: "Formulario para Compradores y Arrendatarios | Erickson Real Estate",
  description: "Solicita orientación para comprar o alquilar tu propiedad ideal en Puerto Rico",
  alternates: {
    canonical: "/contact/compradores-arrendatarios",
  },
};

export default function CompradoresArrendatariosPage() {
  return (
    <>
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">COMPRADORES Y ARRENDATARIOS</p>
            <h1 className="heading-display mt-4">
              Únete al registro de compradores y arrendatarios activos
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              Al registrarte, pasarás a formar parte de mi registro de compradores y arrendatarios activos, lo que me permitirá identificar mejor tus necesidades y compartir contigo propiedades y oportunidades acordes con tu perfil. Además, podrás conocer opciones que podrían ser de tu interés antes de que sean ampliamente promovidas en el mercado.
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
