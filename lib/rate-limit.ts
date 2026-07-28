import { createHmac } from "node:crypto";
import { isIP } from "node:net";

import { sql } from "@/lib/db";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
};

type RateLimitDatabase = {
  unsafe<T extends readonly Record<string, unknown>[]>(
    query: string,
    parameters?: readonly unknown[]
  ): Promise<T>;
};

type RateLimitClock = {
  now(): number;
};

const systemClock: RateLimitClock = { now: () => Date.now() };

export function normalizeIpAddress(value: string | null | undefined) {
  let candidate = String(value || "").trim();
  if (!candidate) return "unknown";
  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (/^\d{1,3}(?:[.]\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.slice(0, candidate.lastIndexOf(":"));
  }
  candidate = candidate.split("%", 1)[0].toLowerCase();

  const mappedIpv4 = candidate.match(/^::ffff:(\d{1,3}(?:[.]\d{1,3}){3})$/);
  if (mappedIpv4 && isIP(mappedIpv4[1]) === 4) return mappedIpv4[1];
  if (isIP(candidate) === 4) return candidate;
  if (isIP(candidate) === 6) {
    try {
      return new URL(`http://[${candidate}]/`).hostname.slice(1, -1);
    } catch {
      return "unknown";
    }
  }
  return "unknown";
}

function firstForwardedAddress(value: string | null) {
  return value?.split(",", 1)[0]?.trim() || null;
}

export function getClientIp(request: Request) {
  if (process.env.VERCEL === "1") {
    return normalizeIpAddress(
      firstForwardedAddress(request.headers.get("x-vercel-forwarded-for")) ||
        firstForwardedAddress(request.headers.get("x-forwarded-for")) ||
        request.headers.get("x-real-ip")
    );
  }

  if (request.headers.has("cf-ray")) {
    return normalizeIpAddress(request.headers.get("cf-connecting-ip"));
  }

  if (process.env.NODE_ENV !== "production") {
    return normalizeIpAddress(
      request.headers.get("x-real-ip") ||
        firstForwardedAddress(request.headers.get("x-forwarded-for"))
    );
  }
  return "unknown";
}

function parseRateLimitKey(key: string) {
  const separator = key.indexOf(":");
  const action = (separator > 0 ? key.slice(0, separator) : key)
    .trim()
    .toLowerCase();
  const identifier = separator > 0 ? key.slice(separator + 1) : "unknown";
  if (!/^[a-z0-9][a-z0-9:_-]{0,79}$/.test(action)) {
    throw new Error("Public rate-limit action is invalid.");
  }
  return { action, identifier };
}

function identifierHash(identifier: string) {
  const secret = process.env.PUBLIC_RATE_LIMIT_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("PUBLIC_RATE_LIMIT_SECRET is not configured securely.");
  }
  return createHmac("sha256", secret).update(identifier).digest("hex");
}

export async function checkRateLimit(
  { key, limit, windowMs }: RateLimitOptions,
  database: RateLimitDatabase = sql as unknown as RateLimitDatabase,
  clock: RateLimitClock = systemClock
) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 100000) {
    throw new Error("Public rate-limit threshold is invalid.");
  }
  if (
    !Number.isInteger(windowMs) ||
    windowMs < 1000 ||
    windowMs > 24 * 60 * 60 * 1000
  ) {
    throw new Error("Public rate-limit window is invalid.");
  }

  const { action, identifier } = parseRateLimitKey(key);
  const hash = identifierHash(identifier);
  const now = clock.now();
  const bucketStartMs = Math.floor(now / windowMs) * windowMs;
  const bucketStart = new Date(bucketStartMs);
  const expiresAt = new Date(bucketStartMs + windowMs);
  const windowSeconds = Math.ceil(windowMs / 1000);

  const rows = await database.unsafe<{ request_count: number }[]>(
    `INSERT INTO public.public_rate_limit_buckets (
       action_type, identifier_hash, bucket_start, window_seconds,
       request_count, expires_at
     ) VALUES ($1, $2, $3, $4, 1, $5)
     ON CONFLICT (
       action_type, identifier_hash, bucket_start, window_seconds
     ) DO UPDATE
       SET request_count =
             public.public_rate_limit_buckets.request_count + 1,
           updated_at = now()
       WHERE public.public_rate_limit_buckets.request_count < $6
         AND public.public_rate_limit_buckets.expires_at > $7
     RETURNING request_count`,
    [action, hash, bucketStart, windowSeconds, expiresAt, limit, new Date(now)]
  );
  const count = Number(rows[0]?.request_count ?? limit);
  return {
    allowed: rows.length > 0,
    remaining: rows.length > 0 ? Math.max(0, limit - count) : 0,
    resetAt: expiresAt.getTime(),
  };
}

export function rateLimitResponse() {
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

export function nextRateLimitResponse() {
  return rateLimitResponse();
}
