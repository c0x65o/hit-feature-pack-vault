'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Eye, EyeOff, Copy, Edit, Check, RefreshCw, Key, FileText, Lock } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
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
        { label: 'Vault', href: '/vault/personal', icon: _jsx(Lock, { size: 14 }) },
        ...(item?.folderId ? [{ label: 'Folder', href: `/vault/folders/${item.folderId}` }] : []),
        { label: item?.title || 'Item' },
    ];
    return (_jsxs(Page, { title: item?.title || 'Item not found', description: item?.url || '', breadcrumbs: breadcrumbs, onNavigate: navigate, actions: item ? (_jsxs(Button, { variant: "primary", onClick: () => navigate(`/vault/items/${item.id}/edit`), children: [_jsx(Edit, { size: 16, className: "mr-2" }), "Edit"] })) : undefined, children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), !item && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "Item not found" }) })), item && (_jsx("div", { className: "space-y-4", children: _jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [getItemIcon(), _jsxs("div", { className: "flex-1", children: [_jsx("h2", { className: "text-xl font-semibold", children: item.title }), item.url && (_jsx("a", { href: item.url, target: "_blank", rel: "noopener noreferrer", className: "text-sm text-blue-600 hover:underline", children: item.url }))] })] }), item.username && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Username" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-secondary px-3 py-2 rounded flex-1", children: item.username }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('username', item.username), children: copied.username ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })] })), item.type === 'credential' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Password" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("code", { className: "text-sm font-mono bg-secondary px-3 py-2 rounded flex-1", children: revealed?.password && showPassword ? revealed.password : '••••••••' }), _jsx(Button, { variant: "ghost", size: "sm", onClick: async () => {
                                                    if (!revealed?.password) {
                                                        await handleReveal();
                                                        setShowPassword(true);
                                                    }
                                                    else {
                                                        setShowPassword(!showPassword);
                                                    }
                                                }, children: revealed?.password && showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) }), revealed?.password && (_jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('password', revealed.password), children: copied.password ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) }))] })] })), item.type === 'api_key' && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Secret / Key" }), _jsx("div", { className: "relative mt-1", children: revealed?.secret || revealed?.password ? (_jsxs(_Fragment, { children: [_jsx("textarea", { value: showPassword ? (revealed.secret || revealed.password) : '•'.repeat(Math.max((revealed.secret || revealed.password || '').length, 50)), readOnly: true, className: "w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm bg-secondary", style: {
                                                        ...(showPassword ? {} : {
                                                            caretColor: 'transparent',
                                                        })
                                                    } }), _jsxs("div", { className: "absolute top-2 right-2 flex gap-2", children: [_jsx(Button, { variant: "ghost", size: "sm", onClick: () => setShowPassword(!showPassword), title: showPassword ? 'Hide key' : 'Show key', children: showPassword ? _jsx(EyeOff, { size: 16 }) : _jsx(Eye, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('secret', revealed.secret || revealed.password), title: "Copy key", children: copied.secret ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })] })) : (_jsxs(_Fragment, { children: [_jsx("textarea", { value: "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022", readOnly: true, className: "w-full px-3 py-2 border rounded-md min-h-[200px] font-mono text-sm bg-secondary" }), _jsx("div", { className: "absolute top-2 right-2", children: _jsx(Button, { variant: "ghost", size: "sm", onClick: handleReveal, title: "Reveal secret", children: _jsx(Eye, { size: 16 }) }) })] })) })] })), revealed?.totpSecret && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "2FA Code (TOTP)" }), _jsx("div", { className: "flex items-center gap-2 mt-1", children: totpCode ? (_jsxs(_Fragment, { children: [_jsx("code", { className: "text-2xl font-mono font-bold bg-secondary px-4 py-2 rounded", children: totpCode }), _jsx(Button, { variant: "ghost", size: "sm", onClick: generateTotpCode, title: "Refresh code", children: _jsx(RefreshCw, { size: 16 }) }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('totp', totpCode), children: copied.totp ? (_jsx(Check, { size: 16, className: "text-green-600" })) : (_jsx(Copy, { size: 16 })) })] })) : (_jsx(Button, { variant: "secondary", onClick: generateTotpCode, children: "Generate TOTP Code" })) }), totpExpiresAt && (_jsxs("p", { className: "text-xs text-muted-foreground mt-1", children: ["Expires in ", Math.ceil((totpExpiresAt.getTime() - Date.now()) / 1000), "s"] }))] })), (revealed?.notes || item.type === 'secure_note') && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: item.type === 'secure_note' ? 'Content' : 'Notes' }), revealed?.notes ? (_jsx("div", { className: "mt-1 p-3 bg-secondary rounded text-sm whitespace-pre-wrap", children: revealed.notes })) : (_jsxs(Button, { variant: "secondary", onClick: handleReveal, children: [_jsx(Eye, { size: 16, className: "mr-2" }), "Reveal Note"] }))] })), item.tags && item.tags.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium text-muted-foreground", children: "Tags" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-1", children: item.tags.map(tag => (_jsx("span", { className: "px-2 py-1 bg-secondary rounded-md text-sm", children: tag }, tag))) })] }))] }) }) }))] }));
}
export default ItemDetail;
