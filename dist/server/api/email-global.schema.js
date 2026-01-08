import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/email/global
export const postBodySchema = z.object({
    emailAddress: z.string().email(),
});
