import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { PGlite } from "@electric-sql/pglite";

const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("Team Server Action module exports only async functions", async () => {
  const [actions, actionState, review] = await Promise.all([
    read("app/admin/equipo/actions.ts"),
    read("app/admin/equipo/action-state.ts"),
    read("app/admin/equipo/PublicProfileReview.tsx"),
  ]);

  assert.match(actions, /^"use server";/);
  assert.doesNotMatch(actions, /^export\s+(?:const|let|var|class)\s+/m);
  assert.doesNotMatch(actions, /export\s*\{[^}]*initialTeamActionState/s);
  assert.match(actionState, /export const initialTeamActionState/);
  assert.match(review, /from "\.\/action-state"/);
  assert.doesNotMatch(review, /import\s*\{[^}]*initialTeamActionState[^}]*\}\s*from "\.\/actions"/s);
  assert.match(
    actions,
    /await approvePublicProfessionalProfile\(await actorId\(\), targetId\); invalidatePublicProperties\(\); invalidateTeamPaths\(targetId\)/,
  );
  assert.match(actions, /function invalidatePublicProperties\(\)\s*\{\s*updateTag\(PUBLIC_PROPERTIES_CACHE_TAG\)/);
});

test("approval dialogs close only after authoritative successful action state", async () => {
  const review = await read("app/admin/equipo/PublicProfileReview.tsx");

  assert.match(review, /useActionState\(approvePublicProfessionalProfileAction, initialTeamActionState\)/);
  assert.match(review, /useActionState\(withdrawPublicProfessionalProfileApprovalAction, initialTeamActionState\)/);
  assert.match(review, /canApprove \? setApproveOpen\(true\) : setWithdrawOpen\(true\)/);
  assert.match(review, /useEffect\(\(\) => \{\s*if \(approveState\.success\) setApproveOpen\(false\);\s*\}, \[approveState\.success\]\)/);
  assert.match(review, /useEffect\(\(\) => \{\s*if \(withdrawState\.success\) setWithdrawOpen\(false\);\s*\}, \[withdrawState\.success\]\)/);
  assert.doesNotMatch(review, /if \(approving\) setApproveOpen\(false\)/);
  assert.doesNotMatch(review, /if \(withdrawing\) setWithdrawOpen\(false\)/);
  assert.doesNotMatch(review, /if \(approveState\.error\) setApproveOpen\(false\)/);
  assert.doesNotMatch(review, /if \(withdrawState\.error\) setWithdrawOpen\(false\)/);
  assert.match(review, /approveState\.error \? <p role="alert"/);
  assert.match(review, /withdrawState\.error \? <p role="alert"/);
  assert.match(review, /type="submit" disabled=\{approving\}/);
  assert.match(review, /type="submit" disabled=\{withdrawing\}/);
});

test("active opted-in pending profile approves atomically with immutable audit metadata", async () => {
  const db = new PGlite();
  await db.exec(`
    CREATE TABLE admin_users (
      id uuid PRIMARY KEY,
      display_name text NOT NULL,
      email text NOT NULL,
      system_role text NOT NULL,
      account_state text NOT NULL,
      activo boolean NOT NULL,
      public_profile_enabled boolean NOT NULL,
      public_profile_approval_state text NOT NULL,
      public_profile_approved_at timestamptz NULL,
      public_profile_approved_by_admin_id uuid NULL REFERENCES admin_users(id),
      CONSTRAINT public_profile_state_check CHECK (
        (public_profile_approval_state = 'pending_review'
          AND public_profile_enabled = true
          AND public_profile_approved_at IS NULL
          AND public_profile_approved_by_admin_id IS NULL)
        OR (public_profile_approval_state = 'approved'
          AND public_profile_enabled = true
          AND public_profile_approved_at IS NOT NULL
          AND public_profile_approved_by_admin_id IS NOT NULL)
      )
    );
    CREATE TABLE admin_access_events (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      event_type text NOT NULL CHECK (event_type = 'public_profile_approved'),
      actor_admin_user_id uuid NOT NULL REFERENCES admin_users(id),
      target_admin_user_id uuid NOT NULL REFERENCES admin_users(id),
      metadata jsonb NOT NULL,
      occurred_at timestamptz NOT NULL DEFAULT now()
    );
    INSERT INTO admin_users VALUES
      ('3cefce78-7d62-485d-9faa-6fed1b6ae377', 'Cedric', 'cedric@example.test',
        'super_admin', 'active', true, true, 'approved', now(),
        '837a7fca-c067-4878-a4eb-01c12a4cf7ba'),
      ('837a7fca-c067-4878-a4eb-01c12a4cf7ba', 'Ivonne', 'ivonne@example.test',
        'admin', 'active', true, true, 'pending_review', NULL, NULL);
  `);

  await db.transaction(async (transaction) => {
    const actor = await transaction.query(`
      SELECT id FROM admin_users
       WHERE id = '3cefce78-7d62-485d-9faa-6fed1b6ae377'
         AND system_role = 'super_admin' AND account_state = 'active' AND activo = true
    `);
    assert.equal(actor.rows.length, 1);

    const target = await transaction.query(`
      SELECT public_profile_enabled, public_profile_approval_state
        FROM admin_users
       WHERE id = '837a7fca-c067-4878-a4eb-01c12a4cf7ba'
    `);
    assert.deepEqual(target.rows[0], {
      public_profile_enabled: true,
      public_profile_approval_state: "pending_review",
    });

    await transaction.query(`
      UPDATE admin_users
         SET public_profile_approval_state = 'approved',
             public_profile_approved_at = now(),
             public_profile_approved_by_admin_id = '3cefce78-7d62-485d-9faa-6fed1b6ae377'
       WHERE id = '837a7fca-c067-4878-a4eb-01c12a4cf7ba'
    `);
    await transaction.query(`
      INSERT INTO admin_access_events (
        event_type, actor_admin_user_id, target_admin_user_id, metadata
      ) VALUES (
        'public_profile_approved',
        '3cefce78-7d62-485d-9faa-6fed1b6ae377',
        '837a7fca-c067-4878-a4eb-01c12a4cf7ba',
        '{"source":"team_access","previousState":"pending_review","nextState":"approved"}'::jsonb
      )
    `);
  });

  const result = await db.query(`
    SELECT display_name, email, public_profile_enabled, public_profile_approval_state,
           public_profile_approved_at IS NOT NULL AS has_approved_at,
           public_profile_approved_by_admin_id::text AS approver_id,
           (SELECT count(*)::int FROM admin_access_events
             WHERE event_type = 'public_profile_approved') AS approval_event_count
      FROM admin_users
     WHERE id = '837a7fca-c067-4878-a4eb-01c12a4cf7ba'
  `);
  assert.deepEqual(result.rows[0], {
    display_name: "Ivonne",
    email: "ivonne@example.test",
    public_profile_enabled: true,
    public_profile_approval_state: "approved",
    has_approved_at: true,
    approver_id: "3cefce78-7d62-485d-9faa-6fed1b6ae377",
    approval_event_count: 1,
  });
  await db.close();
});
