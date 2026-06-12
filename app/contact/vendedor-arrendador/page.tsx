import Header from "@/components/Header";
import FormularioVendedor from "@/components/FormularioVendedor";

export const metadata = {
  title: "Formulario para Vendedores y Arrendadores | Erickson Real Estate",
  description: "Solicita orientación para vender o alquilar tu propiedad en Puerto Rico",
  alternates: {
    canonical: "/contact/vendedor-arrendador",
  },
};

export default function VendedorArrendadorPage() {
  return (
    <>
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">VENDEDORES Y ARRENDADORES</p>
            <h1 className="heading-display mt-4">
              Vende o alquila tu propiedad
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              Completa este formulario y recibirás orientación sobre los próximos pasos para vender o alquilar tu propiedad con estrategia.
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
