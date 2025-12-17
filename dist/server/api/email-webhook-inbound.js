// src/server/api/email-webhook-inbound.ts
import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { vaultSmsMessages, vaultSmsNumbers, vaultWebhookLogs, vaultSettings } from '@/lib/feature-pack-schemas';
import { eq, isNull, and } from 'drizzle-orm';
import { encrypt, decrypt } from '../utils/encryption';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
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
 * Verify API key authentication for Power Automate/custom webhooks
 */
async function verifyApiKey(request) {
    const apiKey = await getWebhookApiKey();
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
 * POST /api/vault/email/webhook/inbound
 * Inbound Email webhook (Power Automate/Custom)
 *
 * Supports Power Automate and custom email forwarding:
 *
 * Power Automate/Custom format (JSON):
 *    - from: sender email address
 *    - to: recipient email address
 *    - subject: email subject
 *    - body: email body (text or HTML)
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
            key.toLowerCase() === 'x-api-key') {
            headers[key] = '[REDACTED]';
        }
        else {
            headers[key] = value;
        }
    });
    try {
        // Parse JSON body
        const body = await request.json();
        // Extract fields - support various formats
        const fromEmail = body.from || body.From || body.sender || body.Sender;
        const toEmail = body.to || body.To || body.recipient || body.Recipient;
        const subject = body.subject || body.Subject || body.title || '';
        const emailBody = body.body || body.Body || body.text || body.html || body.content || '';
        const timestamp = body.timestamp || body.Timestamp || body.date || body.Date;
        // Sanitize body for logging (don't log full email body)
        const sanitizedBody = { ...body };
        if (sanitizedBody.body)
            sanitizedBody.body = '[REDACTED]';
        if (sanitizedBody.Body)
            sanitizedBody.Body = '[REDACTED]';
        if (sanitizedBody.text)
            sanitizedBody.text = '[REDACTED]';
        if (sanitizedBody.html)
            sanitizedBody.html = '[REDACTED]';
        if (sanitizedBody.content)
            sanitizedBody.content = '[REDACTED]';
        // Log webhook request
        const [logEntry] = await db.insert(vaultWebhookLogs).values({
            method,
            url,
            headers,
            body: sanitizedBody,
            ip: clientIP,
            fromNumber: fromEmail || undefined, // Reuse fromNumber field for email
            toNumber: toEmail || undefined, // Reuse toNumber field for email
            success: false, // Will update on success
        }).returning({ id: vaultWebhookLogs.id });
        webhookLogId = logEntry.id;
        // Verify API key
        if (!(await verifyApiKey(request))) {
            console.error('[vault] Invalid or missing API key for email webhook');
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
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        if (!fromEmail || !emailBody) {
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
            return NextResponse.json({ error: 'Missing required fields: from and body are required' }, { status: 400 });
        }
        // Find or create global SMS number (reuse SMS inbox structure for emails)
        // Look for a global SMS number (no vaultId or itemId)
        let [smsNumber] = await db
            .select()
            .from(vaultSmsNumbers)
            .where(and(isNull(vaultSmsNumbers.vaultId), isNull(vaultSmsNumbers.itemId)))
            .limit(1);
        // If no global number exists, create one with a placeholder
        if (!smsNumber) {
            const [newSmsNumber] = await db.insert(vaultSmsNumbers).values({
                phoneNumber: '[email-inbox]',
                provider: 'power-automate',
                status: 'active',
            }).returning();
            smsNumber = newSmsNumber;
        }
        // Combine subject and body for storage
        const fullMessage = subject ? `Subject: ${subject}\n\n${emailBody}` : emailBody;
        // Encrypt the message body
        const encryptedBody = encrypt(fullMessage);
        // Calculate retention expiry (default 30 days)
        const retentionDays = parseInt(process.env.VAULT_SMS_RETENTION_DAYS || '30', 10);
        const retentionExpiresAt = new Date();
        retentionExpiresAt.setDate(retentionExpiresAt.getDate() + retentionDays);
        // Parse timestamp if provided, otherwise use current time
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
        // Store the encrypted message (reuse SMS messages table structure)
        await db.insert(vaultSmsMessages).values({
            smsNumberId: smsNumber.id,
            fromNumber: fromEmail,
            toNumber: toEmail || '[email-inbox]',
            bodyEncrypted: encryptedBody,
            receivedAt: receivedAt,
            metadataEncrypted: {
                type: 'email',
                subject: subject,
                provider: 'power-automate',
                receivedAt: receivedAt.toISOString(),
            },
            retentionExpiresAt: retentionExpiresAt,
        });
        console.log(`[vault] Stored email message from ${fromEmail}`);
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
        console.error('[vault] Email webhook error:', error);
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
            }
            catch (logError) {
                console.error('[vault] Failed to log webhook error:', logError);
            }
        }
        return NextResponse.json({ error: 'Failed to process email webhook' }, { status: 500 });
    }
}
