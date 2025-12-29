import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/items/[id]/move
const uuid = z.string().uuid();
export const postBodySchema = z.object({
    folderId: uuid.nullable().optional(),
});
