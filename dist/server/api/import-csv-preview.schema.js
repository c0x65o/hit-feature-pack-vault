import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/import/csv/preview
export const postBodySchema = z.object({
    csvData: z.string().min(1),
});
