// src/server/api/items-totp-code.ts
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
 * POST /api/vault/items/[id]/totp/code
 * Generate TOTP code (audited)
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
        // Create audit event for TOTP code generation
        await db.insert(vaultAuditEvents).values({
            actorUserId: userId,
            action: 'ITEM_GENERATE_TOTP',
            resourceType: 'item',
            resourceId: id,
            success: true,
        });
        // Decrypt the secret blob to get TOTP secret
        try {
            const { decrypt } = await import('../utils/encryption');
            const secretBlob = JSON.parse(decrypt(item.secretBlobEncrypted));
            const totpSecret = secretBlob.totpSecret;
            if (!totpSecret) {
                return NextResponse.json({ error: 'TOTP secret not found for this item' }, { status: 400 });
            }
            // Generate TOTP code using pyotp-compatible algorithm
            // Using the same algorithm as Python's pyotp library
            const { generateTotpCode } = await import('../utils/totp');
            const code = generateTotpCode(totpSecret);
            return NextResponse.json({
                code: code,
                expiresAt: new Date(Date.now() + 30000), // 30 seconds (TOTP codes refresh every 30s)
            });
        }
        catch (error) {
            console.error('[vault] TOTP generation error:', error);
            return NextResponse.json({ error: 'Failed to generate TOTP code' }, { status: 500 });
        }
    }
    catch (error) {
        console.error('[vault] Generate TOTP code error:', error);
        return NextResponse.json({ error: 'Failed to generate TOTP code' }, { status: 500 });
    }
}
