import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    ownerOrgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    encryptionKeyVersion: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
//# sourceMappingURL=vaults-id.schema.d.ts.map