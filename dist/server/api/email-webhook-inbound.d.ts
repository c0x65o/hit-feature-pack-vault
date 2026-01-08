import { NextRequest, NextResponse } from 'next/server';
export declare const dynamic = "force-dynamic";
export declare const runtime = "nodejs";
/**
 * POST /api/vault/email/webhook/inbound
 * Inbound Email webhook (Power Automate/Custom)
 *
 * Supports Power Automate and custom email forwarding:
 *
 * Power Automate/Custom format (JSON):
 *    - from: sender email address
 *    - to: recipient email address
 *    - subject: email subject
 *    - body: email body (text or HTML)
 *    - timestamp: optional timestamp (ISO string or Unix timestamp)
 *    - Authenticated via Authorization: Bearer <token> or X-API-Key header
 */
export declare function POST(request: NextRequest): Promise<NextResponse<{
    success: boolean;
}> | NextResponse<{
    error: string;
}>>;
//# sourceMappingURL=email-webhook-inbound.d.ts.map