import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    resourceId: z.ZodString;
    resourceType: z.ZodEnum<["vault", "folder"]>;
}, "strip", z.ZodTypeAny, {
    resourceType: "vault" | "folder";
    resourceId: string;
}, {
    resourceType: "vault" | "folder";
    resourceId: string;
}>;
//# sourceMappingURL=acl-recompute.schema.d.ts.map