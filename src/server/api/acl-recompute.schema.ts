import { z } from "zod";

// Schema-only module for:
// - POST /api/vault/acl/recompute

const uuid = z.string().uuid();

export const postBodySchema = z.object({
  resourceId: uuid,
  resourceType: z.enum(["vault", "folder"]),
});
