/**
 * OTP Subscription Hook
 * 
 * Provides real-time OTP code notifications via WebSocket.
 * Uses the HIT Events SDK when available; if WebSocket isn't available/connected,
 * we surface a disconnected state (no polling fallback).
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence, type OtpExtractionResult } from '../utils/otp-extractor';

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

// Try to import HIT SDK events - may not be available in all setups
// Use ES6 imports (not require) for browser compatibility
let HitEventsClass: any = null;
let getWebSocketUrlFn: any = null;
let sdkLoadPromise: Promise<void> | null = null;

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
    } catch (e) {
      // SDK not available - realtime will remain disconnected
      console.log('[useOtpSubscription] HIT SDK not available, realtime will remain disconnected. Error:', e);
    }
  })();
  
  return sdkLoadPromise;
}

// Pre-load SDK in the background (non-blocking)
if (typeof window !== 'undefined') {
  loadHitSdk().catch(() => {
    // Ignore errors - realtime will remain disconnected
  });
}

// Global events client instance (created lazily when needed)
let eventsClientInstance: any = null;

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

/**
 * Get or create the events client instance
 */
async function getEventsClient(): Promise<any> {
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
    // IMPORTANT: Must match HIT_PROJECT_SLUG used by server-side publish-event.ts
    // Default to 'hit-dashboard' to match the server's default
    const EVENTS_CHANNEL = typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_HIT_EVENTS_CHANNEL 
      ? process.env.NEXT_PUBLIC_HIT_EVENTS_CHANNEL 
      : (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_HIT_PROJECT_SLUG
        ? process.env.NEXT_PUBLIC_HIT_PROJECT_SLUG
        : 'hit-dashboard');
    
    console.log('[useOtpSubscription] Creating events client with:', {
      wsUrl: EVENTS_WS_URL || '(auto-discover)',
      channel: EVENTS_CHANNEL,
    });
    
    eventsClientInstance = new HitEventsClass({
      baseUrl: EVENTS_WS_URL,
      projectSlug: EVENTS_CHANNEL,
      useSSE: false, // Use WebSocket
      onStatusChange: (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
        console.log('[useOtpSubscription] WebSocket status changed:', status);
        notifyWsStatusChange(status);
      },
      onError: (error: Error) => {
        console.warn('[useOtpSubscription] WebSocket error:', error.message);
      },
    });
  }
  
  return eventsClientInstance;
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
      const filterLower = optToFilter.toLowerCase();
      const toLower = notification.to.toLowerCase();
      // Partial match (e.g., "operations" matches "operations@example.com")
      if (!toLower.includes(filterLower) && !filterLower.includes(toLower.split('@')[0])) {
        return;
      }
    }

    // Skip messages that are too old (> 5 minutes) - these are stale OTPs
    const receivedAt = new Date(notification.receivedAt);
    const messageAgeMs = Date.now() - receivedAt.getTime();
    if (messageAgeMs > OTP_FRESHNESS_THRESHOLD_MS) {
      console.log(`[useOtpSubscription] Skipping stale message (${Math.round(messageAgeMs / 1000 / 60)} mins old):`, notification.messageId);
      return;
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
        const eventsClient = await getEventsClient();
        const actualStatus = eventsClient?.getStatus?.() || globalWsStatus;
        console.log('[useOtpSubscription] WebSocket already has an active subscription; status:', actualStatus);
        usingWebSocketRef.current = actualStatus === 'connected' || actualStatus === 'connecting';
        if (actualStatus === 'connected') setConnectionType('websocket');
        return actualStatus === 'connected' || actualStatus === 'connecting';
      }

      const eventsClient = await getEventsClient();
      console.log('[useOtpSubscription] Attempting WebSocket connection, eventsClient available:', !!eventsClient);
      
      if (!eventsClient) {
        console.log('[useOtpSubscription] WebSocket not attempted: eventsClient is null/undefined. HIT SDK may not be installed or initialized.');
        usingWebSocketRef.current = false;
        return false;
      }

      // Mark that we're attempting WebSocket
      usingWebSocketRef.current = true;

      console.log('[useOtpSubscription] Subscribing to OTP event via WebSocket:', realtimeCfg.eventType);
      // Subscribe to vault OTP events - this triggers the WebSocket connection
      subscriptionRef.current = (eventsClient as any).subscribe(
        realtimeCfg.eventType,
        (event: { payload: OtpNotification }) => {
          handleOtpNotification(event.payload);
        }
      );

      // Check the actual WebSocket status from the client
      const actualStatus = eventsClient.getStatus?.() || globalWsStatus;
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
export function isWebSocketAvailable(): boolean {
  // Trigger background load if not already started
  if (!sdkLoadPromise && typeof window !== 'undefined') {
    loadHitSdk().catch(() => {
      // Ignore errors
    });
  }
  return HitEventsClass !== null;
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

  const eventsClient = await getEventsClient();
  if (!eventsClient) {
    return () => {};
  }

  if (!_keepaliveSub) {
    try {
      _keepaliveSub = (eventsClient as any).subscribe(
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

