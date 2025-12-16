// src/server/api/items-sms-request.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultVaults, vaultSmsNumbers, vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq, and, isNull } from 'drizzle-orm';
import { getUserId } from '../auth';
import { sendSms } from '../utils/twilio-sms';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    const idIndex = parts.indexOf('items') + 1;
    return parts[idIndex] || null;
}
/**
 * POST /api/vault/items/[id]/sms/request
 * Send SMS to request 2FA code for a vault item
 *
 * This sends an SMS to the configured phone number requesting a 2FA code.
 * The user should then receive the 2FA code via SMS (from the service),
 * which will be captured by the inbound webhook.
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
        // Check if SMS 2FA is configured for this item
        // Look for SMS number associated with this item or global SMS number
        const [itemSmsNumber] = await db
            .select()
            .from(vaultSmsNumbers)
            .where(and(eq(vaultSmsNumbers.itemId, id), eq(vaultSmsNumbers.status, 'active')))
            .limit(1);
        // Fall back to global SMS number if no item-specific number
        const [globalSmsNumber] = itemSmsNumber ? [] : await db
            .select()
            .from(vaultSmsNumbers)
            .where(and(isNull(vaultSmsNumbers.vaultId), isNull(vaultSmsNumbers.itemId), eq(vaultSmsNumbers.status, 'active')))
            .limit(1);
        const smsNumber = itemSmsNumber || globalSmsNumber;
        if (!smsNumber) {
            return NextResponse.json({ error: 'No SMS number configured. Please configure a phone number in vault settings.' }, { status: 400 });
        }
        // Check if SMS 2FA is enabled (from feature pack config)
        const sms2faEnabled = process.env.VAULT_SMS_2FA_ENABLED !== 'false';
        if (!sms2faEnabled) {
            return NextResponse.json({ error: 'SMS 2FA is disabled' }, { status: 400 });
        }
        // Get user's phone number from request body
        const body = await request.json().catch(() => ({}));
        const userPhoneNumber = body.phoneNumber;
        if (!userPhoneNumber) {
            return NextResponse.json({ error: 'Phone number is required. Please provide your phone number in E.164 format (e.g., +1234567890)' }, { status: 400 });
        }
        // Validate E.164 format
        if (!userPhoneNumber.startsWith('+')) {
            return NextResponse.json({ error: 'Phone number must be in E.164 format (e.g., +1234567890)' }, { status: 400 });
        }
        // Create SMS message requesting 2FA code
        const smsBody = `Please send your 2FA code for ${item.title || 'this service'}. Reply to this number with your verification code.`;
        // Send SMS via CAC API or direct Twilio (fallback)
        const result = await sendSms({
            to: userPhoneNumber,
            body: smsBody,
        });
        // Create audit event
        await db.insert(vaultAuditEvents).values({
            actorUserId: userId,
            action: 'ITEM_REQUEST_SMS_2FA',
            resourceType: 'item',
            resourceId: id,
            success: result.success,
            metadata: result.success
                ? {
                    messageSid: result.messageSid,
                    to: userPhoneNumber,
                    status: result.status,
                }
                : {
                    error: result.error,
                    to: userPhoneNumber,
                },
        });
        if (!result.success) {
            console.error('[vault] Failed to send SMS:', result.error);
            return NextResponse.json({
                error: 'Failed to send SMS',
                detail: result.error,
            }, { status: 500 });
        }
        return NextResponse.json({
            success: true,
            messageSid: result.messageSid,
            status: result.status,
            message: 'SMS request sent successfully. Please check your phone for the 2FA code.',
        });
    }
    catch (error) {
        console.error('[vault] Request SMS 2FA error:', error);
        return NextResponse.json({ error: 'Failed to request SMS 2FA code' }, { status: 500 });
    }
}
