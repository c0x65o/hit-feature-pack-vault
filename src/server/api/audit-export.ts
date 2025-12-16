// src/server/api/audit-export.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { desc } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/audit/export
 * Export audit log (admin only)
 */
export async function GET(request: NextRequest) {
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
    const format = searchParams.get('format') || 'json';

    // TODO: Implement audit export logic
    const events = await db
      .select()
      .from(vaultAuditEvents)
      .orderBy(desc(vaultAuditEvents.ts));

    if (format === 'csv') {
      // TODO: Convert to CSV
      return NextResponse.json({ events });
    }

    return NextResponse.json({ events });
  } catch (error) {
    console.error('[vault] Export audit error:', error);
    return NextResponse.json(
      { error: 'Failed to export audit log' },
      { status: 500 }
    );
  }
}

