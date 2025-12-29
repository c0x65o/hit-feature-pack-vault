import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    title: z.ZodOptional<z.ZodString>;
    username: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    url: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    tags: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    folderId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    password: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
    secret: z.ZodOptional<z.ZodString>;
    twoFactorType: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    folderId?: string | null | undefined;
    title?: string | undefined;
    username?: string | null | undefined;
    url?: string | null | undefined;
    tags?: string[] | undefined;
    password?: string | undefined;
    secret?: string | undefined;
    notes?: string | undefined;
    twoFactorType?: string | null | undefined;
}, {
    folderId?: string | null | undefined;
    title?: string | undefined;
    username?: string | null | undefined;
    url?: string | null | undefined;
    tags?: string[] | undefined;
    password?: string | undefined;
    secret?: string | undefined;
    notes?: string | undefined;
    twoFactorType?: string | null | undefined;
}>;
//# sourceMappingURL=items-id.schema.d.ts.map