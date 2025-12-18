/**
 * OTP Subscription Hook
 * 
 * Provides real-time OTP code notifications via WebSocket with polling fallback.
 * Uses the HIT Events SDK when available, falls back to API polling otherwise.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence, type OtpExtractionResult } from '../utils/otp-extractor';
import { HIT_CONFIG } from '@/lib/hit-config.generated';

// OTP codes older than this are considered stale and not treated as "new"
const OTP_FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function getVaultRealtimeOtpConfig(): { enabled: boolean; eventType: string } {
  try {
    const opts = (HIT_CONFIG as any)?.featurePacks?.vault ?? {};
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
let globalOtpConnectionType: 'websocket' | 'polling' | 'disconnected' = 'disconnected';
const otpConnectionTypeListeners: Set<(t: 'websocket' | 'polling' | 'disconnected') => void> = new Set();

function notifyOtpConnectionTypeChange(t: 'websocket' | 'polling' | 'disconnected') {
  globalOtpConnectionType = t;
  for (const listener of otpConnectionTypeListeners) {
    listener(t);
  }
}

export function getGlobalOtpConnectionType(): 'websocket' | 'polling' | 'disconnected' {
  return globalOtpConnectionType;
}

export function subscribeGlobalOtpConnectionType(
  listener: (t: 'websocket' | 'polling' | 'disconnected') => void
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
  /** Polling interval in ms when WebSocket not available (default: 2000) */
  pollingInterval?: number;
  /** Max time to poll in ms (default: 5 minutes) */
  maxPollTime?: number;
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
export function useOtpSubscription(options: UseOtpSubscriptionOptions = {}): UseOtpSubscriptionResult {
  const {
    type = 'all',
    toFilter,
    onOtpReceived,
    enabled = true,
    pollingInterval = 2000,
    maxPollTime = 5 * 60 * 1000,
    keepListening = false,
    skipMessageId,
    minReceivedAt,
  } = options;

  const [isListening, setIsListening] = useState(false);
  const [connectionType, setConnectionType] = useState<'websocket' | 'polling' | 'disconnected'>('disconnected');
  const [realWsStatus, setRealWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(globalWsStatus);
  const [otpCode, setOtpCode] = useState<string | null>(null);
  const [otpConfidence, setOtpConfidence] = useState<OtpExtractionResult['confidence']>('none');
  const [fullMessage, setFullMessage] = useState<string | null>(null);
  const [latestNotification, setLatestNotification] = useState<OtpNotification | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const subscriptionRef = useRef<any>(null);
  const lastPollTimeRef = useRef<Date | null>(null);
  const usingWebSocketRef = useRef(false);
  const processedMessageIdsRef = useRef<Set<string>>(new Set());
  
  // Update processed IDs when skipMessageId changes
  useEffect(() => {
    if (skipMessageId && isListening) {
      processedMessageIdsRef.current.add(skipMessageId);
      console.log('[useOtpSubscription] Added skipMessageId to processed set:', skipMessageId);
    }
  }, [skipMessageId, isListening]);
  
  // Subscribe to global WebSocket status changes
  useEffect(() => {
    const handleStatusChange = (status: 'connecting' | 'connected' | 'disconnected' | 'error') => {
      setRealWsStatus(status);
      // Only update connectionType if we're trying to use WebSocket
      if (usingWebSocketRef.current) {
        if (status === 'connected') {
          setConnectionType('websocket');
        } else if (status === 'error' || status === 'disconnected') {
          // WebSocket failed/disconnected, show polling status if polling is active
          if (isListening && pollingIntervalRef.current) {
            console.log('[useOtpSubscription] WebSocket disconnected/error, showing polling status');
            setConnectionType('polling');
          }
        }
      }
    };
    
    wsStatusListeners.add(handleStatusChange);
    return () => {
      wsStatusListeners.delete(handleStatusChange);
    };
  }, [isListening]);

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

    // Clean up polling
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (pollingTimeoutRef.current) {
      clearTimeout(pollingTimeoutRef.current);
      pollingTimeoutRef.current = null;
    }
    
    // Clear processed message IDs
    processedMessageIdsRef.current.clear();

    setIsListening(false);
    setConnectionType('disconnected');
  }, []);

  const handleOtpNotification = useCallback(async (notification: OtpNotification) => {
    // Skip if this is the message ID we're supposed to skip (e.g., already loaded on modal open)
    if (skipMessageId && notification.messageId === skipMessageId) {
      console.log('[useOtpSubscription] Skipping message (matches skipMessageId):', notification.messageId);
      return;
    }

    // Skip any notifications received at/before the baseline (prevents old OTPs from being treated as new)
    if (minReceivedAt) {
      const baseline = typeof minReceivedAt === 'string' ? new Date(minReceivedAt) : minReceivedAt;
      const baselineMs = baseline?.getTime?.();
      if (Number.isFinite(baselineMs)) {
        const receivedAtMs = new Date(notification.receivedAt).getTime();
        if (Number.isFinite(receivedAtMs) && receivedAtMs <= (baselineMs as number)) {
          console.log('[useOtpSubscription] Skipping message (receivedAt <= minReceivedAt):', {
            messageId: notification.messageId,
            receivedAt: notification.receivedAt,
            minReceivedAt: typeof minReceivedAt === 'string' ? minReceivedAt : baseline.toISOString(),
          });
          return;
        }
      }
    }

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
        
        onOtpReceived?.({
          ...otpResult,
          notification,
        });

        // Stop listening after receiving OTP unless keepListening is true
        if (!keepListening) {
          stopListeningInternal();
        }
      } else {
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
    } catch (err) {
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
  }, [type, toFilter, skipMessageId, minReceivedAt, onOtpReceived, stopListeningInternal, keepListening]);

  const startListeningWebSocket = useCallback(async () => {
    try {
      const realtimeCfg = getVaultRealtimeOtpConfig();
      if (!realtimeCfg.enabled) {
        console.log('[useOtpSubscription] WebSocket realtime disabled by vault config (realtime_otp_enabled=false)');
        usingWebSocketRef.current = false;
        return false;
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
        // Disconnected or error - will need polling fallback
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

  const startListeningPolling = useCallback(() => {
    // Initialize with current time minus a buffer for clock skew between client and server
    // This ensures we don't miss messages if server clock is behind client clock
    const CLOCK_SKEW_BUFFER_MS = 30000; // 30 seconds buffer
    const initialTime = new Date(Date.now() - CLOCK_SKEW_BUFFER_MS);
    lastPollTimeRef.current = initialTime;
    
    // Clear processed IDs on start, but mark skipMessageId as already processed
    processedMessageIdsRef.current.clear();
    if (skipMessageId) {
      processedMessageIdsRef.current.add(skipMessageId);
      console.log('[useOtpSubscription] Marking skipMessageId as already processed:', skipMessageId);
    }

    pollingIntervalRef.current = setInterval(async () => {
      try {
        // Poll for new messages based on type
        // Use the last poll time with buffer to avoid missing messages due to clock skew
        let messages: any[] = [];
        
        // Apply buffer to since time to account for clock skew
        const sinceTime = lastPollTimeRef.current 
          ? new Date(lastPollTimeRef.current.getTime() - CLOCK_SKEW_BUFFER_MS)
          : null;
        const since = sinceTime?.toISOString();
        
        // Update poll time BEFORE fetching to ensure we don't miss messages
        // that arrive during processing
        const pollStartTime = new Date();

        if (type === 'email' || type === 'all') {
          const emailResult = await vaultApi.getLatestEmailMessages({ since });
          messages = messages.concat(
            emailResult.messages.map((m) => ({ ...m, type: 'email' as const }))
          );
        }

        if (type === 'sms' || type === 'all') {
          const smsResult = await vaultApi.getLatestSmsMessages(since);
          messages = messages.concat(
            smsResult.messages.map((m) => ({
              id: m.id,
              from: m.fromNumber,
              to: m.toNumber,
              receivedAt: m.receivedAt,
              type: 'sms' as const,
            }))
          );
        }

        // Filter out already-processed messages (prevents duplicates from clock skew buffer)
        const newMessages = messages.filter(msg => !processedMessageIdsRef.current.has(msg.id));
        
        if (newMessages.length > 0) {
          console.log(`[useOtpSubscription] Found ${newMessages.length} new messages to process`);
        }

        // Process each NEW message
        for (const msg of newMessages) {
          // Mark as processed immediately to avoid duplicates
          processedMessageIdsRef.current.add(msg.id);
          
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
      } catch (err) {
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
  }, [type, skipMessageId, pollingInterval, maxPollTime, handleOtpNotification, stopListeningInternal, keepListening]);

  const startListening = useCallback(async () => {
    if (isListening) return;

    setIsListening(true);
    setError(null);
    clearOtp();

    console.log('[useOtpSubscription] Starting to listen...');
    
    // Always start polling as the reliable fallback
    // This ensures updates even if WebSocket fails
    startListeningPolling();
    
    // Also try WebSocket for instant updates (enhancement on top of polling)
    // WebSocket will override connectionType to 'websocket' if successful
    const websocketSuccess = await startListeningWebSocket();
    if (websocketSuccess) {
      console.log('[useOtpSubscription] WebSocket subscription active (polling still running as fallback)');
    } else {
      console.log('[useOtpSubscription] WebSocket unavailable, polling only');
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

