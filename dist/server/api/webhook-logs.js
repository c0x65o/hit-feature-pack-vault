// src/server/api/webhook-logs.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultWebhookLogs } from '@/lib/feature-pack-schemas';
import { desc, sql } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/vault/webhook-logs
 * List webhook logs (admin only)
 */
export async function GET(request) {
    try {
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check admin role
        if (!user.roles?.includes('admin')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }
        const db = getDb();
        const { searchParams } = new URL(request.url);
        const limit = parseInt(searchParams.get('limit') || '100', 10);
        const offset = parseInt(searchParams.get('offset') || '0', 10);
        const logs = await db
            .select()
            .from(vaultWebhookLogs)
            .orderBy(desc(vaultWebhookLogs.receivedAt))
            .limit(limit)
            .offset(offset);
        const countQuery = db.select({ count: sql `count(*)` }).from(vaultWebhookLogs);
        const countResult = await countQuery;
        const total = Number(countResult[0]?.count || 0);
        return NextResponse.json({
            items: logs,
            pagination: {
                total,
                limit,
                offset,
            },
        });
    }
    catch (error) {
        console.error('[vault] List webhook logs error:', error);
        return NextResponse.json({ error: 'Failed to fetch webhook logs' }, { status: 500 });
    }
}
