// src/server/api/items-totp-import.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults } from '@/lib/feature-pack-schemas';
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
 * POST /api/vault/items/[id]/totp/import
 * Import TOTP secret (QR or manual)
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
        const secret = body.secret;
        const qrCode = body.qrCode;
        if (!secret && !qrCode) {
            return NextResponse.json({ error: 'secret or qrCode is required' }, { status: 400 });
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
        // TODO: Implement TOTP secret import and encryption
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Import TOTP error:', error);
        return NextResponse.json({ error: 'Failed to import TOTP secret' }, { status: 500 });
    }
}
