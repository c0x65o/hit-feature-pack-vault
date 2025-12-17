/**
 * OTP Subscription Hook
 *
 * Provides real-time OTP code notifications via WebSocket with polling fallback.
 * Uses the HIT Events SDK when available, falls back to API polling otherwise.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence } from '../utils/otp-extractor';
// Try to import HIT SDK events - may not be available in all setups
// Use ES6 imports (not require) for browser compatibility
let HitEventsClass = null;
let getWebSocketUrlFn = null;
let sdkLoadPromise = null;
// Use a function to lazily import the SDK (avoids top-level await issues)
async function loadHitSdk() {
    if (HitEventsClass) {
        return; // Already loaded
    }
    if (sdkLoadPromise) {
        return sdkLoadPromise; // Already loading
    }
    sdkLoadPromise = (async () => {
        try {
            // Dynamic import - works in browser environments (Next.js client components)
            const hitSdk = await import('@hit/sdk');
            HitEventsClass = hitSdk.HitEvents;
            getWebSocketUrlFn = hitSdk.getWebSocketUrl;
            console.log('[useOtpSubscription] HIT SDK loaded successfully, HitEvents available:', !!HitEventsClass);
        }
        catch (e) {
            // SDK not available - will use polling fallback
            console.log('[useOtpSubscription] HIT SDK not available, will use polling fallback. Error:', e);
        }
    })();
    return sdkLoadPromise;
}
// Pre-load SDK in the background (non-blocking)
if (typeof window !== 'undefined') {
    loadHitSdk().catch(() => {
        // Ignore errors - will fall back to polling
    });
}
// Global events client instance (created lazily when needed)
let eventsClientInstance = null;
/**
 * Get or create the events client instance
 */
