import { z } from "zod";
export declare const postBodySchema: z.ZodEffects<z.ZodObject<{
    From: z.ZodOptional<z.ZodString>;
    To: z.ZodOptional<z.ZodString>;
    Body: z.ZodOptional<z.ZodString>;
    MessageSid: z.ZodOptional<z.ZodString>;
    AccountSid: z.ZodOptional<z.ZodString>;
    from: z.ZodOptional<z.ZodString>;
    to: z.ZodOptional<z.ZodString>;
    body: z.ZodOptional<z.ZodString>;
    timestamp: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
}, "strip", z.ZodTypeAny, {
    body?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    timestamp?: string | number | undefined;
    Body?: string | undefined;
    From?: string | undefined;
    To?: string | undefined;
    MessageSid?: string | undefined;
    AccountSid?: string | undefined;
}, {
    body?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    timestamp?: string | number | undefined;
    Body?: string | undefined;
    From?: string | undefined;
    To?: string | undefined;
    MessageSid?: string | undefined;
    AccountSid?: string | undefined;
}>, {
    body?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    timestamp?: string | number | undefined;
    Body?: string | undefined;
    From?: string | undefined;
    To?: string | undefined;
    MessageSid?: string | undefined;
    AccountSid?: string | undefined;
}, {
    body?: string | undefined;
    from?: string | undefined;
    to?: string | undefined;
    timestamp?: string | number | undefined;
    Body?: string | undefined;
    From?: string | undefined;
    To?: string | undefined;
    MessageSid?: string | undefined;
    AccountSid?: string | undefined;
}>;
//# sourceMappingURL=sms-webhook-inbound.schema.d.ts.map