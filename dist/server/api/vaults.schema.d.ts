import { z } from "zod";
export declare const postBodySchema: z.ZodObject<{
    name: z.ZodString;
    type: z.ZodOptional<z.ZodEnum<["personal", "shared"]>>;
    ownerOrgId: z.ZodOptional<z.ZodString>;
    tenantId: z.ZodOptional<z.ZodString>;
    encryptionKeyVersion: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    name: string;
    type?: "personal" | "shared" | undefined;
    ownerOrgId?: string | undefined;
    tenantId?: string | undefined;
    encryptionKeyVersion?: number | undefined;
}, {
    name: string;
    type?: "personal" | "shared" | undefined;
    ownerOrgId?: string | undefined;
    tenantId?: string | undefined;
    encryptionKeyVersion?: number | undefined;
}>;
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
//# sourceMappingURL=vaults.schema.d.ts.map