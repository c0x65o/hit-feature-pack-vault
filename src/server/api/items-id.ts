// src/server/api/items-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, and, inArray } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * Check if user has access to an item (via vault ownership)
 */
async function verifyItemAccess(db: ReturnType<typeof getDb>, itemId: string, userId: string) {
  // Get user's vault IDs
  const userVaults = await db
    .select({ id: vaultVaults.id })
    .from(vaultVaults)
    .where(eq(vaultVaults.ownerUserId, userId));
  
  const userVaultIds = userVaults.map((v: { id: string }) => v.id);
  if (userVaultIds.length === 0) return null;

  // Check if item is in user's vaults
  const [item] = await db
    .select()
    .from(vaultItems)
    .where(and(
      eq(vaultItems.id, itemId),
      inArray(vaultItems.vaultId, userVaultIds)
    ))
    .limit(1);

  return item;
}

/**
 * GET /api/vault/items/[id]
 * Get item metadata (excludes encrypted secrets - use /reveal for that)
 */
export async function GET(request: NextRequest) {
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

    const item = await verifyItemAccess(db, id, userId);
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Return item without encrypted secret blob
    const { secretBlobEncrypted, ...safeItem } = item;
    return NextResponse.json(safeItem);
  } catch (error) {
    console.error('[vault] Get item error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch item' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vault/items/[id]
 * Update item metadata and/or secrets
 */
export async function PUT(request: NextRequest) {
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

    const body = await request.json();

    const existing = await verifyItemAccess(db, id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
      updatedBy: userId,
    };

    // Update metadata fields
    if (body.title !== undefined) updateData.title = body.title;
    if (body.username !== undefined) updateData.username = body.username;
    if (body.url !== undefined) updateData.url = body.url;
    if (body.tags !== undefined) updateData.tags = body.tags;
    if (body.folderId !== undefined) updateData.folderId = body.folderId;

    // Update secret if provided (re-encrypt)
    if (body.password !== undefined || body.notes !== undefined) {
      const secretData = {
        password: body.password ?? '',
        notes: body.notes ?? '',
      };
      updateData.secretBlobEncrypted = Buffer.from(JSON.stringify(secretData)).toString('base64');
      updateData.secretVersion = (existing.secretVersion || 1) + 1;
    }

    const [item] = await db
      .update(vaultItems)
      .set(updateData)
      .where(eq(vaultItems.id, id))
      .returning();

    // Return without encrypted secret
    const { secretBlobEncrypted, ...safeItem } = item;
    return NextResponse.json(safeItem);
  } catch (error) {
    console.error('[vault] Update item error:', error);
    return NextResponse.json(
      { error: 'Failed to update item' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vault/items/[id]
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

    const existing = await verifyItemAccess(db, id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.delete(vaultItems).where(eq(vaultItems.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] Delete item error:', error);
    return NextResponse.json(
      { error: 'Failed to delete item' },
      { status: 500 }
    );
  }
}

