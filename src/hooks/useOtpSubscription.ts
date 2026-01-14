/**
 * OTP Subscription Hook
 *
 * Provides real-time OTP notifications via websocket-core (first-party).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence, type OtpExtractionResult } from '../utils/otp-extractor';
import { getRealtimeClient } from '@hit/feature-pack-websocket-core/client';

// OTP codes older than this are considered stale and not treated as "new"
const OTP_FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

// Lazy load HIT_CONFIG to avoid breaking Turbopack resolution
// Feature packs shouldn't directly import @/ but this is legacy code
let HIT_CONFIG: any = null;
async function loadHitConfig() {
  if (HIT_CONFIG !== null) return HIT_CONFIG;
  try {
    // Dynamic import works in Next.js client components
    const mod = await import('@/lib/hit-config.generated');
    HIT_CONFIG = mod.HIT_CONFIG;
    return HIT_CONFIG;
  } catch (err) {
    console.warn('[useOtpSubscription] Could not load HIT_CONFIG:', err);
    HIT_CONFIG = {};
    return HIT_CONFIG;
  }
}

function getVaultRealtimeOtpConfig(): { enabled: boolean; eventType: string } {
  // Use synchronous default values; the actual config is loaded async
  // This function is kept for backwards compatibility but relies on HIT_CONFIG being loaded
  try {
    const opts = HIT_CONFIG?.featurePacks?.vault ?? {};
    const enabled = (opts.realtime_otp_enabled as boolean | undefined) ?? true;
    const eventType = (opts.realtime_otp_event_type as string | undefined) ?? 'vault.otp_received';
    return { enabled: Boolean(enabled), eventType: eventType || 'vault.otp_received' };
  } catch {
    return { enabled: true, eventType: 'vault.otp_received' };
  }
}

let realtimeClientInstance: ReturnType<typeof getRealtimeClient> | null = null;

// Global WebSocket connection status (updated by the events client)
let globalWsStatus: 'connecting' | 'connected' | 'disconnected' | 'error' = 'disconnected';

// Listeners for WebSocket status changes
const wsStatusListeners: Set<(status: 'connecting' | 'connected' | 'disconnected' | 'error') => void> = new Set();

function notifyWsStatusChange(status: 'connecting' | 'connected' | 'disconnected' | 'error') {
  globalWsStatus = status;
  for (const listener of wsStatusListeners) {
    listener(status);
  }
}

/**
 * Subscribe to global WebSocket status changes (shared across all vault OTP subscribers).
 */
export function subscribeGlobalWsStatus(
  listener: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => void
): () => void {
  wsStatusListeners.add(listener);
  // Immediately emit current value
  try {
    listener(globalWsStatus);
  } catch {
    // ignore
  }
  return () => wsStatusListeners.delete(listener);
}

/**
 * Get the current global WebSocket status (shared across all vault OTP subscribers).
 */
export function getGlobalWsStatus(): 'connecting' | 'connected' | 'disconnected' | 'error' {
  return globalWsStatus;
}

// Global OTP connection type (derived from the hook's connectionType state)
let globalOtpConnectionType: 'websocket' | 'disconnected' = 'disconnected';
const otpConnectionTypeListeners: Set<(t: 'websocket' | 'disconnected') => void> = new Set();

function notifyOtpConnectionTypeChange(t: 'websocket' | 'disconnected') {
  globalOtpConnectionType = t;
  for (const listener of otpConnectionTypeListeners) {
    listener(t);
  }
}

export function getGlobalOtpConnectionType(): 'websocket' | 'disconnected' {
  return globalOtpConnectionType;
}

export function subscribeGlobalOtpConnectionType(
  listener: (t: 'websocket' | 'disconnected') => void
): () => void {
  otpConnectionTypeListeners.add(listener);
  try {
    listener(globalOtpConnectionType);
  } catch {
    // ignore
  }
  return () => otpConnectionTypeListeners.delete(listener);
}

async function getRealtime(): Promise<ReturnType<typeof getRealtimeClient>> {
  if (!realtimeClientInstance) {
    realtimeClientInstance = getRealtimeClient({
      wsPath: '/ws',
      clientName: 'vault-otp',
      onStatusChange: (status) => notifyWsStatusChange(status),
      onError: (error) => console.warn('[useOtpSubscription] WebSocket error:', error.message),
    });
  }
  return realtimeClientInstance;
}

/**
 * Get the current global WebSocket connection status
 */
// (Deprecated duplicate removed) getGlobalWsStatus is defined above.

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
  onOtpReceived?: (result: OtpExtractionResult & { notification: OtpNotification }) => void;
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

