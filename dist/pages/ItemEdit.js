'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Copy, Check, Eye, EyeOff, Lock as LockIcon } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { extractOtpCode } from '../utils/otp-extractor';
export function ItemEdit({ itemId, onNavigate }) {
    const { Page, Card, Button, Input, Alert, Select } = useUi();
    const [loading, setLoading] = useState(!!itemId);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [item, setItem] = useState(null);
    const [itemType, setItemType] = useState('credential');
    const [formData, setFormData] = useState({
        title: '',
        username: '',
        url: '',
        tags: [],
    });
    const [password, setPassword] = useState('');
    const [secret, setSecret] = useState(''); // For SSH keys, API keys
    const [notes, setNotes] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [twoFactorType, setTwoFactorType] = useState('off');
    const [globalPhoneNumber, setGlobalPhoneNumber] = useState(null);
    const [phoneCopied, setPhoneCopied] = useState(false);
    const [pollingSms, setPollingSms] = useState(false);
    const [otpCode, setOtpCode] = useState(null);
    const [latestMessageTime, setLatestMessageTime] = useState(null);
    const [qrCodeInput, setQrCodeInput] = useState('');
    const [qrCodePasteMode, setQrCodePasteMode] = useState(false);
    const [userPhoneNumber, setUserPhoneNumber] = useState('');
    const [sendingSmsRequest, setSendingSmsRequest] = useState(false);
    const lastPollTimeRef = useRef(null);
    const pollingIntervalRef = useRef(null);
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
        loadGlobalPhoneNumber();
    }, [itemId]);
    useEffect(() => {
        // Cleanup polling on unmount
        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
            }
        };
    }, []);
    async function loadItem() {
        try {
            setLoading(true);
            const itemData = await vaultApi.getItem(itemId);
            setItem(itemData);
            setItemType(itemData.type);
            setFormData({
                title: itemData.title,
                username: itemData.username || '',
                url: itemData.url || '',
                tags: itemData.tags || [],
            });
            // Load revealed secrets (password/secret/notes)
            try {
                const revealed = await vaultApi.revealItem(itemData.id);
                if (itemData.type === 'api_key') {
                    setSecret(revealed.secret || revealed.password || '');
                }
                else {
                    setPassword(revealed.password || '');
                }
                setNotes(revealed.notes || '');
                // Check if TOTP secret exists to set 2FA type
                if (revealed.totpSecret) {
                    setTwoFactorType('qr');
                    setQrCodeInput(revealed.totpSecret);
                }
            }
            catch (revealErr) {
                // If reveal fails, that's okay - user can still edit other fields
                console.error('Failed to reveal item secrets:', revealErr);
            }
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load item'));
        }
        finally {
            setLoading(false);
        }
    }
    async function loadGlobalPhoneNumber() {
        try {
            const result = await vaultApi.getGlobalPhoneNumber();
            setGlobalPhoneNumber(result.phoneNumber);
        }
        catch (err) {
            // Silently fail - global phone number may not be set
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
    async function sendSmsRequest() {
        if (!itemId) {
            setError(new Error('Please save the item first before requesting SMS 2FA'));
            return;
        }
        if (!userPhoneNumber.trim()) {
            setError(new Error('Please enter your phone number'));
            return;
        }
        try {
            setSendingSmsRequest(true);
            setError(null);
            await vaultApi.requestSms2fa(itemId, userPhoneNumber.trim());
            // After sending SMS request, start polling for the response
            await startSmsPolling();
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to send SMS request'));
        }
        finally {
            setSendingSmsRequest(false);
        }
    }
    async function startSmsPolling() {
        if (pollingSms)
            return;
        setPollingSms(true);
        setOtpCode(null);
        setLatestMessageTime(null);
        lastPollTimeRef.current = new Date();
        // Poll every 2 seconds
        pollingIntervalRef.current = setInterval(async () => {
            try {
                const since = lastPollTimeRef.current?.toISOString();
                const result = await vaultApi.getLatestSmsMessages(since);
                // Check each message for OTP code
                for (const msg of result.messages) {
                    try {
                        const revealResult = await vaultApi.revealSmsMessage(msg.id);
                        const code = extractOtpCode(revealResult.body);
                        if (code) {
                            setOtpCode(code);
                            setLatestMessageTime(new Date(msg.receivedAt));
                            setPollingSms(false);
                            if (pollingIntervalRef.current) {
                                clearInterval(pollingIntervalRef.current);
                                pollingIntervalRef.current = null;
                            }
                            return;
                        }
                        // Update latest message time even if no code extracted
                        if (msg.receivedAt) {
                            setLatestMessageTime(new Date(msg.receivedAt));
                        }
                    }
                    catch (err) {
                        console.error('Failed to reveal SMS message:', err);
                    }
                }
                lastPollTimeRef.current = new Date();
            }
            catch (err) {
                console.error('Failed to poll SMS messages:', err);
            }
        }, 2000);
        // Stop polling after 5 minutes
        setTimeout(() => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
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
    async function handleQrCodePaste() {
        if (!qrCodeInput.trim())
            return;
        // If no itemId, we'll save it when the item is created
        if (!itemId) {
            // Store QR code input to be saved with the item
            setQrCodePasteMode(true);
            return;
        }
        try {
            setSaving(true);
            await vaultApi.importTotp(itemId, qrCodeInput.trim());
            setQrCodeInput('');
            setQrCodePasteMode(false);
            setTwoFactorType('qr');
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to import QR code'));
        }
        finally {
            setSaving(false);
        }
    }
    async function handlePasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            setQrCodeInput(text);
            setQrCodePasteMode(true);
        }
        catch (err) {
            console.error('Failed to read clipboard:', err);
            setError(new Error('Failed to read clipboard. Please paste manually.'));
        }
    }
    function stopSmsPolling() {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        setPollingSms(false);
    }
    async function handleSave() {
        if (!formData.title?.trim()) {
            setError(new Error('Title is required'));
            return;
        }
        if (itemType === 'credential' && !formData.url?.trim()) {
            setError(new Error('URL is required for Login items'));
            return;
        }
        try {
            setSaving(true);
            // Stop polling if active
            stopSmsPolling();
            const itemData = {
                ...formData,
                type: itemType,
            };
            // Type-specific fields
            if (itemType === 'credential') {
                itemData.username = formData.username?.trim() || null;
                itemData.url = formData.url?.trim() || null;
                itemData.password = password; // Will be encrypted on backend
            }
            else if (itemType === 'api_key') {
                // For API keys, store secret in password field (backend handles encryption)
                itemData.password = secret.trim();
            }
            itemData.notes = notes.trim() || null;
            let savedItem;
            if (itemId) {
                savedItem = await vaultApi.updateItem(itemId, itemData);
            }
            else {
                savedItem = await vaultApi.createItem(itemData);
            }
            // If QR code was pasted but item didn't exist, import it now
            if (qrCodeInput.trim() && savedItem.id) {
                try {
                    await vaultApi.importTotp(savedItem.id, qrCodeInput.trim());
                }
                catch (err) {
                    console.error('Failed to import TOTP after save:', err);
                    // Don't fail the save if TOTP import fails
                }
            }
            navigate('/vault/personal');
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to save item'));
        }
        finally {
            setSaving(false);
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Loading...", description: "", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    const breadcrumbs = [
        { label: 'Vault', href: '/vault/personal', icon: _jsx(LockIcon, { size: 14 }) },
        ...(item?.folderId ? [{ label: 'Folder', href: `/vault/folders/${item.folderId}` }] : []),
        ...(itemId && item ? [{ label: item.title, href: `/vault/items/${itemId}` }] : []),
        { label: itemId ? 'Edit' : 'New Item' },
    ];
    return (_jsxs(Page, { title: itemId ? 'Edit Item' : 'New Item', description: "Enter the credential information", breadcrumbs: breadcrumbs, onNavigate: navigate, children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Type" }), _jsx(Select, { value: itemType, onChange: (value) => setItemType(value), options: [
                                        { value: 'credential', label: 'Login' },
                                        { value: 'api_key', label: 'SSH Key / API Key' },
                                        { value: 'secure_note', label: 'Secure Note' },
                                    ], disabled: !!itemId })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Title *" }), _jsx(Input, { value: formData.title || '', onChange: (value) => setFormData({ ...formData, title: value }), placeholder: "e.g., GitHub Account" })] }), itemType === 'credential' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Username" }), _jsx(Input, { value: formData.username || '', onChange: (value) => setFormData({ ...formData, username: value }), placeholder: "username or email" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "URL *" }), _jsx(Input, { value: formData.url || '', onChange: (value) => setFormData({ ...formData, url: value }), placeholder: "https://example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Password" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx(Input, { type: showPassword ? 'text' : 'password', value: password, onChange: (value) => setPassword(value), placeholder: "Enter password", className: "flex-1" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "2FA" }), _jsx(Select, { value: twoFactorType, onChange: (value) => {
                                                const newType = value;
                                                setTwoFactorType(newType);
                                                if (newType !== 'phone') {
                                                    stopSmsPolling();
                                                    setOtpCode(null);
                                                }
                                            }, options: [
                                                { value: 'off', label: 'Off' },
                                                { value: 'qr', label: 'QR Code (TOTP)' },
                                                { value: 'phone', label: 'Phone Number (SMS)' },
                                            ] })] }), twoFactorType === 'phone' && (_jsx("div", { className: "p-4 bg-secondary rounded-md space-y-3", children: globalPhoneNumber ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Registered Phone Number" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-background px-2 py-1 rounded", children: globalPhoneNumber }), _jsx(Button, { variant: "ghost", size: "sm", onClick: copyPhoneNumber, title: "Copy to clipboard", children: phoneCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] }), _jsx("p", { className: "text-xs text-muted-foreground mt-2", children: "Copy this number and use it for 2FA setup on the website" })] }), itemId && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Your Phone Number (E.164 format)" }), _jsx(Input, { value: userPhoneNumber, onChange: (value) => setUserPhoneNumber(value), placeholder: "+1234567890", className: "mt-1" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1", children: "Enter your phone number to receive 2FA code requests" })] })), !pollingSms && !otpCode && (_jsxs("div", { className: "flex gap-2", children: [itemId && userPhoneNumber.trim() && (_jsx(Button, { variant: "primary", size: "sm", onClick: sendSmsRequest, disabled: sendingSmsRequest, children: sendingSmsRequest ? 'Sending...' : 'Send SMS Request' })), _jsx(Button, { variant: "secondary", size: "sm", onClick: startSmsPolling, children: "Start Waiting for SMS" })] })), pollingSms && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: latestMessageTime
                                                            ? `Waiting for SMS message... Last message: ${formatTimeAgo(latestMessageTime)}`
                                                            : 'Waiting for SMS message...' }), _jsx(Button, { variant: "ghost", size: "sm", onClick: stopSmsPolling, children: "Stop Polling" })] })), otpCode && (_jsxs("div", { className: "p-3 bg-background rounded-md border-2 border-green-500", children: [_jsxs("label", { className: "text-sm font-medium text-green-600", children: ["OTP Code Received", latestMessageTime && (_jsxs("span", { className: "text-xs font-normal text-muted-foreground ml-2", children: ["(", formatTimeAgo(latestMessageTime), ")"] }))] }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold", children: otpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                                    navigator.clipboard.writeText(otpCode);
                                                                    setPhoneCopied(true);
                                                                    setTimeout(() => setPhoneCopied(false), 2000);
                                                                }, children: _jsx(Copy, { size: 16 }) })] })] }))] })) : (_jsx(Alert, { variant: "warning", title: "No Phone Number Configured", children: "A global admin must configure a phone number in the vault settings." })) })), twoFactorType === 'qr' && (_jsx("div", { className: "p-4 bg-secondary rounded-md space-y-3", children: _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "QR Code / TOTP Secret" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1 mb-2", children: "Paste the TOTP secret URI (otpauth://totp/...) or base32 secret" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: qrCodeInput, onChange: (value) => setQrCodeInput(value), placeholder: "otpauth://totp/... or paste secret", className: "flex-1" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: handlePasteFromClipboard, children: "Paste from Clipboard" })] }), qrCodeInput && (_jsx(Button, { variant: "primary", size: "sm", onClick: handleQrCodePaste, disabled: saving || !itemId, className: "mt-2", children: "Import TOTP Secret" }))] }) }))] })), itemType === 'api_key' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Secret / Key" }), _jsxs("div", { className: "relative", children: [_jsx("textarea", { value: showPassword ? secret : secret ? '•'.repeat(Math.max(secret.length, 50)) : '', onChange: (e) => setSecret(e.target.value), placeholder: "Paste SSH key or API key", className: "w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm", style: {
                                                ...(showPassword ? {} : {
                                                    caretColor: 'transparent',
                                                })
                                            } }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), className: "absolute top-2 right-2", title: showPassword ? 'Hide key' : 'Show key', children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] })), itemType === 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Note Content" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Enter your secure note...", className: "w-full px-3 py-2 border rounded-md min-h-[200px]" })] })), itemType !== 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Notes" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Additional notes...", className: "w-full px-3 py-2 border rounded-md min-h-[100px]" })] })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                        if (itemId) {
                                            navigate(`/vault/items/${itemId}`);
                                        }
                                        else {
                                            navigate('/vault/personal');
                                        }
                                    }, children: "Cancel" }), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !formData.title?.trim() || (itemType === 'credential' && !formData.url?.trim()), children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Saving...' : 'Save'] })] })] }) })] }));
}
export default ItemEdit;
