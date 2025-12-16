'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useRef } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Copy, Check } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
import { extractOtpCode } from '../utils/otp-extractor';
export function ItemEdit({ itemId, onNavigate }) {
    const { Page, Card, Button, Input, Alert, Select } = useUi();
    const [loading, setLoading] = useState(!!itemId);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        title: '',
        username: '',
        url: '',
        tags: [],
    });
    const [password, setPassword] = useState('');
    const [twoFactorType, setTwoFactorType] = useState('off');
    const [globalPhoneNumber, setGlobalPhoneNumber] = useState(null);
    const [phoneCopied, setPhoneCopied] = useState(false);
    const [pollingSms, setPollingSms] = useState(false);
    const [otpCode, setOtpCode] = useState(null);
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
            const item = await vaultApi.getItem(itemId);
            setFormData({
                title: item.title,
                username: item.username || '',
                url: item.url || '',
                tags: item.tags || [],
            });
            // Note: Password and 2FA type would need to be loaded from revealed secrets
            // For now, we'll handle them separately
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
    async function startSmsPolling() {
        if (pollingSms)
            return;
        setPollingSms(true);
        setOtpCode(null);
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
                            setPollingSms(false);
                            if (pollingIntervalRef.current) {
                                clearInterval(pollingIntervalRef.current);
                                pollingIntervalRef.current = null;
                            }
                            return;
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
    function stopSmsPolling() {
        if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
        }
        setPollingSms(false);
    }
    async function handleSave() {
        try {
            setSaving(true);
            // Stop polling if active
            stopSmsPolling();
            const itemData = {
                ...formData,
                // Note: Password and 2FA settings would need to be encrypted and stored in secretBlobEncrypted
                // This is a simplified version - actual implementation would need proper encryption
            };
            if (itemId) {
                await vaultApi.updateItem(itemId, itemData);
            }
            else {
                await vaultApi.createItem(itemData);
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
    return (_jsxs(Page, { title: itemId ? 'Edit Item' : 'New Item', description: "Enter the credential information", children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Title" }), _jsx(Input, { value: formData.title || '', onChange: (value) => setFormData({ ...formData, title: value }), placeholder: "e.g., GitHub Account" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Username" }), _jsx(Input, { value: formData.username || '', onChange: (value) => setFormData({ ...formData, username: value }), placeholder: "username or email" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "URL" }), _jsx(Input, { value: formData.url || '', onChange: (value) => setFormData({ ...formData, url: value }), placeholder: "https://example.com" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Password" }), _jsx(Input, { type: "password", value: password, onChange: (value) => setPassword(value), placeholder: "Enter password" })] }), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "2FA" }), _jsx(Select, { value: twoFactorType, onChange: (value) => {
                                        const newType = value;
                                        setTwoFactorType(newType);
                                        if (newType !== 'phone') {
                                            stopSmsPolling();
                                            setOtpCode(null);
                                        }
                                    }, options: [
                                        { value: 'off', label: 'Off' },
                                        { value: 'qr', label: 'QR Code' },
                                        { value: 'phone', label: 'Phone Number' },
                                    ] })] }), twoFactorType === 'phone' && (_jsx("div", { className: "p-4 bg-secondary rounded-md space-y-3", children: globalPhoneNumber ? (_jsxs(_Fragment, { children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Registered Phone Number" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-background px-2 py-1 rounded", children: globalPhoneNumber }), _jsx(Button, { variant: "ghost", size: "sm", onClick: copyPhoneNumber, title: "Copy to clipboard", children: phoneCopied ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] }), _jsx("p", { className: "text-xs text-muted-foreground mt-2", children: "Copy this number and use it for 2FA setup on the website" })] }), !pollingSms && !otpCode && (_jsx(Button, { variant: "secondary", size: "sm", onClick: startSmsPolling, children: "Start Waiting for SMS" })), pollingSms && (_jsxs("div", { className: "space-y-2", children: [_jsx("p", { className: "text-sm text-muted-foreground", children: "Waiting for SMS message..." }), _jsx(Button, { variant: "ghost", size: "sm", onClick: stopSmsPolling, children: "Stop Polling" })] })), otpCode && (_jsxs("div", { className: "p-3 bg-background rounded-md border-2 border-green-500", children: [_jsx("label", { className: "text-sm font-medium text-green-600", children: "OTP Code Received" }), _jsxs("div", { className: "flex items-center gap-2 mt-2", children: [_jsx("code", { className: "text-2xl font-mono font-bold", children: otpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => {
                                                            navigator.clipboard.writeText(otpCode);
                                                            setPhoneCopied(true);
                                                            setTimeout(() => setPhoneCopied(false), 2000);
                                                        }, children: _jsx(Copy, { size: 16 }) })] })] }))] })) : (_jsx(Alert, { variant: "warning", title: "No Phone Number Configured", children: "A global admin must configure a phone number in the vault settings." })) })), twoFactorType === 'qr' && (_jsxs("div", { className: "p-4 bg-secondary rounded-md", children: [_jsx("label", { className: "text-sm font-medium", children: "QR Code" }), _jsx("p", { className: "text-sm text-muted-foreground mt-2", children: "Upload a QR code image or paste the TOTP secret URI" })] })), _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx(Button, { variant: "secondary", onClick: () => navigate('/vault/personal'), children: "Cancel" }), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !formData.title, children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Saving...' : 'Save'] })] })] }) })] }));
}
export default ItemEdit;
