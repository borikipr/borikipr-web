BEGIN;

-- Phase 2M adds immutable approval-mode and draft-lifecycle evidence. Removing
-- those columns would also require rewriting trigger functions and could erase
-- the meaning of already-recorded business decisions. The safe rollback is an
-- application rollback that leaves this additive schema in place.
DO $$ BEGIN
  RAISE EXCEPTION '0032 schema rollback is intentionally blocked; deploy the prior application while preserving additive governance evidence';
END $$;

ROLLBACK;
