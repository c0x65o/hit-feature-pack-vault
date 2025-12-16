import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/items/[id]/reveal
 * Reveal decrypted password/secret (audited)
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    password: any;
    secret: any;
    notes: any;
    totpSecret: any;
}>>;
//# sourceMappingURL=items-reveal.d.ts.map