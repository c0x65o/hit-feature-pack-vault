import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/items/[id]/sms/request
 * Send SMS to request 2FA code for a vault item
 *
 * This sends an SMS to the configured phone number requesting a 2FA code.
 * The user should then receive the 2FA code via SMS (from the service),
 * which will be captured by the inbound webhook.
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
    messageSid: string | undefined;
    status: string | undefined;
    message: string;
}>>;
//# sourceMappingURL=items-sms-request.d.ts.map