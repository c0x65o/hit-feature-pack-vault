// src/server/api/folders-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
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
 * Check if user has access to a folder (via vault ownership)
 */
async function verifyFolderAccess(db: ReturnType<typeof getDb>, folderId: string, userId: string) {
  // Get user's vault IDs
  const userVaults = await db
    .select({ id: vaultVaults.id })
    .from(vaultVaults)
    .where(eq(vaultVaults.ownerUserId, userId));
  
  const userVaultIds = userVaults.map((v: { id: string }) => v.id);
  if (userVaultIds.length === 0) return null;

  // Check if folder is in user's vaults
  const [folder] = await db
    .select()
    .from(vaultFolders)
    .where(and(
      eq(vaultFolders.id, folderId),
      inArray(vaultFolders.vaultId, userVaultIds)
    ))
    .limit(1);

  return folder;
}

/**
 * GET /api/vault/folders/[id]
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

    const folder = await verifyFolderAccess(db, id, userId);
    if (!folder) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(folder);
  } catch (error) {
    console.error('[vault] Get folder error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch folder' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vault/folders/[id]
 * Update folder name (and recalculate path if needed)
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

    const existing = await verifyFolderAccess(db, id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const updateData: Record<string, unknown> = {};

    // Update name and recalculate path
    if (body.name !== undefined && body.name !== existing.name) {
      updateData.name = body.name;
      // Rebuild path with new name (keep parent path, replace last segment)
      const parentPath = existing.path.substring(0, existing.path.lastIndexOf(existing.name));
      updateData.path = `${parentPath}${body.name}/`;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(existing);
    }

    const [folder] = await db
      .update(vaultFolders)
      .set(updateData)
      .where(eq(vaultFolders.id, id))
      .returning();

    return NextResponse.json(folder);
  } catch (error) {
    console.error('[vault] Update folder error:', error);
    return NextResponse.json(
      { error: 'Failed to update folder' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vault/folders/[id]
 * Delete folder (cascades to items and subfolders via FK)
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

    const existing = await verifyFolderAccess(db, id, userId);
    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db.delete(vaultFolders).where(eq(vaultFolders.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] Delete folder error:', error);
    return NextResponse.json(
      { error: 'Failed to delete folder' },
      { status: 500 }
    );
  }
}

