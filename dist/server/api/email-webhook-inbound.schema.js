import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/email/webhook/inbound
//
// Supports Power Automate and custom email forwarding formats
export const postBodySchema = z.object({
    from: z.string().min(1),
    to: z.string().min(1),
    subject: z.string().optional(),
    body: z.string().min(1),
    timestamp: z.union([z.string().datetime(), z.number()]).optional(),
});
