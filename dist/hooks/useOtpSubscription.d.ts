/**
 * OTP Subscription Hook
 *
 * Provides real-time OTP code notifications via WebSocket with polling fallback.
 * Uses the HIT Events SDK when available, falls back to API polling otherwise.
 */
import { type OtpExtractionResult } from '../utils/otp-extractor';
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
    /** Polling interval in ms when WebSocket not available (default: 2000) */
    pollingInterval?: number;
    /** Max time to poll in ms (default: 5 minutes) */
    maxPollTime?: number;
}
export interface UseOtpSubscriptionResult {
    /** Whether actively listening for OTP */
    isListening: boolean;
    /** Connection method being used */
    connectionType: 'websocket' | 'polling' | 'disconnected';
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
 * Automatically uses WebSocket when HIT SDK is available, otherwise falls back to polling.
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
export declare function getWebSocketStatus(): 'connected' | 'connecting' | 'disconnected' | 'error' | 'unavailable';
/**
 * Check if WebSocket is available
 */
export declare function isWebSocketAvailable(): boolean;
//# sourceMappingURL=useOtpSubscription.d.ts.map