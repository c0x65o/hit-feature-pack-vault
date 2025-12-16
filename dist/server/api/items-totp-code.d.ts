import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/items/[id]/totp/code
 * Generate TOTP code (audited)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    code: string;
    expiresAt: Date;
}>>;
//# sourceMappingURL=items-totp-code.d.ts.map