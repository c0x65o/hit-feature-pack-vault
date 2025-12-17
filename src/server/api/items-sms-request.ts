// src/server/api/items-sms-request.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultItems, vaultAuditEvents } from '@/lib/feature-pack-schemas';
import { eq } from 'drizzle-orm';
import { getUserId, extractUserFromRequest } from '../auth';
import { sendSms } from '../utils/twilio-sms';
import { checkItemAccess } from '../lib/acl-utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractId(request: NextRequest): string | null {
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

    // Get item
    const [item] = await db
      .select()
      .from(vaultItems)
      .where(eq(vaultItems.id, id))
      .limit(1);

    if (!item) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Verify user has access via ACL check
    const user = extractUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const accessCheck = await checkItemAccess(db, id, user, { requiredPermissions: ['READ_ONLY'] });
    if (!accessCheck.hasAccess) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check if SMS 2FA is enabled (from feature pack config)
    const sms2faEnabled = process.env.VAULT_SMS_2FA_ENABLED !== 'false';
    
    if (!sms2faEnabled) {
      return NextResponse.json(
        { error: 'SMS 2FA is disabled' },
        { status: 400 }
      );
    }

    // Get user's phone number from request body
    const body = await request.json().catch(() => ({}));
    const userPhoneNumber = body.phoneNumber;

    if (!userPhoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required. Please provide your phone number in E.164 format (e.g., +1234567890)' },
        { status: 400 }
      );
    }

    // Validate E.164 format
    if (!userPhoneNumber.startsWith('+')) {
      return NextResponse.json(
        { error: 'Phone number must be in E.164 format (e.g., +1234567890)' },
        { status: 400 }
      );
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
      return NextResponse.json(
        { 
          error: 'Failed to send SMS',
          detail: result.error,
        },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      messageSid: result.messageSid,
      status: result.status,
      message: 'SMS request sent successfully. Please check your phone for the 2FA code.',
    });
  } catch (error) {
    console.error('[vault] Request SMS 2FA error:', error);
    return NextResponse.json(
      { error: 'Failed to request SMS 2FA code' },
      { status: 500 }
    );
  }
}

