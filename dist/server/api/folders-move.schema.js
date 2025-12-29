import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/folders/[id]/move
const uuid = z.string().uuid();
export const postBodySchema = z.object({
    parentId: uuid.nullable().optional(),
});
