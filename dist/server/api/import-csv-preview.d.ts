import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/import/csv/preview
 * Preview CSV import with mapping
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    preview: never[];
    mappings: {};
}>>;
//# sourceMappingURL=import-csv-preview.d.ts.map