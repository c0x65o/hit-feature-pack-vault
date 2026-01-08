import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    timestamp: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
}, z.core.$strip>;
//# sourceMappingURL=email-webhook-inbound.schema.d.ts.map