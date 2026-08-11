import { notFound } from "next/navigation";
import { isSignerRuntimeEnabled } from "@/lib/signatures/public-config";

export default function SigningCompletedPage() {
  if (!isSignerRuntimeEnabled()) notFound();
  return <section className="mx-auto max-w-xl px-5 py-20"><h1 className="text-2xl font-semibold">Participación completada</h1><p className="mt-3">La sesión privada fue cerrada.</p></section>;
}
