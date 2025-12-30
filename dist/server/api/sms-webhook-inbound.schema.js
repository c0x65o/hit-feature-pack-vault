import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/sms/webhook/inbound
//
// Supports Twilio (form-encoded) and F-Droid/Custom (JSON) formats
// Body can be either form data or JSON, so we make fields optional to handle both
export const postBodySchema = z.object({
    // Twilio format (form-encoded)
    From: z.string().optional(),
    To: z.string().optional(),
    Body: z.string().optional(),
    MessageSid: z.string().optional(),
    AccountSid: z.string().optional(),
    // F-Droid/Custom format (JSON)
    from: z.string().optional(),
    to: z.string().optional(),
    body: z.string().optional(),
    timestamp: z.union([z.string().datetime(), z.number()]).optional(),
}).refine((data) => {
    // At least one format must be present
    const hasTwilio = data.From && data.To && data.Body;
    const hasCustom = data.from && data.to && data.body;
    return hasTwilio || hasCustom;
}, {
    message: "Must provide either Twilio format (From, To, Body) or custom format (from, to, body)",
});
