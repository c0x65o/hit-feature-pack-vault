import { z } from "zod";
export declare const putBodySchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    ownerOrgId: z.ZodOptional<z.ZodNullable<z.ZodString>>;
    encryptionKeyVersion: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name?: string | undefined;
    ownerOrgId?: string | null | undefined;
    encryptionKeyVersion?: number | undefined;
}, {
    name?: string | undefined;
    ownerOrgId?: string | null | undefined;
    encryptionKeyVersion?: number | undefined;
}>;
//# sourceMappingURL=vaults-id.schema.d.ts.map