'use client';

import React, { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Copy, Check, Eye, Wifi, WifiOff, Loader2, X } from 'lucide-react';
import { useOtpSubscription, isWebSocketAvailable, getGlobalWsStatus, subscribeGlobalWsStatus } from '../hooks/useOtpSubscription';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence } from '../utils/otp-extractor';

type OtpMode = 'email' | 'sms';

interface Props {
  open: boolean;
  onClose: () => void;
  itemTitle?: string;
  mode: OtpMode;
  emailAddress?: string | null;
  phoneNumber?: string | null;
}

// OTP codes older than this are considered stale and not shown
const OTP_FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function formatTimeAgo(date: Date | string): string {
  const now = new Date();
  const then = typeof date === 'string' ? new Date(date) : date;
  const diffMs = now.getTime() - then.getTime();
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) {
    return `${diffSecs} secs ago`;
  } else if (diffMins < 60) {
    return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
  } else if (diffHours < 24) {
    return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
  } else {
    return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
  }
}

function isCodeFresh(receivedAt: Date | string): boolean {
  const now = new Date();
  const then = typeof receivedAt === 'string' ? new Date(receivedAt) : receivedAt;
  const diffMs = now.getTime() - then.getTime();
  return diffMs <= OTP_FRESHNESS_THRESHOLD_MS;
}

