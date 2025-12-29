import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    items: z.ZodArray<z.ZodAny, "many">;
    mappings: z.ZodRecord<z.ZodString, z.ZodAny>;
}, "strip", z.ZodTypeAny, {
    items: any[];
    mappings: Record<string, any>;
}, {
    items: any[];
    mappings: Record<string, any>;
}>;
//# sourceMappingURL=import-csv-commit.schema.d.ts.map