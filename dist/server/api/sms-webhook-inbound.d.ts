import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/sms/webhook/inbound
 * Inbound SMS webhook (Twilio/etc)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    success: boolean;
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=sms-webhook-inbound.d.ts.map