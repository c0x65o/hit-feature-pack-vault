import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    from: z.ZodString;
    to: z.ZodString;
    subject: z.ZodOptional<z.ZodString>;
    body: z.ZodString;
    timestamp: z.ZodOptional<z.ZodUnion<[z.ZodString, z.ZodNumber]>>;
}, "strip", z.ZodTypeAny, {
    body: string;
    from: string;
    to: string;
    subject?: string | undefined;
    timestamp?: string | number | undefined;
}, {
    body: string;
    from: string;
    to: string;
    subject?: string | undefined;
    timestamp?: string | number | undefined;
}>;
//# sourceMappingURL=email-webhook-inbound.schema.d.ts.map