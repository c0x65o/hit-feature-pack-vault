import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/sms/messages/[id]/reveal
 * Reveal SMS message body (audited)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    body: string;
}>>;
//# sourceMappingURL=sms-messages-reveal.d.ts.map