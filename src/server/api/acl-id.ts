// src/server/api/acl-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultAcls } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * DELETE /api/vault/acl/[id]
 * Delete ACL entry
 */
export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const id = extractId(request);
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // TODO: Verify user has permission to delete this ACL
    await db.delete(vaultAcls).where(eq(vaultAcls.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] Delete ACL error:', error);
    return NextResponse.json(
      { error: 'Failed to delete ACL' },
      { status: 500 }
    );
  }
}

