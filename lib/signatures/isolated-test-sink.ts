import "server-only";
import type { SignatureMailTransport } from "./delivery";

type SyntheticDelivery = Readonly<{
  signingUrl: string;
  kind: "invitation" | "completed_document";
}>;

const globalSink = globalThis as typeof globalThis & {
  __borikiSyntheticSignatureDeliveries?: SyntheticDelivery[];
};

function assertIsolated() {
  if (
    process.env.NODE_ENV === "production" ||
    process.env.SIGNING_ISOLATED_ENVIRONMENT !== "true" ||
    process.env.SIGNING_ISOLATED_EMAIL_SINK !== "memory"
  ) {
    throw new Error("signature_isolated_sink_forbidden");
  }
}

function deliveries() {
  assertIsolated();
  return (globalSink.__borikiSyntheticSignatureDeliveries ??= []);
}

export function createIsolatedSignatureMailTransport(): SignatureMailTransport {
  return {
    async send(input) {
      assertIsolated();
      const match = input.html.match(
        /https?:\/\/[^\s"'<]+\/firmar\/(?:completado\/)?[A-Za-z0-9_-]{43}/
      );
      if (!match) throw new Error("signature_isolated_sink_url_missing");
      const signingUrl = match[0];
      deliveries().push({
        signingUrl,
        kind: signingUrl.includes("/firmar/completado/")
          ? "completed_document"
          : "invitation",
      });
      return { reference: `isolated-memory-${deliveries().length}` };
    },
  };
}

export function consumeIsolatedSignatureDelivery() {
  return deliveries().shift() ?? null;
}
