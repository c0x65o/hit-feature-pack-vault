// src/server/api/vaults-id.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultVaults } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkVaultAccess } from '../lib/acl-utils';
import { resolveVaultScopeMode } from '../lib/scope-mode';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
// Note: For [id] routes, the id comes from the URL path
// Next.js passes it via context, but we extract from URL for portability
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/vault/vaults/{id} -> id is last part
    return parts[parts.length - 1] || null;
}
/**
 * GET /api/vault/vaults/[id]
 */
export async function GET(request) {
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
        // Check read permission and resolve scope mode
        const mode = await resolveVaultScopeMode(request, { entity: 'vaults', verb: 'read' });
        if (mode === 'none') {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Get vault to check ownership
        const [vault] = await db
            .select()
            .from(vaultVaults)
            .where(eq(vaultVaults.id, id))
            .limit(1);
        if (!vault) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Apply scope mode filtering (explicit branching on none/own/ldd/any)
        const userId = getUserId(request);
        if (mode === 'own' || mode === 'ldd') {
            // Only allow access to personal vaults owned by user
            if (!(vault.ownerUserId === userId && vault.type === 'personal')) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        }
        else if (mode === 'any') {
            // Allow access if user owns personal vault OR has ACL access
            const isPersonalOwner = vault.ownerUserId === userId && vault.type === 'personal';
            if (!isPersonalOwner) {
                // Check ACL access for shared vaults
                const accessCheck = await checkVaultAccess(db, id, user);
                if (!accessCheck.hasAccess) {
                    return NextResponse.json({ error: 'Not found' }, { status: 404 });
                }
            }
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
    }
    catch (error) {
        console.error('[vault] Get error:', error);
        return NextResponse.json({ error: 'Failed to fetch vault' }, { status: 500 });
    }
}
/**
 * PUT /api/vault/vaults/[id]
 */
export async function PUT(request) {
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
        // Check write permission and resolve scope mode
        const mode = await resolveVaultScopeMode(request, { entity: 'vaults', verb: 'write' });
        if (mode === 'none') {
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
        const vault = existing[0];
        const userId = getUserId(request);
        // Apply scope mode filtering (explicit branching on none/own/ldd/any)
        if (mode === 'own' || mode === 'ldd') {
            // Only allow updating personal vaults owned by user
            if (!(vault.ownerUserId === userId && vault.type === 'personal')) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }
        else if (mode === 'any') {
            // Allow update if user owns personal vault OR has ACL write access
            const isPersonalOwner = vault.ownerUserId === userId && vault.type === 'personal';
            if (!isPersonalOwner) {
                // Check ACL write access for shared vaults
                const accessCheck = await checkVaultAccess(db, id, user, ['READ_WRITE']);
                if (!accessCheck.hasAccess) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
            }
        }
        // Update fields (only allow certain fields to be updated)
        const updateData = {
            updatedAt: new Date(),
        };
        if (body.name !== undefined)
            updateData.name = body.name;
        if (body.ownerOrgId !== undefined)
            updateData.ownerOrgId = body.ownerOrgId;
        if (body.encryptionKeyVersion !== undefined)
            updateData.encryptionKeyVersion = body.encryptionKeyVersion;
        const result = await db
            .update(vaultVaults)
            .set(updateData)
            .where(eq(vaultVaults.id, id))
            .returning();
        return NextResponse.json(result[0]);
    }
    catch (error) {
        console.error('[vault] Update error:', error);
        return NextResponse.json({ error: 'Failed to update vault' }, { status: 500 });
    }
}
/**
 * DELETE /api/vault/vaults/[id]
 */
export async function DELETE(request) {
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
        // Check delete permission and resolve scope mode
        const mode = await resolveVaultScopeMode(request, { entity: 'vaults', verb: 'delete' });
        if (mode === 'none') {
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
        const vault = existing[0];
        const userId = getUserId(request);
        // Apply scope mode filtering (explicit branching on none/own/ldd/any)
        if (mode === 'own' || mode === 'ldd') {
            // Only allow deleting personal vaults owned by user
            if (!(vault.ownerUserId === userId && vault.type === 'personal')) {
                return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
            }
        }
        else if (mode === 'any') {
            // Allow delete if user owns personal vault OR has ACL delete access
            const isPersonalOwner = vault.ownerUserId === userId && vault.type === 'personal';
            if (!isPersonalOwner) {
                // Check ACL delete access for shared vaults
                const accessCheck = await checkVaultAccess(db, id, user, ['DELETE']);
                if (!accessCheck.hasAccess) {
                    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
                }
            }
        }
        await db
            .delete(vaultVaults)
            .where(eq(vaultVaults.id, id));
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Delete error:', error);
        return NextResponse.json({ error: 'Failed to delete vault' }, { status: 500 });
    }
}
