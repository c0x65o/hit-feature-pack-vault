import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    resourceType: z.ZodEnum<{
        vault: "vault";
        folder: "folder";
    }>;
    resourceId: z.ZodString;
    principalType: z.ZodString;
    principalId: z.ZodString;
    permissions: z.ZodArray<z.ZodString>;
}, z.core.$strip>;
//# sourceMappingURL=acl.schema.d.ts.map