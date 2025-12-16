'use client';
import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useUi } from '@hit/ui-kit';
import { Eye, Copy, Edit } from 'lucide-react';
import { vaultApi } from '../services/vault-api';
export function ItemDetail({ itemId, onNavigate }) {
    const { Page, Card, Button, Alert } = useUi();
    const [item, setItem] = useState(null);
    const [revealed, setRevealed] = useState(null);
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
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to reveal item'));
        }
    }
    async function handleCopy(field) {
        if (!item)
            return;
        try {
            await vaultApi.copyItem(item.id, field);
        }
        catch (err) {
            setError(err instanceof Error ? err : new Error('Failed to copy'));
        }
    }
    if (loading) {
        return (_jsx(Page, { title: "Loading...", description: "", children: _jsx("div", { className: "text-center py-8 text-muted-foreground", children: "Loading..." }) }));
    }
    return (_jsxs(Page, { title: item?.title || 'Item not found', description: item?.url || '', actions: item ? (_jsxs(Button, { variant: "primary", onClick: () => navigate(`/vault/items/${item.id}/edit`), children: [_jsx(Edit, { size: 16, className: "mr-2" }), "Edit"] })) : undefined, children: [error && (_jsx(Alert, { variant: "error", title: "Error", children: error.message })), !item && (_jsx(Card, { children: _jsx("div", { className: "p-6 text-center text-muted-foreground", children: "Item not found" }) })), item && (_jsx(Card, { children: _jsxs("div", { className: "p-6 space-y-4", children: [item.username && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Username" }), _jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("p", { className: "text-sm", children: item.username }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('username'), children: _jsx(Copy, { size: 16 }) })] })] })), _jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Password" }), _jsx("div", { className: "flex items-center gap-2 mt-1", children: revealed?.password ? (_jsxs(_Fragment, { children: [_jsx("p", { className: "text-sm font-mono", children: revealed.password }), _jsx(Button, { variant: "ghost", size: "sm", onClick: () => handleCopy('password'), children: _jsx(Copy, { size: 16 }) })] })) : (_jsxs(Button, { variant: "secondary", onClick: handleReveal, children: [_jsx(Eye, { size: 16, className: "mr-2" }), "Reveal Password"] })) })] }), revealed?.notes && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Notes" }), _jsx("p", { className: "text-sm mt-1 whitespace-pre-wrap", children: revealed.notes })] })), item.tags && item.tags.length > 0 && (_jsxs("div", { children: [_jsx("label", { className: "text-sm font-medium", children: "Tags" }), _jsx("div", { className: "flex flex-wrap gap-2 mt-1", children: item.tags.map(tag => (_jsx("span", { className: "px-2 py-1 bg-secondary rounded-md text-sm", children: tag }, tag))) })] }))] }) }))] }));
}
export default ItemDetail;
