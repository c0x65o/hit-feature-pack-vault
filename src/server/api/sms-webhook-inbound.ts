// src/server/api/sms-webhook-inbound.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers } from '@/lib/feature-pack-schemas';
import { eq, isNull, and } from 'drizzle-orm';
import * as crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Verify Twilio webhook signature
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function verifyTwilioSignature(
  url: string,
  params: Record<string, string>,
  signature: string,
  authToken: string
): boolean {
  // Create the signature string
  const data = Object.keys(params)
    .sort()
    .reduce((acc, key) => {
      return acc + key + params[key];
    }, url);

  // Create HMAC SHA1 hash
  const hash = crypto
    .createHmac('sha1', authToken)
    .update(Buffer.from(data, 'utf-8'))
    .digest('base64');

  // Compare signatures (use constant-time comparison)
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(hash)
  );
}

import { encrypt } from '../utils/encryption';

/**
 * POST /api/vault/sms/webhook/inbound
 * Inbound SMS webhook (Twilio/etc)
 * 
 * Twilio sends POST with form-encoded data:
 * - From: sender phone number
 * - To: recipient phone number (our provisioned number)
 * - Body: message text
 * - MessageSid: unique message ID
 * - AccountSid: Twilio account SID
 */
export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    
    // Twilio sends form-encoded data, but Next.js can parse it as JSON if Content-Type is set
    // For safety, handle both form data and JSON
    let body: Record<string, string>;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Parse form data
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries()) as Record<string, string>;
    } else {
      // Try JSON
      body = await request.json();
    }

    const fromNumber = body.From || body.from;
    const toNumber = body.To || body.to;
    const messageBody = body.Body || body.body || '';
    const messageSid = body.MessageSid || body.messageSid;
    const accountSid = body.AccountSid || body.accountSid;

    if (!fromNumber || !toNumber || !messageBody) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Verify Twilio signature if auth token is available
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSignature = request.headers.get('x-twilio-signature');
    
    if (twilioAuthToken && twilioSignature) {
      const url = request.url.split('?')[0]; // Full URL without query params
      const isValid = verifyTwilioSignature(url, body, twilioSignature, twilioAuthToken);
      
      if (!isValid) {
        console.error('[vault] Invalid Twilio signature');
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        );
      }
    } else {
      console.warn('[vault] Twilio signature verification skipped - TWILIO_AUTH_TOKEN not set');
    }

    // Find the SMS number record by phone number
    const [smsNumber] = await db
      .select()
      .from(vaultSmsNumbers)
      .where(eq(vaultSmsNumbers.phoneNumber, toNumber))
      .limit(1);

    if (!smsNumber) {
      console.warn(`[vault] Received SMS for unknown number: ${toNumber}`);
      // Still return success to Twilio (don't retry)
      return NextResponse.json({ success: true, message: 'Number not found' });
    }

    // Check if number is active
    if (smsNumber.status !== 'active') {
      console.warn(`[vault] Received SMS for inactive number: ${toNumber}`);
      return NextResponse.json({ success: true, message: 'Number inactive' });
    }

    // Encrypt the message body
    const encryptedBody = encrypt(messageBody);

    // Calculate retention expiry (default 30 days)
    const retentionDays = parseInt(process.env.VAULT_SMS_RETENTION_DAYS || '30', 10);
    const retentionExpiresAt = new Date();
    retentionExpiresAt.setDate(retentionExpiresAt.getDate() + retentionDays);

    // Store the encrypted message
    await db.insert(vaultSmsMessages).values({
      smsNumberId: smsNumber.id,
      fromNumber: fromNumber,
      toNumber: toNumber,
      bodyEncrypted: encryptedBody,
      metadataEncrypted: {
        messageSid: messageSid,
        accountSid: accountSid,
        receivedAt: new Date().toISOString(),
      },
      retentionExpiresAt: retentionExpiresAt,
    });

    console.log(`[vault] Stored SMS message from ${fromNumber} to ${toNumber}`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] SMS webhook error:', error);
    return NextResponse.json(
      { error: 'Failed to process SMS webhook' },
      { status: 500 }
    );
  }
}

