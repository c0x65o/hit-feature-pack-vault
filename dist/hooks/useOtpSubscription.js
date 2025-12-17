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
let eventsClient = null;
try {
    // Dynamic import to avoid build errors when SDK not installed
    const hitSdk = require('@hit/sdk');
    eventsClient = hitSdk.events;
    console.log('[useOtpSubscription] HIT SDK loaded successfully, eventsClient available:', !!eventsClient);
}
catch (e) {
    // SDK not available - will use polling fallback
    console.log('[useOtpSubscription] HIT SDK not available, will use polling fallback. Error:', e);
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
    const { type = 'all', toFilter, onOtpReceived, enabled = true, pollingInterval = 2000, maxPollTime = 5 * 60 * 1000, } = options;
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
        // Reveal the message to extract OTP
        try {
            const revealResult = await vaultApi.revealSmsMessage(notification.messageId);
            const otpResult = extractOtpWithConfidence(revealResult.body);
            if (otpResult.code) {
                setOtpCode(otpResult.code);
                setOtpConfidence(otpResult.confidence);
                setFullMessage(otpResult.fullMessage);
                setLatestNotification(notification);
                onOtpReceived?.({
                    ...otpResult,
                    notification,
                });
                // Stop listening after receiving OTP
                stopListeningInternal();
            }
        }
        catch (err) {
            console.error('[useOtpSubscription] Failed to reveal message:', err);
        }
    }, [type, toFilter, onOtpReceived]);
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
    const startListeningWebSocket = useCallback(() => {
        console.log('[useOtpSubscription] Attempting WebSocket connection, eventsClient available:', !!eventsClient);
        if (!eventsClient) {
            console.log('[useOtpSubscription] WebSocket not attempted: eventsClient is null/undefined. HIT SDK may not be installed or initialized.');
            return false;
        }
        try {
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
        lastPollTimeRef.current = new Date();
        pollingIntervalRef.current = setInterval(async () => {
            try {
                // Poll for new messages based on type
                let messages = [];
                const since = lastPollTimeRef.current?.toISOString();
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
                    // Stop if we found an OTP
                    if (otpCode) {
                        break;
                    }
                }
                lastPollTimeRef.current = new Date();
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
    }, [type, pollingInterval, maxPollTime, handleOtpNotification, stopListeningInternal, otpCode]);
    const startListening = useCallback(() => {
        if (isListening)
            return;
        setIsListening(true);
        setError(null);
        clearOtp();
        console.log('[useOtpSubscription] Starting to listen, attempting WebSocket first...');
        // Try WebSocket first, fall back to polling
        if (!startListeningWebSocket()) {
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
export function getWebSocketStatus() {
    if (!eventsClient) {
        return 'unavailable';
    }
    return eventsClient.getStatus();
}
/**
 * Check if WebSocket is available
 */
export function isWebSocketAvailable() {
    return eventsClient !== null;
}
