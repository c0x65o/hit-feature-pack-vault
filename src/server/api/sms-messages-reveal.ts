// src/server/api/sms-messages-reveal.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers, vaultVaults, vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq, and } from 'drizzle-orm';
import { getUserId } from '../auth';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  return parts[parts.length - 1] || null;
}

/**
 * POST /api/vault/sms/messages/[id]/reveal
 * Reveal SMS message body (audited)
 */
export async function POST(request: NextRequest) {
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

    // Verify user owns the vault the SMS number belongs to
    if (smsNumber.vaultId) {
      const [vault] = await db
        .select()
        .from(vaultVaults)
        .where(and(
          eq(vaultVaults.id, smsNumber.vaultId),
          eq(vaultVaults.ownerUserId, userId)
        ))
        .limit(1);

      if (!vault) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
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
    } catch (error) {
      console.error('[vault] Decryption error:', error);
      return NextResponse.json(
        { error: 'Failed to decrypt message' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('[vault] Reveal SMS message error:', error);
    return NextResponse.json(
      { error: 'Failed to reveal SMS message' },
      { status: 500 }
    );
  }
}
