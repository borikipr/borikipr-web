import { Resend } from "resend";
import {
  buildHaciendaShowingEmail,
  HACIENDA_SHOWING_MAX_BODY_BYTES,
  HaciendaShowingValidationError,
  isHaciendaShowingClosed,
  validateHaciendaShowingPayload,
} from "@/lib/hacienda-monte-carmelo-showing";

type HandlerDependencies = {
  now?: () => Date;
  checkRequestRateLimit?: (request: Request) => Promise<boolean>;
  sendEmail?: (message: {
    from: string;
    to: string;
    replyTo: string;
    subject: string;
    html: string;
  }) => Promise<{ id: string }>;
  config?: {
    apiKey?: string;
    fromEmail?: string;
    toEmail?: string;
  };
};

const SAFE_ERROR =
  "No pudimos enviar tu información en este momento. Intenta nuevamente más tarde o comunícate directamente con Erickson Real Estate PR.";

export function createHaciendaShowingPostHandler(
  dependencies: HandlerDependencies = {}
) {
  return async function POST(request: Request) {
    const now = dependencies.now?.() ?? new Date();
    if (isHaciendaShowingClosed(now)) {
      return jsonError(
        "El período de registro para el Showing de Hacienda Monte Carmelo ha concluido.",
        410
      );
    }

    const contentLength = Number(request.headers.get("content-length") || "0");
    if (Number.isFinite(contentLength) && contentLength > HACIENDA_SHOWING_MAX_BODY_BYTES) {
      return jsonError("El formulario excede el tamaño permitido.", 413);
    }

    const config = dependencies.config ?? {
      apiKey: process.env.RESEND_API_KEY?.trim(),
      fromEmail: process.env.CONTACT_FROM_EMAIL?.trim(),
      toEmail: process.env.CONTACT_TO_EMAIL?.trim(),
    };
    if (!validConfig(config)) {
      logIssue("missing_or_invalid_email_configuration");
      return jsonError(SAFE_ERROR, 503);
    }

    try {
      let allowed: boolean;
      if (dependencies.checkRequestRateLimit) {
        allowed = await dependencies.checkRequestRateLimit(request);
      } else {
        const { checkRateLimit, getClientIp } = await import("@/lib/rate-limit");
        allowed = (
          await checkRateLimit({
            key: `hacienda-showing:${getClientIp(request)}`,
            limit: 4,
            windowMs: 10 * 60 * 1000,
          })
        ).allowed;
      }
      if (!allowed) return rateLimitedResponse();
    } catch {
      logIssue("rate_limit_unavailable");
      return jsonError(SAFE_ERROR, 503);
    }

    try {
      const rawBody = await request.text();
      if (new TextEncoder().encode(rawBody).byteLength > HACIENDA_SHOWING_MAX_BODY_BYTES) {
        return jsonError("El formulario excede el tamaño permitido.", 413);
      }
      const submission = validateHaciendaShowingPayload(JSON.parse(rawBody));

      // Check again after validation so a request received at/after the cutoff is rejected.
      const acceptedAt = dependencies.now?.() ?? new Date();
      if (isHaciendaShowingClosed(acceptedAt)) {
        return jsonError(
          "El período de registro para el Showing de Hacienda Monte Carmelo ha concluido.",
          410
        );
      }

      const email = buildHaciendaShowingEmail(submission, acceptedAt);
      const message = {
        from: `Erickson Real Estate <${config.fromEmail}>`,
        to: config.toEmail,
        replyTo: submission.email,
        subject: email.subject,
        html: email.html,
      };
      const accepted = dependencies.sendEmail
        ? await dependencies.sendEmail(message)
        : await sendWithResend(config.apiKey, message);

      if (!accepted.id) {
        logIssue("resend_missing_acceptance_id");
        return jsonError(SAFE_ERROR, 502);
      }

      return Response.json(
        { ok: true },
        { headers: { "Cache-Control": "no-store" } }
      );
    } catch (error) {
      if (error instanceof HaciendaShowingValidationError) {
        logIssue("validation", error.reason);
        return jsonError(error.publicMessage, error.status);
      }
      if (error instanceof SyntaxError) {
        logIssue("invalid_json");
        return jsonError("No pudimos validar el formulario.", 400);
      }
      logIssue("email_delivery_failed");
      return jsonError(SAFE_ERROR, 502);
    }
  };
}

async function sendWithResend(
  apiKey: string,
  message: {
    from: string;
    to: string;
    replyTo: string;
    subject: string;
    html: string;
  }
) {
  const result = await new Resend(apiKey).emails.send({
    ...message,
    to: [message.to],
  });
  if (result.error || !result.data?.id) {
    throw new Error("resend_rejected");
  }
  return { id: result.data.id };
}

function validConfig(config: HandlerDependencies["config"]): config is {
  apiKey: string;
  fromEmail: string;
  toEmail: string;
} {
  return Boolean(
    config?.apiKey &&
      isEmail(config.fromEmail) &&
      isEmail(config.toEmail)
  );
}

function isEmail(value: string | undefined) {
  return Boolean(value && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

function jsonError(error: string, status: number) {
  return Response.json(
    { ok: false, error },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

function rateLimitedResponse() {
  return Response.json(
    {
      ok: false,
      error: "Hemos recibido varias solicitudes. Intenta nuevamente en unos minutos.",
    },
    {
      status: 429,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "60",
      },
    }
  );
}

function logIssue(stage: string, reason?: string) {
  // Deliberately excludes request bodies and all submitted personal information.
  console.error("HACIENDA SHOWING REGISTRATION", { stage, reason });
}
