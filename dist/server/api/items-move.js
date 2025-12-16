// src/server/api/items-move.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
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
        const userId = getUserId(request);
        if (!userId) {
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
        // Verify user owns the vault
        const [vault] = await db
            .select()
            .from(vaultVaults)
            .where(and(eq(vaultVaults.id, existing.vaultId), eq(vaultVaults.ownerUserId, userId)))
            .limit(1);
        if (!vault) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // If folderId provided, verify it exists in the same vault
        if (folderId) {
            const [folder] = await db
                .select()
                .from(vaultFolders)
                .where(and(eq(vaultFolders.id, folderId), eq(vaultFolders.vaultId, existing.vaultId)))
                .limit(1);
            if (!folder) {
                return NextResponse.json({ error: 'Folder not found' }, { status: 404 });
            }
        }
        const [item] = await db
            .update(vaultItems)
            .set({
            folderId: folderId,
            updatedAt: new Date(),
            updatedBy: userId,
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
