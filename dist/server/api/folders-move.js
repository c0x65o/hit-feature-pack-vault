// src/server/api/folders-move.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultFolders, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/vault/folders/{id}/move -> id is second to last
    const idIndex = parts.indexOf('folders') + 1;
    return parts[idIndex] || null;
}
/**
 * POST /api/vault/folders/[id]/move
 * Move folder to new parent
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
        const parentId = body.parentId || null;
        // Get folder and verify user owns the vault it belongs to
        const [existing] = await db
            .select()
            .from(vaultFolders)
            .where(eq(vaultFolders.id, id))
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
        // If parentId provided, verify it exists in the same vault
        if (parentId) {
            const [parent] = await db
                .select()
                .from(vaultFolders)
                .where(and(eq(vaultFolders.id, parentId), eq(vaultFolders.vaultId, existing.vaultId)))
                .limit(1);
            if (!parent) {
                return NextResponse.json({ error: 'Parent folder not found' }, { status: 404 });
            }
        }
        // Update folder - vaultFolders doesn't have updatedAt field
        const [item] = await db
            .update(vaultFolders)
            .set({
            parentId: parentId,
            // Note: vaultFolders doesn't have updatedAt field per schema
        })
            .where(eq(vaultFolders.id, id))
            .returning();
        return NextResponse.json(item);
    }
    catch (error) {
        console.error('[vault] Move folder error:', error);
        return NextResponse.json({ error: 'Failed to move folder' }, { status: 500 });
    }
}
