/**
 * Event publishing utility for vault feature pack
 * 
 * Publishes events to the HIT Events Module for real-time WebSocket delivery.
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

/**
 * Publish a vault event to the events module
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

  const eventsUrl = process.env.HIT_EVENTS_URL || process.env.NEXT_PUBLIC_HIT_EVENTS_URL;
  
  if (!eventsUrl) {
    console.log('[vault] Events module not configured - skipping event publish');
    return { success: false, error: 'Events module not configured' };
  }

  const projectSlug = process.env.HIT_PROJECT_SLUG || process.env.NEXT_PUBLIC_HIT_PROJECT_SLUG || 'hit-dashboard';
  const serviceToken = process.env.HIT_SERVICE_TOKEN;

  console.log(`[vault] Publishing event '${eventType}' to channel '${projectSlug}' at ${eventsUrl}`);

  try {
    const url = `${eventsUrl.replace(/\/$/, '')}/publish?event_type=${encodeURIComponent(eventType)}`;
    
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-HIT-Project-Slug': projectSlug,
    };
    
    if (serviceToken) {
      headers['X-HIT-Service-Token'] = serviceToken;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[vault] Failed to publish event: ${response.status} - ${errorText}`);
      return { success: false, error: `HTTP ${response.status}` };
    }

    const result = await response.json();
    console.log(`[vault] Published event '${eventType}' (${result.subscribers || 0} subscribers)`);
    return { success: true, subscribers: result.subscribers };
  } catch (error) {
    console.error('[vault] Failed to publish event:', error);
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

