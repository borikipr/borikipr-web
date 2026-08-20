"use client";

import { type FormEvent, type ReactNode, useState } from "react";

export default function SignerActionForm({
  action,
  destination,
  className,
  errorMessage,
  children,
}: {
  action: string;
  destination: string;
  className?: string;
  errorMessage: string;
  children: ReactNode;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(event.currentTarget.action, {
        method: "POST",
        body: new FormData(event.currentTarget),
        credentials: "same-origin",
        headers: { Accept: "application/json" },
      });
      if (response.status !== 204) throw new Error("signer_mutation_rejected");
      window.location.assign(destination);
    } catch {
      setError(errorMessage);
      setSubmitting(false);
    }
  }

  return (
    <form action={action} method="post" className={className} onSubmit={submit} aria-busy={submitting}>
      <fieldset disabled={submitting} className="contents">
        {children}
      </fieldset>
      {error ? <p role="alert" className="mt-3 text-sm leading-6 text-red-700">{error}</p> : null}
    </form>
  );
}
