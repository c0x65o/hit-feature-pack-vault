// src/server/api/sms-webhook-inbound.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers, vaultWebhookLogs, vaultSettings } from '@/lib/feature-pack-schemas';
import { eq, isNull, and } from 'drizzle-orm';
import * as crypto from 'crypto';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
/**
 * Verify Twilio webhook signature
 * See: https://www.twilio.com/docs/usage/webhooks/webhooks-security
 */
function verifyTwilioSignature(url, params, signature, authToken) {
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
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(hash));
}
import { encrypt, decrypt } from '../utils/encryption';
import { publishOtpReceived } from '../utils/publish-event';
/**
 * Get client IP from request headers
 */
function getClientIP(request) {
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
 * Get webhook API key from database or environment
 */
async function getWebhookApiKey() {
    const db = getDb();
    // Try database first
    const [setting] = await db
        .select()
        .from(vaultSettings)
        .where(eq(vaultSettings.key, 'webhook_api_key'))
        .limit(1);
    if (setting) {
        try {
            return decrypt(setting.valueEncrypted);
        }
        catch (err) {
            console.error('[vault] Failed to decrypt API key:', err);
        }
    }
    // Fallback to environment variable
    return process.env.VAULT_SMS_WEBHOOK_API_KEY || null;
}
/**
 * Verify API key authentication for F-Droid/custom webhooks
 */
async function verifyApiKey(request) {
    const apiKey = await getWebhookApiKey();
    if (!apiKey) {
        // If no API key is configured, allow requests
        return { valid: true, reason: 'no_key_configured' };
    }
    const expectedKeyPrefix = apiKey.substring(0, 8);
    // Check Authorization header (Bearer token)
    const authHeader = request.headers.get('authorization');
    if (authHeader) {
        if (!authHeader.startsWith('Bearer ')) {
            return {
                valid: false,
                reason: 'invalid_auth_format',
                details: `Authorization header must start with "Bearer ", got: "${authHeader.substring(0, 20)}..."`
            };
        }
        const token = authHeader.substring(7);
        if (!token) {
            return {
                valid: false,
                reason: 'empty_bearer_token',
                details: 'Authorization header has "Bearer " but no token after it'
            };
        }
        if (token === apiKey) {
            return { valid: true, reason: 'bearer_token_valid' };
        }
        const providedPrefix = token.substring(0, 8);
        return {
            valid: false,
            reason: 'bearer_token_mismatch',
            details: `Token prefix "${providedPrefix}..." does not match expected "${expectedKeyPrefix}..."`
        };
    }
    // Check X-API-Key header
    const apiKeyHeader = request.headers.get('x-api-key');
    if (apiKeyHeader) {
        if (apiKeyHeader === apiKey) {
            return { valid: true, reason: 'api_key_header_valid' };
        }
        const providedPrefix = apiKeyHeader.substring(0, 8);
        return {
            valid: false,
            reason: 'api_key_header_mismatch',
            details: `X-API-Key prefix "${providedPrefix}..." does not match expected "${expectedKeyPrefix}..."`
        };
    }
    // If API key is configured but not provided, reject
    return {
        valid: false,
        reason: 'no_auth_provided',
        details: 'API key is configured but no Authorization or X-API-Key header was provided'
    };
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
export async function POST(request) {
    const startTime = Date.now();
    const db = getDb();
    let webhookLogId = null;
    // Collect request info for logging
    const url = request.url;
    const method = request.method;
    const clientIP = getClientIP(request);
    const headers = {};
    request.headers.forEach((value, key) => {
        // Sanitize sensitive headers
        if (key.toLowerCase() === 'authorization' ||
            key.toLowerCase() === 'x-twilio-signature' ||
            key.toLowerCase() === 'x-api-key') {
            headers[key] = '[REDACTED]';
        }
        else {
            headers[key] = value;
        }
    });
    // Capture raw body for debugging (declare outside try block for error handling)
    let rawBodyText = null;
    try {
        // Determine format: Twilio uses form-encoded, F-Droid uses JSON
        let body;
        const contentType = request.headers.get('content-type') || '';
        // Capture raw body for debugging (before parsing)
        try {
            const rawBody = await request.text();
            rawBodyText = rawBody || null;
            // Clone the request for parsing (since we consumed the body)
            const clonedRequest = new Request(request.url, {
                method: request.method,
                headers: request.headers,
                body: rawBody,
            });
            if (contentType.includes('application/x-www-form-urlencoded')) {
                // Parse form data (Twilio format)
                const formData = await clonedRequest.formData();
                body = Object.fromEntries(formData.entries());
            }
            else {
                // Try JSON (F-Droid/Custom format)
                try {
                    body = await clonedRequest.json();
                }
                catch (jsonError) {
                    // If JSON parsing fails, we already have rawBodyText, just rethrow
                    throw jsonError;
                }
            }
        }
        catch (bodyError) {
            // If we can't read the body, set rawBodyText to indicate error
            if (!rawBodyText) {
                rawBodyText = bodyError instanceof Error ? `Error reading body: ${bodyError.message}` : 'Error reading body';
            }
            throw bodyError;
        }
        // Extract fields - support both Twilio and F-Droid formats
        const fromNumber = body.From || body.from;
        const toNumber = body.To || body.to;
        const messageBody = body.Body || body.body || '';
        const messageSid = body.MessageSid || body.messageSid;
        const accountSid = body.AccountSid || body.accountSid;
        const timestamp = body.timestamp || body.Timestamp;
        // Optional subject field (some email forwarders may send it even when hitting this endpoint)
        const subject = body.Subject || body.subject || body.title || body.Topic;
        // Sometimes email forwarders are accidentally configured to hit the SMS webhook endpoint.
        // If it looks like email, treat it as email so:
        // - realtime event payload matches (UI filters by type)
        // - email polling endpoint can find it (filters metadataEncrypted.type === 'email')
        const looksLikeEmail = (value) => typeof value === 'string' && value.includes('@') && value.includes('.');
        const inferredType = looksLikeEmail(fromNumber) || looksLikeEmail(toNumber) ? 'email' : 'sms';
        // Sanitize body for logging (don't log full message body)
        const sanitizedBody = { ...body };
        if (sanitizedBody.Body)
            sanitizedBody.Body = '[REDACTED]';
        if (sanitizedBody.body)
            sanitizedBody.body = '[REDACTED]';
        // Log webhook request
        const [logEntry] = await db.insert(vaultWebhookLogs).values({
            method,
            url,
            headers,
            body: sanitizedBody,
            rawBody: rawBodyText,
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
                console.error('[vault] SMS webhook Twilio signature verification failed');
                console.error('[vault] URL used for verification:', urlWithoutQuery);
                console.error('[vault] Request from IP:', clientIP);
                console.error('[vault] AccountSid:', accountSid || 'not provided');
                const processingTime = Date.now() - startTime;
                if (webhookLogId) {
                    await db.update(vaultWebhookLogs)
                        .set({
                        statusCode: 403,
                        success: false,
                        error: 'Invalid Twilio signature - signature verification failed',
                        processingTimeMs: processingTime,
                    })
                        .where(eq(vaultWebhookLogs.id, webhookLogId));
                }
                return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
            }
        }
        else {
            // F-Droid/Custom webhook - verify API key
            const authResult = await verifyApiKey(request);
            if (!authResult.valid) {
                console.error('[vault] SMS webhook auth failed:', authResult.reason);
                if (authResult.details) {
                    console.error('[vault] Auth details:', authResult.details);
                }
                console.error('[vault] Request from IP:', clientIP);
                console.error('[vault] Request headers present:', Object.keys(headers).join(', '));
                const processingTime = Date.now() - startTime;
                const errorMsg = authResult.details
                    ? `${authResult.reason}: ${authResult.details}`
                    : authResult.reason;
                if (webhookLogId) {
                    await db.update(vaultWebhookLogs)
                        .set({
                        statusCode: 401,
                        success: false,
                        error: errorMsg,
                        processingTimeMs: processingTime,
                    })
                        .where(eq(vaultWebhookLogs.id, webhookLogId));
                }
                return NextResponse.json({ error: 'Unauthorized', reason: authResult.reason }, { status: 401 });
            }
        }
        if (!fromNumber || !toNumber || !messageBody) {
            const missingFields = [];
            if (!fromNumber)
                missingFields.push('from/From');
            if (!toNumber)
                missingFields.push('to/To');
            if (!messageBody)
                missingFields.push('body/Body');
            console.error('[vault] SMS webhook missing required fields:', missingFields.join(', '));
            console.error('[vault] Received fields:', Object.keys(body).join(', '));
            console.error('[vault] Request from IP:', clientIP);
            console.error('[vault] Content-Type:', contentType);
            const processingTime = Date.now() - startTime;
            const errorMsg = `Missing required fields: ${missingFields.join(', ')}. Received: ${Object.keys(body).join(', ')}`;
            if (webhookLogId) {
                await db.update(vaultWebhookLogs)
                    .set({
                    statusCode: 400,
                    success: false,
                    error: errorMsg,
                    processingTimeMs: processingTime,
                })
                    .where(eq(vaultWebhookLogs.id, webhookLogId));
            }
            return NextResponse.json({ error: 'Missing required fields: from, to, and body are required', missing: missingFields, received: Object.keys(body) }, { status: 400 });
        }
        // Find or create global SMS number (phone number doesn't matter, we use a global inbox)
        // Look for a global SMS number (no vaultId or itemId)
        let [smsNumber] = await db
            .select()
            .from(vaultSmsNumbers)
            .where(and(isNull(vaultSmsNumbers.vaultId), isNull(vaultSmsNumbers.itemId)))
            .limit(1);
        // If no global number exists, create one with a placeholder
        if (!smsNumber) {
            const [newSmsNumber] = await db.insert(vaultSmsNumbers).values({
                phoneNumber: inferredType === 'email' ? '[email-inbox]' : (toNumber || '[global-inbox]'),
                provider: 'fdroid',
                status: 'active',
            }).returning();
            smsNumber = newSmsNumber;
        }
        // Encrypt the message body
        const encryptedBody = encrypt(messageBody);
        // Calculate retention expiry (default 30 days)
        const retentionDays = parseInt(process.env.VAULT_SMS_RETENTION_DAYS || '30', 10);
        const retentionExpiresAt = new Date();
        retentionExpiresAt.setDate(retentionExpiresAt.getDate() + retentionDays);
        // Parse timestamp if provided (F-Droid format), otherwise use current time
        let receivedAt;
        if (timestamp) {
            // Try parsing as ISO string or Unix timestamp
            if (typeof timestamp === 'string') {
                receivedAt = new Date(timestamp);
            }
            else if (typeof timestamp === 'number') {
                // Unix timestamp (seconds or milliseconds)
                receivedAt = timestamp > 1e12 ? new Date(timestamp) : new Date(timestamp * 1000);
            }
            else {
                receivedAt = new Date();
            }
            // Validate parsed date
            if (isNaN(receivedAt.getTime())) {
                receivedAt = new Date();
            }
        }
        else {
            receivedAt = new Date();
        }
        // Store the encrypted message
        const [insertedMessage] = await db.insert(vaultSmsMessages).values({
            smsNumberId: smsNumber.id,
            fromNumber: fromNumber,
            toNumber: toNumber,
            bodyEncrypted: encryptedBody,
            receivedAt: receivedAt,
            metadataEncrypted: {
                type: inferredType,
                messageSid: messageSid,
                accountSid: accountSid,
                provider: smsNumber.provider,
                subject: inferredType === 'email' ? (subject || null) : undefined,
                receivedAt: receivedAt.toISOString(),
            },
            retentionExpiresAt: retentionExpiresAt,
        }).returning({ id: vaultSmsMessages.id });
        console.log(`[vault] Stored ${inferredType === 'email' ? 'email' : 'SMS'} message from ${fromNumber} to ${toNumber}`);
        // Publish real-time event for WebSocket clients
        await publishOtpReceived({
            messageId: insertedMessage.id,
            type: inferredType,
            from: fromNumber,
            to: toNumber,
            subject: inferredType === 'email' ? (subject || undefined) : undefined,
            receivedAt: receivedAt.toISOString(),
        });
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
    }
    catch (error) {
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
        }
        else {
            // Log even if we failed before creating the log entry
            // Try to capture raw body if we haven't already
            if (!rawBodyText) {
                try {
                    const rawBody = await request.text();
                    rawBodyText = rawBody || null;
                }
                catch {
                    // Ignore errors reading body (may already be consumed)
                }
            }
            try {
                await db.insert(vaultWebhookLogs).values({
                    method,
                    url,
                    headers,
                    body: {},
                    rawBody: rawBodyText,
                    ip: clientIP,
                    statusCode: 500,
                    success: false,
                    error: errorMessage,
                    processingTimeMs: processingTime,
                });
            }
            catch (logError) {
                console.error('[vault] Failed to log webhook error:', logError);
            }
        }
        return NextResponse.json({ error: 'Failed to process SMS webhook' }, { status: 500 });
    }
}
