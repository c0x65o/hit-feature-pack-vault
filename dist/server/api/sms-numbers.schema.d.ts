import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    vaultId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    itemId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    provider: z.ZodOptional<z.ZodString>;
    status: z.ZodOptional<z.ZodEnum<["active", "inactive", "pending"]>>;
} & {
    phoneNumber: z.ZodOptional<z.ZodString>;
}, z.UnknownKeysParam, z.ZodTypeAny, {
    vaultId?: string | null | undefined;
    itemId?: string | null | undefined;
    phoneNumber?: string | undefined;
    provider?: string | undefined;
    status?: "active" | "inactive" | "pending" | undefined;
}, {
    vaultId?: string | null | undefined;
    itemId?: string | null | undefined;
    phoneNumber?: string | undefined;
    provider?: string | undefined;
    status?: "active" | "inactive" | "pending" | undefined;
}>;
//# sourceMappingURL=sms-numbers.schema.d.ts.map