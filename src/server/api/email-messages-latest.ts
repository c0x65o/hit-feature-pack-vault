// src/server/api/email-messages-latest.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultItems, vaultSettings } from '@/lib/feature-pack-schemas';
import { eq, desc, and, sql, ilike, gte, or } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { checkItemAccess } from '../lib/acl-utils';
import { decrypt } from '../utils/encryption';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const GLOBAL_EMAIL_SETTING_KEY = 'global_2fa_email';

/**
 * GET /api/vault/email/messages/latest
 * Get latest email messages that user has access to via item permissions
 */
export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const userId = getUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const since = searchParams.get('since');
    const emailFilter = searchParams.get('email');

    // Get global email address
    const [emailSetting] = await db
      .select()
      .from(vaultSettings)
      .where(eq(vaultSettings.key, GLOBAL_EMAIL_SETTING_KEY))
      .limit(1);

    let globalEmail: string | null = null;
    if (emailSetting) {
      try {
        globalEmail = decrypt(emailSetting.valueEncrypted);
      } catch (err) {
        console.error('[vault] Failed to decrypt global email setting:', err);
      }
    }

    // Build query for email messages (metadataEncrypted.type === 'email')
    const conditions = [
      sql`${vaultSmsMessages.metadataEncrypted}->>'type' = 'email'`
    ];

    if (since) {
      const sinceDate = new Date(since);
      if (!isNaN(sinceDate.getTime())) {
        conditions.push(gte(vaultSmsMessages.receivedAt, sinceDate));
      }
    }

    if (emailFilter) {
      conditions.push(ilike(vaultSmsMessages.toNumber, emailFilter));
    }

    // Get all email messages matching filters
    const allEmailMessages = await db
      .select()
      .from(vaultSmsMessages)
      .where(and(...conditions))
      .orderBy(desc(vaultSmsMessages.receivedAt))
      .limit(100); // Limit to recent messages for performance

    // Filter messages to only those where user has READ_ONLY access to matching items
    const accessibleMessages = [];
    
    for (const message of allEmailMessages) {
      const emailAddress = message.toNumber;
      if (!emailAddress) continue;

      // Find items with matching username
      const matchingItems = await db
        .select({ id: vaultItems.id })
        .from(vaultItems)
        .where(ilike(vaultItems.username, emailAddress));

      // Check if user has READ_ONLY access to any matching item
      let hasAccess = false;
      for (const item of matchingItems) {
        const accessCheck = await checkItemAccess(db, item.id, user, { requiredPermissions: ['READ_ONLY'] });
        if (accessCheck.hasAccess) {
          hasAccess = true;
          break;
        }
      }

      if (hasAccess) {
        accessibleMessages.push({
          id: message.id,
          from: message.fromNumber,
          to: message.toNumber,
          subject: message.metadataEncrypted && 
            typeof message.metadataEncrypted === 'object' && 
            'subject' in message.metadataEncrypted
            ? message.metadataEncrypted.subject as string | null
            : null,
          receivedAt: message.receivedAt,
        });
      }
    }

    return NextResponse.json({
      messages: accessibleMessages,
      globalEmail,
    });
  } catch (error) {
    console.error('[vault] Get latest email messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch email messages' },
      { status: 500 }
    );
  }
}

