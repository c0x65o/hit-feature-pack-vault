'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useUi } from '@hit/ui-kit';
import { Eye, EyeOff, Copy, Edit, Check, RefreshCw, Key, FileText, Lock, Mail } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence } from '../utils/otp-extractor';
export function ItemDetail({ itemId, onNavigate }) {
    const { Page, Card, Button, Alert } = useUi();
    const [item, setItem] = useState(null);
    const [revealed, setRevealed] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [totpCode, setTotpCode] = useState(null);
    const [totpExpiresAt, setTotpExpiresAt] = useState(null);
    const [copied, setCopied] = useState({});
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Email OTP state
    const [globalEmailAddress, setGlobalEmailAddress] = useState(null);
    const [emailCopied, setEmailCopied] = useState(false);
    const [pollingEmail, setPollingEmail] = useState(false);
    const [emailOtpCode, setEmailOtpCode] = useState(null);
    const [emailOtpConfidence, setEmailOtpConfidence] = useState('none');
    const [emailOtpFullMessage, setEmailOtpFullMessage] = useState(null);
    const [showFullEmailMessage, setShowFullEmailMessage] = useState(false);
    const [latestEmailMessageTime, setLatestEmailMessageTime] = useState(null);
    const pollingEmailIntervalRef = useRef(null);
    const lastEmailPollTimeRef = useRef(null);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    useEffect(() => {
        if (itemId) {
            loadItem();
        }
        loadGlobalEmailAddress();
        // Cleanup polling on unmount
        return () => {
            if (pollingEmailIntervalRef.current) {
                clearInterval(pollingEmailIntervalRef.current);
            }
        };
    }, [itemId]);
    useEffect(() => {
        // Auto-refresh TOTP code every 30 seconds
        if (revealed?.totpSecret) {
            generateTotpCode();
            const interval = setInterval(() => {
                generateTotpCode();
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [revealed?.totpSecret]);
    async function loadItem() {
        try {
            setLoading(true);
            const itemData = await vaultApi.getItem(itemId);
            setItem(itemData);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load item'));
        }
        finally {
            setLoading(false);
        }
    }
    async function loadGlobalEmailAddress() {
        try {
            const result = await vaultApi.getGlobalEmailAddress();
            setGlobalEmailAddress(result.emailAddress);
        }
        catch (err) {
            console.error('Failed to load global email address:', err);
        }
    }
    async function copyEmailAddress() {
        if (!globalEmailAddress)
            return;
        try {
            await navigator.clipboard.writeText(globalEmailAddress);
            setEmailCopied(true);
            setTimeout(() => setEmailCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy email address:', err);
        }
    }
    async function startEmailPolling() {
        if (pollingEmail || !item || !globalEmailAddress)
            return;
        // Check if item username matches global email address
        if (item.username?.toLowerCase() !== globalEmailAddress.toLowerCase()) {
            setError(new Error('Item username does not match configured email address'));
            return;
        }
        setPollingEmail(true);
        setEmailOtpCode(null);
        setEmailOtpConfidence('none');
        setEmailOtpFullMessage(null);
        setShowFullEmailMessage(false);
        setLatestEmailMessageTime(null);
        lastEmailPollTimeRef.current = new Date();
        // Poll every 2 seconds
        pollingEmailIntervalRef.current = setInterval(async () => {
            try {
                const since = lastEmailPollTimeRef.current?.toISOString();
                const result = await vaultApi.getLatestEmailMessages({
                    since,
                    email: globalEmailAddress
                });
                // Check each message for OTP code
                for (const msg of result.messages) {
                    try {
                        const revealResult = await vaultApi.revealSmsMessage(msg.id);
                        const otpResult = extractOtpWithConfidence(revealResult.body);
                        if (otpResult.code) {
                            setEmailOtpCode(otpResult.code);
                            setEmailOtpConfidence(otpResult.confidence);
                            setEmailOtpFullMessage(otpResult.fullMessage);
                            setLatestEmailMessageTime(new Date(msg.receivedAt));
                            setPollingEmail(false);
                            if (pollingEmailIntervalRef.current) {
                                clearInterval(pollingEmailIntervalRef.current);
                                pollingEmailIntervalRef.current = null;
                            }
                            return;
                        }
                        // Update latest message time even if no code extracted
                        if (msg.receivedAt) {
                            setLatestEmailMessageTime(new Date(msg.receivedAt));
                        }
                    }
                    catch (err) {
                        console.error('Failed to reveal email message:', err);
                    }
                }
                lastEmailPollTimeRef.current = new Date();
            }
            catch (err) {
                console.error('Failed to poll email messages:', err);
            }
        }, 2000);
        // Stop polling after 5 minutes
        setTimeout(() => {
            if (pollingEmailIntervalRef.current) {
                clearInterval(pollingEmailIntervalRef.current);
                pollingEmailIntervalRef.current = null;
            }
            setPollingEmail(false);
        }, 5 * 60 * 1000);
    }
    function stopEmailPolling() {
        if (pollingEmailIntervalRef.current) {
            clearInterval(pollingEmailIntervalRef.current);
            pollingEmailIntervalRef.current = null;
        }
        setPollingEmail(false);
    }
    function formatTimeAgo(date) {
        if (!date)
            return '';
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffSecs = Math.floor(diffMs / 1000);
        const diffMins = Math.floor(diffSecs / 60);
        const diffHours = Math.floor(diffMins / 60);
        if (diffSecs < 60)
            return 'just now';
        if (diffMins < 60)
            return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
        if (diffHours < 24)
            return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
        return `${Math.floor(diffHours / 24)} day${Math.floor(diffHours / 24) > 1 ? 's' : ''} ago`;
    }
    async function handleReveal() {
        if (!item)
            return;
        try {
            const revealedData = await vaultApi.revealItem(item.id);
            setRevealed(revealedData);
            // Don't auto-show - user must click eye icon to reveal
            setShowPassword(false);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to reveal item'));
        }
    }
    async function generateTotpCode() {
        if (!item || !revealed?.totpSecret)
            return;
        try {
            const result = await vaultApi.generateTotpCode(item.id);
            setTotpCode(result.code);
            setTotpExpiresAt(new Date(result.expiresAt));
        }
        catch (err) {
            console.error('Failed to generate TOTP code:', err);
        }
    }
    async function handleCopy(field, value) {
        try {
            await navigator.clipboard.writeText(value);
            setCopied({ ...copied, [field]: true });
            setTimeout(() => {
                setCopied({ ...copied, [field]: false });
            }, 2000);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to copy'));
        }
    }
    function getItemIcon() {
        if (!item)
            return _jsx(Lock, { size: 20 });
        switch (item.type) {
            case 'api_key':
                return _jsx(Key, { size: 20 });
            case 'secure_note':
                return _jsx(FileText, { size: 20 });
            default:
                return _jsx(Lock, { size: 20 });
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Loading...", description: "", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    const breadcrumbs = [
        { label: 'Vault', href: '/vault', icon: _jsx(Lock, { size: 14 }) },
        ...(item?.folderId ? [{ label: 'Folder', href: '/vault' }] : []),
        { label: item?.title || 'Item' },
    ];
    return (_jsxs(Page, { title: item?.title || 'Item not found', description: item?.url || '', breadcrumbs: breadcrumbs, onNavigate: navigate, actions: item ? (_jsxs(Button, { variant: "primary", onClick: () => navigate(`/vault/items/${item.id}/edit`), children: [_jsx(Edit, { size: 16, className: "mr-2" }), "Edit"] })) : undefined, children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), !item && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "Item not found" }) })), item && (_jsx("div", { className: "space-y-4", children: _jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [getItemIcon(), _jsx("div", { className: "flex-1", children: _jsx("h2", { className: "text-xl font-semibold", children: item.title }) })] }), item.url && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "URL" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("a", { href: item.url, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-blue-600 hover:underline flex-1", children: item.url }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('url', item.url), children: copied.url ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })] })), item.username && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Username" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded flex-1", children: item.username }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('username', item.username), children: copied.username ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })] })), item.type === 'credential' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Password" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded flex-1", children: revealed?.password && showPassword ? revealed.password : '••••••••' }), _jsx(Button, { variant: "ghost", size: "sm", onClick: async () => {
                                                    if (!revealed?.password) {
                                                        await handleReveal();
                                                        setShowPassword(true);
                                                    }
                                                    else {
                                                        setShowPassword(!showPassword);
                                                    }
                                                }, children: revealed?.password && showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) }), revealed?.password && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('password', revealed.password), children: copied.password ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) }))] })] })), item.type === 'api_key' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Secret / Key" }), _jsx("div", { className: "relative mt-1", children: revealed?.secret || revealed?.password ? (_jsxs(_Fragment, { children: [_jsx("textarea", { value: showPassword ? (revealed.secret || revealed.password) : '•'.repeat(Math.max((revealed.secret || revealed.password || '').length, 50)), readOnly: true, className: "w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm", style: {
                                                        ...(showPassword ? {} : {
                                                            caretColor: 'transparent',
                                                        })
                                                    } }), _jsxs("div", { className: "absolute top-2 right-2 flex gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), title: showPassword ? 'Hide key' : 'Show key', children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('secret', revealed.secret || revealed.password), title: "Copy key", children: copied.secret ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })] })) : (_jsxs(_Fragment, { children: [_jsx("textarea", { value: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", readOnly: true, className: "w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm" }), _jsx("div", { className: "absolute top-2 right-2", children: _jsx(Button, { variant: "ghost", size: "sm", onClick: handleReveal, title: "Reveal secret", children: _jsx(Eye, { size: 16 }) }) })] })) })] })), revealed?.totpSecret && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "2FA Code (TOTP)" }), _jsx("div", { className: "flex items-center gap-2 mt-1", children: totpCode ? (_jsxs(_Fragment, { children: [_jsx("code", { className: "text-2xl font-mono font-bold bg-secondary px-4 py-2 rounded", children: totpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: generateTotpCode, title: "Refresh code", children: _jsx(RefreshCw, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('totp', totpCode), children: copied.totp ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })) : (_jsx(Button, { variant: "secondary", onClick: generateTotpCode, children: "Generate TOTP Code" })) }), totpExpiresAt && (_jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: ["Expires in ", Math.ceil((totpExpiresAt.getTime() - Date.now()) / 1000), "s"] }))] })), item.type === 'credential' && item.username && globalEmailAddress &&
                                item.username.toLowerCase() === globalEmailAddress.toLowerCase() && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "2FA Code (Email)" }), _jsxs("div", { className: "mt-1 space-y-3", children: [_jsxs("div", { children: [_jsxs("label", { className: "text-sm font-medium text-muted-foreground flex items-center gap-1", children: [_jsx(Mail, { size: 14 }), "2FA Email Address"] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 px-3 py-2 rounded flex-1", children: globalEmailAddress }), _jsx(Button, { variant: "ghost", size: "sm", onClick: copyEmailAddress, children: emailCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "When the service sends a 2FA code to this email, it will be automatically detected." })] }), !pollingEmail && !emailOtpCode && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: startEmailPolling, children: [_jsx(Mail, { size: 16, className: "mr-2" }), "Start Waiting for Email"] })), pollingEmail && (_jsxs("div", { className: "flex items-center gap-2", children: [_jsx("p", { className: "text-sm text-muted-foreground animate-pulse", children: "Waiting for email message..." }), _jsx(Button, { variant: "ghost", size: "sm", onClick: stopEmailPolling, children: "Stop" })] })), emailOtpCode && (_jsxs("div", { className: `p-3 bg-secondary rounded-md border-2 ${emailOtpConfidence === 'high'
                                                    ? 'border-green-500'
                                                    : emailOtpConfidence === 'medium'
                                                        ? 'border-yellow-500'
                                                        : 'border-gray-400'}`, children: [_jsxs("label", { className: `text-sm font-medium ${emailOtpConfidence === 'high'
                                                            ? 'text-green-600'
                                                            : emailOtpConfidence === 'medium'
                                                                ? 'text-yellow-600'
                                                                : 'text-gray-600'}`, children: ["OTP Code Received (", emailOtpConfidence, " confidence)"] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold", children: emailOtpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('emailOtp', emailOtpCode), children: copied.emailOtp ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] }), emailOtpConfidence !== 'high' && emailOtpFullMessage && (_jsxs("div", { className: "mt-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowFullEmailMessage(!showFullEmailMessage), children: showFullEmailMessage ? 'Hide Full Message' : 'Show Full Message' }), showFullEmailMessage && (_jsx("div", { className: "mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto", children: emailOtpFullMessage }))] })), latestEmailMessageTime && (_jsxs("p", { className: "text-xs text-muted-foreground mt-2", children: ["Received ", formatTimeAgo(latestEmailMessageTime)] }))] }))] })] })), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: item.type === 'secure_note' ? 'Content' : 'Notes' }), revealed ? (_jsx("div", { className: "mt-1 p-3 border rounded text-sm whitespace-pre-wrap", children: revealed.notes || _jsx("span", { className: "text-muted-foreground italic", children: "No notes" }) })) : (_jsx("div", { className: "mt-1", children: _jsxs(Button, { variant: "secondary", onClick: handleReveal, children: [_jsx(Eye, { size: 16, className: "mr-2" }), "Reveal ", item.type === 'secure_note' ? 'Content' : 'Notes'] }) }))] }), item.tags && item.tags.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Tags" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-1", children: item.tags.map(tag => (_jsx("span", { className: "px-2 py-1 bg-secondary rounded-md text-sm", children: tag }, tag))) })] }))] }) }) }))] }));
}
export default ItemDetail;
