// src/server/api/acl.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultAcls, vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, desc, and } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/vault/acl
 * List ACLs for a specific resource
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const resourceType = searchParams.get('resource_type');
    const resourceId = searchParams.get('resource_id');

    if (!resourceType || !resourceId) {
      return NextResponse.json(
        { error: 'Missing required parameters: resource_type and resource_id' },
        { status: 400 }
      );
    }

    // Check if user has MANAGE_ACL permission on the resource (required to view ACLs)
    if (resourceType === 'folder') {
      const { checkFolderAccess } = await import('../lib/acl-utils');
      const accessCheck = await checkFolderAccess(db, resourceId, user, { requiredPermissions: ['MANAGE_ACL'] });
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions to view ACLs') }, { status: 403 });
      }
    } else if (resourceType === 'vault') {
      const { checkVaultAccess } = await import('../lib/acl-utils');
      const accessCheck = await checkVaultAccess(db, resourceId, user, ['MANAGE_ACL']);
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions to view ACLs') }, { status: 403 });
      }
    }

    // Build conditions
    const conditions = [
      eq(vaultAcls.resourceType, resourceType),
      eq(vaultAcls.resourceId, resourceId),
    ];

    const items = await db
      .select()
      .from(vaultAcls)
      .where(and(...conditions))
      .orderBy(desc(vaultAcls.createdAt));

    return NextResponse.json({ items });
  } catch (error) {
    console.error('[vault] List ACL error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ACLs' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/vault/acl
 * Create ACL entry
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Validate required fields
    if (!body.resourceType || !body.resourceId || !body.principalType || !body.principalId || !body.permissions) {
      return NextResponse.json(
        { error: 'Missing required fields: resourceType, resourceId, principalType, principalId, permissions' },
        { status: 400 }
      );
    }
    
    // Check if user has MANAGE_ACL permission on the resource (required to manage ACLs)
    if (body.resourceType === 'folder') {
      // Verify folder is a root folder (no parentId) - only root folders can have ACLs
      const [folder] = await db
        .select()
        .from(vaultFolders)
        .where(eq(vaultFolders.id, body.resourceId))
        .limit(1);
      
      if (!folder) {
        return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
      }
      
      if (folder.parentId) {
        return NextResponse.json({ error: 'Access permissions can only be set on root folders (folders without a parent)' }, { status: 400 });
      }
      
      const { checkFolderAccess } = await import('../lib/acl-utils');
      const accessCheck = await checkFolderAccess(db, body.resourceId, user, { requiredPermissions: ['MANAGE_ACL'] });
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions to manage ACLs') }, { status: 403 });
      }
    } else if (body.resourceType === 'vault') {
      const { checkVaultAccess } = await import('../lib/acl-utils');
      const accessCheck = await checkVaultAccess(db, body.resourceId, user, ['MANAGE_ACL']);
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions to manage ACLs') }, { status: 403 });
      }
    }

    const result = await db.insert(vaultAcls).values({
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      principalType: body.principalType,
      principalId: body.principalId,
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
      inherit: false, // No inheritance allowed - only root folders can have ACLs
      createdBy: user.sub,
    }).returning();

    return NextResponse.json(result[0], { status: 201 });
  } catch (error) {
    console.error('[vault] Create ACL error:', error);
    return NextResponse.json(
      { error: 'Failed to create ACL' },
      { status: 500 }
    );
  }
}

