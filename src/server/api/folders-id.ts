// src/server/api/folders-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultFolders } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { checkFolderAccess } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * Check if user has access to a folder (via vault ownership or ACL)
 */
async function verifyFolderAccess(db: ReturnType<typeof getDb>, folderId: string, user: ReturnType<typeof extractUserFromRequest>) {
  if (!user) return null;

  // Check ACL access
  const accessCheck = await checkFolderAccess(db, folderId, user);
  if (!accessCheck.hasAccess) {
    return null;
  }

  // Get folder if access is granted
  const [folder] = await db
    .select()
    .from(vaultFolders)
    .where(eq(vaultFolders.id, folderId))
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

    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const folder = await verifyFolderAccess(db, id, user);
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

    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Check if user has EDIT permission
    const accessCheck = await checkFolderAccess(db, id, user, { requiredPermissions: ['EDIT'] });
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
    }

    const existing = await verifyFolderAccess(db, id, user);
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

    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check if user has DELETE permission
    const accessCheck = await checkFolderAccess(db, id, user, { requiredPermissions: ['DELETE'] });
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
    }

    const existing = await verifyFolderAccess(db, id, user);
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

