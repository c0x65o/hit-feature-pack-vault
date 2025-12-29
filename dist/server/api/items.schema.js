import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/items
// - PUT /api/vault/items/[id]
const uuid = z.string().uuid();
export const postBodySchema = z.object({
    title: z.string().min(1),
    vaultId: uuid,
    folderId: uuid.nullable().optional(),
    type: z.enum(["credential", "api_key", "secure_note"]).optional(),
    username: z.string().nullable().optional(),
    url: z.string().nullable().optional(),
    password: z.string().optional(),
    secret: z.string().optional(),
    notes: z.string().optional(),
    tags: z.array(z.string()).optional(),
    twoFactorType: z.string().optional(),
});
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
