/**
 * OTP Subscription Hook
 *
 * Provides real-time OTP code notifications via WebSocket.
 * Uses the HIT Events SDK when available; if WebSocket isn't available/connected,
 * we surface a disconnected state (no polling fallback).
 */
import { type OtpExtractionResult } from '../utils/otp-extractor';
/**
 * Subscribe to global WebSocket status changes (shared across all vault OTP subscribers).
 */
export declare function subscribeGlobalWsStatus(listener: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void): () => void;
/**
 * Get the current global WebSocket status (shared across all vault OTP subscribers).
 */
export declare function getGlobalWsStatus(): 'connecting' | 'connected' | 'disconnected' | 'error';
export declare function getGlobalOtpConnectionType(): 'websocket' | 'disconnected';
export declare function subscribeGlobalOtpConnectionType(listener: (t: 'websocket' | 'disconnected') => void): () => void;
/**
 * Get the current global WebSocket connection status
 */
export interface OtpNotification {
    messageId: string;
    type: 'sms' | 'email';
    from: string;
    to: string;
    subject?: string;
    receivedAt: string;
}
export interface UseOtpSubscriptionOptions {
    /** Filter by message type ('sms' | 'email' | 'all') */
    type?: 'sms' | 'email' | 'all';
    /** Filter by 'to' address (email or phone) */
    toFilter?: string;
    /** Callback when new OTP is received */
    onOtpReceived?: (result: OtpExtractionResult & {
        notification: OtpNotification;
    }) => void;
    /** Enable subscription (default: true) */
    enabled?: boolean;
    /** Keep listening after receiving OTP (default: false - stops after first OTP) */
    keepListening?: boolean;
    /** Message ID to skip (e.g., already loaded when modal opened) */
    skipMessageId?: string | null;
    /**
     * Only treat notifications as "new" if received strictly after this time.
     * This is the strongest guard against "old message re-emitted as new event".
     */
    minReceivedAt?: Date | string | null;
}
export interface UseOtpSubscriptionResult {
    /** Whether actively listening for OTP */
    isListening: boolean;
    /** Connection method being used */
    connectionType: 'websocket' | 'disconnected';
    /** Latest OTP code extracted */
    otpCode: string | null;
    /** Confidence level of OTP extraction */
    otpConfidence: OtpExtractionResult['confidence'];
    /** Full message for manual extraction */
    fullMessage: string | null;
    /** Latest notification received */
    latestNotification: OtpNotification | null;
    /** Start listening for OTP codes */
    startListening: () => void;
    /** Stop listening for OTP codes */
    stopListening: () => void;
    /** Clear current OTP */
    clearOtp: () => void;
    /** Error if any */
    error: Error | null;
}
/**
 * Hook for subscribing to OTP notifications
 *
 * Uses WebSocket when HIT SDK is available; otherwise stays disconnected (no polling fallback).
 *
 * @example
 * ```tsx
 * const { isListening, otpCode, otpConfidence, startListening, stopListening } = useOtpSubscription({
 *   type: 'email',
 *   toFilter: 'operations@example.com',
 *   onOtpReceived: (result) => {
 *     console.log('Got OTP:', result.code);
 *   },
 * });
 *
 * // Start listening when user needs 2FA
 * <button onClick={startListening}>Wait for OTP</button>
 *
 * // Show the code when received
 * {otpCode && <code>{otpCode}</code>}
 * ```
 */
export declare function useOtpSubscription(options?: UseOtpSubscriptionOptions): UseOtpSubscriptionResult;
/**
 * Get the current WebSocket connection status
 */
export declare function getWebSocketStatus(): Promise<'connected' | 'connecting' | 'disconnected' | 'error' | 'unavailable'>;
/**
 * Check if WebSocket is available
 * Note: This is synchronous but may return false initially while SDK loads.
 * The SDK loads in the background, so subsequent calls will return true if available.
 */
export declare function isWebSocketAvailable(): boolean;
/**
 * Ensure the vault events WebSocket is connected by installing a lightweight
 * subscription to the vault OTP event type. This keeps a single global Events
 * client connected so feature-pack UIs can "hand off" without re-connecting.
 *
 * Call this once at app startup (e.g., dashboard shell layout).
 */
export declare function ensureVaultRealtimeConnection(): Promise<() => void>;
//# sourceMappingURL=useOtpSubscription.d.ts.map