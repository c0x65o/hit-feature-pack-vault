// src/server/api/vaults-id.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultVaults } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkVaultAccess } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// Note: For [id] routes, the id comes from the URL path
// Next.js passes it via context, but we extract from URL for portability
function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/vault/vaults/{id} -> id is last part
  return parts[parts.length - 1] || null;
}

/**
 * GET /api/vault/vaults/[id]
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

    // Check access via ACL
    const accessCheck = await checkVaultAccess(db, id, user);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const result = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, id))
      .limit(1);

    const item = result[0];
    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json(item);
  } catch (error) {
    console.error('[vault] Get error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch vault' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/vault/vaults/[id]
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

    // Verify user has READ_WRITE access via ACL
    const accessCheck = await checkVaultAccess(db, id, user, ['READ_WRITE']);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, id))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Update fields (only allow certain fields to be updated)
    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };

    if (body.name !== undefined) updateData.name = body.name;
    if (body.ownerOrgId !== undefined) updateData.ownerOrgId = body.ownerOrgId;
    if (body.encryptionKeyVersion !== undefined) updateData.encryptionKeyVersion = body.encryptionKeyVersion;

    const result = await db
      .update(vaultVaults)
      .set(updateData)
      .where(eq(vaultVaults.id, id))
      .returning();

    return NextResponse.json(result[0]);
  } catch (error) {
    console.error('[vault] Update error:', error);
    return NextResponse.json(
      { error: 'Failed to update vault' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/vault/vaults/[id]
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

    // Verify user has DELETE access via ACL
    const accessCheck = await checkVaultAccess(db, id, user, ['DELETE']);
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const existing = await db
      .select()
      .from(vaultVaults)
      .where(eq(vaultVaults.id, id))
      .limit(1);

    if (!existing[0]) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    await db
      .delete(vaultVaults)
      .where(eq(vaultVaults.id, id));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] Delete error:', error);
    return NextResponse.json(
      { error: 'Failed to delete vault' },
      { status: 500 }
    );
  }
}

