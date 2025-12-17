// src/server/api/items-move.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultFolders } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { checkItemAccess, checkFolderAccess } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  const idIndex = parts.indexOf('items') + 1;
  return parts[idIndex] || null;
}

/**
 * POST /api/vault/items/[id]/move
 * Move item to new folder
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const id = extractId(request);
    if (!id) {
      return NextResponse.json({ error: 'Missing id' }, { status: 400 });
    }

    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const folderId = body.folderId || null;

    // Get item
    const [existing] = await db
      .select()
      .from(vaultItems)
      .where(eq(vaultItems.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check if user has EDIT permission on the item (via ACL)
    const itemAccessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['EDIT'] });
    if (!itemAccessCheck.hasAccess) {
      return NextResponse.json({ error: 'Forbidden: ' + (itemAccessCheck.reason || 'Insufficient permissions') }, { status: 403 });
    }

    // Determine target vault ID and folder
    let targetVaultId = existing.vaultId;
    
    if (folderId) {
      // Get the target folder
      const [folder] = await db
        .select()
        .from(vaultFolders)
        .where(eq(vaultFolders.id, folderId))
        .limit(1);

      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }

      // Check if user has access to the target folder (via ACL)
      const folderAccessCheck = await checkFolderAccess(db, folderId, user);
      if (!folderAccessCheck.hasAccess) {
        return NextResponse.json({ error: 'Forbidden: No access to target folder' }, { status: 403 });
      }

      // When moving to a folder in a different vault, update the item's vaultId
      targetVaultId = folder.vaultId;
    }

    const [item] = await db
      .update(vaultItems)
      .set({
        folderId: folderId,
        vaultId: targetVaultId, // Update vaultId if moving to a different vault
        updatedAt: new Date(),
        updatedBy: user.sub,
      })
      .where(eq(vaultItems.id, id))
      .returning();

    return NextResponse.json(item);
  } catch (error) {
    console.error('[vault] Move item error:', error);
    return NextResponse.json(
      { error: 'Failed to move item' },
      { status: 500 }
    );
  }
}
