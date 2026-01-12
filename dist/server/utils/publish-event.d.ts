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
}
/**
 * Publish a vault event to the events module
 *
 * @param eventType - Event type (e.g., 'vault.otp_received')
 * @param payload - Event payload
 */
export declare function publishVaultEvent(eventType: string, payload: Record<string, unknown>): Promise<{
    success: boolean;
    subscribers?: number;
    error?: string;
}>;
/**
 * Publish an OTP received event
 *
 * This notifies connected WebSocket clients that a new OTP message has arrived.
 * The actual OTP code is NOT included - clients must call reveal API to decrypt.
 */
export declare function publishOtpReceived(event: VaultOtpEvent): Promise<{
    success: boolean;
    subscribers?: number;
    error?: string;
}>;
//# sourceMappingURL=publish-event.d.ts.map