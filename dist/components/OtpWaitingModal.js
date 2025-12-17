'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Copy, Check, Eye, Wifi, WifiOff, Loader2, X } from 'lucide-react';
import { useOtpSubscription, isWebSocketAvailable } from '../hooks/useOtpSubscription';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence } from '../utils/otp-extractor';
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
export function OtpWaitingModal({ open, onClose, itemTitle, mode, emailAddress, phoneNumber }) {
    const { Modal, Button, Alert } = useUi();
    const [copied, setCopied] = useState(false);
    const [showFullMessage, setShowFullMessage] = useState(false);
    const [fullMessageBody, setFullMessageBody] = useState(null);
    const [loadingFullMessage, setLoadingFullMessage] = useState(false);
    const [lastOtpNotification, setLastOtpNotification] = useState(null);
    // Use OTP subscription hook - keep listening for new OTPs
    const otpSubscription = useOtpSubscription({
        type: mode,
        toFilter: mode === 'email' ? (emailAddress || undefined) : undefined,
        enabled: open,
        keepListening: true, // Keep listening for new OTPs even after receiving one
        onOtpReceived: (result) => {
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
            setLastOtpNotification({
                code: otpSubscription.otpCode,
                confidence: otpSubscription.otpConfidence,
                receivedAt: otpSubscription.latestNotification.receivedAt
                    ? new Date(otpSubscription.latestNotification.receivedAt)
                    : new Date(),
                messageId: otpSubscription.latestNotification.messageId,
            });
        }
    }, [otpSubscription.otpCode, otpSubscription.otpConfidence, otpSubscription.latestNotification]);
    // Load last OTP when modal opens
    useEffect(() => {
        if (!open)
            return;
        async function loadLastOtp() {
            try {
                if (mode === 'email') {
                    const result = await vaultApi.getLatestEmailMessages();
                    if (result.messages.length > 0) {
                        // Get the most recent message
                        const latestMsg = result.messages[0];
                        try {
                            const revealResult = await vaultApi.revealSmsMessage(latestMsg.id);
                            const otpResult = extractOtpWithConfidence(revealResult.body);
                            setLastOtpNotification({
                                code: otpResult.code,
                                confidence: otpResult.confidence,
                                receivedAt: typeof latestMsg.receivedAt === 'string'
                                    ? new Date(latestMsg.receivedAt)
                                    : latestMsg.receivedAt,
                                messageId: latestMsg.id,
                            });
                        }
                        catch (err) {
                            console.error('Failed to reveal last email message:', err);
                        }
                    }
                }
                else {
                    // SMS mode
                    const result = await vaultApi.getLatestSmsMessages();
                    if (result.messages.length > 0) {
                        // Get the most recent message
                        const latestMsg = result.messages[0];
                        try {
                            const revealResult = await vaultApi.revealSmsMessage(latestMsg.id);
                            const otpResult = extractOtpWithConfidence(revealResult.body);
                            setLastOtpNotification({
                                code: otpResult.code,
                                confidence: otpResult.confidence,
                                receivedAt: typeof latestMsg.receivedAt === 'string'
                                    ? new Date(latestMsg.receivedAt)
                                    : latestMsg.receivedAt,
                                messageId: latestMsg.id,
                            });
                        }
                        catch (err) {
                            console.error('Failed to reveal last SMS message:', err);
                        }
                    }
                }
            }
            catch (err) {
                console.error(`Failed to load last OTP ${mode}:`, err);
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
    const connectionStatus = otpSubscription.connectionType === 'websocket'
        ? 'connected'
        : otpSubscription.connectionType === 'polling'
            ? 'polling'
            : 'disconnected';
    const wsAvailable = isWebSocketAvailable();
    const isWaiting = otpSubscription.isListening && !otpSubscription.otpCode;
    const hasOtp = otpSubscription.otpCode || lastOtpNotification?.code;
    const modeLabel = mode === 'email' ? 'Email' : 'SMS';
    const addressDisplay = mode === 'email'
        ? (emailAddress || 'the configured email address')
        : (phoneNumber || 'the configured phone number');
    return (_jsx(Modal, { open: open, onClose: onClose, children: _jsxs("div", { className: "p-6", children: [_jsxs("div", { className: "flex items-center justify-between mb-4", children: [_jsx("h2", { className: "text-xl font-semibold", children: itemTitle ? `Waiting for ${modeLabel} OTP - ${itemTitle}` : `Waiting for ${modeLabel} OTP Code` }), _jsx(Button, { variant: "ghost", size: "sm", onClick: onClose, children: _jsx(X, { size: 16 }) })] }), _jsx("div", { className: "mb-4 flex items-center gap-2 text-sm", children: connectionStatus === 'connected' ? (_jsxs(_Fragment, { children: [_jsx(Wifi, { size: 16, className: "text-green-600" }), _jsx("span", { className: "text-green-600 font-medium", children: "WebSocket Connected" })] })) : connectionStatus === 'polling' ? (_jsxs(_Fragment, { children: [_jsx(Loader2, { size: 16, className: "text-blue-600 animate-spin" }), _jsx("span", { className: "text-blue-600 font-medium", children: "Polling for Messages" })] })) : (_jsxs(_Fragment, { children: [_jsx(WifiOff, { size: 16, className: "text-gray-500" }), _jsx("span", { className: "text-gray-500", children: "Disconnected" })] })) }), otpSubscription.otpCode && (_jsxs("div", { className: `p-4 bg-green-50 dark:bg-green-900/20 rounded-md border-2 border-green-500 mb-4`, children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsxs("label", { className: `text-sm font-medium text-green-600`, children: ["OTP Code Detected (", otpSubscription.otpConfidence, " confidence)"] }), otpSubscription.latestNotification?.receivedAt && (_jsx("span", { className: "text-xs text-green-600", children: formatTimeAgo(otpSubscription.latestNotification.receivedAt) }))] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "text-3xl font-mono font-bold flex-1", children: otpSubscription.otpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy(otpSubscription.otpCode), children: copied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) }), otpSubscription.fullMessage && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                        setFullMessageBody(otpSubscription.fullMessage || null);
                                        setShowFullMessage(!showFullMessage);
                                    }, children: _jsx(Eye, { size: 16 }) }))] }), showFullMessage && otpSubscription.fullMessage && (_jsx("div", { className: "mt-3 p-2 bg-background rounded border text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto", children: otpSubscription.fullMessage }))] })), !otpSubscription.otpCode && lastOtpNotification && lastOtpNotification.code && (_jsxs("div", { className: "mb-4", children: [_jsx(Alert, { variant: "info", className: "mb-2", children: _jsxs("div", { className: "text-sm", children: [_jsxs("div", { className: "font-medium mb-1", children: ["Last ", modeLabel, " OTP Code Received"] }), lastOtpNotification.receivedAt && (_jsx("div", { className: "text-xs text-muted-foreground", children: formatTimeAgo(lastOtpNotification.receivedAt) }))] }) }), _jsxs("div", { className: `p-3 bg-transparent rounded-md border-2 ${lastOtpNotification.confidence === 'high'
                                ? 'border-green-500'
                                : lastOtpNotification.confidence === 'medium'
                                    ? 'border-yellow-500'
                                    : 'border-gray-400'}`, children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold flex-1", children: lastOtpNotification.code }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy(lastOtpNotification.code), children: copied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: handleViewFullMessage, disabled: loadingFullMessage, children: loadingFullMessage ? (_jsx(Loader2, { size: 16, className: "animate-spin" })) : (_jsx(Eye, { size: 16 })) })] }), showFullMessage && fullMessageBody && (_jsx("div", { className: "mt-3 p-2 bg-background rounded border text-xs font-mono whitespace-pre-wrap max-h-48 overflow-y-auto", children: fullMessageBody }))] })] })), isWaiting && !otpSubscription.otpCode && (_jsxs("div", { className: "p-4 bg-blue-50 dark:bg-blue-900/20 rounded-md border-2 border-blue-500", children: [_jsxs("div", { className: "flex items-center gap-2 mb-2", children: [_jsx(Loader2, { size: 16, className: "animate-spin text-blue-600" }), _jsxs("span", { className: "text-sm font-medium text-blue-600", children: ["Waiting for new ", modeLabel.toLowerCase(), " code..."] })] }), lastOtpNotification && lastOtpNotification.receivedAt && (_jsxs("div", { className: "text-xs text-muted-foreground", children: ["Last code was ", formatTimeAgo(lastOtpNotification.receivedAt)] }))] })), !isWaiting && !hasOtp && (_jsx("div", { className: "p-4 bg-gray-50 dark:bg-gray-900/20 rounded-md border-2 border-gray-300", children: _jsxs("div", { className: "text-sm text-muted-foreground", children: ["No OTP codes found yet. Make sure the service sends the code to", ' ', addressDisplay, "."] }) })), _jsx("div", { className: "mt-4 flex justify-end", children: _jsx(Button, { variant: "secondary", onClick: onClose, children: "Close" }) })] }) }));
}
