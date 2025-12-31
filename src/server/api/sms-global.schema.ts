import { z } from "zod";

// Schema-only module for:
// - POST /api/vault/sms/global

export const postBodySchema = z.object({
  phoneNumber: z.string().regex(/^\+[1-9]\d{1,14}$/, "Phone number must be in E.164 format (e.g., +1234567890)"),
});

