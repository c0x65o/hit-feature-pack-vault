import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    name: z.ZodString;
    vaultId: z.ZodString;
    parentId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, z.core.$strip>;
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=folders.schema.d.ts.map