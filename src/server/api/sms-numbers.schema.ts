import { createInsertSchema } from "drizzle-zod";
import { vaultSmsNumbers } from "../../schema/vault";
import { z } from "zod";

// Schema-only module for:
// - POST /api/vault/sms/numbers

// Derive schema from Drizzle table, then omit server-controlled fields
const baseSchema = createInsertSchema(vaultSmsNumbers, {
  id: z.string().uuid().optional(), // Allow omitting (will be generated)
  createdAt: z.any().optional(), // Server-controlled
});

export const postBodySchema = baseSchema.omit({
  id: true,
  createdAt: true,
}).extend({
  // Make phoneNumber optional (can be set later for F-Droid)
  phoneNumber: z.string().optional(),
});

