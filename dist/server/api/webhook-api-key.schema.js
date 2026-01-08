import { z } from "zod";
// Schema-only module for:
// - POST /api/vault/webhook/api-key
//
// This endpoint takes no body (generates a new API key)
export const postBodySchema = z.object({}).strict();
