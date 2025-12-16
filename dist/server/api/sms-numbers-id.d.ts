import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/sms/numbers/[id]
 */
export declare function GET(request: NextRequest): Promise<NextResponse<any>>;
/**
 * DELETE /api/vault/sms/numbers/[id]
 */
export declare function DELETE(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=sms-numbers-id.d.ts.map