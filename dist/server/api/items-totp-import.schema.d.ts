import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    secret: z.ZodOptional<z.ZodString>;
    qrCode: z.ZodOptional<z.ZodString>;
    otpauthUri: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=items-totp-import.schema.d.ts.map