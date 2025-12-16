'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Copy, Check, Eye, EyeOff } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { extractOtpCode } from '../utils/otp-extractor';
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
    const [qrCodeInput, setQrCodeInput] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    useEffect(() => {
        if (twoFactorType === 'phone') {
            loadGlobalPhoneNumber();
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
    async function startSmsPolling() {
        if (pollingSms)
            return;
        setPollingSms(true);
        setOtpCode(null);
        const interval = setInterval(async () => {
            try {
                const result = await vaultApi.getLatestSmsMessages();
                for (const msg of result.messages) {
                    try {
                        const revealResult = await vaultApi.revealSmsMessage(msg.id);
                        const code = extractOtpCode(revealResult.body);
                        if (code) {
                            setOtpCode(code);
                            setPollingSms(false);
                            clearInterval(interval);
                            return;
                        }
                    }
                    catch (err) {
                        console.error('Failed to reveal SMS message:', err);
                    }
                }
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
                            ] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Title *" }), _jsx(Input, { value: title, onChange: (value) => setTitle(value), placeholder: "e.g., GitHub Account" })] }), itemType === 'credential' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Username" }), _jsx(Input, { value: username, onChange: (value) => setUsername(value), placeholder: "username or email" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "URL *" }), _jsx(Input, { value: url, onChange: (value) => setUrl(value), placeholder: "https://example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Password" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: showPassword ? 'text' : 'password', value: password, onChange: (value) => setPassword(value), placeholder: "Enter password", className: "flex-1" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "2FA" }), _jsx(Select, { value: twoFactorType, onChange: (value) => setTwoFactorType(value), options: [
                                        { value: 'off', label: 'Off' },
                                        { value: 'qr', label: 'QR Code (TOTP)' },
                                        { value: 'phone', label: 'Phone Number (SMS)' },
                                    ] })] }), twoFactorType === 'phone' && (_jsx("div", { className: "p-4 bg-secondary rounded-md space-y-3", children: globalPhoneNumber ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Registered Phone Number" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-background px-2 py-1 rounded", children: globalPhoneNumber }), _jsx(Button, { variant: "ghost", size: "sm", onClick: copyPhoneNumber, children: phoneCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })] }), !pollingSms && !otpCode && (_jsx(Button, { variant: "secondary", size: "sm", onClick: startSmsPolling, children: "Start Waiting for SMS" })), pollingSms && (_jsx("p", { className: "text-sm text-muted-foreground", children: "Waiting for SMS message..." })), otpCode && (_jsxs("div", { className: "p-3 bg-background rounded-md border-2 border-green-500", children: [_jsx("label", { className: "text-sm font-medium text-green-600", children: "OTP Code Received" }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold", children: otpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => navigator.clipboard.writeText(otpCode), children: _jsx(Copy, { size: 16 }) })] })] }))] })) : (_jsx(Alert, { variant: "warning", title: "No Phone Number Configured", children: "Admin must configure a phone number in Setup." })) })), twoFactorType === 'qr' && (_jsx("div", { className: "p-4 bg-secondary rounded-md space-y-3", children: _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "QR Code / TOTP Secret" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1 mb-2", children: "Paste the TOTP secret URI (otpauth://totp/...) or base32 secret" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: qrCodeInput, onChange: (value) => setQrCodeInput(value), placeholder: "otpauth://totp/... or paste secret", className: "flex-1" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: async () => {
                                                    try {
                                                        const text = await navigator.clipboard.readText();
                                                        setQrCodeInput(text);
                                                    }
                                                    catch (err) {
                                                        console.error('Failed to read clipboard:', err);
                                                    }
                                                }, children: "Paste" })] })] }) }))] })), itemType === 'api_key' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Secret / Key" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: showPassword ? 'text' : 'password', value: secret, onChange: (value) => setSecret(value), placeholder: "Paste SSH key or API key", className: "flex-1" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] })), itemType === 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Note Content" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Enter your secure note...", className: "w-full px-3 py-2 border rounded-md min-h-[200px]" })] })), itemType !== 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Notes" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Additional notes...", className: "w-full px-3 py-2 border rounded-md min-h-[100px]" })] })), _jsxs("div", { className: "flex justify-end gap-2 pt-4 border-t", children: [_jsx(Button, { variant: "secondary", onClick: handleClose, children: "Cancel" }), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !title.trim() || (itemType === 'credential' && !url.trim()), children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Saving...' : 'Save'] })] })] }) }));
}
