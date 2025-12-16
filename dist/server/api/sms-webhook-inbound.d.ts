import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/sms/webhook/inbound
 * Inbound SMS webhook (Twilio/etc)
 *
 * Twilio sends POST with form-encoded data:
 * - From: sender phone number
 * - To: recipient phone number (our provisioned number)
 * - Body: message text
 * - MessageSid: unique message ID
 * - AccountSid: Twilio account SID
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=sms-webhook-inbound.d.ts.map