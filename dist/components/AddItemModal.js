'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Copy, Check, Eye, EyeOff, Mail, MessageSquare } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { OtpWaitingModal } from './OtpWaitingModal';
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
    const [showSmsOtpModal, setShowSmsOtpModal] = useState(false);
    const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
    const [qrCodeInput, setQrCodeInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    // Email 2FA state
    const [globalEmailAddress, setGlobalEmailAddress] = useState(null);
    const [emailCopied, setEmailCopied] = useState(false);
    useEffect(() => {
        if (twoFactorType === 'email') {
            loadGlobalEmailAddress();
        }
    }, [twoFactorType]);
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
        // Open the SMS OTP waiting modal instead of silent polling
        setShowSmsOtpModal(true);
    }
    async function startEmailPolling() {
        // Open the Email OTP waiting modal instead of manual polling
        setShowEmailOtpModal(true);
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
            // Phone 2FA doesn't need to store anything - messages come via SMS webhook
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
    return (_jsxs(Modal, { open: open, title: "Add Item", onClose: handleClose, size: "lg", children: [_jsxs("div", { className: "space-y-4", children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Type" }), _jsx(Select, { value: itemType, onChange: (value) => setItemType(value), options: [
                                    { value: 'credential', label: 'Login' },
                                    { value: 'api_key', label: 'SSH Key / API Key' },
                                    { value: 'secure_note', label: 'Secure Note' },
                                ] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Title *" }), _jsx(Input, { value: title, onChange: (value) => setTitle(value), placeholder: "e.g., GitHub Account" })] }), itemType === 'credential' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "URL *" }), _jsx(Input, { value: url, onChange: (value) => setUrl(value), placeholder: "https://example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Username" }), _jsx(Input, { value: username, onChange: (value) => setUsername(value), placeholder: "username or email" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Password" }), _jsxs("div", { className: "flex items-center gap-2 w-full", children: [_jsx(Input, { type: showPassword ? 'text' : 'password', value: password, onChange: (value) => setPassword(value), placeholder: "Enter password", className: "flex-1 w-full" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "2FA" }), _jsx(Select, { value: twoFactorType, onChange: (value) => setTwoFactorType(value), options: [
                                            { value: 'off', label: 'Off' },
                                            { value: 'qr', label: 'QR Code (TOTP)' },
                                            { value: 'phone', label: 'Phone Number (SMS)' },
                                            { value: 'email', label: 'Email' },
                                        ] })] }), twoFactorType === 'phone' && (_jsx("div", { className: "mt-3 p-4 bg-secondary rounded-md space-y-3", children: _jsxs(Button, { variant: "secondary", size: "sm", onClick: startSmsPolling, children: [_jsx(MessageSquare, { size: 16, className: "mr-2" }), "Start Waiting for SMS"] }) })), twoFactorType === 'email' && (_jsx("div", { className: "mt-3 p-4 bg-secondary rounded-md space-y-3", children: globalEmailAddress ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsxs("label", { className: "text-sm font-medium text-muted-foreground flex items-center gap-1", children: [_jsx(Mail, { size: 14 }), "2FA Email Address"] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-background px-2 py-1 rounded", children: globalEmailAddress }), _jsx(Button, { variant: "ghost", size: "sm", onClick: copyEmailAddress, children: emailCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "When the service sends a 2FA code to this email, it will be automatically detected." })] }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: startEmailPolling, children: [_jsx(Mail, { size: 16, className: "mr-2" }), "Start Waiting for Email"] })] })) : (_jsx(Alert, { variant: "warning", title: "No Email Address Configured", children: "Admin must configure a 2FA email address in Setup." })) })), twoFactorType === 'qr' && (_jsx("div", { className: "p-4 bg-secondary rounded-md space-y-3", children: _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "QR Code / TOTP Secret" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1 mb-2", children: "Paste the TOTP secret URI (otpauth://totp/...) or base32 secret" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: qrCodeInput, onChange: (value) => setQrCodeInput(value), placeholder: "otpauth://totp/... or paste secret", className: "flex-1" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: async () => {
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
                                        } }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), className: "absolute top-2 right-2", title: showPassword ? 'Hide key' : 'Show key', children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] })), itemType === 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Note Content" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Enter your secure note...", className: "w-full px-3 py-2 border rounded-md min-h-[200px]" })] })), itemType !== 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Notes" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Additional notes...", className: "w-full px-3 py-2 border rounded-md min-h-[100px]" })] })), _jsxs("div", { className: "flex justify-end gap-2 pt-4 border-t", children: [_jsx(Button, { variant: "secondary", onClick: handleClose, children: "Cancel" }), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !title.trim() || (itemType === 'credential' && !url.trim()), children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Saving...' : 'Save'] })] })] }), showSmsOtpModal && (_jsx(OtpWaitingModal, { open: true, mode: "sms", itemTitle: title || undefined, onClose: () => setShowSmsOtpModal(false) })), showEmailOtpModal && (_jsx(OtpWaitingModal, { open: true, mode: "email", itemTitle: title || undefined, emailAddress: globalEmailAddress || undefined, onClose: () => setShowEmailOtpModal(false) }))] }));
}
