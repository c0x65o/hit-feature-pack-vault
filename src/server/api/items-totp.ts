// src/server/api/items-totp.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkItemAccess } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * DELETE /api/vault/items/[id]/totp
 * Remove TOTP secret
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

    // Get item
    const [item] = await db
      .select()
      .from(vaultItems)
      .where(eq(vaultItems.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify user has READ_WRITE access via ACL check (modifying TOTP requires write permission)
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['READ_WRITE'] });
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // TODO: Implement TOTP secret removal (update secretBlobEncrypted)
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] Remove TOTP error:', error);
    return NextResponse.json(
      { error: 'Failed to remove TOTP secret' },
      { status: 500 }
    );
  }
}