export function OtpWaitingModal({ open, onClose, itemTitle, mode, emailAddress, phoneNumber }: Props) {
  const { Modal, Button, Alert } = useUi();
  const [copied, setCopied] = useState(false);
  const [showFullMessage, setShowFullMessage] = useState(false);
  const [fullMessageBody, setFullMessageBody] = useState<string | null>(null);
  const [loadingFullMessage, setLoadingFullMessage] = useState(false);
  const [lastOtpNotification, setLastOtpNotification] = useState<{
    code: string | null;
    confidence: 'high' | 'medium' | 'low' | 'none';
    receivedAt: Date | null;
    messageId: string | null;
  } | null>(null);
  // Track the initial message ID loaded on modal open to prevent duplicate "received" events
  const [initialMessageId, setInitialMessageId] = useState<string | null>(null);
  // Track if we've finished loading the initial message ID (so we can enable subscription)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  // Only treat OTP notifications as "new" if they arrive after this baseline timestamp.
  // Initialized on modal open; if we discover the latest message on load, we set it to that message's receivedAt.
  const [minReceivedAt, setMinReceivedAt] = useState<Date | null>(null);

  // Use OTP subscription hook - keep listening for new OTPs
  // Only enable after we've loaded the initial message ID to avoid race condition
  const otpSubscription = useOtpSubscription({
    type: mode,
    toFilter: mode === 'email' ? (emailAddress || undefined) : undefined,
    enabled: open && initialLoadComplete, // Wait until initial load is complete
    keepListening: true, // Keep listening for new OTPs even after receiving one
    skipMessageId: initialMessageId, // Pass initial message ID to skip it
    minReceivedAt, // Stronger guard: don't treat old notifications as new
    onOtpReceived: (result) => {
      // Skip if this is the same message we already loaded on modal open
      // (This is a double-check, but the hook should already skip it)
      if (initialMessageId && result.notification.messageId === initialMessageId) {
        return;
      }
      // Update last notification when OTP is received
      // This ensures the UI updates immediately when a new OTP arrives
      setLastOtpNotification({
        code: result.code,
        confidence: result.confidence,
        receivedAt: result.notification.receivedAt ? new Date(result.notification.receivedAt) : new Date(),
        messageId: result.notification.messageId,
      });
    },
  });

  // Sync subscription OTP code to last notification for display
  useEffect(() => {
    if (otpSubscription.otpCode && otpSubscription.latestNotification) {
      // Skip if this is the same message we already loaded on modal open
      if (initialMessageId && otpSubscription.latestNotification.messageId === initialMessageId) {
        return;
      }
      setLastOtpNotification({
        code: otpSubscription.otpCode,
        confidence: otpSubscription.otpConfidence,
        receivedAt: otpSubscription.latestNotification.receivedAt 
          ? new Date(otpSubscription.latestNotification.receivedAt) 
          : new Date(),
        messageId: otpSubscription.latestNotification.messageId,
      });
    }
  }, [otpSubscription.otpCode, otpSubscription.otpConfidence, otpSubscription.latestNotification, initialMessageId]);

  // Load last OTP when modal opens
  useEffect(() => {
    if (!open) {
      // Reset initial message ID and load state when modal closes
      setInitialMessageId(null);
      setInitialLoadComplete(false);
      setMinReceivedAt(null);
      return;
    }

    async function loadLastOtp() {
      try {
        // Default baseline: from the moment the modal is opened.
        // If we discover an existing latest message, we'll move this baseline to that message's receivedAt.
        setMinReceivedAt(new Date());

        if (mode === 'email') {
          const result = await vaultApi.getLatestEmailMessages();
          if (result.messages.length > 0) {
            // Get the most recent message
            const latestMsg = result.messages[0];
            const receivedAt = typeof latestMsg.receivedAt === 'string' 
              ? new Date(latestMsg.receivedAt) 
              : latestMsg.receivedAt;
            
            // Track the initial message ID FIRST to prevent duplicate events from polling
            // This must be set before enabling the subscription
            setInitialMessageId(latestMsg.id);
            // Strong baseline: anything at/before the latest message is not "new"
            setMinReceivedAt(receivedAt);
            
            // Only show the code if it's fresh (less than 5 minutes old)
            if (!isCodeFresh(receivedAt)) {
              console.log('[OtpWaitingModal] Last email code is older than 5 minutes, not displaying');
              setInitialLoadComplete(true); // Still mark as complete so subscription can start
              return;
            }
            
            try {
              const revealResult = await vaultApi.revealSmsMessage(latestMsg.id);
              const otpResult = extractOtpWithConfidence(revealResult.body);
              
              setLastOtpNotification({
                code: otpResult.code,
                confidence: otpResult.confidence,
                receivedAt: receivedAt,
                messageId: latestMsg.id,
              });
            } catch (err) {
              console.error('Failed to reveal last email message:', err);
            }
          }
          // Mark initial load as complete so subscription can start (even if no messages)
          setInitialLoadComplete(true);
        } else {
          // SMS mode
          const result = await vaultApi.getLatestSmsMessages();
          if (result.messages.length > 0) {
            // Get the most recent message
            const latestMsg = result.messages[0];
            const receivedAt = typeof latestMsg.receivedAt === 'string' 
              ? new Date(latestMsg.receivedAt) 
              : latestMsg.receivedAt;
            
            // Track the initial message ID FIRST to prevent duplicate events from polling
            // This must be set before enabling the subscription
            setInitialMessageId(latestMsg.id);
            // Strong baseline: anything at/before the latest message is not "new"
            setMinReceivedAt(receivedAt);
            
            // Only show the code if it's fresh (less than 5 minutes old)
            if (!isCodeFresh(receivedAt)) {
              console.log('[OtpWaitingModal] Last SMS code is older than 5 minutes, not displaying');
              setInitialLoadComplete(true); // Still mark as complete so subscription can start
              return;
            }
            
            try {
              const revealResult = await vaultApi.revealSmsMessage(latestMsg.id);
              const otpResult = extractOtpWithConfidence(revealResult.body);
              
              setLastOtpNotification({
                code: otpResult.code,
                confidence: otpResult.confidence,
                receivedAt: receivedAt,
                messageId: latestMsg.id,
              });
            } catch (err) {
              console.error('Failed to reveal last SMS message:', err);
            }
          }
          // Mark initial load as complete so subscription can start (even if no messages)
          setInitialLoadComplete(true);
        }
      } catch (err) {
        console.error(`Failed to load last OTP ${mode}:`, err);
        // Even on error, mark as complete so subscription can start
        setInitialLoadComplete(true);
      }
    }

    loadLastOtp();
  }, [open, mode]);

  const handleCopy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleViewFullMessage = async () => {
    if (!lastOtpNotification?.messageId) return;
    
    if (showFullMessage && fullMessageBody) {
      setShowFullMessage(false);
      return;
    }

    setLoadingFullMessage(true);
    try {
      const result = await vaultApi.revealSmsMessage(lastOtpNotification.messageId);
      setFullMessageBody(result.body);
      setShowFullMessage(true);
    } catch (err) {
      console.error('Failed to load full message:', err);
    } finally {
      setLoadingFullMessage(false);
    }
  };

  // Use the same WebSocket status approach as the dashboard shell
  const [wsStatus, setWsStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>(getGlobalWsStatus());
  
  useEffect(() => {
    const unsubscribe = subscribeGlobalWsStatus((status) => {
      setWsStatus(status);
    });
    return unsubscribe;
  }, []);

  const connectionStatus = wsStatus === 'connected' ? 'connected' : 'disconnected';

  const wsAvailable = isWebSocketAvailable();
  const isWaiting = otpSubscription.isListening && !otpSubscription.otpCode;
  const hasOtp = otpSubscription.otpCode || lastOtpNotification?.code;

  const modeLabel = mode === 'email' ? 'Email' : 'SMS';
  const addressDisplay = mode === 'email' 
    ? (emailAddress || 'the configured email address')
    : (phoneNumber || 'the configured phone number');

  return (
    <Modal open={open} onClose={onClose}>
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">
            {itemTitle ? `Waiting for ${modeLabel} OTP - ${itemTitle}` : `Waiting for ${modeLabel} OTP Code`}
          </h2>
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X size={16} />
          </Button>
        </div>

        {/* Connection Status */}
        <div className="mb-4 flex items-center gap-2 text-sm">
          {connectionStatus === 'connected' ? (
            <>
              <Wifi size={16} className="text-green-600" />
              <span className="text-green-600 font-medium">WebSocket Connected</span>
            </>
          ) : (
            <>
              <WifiOff size={16} className="text-gray-500" />
              <span className="text-gray-500">Disconnected</span>
            </>
          )}
        </div>

        {/* Current OTP Code (if just received via subscription) */}
        {otpSubscription.otpCode && (
          <div className={`p-4 bg-green-50 dark:bg-green-900/20 rounded-md border-2 border-green-500 mb-4`}>
            <div className="flex items-center justify-between mb-2">
              <label className={`text-sm font-medium text-green-600`}>
                OTP Code Detected ({otpSubscription.otpConfidence} confidence)
              </label>
              {otpSubscription.latestNotification?.receivedAt && (
                <span className="text-xs text-green-600">
                  {formatTimeAgo(otpSubscription.latestNotification.receivedAt)}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <code className="text-3xl font-mono font-bold flex-1">
                {otpSubscription.otpCode}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleCopy(otpSubscription.otpCode!)}
              >
                {copied ? (
                  <Check size={16} className="text-green-600" />
                ) : (
                  <Copy size={16} />
                )}
              </Button>
              {otpSubscription.fullMessage && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFullMessageBody(otpSubscription.fullMessage || null);
                    setShowFullMessage(!showFullMessage);
                  }}
                >
                  <Eye size={16} />
                </Button>
              )}
            </div>
            {showFullMessage && otpSubscription.fullMessage && (
              <div className="mt-3 p-2 bg-background rounded border text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                {otpSubscription.fullMessage}
              </div>
            )}
          </div>
        )}

        {/* Last OTP Code (if exists and no current OTP from subscription) */}
        {!otpSubscription.otpCode && lastOtpNotification && lastOtpNotification.code && (
          <div className="mb-4">
            <div className="mb-2">
              <Alert variant="info">
                <div className="text-sm">
                  <div className="font-medium mb-1">Last {modeLabel} OTP Code Received</div>
                  {lastOtpNotification.receivedAt && (
                    <div className="text-xs text-muted-foreground">
                      {formatTimeAgo(lastOtpNotification.receivedAt)}
                    </div>
                  )}
                </div>
              </Alert>
            </div>
            <div className={`p-3 bg-transparent rounded-md border-2 ${
              lastOtpNotification.confidence === 'high' 
                ? 'border-green-500' 
                : lastOtpNotification.confidence === 'medium' 
                  ? 'border-yellow-500' 
                  : 'border-gray-400'
            }`}>
              <div className="flex items-center gap-2">
                <code className="text-2xl font-mono font-bold flex-1">
                  {lastOtpNotification.code}
                </code>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleCopy(lastOtpNotification.code!)}
                >
                  {copied ? (
                    <Check size={16} className="text-green-600" />
                  ) : (
                    <Copy size={16} />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleViewFullMessage}
                  disabled={loadingFullMessage}
                >
                  {loadingFullMessage ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <Eye size={16} />
                  )}
                </Button>
              </div>
              {showFullMessage && fullMessageBody && (
                <div className="mt-3 p-2 bg-background rounded border text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto">
                  {fullMessageBody}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Waiting State */}
        {isWaiting && !otpSubscription.otpCode && (
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border-2 border-blue-500">
            <div className="flex items-center gap-2 mb-2">
              <Loader2 size={16} className="animate-spin text-blue-600" />
              <span className="text-sm font-medium text-blue-600">
                Waiting for new {modeLabel.toLowerCase()} code...
              </span>
            </div>
            {lastOtpNotification && lastOtpNotification.receivedAt && (
              <div className="text-xs text-muted-foreground">
                Last code was {formatTimeAgo(lastOtpNotification.receivedAt)}
              </div>
            )}
          </div>
        )}

        {/* No OTP and not waiting */}
        {!isWaiting && !hasOtp && (
          <div className="p-4 bg-gray-50 dark:bg-gray-900/20 rounded-md border-2 border-gray-300">
            <div className="text-sm text-muted-foreground">
              No OTP codes found yet. Make sure the service sends the code to{' '}
              {addressDisplay}.
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
