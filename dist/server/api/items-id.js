// src/server/api/items-id.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultFolders } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { extractUserFromRequest } from '../auth';
import { checkItemAccess } from '../lib/acl-utils';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    return parts[parts.length - 1] || null;
}
/**
 * Get item if user has access (via ACL check)
 */
async function getItemIfAccessible(db, itemId, user) {
    if (!user)
        return null;
    // Check ACL access
    const accessCheck = await checkItemAccess(db, itemId, user);
    if (!accessCheck.hasAccess) {
        return null;
    }
    // Get item if access is granted
    const [item] = await db
        .select()
        .from(vaultItems)
        .where(eq(vaultItems.id, itemId))
        .limit(1);
    return item;
}
/**
 * GET /api/vault/items/[id]
 * Get item metadata (excludes encrypted secrets - use /reveal for that)
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
        const item = await getItemIfAccessible(db, id, user);
        if (!item) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Return item without encrypted secret blob
        const { secretBlobEncrypted, ...safeItem } = item;
        return NextResponse.json(safeItem);
    }
    catch (error) {
        console.error('[vault] Get item error:', error);
        return NextResponse.json({ error: 'Failed to fetch item' }, { status: 500 });
    }
}
/**
 * PUT /api/vault/items/[id]
 * Update item metadata and/or secrets
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
        // Check if user has READ_WRITE permission
        const accessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['READ_WRITE'] });
        if (!accessCheck.hasAccess) {
            return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
        }
        const existing = await getItemIfAccessible(db, id, user);
        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        if (existing.type === 'credential' &&
            body.url !== undefined &&
            !String(body.url ?? '').trim()) {
            return NextResponse.json({ error: 'URL is required for Login items' }, { status: 400 });
        }
        const updateData = {
            updatedAt: new Date(),
            updatedBy: user.sub,
        };
        // Update metadata fields
        if (body.title !== undefined)
            updateData.title = body.title;
        if (body.username !== undefined)
            updateData.username = body.username;
        if (body.url !== undefined)
            updateData.url = body.url;
        if (body.tags !== undefined)
            updateData.tags = body.tags;
        if (body.folderId !== undefined) {
            updateData.folderId = body.folderId;
            // CRITICAL: If folderId changes, ensure vaultId matches the folder's vault
            // Items must always be in the same vault as their folder
            if (body.folderId) {
                const [folder] = await db
                    .select({ vaultId: vaultFolders.vaultId })
                    .from(vaultFolders)
                    .where(eq(vaultFolders.id, body.folderId))
                    .limit(1);
                if (folder && folder.vaultId !== existing.vaultId) {
                    // Update vaultId to match folder's vault
                    updateData.vaultId = folder.vaultId;
                }
            }
            else {
                // Moving to root - keep existing vaultId (root items stay in their vault)
            }
        }
        // Update secret if provided (re-encrypt)
        if (body.password !== undefined || body.notes !== undefined || body.secret !== undefined || body.twoFactorType !== undefined) {
            // Get existing secret blob to preserve TOTP secret and other fields
            const { decrypt, encrypt } = await import('../utils/encryption');
            let secretData = {};
            // Try to decrypt existing secret blob to preserve TOTP secret and other fields
            try {
                if (existing.secretBlobEncrypted) {
                    secretData = JSON.parse(decrypt(existing.secretBlobEncrypted));
                }
            }
            catch (err) {
                // If decryption fails (e.g., old format), start fresh
                console.warn('[vault] Failed to decrypt existing secret blob, starting fresh:', err);
                secretData = {};
            }
            // Update fields that were provided
            if (body.password !== undefined) {
                secretData.password = body.password;
            }
            if (body.notes !== undefined) {
                secretData.notes = body.notes;
            }
            if (body.secret !== undefined) {
                // For API keys, secret goes in password field
                secretData.password = body.secret;
            }
            if (body.twoFactorType !== undefined) {
                secretData.twoFactorType = body.twoFactorType;
            }
            // Encrypt the updated secret blob
            updateData.secretBlobEncrypted = encrypt(JSON.stringify(secretData));
            updateData.secretVersion = (existing.secretVersion || 1) + 1;
        }
        const [item] = await db
            .update(vaultItems)
            .set(updateData)
            .where(eq(vaultItems.id, id))
            .returning();
        // Return without encrypted secret
        const { secretBlobEncrypted, ...safeItem } = item;
        return NextResponse.json(safeItem);
    }
    catch (error) {
        console.error('[vault] Update item error:', error);
        return NextResponse.json({ error: 'Failed to update item' }, { status: 500 });
    }
}
/**
 * DELETE /api/vault/items/[id]
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
        // Check if user has DELETE permission
        const accessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['DELETE'] });
        if (!accessCheck.hasAccess) {
            return NextResponse.json({ error: 'Forbidden: ' + (accessCheck.reason || 'Insufficient permissions') }, { status: 403 });
        }
        const existing = await getItemIfAccessible(db, id, user);
        if (!existing) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        await db.delete(vaultItems).where(eq(vaultItems.id, id));
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Delete item error:', error);
        return NextResponse.json({ error: 'Failed to delete item' }, { status: 500 });
    }
}
