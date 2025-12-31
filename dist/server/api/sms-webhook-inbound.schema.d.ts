import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    From: z.ZodOptional<z.ZodString>;
    To: z.ZodOptional<z.ZodString>;
    Body: z.ZodOptional<z.ZodString>;
    MessageSid: z.ZodOptional<z.ZodString>;
    AccountSid: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
}, z.core.$strip>;
//# sourceMappingURL=sms-webhook-inbound.schema.d.ts.map