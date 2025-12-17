'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Copy, Check, Eye, EyeOff, Lock as LockIcon, Mail, MessageSquare } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { OtpWaitingModal } from '../components/OtpWaitingModal';
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
    const [showSmsOtpModal, setShowSmsOtpModal] = useState(false);
    const [showEmailOtpModal, setShowEmailOtpModal] = useState(false);
    const [qrCodeInput, setQrCodeInput] = useState('');
    const [qrCodePasteMode, setQrCodePasteMode] = useState(false);
    // Email 2FA state
    const [globalEmailAddress, setGlobalEmailAddress] = useState(null);
    const [emailCopied, setEmailCopied] = useState(false);
    const [globalPhoneNumber, setGlobalPhoneNumber] = useState(null);
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
        loadGlobalPhoneNumber();
    }, [itemId]);
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
            let hasTotp = false;
            try {
                const revealed = await vaultApi.revealItem(itemData.id);
                if (itemData.type === 'api_key') {
                    setSecret(revealed.secret || revealed.password || '');
                }
                else {
                    setPassword(revealed.password || '');
                }
                setNotes(revealed.notes || '');
                // Check if TOTP secret exists
                if (revealed.totpSecret) {
                    hasTotp = true;
                    setQrCodeInput(revealed.totpSecret);
                }
                // Load 2FA type from secret blob
                if (revealed.twoFactorType) {
                    setTwoFactorType(revealed.twoFactorType);
                }
                else if (hasTotp) {
                    // Fallback: if TOTP exists but no preference, default to QR
                    setTwoFactorType('qr');
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
    async function loadGlobalEmailAddress() {
        try {
            const result = await vaultApi.getGlobalEmailAddress();
            setGlobalEmailAddress(result.emailAddress);
        }
        catch (err) {
            console.error('Failed to load global email address:', err);
        }
    }
    async function loadGlobalPhoneNumber() {
        try {
            const result = await vaultApi.getGlobalPhoneNumber();
            setGlobalPhoneNumber(result.phoneNumber);
        }
        catch (err) {
            console.error('Failed to load global phone number:', err);
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
            setError(null);
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
            // Store 2FA type preference in the secret blob
            if (itemType === 'credential') {
                itemData.twoFactorType = twoFactorType;
            }
            let savedItem;
            if (itemId) {
                savedItem = await vaultApi.updateItem(itemId, itemData);
            }
            else {
                savedItem = await vaultApi.createItem(itemData);
            }
            // Handle 2FA setup after item is saved
            if (savedItem.id) {
                // No provisioning needed - webhook handles all SMS messages
                // If QR code was pasted but item didn't exist, import it now
                if (qrCodeInput.trim() && twoFactorType === 'qr') {
                    try {
                        await vaultApi.importTotp(savedItem.id, qrCodeInput.trim());
                    }
                    catch (err) {
                        console.error('Failed to import TOTP after save:', err);
                        // Don't fail the save if TOTP import fails
                    }
                }
            }
            navigate('/vault/');
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
                                    ], disabled: !!itemId })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Title *" }), _jsx(Input, { value: formData.title || '', onChange: (value) => setFormData({ ...formData, title: value }), placeholder: "e.g., GitHub Account" })] }), itemType === 'credential' && (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Username" }), _jsx(Input, { value: formData.username || '', onChange: (value) => setFormData({ ...formData, username: value }), placeholder: "username or email" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "URL *" }), _jsx(Input, { value: formData.url || '', onChange: (value) => setFormData({ ...formData, url: value }), placeholder: "https://example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Password" }), _jsxs("div", { className: "flex items-center gap-2 w-full", children: [_jsx(Input, { type: showPassword ? 'text' : 'password', value: password, onChange: (value) => setPassword(value), placeholder: "Enter password", className: "flex-1" }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "2FA" }), _jsx(Select, { value: twoFactorType, onChange: (value) => {
                                                const newType = value;
                                                setTwoFactorType(newType);
                                            }, options: [
                                                { value: 'off', label: 'Off' },
                                                { value: 'qr', label: 'QR Code (TOTP)' },
                                                { value: 'phone', label: 'Phone Number (SMS)' },
                                                { value: 'email', label: 'Email' },
                                            ] })] }), twoFactorType === 'phone' && (_jsxs("div", { className: "mt-3 p-4 bg-secondary rounded-md space-y-3", children: [_jsx("div", { className: "text-sm text-muted-foreground", children: "SMS 2FA is enabled. When you save this item, SMS messages sent to the configured phone number will be automatically detected for OTP codes." }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => setShowSmsOtpModal(true), children: [_jsx(MessageSquare, { size: 16, className: "mr-2" }), "View SMS OTP Codes"] })] })), twoFactorType === 'email' && (_jsx("div", { className: "mt-3 p-4 bg-secondary rounded-md space-y-3", children: globalEmailAddress ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsxs("label", { className: "text-sm font-medium text-muted-foreground flex items-center gap-1", children: [_jsx(Mail, { size: 14 }), "2FA Email Address"] }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-background px-2 py-1 rounded", children: globalEmailAddress }), _jsx(Button, { variant: "ghost", size: "sm", onClick: copyEmailAddress, title: "Copy to clipboard", children: emailCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] }), _jsx("p", { className: "text-xs text-muted-foreground mt-2", children: "When the service sends a 2FA code to this email, it will be automatically detected." })] }), _jsxs(Button, { variant: "secondary", size: "sm", onClick: () => setShowEmailOtpModal(true), children: [_jsx(Mail, { size: 16, className: "mr-2" }), "View Email OTP Codes"] })] })) : (_jsx(Alert, { variant: "warning", title: "No Email Address Configured", children: "A global admin must configure a 2FA email address in the vault settings." })) })), twoFactorType === 'qr' && (_jsx("div", { className: "mt-3 p-4 bg-secondary rounded-md space-y-3", children: _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "QR Code / TOTP Secret" }), _jsx("p", { className: "text-sm text-muted-foreground mt-1 mb-2", children: "Paste the TOTP secret URI (otpauth://totp/...) or base32 secret" }), _jsxs("div", { className: "flex gap-2", children: [_jsx(Input, { value: qrCodeInput, onChange: (value) => setQrCodeInput(value), placeholder: "otpauth://totp/... or paste secret", className: "flex-1" }), _jsx(Button, { variant: "secondary", size: "sm", onClick: handlePasteFromClipboard, children: "Paste from Clipboard" })] }), qrCodeInput && (_jsx(Button, { variant: "primary", size: "sm", onClick: handleQrCodePaste, disabled: saving || !itemId, className: "mt-2", children: "Import TOTP Secret" }))] }) }))] })), itemType === 'api_key' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Secret / Key" }), _jsxs("div", { className: "relative", children: [_jsx("textarea", { value: showPassword ? secret : secret ? '•'.repeat(Math.max(secret.length, 50)) : '', onChange: (e) => setSecret(e.target.value), placeholder: "Paste SSH key or API key", className: "w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm", style: {
                                                ...(showPassword ? {} : {
                                                    caretColor: 'transparent',
                                                })
                                            } }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), className: "absolute top-2 right-2", title: showPassword ? 'Hide key' : 'Show key', children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) })] })] })), itemType === 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Note Content" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Enter your secure note...", className: "w-full px-3 py-2 border rounded-md min-h-[200px]" })] })), itemType !== 'secure_note' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Notes" }), _jsx("textarea", { value: notes, onChange: (e) => setNotes(e.target.value), placeholder: "Additional notes...", className: "w-full px-3 py-2 border rounded-md min-h-[100px]" })] })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => {
                                        if (itemId) {
                                            navigate(`/vault/items/${itemId}`);
                                        }
                                        else {
                                            navigate('/vault/');
                                        }
                                    }, children: "Cancel" }), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !formData.title?.trim() || (itemType === 'credential' && !formData.url?.trim()), children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Saving...' : 'Save'] })] })] }) }), showSmsOtpModal && (_jsx(OtpWaitingModal, { open: true, mode: "sms", itemTitle: item?.title, phoneNumber: globalPhoneNumber, onClose: () => setShowSmsOtpModal(false) })), showEmailOtpModal && (_jsx(OtpWaitingModal, { open: true, mode: "email", itemTitle: item?.title, emailAddress: globalEmailAddress, onClose: () => setShowEmailOtpModal(false) }))] }));
}
export default ItemEdit;
