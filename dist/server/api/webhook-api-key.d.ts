import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/webhook/api-key
 * Get the current webhook API key (decrypted)
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    apiKey: null;
    message: string;
}> | NextResponse<{
    apiKey: string;
}>>;
/**
 * POST /api/vault/webhook/api-key
 * Generate a new webhook API key (GUID)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    apiKey: `${string}-${string}-${string}-${string}-${string}`;
    message: string;
}>>;
//# sourceMappingURL=webhook-api-key.d.ts.map