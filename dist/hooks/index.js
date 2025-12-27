/**
 * Vault Hooks
 * Exported individually for tree-shaking
 */
// NOTE: The inbound SMS/email OTP inbox was removed.
//
// However, some apps still import these symbols from `@hit/feature-pack-vault/hooks`
// (e.g. dashboard shell WebSocket status indicators). To avoid breaking builds,
// we provide no-op compatibility exports that always report "disconnected".
import { useCallback, useEffect, useRef, useState } from 'react';
export function useOtpSubscription(opts = {}) {
    const enabled = Boolean(opts.enabled);
    const [isListening, setIsListening] = useState(false);
    const [error, setError] = useState(null);
    const warnedRef = useRef(false);
    useEffect(() => {
        if (!enabled) {
            setIsListening(false);
            setError(null);
            return;
        }
        setIsListening(true);
        if (!warnedRef.current) {
            warnedRef.current = true;
            setError(new Error('Vault inbound OTP inbox is disabled (SMS/email webhook receiving removed).'));
        }
    }, [enabled]);
    const startListening = useCallback(() => setIsListening(true), []);
    const stopListening = useCallback(() => setIsListening(false), []);
    const clearOtp = useCallback(() => void 0, []);
    return {
        isListening,
        connectionType: 'disconnected',
        otpCode: null,
        otpConfidence: 'none',
        fullMessage: null,
        latestNotification: null,
        startListening,
        stopListening,
        clearOtp,
        error,
    };
}
export function getGlobalWsStatus() {
    return 'disconnected';
}
export function subscribeGlobalWsStatus(_listener) {
    // No-op (WebSocket OTP stream removed)
    return () => { };
}
export function getGlobalOtpConnectionType() {
    return 'disconnected';
}
export function subscribeGlobalOtpConnectionType(_listener) {
    return () => { };
}
export async function getWebSocketStatus() {
    return 'unavailable';
}
export function isWebSocketAvailable() {
    return false;
}
export async function ensureVaultRealtimeConnection() {
    return () => { };
}
