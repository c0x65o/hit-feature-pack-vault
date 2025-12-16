// src/server/api/items-reveal.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults, vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/vault/items/{id}/reveal -> id is second to last
  const idIndex = parts.indexOf('items') + 1;
  return parts[idIndex] || null;
}

/**
 * POST /api/vault/items/[id]/reveal
 * Reveal decrypted password/secret (audited)
 */
export async function POST(request: NextRequest) {
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

    // Create audit event for reveal action
    await db.insert(vaultAuditEvents).values({
      actorUserId: userId,
      action: 'ITEM_REVEAL_PASSWORD',
      resourceType: 'item',
      resourceId: id,
      success: true,
    });

    // TODO: Implement decryption logic
    // For now, return placeholder
    return NextResponse.json({
      secret: '[decrypted secret]',
      // Include other decrypted fields as needed
    });
  } catch (error) {
    console.error('[vault] Reveal item error:', error);
    return NextResponse.json(
      { error: 'Failed to reveal item' },
      { status: 500 }
    );
  }
}
