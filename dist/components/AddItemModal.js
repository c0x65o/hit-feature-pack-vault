'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Copy, Check, Eye, EyeOff, Mail, Phone, MessageSquare } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { extractOtpWithConfidence } from '../utils/otp-extractor';
export function AddItemModal({ onClose, onSave, folderId }) {
    const { Modal, Button, Input, Select, Alert } = useUi();
    const [open, setOpen] = useState(true);
    const [itemType, setItemType] = useState('credential');
    const [title, setTitle] = useState('');
    const [username, setUsername] = useState('');
    const [url, setUrl] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [secret, setSecret] = useState(''); // For SSH keys, API keys
    const [notes, setNotes] = useState('');
    const [twoFactorType, setTwoFactorType] = useState('off');
    const [globalPhoneNumber, setGlobalPhoneNumber] = useState(null);
    const [phoneCopied, setPhoneCopied] = useState(false);
    const [pollingSms, setPollingSms] = useState(false);
    const [otpCode, setOtpCode] = useState(null);
    const [otpConfidence, setOtpConfidence] = useState('none');
    const [otpFullMessage, setOtpFullMessage] = useState(null);
    const [showFullMessage, setShowFullMessage] = useState(false);
    const [qrCodeInput, setQrCodeInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    // Email 2FA state
    const [globalEmailAddress, setGlobalEmailAddress] = useState(null);
    const [emailCopied, setEmailCopied] = useState(false);
    const [pollingEmail, setPollingEmail] = useState(false);
    // Track last poll time to avoid re-checking old messages
    const lastSmsPollTimeRef = useRef(null);
    const lastEmailPollTimeRef = useRef(null);
    useEffect(() => {
        if (twoFactorType === 'phone') {
            loadGlobalPhoneNumber();
        }
        else if (twoFactorType === 'email') {
            loadGlobalEmailAddress();
        }
    }, [twoFactorType]);
    async function loadGlobalPhoneNumber() {
        try {
            const result = await vaultApi.getGlobalPhoneNumber();
            setGlobalPhoneNumber(result.phoneNumber);
        }
        catch (err) {
            console.error('Failed to load global phone number:', err);
        }
    }
    async function copyPhoneNumber() {
        if (!globalPhoneNumber)
            return;
        try {
            await navigator.clipboard.writeText(globalPhoneNumber);
            setPhoneCopied(true);
            setTimeout(() => setPhoneCopied(false), 2000);
        }
        catch (err) {
            console.error('Failed to copy phone number:', err);
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
    async function startSmsPolling() {
        if (pollingSms)
            return;
        setPollingSms(true);
        setOtpCode(null);
        setOtpConfidence('none');
        setOtpFullMessage(null);
        setShowFullMessage(false);
        lastSmsPollTimeRef.current = new Date();
        const interval = setInterval(async () => {
            try {
                const since = lastSmsPollTimeRef.current?.toISOString();
                const result = await vaultApi.getLatestSmsMessages(since);
                for (const msg of result.messages) {
                    try {
                        const revealResult = await vaultApi.revealSmsMessage(msg.id);
                        const otpResult = extractOtpWithConfidence(revealResult.body);
                        if (otpResult.code) {
                            setOtpCode(otpResult.code);
                            setOtpConfidence(otpResult.confidence);
                            setOtpFullMessage(otpResult.fullMessage);
                            setPollingSms(false);
                            clearInterval(interval);
                            return;
                        }
                    }
                    catch (err) {
                        console.error('Failed to reveal SMS message:', err);
                    }
                }
                lastSmsPollTimeRef.current = new Date();
            }
            catch (err) {
                console.error('Failed to poll SMS messages:', err);
            }
        }, 2000);
        setTimeout(() => {
            clearInterval(interval);
            setPollingSms(false);
        }, 5 * 60 * 1000);
    }
    async function startEmailPolling() {
        if (pollingEmail)
            return;
        setPollingEmail(true);
        setOtpCode(null);
        setOtpConfidence('none');
        setOtpFullMessage(null);
        setShowFullMessage(false);
        lastEmailPollTimeRef.current = new Date();
        const interval = setInterval(async () => {
            try {
                const since = lastEmailPollTimeRef.current?.toISOString();
                const result = await vaultApi.getLatestEmailMessages({ since });
                for (const msg of result.messages) {
                    try {
                        const revealResult = await vaultApi.revealSmsMessage(msg.id);
                        const otpResult = extractOtpWithConfidence(revealResult.body);
                        if (otpResult.code) {
                            setOtpCode(otpResult.code);
                            setOtpConfidence(otpResult.confidence);
                            setOtpFullMessage(otpResult.fullMessage);
                            setPollingEmail(false);
                            clearInterval(interval);
                            return;
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
        setTimeout(() => {
            clearInterval(interval);
            setPollingEmail(false);
        }, 5 * 60 * 1000);
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
    async function handleSave() {
        if (!title.trim()) {
            setError(new Error('Title is required'));
            return;
        }
        if (itemType === 'credential' && !url.trim()) {
            setError(new Error('URL is required for Login items'));
            return;
        }
        try {
            setSaving(true);
            setError(null);
            const itemData = {
                title: title.trim(),
                type: itemType,
                folderId: folderId || null,
            };
            // Type-specific fields
            if (itemType === 'credential') {
                itemData.username = username.trim() || null;
                itemData.url = url.trim() || null;
                itemData.password = password;
            }
            else if (itemType === 'api_key') {
                // For API keys, store secret in password field (backend handles encryption)
                itemData.password = secret.trim();
            }
            itemData.notes = notes.trim() || null;
            // 2FA data - store TOTP secret separately to import after item creation
            if (twoFactorType === 'qr' && qrCodeInput.trim()) {
                itemData.totpSecret = qrCodeInput.trim();
            }
            // Phone 2FA doesn't need to store anything - it uses the global phone number
            await onSave(itemData);
            handleClose();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to save item'));
        }
        finally {
            setSaving(false);
        }
    }
    const handleClose = () => {
        setOpen(false);
        onClose();
    };
    return (_jsx(Modal, { open: open, title: "Add Item", onClose: handleClose, size: "lg", children: _jsxs("div", { className: "space-y-4", children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Type" }), _jsx(Select, { value: itemType, onChange: (value) => setItemType(value), options: [
                                { value: 'credential', label: 'Login' },
                                { value: 'api_key', label: 'SSH Key / API Key' },
                                { value: 'secure_note', label: 'Secure Note' },
                            ] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Title *" }), _jsx(Input, { value: title, onChange: (value) => setTitle(value), placeholder: "e.g., GitHub Account" })] }), itemType === 'credential' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "URL *" }), _jsx(Input, { value: url, onChange: (value) => setUrl(value), placeholder: "https://example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Username" }), _jsx(Input, { value: username, onChange: (value) => setUsername(value), placeholder: "username or email" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Password" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: showPassword ? 'text' : 'password', value: password, onChange: (value) => setPassword(value), placeholder: "Enter password", className: "flex-1" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "2FA" }), _jsx(Select, { value: twoFactorType, onChange: (value) => setTwoFactorType(value), options: [
                                        { value: 'off', label: 'Off' },
                                        { value: 'qr', label: 'QR Code (TOTP)' },
                                        { value: 'phone', label: 'Phone Number (SMS)' },
                                        { value: 'email', label: 'Email' },
                                    ] })] }), twoFactorType === 'phone' && (_jsx("div", { className: "mt-3 p-4 bg-secondary rounded-md space-y-3", children: globalPhoneNumber ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsxs("label", { className: "text-sm font-medium text-muted-foreground flex items-center gap-1", children: [_jsx(Phone, { size: 14 }), "Registered Phone Number"] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-background px-2 py-1 rounded", children: globalPhoneNumber }), _jsx(Button, { variant: "ghost", size: "sm", onClick: copyPhoneNumber, children: phoneCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })] }), !pollingSms && !otpCode && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: startSmsPolling, children: [_jsx(MessageSquare, { size: 16, className: "mr-2" }), "Start Waiting for SMS"] })), pollingSms && (_jsx("p", { className: "text-sm text-muted-foreground animate-pulse", children: "Waiting for SMS message..." })), otpCode && (_jsxs("div", { className: `p-3 bg-background rounded-md border-2 ${otpConfidence === 'high'
                                            ? 'border-green-500'
                                            : otpConfidence === 'medium'
                                                ? 'border-yellow-500'
                                                : 'border-gray-400'}`, children: [_jsxs("label", { className: `text-sm font-medium ${otpConfidence === 'high'
                                                    ? 'text-green-600'
                                                    : otpConfidence === 'medium'
                                                        ? 'text-yellow-600'
                                                        : 'text-gray-600'}`, children: ["OTP Code Received (", otpConfidence, " confidence)"] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold", children: otpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigator.clipboard.writeText(otpCode), children: _jsx(Copy, { size: 16 }) })] }), otpConfidence !== 'high' && otpFullMessage && (_jsxs("div", { className: "mt-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowFullMessage(!showFullMessage), children: showFullMessage ? 'Hide Full Message' : 'Show Full Message' }), showFullMessage && (_jsx("div", { className: "mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto", children: otpFullMessage }))] }))] }))] })) : (_jsx(Alert, { variant: "warning", title: "No Phone Number Configured", children: "Admin must configure a phone number in Setup." })) })), twoFactorType === 'email' && (_jsx("div", { className: "mt-3 p-4 bg-secondary rounded-md space-y-3", children: globalEmailAddress ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsxs("label", { className: "text-sm font-medium text-muted-foreground flex items-center gap-1", children: [_jsx(Mail, { size: 14 }), "2FA Email Address"] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-background px-2 py-1 rounded", children: globalEmailAddress }), _jsx(Button, { variant: "ghost", size: "sm", onClick: copyEmailAddress, children: emailCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "When the service sends a 2FA code to this email, it will be automatically detected." })] }), !pollingEmail && !otpCode && (_jsxs(Button, { variant: "secondary", size: "sm", onClick: startEmailPolling, children: [_jsx(Mail, { size: 16, className: "mr-2" }), "Start Waiting for Email"] })), pollingEmail && (_jsx("p", { className: "text-sm text-muted-foreground animate-pulse", children: "Waiting for email message..." })), otpCode && (_jsxs("div", { className: `p-3 bg-background rounded-md border-2 ${otpConfidence === 'high'
                                            ? 'border-green-500'
                                            : otpConfidence === 'medium'
                                                ? 'border-yellow-500'
                                                : 'border-gray-400'}`, children: [_jsxs("label", { className: `text-sm font-medium ${otpConfidence === 'high'
                                                    ? 'text-green-600'
                                                    : otpConfidence === 'medium'
                                                        ? 'text-yellow-600'
                                                        : 'text-gray-600'}`, children: ["OTP Code Received (", otpConfidence, " confidence)"] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold", children: otpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigator.clipboard.writeText(otpCode), children: _jsx(Copy, { size: 16 }) })] }), otpConfidence !== 'high' && otpFullMessage && (_jsxs("div", { className: "mt-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowFullMessage(!showFullMessage), children: showFullMessage ? 'Hide Full Message' : 'Show Full Message' }), showFullMessage && (_jsx("div", { className: "mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs font-mono whitespace-pre-wrap max-h-32 overflow-y-auto", children: otpFullMessage }))] }))] }))] })) : (_jsx(Alert, { variant: "warning", title: "No Email Address Configured", children: "Admin must configure a 2FA email address in Setup." })) })), twoFactorType === 'qr' && (_jsx("div", { className: "p-4 bg-secondary rounded-md space-y-3", children: _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "QR Code / TOTP Secret" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1 mb-2", children: "Paste the TOTP secret URI (otpauth://totp/...) or base32 secret" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: qrCodeInput, onChange: (value) => setQrCodeInput(value), placeholder: "otpauth://totp/... or paste secret", className: "flex-1" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: async () => {
                                                    try {
                                                        const text = await navigator.clipboard.readText();
                                                        setQrCodeInput(text);
                                                    }
                                                    catch (err) {
                                                        console.error('Failed to read clipboard:', err);
                                                    }
                                                }, children: "Paste" })] })] }) }))] })), itemType === 'api_key' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Secret / Key" }), _jsxs("div", { className: "relative", children: [_jsx("textarea", { value: showPassword ? secret : secret ? '•'.repeat(Math.max(secret.length, 50)) : '', onChange: (e) => setSecret(e.target.value), placeholder: "Paste SSH key or API key", className: "w-full px-3 py-2 border rounded-md min-h-[120px] font-mono text-sm", style: {
                                        ...(showPassword ? {} : {
                                            caretColor: 'transparent',
                                        })
                                    } }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), className: "absolute top-2 right-2", title: showPassword ? 'Hide key' : 'Show key', children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] })), itemType === 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Note Content" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Enter your secure note...", className: "w-full px-3 py-2 border rounded-md min-h-[200px]" })] })), itemType !== 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Notes" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Additional notes...", className: "w-full px-3 py-2 border rounded-md min-h-[100px]" })] })), _jsxs("div", { className: "flex justify-end gap-2 pt-4 border-t", children: [_jsx(Button, { variant: "secondary", onClick: handleClose, children: "Cancel" }), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !title.trim() || (itemType === 'credential' && !url.trim()), children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Saving...' : 'Save'] })] })] }) }));
}
