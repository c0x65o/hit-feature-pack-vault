'use client';
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Save, Trash2, Lock as LockIcon, Phone, Settings } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
export function PhoneNumberSetup({ onNavigate }) {
    const { Page, Card, Button, Input, Alert } = useUi();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(null);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [currentPhoneNumber, setCurrentPhoneNumber] = useState(null);
    const [isAdmin, setIsAdmin] = useState(false);
    const navigate = (path) => {
        if (onNavigate)
            onNavigate(path);
        else if (typeof window !== 'undefined')
            window.location.href = path;
    };
    useEffect(() => {
        loadCurrentPhoneNumber();
        checkAdminStatus();
    }, []);
    async function checkAdminStatus() {
        // TODO: Check if user has admin role
        // For now, assume admin (this should be checked via API)
        setIsAdmin(true);
    }
    async function loadCurrentPhoneNumber() {
        try {
            setLoading(true);
            const result = await vaultApi.getGlobalPhoneNumber();
            setCurrentPhoneNumber(result.phoneNumber);
            setPhoneNumber(result.phoneNumber || '');
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to load phone number'));
        }
        finally {
            setLoading(false);
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
            // Show success message
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
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to delete phone number'));
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
        { label: 'Setup', href: '/vault/setup', icon: _jsx(Settings, { size: 14 }) },
        { label: 'Phone Number', icon: _jsx(Phone, { size: 14 }) },
    ];
    if (!isAdmin) {
        return (_jsx(Page, { title: "Phone Number Setup", description: "Configure SMS phone number for 2FA", breadcrumbs: breadcrumbs, onNavigate: navigate, children: _jsx(Alert, { variant: "error", title: "Access Denied", children: "Admin access required to configure phone numbers." }) }));
    }
    return (_jsxs(Page, { title: "Phone Number Setup", description: "Configure the shared phone number for SMS 2FA codes", breadcrumbs: breadcrumbs, onNavigate: navigate, children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), _jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Phone Number" }), _jsx("p", { className: "text-xs text-muted-foreground mt-1 mb-2", children: "Enter the phone number in E.164 format (e.g., +1234567890). This number will be used for receiving 2FA codes for all vault items. Supports F-Droid (Android phone) or Twilio integrations." }), _jsx(Input, { value: phoneNumber, onChange: (value) => setPhoneNumber(value), placeholder: "+1234567890" })] }), currentPhoneNumber && (_jsxs(Alert, { variant: "info", title: "Current Configuration", children: [_jsxs("p", { className: "text-sm mt-2", children: ["Current phone number: ", _jsx("code", { className: "font-mono", children: currentPhoneNumber })] }), _jsxs("p", { className: "text-xs text-muted-foreground mt-2", children: ["Configure F-Droid or Twilio to send webhooks to:", ' ', _jsx("code", { className: "font-mono text-xs", children: typeof window !== 'undefined'
                                                ? `${window.location.origin}/api/vault/sms/webhook/inbound`
                                                : '/api/vault/sms/webhook/inbound' }), _jsx("br", {}), _jsxs("span", { className: "mt-1 block", children: ["For F-Droid: Set Authorization header to ", _jsxs("code", { className: "font-mono", children: ["Bearer ", '<API_KEY>'] }), " or use X-API-Key header."] })] })] })), !currentPhoneNumber && (_jsx(Alert, { variant: "warning", title: "No Phone Number Configured", children: _jsx("p", { className: "text-sm mt-2", children: "No phone number is currently configured. Users will not be able to use SMS 2FA until a phone number is set up." }) })), _jsxs("div", { className: "flex justify-end gap-2", children: [currentPhoneNumber && (_jsxs(Button, { variant: "secondary", onClick: handleDelete, disabled: saving, children: [_jsx(Trash2, { size: 16, className: "mr-2" }), "Delete"] })), _jsxs(Button, { variant: "primary", onClick: handleSave, disabled: saving || !phoneNumber.trim(), children: [_jsx(Save, { size: 16, className: "mr-2" }), saving ? 'Saving...' : 'Save'] })] })] }) })] }));
}
export default PhoneNumberSetup;
