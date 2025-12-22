import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/email/global
 * Get the global 2FA email address (any authenticated user)
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    emailAddress: string | null;
}>>;
/**
 * POST /api/vault/email/global
 * Set the global 2FA email address (admin only)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    emailAddress: string;
}>>;
/**
 * DELETE /api/vault/email/global
 * Delete the global 2FA email address (admin only)
 */
export declare function DELETE(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=email-global.d.ts.map