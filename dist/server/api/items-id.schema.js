import { z } from "zod";
// Schema-only module for:
// - PUT /api/vault/items/[id]
const uuid = z.string().uuid();
export const putBodySchema = z.object({
    title: z.string().min(1).optional(),
    username: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    tags: z.array(z.string()).optional(),
    folderId: uuid.nullable().optional(),
    password: z.string().optional(),
    notes: z.string().optional(),
    secret: z.string().optional(),
    twoFactorType: z.string().nullable().optional(),
});
