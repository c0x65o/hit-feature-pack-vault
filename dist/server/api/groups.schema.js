import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/groups
// - PUT /api/vault/groups/[id]
export const postBodySchema = z.object({
    name: z.string().min(1),
    description: z.string().nullable().optional(),
});
export const putBodySchema = z.object({
    name: z.string().min(1).optional(),
    description: z.string().nullable().optional(),
});
