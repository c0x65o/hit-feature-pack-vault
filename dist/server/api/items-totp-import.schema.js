import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/items/[id]/totp/import
export const postBodySchema = z.object({
    secret: z.string().optional(),
    qrCode: z.string().optional(),
    otpauthUri: z.string().optional(),
});
