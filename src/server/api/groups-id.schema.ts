import { z } from "zod";

// Schema-only module for:
// - PUT /api/vault/groups/[id]

export const putBodySchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
});
