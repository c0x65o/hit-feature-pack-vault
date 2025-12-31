import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    title: z.ZodString;
    vaultId: z.ZodString;
    folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    type: z.ZodOptional<z.ZodEnum<{
        credential: "credential";
        api_key: "api_key";
        secure_note: "secure_note";
    }>>;
    username: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    password: z.ZodOptional<z.ZodString>;
    secret: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString>>;
    twoFactorType: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
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
//# sourceMappingURL=items.schema.d.ts.map