import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/vaults
// - PUT /api/vault/vaults/[id]
const uuid = z.string().uuid();
export const postBodySchema = z.object({
    name: z.string().min(1),
    type: z.enum(["personal", "shared"]).optional(),
    ownerOrgId: uuid.optional(),
    tenantId: uuid.optional(),
    encryptionKeyVersion: z.number().int().positive().optional(),
});
export const putBodySchema = z.object({
    name: z.string().min(1).optional(),
    ownerOrgId: uuid.nullable().optional(),
    encryptionKeyVersion: z.number().int().positive().optional(),
});
