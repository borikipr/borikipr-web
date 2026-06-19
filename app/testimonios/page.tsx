import type { Metadata } from "next";
import TestimoniosClientPage from "./TestimoniosClientPage";
import { getTestimoniosPublicosPaginados } from "@/lib/queries/testimonios";

export const metadata: Metadata = {
  title: "Testimonios | Erickson Real Estate",
  description:
    "Lee experiencias de clientes que han recibido orientación inmobiliaria clara, estrategia y acompañamiento profesional con Ivonne Erickson.",
  alternates: {
    canonical: "/testimonios",
  },
};

export default async function TestimoniosPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const params = await searchParams;
  const page = parseInt(params.page || "1", 10);

  const data = await getTestimoniosPublicosPaginados(page, 8);

  return <TestimoniosClientPage data={data} />;
}
