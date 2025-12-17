'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Copy, RefreshCw, Lock as LockIcon, Settings, Activity } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { extractOtpCode } from '../utils/otp-extractor';
export function VaultSetup({ onNavigate }) {
    const { Page, Card, Button, Alert } = useUi();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [smsNumbers, setSmsNumbers] = useState([]);
    const [selectedSmsNumberId, setSelectedSmsNumberId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [revealedMessages, setRevealedMessages] = useState(new Map());
    const [webhookLogs, setWebhookLogs] = useState([]);
    const [loadingWebhookLogs, setLoadingWebhookLogs] = useState(false);
    const [webhookApiKey, setWebhookApiKey] = useState(null);
    const [generatingApiKey, setGeneratingApiKey] = useState(false);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    useEffect(() => {
        loadData();
        loadWebhookLogs();
        loadWebhookApiKey();
    }, []);
    useEffect(() => {
        if (selectedSmsNumberId) {
            loadMessages(selectedSmsNumberId);
            // Auto-refresh messages every 5 seconds to catch new webhook messages
            const interval = setInterval(() => {
                loadMessages(selectedSmsNumberId);
            }, 5000);
            return () => clearInterval(interval);
        }
        else {
            setMessages([]);
        }
    }, [selectedSmsNumberId]);
    async function loadData() {
        try {
            setLoading(true);
            const numbers = await vaultApi.getSmsNumbers();
            setSmsNumbers(numbers);
            if (numbers.length > 0) {
                setSelectedSmsNumberId(numbers[0].id);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load setup data'));
        }
        finally {
            setLoading(false);
        }
    }
    function formatTimeAgo(date) {
        const now = new Date();
        const msgDate = typeof date === 'string' ? new Date(date) : date;
        const diffMs = now.getTime() - msgDate.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        if (diffSecs < 60) {
            return `${diffSecs} sec${diffSecs !== 1 ? 's' : ''} old`;
        }
        else if (diffMins < 60) {
            return `${diffMins} min${diffMins !== 1 ? 's' : ''} old`;
        }
        else {
            const diffHours = Math.floor(diffMins / 60);
            return `${diffHours} hour${diffHours !== 1 ? 's' : ''} old`;
        }
    }
    async function loadMessages(smsNumberId) {
        try {
            setLoadingMessages(true);
            const msgs = await vaultApi.getSmsMessages(smsNumberId);
            setMessages(msgs);
            // Automatically reveal the most recent message if it's within 5 minutes
            if (msgs.length > 0) {
                const mostRecent = msgs[0];
                const receivedAt = new Date(mostRecent.receivedAt);
                const now = new Date();
                const diffMs = now.getTime() - receivedAt.getTime();
                const diffMins = diffMs / (1000 * 60);
                // If message is within 5 minutes, try to reveal it (handleRevealMessage checks if already revealed)
                if (diffMins <= 5) {
                    await handleRevealMessage(mostRecent.id);
                }
            }
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load messages'));
        }
        finally {
            setLoadingMessages(false);
        }
    }
    async function loadWebhookLogs() {
        try {
            setLoadingWebhookLogs(true);
            const result = await vaultApi.getWebhookLogs({ limit: 50 });
            setWebhookLogs(result.items);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load webhook logs'));
        }
        finally {
            setLoadingWebhookLogs(false);
        }
    }
    async function loadWebhookApiKey() {
        try {
            const result = await vaultApi.getWebhookApiKey();
            setWebhookApiKey(result.apiKey);
        }
        catch (err) {
            console.error('Failed to load webhook API key:', err);
        }
    }
    async function handleGenerateApiKey() {
        if (!confirm('Generate a new API key? The old key will be invalidated and you will need to update F-Droid and Power Automate configurations.')) {
            return;
        }
        try {
            setGeneratingApiKey(true);
            setError(null);
            const result = await vaultApi.generateWebhookApiKey();
            setWebhookApiKey(result.apiKey);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to generate API key'));
        }
        finally {
            setGeneratingApiKey(false);
        }
    }
    async function handleRevealMessage(messageId) {
        if (revealedMessages.has(messageId)) {
            return;
        }
        try {
            const result = await vaultApi.revealSmsMessage(messageId);
            setRevealedMessages(prev => new Map(prev).set(messageId, result.body));
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to reveal message'));
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Setup", description: "Loading...", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    const breadcrumbs = [
        { label: 'Vault', href: '/vault/personal', icon: _jsx(LockIcon, { size: 14 }) },
        { label: 'Setup', icon: _jsx(Settings, { size: 14 }) },
    ];
    return (_jsxs(Page, { title: "Setup", breadcrumbs: breadcrumbs, onNavigate: navigate, description: "Configure webhooks for SMS (F-Droid) and Email (Power Automate) forwarding", children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsxs("div", { className: "space-y-6", children: [_jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-6", children: [_jsxs("div", { children: [_jsx("h2", { className: "text-lg font-semibold mb-2", children: "Webhook Configuration" }), _jsx("p", { className: "text-sm text-muted-foreground", children: "Configure F-Droid (SMS) or Power Automate (Email) to forward messages to these webhooks. Phone numbers and email addresses don't need to be pre-configured - any message sent to the webhook will be stored." })] }), _jsxs("div", { className: "space-y-3", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-md font-semibold", children: "SMS Webhook (F-Droid)" }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => {
                                                        const url = typeof window !== 'undefined'
                                                            ? `${window.location.origin}/api/vault/sms/webhook/inbound`
                                                            : '/api/vault/sms/webhook/inbound';
                                                        navigator.clipboard.writeText(url);
                                                    }, children: [_jsx(Copy, { size: 16, className: "mr-2" }), "Copy URL"] })] }), _jsx("div", { className: "bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border", children: _jsx("code", { className: "text-sm font-mono break-all", children: typeof window !== 'undefined'
                                                    ? `${window.location.origin}/api/vault/sms/webhook/inbound`
                                                    : '/api/vault/sms/webhook/inbound' }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium", children: "F-Droid Setup Instructions:" }), _jsxs("ol", { className: "text-sm text-muted-foreground space-y-1 list-decimal list-inside", children: [_jsx("li", { children: "Install an SMS forwarding app from F-Droid (e.g., \"SMS Forwarder\")" }), _jsx("li", { children: "Configure the app to POST JSON to the webhook URL above" }), _jsxs("li", { children: ["Set the Authorization header: ", _jsxs("code", { className: "font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded", children: ["Bearer ", '<SHARED_API_KEY>'] }), " or use ", _jsx("code", { className: "font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded", children: "X-API-Key" }), " header (use the shared API key shown below)"] }), _jsx("li", { children: "Use the following JSON format:" })] }), _jsx("pre", { className: "text-xs bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded overflow-x-auto", children: `{
  "from": "+1234567890",
  "to": "+0987654321",
  "body": "Your OTP code is 123456",
  "timestamp": "2024-01-01T12:00:00Z"
}` })] })] }), _jsxs("div", { className: "space-y-3 border-t pt-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-md font-semibold", children: "Email Webhook (Power Automate)" }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => {
                                                        const url = typeof window !== 'undefined'
                                                            ? `${window.location.origin}/api/vault/email/webhook/inbound`
                                                            : '/api/vault/email/webhook/inbound';
                                                        navigator.clipboard.writeText(url);
                                                    }, children: [_jsx(Copy, { size: 16, className: "mr-2" }), "Copy URL"] })] }), _jsx("div", { className: "bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border", children: _jsx("code", { className: "text-sm font-mono break-all", children: typeof window !== 'undefined'
                                                    ? `${window.location.origin}/api/vault/email/webhook/inbound`
                                                    : '/api/vault/email/webhook/inbound' }) }), _jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm font-medium", children: "Power Automate Setup Instructions:" }), _jsxs("ol", { className: "text-sm text-muted-foreground space-y-1 list-decimal list-inside", children: [_jsx("li", { children: "Create a Power Automate flow triggered by \"When a new email arrives\"" }), _jsx("li", { children: "Add an HTTP action to POST to the webhook URL above" }), _jsxs("li", { children: ["Set the Authorization header: ", _jsxs("code", { className: "font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded", children: ["Bearer ", '<SHARED_API_KEY>'] }), " or use ", _jsx("code", { className: "font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded", children: "X-API-Key" }), " header (use the shared API key shown below)"] }), _jsxs("li", { children: ["Set Content-Type to ", _jsx("code", { className: "font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded", children: "application/json" })] }), _jsx("li", { children: "Use the following JSON format in the body:" })] }), _jsx("pre", { className: "text-xs bg-gray-900 dark:bg-gray-950 text-gray-100 p-3 rounded overflow-x-auto", children: `{
  "from": "sender@example.com",
  "to": "recipient@example.com",
  "subject": "Email Subject",
  "body": "Email body text or HTML",
  "timestamp": "2024-01-01T12:00:00Z"
}` }), _jsxs("p", { className: "text-xs text-muted-foreground mt-2", children: [_jsx("strong", { children: "Note:" }), " Map Power Automate email fields:", _jsx("br", {}), "\u2022 ", _jsx("code", { className: "font-mono", children: "from" }), " = From (Email Address)", _jsx("br", {}), "\u2022 ", _jsx("code", { className: "font-mono", children: "to" }), " = To (Email Address)", _jsx("br", {}), "\u2022 ", _jsx("code", { className: "font-mono", children: "subject" }), " = Subject", _jsx("br", {}), "\u2022 ", _jsx("code", { className: "font-mono", children: "body" }), " = Body (or Body HTML)"] })] })] }), _jsxs("div", { className: "space-y-3 border-t pt-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h3", { className: "text-md font-semibold", children: "Shared API Key" }), _jsxs("div", { className: "flex gap-2", children: [webhookApiKey && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => {
                                                                navigator.clipboard.writeText(webhookApiKey);
                                                            }, children: [_jsx(Copy, { size: 16, className: "mr-2" }), "Copy Key"] })), _jsx(Button, { variant: "primary", size: "sm", onClick: handleGenerateApiKey, disabled: generatingApiKey, children: generatingApiKey ? 'Generating...' : webhookApiKey ? 'Regenerate' : 'Generate' })] })] }), webhookApiKey ? (_jsx("div", { className: "bg-gray-50 dark:bg-gray-900 p-3 rounded-lg border", children: _jsx("code", { className: "text-sm font-mono break-all", children: webhookApiKey }) })) : (_jsx(Alert, { variant: "warning", title: "No API Key Configured", children: _jsx("p", { className: "text-sm mt-2", children: "Generate an API key to secure your webhooks. This key is shared between F-Droid (SMS) and Power Automate (Email) webhooks." }) })), _jsxs("p", { className: "text-xs text-muted-foreground", children: ["Use this API key in the ", _jsxs("code", { className: "font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded", children: ["Authorization: Bearer ", '<API_KEY>'] }), " header or ", _jsx("code", { className: "font-mono bg-gray-100 dark:bg-gray-800 px-1 rounded", children: "X-API-Key" }), " header for both webhooks."] })] })] }) }), smsNumbers.length > 0 && (_jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "SMS Inbox (Debug)" }), selectedSmsNumberId && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => selectedSmsNumberId && loadMessages(selectedSmsNumberId), disabled: loadingMessages, children: [_jsx(RefreshCw, { size: 16, className: `mr-2 ${loadingMessages ? 'animate-spin' : ''}` }), "Refresh"] }))] }), smsNumbers.length > 1 && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Select SMS Number" }), _jsx("select", { value: selectedSmsNumberId || '', onChange: (e) => setSelectedSmsNumberId(e.target.value || null), className: "w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800", children: smsNumbers.map(num => (_jsxs("option", { value: num.id, children: [num.phoneNumber, " (", num.vaultId ? 'Vault-specific' : 'Global', ")"] }, num.id))) })] })), selectedSmsNumberId && (_jsx("div", { className: "space-y-2", children: loadingMessages ? (_jsx("div", { className: "text-center py-4 text-muted-foreground", children: "Loading messages..." })) : messages.length === 0 ? (_jsx("div", { className: "text-center py-4 text-muted-foreground", children: "No messages received yet" })) : (_jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto", children: messages.map(msg => {
                                            const revealedBody = revealedMessages.get(msg.id);
                                            const isRevealed = !!revealedBody;
                                            const messageBody = isRevealed ? revealedBody : '••••••••';
                                            const otpCode = isRevealed && revealedBody ? extractOtpCode(revealedBody) : null;
                                            return (_jsxs("div", { className: "p-3 border rounded-lg bg-gray-50 dark:bg-gray-900", children: [_jsxs("div", { className: "flex items-start justify-between mb-2", children: [_jsxs("div", { className: "text-sm", children: [_jsxs("div", { className: "font-medium", children: ["From: ", msg.fromNumber] }), _jsx("div", { className: "text-muted-foreground text-xs mt-1", children: new Date(msg.receivedAt).toLocaleString() })] }), !isRevealed && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleRevealMessage(msg.id), children: "Reveal" }))] }), otpCode && (_jsxs("div", { className: "mb-2 p-3 bg-green-50 dark:bg-green-900/20 rounded-md border-2 border-green-500", children: [_jsxs("div", { className: "flex items-center justify-between mb-2", children: [_jsx("label", { className: "text-sm font-medium text-green-600 dark:text-green-400", children: "OTP Code Detected" }), _jsx("span", { className: "text-xs text-muted-foreground", children: formatTimeAgo(msg.receivedAt) })] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold", children: otpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigator.clipboard.writeText(otpCode), title: "Copy OTP code", children: _jsx(Copy, { size: 16 }) })] })] })), _jsx("div", { className: "text-sm font-mono bg-white dark:bg-gray-800 p-2 rounded border", children: messageBody })] }, msg.id));
                                        }) })) }))] }) })), _jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsxs("h2", { className: "text-lg font-semibold flex items-center gap-2", children: [_jsx(Activity, { size: 20 }), "Webhook Logs"] }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: loadWebhookLogs, disabled: loadingWebhookLogs, children: [_jsx(RefreshCw, { size: 16, className: `mr-2 ${loadingWebhookLogs ? 'animate-spin' : ''}` }), "Refresh"] })] }), _jsx("p", { className: "text-sm text-muted-foreground", children: "View all incoming webhook requests for debugging. This includes successful requests, failed requests, and validation errors." }), loadingWebhookLogs ? (_jsx("div", { className: "text-center py-4 text-muted-foreground", children: "Loading webhook logs..." })) : webhookLogs.length === 0 ? (_jsx("div", { className: "text-center py-4 text-muted-foreground", children: "No webhook logs yet" })) : (_jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto", children: webhookLogs.map(log => (_jsxs("div", { className: `p-3 border rounded-lg ${log.success
                                            ? 'bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800'
                                            : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'}`, children: [_jsx("div", { className: "flex items-start justify-between mb-2", children: _jsxs("div", { className: "text-sm flex-1", children: [_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("span", { className: "font-medium", children: log.method }), _jsx("span", { className: `px-2 py-0.5 rounded text-xs ${log.success
                                                                        ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                                                        : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`, children: log.statusCode || 'N/A' }), log.processingTimeMs && (_jsxs("span", { className: "text-xs text-muted-foreground", children: [log.processingTimeMs, "ms"] }))] }), _jsx("div", { className: "text-xs text-muted-foreground mt-1", children: new Date(log.receivedAt).toLocaleString() }), log.fromNumber && (_jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: ["From: ", log.fromNumber, " \u2192 To: ", log.toNumber || 'N/A'] })), log.messageSid && (_jsxs("div", { className: "text-xs text-muted-foreground mt-1 font-mono", children: ["SID: ", log.messageSid] })), log.error && (_jsxs("div", { className: "text-xs text-red-600 dark:text-red-400 mt-1", children: ["Error: ", log.error] })), log.ip && (_jsxs("div", { className: "text-xs text-muted-foreground mt-1", children: ["IP: ", log.ip] }))] }) }), log.body && Object.keys(log.body).length > 0 && (_jsxs("details", { className: "mt-2", children: [_jsx("summary", { className: "text-xs text-muted-foreground cursor-pointer", children: "View request body" }), _jsx("pre", { className: "text-xs mt-2 p-2 bg-white dark:bg-gray-800 rounded border overflow-x-auto", children: JSON.stringify(log.body, null, 2) })] }))] }, log.id))) }))] }) })] })] }));
}
export default VaultSetup;
