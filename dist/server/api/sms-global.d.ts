import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/sms/global
 * Get the global 2FA phone number (any authenticated user)
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    phoneNumber: string | null;
}>>;
/**
 * POST /api/vault/sms/global
 * Set the global 2FA phone number (admin only)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    phoneNumber: string;
}>>;
/**
 * DELETE /api/vault/sms/global
 * Delete the global 2FA phone number (admin only)
 */
export declare function DELETE(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=sms-global.d.ts.map