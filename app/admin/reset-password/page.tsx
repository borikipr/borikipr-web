import Link from "next/link";
import ResetPasswordForm from "./ResetPasswordForm";

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token = "" } = await searchParams;
  return (
    <main className="min-h-screen bg-[#f8f8f8] px-6 py-10">
      <div className="mx-auto flex min-h-[80vh] max-w-md items-center">
        <div className="surface-card w-full p-8 md:p-10">
          <p className="eyebrow !text-[#765f12]">Acceso privado</p>
          <h1 className="mt-4 text-3xl font-bold text-[#000000]">Configurar contraseña</h1>
          {token ? (
            <ResetPasswordForm token={token} />
          ) : (
            <div className="mt-8">
              <p role="alert" className="text-sm text-red-600">El enlace no es válido o ya venció.</p>
              <Link href="/admin/forgot-password" className="mt-5 inline-flex text-sm font-semibold text-[#11518b]">Solicitar otro enlace</Link>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
