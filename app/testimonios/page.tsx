import TestimoniosClientPage from "./TestimoniosClientPage";
import { getTestimoniosPublicos } from "@/lib/queries/testimonios";

export default async function TestimoniosPage() {
  const testimonios = await getTestimoniosPublicos();

  return <TestimoniosClientPage testimonios={testimonios} />;
}