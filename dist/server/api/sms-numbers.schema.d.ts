import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    vaultId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    itemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provider: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "pending"]>>;
    phoneNumber: z.ZodOptional<z.ZodString>;
}, "strip">;
//# sourceMappingURL=sms-numbers.schema.d.ts.map