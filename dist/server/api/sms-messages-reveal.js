// src/server/api/sms-messages-reveal.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers, vaultVaults, vaultAuditEvents, vaultItems } from '@/lib/feature-pack-schemas';
import { eq, and, ilike } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkItemAccess } from '../lib/acl-utils';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/vault/sms/messages/{id}/reveal -> id is after 'messages'
    const messagesIndex = parts.indexOf('messages');
    if (messagesIndex === -1 || messagesIndex + 1 >= parts.length) {
        return null;
    }
    return parts[messagesIndex + 1] || null;
}
/**
 * POST /api/vault/sms/messages/[id]/reveal
 * Reveal SMS message body (audited)
 */
export async function POST(request) {
    try {
        const db = getDb();
        const id = extractId(request);
        if (!id) {
            return NextResponse.json({ error: 'Missing id' }, { status: 400 });
        }
        // Validate UUID format
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(id)) {
            console.error('[vault] Invalid UUID format:', id);
            return NextResponse.json({ error: 'Invalid message id format' }, { status: 400 });
        }
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const [message] = await db
            .select()
            .from(vaultSmsMessages)
            .where(eq(vaultSmsMessages.id, id))
            .limit(1);
        if (!message) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Get the SMS number for this message
        const [smsNumber] = await db
            .select()
            .from(vaultSmsNumbers)
            .where(eq(vaultSmsNumbers.id, message.smsNumberId))
            .limit(1);
        if (!smsNumber) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Get user for permission checks
        const user = extractUserFromRequest(request);
        if (!user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        // Check if message is email or SMS
        const isEmail = message.metadataEncrypted &&
            typeof message.metadataEncrypted === 'object' &&
            'type' in message.metadataEncrypted &&
            message.metadataEncrypted.type === 'email';
        let hasAccess = false;
        if (isEmail) {
            // For email messages: check if user has READ_ONLY access to any item with matching username
            const emailAddress = message.toNumber;
            if (emailAddress) {
                const matchingItems = await db
                    .select({ id: vaultItems.id })
                    .from(vaultItems)
                    .where(ilike(vaultItems.username, emailAddress));
                // Check access to at least one matching item
                for (const item of matchingItems) {
                    const accessCheck = await checkItemAccess(db, item.id, user, { requiredPermissions: ['READ_ONLY'] });
                    if (accessCheck.hasAccess) {
                        hasAccess = true;
                        break;
                    }
                }
            }
        }
        else {
            // For SMS messages: check via smsNumber.itemId
            if (smsNumber.itemId) {
                const accessCheck = await checkItemAccess(db, smsNumber.itemId, user, { requiredPermissions: ['READ_ONLY'] });
                hasAccess = accessCheck.hasAccess;
            }
            else {
                // Legacy: if no itemId, check vault ownership (backward compatibility)
                if (smsNumber.vaultId) {
                    const [vault] = await db
                        .select()
                        .from(vaultVaults)
                        .where(and(eq(vaultVaults.id, smsNumber.vaultId), eq(vaultVaults.ownerUserId, userId)))
                        .limit(1);
                    hasAccess = !!vault;
                }
            }
        }
        if (!hasAccess) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Create audit event for SMS read action
        await db.insert(vaultAuditEvents).values({
            actorUserId: userId,
            action: 'SMS_READ_MESSAGE',
            resourceType: 'sms_message',
            resourceId: id,
            success: true,
        });
        // Decrypt the message body
        try {
            const { decrypt } = await import('../utils/encryption');
            const decryptedBody = decrypt(message.bodyEncrypted);
            return NextResponse.json({
                body: decryptedBody,
            });
        }
        catch (error) {
            console.error('[vault] Decryption error:', error);
            return NextResponse.json({ error: 'Failed to decrypt message' }, { status: 500 });
        }
    }
    catch (error) {
        console.error('[vault] Reveal SMS message error:', error);
        return NextResponse.json({ error: 'Failed to reveal SMS message' }, { status: 500 });
    }
}
