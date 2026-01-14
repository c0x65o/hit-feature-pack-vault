/**
 * Event publishing utility for vault feature pack
 *
 * Publishes events to websocket-core (first-party).
 * Used for instant OTP code notifications.
 */
import { getVaultRealtimeConfig } from './vault-config';
import { getDb } from '@/lib/db';
import { publishWsEvent } from '@hit/feature-pack-websocket-core/server';
/**
 * Publish a vault realtime event (best-effort)
 *
 * @param eventType - Event type (e.g., 'vault.otp_received')
 * @param payload - Event payload
 */
export async function publishVaultEvent(eventType, payload) {
    const { realtimeOtpEnabled } = getVaultRealtimeConfig();
    if (!realtimeOtpEnabled) {
        return { success: false, error: 'Vault realtime OTP is disabled' };
    }
    try {
        const projectSlug = process.env.HIT_PROJECT_SLUG || process.env.NEXT_PUBLIC_HIT_PROJECT_SLUG || 'hit-dashboard';
        const db = getDb();
        await publishWsEvent(db, { projectSlug, topic: eventType, payload, source: 'fp.vault' });
        return { success: true, subscribers: 0 };
    }
    catch (error) {
        console.error('[vault] Failed to publish realtime event:', error);
        return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
}
/**
 * Publish an OTP received event
 *
 * This notifies connected WebSocket clients that a new OTP message has arrived.
 * The actual OTP code is NOT included - clients must call reveal API to decrypt.
 */
export async function publishOtpReceived(event) {
    const { realtimeOtpEventType, realtimeOtpEnabled } = getVaultRealtimeConfig();
    if (!realtimeOtpEnabled) {
        return { success: false, error: 'Vault realtime OTP is disabled' };
    }
    return await publishVaultEvent(realtimeOtpEventType, {
        messageId: event.messageId,
        type: event.type,
        from: event.from,
        to: event.to,
        subject: event.subject,
        receivedAt: event.receivedAt,
    });
}
