import { z } from "zod";
// Schema-only module for:
// - PUT /api/vault/folders/[id]
export const putBodySchema = z.object({
    name: z.string().min(1).optional(),
});
