// src/server/api/items-copy.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults, vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const idIndex = parts.indexOf('items') + 1;
    return parts[idIndex] || null;
}
/**
 * POST /api/vault/items/[id]/copy
 * Copy password to clipboard (audited)
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
            .where(and(eq(vaultVaults.id, item.vaultId), eq(vaultVaults.ownerUserId, userId)))
            .limit(1);
        if (!vault) {
            // TODO: Check ACL for shared vault access
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // TODO: Implement copy logic and audit event
        // Create audit event for copy action
        await db.insert(vaultAuditEvents).values({
            actorUserId: userId,
            action: 'ITEM_COPY_PASSWORD',
            resourceType: 'item',
            resourceId: id,
            success: true,
        });
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Copy item error:', error);
        return NextResponse.json({ error: 'Failed to copy item' }, { status: 500 });
    }
}
