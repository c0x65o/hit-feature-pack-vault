-- Feature Pack: vault
-- Default pack-scoped dashboard so /dashboards?pack=vault isn't empty.

INSERT INTO "dashboard_definitions" (
  "key",
  "owner_user_id",
  "is_system",
  "name",
  "description",
  "visibility",
  "scope",
  "version",
  "definition",
  "updated_at"
)
VALUES (
  'system.vault_kpi_catalog',
  'system',
  TRUE,
  'Vault KPIs',
  'Auto-generated KPI tiles for Vault metrics.',
  'public',
  '{"kind":"pack","pack":"vault"}'::jsonb,
  0,
  $json$
  {
    "time": { "mode": "picker", "default": "last_30_days" },
    "layout": { "grid": { "cols": 12, "rowHeight": 36, "gap": 14 } },
    "widgets": [
      {
        "key": "kpi_catalog.vault_metrics",
        "kind": "kpi_catalog",
        "title": "Vault Metrics",
        "grid": { "x": 0, "y": 0, "w": 12, "h": 8 },
        "time": "inherit",
        "presentation": {
          "entityKind": "project",
          "onlyWithPoints": false
        }
      }
    ]
  }
  $json$::jsonb,
  NOW()
)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "scope" = EXCLUDED."scope",
  "version" = EXCLUDED."version",
  "definition" = EXCLUDED."definition",
  "updated_at" = EXCLUDED."updated_at";