function normalizePhone(value: string): string {
  // Keep digits only. For E.164 we want to compare the full number when available,
  // but also tolerate formats like "(555) 123-4567" by comparing suffixes.
  return value.replace(/[^\d]/g, '');
}

function isPhoneLike(value: string | null | undefined): boolean {
  if (!value) return false;
  return normalizePhone(value).length > 0;
}

function matchesToFilter(toValue: string, filterValue: string): boolean {
  const to = (toValue || '').trim();
  const filter = (filterValue || '').trim();
  if (!to || !filter) return false;

  // Email-ish filter
  if (filter.includes('@') || to.includes('@')) {
    const filterLower = filter.toLowerCase();
    const toLower = to.toLowerCase();
    if (toLower.includes(filterLower)) return true;
    // Also allow matching just the local-part for convenience (e.g. "operations")
    const toLocal = toLower.split('@')[0] || toLower;
    const filterLocal = filterLower.split('@')[0] || filterLower;
    return toLocal.includes(filterLocal) || filterLocal.includes(toLocal);
  }

  // Phone-ish filter: compare digit-only forms, then suffix-match to handle missing country code.
  const toDigits = normalizePhone(to);
  const filterDigits = normalizePhone(filter);
  if (!toDigits || !filterDigits) return false;
  if (toDigits === filterDigits) return true;
  // Suffix compare: last 10 digits is a common baseline; also allow shorter
  const suffixLen = Math.min(10, toDigits.length, filterDigits.length);
  if (suffixLen <= 0) return false;
  return toDigits.slice(-suffixLen) === filterDigits.slice(-suffixLen);
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
export function useOtpSubscription(options: UseOtpSubscriptionOptions = {}): UseOtpSubscriptionResult {
  const {
    type = 'all',
    toFilter,
    onOtpReceived,
    enabled = true,
    keepListening = false,
    skipMessageId,
    minReceivedAt,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [connectionType, setConnectionType] = useState<'websocket' | 'disconnected'>('disconnected');
  const [realWsStatus, setRealWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(globalWsStatus);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpConfidence, setOtpConfidence] = useState<OtpExtractionResult['confidence']>('none');
  const [fullMessage, setFullMessage] = useState<string | null>(null);
  const [latestNotification, setLatestNotification] = useState<OtpNotification | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const subscriptionRef = useRef<any>(null);
  const usingWebSocketRef = useRef(false);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  const isListeningRef = useRef(false);
  const startListeningRef = useRef<(() => Promise<void>) | null>(null);
  const stopListeningRef = useRef<(() => void) | null>(null);
  // Keep dynamic options in a ref so we don't rebuild callbacks every render.
  // This prevents render loops when callers pass inline functions (e.g., VaultSetup).
  const optionsRef = useRef<Pick<
    UseOtpSubscriptionOptions,
    'type' | 'toFilter' | 'onOtpReceived' | 'keepListening' | 'skipMessageId' | 'minReceivedAt'
  >>({
    type,
    toFilter,
    onOtpReceived,
    keepListening,
    skipMessageId,
    minReceivedAt,
  });

  useEffect(() => {
    optionsRef.current = {
      type,
      toFilter,
      onOtpReceived,
      keepListening,
      skipMessageId,
      minReceivedAt,
    };
  }, [type, toFilter, onOtpReceived, keepListening, skipMessageId, minReceivedAt]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);
  
  // Update processed IDs when skipMessageId changes
  useEffect(() => {
    if (skipMessageId && isListening) {
      processedMessageIdsRef.current.add(skipMessageId);
      console.log('[useOtpSubscription] Added skipMessageId to processed set:', skipMessageId);
    }
  }, [skipMessageId, isListening]);
  
  // Subscribe to global WebSocket status changes (once; shared across subscribers)
  useEffect(() => {
    return subscribeGlobalWsStatus((status) => {
      setRealWsStatus(status);
      // Only update connectionType if we're trying to use WebSocket
      if (usingWebSocketRef.current) {
        if (status === 'connected') {
          setConnectionType('websocket');
        } else if (status === 'error' || status === 'disconnected') {
          setConnectionType('disconnected');
        }
      }
    });
  }, []);

  // Keep a global view of OTP connection type for hosts (like dashboard shell footer).
  useEffect(() => {
    notifyOtpConnectionTypeChange(connectionType);
  }, [connectionType]);

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
    usingWebSocketRef.current = false;
    
    // Clear processed message IDs
    processedMessageIdsRef.current.clear();

    setIsListening(false);
    setConnectionType('disconnected');
  }, []);

  const handleOtpNotification = useCallback(async (notification: OtpNotification) => {
    const {
      type: optType = 'all',
      toFilter: optToFilter,
      onOtpReceived: optOnOtpReceived,
      keepListening: optKeepListening = false,
      skipMessageId: optSkipMessageId,
      minReceivedAt: optMinReceivedAt,
    } = optionsRef.current || {};

    // Skip if this is the message ID we're supposed to skip (e.g., already loaded on modal open)
    if (optSkipMessageId && notification.messageId === optSkipMessageId) {
      console.log('[useOtpSubscription] Skipping message (matches skipMessageId):', notification.messageId);
      return;
    }

    // Skip any notifications received at/before the baseline (prevents old OTPs from being treated as new)
    if (optMinReceivedAt) {
      const baseline =
        typeof optMinReceivedAt === 'string' ? new Date(optMinReceivedAt) : optMinReceivedAt;
      const baselineMs = baseline?.getTime?.();
      if (Number.isFinite(baselineMs)) {
        const receivedAtMs = new Date(notification.receivedAt).getTime();
        if (Number.isFinite(receivedAtMs) && receivedAtMs <= (baselineMs as number)) {
          console.log('[useOtpSubscription] Skipping message (receivedAt <= minReceivedAt):', {
            messageId: notification.messageId,
            receivedAt: notification.receivedAt,
            minReceivedAt:
              typeof optMinReceivedAt === 'string' ? optMinReceivedAt : baseline.toISOString(),
          });
          return;
        }
      }
    }

    // Filter by type if specified
    if (optType !== 'all' && notification.type !== optType) {
      return;
    }

    // Filter by 'to' address if specified
    if (optToFilter) {
      // SMS providers sometimes send non-phone identifiers for "to" (e.g. "recipient").
      // If we're dealing with SMS and either side isn't phone-like, do not filter.
      if (notification.type === 'sms') {
        const filterIsPhone = isPhoneLike(optToFilter);
        const toIsPhone = isPhoneLike(notification.to);
        if (filterIsPhone && toIsPhone && !matchesToFilter(notification.to, optToFilter)) {
          return;
        }
      } else {
        if (!matchesToFilter(notification.to, optToFilter)) {
          return;
        }
      }
    }

    // Skip messages that are too old (> 5 minutes) - these are stale OTPs
    const receivedAt = new Date(notification.receivedAt);
    const messageAgeMs = Date.now() - receivedAt.getTime();
    if (messageAgeMs > OTP_FRESHNESS_THRESHOLD_MS) {
      console.log(`[useOtpSubscription] Skipping stale message (${Math.round(messageAgeMs / 1000 / 60)} mins old):`, notification.messageId);
      return;
    }

    // Deduplicate accepted notifications (prevents polling/WebSocket duplicates)
    if (processedMessageIdsRef.current.has(notification.messageId)) {
      return;
    }
    processedMessageIdsRef.current.add(notification.messageId);

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
        
        optOnOtpReceived?.({
          ...otpResult,
          notification,
        });

        // Stop listening after receiving OTP unless keepListening is true
        if (!optKeepListening) {
          stopListeningInternal();
        }
      } else {
        // No code extracted, but still notify about the message
        // This allows UI to show that a message was received but extraction failed
        optOnOtpReceived?.({
          code: null,
          confidence: 'none',
          pattern: null,
          fullMessage: otpResult.fullMessage,
          notification,
        });
      }
    } catch (err) {
      console.error('[useOtpSubscription] Failed to reveal message:', err);
      // Still notify about the notification even if reveal failed
      optOnOtpReceived?.({
        code: null,
        confidence: 'none',
        pattern: null,
        fullMessage: '',
        notification,
      });
    }
  }, [stopListeningInternal]);

  const startListeningWebSocket = useCallback(async () => {
    try {
      // Ensure config is loaded before checking
      await loadHitConfig();
      const realtimeCfg = getVaultRealtimeOtpConfig();
      if (!realtimeCfg.enabled) {
        console.log('[useOtpSubscription] WebSocket realtime disabled by vault config (realtime_otp_enabled=false)');
        usingWebSocketRef.current = false;
        return false;
      }

      // If we already have a subscription, don't re-subscribe.
      if (subscriptionRef.current) {
        const client = await getRealtime();
        const actualStatus = client?.getStatus?.() || globalWsStatus;
        console.log('[useOtpSubscription] WebSocket already has an active subscription; status:', actualStatus);
        usingWebSocketRef.current = actualStatus === 'connected' || actualStatus === 'connecting';
        if (actualStatus === 'connected') setConnectionType('websocket');
        return actualStatus === 'connected' || actualStatus === 'connecting';
      }

      const client = await getRealtime();

      // Mark that we're attempting WebSocket
      usingWebSocketRef.current = true;

      console.log('[useOtpSubscription] Subscribing to OTP event via WebSocket:', realtimeCfg.eventType);
      // Subscribe to vault OTP events - this triggers the WebSocket connection
      subscriptionRef.current = (client as any).subscribe(
        realtimeCfg.eventType,
        (event: { payload: OtpNotification }) => {
          handleOtpNotification(event.payload);
        }
      );

      // Check the actual WebSocket status from the client
      const actualStatus = client.getStatus?.() || globalWsStatus;
      console.log('[useOtpSubscription] Actual WebSocket status:', actualStatus);
      
      // Set connectionType based on real status
      // If still connecting, the status listener will update when connected
      if (actualStatus === 'connected') {
        setConnectionType('websocket');
        console.log('[useOtpSubscription] WebSocket already connected');
      } else if (actualStatus === 'connecting') {
        // Keep as 'disconnected' until actually connected - status listener will update
        setConnectionType('disconnected');
        console.log('[useOtpSubscription] WebSocket is connecting...');
      } else {
        // Disconnected or error
        console.log('[useOtpSubscription] WebSocket not connected, status:', actualStatus);
        usingWebSocketRef.current = false;
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('[useOtpSubscription] WebSocket connection failed:', err);
      usingWebSocketRef.current = false;
      return false;
    }
  }, [handleOtpNotification]);

  const startListening = useCallback(async () => {
    if (isListeningRef.current) return;

    setIsListening(true);
    setError(null);
    clearOtp();

    console.log('[useOtpSubscription] Starting to listen...');

    const websocketSuccess = await startListeningWebSocket();
    if (!websocketSuccess) {
      setConnectionType('disconnected');
      setError(new Error('WebSocket unavailable or not connected'));
      console.log('[useOtpSubscription] WebSocket unavailable; staying disconnected (no polling fallback)');
    }
  }, [clearOtp, startListeningWebSocket]);

  const stopListening = useCallback(() => {
    stopListeningInternal();
  }, [stopListeningInternal]);

  // Keep stable refs to the latest start/stop logic.
  useEffect(() => {
    startListeningRef.current = startListening;
    stopListeningRef.current = stopListeningInternal;
  }, [startListening, stopListeningInternal]);

  // Auto-start/stop based on enabled.
  // Key property: this effect only depends on `enabled`, so it cannot thrash due to callback identity changes
  // (which can happen via re-mount patterns, bundler transforms, or other indirect causes).
  useEffect(() => {
    if (enabled) {
      void startListeningRef.current?.();
      return () => {
        // When enabled flips false or component unmounts, clean up subscription.
        stopListeningRef.current?.();
      };
    }

    // If disabled, ensure we're not listening.
    stopListeningRef.current?.();
    return () => {};
  }, [enabled]);

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
export async function getWebSocketStatus(): Promise<'connected' | 'connecting' | 'disconnected' | 'error' | 'unavailable'> {
  const c = await getRealtime();
  return c.getStatus();
}

/**
 * Check if WebSocket is available
 * Note: This is synchronous but may return false initially while SDK loads.
 * The SDK loads in the background, so subsequent calls will return true if available.
 */
export function isWebSocketAvailable(): boolean {
  return typeof window !== 'undefined';
}

// -----------------------------------------------------------------------------
// Global connection bootstrap (for dashboard shell / app-level initialization)
// -----------------------------------------------------------------------------

let _keepaliveSub: { unsubscribe: () => void } | null = null;

/**
 * Ensure the vault events WebSocket is connected by installing a lightweight
 * subscription to the vault OTP event type. This keeps a single global Events
 * client connected so feature-pack UIs can "hand off" without re-connecting.
 *
 * Call this once at app startup (e.g., dashboard shell layout).
 */
export async function ensureVaultRealtimeConnection(): Promise<() => void> {
  // Ensure config is loaded before checking
  await loadHitConfig();
  const realtimeCfg = getVaultRealtimeOtpConfig();
  if (!realtimeCfg.enabled) {
    return () => {};
  }

  if (!_keepaliveSub) {
    try {
      const client = await getRealtime();
      _keepaliveSub = (client as any).subscribe(
        realtimeCfg.eventType,
        // Keepalive subscription: no-op handler (we only want the connection)
        () => {}
      );
    } catch {
      _keepaliveSub = null;
    }
  }

  return () => {
    try {
      _keepaliveSub?.unsubscribe();
    } finally {
      _keepaliveSub = null;
    }
  };
}

