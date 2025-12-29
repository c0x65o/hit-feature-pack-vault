import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    name: z.ZodString;
    vaultId: z.ZodString;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    vaultId: string;
    parentId?: string | null | undefined;
}, {
    name: string;
    vaultId: string;
    parentId?: string | null | undefined;
}>;
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
}, {
    name?: string | undefined;
}>;
//# sourceMappingURL=folders.schema.d.ts.map