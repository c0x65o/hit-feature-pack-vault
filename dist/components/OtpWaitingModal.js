'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Copy, Check, Eye, Wifi, WifiOff, Loader2, X } from 'lucide-react';
import { useOtpSubscription, isWebSocketAvailable, getGlobalWsStatus, subscribeGlobalWsStatus } from '../hooks/useOtpSubscription';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence } from '../utils/otp-extractor';
// OTP codes older than this are considered stale and not shown
const OTP_FRESHNESS_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes
function formatTimeAgo(date) {
    const now = new Date();
    const then = typeof date === 'string' ? new Date(date) : date;
    const diffMs = now.getTime() - then.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    if (diffSecs < 60) {
        return `${diffSecs} secs ago`;
    }
    else if (diffMins < 60) {
        return `${diffMins} min${diffMins !== 1 ? 's' : ''} ago`;
    }
    else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    }
    else {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    }
}
function isCodeFresh(receivedAt) {
    const now = new Date();
    const then = typeof receivedAt === 'string' ? new Date(receivedAt) : receivedAt;
    const diffMs = now.getTime() - then.getTime();
    return diffMs <= OTP_FRESHNESS_THRESHOLD_MS;
}
export function OtpWaitingModal({ open, onClose, itemTitle, mode, emailAddress, phoneNumber }) {
    const { Modal, Button, Alert } = useUi();
    const [copied, setCopied] = useState(false);
    const [showFullMessage, setShowFullMessage] = useState(false);
    const [fullMessageBody, setFullMessageBody] = useState(null);
    const [loadingFullMessage, setLoadingFullMessage] = useState(false);
    const [lastOtpNotification, setLastOtpNotification] = useState(null);
    // Track the initial message ID loaded on modal open to prevent duplicate "received" events
    const [initialMessageId, setInitialMessageId] = useState(null);
    // Track if we've finished loading the initial message ID (so we can enable subscription)
    const [initialLoadComplete, setInitialLoadComplete] = useState(false);
    // Only treat OTP notifications as "new" if they arrive after this baseline timestamp.
    // Initialized on modal open; if we discover the latest message on load, we set it to that message's receivedAt.
    const [minReceivedAt, setMinReceivedAt] = useState(null);
    // Use OTP subscription hook - keep listening for new OTPs
    // Only enable after we've loaded the initial message ID to avoid race condition
    const otpSubscription = useOtpSubscription({
        type: mode,
        toFilter: mode === 'email'
            ? (emailAddress || undefined)
            : (phoneNumber || undefined),
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
                        }
                        catch (err) {
                            console.error('Failed to reveal last email message:', err);
                        }
                    }
                    // Mark initial load as complete so subscription can start (even if no messages)
                    setInitialLoadComplete(true);
                }
                else {
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
                        }
                        catch (err) {
                            console.error('Failed to reveal last SMS message:', err);
                        }
                    }
                    // Mark initial load as complete so subscription can start (even if no messages)
                    setInitialLoadComplete(true);
                }
            }
            catch (err) {
                console.error(`Failed to load last OTP ${mode}:`, err);
                // Even on error, mark as complete so subscription can start
                setInitialLoadComplete(true);
            }
        }
        loadLastOtp();
    }, [open, mode]);
    const handleCopy = async (code) => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy to clipboard:', err);
        }
    };
    const handleViewFullMessage = async () => {
        if (!lastOtpNotification?.messageId)
            return;
        if (showFullMessage && fullMessageBody) {
            setShowFullMessage(false);
            return;
        }
        setLoadingFullMessage(true);
        try {
            const result = await vaultApi.revealSmsMessage(lastOtpNotification.messageId);
            setFullMessageBody(result.body);
            setShowFullMessage(true);
        }
        catch (err) {
            console.error('Failed to load full message:', err);
        }
        finally {
            setLoadingFullMessage(false);
        }
    };
    // Use the same WebSocket status approach as the dashboard shell
    const [wsStatus, setWsStatus] = useState(getGlobalWsStatus());
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
    return (_jsx(Modal, { open: open, onClose: onClose, children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-xl font-semibold", children: itemTitle ? `Waiting for ${modeLabel} OTP - ${itemTitle}` : `Waiting for ${modeLabel} OTP Code` }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onClose, children: _jsx(X, { size: 16 }) })] }), _jsx("div", { className: "mb-4 flex items-center gap-2 text-sm", children: connectionStatus === 'connected' ? (_jsxs(_Fragment, { children: [_jsx(Wifi, { size: 16, className: "text-green-600" }), _jsx("span", { className: "text-green-600 font-medium", children: "WebSocket Connected" })] })) : (_jsxs(_Fragment, { children: [_jsx(WifiOff, { size: 16, className: "text-gray-500" }), _jsx("span", { className: "text-gray-500", children: "Disconnected" })] })) }), otpSubscription.otpCode && (_jsxs("div", { className: `p-4 bg-green-50 dark:bg-green-900/20 rounded-md border-2 border-green-500 mb-4`, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("label", { className: `text-sm font-medium text-green-600`, children: ["OTP Code Detected (", otpSubscription.otpConfidence, " confidence)"] }), otpSubscription.latestNotification?.receivedAt && (_jsx("span", { className: "text-xs text-green-600", children: formatTimeAgo(otpSubscription.latestNotification.receivedAt) }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "text-3xl font-mono font-bold flex-1", children: otpSubscription.otpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy(otpSubscription.otpCode), children: copied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) }), otpSubscription.fullMessage && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                        setFullMessageBody(otpSubscription.fullMessage || null);
                                        setShowFullMessage(!showFullMessage);
                                    }, children: _jsx(Eye, { size: 16 }) }))] }), showFullMessage && otpSubscription.fullMessage && (_jsx("div", { className: "mt-3 p-2 bg-background rounded border text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto", children: otpSubscription.fullMessage }))] })), !otpSubscription.otpCode && lastOtpNotification && lastOtpNotification.code && (_jsxs("div", { className: "mb-4", children: [_jsx("div", { className: "mb-2", children: _jsx(Alert, { variant: "info", children: _jsxs("div", { className: "text-sm", children: [_jsxs("div", { className: "font-medium mb-1", children: ["Last ", modeLabel, " OTP Code Received"] }), lastOtpNotification.receivedAt && (_jsx("div", { className: "text-xs text-muted-foreground", children: formatTimeAgo(lastOtpNotification.receivedAt) }))] }) }) }), _jsxs("div", { className: `p-3 bg-transparent rounded-md border-2 ${lastOtpNotification.confidence === 'high'
                                ? 'border-green-500'
                                : lastOtpNotification.confidence === 'medium'
                                    ? 'border-yellow-500'
                                    : 'border-gray-400'}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold flex-1", children: lastOtpNotification.code }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy(lastOtpNotification.code), children: copied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleViewFullMessage, disabled: loadingFullMessage, children: loadingFullMessage ? (_jsx(Loader2, { size: 16, className: "animate-spin" })) : (_jsx(Eye, { size: 16 })) })] }), showFullMessage && fullMessageBody && (_jsx("div", { className: "mt-3 p-2 bg-background rounded border text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto", children: fullMessageBody }))] })] })), isWaiting && !otpSubscription.otpCode && (_jsxs("div", { className: "p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border-2 border-blue-500", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Loader2, { size: 16, className: "animate-spin text-blue-600" }), _jsxs("span", { className: "text-sm font-medium text-blue-600", children: ["Waiting for new ", modeLabel.toLowerCase(), " code..."] })] }), lastOtpNotification && lastOtpNotification.receivedAt && (_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Last code was ", formatTimeAgo(lastOtpNotification.receivedAt)] }))] })), !isWaiting && !hasOtp && (_jsx("div", { className: "p-4 bg-gray-50 dark:bg-gray-900/20 rounded-md border-2 border-gray-300", children: _jsxs("div", { className: "text-sm text-muted-foreground", children: ["No OTP codes found yet. Make sure the service sends the code to", ' ', addressDisplay, "."] }) })), _jsx("div", { className: "mt-4 flex justify-end", children: _jsx(Button, { variant: "secondary", onClick: onClose, children: "Close" }) })] }) }));
}
