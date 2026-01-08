import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/groups/[id]/members
 * List group members
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    items: any;
}>>;
/**
 * POST /api/vault/groups/[id]/members
 * Add member to group
 */
export declare function POST(request: NextRequest): Promise<NextResponse<any>>;
/**
 * DELETE /api/vault/groups/[id]/members
 * Remove member from group
 */
export declare function DELETE(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    success: boolean;
}>>;
//# sourceMappingURL=groups-members.d.ts.map