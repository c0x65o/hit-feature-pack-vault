// src/server/api/acl.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultAcls } from '@/lib/feature-pack-schemas';
import { eq, desc, sql, and } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { checkFolderAccess, checkVaultAccess } from '../lib/acl-utils';

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

    // Build conditions
    const conditions = [];
    if (resourceType) {
      conditions.push(eq(vaultAcls.resourceType, resourceType));
    }
    if (resourceId) {
      conditions.push(eq(vaultAcls.resourceId, resourceId));
    }

    // TODO: Add access control - verify user has SHARE permission on the resource
    const items = await db
      .select()
      .from(vaultAcls)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
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

    // Verify user has SHARE permission on the resource
    if (body.resourceType === 'folder') {
      const accessCheck = await checkFolderAccess(db, body.resourceId, user, { requiredPermissions: ['SHARE'] });
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
      }
    } else if (body.resourceType === 'vault') {
      const accessCheck = await checkVaultAccess(db, body.resourceId, user, ['SHARE']);
      if (!accessCheck.hasAccess) {
        return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
      }
    }
    // TODO: Add item ACL checking

    const result = await db.insert(vaultAcls).values({
      resourceType: body.resourceType,
      resourceId: body.resourceId,
      principalType: body.principalType,
      principalId: body.principalId,
      permissions: Array.isArray(body.permissions) ? body.permissions : [],
      inherit: body.inherit !== undefined ? body.inherit : true,
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

