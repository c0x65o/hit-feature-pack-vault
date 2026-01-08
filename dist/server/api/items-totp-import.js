// src/server/api/items-totp-import.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkItemAccess } from '../lib/acl-utils';
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
        const qrCode = body.qrCode || body.otpauthUri;
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
        // Verify user has READ_WRITE access via ACL check (importing TOTP modifies the item)
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const accessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['READ_WRITE'] });
        if (!accessCheck.hasAccess) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Parse TOTP secret from QR code URI or manual secret
        const { parseTotpUri } = await import('../utils/totp');
        const { encrypt } = await import('../utils/encryption');
        let totpSecret = null;
        if (body.qrCode) {
            // Try to parse as otpauth:// URI
            totpSecret = parseTotpUri(body.qrCode);
            if (!totpSecret && body.qrCode.match(/^[A-Z2-7]+=*$/i)) {
                // If it's just a base32 string, use it directly
                totpSecret = body.qrCode.toUpperCase();
            }
        }
        else if (body.secret) {
            // Manual secret entry (base32)
            totpSecret = body.secret.toUpperCase();
        }
        if (!totpSecret) {
            return NextResponse.json({ error: 'Invalid TOTP secret or QR code' }, { status: 400 });
        }
        // Decrypt existing secret blob, add TOTP secret, re-encrypt
        const { decrypt } = await import('../utils/encryption');
        let secretBlob = {};
        try {
            if (item.secretBlobEncrypted) {
                secretBlob = JSON.parse(decrypt(item.secretBlobEncrypted));
            }
        }
        catch (error) {
            // If decryption fails, start with empty blob
            console.warn('[vault] Failed to decrypt existing secret blob, starting fresh');
        }
        // Add TOTP secret to blob
        secretBlob.totpSecret = totpSecret;
        // Re-encrypt and update item
        const encryptedBlob = encrypt(JSON.stringify(secretBlob));
        await db.update(vaultItems)
            .set({
            secretBlobEncrypted: encryptedBlob,
            updatedBy: userId,
            updatedAt: new Date(),
        })
            .where(eq(vaultItems.id, id));
        return NextResponse.json({ success: true });
    }
    catch (error) {
        console.error('[vault] Import TOTP error:', error);
        return NextResponse.json({ error: 'Failed to import TOTP secret' }, { status: 500 });
    }
}
