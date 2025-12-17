// src/server/api/folders-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
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

    // Add permission flags for UI conditional rendering
    const { getEffectiveFolderAcls, getUserPrincipals, mergePermissions } = await import('../lib/acl-utils');
    
    // Get vault to check ownership
    const [vault] = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, folder.vaultId))
      .limit(1);
    
    const isAdmin = user.roles?.includes('admin') || false;
    const isOwner = vault?.ownerUserId === user.sub;
    
    // Check ACL permissions to determine actual permission level
    let permissionLevel: 'full' | 'read_write' | 'read_only' | 'none' = 'none';
    
    const principals = await getUserPrincipals(db, user);
    const effectiveAcls = await getEffectiveFolderAcls(db, id, principals);
    
    if (effectiveAcls.length > 0) {
      // Merge permissions from all ACLs
      const allPermissionSets = effectiveAcls.map(acl => acl.permissions);
      const mergedPermissions = mergePermissions(allPermissionSets);
      
      // Determine permission level based on merged permissions
      if (mergedPermissions.includes('DELETE')) {
        permissionLevel = 'full';
      } else if (mergedPermissions.includes('READ_WRITE')) {
        permissionLevel = 'read_write';
      } else if (mergedPermissions.includes('READ_ONLY')) {
        permissionLevel = 'read_only';
      }
    } else if (isOwner && vault?.type === 'personal') {
      // Personal vault owner has full access (no ACL needed - it's their vault)
      permissionLevel = 'full';
    } else if (isAdmin && vault?.type === 'shared') {
      // Admins get full access to shared vaults by default (even without explicit ACLs)
      permissionLevel = 'full';
    }
    
    // Use checkFolderAccess for the boolean flags (for backward compatibility)
    const deleteCheck = await checkFolderAccess(db, id, user, { requiredPermissions: ['DELETE'] });
    const writeCheck = await checkFolderAccess(db, id, user, { requiredPermissions: ['READ_WRITE'] });
    
    return NextResponse.json({
      ...folder,
      canDelete: deleteCheck.hasAccess,
      canShare: writeCheck.hasAccess, // Sharing requires READ_WRITE permission
      canEdit: writeCheck.hasAccess,
      permissionLevel, // User's permission level for this folder (based on ACLs first, then owner/admin)
    });
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

    // Check if user has READ_WRITE permission
    const accessCheck = await checkFolderAccess(db, id, user, { requiredPermissions: ['READ_WRITE'] });
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

