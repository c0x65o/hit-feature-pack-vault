// src/server/api/sms-messages-latest.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers, vaultVaults } from '@/lib/feature-pack-schemas';
import { eq, desc, and, gte, sql } from 'drizzle-orm';
import { getUserId } from '../auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * GET /api/vault/sms/messages/latest
 * Get latest SMS messages (metadataEncrypted.type === 'sms').
 *
 * Query params:
 * - since: ISO timestamp; return messages received at/after this time.
 */
export async function GET(request) {
    try {
        const db = getDb();
        const userId = getUserId(request);
        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const since = searchParams.get('since');
        const conditions = [sql `${vaultSmsMessages.metadataEncrypted}->>'type' = 'sms'`];
        if (since) {
            const sinceDate = new Date(since);
            if (!isNaN(sinceDate.getTime())) {
                conditions.push(gte(vaultSmsMessages.receivedAt, sinceDate));
            }
        }
        // Load recent SMS messages
        const messages = await db
            .select({
            id: vaultSmsMessages.id,
            smsNumberId: vaultSmsMessages.smsNumberId,
            fromNumber: vaultSmsMessages.fromNumber,
            toNumber: vaultSmsMessages.toNumber,
            receivedAt: vaultSmsMessages.receivedAt,
        })
            .from(vaultSmsMessages)
            .where(and(...conditions))
            .orderBy(desc(vaultSmsMessages.receivedAt))
            .limit(100);
        // Filter to messages the user can see.
        // For now, mirror existing SMS endpoints:
        // - If a message is tied to a vault (via smsNumber.vaultId), only the vault owner can see it.
        // - If smsNumber.vaultId is null (global inbox), allow any authenticated user.
        const out = [];
        for (const m of messages) {
            const [smsNumber] = await db
                .select()
                .from(vaultSmsNumbers)
                .where(eq(vaultSmsNumbers.id, m.smsNumberId))
                .limit(1);
            if (!smsNumber)
                continue;
            if (smsNumber.vaultId) {
                const [vault] = await db
                    .select({ id: vaultVaults.id })
                    .from(vaultVaults)
                    .where(and(eq(vaultVaults.id, smsNumber.vaultId), eq(vaultVaults.ownerUserId, userId)))
                    .limit(1);
                if (!vault)
                    continue;
            }
            out.push({
                id: m.id,
                fromNumber: m.fromNumber,
                toNumber: m.toNumber,
                receivedAt: m.receivedAt,
            });
        }
        return NextResponse.json({ messages: out });
    }
    catch (error) {
        console.error('[vault] Get latest SMS messages error:', error);
        return NextResponse.json({ error: 'Failed to fetch SMS messages' }, { status: 500 });
    }
}
