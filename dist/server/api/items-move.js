// src/server/api/items-move.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { checkItemAccess, checkFolderAccess } from '../lib/acl-utils';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const idIndex = parts.indexOf('items') + 1;
    return parts[idIndex] || null;
}
/**
 * POST /api/vault/items/[id]/move
 * Move item to new folder
 */
export async function POST(request) {
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
        // Check if user has full access (MANAGE_ACL) or is admin - only full access users/admins can move items
        const itemAccessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['MANAGE_ACL'] });
        if (!itemAccessCheck.hasAccess) {
            return NextResponse.json({ error: 'Forbidden: ' + (itemAccessCheck.reason || 'Only users with full access or admins can move items') }, { status: 403 });
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
            // Check if user has READ_WRITE access to the target folder (via ACL)
            const folderAccessCheck = await checkFolderAccess(db, folderId, user, { requiredPermissions: ['READ_WRITE'] });
            if (!folderAccessCheck.hasAccess) {
                return NextResponse.json({ error: 'Forbidden: No write access to target folder' }, { status: 403 });
            }
            // Get target vault
            const [targetVault] = await db
                .select()
                .from(vaultVaults)
                .where(eq(vaultVaults.id, folder.vaultId))
                .limit(1);
            if (!targetVault) {
                return NextResponse.json({ error: 'Target vault not found' }, { status: 404 });
            }
            // If moving to personal vault, verify user owns it
            if (targetVault.type === 'personal' && targetVault.ownerUserId !== user.sub) {
                return NextResponse.json({ error: 'Forbidden: You do not own the target personal vault' }, { status: 403 });
            }
            // When moving to a folder in a different vault, update the item's vaultId
            targetVaultId = folder.vaultId;
        }
        else {
            // Moving to root - if moving to a different vault's root, verify access
            // Since folderId is null, we're moving to root of existing vault, which is fine
            // The access check above already verified user has READ_WRITE on the item
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
    }
    catch (error) {
        console.error('[vault] Move item error:', error);
        return NextResponse.json({ error: 'Failed to move item' }, { status: 500 });
    }
}
