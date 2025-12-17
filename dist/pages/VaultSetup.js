'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Trash2, Copy, RefreshCw, Lock as LockIcon, Settings, Activity } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { extractOtpCode } from '../utils/otp-extractor';
export function VaultSetup({ onNavigate }) {
    const { Page, Card, Button, Input, Alert } = useUi();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [currentPhoneNumber, setCurrentPhoneNumber] = useState(null);
    const [smsNumbers, setSmsNumbers] = useState([]);
    const [selectedSmsNumberId, setSelectedSmsNumberId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [revealedMessages, setRevealedMessages] = useState(new Map());
    const [webhookLogs, setWebhookLogs] = useState([]);
    const [loadingWebhookLogs, setLoadingWebhookLogs] = useState(false);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    useEffect(() => {
        loadData();
        loadWebhookLogs();
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
            const [phoneResult, numbers] = await Promise.all([
                vaultApi.getGlobalPhoneNumber(),
                vaultApi.getSmsNumbers(),
            ]);
            setCurrentPhoneNumber(phoneResult.phoneNumber);
            setPhoneNumber(phoneResult.phoneNumber || '');
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
    async function handleSave() {
        if (!phoneNumber.trim()) {
            setError(new Error('Phone number is required'));
            return;
        }
        // Basic phone number validation (E.164 format)
        const phoneRegex = /^\+[1-9]\d{1,14}$/;
        if (!phoneRegex.test(phoneNumber.trim())) {
            setError(new Error('Phone number must be in E.164 format (e.g., +1234567890)'));
            return;
        }
        try {
            setSaving(true);
            setError(null);
            await vaultApi.setGlobalPhoneNumber(phoneNumber.trim());
            setCurrentPhoneNumber(phoneNumber.trim());
            await loadData(); // Reload to refresh SMS numbers
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to save phone number'));
        }
        finally {
            setSaving(false);
        }
    }
    async function handleDelete() {
        if (!confirm('Are you sure you want to delete the phone number? This will disable SMS 2FA for all vault items.')) {
            return;
        }
        try {
            setSaving(true);
            setError(null);
            await vaultApi.deleteGlobalPhoneNumber();
            setCurrentPhoneNumber(null);
            setPhoneNumber('');
            await loadData();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to delete phone number'));
        }
        finally {
            setSaving(false);
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
    async function handleCopyPhoneNumber() {
        if (currentPhoneNumber) {
            await navigator.clipboard.writeText(currentPhoneNumber);
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Setup", description: "Loading...", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    const breadcrumbs = [
        { label: 'Vault', href: '/vault/personal', icon: _jsx(LockIcon, { size: 14 }) },
        { label: 'Setup', icon: _jsx(Settings, { size: 14 }) },
    ];
    return (_jsxs(Page, { title: "Setup", breadcrumbs: breadcrumbs, onNavigate: navigate, description: "Configure project SMS 2FA phone number and view inbox for debugging", children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsxs("div", { className: "space-y-6", children: [_jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsx("h2", { className: "text-lg font-semibold", children: "Project SMS 2FA Number" }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Phone Number" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1 mb-2", children: "Enter the Twilio phone number in E.164 format (e.g., +1234567890). This number will be used for receiving 2FA codes for all vault items." }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { value: phoneNumber, onChange: (value) => setPhoneNumber(value), placeholder: "+1234567890", className: "flex-1" }), currentPhoneNumber && (_jsx(Button, { variant: "secondary", onClick: handleCopyPhoneNumber, title: "Copy phone number", children: _jsx(Copy, { size: 16 }) }))] })] }), currentPhoneNumber && (_jsxs(Alert, { variant: "info", title: "Current Configuration", children: [_jsxs("p", { className: "text-sm mt-2", children: ["Current phone number: ", _jsx("code", { className: "font-mono", children: currentPhoneNumber })] }), _jsxs("p", { className: "text-xs text-muted-foreground mt-2", children: ["Configure this number in Twilio to send webhooks to:", ' ', _jsx("code", { className: "font-mono text-xs", children: typeof window !== 'undefined'
                                                        ? `${window.location.origin}/api/vault/sms/webhook/inbound`
                                                        : '/api/vault/sms/webhook/inbound' })] })] })), !currentPhoneNumber && (_jsx(Alert, { variant: "warning", title: "No Phone Number Configured", children: _jsx("p", { className: "text-sm mt-2", children: "No phone number is currently configured. Users will not be able to use SMS 2FA until a phone number is set up." }) })), _jsxs("div", { className: "flex justify-end gap-2", children: [currentPhoneNumber && (_jsxs(Button, { variant: "secondary", onClick: handleDelete, disabled: saving, children: [_jsx(Trash2, { size: 16, className: "mr-2" }), "Delete"] })), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !phoneNumber.trim(), children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Saving...' : 'Save'] })] })] }) }), smsNumbers.length > 0 && (_jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center justify-between", children: [_jsx("h2", { className: "text-lg font-semibold", children: "SMS Inbox (Debug)" }), selectedSmsNumberId && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: () => selectedSmsNumberId && loadMessages(selectedSmsNumberId), disabled: loadingMessages, children: [_jsx(RefreshCw, { size: 16, className: `mr-2 ${loadingMessages ? 'animate-spin' : ''}` }), "Refresh"] }))] }), smsNumbers.length > 1 && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Select SMS Number" }), _jsx("select", { value: selectedSmsNumberId || '', onChange: (e) => setSelectedSmsNumberId(e.target.value || null), className: "w-full mt-1 px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800", children: smsNumbers.map(num => (_jsxs("option", { value: num.id, children: [num.phoneNumber, " (", num.vaultId ? 'Vault-specific' : 'Global', ")"] }, num.id))) })] })), selectedSmsNumberId && (_jsx("div", { className: "space-y-2", children: loadingMessages ? (_jsx("div", { className: "text-center py-4 text-muted-foreground", children: "Loading messages..." })) : messages.length === 0 ? (_jsx("div", { className: "text-center py-4 text-muted-foreground", children: "No messages received yet" })) : (_jsx("div", { className: "space-y-2 max-h-96 overflow-y-auto", children: messages.map(msg => {
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
