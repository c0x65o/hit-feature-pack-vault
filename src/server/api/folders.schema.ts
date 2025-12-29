import { z } from "zod";

// Schema-only module for:
// - POST /api/vault/folders
// - PUT /api/vault/folders/[id]

const uuid = z.string().uuid();

export const postBodySchema = z.object({
  name: z.string().min(1),
  vaultId: uuid,
  parentId: uuid.nullable().optional(),
});

export const putBodySchema = z.object({
  name: z.string().min(1).optional(),
});
