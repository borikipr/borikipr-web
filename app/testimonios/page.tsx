import TestimoniosClientPage from "./TestimoniosClientPage";
import { getTestimoniosPublicosPaginados } from "@/lib/queries/testimonios";

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
