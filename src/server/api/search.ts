// src/server/api/search.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, like, or, and, inArray } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/search
 * Search items by metadata (access-controlled)
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q') || '';

    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!query) {
      return NextResponse.json({ items: [] });
    }

    // Get vaults owned by user
    const userVaults = await db
      .select({ id: vaultVaults.id })
      .from(vaultVaults)
      .where(eq(vaultVaults.ownerUserId, userId));

    const vaultIds = userVaults.map((v: { id: string }) => v.id);

    if (vaultIds.length === 0) {
      return NextResponse.json({ items: [] });
    }

    // Search items in user's vaults by title, username, or url (searchable metadata fields)
    const items = await db
      .select()
      .from(vaultItems)
      .where(and(
        inArray(vaultItems.vaultId, vaultIds),
        or(
          like(vaultItems.title, `%${query}%`),
          like(vaultItems.username, `%${query}%`),
          like(vaultItems.url, `%${query}%`)
        )
      ))
      .limit(50);

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[vault] Search error:', error);
    return NextResponse.json(
      { error: 'Failed to search items' },
      { status: 500 }
    );
  }
}
