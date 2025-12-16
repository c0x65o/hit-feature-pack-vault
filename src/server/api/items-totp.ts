// src/server/api/items-totp.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '../auth';

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

    // Verify user owns the vault or has ACL access
    const [vault] = await db
      .select()
      .from(vaultVaults)
      .where(and(
        eq(vaultVaults.id, item.vaultId),
        eq(vaultVaults.ownerUserId, userId)
      ))
      .limit(1);

    if (!vault) {
      // TODO: Check ACL for shared vault access
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
