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

export type OtpNotification = {
  messageId: string;
  type: 'sms' | 'email';
  from: string;
  to: string;
  subject?: string;
  receivedAt: string;
};

export type UseOtpSubscriptionOptions = {
  type?: 'sms' | 'email' | 'all';
  toFilter?: string;
  onOtpReceived?: (result: any) => void;
  enabled?: boolean;
  keepListening?: boolean;
  skipMessageId?: string | null;
  minReceivedAt?: Date | string | null;
};

export type UseOtpSubscriptionResult = {
  isListening: boolean;
  connectionType: 'websocket' | 'disconnected';
  otpCode: string | null;
  otpConfidence: 'high' | 'medium' | 'low' | 'none';
  fullMessage: string | null;
  latestNotification: OtpNotification | null;
  startListening: () => void;
  stopListening: () => void;
  clearOtp: () => void;
  error: Error | null;
};

export function useOtpSubscription(opts: UseOtpSubscriptionOptions = {}): UseOtpSubscriptionResult {
  const enabled = Boolean(opts.enabled);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState<Error | null>(null);
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

export function getGlobalWsStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
  return 'disconnected';
}

export function subscribeGlobalWsStatus(
  _listener: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
): () => void {
  // No-op (WebSocket OTP stream removed)
  return () => {};
}

export function getGlobalOtpConnectionType(): 'websocket' | 'disconnected' {
  return 'disconnected';
}

export function subscribeGlobalOtpConnectionType(
  _listener: (t: 'websocket' | 'disconnected') => void
): () => void {
  return () => {};
}

export async function getWebSocketStatus(): Promise<
  'connected' | 'connecting' | 'disconnected' | 'error' | 'unavailable'
> {
  return 'unavailable';
}

export function isWebSocketAvailable(): boolean {
  return false;
}

export async function ensureVaultRealtimeConnection(): Promise<() => void> {
  return () => {};
}
