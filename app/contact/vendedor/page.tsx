import Header from "@/components/Header";
import FormularioVendedor from "@/components/FormularioVendedor";

export const metadata = {
  title: "Formulario para Vendedores | Erickson Real Estate",
  description: "Solicita orientación para vender tu propiedad en Puerto Rico",
};

export default function VendedorPage() {
  return (
    <>
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Vendedores</p>
            <h1 className="heading-display mt-4">
              Vende tu propiedad
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              Comparte la información de tu propiedad y te orientamos sobre presentación, estrategia y posicionamiento para salir al mercado con mejor dirección.
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="max-w-2xl">
            <div className="surface-card p-8 md:p-12">
              <FormularioVendedor />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
