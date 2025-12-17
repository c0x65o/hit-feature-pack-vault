// src/server/api/sms-webhook-inbound.ts
import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers, vaultWebhookLogs } from '@/lib/feature-pack-schemas';
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
 * Get client IP from request headers
 */
function getClientIP(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) {
    return realIP;
  }
  return null;
}

/**
 * Verify API key authentication for F-Droid/custom webhooks
 */
function verifyApiKey(request: NextRequest): boolean {
  const apiKey = process.env.VAULT_SMS_WEBHOOK_API_KEY;
  
  if (!apiKey) {
    // If no API key is configured, allow requests (for backward compatibility)
    return true;
  }

  // Check Authorization header (Bearer token)
  const authHeader = request.headers.get('authorization');
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    return token === apiKey;
  }

  // Check X-API-Key header
  const apiKeyHeader = request.headers.get('x-api-key');
  if (apiKeyHeader) {
    return apiKeyHeader === apiKey;
  }

  // If API key is configured but not provided, reject
  return false;
}

/**
 * POST /api/vault/sms/webhook/inbound
 * Inbound SMS webhook (Twilio/F-Droid/Custom)
 * 
 * Supports multiple formats:
 * 
 * 1. Twilio format (form-encoded):
 *    - From: sender phone number
 *    - To: recipient phone number (our provisioned number)
 *    - Body: message text
 *    - MessageSid: unique message ID
 *    - AccountSid: Twilio account SID
 *    - Authenticated via X-Twilio-Signature header
 * 
 * 2. F-Droid/Custom format (JSON):
 *    - from: sender phone number
 *    - to: recipient phone number (our provisioned number)
 *    - body: message text
 *    - timestamp: optional timestamp (ISO string or Unix timestamp)
 *    - Authenticated via Authorization: Bearer <token> or X-API-Key header
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const db = getDb();
  let webhookLogId: string | null = null;
  
  // Collect request info for logging
  const url = request.url;
  const method = request.method;
  const clientIP = getClientIP(request);
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    // Sanitize sensitive headers
    if (key.toLowerCase() === 'authorization' || 
        key.toLowerCase() === 'x-twilio-signature' ||
        key.toLowerCase() === 'x-api-key') {
      headers[key] = '[REDACTED]';
    } else {
      headers[key] = value;
    }
  });

  try {
    // Determine format: Twilio uses form-encoded, F-Droid uses JSON
    let body: Record<string, any>;
    const contentType = request.headers.get('content-type') || '';
    
    if (contentType.includes('application/x-www-form-urlencoded')) {
      // Parse form data (Twilio format)
      const formData = await request.formData();
      body = Object.fromEntries(formData.entries()) as Record<string, any>;
    } else {
      // Try JSON (F-Droid/Custom format)
      body = await request.json();
    }

    // Extract fields - support both Twilio and F-Droid formats
    const fromNumber = body.From || body.from;
    const toNumber = body.To || body.to;
    const messageBody = body.Body || body.body || '';
    const messageSid = body.MessageSid || body.messageSid;
    const accountSid = body.AccountSid || body.accountSid;
    const timestamp = body.timestamp || body.Timestamp;

    // Sanitize body for logging (don't log full message body)
    const sanitizedBody: Record<string, any> = { ...body };
    if (sanitizedBody.Body) sanitizedBody.Body = '[REDACTED]';
    if (sanitizedBody.body) sanitizedBody.body = '[REDACTED]';

    // Log webhook request
    const [logEntry] = await db.insert(vaultWebhookLogs).values({
      method,
      url,
      headers,
      body: sanitizedBody,
      ip: clientIP,
      messageSid: messageSid || undefined,
      fromNumber: fromNumber || undefined,
      toNumber: toNumber || undefined,
      success: false, // Will update on success
    }).returning({ id: vaultWebhookLogs.id });
    webhookLogId = logEntry.id;

    // Check for Twilio signature (if present, verify it)
    const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioSignature = request.headers.get('x-twilio-signature');
    
    if (twilioSignature && twilioAuthToken) {
      // Twilio webhook - verify signature
      const urlWithoutQuery = request.url.split('?')[0];
      const isValid = verifyTwilioSignature(urlWithoutQuery, body, twilioSignature, twilioAuthToken);
      
      if (!isValid) {
        console.error('[vault] Invalid Twilio signature');
        const processingTime = Date.now() - startTime;
        if (webhookLogId) {
          await db.update(vaultWebhookLogs)
            .set({
              statusCode: 403,
              success: false,
              error: 'Invalid Twilio signature',
              processingTimeMs: processingTime,
            })
            .where(eq(vaultWebhookLogs.id, webhookLogId));
        }
        return NextResponse.json(
          { error: 'Invalid signature' },
          { status: 403 }
        );
      }
    } else {
      // F-Droid/Custom webhook - verify API key
      if (!verifyApiKey(request)) {
        console.error('[vault] Invalid or missing API key');
        const processingTime = Date.now() - startTime;
        if (webhookLogId) {
          await db.update(vaultWebhookLogs)
            .set({
              statusCode: 401,
              success: false,
              error: 'Invalid or missing API key',
              processingTimeMs: processingTime,
            })
            .where(eq(vaultWebhookLogs.id, webhookLogId));
        }
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    if (!fromNumber || !toNumber || !messageBody) {
      const processingTime = Date.now() - startTime;
      if (webhookLogId) {
        await db.update(vaultWebhookLogs)
          .set({
            statusCode: 400,
            success: false,
            error: 'Missing required fields',
            processingTimeMs: processingTime,
          })
          .where(eq(vaultWebhookLogs.id, webhookLogId));
      }
      
      return NextResponse.json(
        { error: 'Missing required fields: from, to, and body are required' },
        { status: 400 }
      );
    }

    // Find the SMS number record by phone number
    const [smsNumber] = await db
      .select()
      .from(vaultSmsNumbers)
      .where(eq(vaultSmsNumbers.phoneNumber, toNumber))
      .limit(1);

    if (!smsNumber) {
      console.warn(`[vault] Received SMS for unknown number: ${toNumber}`);
      const processingTime = Date.now() - startTime;
      if (webhookLogId) {
        await db.update(vaultWebhookLogs)
          .set({
            statusCode: 200,
            success: true,
            error: 'Number not found',
            processingTimeMs: processingTime,
          })
          .where(eq(vaultWebhookLogs.id, webhookLogId));
      }
      // Still return success to Twilio (don't retry)
      return NextResponse.json({ success: true, message: 'Number not found' });
    }

    // Check if number is active
    if (smsNumber.status !== 'active') {
      console.warn(`[vault] Received SMS for inactive number: ${toNumber}`);
      const processingTime = Date.now() - startTime;
      if (webhookLogId) {
        await db.update(vaultWebhookLogs)
          .set({
            statusCode: 200,
            success: true,
            error: 'Number inactive',
            processingTimeMs: processingTime,
          })
          .where(eq(vaultWebhookLogs.id, webhookLogId));
      }
      return NextResponse.json({ success: true, message: 'Number inactive' });
    }

    // Encrypt the message body
    const encryptedBody = encrypt(messageBody);

    // Calculate retention expiry (default 30 days)
    const retentionDays = parseInt(process.env.VAULT_SMS_RETENTION_DAYS || '30', 10);
    const retentionExpiresAt = new Date();
    retentionExpiresAt.setDate(retentionExpiresAt.getDate() + retentionDays);

    // Parse timestamp if provided (F-Droid format), otherwise use current time
    let receivedAt: Date;
    if (timestamp) {
      // Try parsing as ISO string or Unix timestamp
      if (typeof timestamp === 'string') {
        receivedAt = new Date(timestamp);
      } else if (typeof timestamp === 'number') {
        // Unix timestamp (seconds or milliseconds)
        receivedAt = timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
      } else {
        receivedAt = new Date();
      }
      
      // Validate parsed date
      if (isNaN(receivedAt.getTime())) {
        receivedAt = new Date();
      }
    } else {
      receivedAt = new Date();
    }

    // Store the encrypted message
    await db.insert(vaultSmsMessages).values({
      smsNumberId: smsNumber.id,
      fromNumber: fromNumber,
      toNumber: toNumber,
      bodyEncrypted: encryptedBody,
      receivedAt: receivedAt,
      metadataEncrypted: {
        messageSid: messageSid,
        accountSid: accountSid,
        provider: smsNumber.provider,
        receivedAt: receivedAt.toISOString(),
      },
      retentionExpiresAt: retentionExpiresAt,
    });

    console.log(`[vault] Stored SMS message from ${fromNumber} to ${toNumber}`);

    // Update webhook log with success
    const processingTime = Date.now() - startTime;
    if (webhookLogId) {
      await db.update(vaultWebhookLogs)
        .set({
          statusCode: 200,
          success: true,
          processingTimeMs: processingTime,
        })
        .where(eq(vaultWebhookLogs.id, webhookLogId));
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[vault] SMS webhook error:', error);
    const processingTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (webhookLogId) {
      await db.update(vaultWebhookLogs)
        .set({
          statusCode: 500,
          success: false,
          error: errorMessage,
          processingTimeMs: processingTime,
        })
        .where(eq(vaultWebhookLogs.id, webhookLogId));
    } else {
      // Log even if we failed before creating the log entry
      try {
        await db.insert(vaultWebhookLogs).values({
          method,
          url,
          headers,
          body: {},
          ip: clientIP,
          statusCode: 500,
          success: false,
          error: errorMessage,
          processingTimeMs: processingTime,
        });
      } catch (logError) {
        console.error('[vault] Failed to log webhook error:', logError);
      }
    }
    
    return NextResponse.json(
      { error: 'Failed to process SMS webhook' },
      { status: 500 }
    );
  }
}

