import { z } from "zod";

// Schema-only module for:
// - POST /api/vault/import/csv/commit

export const postBodySchema = z.object({
  items: z.array(z.any()).min(1),
  mappings: z.record(z.any()),
});
