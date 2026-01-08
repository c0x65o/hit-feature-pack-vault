import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    resourceId: z.ZodString;
    resourceType: z.ZodEnum<{
        vault: "vault";
        folder: "folder";
    }>;
}, z.core.$strip>;
//# sourceMappingURL=acl-recompute.schema.d.ts.map