import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/acl
const uuid = z.string().uuid();
export const postBodySchema = z.object({
    resourceType: z.enum(["vault", "folder"]),
    resourceId: uuid,
    principalType: z.string().min(1),
    principalId: z.string().min(1),
    permissions: z.array(z.string()).min(1),
});
