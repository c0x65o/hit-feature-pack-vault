// src/server/api/audit.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq, desc, sql, and } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/audit
 * List audit events (filtered by access)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);

    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '25', 10);
    const offset = (page - 1) * pageSize;

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Filter by actorUserId (the correct field in vaultAuditEvents)
    const whereClause = eq(vaultAuditEvents.actorUserId, userId);

    const countQuery = db.select({ count: sql<number>`count(*)` }).from(vaultAuditEvents).where(whereClause);
    const countResult = await countQuery;
    const total = Number(countResult[0]?.count || 0);

    const items = await db
      .select()
      .from(vaultAuditEvents)
      .where(whereClause)
      .orderBy(desc(vaultAuditEvents.ts)) // Use 'ts' instead of 'createdAt'
      .limit(pageSize)
      .offset(offset);

    return NextResponse.json({
      items,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error('[vault] List audit events error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit events' },
      { status: 500 }
    );
  }
}
