/**
 * Event publishing utility for vault feature pack
 *
 * Publishes events to websocket-core (first-party).
 * Used for instant OTP code notifications.
 */

export interface VaultOtpEvent {
  messageId: string;
  type: 'sms' | 'email';
  from: string;
  to: string;
  subject?: string;
  receivedAt: string;
  // OTP code is NOT included here for security - client must reveal via API
}

import { getVaultRealtimeConfig } from './vault-config';
import { getDb } from '@/lib/db';
import { publishWsEvent } from '@hit/feature-pack-websocket-core/server';

/**
 * Publish a vault realtime event (best-effort)
 *
 * @param eventType - Event type (e.g., 'vault.otp_received')
 * @param payload - Event payload
 */
export async function publishVaultEvent(
  eventType: string,
  payload: Record<string, unknown>
): Promise<{ success: boolean; subscribers?: number; error?: string }> {
  const { realtimeOtpEnabled } = getVaultRealtimeConfig();
  if (!realtimeOtpEnabled) {
    return { success: false, error: 'Vault realtime OTP is disabled' };
  }

  try {
    const db = getDb();
    await publishWsEvent(db as any, { topic: eventType, payload, source: 'fp.vault' });
    return { success: true, subscribers: 0 };
  } catch (error) {
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
export async function publishOtpReceived(
  event: VaultOtpEvent
): Promise<{ success: boolean; subscribers?: number; error?: string }> {
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

