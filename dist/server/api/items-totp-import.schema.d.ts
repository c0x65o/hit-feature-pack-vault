import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    secret: z.ZodOptional<z.ZodString>;
    qrCode: z.ZodOptional<z.ZodString>;
    otpauthUri: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    secret?: string | undefined;
    qrCode?: string | undefined;
    otpauthUri?: string | undefined;
}, {
    secret?: string | undefined;
    qrCode?: string | undefined;
    otpauthUri?: string | undefined;
}>;
//# sourceMappingURL=items-totp-import.schema.d.ts.map