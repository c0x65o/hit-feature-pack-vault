import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/webhook-logs
 * List webhook logs (admin only)
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    items: any;
    pagination: {
        total: number;
        limit: number;
        offset: number;
    };
}>>;
//# sourceMappingURL=webhook-logs.d.ts.map