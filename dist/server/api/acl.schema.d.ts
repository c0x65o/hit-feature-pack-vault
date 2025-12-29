import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    resourceType: z.ZodEnum<["vault", "folder"]>;
    resourceId: z.ZodString;
    principalType: z.ZodString;
    principalId: z.ZodString;
    permissions: z.ZodArray<z.ZodString, "many">;
}, "strip", z.ZodTypeAny, {
    resourceType: "vault" | "folder";
    resourceId: string;
    principalType: string;
    principalId: string;
    permissions: string[];
}, {
    resourceType: "vault" | "folder";
    resourceId: string;
    principalType: string;
    principalId: string;
    permissions: string[];
}>;
//# sourceMappingURL=acl.schema.d.ts.map