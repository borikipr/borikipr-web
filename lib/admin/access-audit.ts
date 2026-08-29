import "server-only";

import type { AdminAccessEventType } from "@/lib/admin/access-types";

export type AccessAuditExecutor = {
  unsafe(
    query: string,
    parameters?: readonly unknown[],
  ): Promise<unknown>;
};

const SENSITIVE_KEY = /(?:password|token|cookie|secret|reseturl|reset_url)/i;

export function sanitizeAccessAuditMetadata(metadata: Record<string, unknown>) {
  for (const key of Object.keys(metadata)) {
    if (SENSITIVE_KEY.test(key)) {
      throw new Error("admin_access_audit_sensitive_metadata");
    }
  }
  return metadata;
}

export async function writeAdminAccessEvent(
  database: AccessAuditExecutor,
  input: {
    eventType: AdminAccessEventType;
    actorAdminUserId: string | null;
    targetAdminUserId: string;
    metadata?: Record<string, unknown>;
    requestId?: string | null;
  },
) {
  const metadata = sanitizeAccessAuditMetadata(input.metadata ?? {});
  await database.unsafe(
    `INSERT INTO public.admin_access_events (
       event_type, actor_admin_user_id, target_admin_user_id, metadata, request_id
     ) VALUES ($1, $2::uuid, $3::uuid, $4::jsonb, NULLIF($5, ''))`,
    [
      input.eventType,
      input.actorAdminUserId,
      input.targetAdminUserId,
      metadata,
      input.requestId ?? "",
    ],
  );
}
