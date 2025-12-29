import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * GET /api/vault/sms/messages/latest
 * Get latest SMS messages (metadataEncrypted.type === 'sms').
 *
 * Query params:
 * - since: ISO timestamp; return messages received at/after this time.
 */
export declare function GET(request: NextRequest): Promise<NextResponse<{
    error: string;
}> | NextResponse<{
    messages: {
        id: string;
        fromNumber: string;
        toNumber: string;
        receivedAt: Date;
    }[];
}>>;
//# sourceMappingURL=sms-messages-latest.d.ts.map