-- Consolidate multiple shared vault rows into a single canonical shared vault.
-- Also enforce invariants:
--   - exactly one shared vault row
--   - at most one personal vault per owner_user_id
--
-- This migration is designed for existing deployments where multiple shared vaults were created.
--
-- NOTE: This assumes a single-tenant/shared-vault model (one global shared vault).
-- If we later want per-org shared vaults, we should pivot this to (type, owner_org_id) uniqueness.

-- 1-3) Pick canonical shared vault (oldest), move folders/items, delete extras.
-- IMPORTANT: CTEs only exist for the single statement they are defined in, so this must be one statement.
WITH shared AS (
  SELECT id, created_at
  FROM vault_vaults
  WHERE type = 'shared'
  ORDER BY created_at ASC
),
canonical AS (
  SELECT id AS canonical_id FROM shared LIMIT 1
),
others AS (
  SELECT id AS other_id FROM shared OFFSET 1
),
move_folders AS (
  UPDATE vault_folders
  SET vault_id = (SELECT canonical_id FROM canonical)
  WHERE vault_id IN (SELECT other_id FROM others)
  RETURNING 1
),
move_items AS (
  UPDATE vault_items
  SET vault_id = (SELECT canonical_id FROM canonical)
  WHERE vault_id IN (SELECT other_id FROM others)
  RETURNING 1
),
delete_others AS (
  DELETE FROM vault_vaults
  WHERE id IN (SELECT other_id FROM others)
  RETURNING 1
)
SELECT 1;

-- Consolidate duplicate personal vaults per owner (keep oldest), so the uniqueness constraint can be added safely.
WITH personal AS (
  SELECT id, owner_user_id, created_at
  FROM vault_vaults
  WHERE type = 'personal' AND owner_user_id IS NOT NULL
),
canonical_personal AS (
  SELECT DISTINCT ON (owner_user_id)
    owner_user_id,
    id AS canonical_id
  FROM personal
  ORDER BY owner_user_id, created_at ASC
),
other_personal AS (
  SELECT
    p.owner_user_id,
    p.id AS other_id
  FROM personal p
  JOIN canonical_personal c ON c.owner_user_id = p.owner_user_id
  WHERE p.id <> c.canonical_id
),
move_personal_folders AS (
  UPDATE vault_folders f
  SET vault_id = c.canonical_id
  FROM other_personal o
  JOIN canonical_personal c ON c.owner_user_id = o.owner_user_id
  WHERE f.vault_id = o.other_id
  RETURNING 1
),
move_personal_items AS (
  UPDATE vault_items i
  SET vault_id = c.canonical_id
  FROM other_personal o
  JOIN canonical_personal c ON c.owner_user_id = o.owner_user_id
  WHERE i.vault_id = o.other_id
  RETURNING 1
),
delete_other_personal AS (
  DELETE FROM vault_vaults v
  USING other_personal o
  WHERE v.id = o.other_id
  RETURNING 1
)
SELECT 1;

-- 4) Enforce invariants.
-- Exactly one shared vault globally.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'vault_vaults_single_shared_unique'
  ) THEN
    CREATE UNIQUE INDEX vault_vaults_single_shared_unique
      ON vault_vaults (type)
      WHERE type = 'shared';
  END IF;
END $$;

-- At most one personal vault per owner (prevents duplicates).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE indexname = 'vault_vaults_personal_owner_unique'
  ) THEN
    CREATE UNIQUE INDEX vault_vaults_personal_owner_unique
      ON vault_vaults (owner_user_id)
      WHERE type = 'personal';
  END IF;
END $$;

