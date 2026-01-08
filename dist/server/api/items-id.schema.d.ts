import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    password: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    secret: z.ZodOptional<z.ZodString>;
    twoFactorType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
//# sourceMappingURL=items-id.schema.d.ts.map