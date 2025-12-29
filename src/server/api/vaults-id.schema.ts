import { z } from "zod";

// Schema-only module for:
// - PUT /api/vault/vaults/[id]

const uuid = z.string().uuid();

export const putBodySchema = z.object({
  name: z.string().min(1).optional(),
  ownerOrgId: uuid.nullable().optional(),
  encryptionKeyVersion: z.number().int().positive().optional(),
});
