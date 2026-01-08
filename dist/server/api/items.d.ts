import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/items
 * List items for vaults the current user owns
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    items: any[];
    pagination: {
        page: number;
        pageSize: number;
        total: number;
        totalPages: number;
    };
}>>;
/**
 * POST /api/vault/items
 * Create a new item in a vault
 */
export declare function POST(request: NextRequest): Promise<NextResponse<any>>;
//# sourceMappingURL=items.d.ts.map