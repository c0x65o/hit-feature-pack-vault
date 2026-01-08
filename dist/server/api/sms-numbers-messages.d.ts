import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/sms/numbers/[id]/messages
 * List messages for SMS number
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    items: any;
}>>;
//# sourceMappingURL=sms-numbers-messages.d.ts.map