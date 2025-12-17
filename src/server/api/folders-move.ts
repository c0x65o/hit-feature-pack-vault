// src/server/api/folders-move.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { checkFolderAccess } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/vault/folders/{id}/move -> id is second to last
  const idIndex = parts.indexOf('folders') + 1;
  return parts[idIndex] || null;
}

/**
 * POST /api/vault/folders/[id]/move
 * Move folder to new parent
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
    const parentId = body.parentId || null;

    // Get folder
    const [existing] = await db
      .select()
      .from(vaultFolders)
      .where(eq(vaultFolders.id, id))
      .limit(1);

    if (!existing) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check if user has READ_WRITE permission on the folder
    const accessCheck = await checkFolderAccess(db, id, user, { requiredPermissions: ['READ_WRITE'] });
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
    }

    // Get source vault to check type
    const [sourceVault] = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, existing.vaultId))
      .limit(1);

    if (!sourceVault) {
      return NextResponse.json({ error: 'Source vault not found' }, { status: 404 });
    }

    // If parentId provided, verify it exists and user has access
    if (parentId) {
      const [parent] = await db
        .select()
        .from(vaultFolders)
        .where(eq(vaultFolders.id, parentId))
        .limit(1);

      if (!parent) {
        return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
      }

      // Get target vault
      const [targetVault] = await db
        .select()
        .from(vaultVaults)
        .where(eq(vaultVaults.id, parent.vaultId))
        .limit(1);

      if (!targetVault) {
        return NextResponse.json({ error: 'Target vault not found' }, { status: 404 });
      }

      // CRITICAL: Prevent moving folders from shared vault to personal vault
      if (sourceVault.type === 'shared' && targetVault.type === 'personal') {
        return NextResponse.json({ error: 'Forbidden: Cannot move folders from shared vault to personal vault' }, { status: 403 });
      }

      // Ensure parent is in same vault (unless explicitly allowed cross-vault moves)
      if (parent.vaultId !== existing.vaultId) {
        return NextResponse.json({ error: 'Forbidden: Cannot move folder to different vault' }, { status: 403 });
      }

      // Check if user has READ_WRITE access to parent folder
      const parentAccessCheck = await checkFolderAccess(db, parentId, user, { requiredPermissions: ['READ_WRITE'] });
      if (!parentAccessCheck.hasAccess) {
        return NextResponse.json({ error: 'Forbidden: No write access to parent folder' }, { status: 403 });
      }
    }

    // Update folder - vaultFolders doesn't have updatedAt field
    const [item] = await db
      .update(vaultFolders)
      .set({
        parentId: parentId,
        // Note: vaultFolders doesn't have updatedAt field per schema
      })
      .where(eq(vaultFolders.id, id))
      .returning();

    return NextResponse.json(item);
  } catch (error) {
    console.error('[vault] Move folder error:', error);
    return NextResponse.json(
      { error: 'Failed to move folder' },
      { status: 500 }
    );
  }
}
