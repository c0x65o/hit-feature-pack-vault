import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name: string;
    description?: string | null | undefined;
}, {
    name: string;
    description?: string | null | undefined;
}>;
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodNullable<z.ZodString>>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    description?: string | null | undefined;
}, {
    name?: string | undefined;
    description?: string | null | undefined;
}>;
//# sourceMappingURL=groups.schema.d.ts.map