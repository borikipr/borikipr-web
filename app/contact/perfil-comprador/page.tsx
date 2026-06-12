import Header from "@/components/Header";
import FormularioPerfilComprador from "@/components/FormularioPerfilComprador";

export const metadata = {
  title: "Perfil del Cliente Comprador | Erickson Real Estate",
  description: "Formulario para clientes compradores interesados en continuar el proceso de orientación con Ivonne Erickson.",
  alternates: {
    canonical: "/contact/perfil-comprador",
  },
};

export default function PerfilCompradorPage() {
  return (
    <>
      <Header />
      <main className="bg-white pt-[96px] lg:pt-[128px]">
        <section className="section-shell py-20">
          <div className="max-w-3xl">
            <p className="eyebrow">Perfil del cliente comprador</p>
            <h1 className="heading-display mt-4">
              Completa tu perfil para continuar el proceso de compra
            </h1>
            <p className="body-lg mt-8 max-w-2xl">
              Para poder brindarte más detalles y coordinar una posible visita, te invitamos a completar este breve formulario. La información que compartas nos ayudará a conocerte mejor como comprador y ofrecerte una orientación más personalizada durante el proceso.
            </p>
          </div>
        </section>

        <section className="section-shell pb-24">
          <div className="max-w-3xl">
            <div className="surface-card p-6 md:p-10">
              <FormularioPerfilComprador />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