async function getEventsClient() {
    // Ensure SDK is loaded
    await loadHitSdk();
    if (!HitEventsClass) {
        return null;
    }
    if (!eventsClientInstance) {
        // Get WebSocket URL from environment (same approach as hit-hello-world-ts)
        const EVENTS_WS_URL = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_HIT_EVENTS_WS_URL
            ? process.env.NEXT_PUBLIC_HIT_EVENTS_WS_URL
            : (getWebSocketUrlFn ? getWebSocketUrlFn('events') : '');
        // Get project slug/channel from environment
        const EVENTS_CHANNEL = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_HIT_EVENTS_CHANNEL
            ? process.env.NEXT_PUBLIC_HIT_EVENTS_CHANNEL
            : 'shared-events';
        eventsClientInstance = new HitEventsClass({
            baseUrl: EVENTS_WS_URL,
            projectSlug: EVENTS_CHANNEL,
            useSSE: false, // Use WebSocket
            onStatusChange: (status) => {
                console.log('[useOtpSubscription] WebSocket status:', status);
            },
            onError: (error) => {
                console.warn('[useOtpSubscription] WebSocket error:', error.message);
            },
        });
    }
    return eventsClientInstance;
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
export function useOtpSubscription(options = {}) {
    const { type = 'all', toFilter, onOtpReceived, enabled = true, pollingInterval = 2000, maxPollTime = 5 * 60 * 1000, keepListening = false, } = options;
    const [isListening, setIsListening] = useState(false);
    const [connectionType, setConnectionType] = useState('disconnected');
    const [otpCode, setOtpCode] = useState(null);
    const [otpConfidence, setOtpConfidence] = useState('none');
    const [fullMessage, setFullMessage] = useState(null);
    const [latestNotification, setLatestNotification] = useState(null);
    const [error, setError] = useState(null);
    const pollingIntervalRef = useRef(null);
    const pollingTimeoutRef = useRef(null);
    const subscriptionRef = useRef(null);
    const lastPollTimeRef = useRef(null);
    const clearOtp = useCallback(() => {
        setOtpCode(null);
        setOtpConfidence('none');
        setFullMessage(null);
        setLatestNotification(null);
    }, []);
    const stopListeningInternal = useCallback(() => {
        // Clean up WebSocket subscription
        if (subscriptionRef.current) {
            subscriptionRef.current.unsubscribe();
            subscriptionRef.current = null;
        }
        // Clean up polling
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        if (pollingTimeoutRef.current) {
            clearTimeout(pollingTimeoutRef.current);
            pollingTimeoutRef.current = null;
        }
        setIsListening(false);
        setConnectionType('disconnected');
    }, []);
    const handleOtpNotification = useCallback(async (notification) => {
        // Filter by type if specified
        if (type !== 'all' && notification.type !== type) {
            return;
        }
        // Filter by 'to' address if specified
        if (toFilter) {
            const filterLower = toFilter.toLowerCase();
            const toLower = notification.to.toLowerCase();
            // Partial match (e.g., "operations" matches "operations@example.com")
            if (!toLower.includes(filterLower) && !filterLower.includes(toLower.split('@')[0])) {
                return;
            }
        }
        // Always track the latest notification, even if extraction fails
        // This allows UI to show "last code was X days ago" even if we couldn't extract it
        setLatestNotification(notification);
        // Reveal the message to extract OTP
        try {
            const revealResult = await vaultApi.revealSmsMessage(notification.messageId);
            const otpResult = extractOtpWithConfidence(revealResult.body);
            if (otpResult.code) {
                setOtpCode(otpResult.code);
                setOtpConfidence(otpResult.confidence);
                setFullMessage(otpResult.fullMessage);
                onOtpReceived?.({
                    ...otpResult,
                    notification,
                });
                // Stop listening after receiving OTP unless keepListening is true
                if (!keepListening) {
                    stopListeningInternal();
                }
            }
            else {
                // No code extracted, but still notify about the message
                // This allows UI to show that a message was received but extraction failed
                onOtpReceived?.({
                    code: null,
                    confidence: 'none',
                    pattern: null,
                    fullMessage: otpResult.fullMessage,
                    notification,
                });
            }
        }
        catch (err) {
            console.error('[useOtpSubscription] Failed to reveal message:', err);
            // Still notify about the notification even if reveal failed
            onOtpReceived?.({
                code: null,
                confidence: 'none',
                pattern: null,
                fullMessage: '',
                notification,
            });
        }
    }, [type, toFilter, onOtpReceived, stopListeningInternal, keepListening]);
    const startListeningWebSocket = useCallback(async () => {
        try {
            const eventsClient = await getEventsClient();
            console.log('[useOtpSubscription] Attempting WebSocket connection, eventsClient available:', !!eventsClient);
            if (!eventsClient) {
                console.log('[useOtpSubscription] WebSocket not attempted: eventsClient is null/undefined. HIT SDK may not be installed or initialized.');
                return false;
            }
            console.log('[useOtpSubscription] Subscribing to vault.otp_received event via WebSocket');
            // Subscribe to vault OTP events
            subscriptionRef.current = eventsClient.subscribe('vault.otp_received', (event) => {
                handleOtpNotification(event.payload);
            });
            setConnectionType('websocket');
            console.log('[useOtpSubscription] Connected via WebSocket');
            return true;
        }
        catch (err) {
            console.error('[useOtpSubscription] WebSocket connection failed:', err);
            return false;
        }
    }, [handleOtpNotification]);
    const startListeningPolling = useCallback(() => {
        // Initialize with current time, but we'll update it after processing messages
        const initialTime = new Date();
        lastPollTimeRef.current = initialTime;
        pollingIntervalRef.current = setInterval(async () => {
            try {
                // Poll for new messages based on type
                // Use the last poll time to avoid re-processing old messages
                let messages = [];
                const since = lastPollTimeRef.current?.toISOString();
                // Update poll time BEFORE fetching to ensure we don't miss messages
                // that arrive during processing
                const pollStartTime = new Date();
                if (type === 'email' || type === 'all') {
                    const emailResult = await vaultApi.getLatestEmailMessages({ since });
                    messages = messages.concat(emailResult.messages.map((m) => ({ ...m, type: 'email' })));
                }
                if (type === 'sms' || type === 'all') {
                    const smsResult = await vaultApi.getLatestSmsMessages(since);
                    messages = messages.concat(smsResult.messages.map((m) => ({
                        id: m.id,
                        from: m.fromNumber,
                        to: m.toNumber,
                        receivedAt: m.receivedAt,
                        type: 'sms',
                    })));
                }
                // Process each message
                for (const msg of messages) {
                    await handleOtpNotification({
                        messageId: msg.id,
                        type: msg.type,
                        from: msg.from,
                        to: msg.to,
                        subject: msg.subject,
                        receivedAt: typeof msg.receivedAt === 'string' ? msg.receivedAt : msg.receivedAt.toISOString(),
                    });
                    // When keepListening is false, stop after processing first message that might have OTP
                    // When keepListening is true, continue processing all messages to catch multiple OTPs
                    // Note: We can't check otpCode here because it's a stale closure value,
                    // but handleOtpNotification will update state and call onOtpReceived callback
                    if (!keepListening) {
                        // For non-keepListening mode, process one message per poll cycle
                        // This allows the state to update before the next poll
                        break;
                    }
                    // When keepListening is true, continue processing all messages in this batch
                }
                // Update last poll time AFTER processing messages
                // This ensures we don't miss messages that arrive during processing
                lastPollTimeRef.current = pollStartTime;
            }
            catch (err) {
                console.error('[useOtpSubscription] Polling error:', err);
            }
        }, pollingInterval);
        // Auto-stop after max time
        pollingTimeoutRef.current = setTimeout(() => {
            console.log('[useOtpSubscription] Polling timeout reached');
            stopListeningInternal();
        }, maxPollTime);
        setConnectionType('polling');
        console.log('[useOtpSubscription] Connected via polling');
    }, [type, pollingInterval, maxPollTime, handleOtpNotification, stopListeningInternal, keepListening]);
    const startListening = useCallback(async () => {
        if (isListening)
            return;
        setIsListening(true);
        setError(null);
        clearOtp();
        console.log('[useOtpSubscription] Starting to listen, attempting WebSocket first...');
        // Try WebSocket first, fall back to polling
        const websocketSuccess = await startListeningWebSocket();
        if (!websocketSuccess) {
            console.log('[useOtpSubscription] WebSocket attempt failed, falling back to polling');
            startListeningPolling();
        }
    }, [isListening, clearOtp, startListeningWebSocket, startListeningPolling]);
    const stopListening = useCallback(() => {
        stopListeningInternal();
    }, [stopListeningInternal]);
    // Auto-start if enabled
    useEffect(() => {
        if (enabled && !isListening) {
            startListening();
        }
        return () => {
            stopListeningInternal();
        };
    }, [enabled]);
    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopListeningInternal();
        };
    }, [stopListeningInternal]);
    return {
        isListening,
        connectionType,
        otpCode,
        otpConfidence,
        fullMessage,
        latestNotification,
        startListening,
        stopListening,
        clearOtp,
        error,
    };
}
/**
 * Get the current WebSocket connection status
 */
export async function getWebSocketStatus() {
    await loadHitSdk();
    const eventsClient = await getEventsClient();
    if (!eventsClient) {
        return 'unavailable';
    }
    return eventsClient.getStatus();
}
/**
 * Check if WebSocket is available
 * Note: This is synchronous but may return false initially while SDK loads.
 * The SDK loads in the background, so subsequent calls will return true if available.
 */
export function isWebSocketAvailable() {
    // Trigger background load if not already started
    if (!sdkLoadPromise && typeof window !== 'undefined') {
        loadHitSdk().catch(() => {
            // Ignore errors
        });
    }
    return HitEventsClass !== null;
}
