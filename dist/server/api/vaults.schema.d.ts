import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<{
        personal: "personal";
        shared: "shared";
    }>>;
    ownerOrgId: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodOptional<z.ZodString>;
    encryptionKeyVersion: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    ownerOrgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    encryptionKeyVersion: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
//# sourceMappingURL=vaults.schema.d.ts.map