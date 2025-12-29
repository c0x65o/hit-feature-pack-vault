import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/sms/webhook/inbound
 * Inbound SMS webhook (Twilio/F-Droid/Custom)
 *
 * Supports multiple formats:
 *
 * 1. Twilio format (form-encoded):
 *    - From: sender phone number
 *    - To: recipient phone number (our provisioned number)
 *    - Body: message text
 *    - MessageSid: unique message ID
 *    - AccountSid: Twilio account SID
 *    - Authenticated via X-Twilio-Signature header
 *
 * 2. F-Droid/Custom format (JSON):
 *    - from: sender phone number
 *    - to: recipient phone number (our provisioned number)
 *    - body: message text
 *    - timestamp: optional timestamp (ISO string or Unix timestamp)
 *    - Authenticated via Authorization: Bearer <token> or X-API-Key header
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=sms-webhook-inbound.d.ts.map