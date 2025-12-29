import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/groups/[id]/members
const uuid = z.string().uuid();
export const postBodySchema = z.object({
    userId: uuid,
});
