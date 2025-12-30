import { z } from "zod";

// Schema-only module for:
// - POST /api/vault/sms/messages/[id]/reveal
//
// This endpoint takes no body (id is in URL path)

export const postBodySchema = z.object({}).strict();

