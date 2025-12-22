import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/email/messages/latest
 * Get latest email messages that user has access to via item permissions
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    messages: {
        id: any;
        from: any;
        to: any;
        subject: string | null;
        receivedAt: any;
    }[];
    globalEmail: string | null;
}>>;
//# sourceMappingURL=email-messages-latest.d.ts.map