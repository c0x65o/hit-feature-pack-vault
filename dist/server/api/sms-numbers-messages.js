// src/server/api/sms-numbers-messages.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, and, desc } from 'drizzle-orm';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
function extractId(request) {
    const url = new URL(request.url);
    const parts = url.pathname.split('/');
    // /api/vault/sms/numbers/{id}/messages -> id is second to last before messages
    const idIndex = parts.indexOf('numbers') + 1;
    return parts[idIndex] || null;
}
/**
 * GET /api/vault/sms/numbers/[id]/messages
 * List messages for SMS number
 */
export async function GET(request) {
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
        // Get SMS number
        const [smsNumber] = await db
            .select()
            .from(vaultSmsNumbers)
            .where(eq(vaultSmsNumbers.id, id))
            .limit(1);
        if (!smsNumber) {
            return NextResponse.json({ error: 'Not found' }, { status: 404 });
        }
        // Verify user owns the vault the SMS number belongs to
        if (smsNumber.vaultId) {
            const [vault] = await db
                .select()
                .from(vaultVaults)
                .where(and(eq(vaultVaults.id, smsNumber.vaultId), eq(vaultVaults.ownerUserId, userId)))
                .limit(1);
            if (!vault) {
                return NextResponse.json({ error: 'Not found' }, { status: 404 });
            }
        }
        const messages = await db
            .select()
            .from(vaultSmsMessages)
            .where(eq(vaultSmsMessages.smsNumberId, id))
            .orderBy(desc(vaultSmsMessages.receivedAt));
        return NextResponse.json({ items: messages });
    }
    catch (error) {
        console.error('[vault] List SMS messages error:', error);
        return NextResponse.json({ error: 'Failed to fetch SMS messages' }, { status: 500 });
    }
}
