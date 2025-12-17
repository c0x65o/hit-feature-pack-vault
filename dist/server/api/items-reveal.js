// src/server/api/items-reveal.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults, vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkItemAccess } from '../lib/acl-utils';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/vault/items/{id}/reveal -> id is second to last
    const idIndex = parts.indexOf('items') + 1;
    return parts[idIndex] || null;
}
/**
 * POST /api/vault/items/[id]/reveal
 * Reveal decrypted password/secret (audited)
 */
export async function POST(request) {
    try {
        const db = getDb();
        const id = extractId(request);
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Get item
        const [item] = await db
            .select()
            .from(vaultItems)
            .where(eq(vaultItems.id, id))
            .limit(1);
        if (!item) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Verify user owns the vault or has ACL access
        const [vault] = await db
            .select()
            .from(vaultVaults)
            .where(eq(vaultVaults.id, item.vaultId))
            .limit(1);
        if (!vault) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Check if user owns a PERSONAL vault (only personal vault owners have automatic access)
        const isPersonalVaultOwner = vault.ownerUserId === userId && vault.type === 'personal';
        // For shared vaults, everyone (including "owners") needs ACL access
        let hasAclAccess = false;
        if (!isPersonalVaultOwner) {
            const user = extractUserFromRequest(request);
            if (user) {
                // checkItemAccess handles admin access internally
                const accessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['READ_ONLY'] });
                hasAclAccess = accessCheck.hasAccess;
            }
        }
        if (!isPersonalVaultOwner && !hasAclAccess) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Create audit event for reveal action
        await db.insert(vaultAuditEvents).values({
            actorUserId: userId,
            action: 'ITEM_REVEAL_PASSWORD',
            resourceType: 'item',
            resourceId: id,
            success: true,
        });
        // Decrypt the secret blob
        try {
            const { decrypt } = await import('../utils/encryption');
            const secretBlob = JSON.parse(decrypt(item.secretBlobEncrypted));
            return NextResponse.json({
                password: secretBlob.password || null,
                secret: secretBlob.secret || secretBlob.password || null, // For API keys
                notes: secretBlob.notes || null,
                totpSecret: secretBlob.totpSecret || null,
                // Don't expose recovery codes or other sensitive data
            });
        }
        catch (error) {
            console.error('[vault] Decryption error:', error);
            return NextResponse.json({ error: 'Failed to decrypt item' }, { status: 500 });
        }
    }
    catch (error) {
        console.error('[vault] Reveal item error:', error);
        return NextResponse.json({ error: 'Failed to reveal item' }, { status: 500 });
    }
}
